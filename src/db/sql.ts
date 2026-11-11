export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  photo_path TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS organizers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_path TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS venues (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES organizers(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  venue_id INTEGER REFERENCES venues(id),
  character TEXT,
  level TEXT,
  regularity TEXT,
  stage TEXT NOT NULL,
  official INTEGER NOT NULL DEFAULT 0,
  format TEXT,
  chat_url TEXT
);

CREATE TABLE IF NOT EXISTS event_topics (
  event_id INTEGER NOT NULL REFERENCES events(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  PRIMARY KEY (event_id, topic_id)
);

CREATE TABLE IF NOT EXISTS attendances (
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  going INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
