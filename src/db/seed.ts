import { readFileSync } from "node:fs";
import path from "node:path";
import { hashPassword } from "../auth/password.ts";
import { isStage } from "../domain/stage.ts";
import { atMoscowHour, shiftDays } from "../domain/time.ts";
import type { Db } from "./open.ts";

type UserSeed = {
  login: string;
  password: string;
  role: string;
  firstName: string;
  lastName: string;
  interests: string;
  about: string;
  photo: string;
};

type EventSeed = {
  slug: string;
  title: string;
  description: string;
  when: string;
  startHour?: number;
  endHour?: number;
  ends?: string;
  venue?: string;
  topics: string[];
  character?: string;
  level?: string;
  regularity?: string;
  stage: string;
  official: number;
  format?: string;
  chatUrl?: string;
};

type Demo = {
  users: UserSeed[];
  venues: { name: string; description: string }[];
  topics: { name: string; description: string; color: string }[];
  events: EventSeed[];
  attendances: { login: string; slug: string; going: number }[];
  news: { login: string; slug: string; kind: string; body: string; at: string }[];
};

function readDemo(): Demo {
  const dir = path.join(process.cwd(), "data");
  const eventsFile = JSON.parse(readFileSync(path.join(dir, "events.json"), "utf8")) as {
    venues: Demo["venues"];
    topics: Demo["topics"];
    events: EventSeed[];
  };
  return {
    users: JSON.parse(readFileSync(path.join(dir, "users.json"), "utf8")) as UserSeed[],
    venues: eventsFile.venues,
    topics: eventsFile.topics,
    events: eventsFile.events,
    attendances: JSON.parse(readFileSync(path.join(dir, "attendances.json"), "utf8")),
    news: JSON.parse(readFileSync(path.join(dir, "news.json"), "utf8")),
  };
}

function eventStart(event: EventSeed, now: Date): string {
  if (event.when === "today") return atMoscowHour(now, event.startHour ?? 19);
  if (event.when.startsWith("+")) {
    const days = Number(event.when.slice(1, -1));
    return shiftDays(now, days, event.startHour ?? 18);
  }
  return event.when;
}

function eventEnd(event: EventSeed, now: Date): string | null {
  if (event.when === "today" && event.endHour) return atMoscowHour(now, event.endHour);
  return event.ends ?? null;
}

export function seedIfEmpty(db: Db, now: Date, demo: Demo = readDemo()): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n > 0) return;

  const insertUser = db.prepare(
    `INSERT INTO users (login, password_hash, role, first_name, last_name, interests, about, photo_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertOrganizer = db.prepare(
    `INSERT INTO organizers (user_id, name, description, photo_path) VALUES (?, ?, ?, ?)`,
  );
  for (const user of demo.users) {
    insertUser.run(
      user.login,
      hashPassword(user.password),
      user.role,
      user.firstName,
      user.lastName,
      user.interests,
      user.about,
      user.photo,
    );
    if (user.role === "organizer") {
      const id = (db.prepare("SELECT id FROM users WHERE login = ?").get(user.login) as { id: number }).id;
      insertOrganizer.run(id, `${user.firstName} ${user.lastName}`, user.about, user.photo);
    }
  }

  const insertVenue = db.prepare("INSERT INTO venues (name, description) VALUES (?, ?)");
  for (const venue of demo.venues) insertVenue.run(venue.name, venue.description);

  const insertTopic = db.prepare("INSERT INTO topics (name, description, color) VALUES (?, ?, ?)");
  for (const topic of demo.topics) insertTopic.run(topic.name, topic.description, topic.color);

  const organizer = db.prepare("SELECT id FROM organizers LIMIT 1").get() as { id: number };
  const insertEvent = db.prepare(
    `INSERT INTO events (
      organizer_id, title, description, starts_at, ends_at, venue_id, character, level,
      regularity, stage, official, format, chat_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertLink = db.prepare("INSERT INTO event_topics (event_id, topic_id) VALUES (?, ?)");

  for (const event of demo.events) {
    if (!isStage(event.stage)) throw new Error(`Неизвестный этап: ${event.stage}`);
    const startsAt = eventStart(event, now);
    const venue = event.venue
      ? (db.prepare("SELECT id FROM venues WHERE name = ?").get(event.venue) as { id: number })
      : null;
    insertEvent.run(
      organizer.id,
      event.title,
      event.description,
      startsAt,
      eventEnd(event, now),
      venue?.id ?? null,
      event.character ?? null,
      event.level ?? null,
      event.regularity ?? null,
      event.stage,
      event.official,
      event.format ?? null,
      event.chatUrl ?? null,
    );
    const eventId = (db.prepare("SELECT id FROM events WHERE title = ?").get(event.title) as { id: number }).id;
    for (const topicName of event.topics) {
      const topic = db.prepare("SELECT id FROM topics WHERE name = ?").get(topicName) as { id: number };
      insertLink.run(eventId, topic.id);
    }
  }

  const insertGoing = db.prepare(
    "INSERT INTO attendances (user_id, event_id, going) VALUES (?, ?, ?)",
  );
  for (const row of demo.attendances) {
    const user = db.prepare("SELECT id FROM users WHERE login = ?").get(row.login) as { id: number };
    const event = db.prepare("SELECT id FROM events WHERE title = ?").get(titleOf(demo, row.slug)) as { id: number };
    insertGoing.run(user.id, event.id, row.going);
  }

  const insertNews = db.prepare(
    "INSERT INTO news (user_id, event_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  for (const row of demo.news) {
    const user = db.prepare("SELECT id FROM users WHERE login = ?").get(row.login) as { id: number };
    const event = db.prepare("SELECT id FROM events WHERE title = ?").get(titleOf(demo, row.slug)) as { id: number };
    insertNews.run(user.id, event.id, row.kind, row.body, row.at);
  }
}

function titleOf(demo: Demo, slug: string): string {
  const event = demo.events.find((item) => item.slug === slug);
  if (!event) throw new Error(`Нет мероприятия ${slug}`);
  return event.title;
}
