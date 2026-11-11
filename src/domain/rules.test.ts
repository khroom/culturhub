import assert from "node:assert/strict";
import test from "node:test";
import { missingRequired } from "./draft.ts";
import { goingText, stageRecipients } from "./news.ts";
import { allowedMoves, canAttend, isTerminal, visibleInCatalog } from "./stage.ts";
import { atMoscowHour, overlapsToday } from "./time.ts";

test("этап двигается только вперёд или в отменено", () => {
  assert.deepEqual(allowedMoves("ждём разрешения"), ["точно будет", "отменено"]);
  assert.deepEqual(allowedMoves("уже прошло"), []);
  assert.deepEqual(allowedMoves("отменено"), []);
  assert.equal(isTerminal("уже прошло"), true);
  assert.equal(canAttend("точно будет"), true);
  assert.equal(canAttend("уже прошло"), false);
  assert.equal(canAttend("отменено"), false);
});

test("отменено не видно в общем каталоге", () => {
  assert.equal(visibleInCatalog("отменено"), false);
  assert.equal(visibleInCatalog("хотим провести"), true);
  assert.equal(visibleInCatalog("уже прошло"), true);
});

test("новость о смене этапа уходит организатору и тем, кто идёт", () => {
  assert.deepEqual(stageRecipients([2, 3], 1).sort(), [1, 2, 3]);
  assert.deepEqual(stageRecipients([1], 1), [1]);
});

test("для сохранения нужны четыре поля", () => {
  assert.deepEqual(
    missingRequired({ title: "", description: "", startsAt: "", topicIds: [] }),
    ["название", "описание", "дата начала", "тематика"],
  );
  assert.deepEqual(
    missingRequired({
      title: "Читка",
      description: "Текст",
      startsAt: "2026-11-12T15:00:00.000Z",
      topicIds: [1],
    }),
    [],
  );
});

test("интервал сегодняшнего дня Москвы попадает в идёт сегодня", () => {
  const now = new Date("2026-11-11T09:00:00.000Z");
  const start = atMoscowHour(now, 19);
  const end = atMoscowHour(now, 22);
  assert.equal(overlapsToday(start, end, now), true);
  assert.equal(overlapsToday("2026-03-30T16:00:00.000Z", null, now), false);
});

test("личное подтверждение не называется подпиской", () => {
  assert.equal(goingText("Настолки").includes("подписк"), false);
});
