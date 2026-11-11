import { readFile } from "node:fs/promises";
import path from "node:path";

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const type = TYPES[ext];
  if (!type || !/^[a-zA-Z0-9._-]+$/.test(name)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(process.cwd(), "data", "photos", name));
    return new Response(bytes, { headers: { "Content-Type": type } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
