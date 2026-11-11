import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.CLUSTER_SECRET ?? "prototype-demo-secret";

export function signSession(userId: number): string {
  const body = String(userId);
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${sig}`;
}

export function readSession(token: string | undefined): number | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const id = Number(body);
  return Number.isInteger(id) && id > 0 ? id : null;
}
