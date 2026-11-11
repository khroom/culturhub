import assert from "node:assert/strict";
import test from "node:test";
import { openDatabase } from "./db/open.ts";
import { seedIfEmpty } from "./db/seed.ts";
import {
  countUsers,
  findEventByTitle,
  findUserByLogin,
  listAttendees,
  listCatalog,
  listGoing,
  listMine,
  listNews,
} from "./db/store.ts";
import { changeStart, createEvent, login, moveStage, pressAttendance, saveProfile } from "./scenarios.ts";

const now = new Date("2026-11-11T09:00:00.000Z");

function fresh() {
  const db = openDatabase();
  seedIfEmpty(db, now);
  return db;
}

test("повторная заливка не дублирует людей", () => {
  const db = fresh();
  seedIfEmpty(db, now);
  assert.equal(countUsers(db), 4);
});

test("Мария входит и видит три своих мероприятия", () => {
  const db = fresh();
  const maria = login(db, "maria", "demo");
  assert.ok(maria);
  assert.equal(maria.role, "participant");
  assert.equal(login(db, "maria", "нет"), null);
  const titles = listGoing(db, maria.id, now).map((event) => event.title);
  assert.deepEqual(titles.map((title) => title.includes("настольн") || title.includes("Бессонова") || title.includes("киноклуб")), [
    true,
    true,
    true,
  ]);
  assert.equal(titles[0].includes("настольн"), true);
});

test("Арина видит восемь карточек", () => {
  const db = fresh();
  const arina = login(db, "arina", "demo");
  assert.ok(arina);
  const mine = listMine(db, arina.id, now);
  assert.equal(mine.length, 8);
  assert.equal(mine[0].title.includes("настольн"), true);
  const later = mine.slice(1).map((event) => event.startsAt);
  assert.deepEqual(later, [...later].sort().reverse());
});

test("каталог Киры без киноклуба, с онлайном и без площадки у первокурсников", () => {
  const db = fresh();
  const kira = findUserByLogin(db, "kira");
  assert.ok(kira);
  const catalog = listCatalog(db, kira.id, now);
  assert.equal(catalog.some((event) => event.title.includes("киноклуб")), false);
  assert.ok(catalog.some((event) => event.stage === "хотим провести"));
  assert.ok(catalog.some((event) => event.stage === "ждём разрешения"));
  assert.ok(catalog.some((event) => event.stage === "точно будет"));
  assert.ok(catalog.some((event) => event.stage === "уже прошло"));
  const project = catalog.find((event) => event.title.includes("проекта"));
  assert.equal(project?.venue?.name, "Онлайн");
  const freshman = catalog.find((event) => event.title.includes("первокурс"));
  assert.equal(freshman?.venue, null);
  assert.equal(catalog[0].title.includes("настольн"), true);
  const later = catalog.slice(1).map((event) => event.startsAt);
  assert.deepEqual(later, [...later].sort().reverse());
});

test("у гала две тематики и у трёх встреч внешний чат", () => {
  const db = fresh();
  const maria = findUserByLogin(db, "maria");
  assert.ok(maria);
  const gala = findEventByTitle(db, "Физики", maria.id, now);
  assert.deepEqual(gala.topics.map((topic) => topic.name), ["Искусство", "Наука"]);
  for (const part of ["настольн", "ФуНТ", "проекта"]) {
    const event = findEventByTitle(db, part, maria.id, now);
    assert.ok(event.chatUrl?.startsWith("https://chat.example/"));
  }
  assert.equal(findEventByTitle(db, "первокурс", maria.id, now).chatUrl, null);
});

test("Кира записывается один раз, новость Вы идёте только у неё", () => {
  const db = fresh();
  const kira = findUserByLogin(db, "kira");
  const arina = findUserByLogin(db, "arina");
  const maria = findUserByLogin(db, "maria");
  assert.ok(kira && arina && maria);
  const freshman = findEventByTitle(db, "первокурс", kira.id, now);
  assert.equal(pressAttendance(db, kira.id, freshman.id, true, now), true);
  assert.equal(pressAttendance(db, kira.id, freshman.id, true, now), true);
  assert.equal(findEventByTitle(db, "первокурс", arina.id, now).goingCount, 1);
  const kiraNews = listNews(db, kira.id).map((item) => item.body);
  assert.equal(kiraNews.filter((body) => body.includes("Вы идёте")).length, 1);
  assert.equal(listNews(db, maria.id).some((item) => item.body.includes("Вы идёте") && item.body.includes("первокурс")), false);
  assert.equal(listNews(db, arina.id).some((item) => item.body.startsWith("Вы идёте")), false);
});

test("Мария отказывается и записывается снова, смена этапа не стирает список", () => {
  const db = fresh();
  const maria = findUserByLogin(db, "maria");
  const arina = findUserByLogin(db, "arina");
  assert.ok(maria && arina);
  const games = findEventByTitle(db, "настольн", maria.id, now);
  const before = games.goingCount;
  assert.equal(pressAttendance(db, maria.id, games.id, false, now), true);
  assert.equal(listGoing(db, maria.id, now).some((event) => event.id === games.id), false);
  assert.equal(findEventByTitle(db, "настольн", arina.id, now).goingCount, before - 1);
  assert.ok(listNews(db, maria.id).some((item) => item.body.includes("Вы не идёте")));
  assert.equal(pressAttendance(db, maria.id, games.id, true, now), true);
  const funt = findEventByTitle(db, "ФуНТ", arina.id, now);
  assert.equal(moveStage(db, arina.id, funt.id, "точно будет", now), true);
  assert.equal(findEventByTitle(db, "настольн", arina.id, now).goingCount, before);
});

test("на прошедшее и отменённое записаться нельзя", () => {
  const db = fresh();
  const kira = findUserByLogin(db, "kira");
  assert.ok(kira);
  const past = findEventByTitle(db, "Бессонова", kira.id, now);
  const cancelled = findEventByTitle(db, "киноклуб", kira.id, now);
  assert.equal(pressAttendance(db, kira.id, past.id, true, now), false);
  assert.equal(pressAttendance(db, kira.id, cancelled.id, true, now), false);
});

test("смена этапа читки видна Илье и Арине, но не Марии", () => {
  const db = fresh();
  const arina = findUserByLogin(db, "arina");
  const ilya = findUserByLogin(db, "ilya");
  const maria = findUserByLogin(db, "maria");
  assert.ok(arina && ilya && maria);
  const funt = findEventByTitle(db, "ФуНТ", arina.id, now);
  assert.equal(moveStage(db, arina.id, funt.id, "хотим провести", now), false);
  assert.equal(moveStage(db, arina.id, funt.id, "точно будет", now), true);
  assert.equal(moveStage(db, arina.id, findEventByTitle(db, "Бессонова", arina.id, now).id, "отменено", now), false);
  const body = "перешёл в этап «точно будет»";
  assert.ok(listNews(db, ilya.id).some((item) => item.body.includes(body)));
  assert.ok(listNews(db, arina.id).some((item) => item.body.includes(body)));
  assert.equal(listNews(db, maria.id).some((item) => item.body.includes(body)), false);
});

test("смена времени настолок уходит Марии и Арине", () => {
  const db = fresh();
  const arina = findUserByLogin(db, "arina");
  const maria = findUserByLogin(db, "maria");
  const ilya = findUserByLogin(db, "ilya");
  const kira = findUserByLogin(db, "kira");
  assert.ok(arina && maria && ilya && kira);
  const games = findEventByTitle(db, "настольн", arina.id, now);
  assert.equal(changeStart(db, arina.id, games.id, "2026-11-11T20:00", now), true);
  const needle = "было 19:00, стало 20:00";
  assert.ok(listNews(db, maria.id).some((item) => item.body.includes(needle)));
  assert.ok(listNews(db, arina.id).some((item) => item.body.includes(needle)));
  assert.equal(listNews(db, ilya.id).some((item) => item.body.includes(needle)), false);
  assert.equal(listNews(db, kira.id).some((item) => item.body.includes(needle)), false);
});

test("создание требует четыре поля и оставляет организатора", () => {
  const db = fresh();
  const arina = findUserByLogin(db, "arina");
  assert.ok(arina);
  const empty = createEvent(db, arina.id, {
    title: "",
    description: "",
    startsLocal: "",
    endsLocal: "",
    venueId: null,
    topicIds: [],
    character: "",
    level: "",
    regularity: "",
    stage: "",
    format: "",
    chatUrl: "",
  });
  assert.equal(empty.ok, false);
  const created = createEvent(db, arina.id, {
    title: "Новая читка",
    description: "Короткий разбор сцены.",
    startsLocal: "2026-12-01T18:00",
    endsLocal: "",
    venueId: null,
    topicIds: [1],
    character: "",
    level: "",
    regularity: "",
    stage: "отменено",
    format: "",
    chatUrl: "",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const event = listMine(db, arina.id, now).find((item) => item.id === created.id);
  assert.ok(event);
  assert.equal(event.stage, "отменено");
  assert.equal(event.organizerUserId, arina.id);
  assert.equal(event.official, false);
});

test("профиль Марии виден Арине без почты", () => {
  const db = fresh();
  const maria = findUserByLogin(db, "maria");
  const arina = findUserByLogin(db, "arina");
  assert.ok(maria && arina);
  saveProfile(db, maria.id, {
    firstName: "Мария",
    lastName: "Лебедева",
    interests: "Манга и чай",
    about: "Новая строка о себе",
  });
  const people = listAttendees(db, findEventByTitle(db, "настольн", arina.id, now).id);
  const person = people.find((item) => item.firstName === "Мария");
  assert.equal(person?.interests, "Манга и чай");
  assert.equal(person?.about, "Новая строка о себе");
  assert.deepEqual(Object.keys(person ?? {}).sort(), ["about", "firstName", "interests", "lastName", "photoPath"]);
});

test("в ленте при входе уже есть новости, и в них нет слова подписка", () => {
  const db = fresh();
  const maria = findUserByLogin(db, "maria");
  const ilya = findUserByLogin(db, "ilya");
  const kira = findUserByLogin(db, "kira");
  const arina = findUserByLogin(db, "arina");
  assert.ok(maria && ilya && kira && arina);
  assert.equal(listNews(db, maria.id).length, 3);
  assert.equal(listNews(db, ilya.id).length, 3);
  assert.equal(listNews(db, kira.id).length, 0);
  assert.ok(listNews(db, arina.id).some((item) => item.body.includes("Мария Лебедева идёт")));
  assert.ok(listNews(db, arina.id).some((item) => item.body.includes("Илья Морозов не идёт")));
  const all = [...listNews(db, maria.id), ...listNews(db, ilya.id), ...listNews(db, arina.id)];
  assert.equal(all.some((item) => item.body.toLowerCase().includes("подписк")), false);
});
