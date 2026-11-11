import { redirect } from "next/navigation";
import { Board } from "@/ui/board";
import { requireUser } from "@/ui/session";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== "organizer") redirect("/going");
  return <Board mode="mine" user={user} query={await searchParams} />;
}
