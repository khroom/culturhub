const MOSCOW = "Europe/Moscow";

export function moscowDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function moscowClock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatMoscow(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW,
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function atMoscowHour(now: Date, hour: number, minute = 0): string {
  const day = moscowDay(now);
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${day}T${hh}:${mm}:00+03:00`).toISOString();
}

export function shiftDays(now: Date, days: number, hour: number): string {
  const shifted = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return atMoscowHour(shifted, hour);
}

export function overlapsToday(startsAt: string, endsAt: string | null, now: Date): boolean {
  const day = moscowDay(now);
  const start = new Date(`${day}T00:00:00+03:00`).toISOString();
  const end = new Date(`${day}T23:59:59.999+03:00`).toISOString();
  const eventEnd = endsAt ?? startsAt;
  return startsAt <= end && eventEnd >= start;
}

export function isoToMoscowLocal(iso: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return `${day}T${moscowClock(iso)}`;
}

export function moscowLocalToIso(local: string): string {
  if (!local.trim()) return "";
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  return new Date(`${withSeconds}+03:00`).toISOString();
}
