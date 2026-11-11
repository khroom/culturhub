import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "./sql.ts";
import { seedIfEmpty } from "./seed.ts";

export type Db = DatabaseSync;

export function openDatabase(file = ":memory:"): Db {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

let singleton: Db | null = null;

export function getDb(): Db {
  if (singleton) return singleton;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  singleton = openDatabase(path.join(dir, "cluster.sqlite"));
  seedIfEmpty(singleton, new Date());
  return singleton;
}
