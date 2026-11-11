import type { Stage } from "../domain/stage.ts";
import { overlapsToday } from "../domain/time.ts";
import type { Db } from "./open.ts";

export type UserRow = {
  id: number;
  login: string;
  passwordHash: string;
  role: "participant" | "organizer";
  firstName: string;
  lastName: string;
  interests: string;
  about: string;
  photoPath: string;
};

export type TopicRow = { id: number; name: string; description: string; color: string };
export type VenueRow = { id: number; name: string; description: string };

export type EventRow = {
  id: number;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  stage: Stage;
  official: boolean;
  format: string | null;
  character: string | null;
  level: string | null;
  regularity: string | null;
  chatUrl: string | null;
  venue: VenueRow | null;
  topics: TopicRow[];
  organizerUserId: number;
  organizerName: string;
  organizerAbout: string;
  organizerPhoto: string;
  organizerInterests: string;
  goingCount: number;
  myGoing: boolean | null;
};

export type NewsRow = { id: number; eventId: number; kind: string; body: string; createdAt: string };
export type AttendeeRow = {
  firstName: string;
  lastName: string;
  interests: string;
  about: string;
  photoPath: string;
};

type RawEvent = {
  id: number;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  stage: Stage;
  official: number;
  format: string | null;
  character: string | null;
  level: string | null;
  regularity: string | null;
  chat_url: string | null;
  venue_id: number | null;
  venue_name: string | null;
  venue_description: string | null;
  organizer_user_id: number;
  organizer_name: string;
  organizer_about: string;
  organizer_photo: string;
  organizer_interests: string;
};

const EVENT_SQL = `
SELECT e.id, e.title, e.description, e.starts_at, e.ends_at, e.stage, e.official,
       e.format, e.character, e.level, e.regularity, e.chat_url,
       v.id AS venue_id, v.name AS venue_name, v.description AS venue_description,
       o.user_id AS organizer_user_id, o.name AS organizer_name,
       u.about AS organizer_about, u.photo_path AS organizer_photo, u.interests AS organizer_interests
FROM events e
JOIN organizers o ON o.id = e.organizer_id
JOIN users u ON u.id = o.user_id
LEFT JOIN venues v ON v.id = e.venue_id
`;

export function findUserByLogin(db: Db, login: string): UserRow | null {
  const row = db.prepare(
    `SELECT id, login, password_hash, role, first_name, last_name, interests, about, photo_path
     FROM users WHERE login = ?`,
  ).get(login) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export function findUserById(db: Db, id: number): UserRow | null {
  const row = db.prepare(
    `SELECT id, login, password_hash, role, first_name, last_name, interests, about, photo_path
     FROM users WHERE id = ?`,
  ).get(id) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export function listTopics(db: Db): TopicRow[] {
  return (db.prepare("SELECT id, name, description, color FROM topics ORDER BY id").all() as Record<string, unknown>[]).map(
    (row) => ({
      id: Number(row.id),
      name: String(row.name),
      description: String(row.description),
      color: String(row.color),
    }),
  );
}

export function listVenues(db: Db): VenueRow[] {
  return (db.prepare("SELECT id, name, description FROM venues ORDER BY id").all() as Record<string, unknown>[]).map(
    (row) => ({ id: Number(row.id), name: String(row.name), description: String(row.description) }),
  );
}

export function listCatalog(db: Db, viewerId: number, now: Date): EventRow[] {
  const rows = db.prepare(`${EVENT_SQL} WHERE e.stage != 'отменено' ORDER BY e.starts_at`).all() as RawEvent[];
  return rows.map((row) => hydrate(db, row, viewerId, now)).sort(byCurrentThenDate(now));
}

export function listGoing(db: Db, viewerId: number, now: Date): EventRow[] {
  const rows = db.prepare(
    `${EVENT_SQL}
     JOIN attendances a ON a.event_id = e.id AND a.user_id = ? AND a.going = 1
     ORDER BY e.starts_at`,
  ).all(viewerId) as RawEvent[];
  return rows.map((row) => hydrate(db, row, viewerId, now)).sort(byCurrentThenDate(now));
}

export function listMine(db: Db, organizerUserId: number, now: Date): EventRow[] {
  const rows = db.prepare(`${EVENT_SQL} WHERE o.user_id = ? ORDER BY e.starts_at`).all(organizerUserId) as RawEvent[];
  return rows.map((row) => hydrate(db, row, organizerUserId, now)).sort(byCurrentThenDate(now));
}

function byCurrentThenDate(now: Date) {
  return (a: EventRow, b: EventRow) => {
    const aNow = overlapsToday(a.startsAt, a.endsAt, now) ? 0 : 1;
    const bNow = overlapsToday(b.startsAt, b.endsAt, now) ? 0 : 1;
    if (aNow !== bNow) return aNow - bNow;
    if (a.startsAt === b.startsAt) return 0;
    return a.startsAt > b.startsAt ? -1 : 1;
  };
}

export function getEvent(db: Db, id: number, viewerId: number, now: Date): EventRow | null {
  const row = db.prepare(`${EVENT_SQL} WHERE e.id = ?`).get(id) as RawEvent | undefined;
  return row ? hydrate(db, row, viewerId, now) : null;
}

export function findEventByTitle(db: Db, titlePart: string, viewerId: number, now: Date): EventRow {
  const row = db.prepare(`${EVENT_SQL} WHERE e.title LIKE ?`).get(`%${titlePart}%`) as RawEvent | undefined;
  if (!row) throw new Error(`Нет мероприятия ${titlePart}`);
  return hydrate(db, row, viewerId, now);
}

export function listNews(db: Db, userId: number): NewsRow[] {
  const rows = db.prepare(
    "SELECT id, event_id, kind, body, created_at FROM news WHERE user_id = ? ORDER BY created_at DESC, id DESC",
  ).all(userId) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    eventId: Number(row.event_id),
    kind: String(row.kind),
    body: String(row.body),
    createdAt: String(row.created_at),
  }));
}

export function listOrganizerNames(db: Db): string[] {
  const rows = db.prepare("SELECT name FROM organizers ORDER BY name").all() as { name: string }[];
  return rows.map((row) => row.name);
}

export function listPeople(db: Db): (AttendeeRow & { id: number })[] {
  const rows = db.prepare(
    "SELECT id, first_name, last_name, interests, about, photo_path FROM users ORDER BY last_name",
  ).all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    interests: String(row.interests),
    about: String(row.about),
    photoPath: String(row.photo_path),
  }));
}

export function listAttendees(db: Db, eventId: number): AttendeeRow[] {
  const rows = db.prepare(
    `SELECT u.first_name, u.last_name, u.interests, u.about, u.photo_path
     FROM attendances a JOIN users u ON u.id = a.user_id
     WHERE a.event_id = ? AND a.going = 1 ORDER BY u.last_name`,
  ).all(eventId) as Record<string, unknown>[];
  return rows.map((row) => ({
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    interests: String(row.interests),
    about: String(row.about),
    photoPath: String(row.photo_path),
  }));
}

export function setAttendance(db: Db, userId: number, eventId: number, going: boolean): void {
  db.prepare(
    `INSERT INTO attendances (user_id, event_id, going) VALUES (?, ?, ?)
     ON CONFLICT(user_id, event_id) DO UPDATE SET going = excluded.going`,
  ).run(userId, eventId, going ? 1 : 0);
}

export function addNews(db: Db, userId: number, eventId: number, kind: string, body: string, at: string): void {
  db.prepare("INSERT INTO news (user_id, event_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?)").run(
    userId,
    eventId,
    kind,
    body,
    at,
  );
}

export function updateStage(db: Db, eventId: number, stage: Stage): void {
  db.prepare("UPDATE events SET stage = ? WHERE id = ?").run(stage, eventId);
}

export function updateStartsAt(db: Db, eventId: number, startsAt: string): void {
  db.prepare("UPDATE events SET starts_at = ? WHERE id = ?").run(startsAt, eventId);
}

export function updateEvent(
  db: Db,
  eventId: number,
  event: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string | null;
    venueId: number | null;
    topicIds: number[];
    character: string | null;
    level: string | null;
    regularity: string | null;
    format: string | null;
    chatUrl: string | null;
  },
): void {
  db.prepare(
    `UPDATE events
     SET title = ?, description = ?, starts_at = ?, ends_at = ?, venue_id = ?,
         character = ?, level = ?, regularity = ?, format = ?, chat_url = ?
     WHERE id = ?`,
  ).run(
    event.title,
    event.description,
    event.startsAt,
    event.endsAt,
    event.venueId,
    event.character,
    event.level,
    event.regularity,
    event.format,
    event.chatUrl,
    eventId,
  );
  db.prepare("DELETE FROM event_topics WHERE event_id = ?").run(eventId);
  const link = db.prepare("INSERT INTO event_topics (event_id, topic_id) VALUES (?, ?)");
  for (const topicId of event.topicIds) link.run(eventId, topicId);
}

export function updateProfile(
  db: Db,
  userId: number,
  profile: { firstName: string; lastName: string; interests: string; about: string; photoPath?: string },
): void {
  if (profile.photoPath) {
    db.prepare(
      "UPDATE users SET first_name = ?, last_name = ?, interests = ?, about = ?, photo_path = ? WHERE id = ?",
    ).run(profile.firstName, profile.lastName, profile.interests, profile.about, profile.photoPath, userId);
  } else {
    db.prepare("UPDATE users SET first_name = ?, last_name = ?, interests = ?, about = ? WHERE id = ?").run(
      profile.firstName,
      profile.lastName,
      profile.interests,
      profile.about,
      userId,
    );
  }
  db.prepare("UPDATE organizers SET name = ?, description = ?, photo_path = COALESCE(?, photo_path) WHERE user_id = ?").run(
    `${profile.firstName} ${profile.lastName}`,
    profile.about,
    profile.photoPath ?? null,
    userId,
  );
}

export type NewEvent = {
  organizerUserId: number;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venueId: number | null;
  topicIds: number[];
  character: string | null;
  level: string | null;
  regularity: string | null;
  stage: Stage;
  format: string | null;
  chatUrl: string | null;
};

export function insertEvent(db: Db, event: NewEvent): number {
  const organizer = db.prepare("SELECT id FROM organizers WHERE user_id = ?").get(event.organizerUserId) as
    | { id: number }
    | undefined;
  if (!organizer) throw new Error("Нет записи организатора");
  db.prepare(
    `INSERT INTO events (
      organizer_id, title, description, starts_at, ends_at, venue_id, character, level,
      regularity, stage, official, format, chat_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    organizer.id,
    event.title,
    event.description,
    event.startsAt,
    event.endsAt,
    event.venueId,
    event.character,
    event.level,
    event.regularity,
    event.stage,
    event.format,
    event.chatUrl,
  );
  const id = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as { id: number }).id);
  const link = db.prepare("INSERT INTO event_topics (event_id, topic_id) VALUES (?, ?)");
  for (const topicId of event.topicIds) link.run(id, topicId);
  return id;
}

export function goingUserIds(db: Db, eventId: number): number[] {
  const rows = db.prepare("SELECT user_id FROM attendances WHERE event_id = ? AND going = 1").all(eventId) as {
    user_id: number;
  }[];
  return rows.map((row) => Number(row.user_id));
}

export function countUsers(db: Db): number {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n);
}

function hydrate(db: Db, row: RawEvent, viewerId: number, _now: Date): EventRow {
  const topics = db.prepare(
    `SELECT t.id, t.name, t.description, t.color
     FROM event_topics et JOIN topics t ON t.id = et.topic_id
     WHERE et.event_id = ? ORDER BY t.id`,
  ).all(row.id) as Record<string, unknown>[];
  const going = db.prepare("SELECT going FROM attendances WHERE user_id = ? AND event_id = ?").get(viewerId, row.id) as
    | { going: number }
    | undefined;
  const count = db.prepare("SELECT COUNT(*) AS n FROM attendances WHERE event_id = ? AND going = 1").get(row.id) as {
    n: number;
  };
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    stage: row.stage,
    official: row.official === 1,
    format: row.format,
    character: row.character,
    level: row.level,
    regularity: row.regularity,
    chatUrl: row.chat_url,
    venue: row.venue_id
      ? { id: Number(row.venue_id), name: String(row.venue_name), description: String(row.venue_description) }
      : null,
    topics: topics.map((topic) => ({
      id: Number(topic.id),
      name: String(topic.name),
      description: String(topic.description),
      color: String(topic.color),
    })),
    organizerUserId: Number(row.organizer_user_id),
    organizerName: row.organizer_name,
    organizerAbout: row.organizer_about,
    organizerPhoto: row.organizer_photo,
    organizerInterests: row.organizer_interests,
    goingCount: Number(count.n),
    myGoing: going ? going.going === 1 : null,
  };
}

function mapUser(row: Record<string, unknown>): UserRow {
  return {
    id: Number(row.id),
    login: String(row.login),
    passwordHash: String(row.password_hash),
    role: row.role === "organizer" ? "organizer" : "participant",
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    interests: String(row.interests),
    about: String(row.about),
    photoPath: String(row.photo_path),
  };
}
