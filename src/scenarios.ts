import { verifyPassword } from "./auth/password.ts";
import { missingRequired } from "./domain/draft.ts";
import {
  joinedText,
  leftText,
  notGoingText,
  goingText,
  stageRecipients,
  stageText,
  timeChangeText,
} from "./domain/news.ts";
import { allowedMoves, canAttend, canEdit, isStage } from "./domain/stage.ts";
import { moscowClock, moscowLocalToIso } from "./domain/time.ts";
import type { Db } from "./db/open.ts";
import {
  addNews,
  findUserById,
  findUserByLogin,
  getEvent,
  goingUserIds,
  insertEvent,
  setAttendance,
  updateStartsAt,
  updateProfile,
  updateEvent,
  updateStage,
  type UserRow,
} from "./db/store.ts";

export function login(db: Db, loginName: string, password: string): UserRow | null {
  const user = findUserByLogin(db, loginName.trim());
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return user;
}

export function pressAttendance(db: Db, userId: number, eventId: number, going: boolean, now: Date): boolean {
  const event = getEvent(db, eventId, userId, now);
  if (!event || !canAttend(event.stage)) return false;
  if (event.myGoing === going) return true;
  const user = mustUser(db, userId);
  setAttendance(db, userId, eventId, going);
  const at = now.toISOString();
  addNews(db, userId, eventId, going ? "going" : "not-going", going ? goingText(event.title) : notGoingText(event.title), at);
  const name = `${user.firstName} ${user.lastName}`;
  const organizerText = going ? joinedText(name, event.title, user.interests) : leftText(name, event.title);
  if (event.organizerUserId !== userId) {
    addNews(db, event.organizerUserId, eventId, going ? "joined" : "left", organizerText, at);
  }
  return true;
}

export function moveStage(db: Db, actorId: number, eventId: number, stage: string, now: Date): boolean {
  const event = getEvent(db, eventId, actorId, now);
  if (!event || event.organizerUserId !== actorId || !isStage(stage)) return false;
  if (!allowedMoves(event.stage).includes(stage)) return false;
  updateStage(db, eventId, stage);
  const body = stageText(event.title, stage);
  const at = now.toISOString();
  for (const recipient of stageRecipients(goingUserIds(db, eventId), event.organizerUserId)) {
    addNews(db, recipient, eventId, "stage", body, at);
  }
  return true;
}

export function changeStart(db: Db, actorId: number, eventId: number, startsLocal: string, now: Date): boolean {
  const event = getEvent(db, eventId, actorId, now);
  if (!event || event.organizerUserId !== actorId || !canEdit(event.stage)) return false;
  const startsAt = moscowLocalToIso(startsLocal);
  if (!startsAt) return false;
  const was = moscowClock(event.startsAt);
  const became = moscowClock(startsAt);
  updateStartsAt(db, eventId, startsAt);
  const body = timeChangeText(event.title, was, became);
  const at = now.toISOString();
  for (const recipient of stageRecipients(goingUserIds(db, eventId), event.organizerUserId)) {
    addNews(db, recipient, eventId, "property", body, at);
  }
  return true;
}

export type CreateInput = {
  title: string;
  description: string;
  startsLocal: string;
  endsLocal: string;
  venueId: number | null;
  topicIds: number[];
  character: string;
  level: string;
  regularity: string;
  stage: string;
  format: string;
  chatUrl: string;
};

export function createEvent(db: Db, actorId: number, input: CreateInput): { ok: true; id: number } | { ok: false; missing: string[] } {
  const user = mustUser(db, actorId);
  if (user.role !== "organizer") return { ok: false, missing: ["организатор"] };
  const startsAt = moscowLocalToIso(input.startsLocal);
  const missing = missingRequired({
    title: input.title,
    description: input.description,
    startsAt,
    topicIds: input.topicIds,
  });
  if (missing.length) return { ok: false, missing };
  const stage = isStage(input.stage) ? input.stage : "хотим провести";
  const id = insertEvent(db, {
    organizerUserId: actorId,
    title: input.title.trim(),
    description: input.description.trim(),
    startsAt,
    endsAt: moscowLocalToIso(input.endsLocal) || null,
    venueId: input.venueId,
    topicIds: input.topicIds,
    character: emptyToNull(input.character),
    level: emptyToNull(input.level),
    regularity: emptyToNull(input.regularity),
    stage,
    format: emptyToNull(input.format),
    chatUrl: emptyToNull(input.chatUrl),
  });
  return { ok: true, id };
}

export function editEvent(
  db: Db,
  actorId: number,
  eventId: number,
  input: CreateInput,
  now: Date,
): { ok: true } | { ok: false; missing: string[] } {
  const event = getEvent(db, eventId, actorId, now);
  if (!event || event.organizerUserId !== actorId || !canEdit(event.stage)) return { ok: false, missing: [] };
  const startsAt = moscowLocalToIso(input.startsLocal);
  const missing = missingRequired({
    title: input.title,
    description: input.description,
    startsAt,
    topicIds: input.topicIds,
  });
  if (missing.length) return { ok: false, missing };
  updateEvent(db, eventId, {
    title: input.title.trim(),
    description: input.description.trim(),
    startsAt,
    endsAt: moscowLocalToIso(input.endsLocal) || null,
    venueId: input.venueId,
    topicIds: input.topicIds,
    character: emptyToNull(input.character),
    level: emptyToNull(input.level),
    regularity: emptyToNull(input.regularity),
    format: emptyToNull(input.format),
    chatUrl: emptyToNull(input.chatUrl),
  });
  if (new Date(startsAt).getTime() === new Date(event.startsAt).getTime()) return { ok: true };
  const body = timeChangeText(event.title, moscowClock(event.startsAt), moscowClock(startsAt));
  const at = now.toISOString();
  for (const recipient of stageRecipients(goingUserIds(db, eventId), event.organizerUserId)) {
    addNews(db, recipient, eventId, "property", body, at);
  }
  return { ok: true };
}

export function saveProfile(
  db: Db,
  userId: number,
  profile: { firstName: string; lastName: string; interests: string; about: string; photoPath?: string },
): void {
  updateProfile(db, userId, profile);
}

function mustUser(db: Db, id: number) {
  const user = findUserById(db, id);
  if (!user) throw new Error("Нет пользователя");
  return user;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
