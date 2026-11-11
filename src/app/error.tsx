"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login">
      <h1>Не удалось открыть страницу</h1>
      <p className="hint">Лента и карточки на месте, страница не собралась.</p>
      <button className="primary" onClick={() => reset()}>
        Попробовать ещё раз
      </button>
    </main>
  );
}
