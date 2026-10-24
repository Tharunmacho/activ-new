/** Day-editor sessions and legacy agendas use the same programme in every app view. */
export function withEventAgenda<T extends Record<string, any>>(event: T): T {
  if (!event) return event;
  const rows = (value: any): any[] => Array.isArray(value) ? value : [];
  const valid = (value: any) => rows(value).filter(row => row && (row.title || row.startTime));
  const days = rows(event.days);
  if (valid(event.agenda).length || !days.length) return event;
  const multi = days.filter(day => day?.date).length > 1;
  const agenda = days.flatMap((day, index) => valid(day?.agenda).map(row => ({
    ...row, title: multi ? `Day ${index + 1} — ${row.title || 'Session'}` : row.title,
  })));
  return agenda.length ? { ...event, agenda } : event;
}
