export interface EventLifecycle {
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  archivedAt?: string | Date | null;
  days?: { date?: string | Date | null }[];
}
const DAY_MS = 86400000;
const IST_MS = 19800000;
const instant = (value?: string | Date | null): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};
/** An explicit end wins; otherwise use the end of the final scheduled IST day. */
export const eventEndsAt = (event: EventLifecycle): number | null => {
  const end = instant(event.endAt);
  if (end !== null) return end;
  const dates = [instant(event.startAt), ...(event.days || []).map(day => instant(day.date))]
    .filter((value): value is number => value !== null);
  if (!dates.length) return null;
  const last = Math.max(...dates);
  return Math.floor((last + IST_MS) / DAY_MS) * DAY_MS + DAY_MS - IST_MS;
};
export const isPastEvent = (event: EventLifecycle, now: number | Date = Date.now()): boolean => {
  const end = eventEndsAt(event);
  return end !== null && end <= Number(now);
};
export const isUpcomingEvent = (event: EventLifecycle, now: number | Date = Date.now()): boolean =>
  !event.archivedAt && !isPastEvent(event, now);
export const eventPhase = (event: EventLifecycle, now: number | Date = Date.now()): 'upcoming' | 'live' | 'past' => {
  if (isPastEvent(event, now)) return 'past';
  const start = instant(event.startAt);
  return start !== null && start <= Number(now) ? 'live' : 'upcoming';
};
