import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { readSession } from "@/auth/session";
import { getDb } from "@/db/open";
import { findUserById } from "@/db/store";
import { Fox } from "@/ui/fox";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const id = readSession(jar.get("cc_session")?.value);
  const user = id ? findUserById(getDb(), id) : null;
  if (user) redirect(user.role === "organizer" ? "/mine" : "/going");
  const query = await searchParams;
  const failed = (Array.isArray(query.error) ? query.error[0] : query.error) === "1";
  return (
    <main className="login">
      <Fox big />
      <h1>Культурный кластер</h1>
      <p className="hint">Встречи Финансового университета: куда идти и что уже решено.</p>
      <form className="stack" action={signIn}>
        <label>
          Логин
          <input name="login" autoComplete="username" />
        </label>
        <label>
          Пароль
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        {failed ? <p className="error">Не узнали логин или пароль.</p> : null}
        <button className="primary">Войти</button>
      </form>
      <p className="hint">Общий пароль демо: demo. Логины maria, ilya, kira, arina.</p>
      <button type="button" className="text-button">
        Регистрация
      </button>
    </main>
  );
}
