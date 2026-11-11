import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/ui/session";

export default async function Layout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (user.role !== "participant") redirect("/mine");
  return children;
}
