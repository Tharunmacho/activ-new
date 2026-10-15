export type EventFilters = { q: string; category: string; language: string; area: string; mode: string; from: string; to: string };
export const EMPTY_EVENT_FILTERS: EventFilters = { q: '', category: '', language: '', area: '', mode: '', from: '', to: '' };
const norm = (value: unknown) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
export const eventLanguages = (event: any): string[] => String(event?.language || '').split(/[,/;&+]|\band\b/i).map(s => s.trim()).filter(Boolean);
const regions = (event: any) => Array.isArray(event?.targets) && event.targets.length ? event.targets : [event || {}];
export const eventAreas = (event: any): string[] => [...regions(event).flatMap((r: any) => [r.state, r.district, r.block]), event?.venue, event?.location, event?.venueAddress].filter(Boolean);
export function eventFilterOptions(events: any[], field: 'category' | 'language' | 'area') {
  const values = events.flatMap(e => field === 'language' ? eventLanguages(e) : field === 'area' ? eventAreas(e) : [e?.category]);
  return [...new Map(values.filter(Boolean).map(v => [norm(v), String(v).trim()])).values()].sort((a, b) => a.localeCompare(b));
}
export function eventDateError(from: string, to: string) {
  const valid = (v: string) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
  if (!valid(from) || !valid(to)) return 'Enter dates as YYYY-MM-DD.';
  return from && to && from > to ? 'The end date must be on or after the start date.' : '';
}
export function eventInPeriod(event: any, from = '', to = '') {
  if (!from && !to) return true;
  if (eventDateError(from, to)) return false;
  const start = event?.startAt ? Date.parse(event.startAt) : NaN;
  if (!Number.isFinite(start)) return false;
  const day = (time: number) => new Date(time + 330 * 60000).toISOString().slice(0, 10);
  const end = event?.endAt ? Date.parse(event.endAt) : start;
  // Inclusive date windows overlap a multi-day programme, using ACTIV's IST dates.
  return (!to || day(start) <= to) && (!from || day(Number.isFinite(end) ? Math.max(start, end) : start) >= from);
}
export function matchesEventFilters(event: any, f: EventFilters) {
  if (f.category && norm(event?.category) !== norm(f.category)) return false;
  if (f.language && !eventLanguages(event).some(l => norm(l) === norm(f.language))) return false;
  if (f.mode && (event?.mode || 'offline') !== f.mode) return false;
  if (f.area && !eventAreas(event).some(a => norm(a).includes(norm(f.area)))) return false;
  if (!eventInPeriod(event, f.from, f.to)) return false;
  return !f.q || norm([event?.title, event?.summary, event?.description, event?.category, event?.language,
    event?.topic, event?.onlinePlatform, ...eventAreas(event)].join(' ')).includes(norm(f.q));
}
