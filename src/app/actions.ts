"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { signSession, readSession } from "@/auth/session";
import { getDb } from "@/db/open";
import { findUserById } from "@/db/store";
import { createEvent, editEvent, login, moveStage, pressAttendance, saveProfile } from "@/scenarios";

async function viewer() {
  const jar = await cookies();
  const id = readSession(jar.get("cc_session")?.value);
  if (!id) return null;
  return findUserById(getDb(), id);
}

export async function signIn(formData: FormData) {
  const user = login(getDb(), String(formData.get("login") ?? ""), String(formData.get("password") ?? ""));
  if (!user) redirect("/?error=1");
  const jar = await cookies();
  jar.set("cc_session", signSession(user.id), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(user.role === "organizer" ? "/mine" : "/going");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete("cc_session");
  redirect("/");
}

export async function keepRole() {
  redirect("/profile");
}

export async function keepSubscriptions() {
  redirect("/profile");
}

export async function markGoing(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/");
  const back = samePage(formData.get("back"), "/going");
  pressAttendance(getDb(), user.id, Number(formData.get("eventId")), formData.get("going") === "1", new Date());
  redirect(back);
}

export async function changeStage(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/");
  moveStage(getDb(), user.id, Number(formData.get("eventId")), String(formData.get("stage") ?? ""), new Date());
  redirect("/mine");
}

function samePage(value: FormDataEntryValue | null, fallback: string): string {
  const raw = String(value ?? "");
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) return raw;
  return fallback;
}

export async function saveEvent(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/");
  const db = getDb();
  const topics = formData.getAll("topic").map(Number).filter((topic) => topic > 0);
  const venueRaw = String(formData.get("venueId") ?? "");
  const input = {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    startsLocal: String(formData.get("starts") ?? ""),
    endsLocal: String(formData.get("ends") ?? ""),
    venueId: venueRaw ? Number(venueRaw) : null,
    topicIds: topics,
    character: String(formData.get("character") ?? ""),
    level: String(formData.get("level") ?? ""),
    regularity: String(formData.get("regularity") ?? ""),
    stage: String(formData.get("stage") ?? ""),
    format: String(formData.get("format") ?? ""),
    chatUrl: String(formData.get("chatUrl") ?? ""),
  };
  const id = Number(formData.get("eventId") || 0);
  if (!id) {
    const result = createEvent(db, user.id, input);
    if (!result.ok) redirect(`/mine?new=1&error=${encodeURIComponent(result.missing.join(", "))}`);
    redirect("/mine");
  }
  const saved = editEvent(db, user.id, id, input, new Date());
  if (!saved.ok && saved.missing.length) {
    redirect(`/mine?card=${id}&error=${encodeURIComponent(saved.missing.join(", "))}`);
  }
  redirect(`/mine?card=${id}`);
}

export async function savePerson(formData: FormData) {
  const user = await viewer();
  if (!user) redirect("/");
  let photoPath: string | undefined;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0 && file.type.startsWith("image/")) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
    const name = `user-${user.id}.${ext}`;
    const dir = path.join(process.cwd(), "data", "photos");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    photoPath = name;
  }
  saveProfile(getDb(), user.id, {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    interests: String(formData.get("interests") ?? ""),
    about: String(formData.get("about") ?? ""),
    photoPath,
  });
  redirect("/profile");
}
