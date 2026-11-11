import { keepRole, keepSubscriptions, savePerson } from "@/app/actions";
import { getDb } from "@/db/open";
import { listOrganizerNames, listTopics, listVenues } from "@/db/store";
import { requireUser } from "@/ui/session";
import { Portrait } from "@/ui/fox";
import { Shell } from "@/ui/shell";

export default async function Page() {
  const user = await requireUser();
  const db = getDb();
  const topics = listTopics(db);
  const venues = listVenues(db);
  const organizers = listOrganizerNames(db);
  return (
    <>
      <Shell role={user.role} current="/profile" />
      <main className="wrap page">
        <h1 className="lead">Профиль</h1>
        <Portrait src={user.photoPath} />
        <form className="stack" action={savePerson} encType="multipart/form-data">
          <label>
            Имя
            <input name="firstName" defaultValue={user.firstName} />
          </label>
          <label>
            Фамилия
            <input name="lastName" defaultValue={user.lastName} />
          </label>
          <label>
            Фотография
            <input name="photo" type="file" accept="image/*" />
          </label>
          <label>
            Интересы
            <textarea name="interests" defaultValue={user.interests} />
          </label>
          <label>
            О себе
            <input name="about" defaultValue={user.about} />
          </label>
          <button className="primary">Сохранить</button>
        </form>
        <section>
          <h2>Подписки</h2>
          <form className="stack" action={keepSubscriptions}>
            <HashGroup title="Организаторы" name="organizer" items={organizers} />
            <HashGroup title="Тематики" name="topic" items={topics.map((topic) => topic.name)} />
            <HashGroup title="Площадки" name="venue" items={venues.map((venue) => venue.name)} />
            <button>Сохранить подписки</button>
          </form>
        </section>
        <section>
          <h2>Роль</h2>
          <form className="stack" action={keepRole}>
            <label>
              Роль
              <select name="role" defaultValue={user.role}>
                <option value="participant">Участник</option>
                <option value="organizer">Организатор</option>
              </select>
            </label>
            <button>Сменить</button>
          </form>
        </section>
      </main>
    </>
  );
}

function HashGroup({ title, name, items }: { title: string; name: string; items: string[] }) {
  return (
    <div>
      <p className="quiet">{title}</p>
      <div className="checks">
        {items.map((item) => (
          <label key={item}>
            <input type="checkbox" name={name} value={item} />
            {`#${item}`}
          </label>
        ))}
      </div>
    </div>
  );
}
