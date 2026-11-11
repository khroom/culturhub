import type { ReactNode } from "react";
import { markGoing, changeStage, saveEvent } from "@/app/actions";
import { STAGE_ORDER, allowedMoves, canAttend, canEdit, canMessage, isTerminal } from "@/domain/stage";
import { formatMoscow, isoToMoscowLocal, overlapsToday } from "@/domain/time";
import { getDb } from "@/db/open";
import {
  getEvent,
  listAttendees,
  listCatalog,
  listGoing,
  listMine,
  listNews,
  listOrganizerNames,
  listPeople,
  listTopics,
  listVenues,
  type AttendeeRow,
  type EventRow,
  type TopicRow,
  type UserRow,
  type VenueRow,
} from "@/db/store";
import { Fox, Portrait } from "./fox";
import { Shell } from "./shell";

type Mode = "going" | "catalog" | "mine";

export async function Board({
  mode,
  user,
  query,
}: {
  mode: Mode;
  user: UserRow;
  query: Record<string, string | string[] | undefined>;
}) {
  const db = getDb();
  const now = new Date();
  const events =
    mode === "going"
      ? listGoing(db, user.id, now)
      : mode === "catalog"
        ? listCatalog(db, user.id, now)
        : listMine(db, user.id, now);
  const people = listPeople(db);
  const organizerNames = listOrganizerNames(db);
  const topics = listTopics(db);
  const venues = listVenues(db);
  const news = mode === "catalog" ? [] : listNews(db, user.id);
  const path = mode === "going" ? "/going" : mode === "catalog" ? "/catalog" : "/mine";
  const cardId = Number(one(query.card));
  const opened = cardId ? getEvent(db, cardId, user.id, now) : null;
  const attendees = opened && mode === "mine" ? listAttendees(db, opened.id) : [];
  const preview = one(query.preview);
  const ref = one(query.ref);
  const creating = one(query.new) === "1";
  const settings = one(query.settings) === "1";
  const error = one(query.error);
  const title = mode === "going" ? "Куда я иду" : mode === "catalog" ? "Куда можно пойти" : "Мои мероприятия";

  return (
    <>
      <Shell role={user.role} current={path} />
      <main className={mode === "catalog" ? "wrap page" : "wrap home"}>
        <section className="column">
          <h1 className="lead">{title}</h1>
          {(mode === "catalog" || mode === "mine") && (
            <div className="filters">
              <button type="button" className="stub">
                Что сейчас идёт
              </button>
              <button type="button" className="stub">
                Что здесь идёт
              </button>
              <a href={`${path}?settings=1`}>Настройки</a>
            </div>
          )}
          {mode === "going" && events.length === 0 ? (
            <div className="empty">
              <Fox big />
              <p>Пока вы никуда не идёте.</p>
              <a href="/catalog">Посмотреть, куда можно пойти</a>
            </div>
          ) : (
            <div className="cards">
              {mode === "mine" && (
                <a className="plus" href="/mine?new=1">
                  +
                </a>
              )}
              {events.length === 0 && <p className="quiet">В каталоге пока пусто.</p>}
              {events.map((event) => (
                <EventPreview key={event.id} event={event} mode={mode} path={path} now={now} />
              ))}
            </div>
          )}
        </section>
        {mode !== "catalog" && (
          <aside>
            <NewsFold path={path} news={news} people={people} wide />
            <NewsFold path={path} news={news} people={people} wide={false} />
          </aside>
        )}
      </main>
      {preview ? (
        <Overlay>
          <PreviewSheet kind={preview} refId={ref} topics={topics} venues={venues} people={people} back={opened ? `${path}?card=${opened.id}` : path} />
        </Overlay>
      ) : null}
      {!preview && creating ? (
        <Overlay>
          <div className="sheet">
            <div className="sheet-head">
              <a className="close" href={path}>
                Закрыть
              </a>
              <p className="kicker">хотим провести</p>
              <h2>Новое мероприятие</h2>
              {error ? <p className="error">{`Не хватает: ${error}`}</p> : null}
            </div>
            <EventForm topics={topics} venues={venues} organizerName={`${user.firstName} ${user.lastName}`} error={error} />
          </div>
        </Overlay>
      ) : null}
      {!preview && !creating && opened ? (
        <Overlay>
          {mode === "mine" ? (
            <OrganizerCard event={opened} topics={topics} venues={venues} attendees={attendees} path={path} now={now} error={error} />
          ) : (
            <ParticipantCard event={opened} path={path} now={now} />
          )}
        </Overlay>
      ) : null}
      {!preview && !creating && !opened && settings ? (
        <Overlay>
          <Settings path={path} topics={topics} venues={venues} organizerNames={organizerNames} />
        </Overlay>
      ) : null}
    </>
  );
}

function EventPreview({ event, mode, path, now }: { event: EventRow; mode: Mode; path: string; now: Date }) {
  const today = overlapsToday(event.startsAt, event.endsAt, now);
  return (
    <article className={today ? "preview today" : "preview"}>
      <p className="kicker">
        {today ? `${event.stage} · идёт сегодня` : event.stage}
      </p>
      <h2>
        <a href={`${path}?card=${event.id}`}>{event.title}</a>
      </h2>
      <p className="meta">{interval(event)}</p>
      {event.venue ? (
        <p className="meta">
          <a href={`${path}?preview=venue&ref=${event.venue.id}`}>{event.venue.name}</a>
        </p>
      ) : null}
      <p className="meta">
        <a href={`${path}?preview=organizer&ref=${event.organizerUserId}`}>{event.organizerName}</a>
      </p>
      {mode !== "going" ? <Topics event={event} path={path} /> : null}
      {mode === "mine" ? (
        <div className="row-actions">
          {allowedMoves(event.stage).map((stage) => (
            <form key={stage} action={changeStage}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="stage" value={stage} />
              <button className="chip">{stage}</button>
            </form>
          ))}
          <span className="count">{`${event.goingCount} идут`}</span>
        </div>
      ) : (
        <Attendance event={event} back={path} wide={false} />
      )}
    </article>
  );
}

function ParticipantCard({ event, path, now }: { event: EventRow; path: string; now: Date }) {
  const today = overlapsToday(event.startsAt, event.endsAt, now);
  const chat = safeHttp(event.chatUrl);
  return (
    <div className="sheet">
      <div className="sheet-head">
        <a className="close" href={path}>
          Закрыть
        </a>
        <p className="kicker">{today ? `${event.stage} · идёт сегодня` : event.stage}</p>
        <h2>{event.title}</h2>
        <Attendance event={event} back={`${path}?card=${event.id}`} wide />
      </div>
      <p>{event.description}</p>
      <div className="facts">
        <span>
          {interval(event)}
          {event.venue ? (
            <>
              {" · "}
              <a href={`${path}?card=${event.id}&preview=venue&ref=${event.venue.id}`}>{event.venue.name}</a>
            </>
          ) : null}
        </span>
        <a href={`${path}?card=${event.id}&preview=organizer&ref=${event.organizerUserId}`}>{event.organizerName}</a>
        {event.format ? <span>{event.format}</span> : null}
        {event.character ? <span>{event.character}</span> : null}
        {event.level ? <span>{event.level}</span> : null}
        {event.regularity ? <span>{event.regularity}</span> : null}
        {event.official ? <span>официальное</span> : null}
      </div>
      <Topics event={event} path={`${path}?card=${event.id}`} />
      {chat ? (
        <p>
          <a href={chat} target="_blank" rel="noreferrer">
            {chat}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function OrganizerCard({
  event,
  topics,
  venues,
  attendees,
  path,
  now,
  error,
}: {
  event: EventRow;
  topics: TopicRow[];
  venues: VenueRow[];
  attendees: AttendeeRow[];
  path: string;
  now: Date;
  error: string;
}) {
  const today = overlapsToday(event.startsAt, event.endsAt, now);
  return (
    <div className="sheet">
      <div className="sheet-head">
        <a className="close" href={path}>
          Закрыть
        </a>
        <p className="kicker">{today ? `${event.stage} · идёт сегодня` : event.stage}</p>
        <h2>{event.title}</h2>
        {canMessage(event.stage) ? (
          <button type="button" className="ghost">
            Сообщение участникам
          </button>
        ) : null}
        {isTerminal(event.stage) ? (
          <button type="button" className="ghost">
            Создать похожее
          </button>
        ) : null}
      </div>
      <EventForm event={event} topics={topics} venues={venues} organizerName={event.organizerName} error={error} />
      <p className="quiet">{`${event.goingCount} идут`}</p>
      <ul className="people">
        {attendees.map((person) => (
          <li key={`${person.firstName}-${person.lastName}`} className="person">
            <Portrait src={person.photoPath} />
            <div>
              <strong>
                {person.firstName} {person.lastName}
              </strong>
              <p className="quiet">{person.interests}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventForm({
  event,
  topics,
  venues,
  organizerName,
  error,
}: {
  event?: EventRow;
  topics: TopicRow[];
  venues: VenueRow[];
  organizerName: string;
  error: string;
}) {
  const locked = event ? !canEdit(event.stage) : false;
  return (
    <form className="stack" action={saveEvent}>
      {event ? <input type="hidden" name="eventId" value={event.id} /> : null}
      <label>
        Название
        <input name="title" defaultValue={event?.title ?? ""} disabled={locked} />
      </label>
      <label>
        Описание
        <textarea name="description" defaultValue={event?.description ?? ""} disabled={locked} />
      </label>
      <label>
        Начало
        <input type="datetime-local" name="starts" defaultValue={event ? isoToMoscowLocal(event.startsAt) : ""} disabled={locked} />
      </label>
      <label>
        Конец
        <input type="datetime-local" name="ends" defaultValue={event?.endsAt ? isoToMoscowLocal(event.endsAt) : ""} disabled={locked} />
      </label>
      <label>
        Площадка
        <select name="venueId" defaultValue={event?.venue ? String(event.venue.id) : ""} disabled={locked}>
          <option value="">Без площадки</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="quiet">Тематики</p>
        <div className="checks">
          {topics.map((topic) => (
            <label key={topic.id}>
              <input
                type="checkbox"
                name="topic"
                value={topic.id}
                defaultChecked={event?.topics.some((item) => item.id === topic.id) ?? false}
                disabled={locked}
              />
              {topic.name}
            </label>
          ))}
        </div>
      </div>
      <label>
        Формат
        <input name="format" defaultValue={event?.format ?? ""} disabled={locked} />
      </label>
      <label>
        Характер
        <input name="character" defaultValue={event?.character ?? ""} disabled={locked} />
      </label>
      <label>
        Уровень
        <input name="level" defaultValue={event?.level ?? ""} disabled={locked} />
      </label>
      <label>
        Регулярность
        <input name="regularity" defaultValue={event?.regularity ?? ""} disabled={locked} />
      </label>
      <label>
        Чат
        <input name="chatUrl" defaultValue={event?.chatUrl ?? ""} disabled={locked} />
      </label>
      {event ? null : (
        <label>
          Этап
          <select name="stage" defaultValue="хотим провести">
            {STAGE_ORDER.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
            <option>отменено</option>
          </select>
        </label>
      )}
      <p>{`Организатор: ${organizerName}`}</p>
      {event?.official ? <p className="quiet">официальное</p> : null}
      {error ? <p className="error">{`Не хватает: ${error}`}</p> : null}
      {locked ? null : <button className="primary">Сохранить</button>}
    </form>
  );
}

function Attendance({ event, back, wide }: { event: EventRow; back: string; wide: boolean }) {
  if (!canAttend(event.stage)) return null;
  return (
    <div className={wide ? "pair" : "row-actions"}>
      <form action={markGoing}>
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="going" value="1" />
        <input type="hidden" name="back" value={back} />
        <button className={event.myGoing === true ? "chosen" : wide ? "" : "chip"}>Иду</button>
      </form>
      <form action={markGoing}>
        <input type="hidden" name="eventId" value={event.id} />
        <input type="hidden" name="going" value="0" />
        <input type="hidden" name="back" value={back} />
        <button className={event.myGoing === false ? "chosen" : wide ? "" : "chip"}>Не иду</button>
      </form>
    </div>
  );
}

function Topics({ event, path }: { event: EventRow; path: string }) {
  return (
    <p className="tags">
      {event.topics.map((topic) => (
        <a key={topic.id} className="tag" style={{ color: topic.color }} href={withQuery(path, `preview=topic&ref=${topic.id}`)}>
          {`#${topic.name}`}
        </a>
      ))}
    </p>
  );
}

function PreviewSheet({
  kind,
  refId,
  topics,
  venues,
  people,
  back,
}: {
  kind: string;
  refId: string;
  topics: TopicRow[];
  venues: VenueRow[];
  people: (AttendeeRow & { id: number })[];
  back: string;
}) {
  const id = Number(refId);
  if (kind === "topic") {
    const topic = topics.find((item) => item.id === id);
    if (!topic) return null;
    return (
      <div className="sheet">
        <a className="close" href={back}>
          Закрыть
        </a>
        <h2 style={{ color: topic.color }}>#{topic.name}</h2>
        <p>{topic.description}</p>
        <button type="button">Все мероприятия</button>
      </div>
    );
  }
  if (kind === "venue") {
    const venue = venues.find((item) => item.id === id);
    if (!venue) return null;
    return (
      <div className="sheet">
        <a className="close" href={back}>
          Закрыть
        </a>
        <h2>{venue.name}</h2>
        <p>{venue.description}</p>
        <div className="row-actions">
          <button type="button">Все мероприятия</button>
          <button type="button">На карте</button>
        </div>
      </div>
    );
  }
  const person = people.find((item) => item.id === id);
  if (!person) return null;
  return (
    <div className="sheet">
      <a className="close" href={back}>
        Закрыть
      </a>
      <div className="person">
        <Portrait src={person.photoPath} />
        <h2>
          {person.firstName} {person.lastName}
        </h2>
      </div>
      <p>{person.about}</p>
      <p className="quiet">{person.interests}</p>
      <button type="button">Все мероприятия</button>
    </div>
  );
}

function Settings({
  path,
  topics,
  venues,
  organizerNames,
}: {
  path: string;
  topics: TopicRow[];
  venues: VenueRow[];
  organizerNames: string[];
}) {
  return (
    <div className="sheet">
      <a className="close" href={path}>
        Закрыть
      </a>
      <h2>Настройки</h2>
      <form className="stack" method="get" action={path}>
        <label>
          Название
          <input name="title" />
        </label>
        <label>
          Площадка
          <select name="venue">
            <option value="">Любая</option>
            {venues.map((venue) => (
              <option key={venue.id}>{venue.name}</option>
            ))}
          </select>
        </label>
        <label>
          Формат
          <input name="format" />
        </label>
        <div>
          <p className="quiet">Тематики</p>
          <div className="checks">
            {topics.map((topic) => (
              <label key={topic.id}>
                <input type="checkbox" name="topic" value={topic.name} />
                {topic.name}
              </label>
            ))}
          </div>
        </div>
        <label>
          Организатор
          <select name="organizer">
            <option value="">Любой</option>
            {organizerNames.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Характер
          <input name="character" />
        </label>
        <label>
          Уровень
          <input name="level" />
        </label>
        <label>
          Регулярность
          <input name="regularity" />
        </label>
        <label className="inline">
          <input type="checkbox" name="official" /> официальность
        </label>
        <button className="primary">Показать</button>
      </form>
    </div>
  );
}

function NewsFold({
  path,
  news,
  people,
  wide,
}: {
  path: string;
  news: { id: number; eventId: number; body: string }[];
  people: AttendeeRow[];
  wide: boolean;
}) {
  return (
    <details className={wide ? "news desk" : "news palm"} {...(wide ? { open: true } : {})}>
      <summary>Новости</summary>
      <div className="news-list">
        {news.map((item) => {
          const photo = photoFor(item.body, people);
          return (
            <a key={item.id} href={`${path}?card=${item.eventId}`}>
              <Portrait src={photo} size={40} />
              <p>{item.body}</p>
            </a>
          );
        })}
      </div>
    </details>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return <div className="overlay">{children}</div>;
}

function interval(event: EventRow): string {
  const start = formatMoscow(event.startsAt);
  if (!event.endsAt) return start;
  return `${start} — ${formatMoscow(event.endsAt)}`;
}

function photoFor(body: string, people: AttendeeRow[]): string {
  const person = people.find((item) => body.startsWith(`${item.firstName} ${item.lastName}`));
  return person?.photoPath ?? "";
}

function safeHttp(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    return null;
  }
  return null;
}

function withQuery(path: string, extra: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${extra}`;
}

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
