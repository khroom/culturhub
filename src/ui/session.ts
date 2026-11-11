import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/auth/session";
import { getDb } from "@/db/open";
import { findUserById, type UserRow } from "@/db/store";

export async function requireUser(): Promise<UserRow> {
  const jar = await cookies();
  const id = readSession(jar.get("cc_session")?.value);
  const user = id ? findUserById(getDb(), id) : null;
  if (!user) redirect("/");
  return user;
}
