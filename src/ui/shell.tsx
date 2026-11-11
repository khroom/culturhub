import { signOut } from "@/app/actions";
import { Fox } from "./fox";

export function Shell({
  role,
  current,
}: {
  role: "participant" | "organizer";
  current: string;
}) {
  const home = role === "organizer" ? "/mine" : "/going";
  const links =
    role === "organizer"
      ? [
          ["Мои мероприятия", "/mine"],
          ["Профиль", "/profile"],
        ]
      : [
          ["Куда я иду", "/going"],
          ["Куда можно пойти", "/catalog"],
          ["Профиль", "/profile"],
        ];
  return (
    <header className="wrap top">
      <a className="brand" href={home}>
        <Fox />
        <strong>Культурный кластер</strong>
      </a>
      <nav className="nav">
        {links.map(([label, href]) => (
          <a key={href} href={href} aria-current={current === href ? "page" : undefined}>
            {label}
          </a>
        ))}
        <button type="button" className="stub">
          Карта
        </button>
        <form action={signOut}>
          <button className="text-button">Выйти</button>
        </form>
      </nav>
    </header>
  );
}
