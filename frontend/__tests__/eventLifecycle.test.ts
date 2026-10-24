import { eventEndsAt, eventPhase, isPastEvent, isUpcomingEvent } from '../src/utils/eventLifecycle';

test('an ongoing event remains upcoming until its exact finishing instant', () => {
  const event = { startAt: '2026-10-10T09:00:00+05:30', endAt: '2026-10-10T17:00:00+05:30' };
  const end = Date.parse(event.endAt);
  expect(eventPhase(event, end - 1)).toBe('live');
  expect(isUpcomingEvent(event, end - 1)).toBe(true);
  expect(isPastEvent(event, end)).toBe(true);
  expect(isUpcomingEvent(event, end)).toBe(false);
});
test('missing finishing time expires at midnight in India, independently of the device timezone', () => {
  const event = { startAt: '2026-10-10T09:00:00+05:30' };
  expect(eventEndsAt(event)).toBe(Date.parse('2026-10-11T00:00:00+05:30'));
  expect(isPastEvent(event, Date.parse('2026-10-10T18:29:59Z'))).toBe(false);
  expect(isPastEvent(event, Date.parse('2026-10-10T18:30:00Z'))).toBe(true);
});
test('multi-day, undated and archived records have consistent visibility', () => {
  const event = { startAt: '2026-10-10T09:00:00+05:30', days: [{ date: '2026-10-12' }] };
  expect(isPastEvent(event, Date.parse('2026-10-11T20:00:00+05:30'))).toBe(false);
  expect(isPastEvent(event, Date.parse('2026-10-13T00:00:00+05:30'))).toBe(true);
  expect(eventPhase({ startAt: null })).toBe('upcoming');
  expect(eventPhase({ startAt: 'not-a-date' })).toBe('upcoming');
  expect(isUpcomingEvent({ archivedAt: '2026-10-12' })).toBe(false);
});
