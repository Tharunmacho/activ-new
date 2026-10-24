import { bookingParticipants, bookingState, bookingClosed, validateRegistrationAnswers } from '../src/screens/member/events/bookingForm';
import { formatWhen } from '../src/screens/member/events/eventFormat';

test('confirmation and payment continuation distinguish paid, pending, partial, expired, failed and waitlisted bookings', () => {
  const now = Date.parse('2026-10-12T10:00:00Z');
  const pending = { status: 'active', payment: { status: 'pending', amountPaid: 100 }, totalAmount: 1000, expiresAt: '2026-10-12T10:05:00Z' };
  expect(bookingState(pending, now)).toMatchObject({ settled: false, payable: true, paymentLabel: 'Pending' });
  expect(bookingState(pending, now + 300000)).toMatchObject({ settled: false, payable: false, expired: true });
  expect(bookingState({ ...pending, payment: { status: 'failed' } }, now)).toMatchObject({ settled: false, payable: false, headline: 'Payment failed' });
  expect(bookingState({ ...pending, payment: { status: 'paid' }, status: 'cancelled' }, now).settled).toBe(false);
  expect(bookingState({ ...pending, payment: { status: 'not_required' }, status: 'waitlist' }, now).settled).toBe(false);
  expect(bookingState({ ...pending, payment: { status: 'paid' }, status: 'expired' }, now).settled).toBe(true);
  expect(bookingState({ ...pending, payment: { status: 'not_required' } }, now).settled).toBe(true);
});

test('event questions require declared values and reject invalid dates, numbers and options', () => {
  const fields = [{ key: 'day', label: 'Day', type: 'date', required: true }, { key: 'meal', label: 'Meal', type: 'select', options: ['Vegetarian'] }, { key: 'yes', label: 'Consent', type: 'checkbox', required: true }, { key: 'number', label: 'Number', type: 'number' }];
  expect(validateRegistrationAnswers(fields, { day: '2026-02-30', meal: 'unknown', yes: false, number: 'NaN' })['responses.day']).toBeTruthy();
  expect(Object.keys(validateRegistrationAnswers(fields, { day: '2026-02-30', meal: 'unknown', yes: false, number: 'NaN' }))).toHaveLength(4);
  expect(validateRegistrationAnswers(fields, { day: '2026-10-23', meal: 'Vegetarian', yes: true, number: '0' })).toEqual({});
});

test('unnamed participant one uses the booker consistently in review and request', () => {
  const me = { name: 'Booker', email: 'BOOKER@example.test', phone: '+91 9000000001' };
  expect(bookingParticipants(me, [{ name: '', email: '', phone: '' }, { name: 'Guest', email: 'guest@example.test', phone: '9000000002' }], 2)).toEqual([
    { name: 'Booker', email: 'booker@example.test', phone: '9000000001' }, { name: 'Guest', email: 'guest@example.test', phone: '9000000002' },
  ]);
});

test('open cached booking screens close exactly at deadline and display Indian time', () => {
  const event = { registrationClosesAt: '2026-10-12T09:00:00Z', startAt: '2026-10-13T08:00:00Z' };
  expect(bookingClosed(event, Date.parse('2026-10-12T09:00:00Z'))).toBe(true);
  expect(bookingClosed(event, Date.parse('2026-10-12T08:59:59Z'))).toBe(false);
  expect(formatWhen({ startAt: '2026-10-12T08:30:00Z', endAt: '2026-10-12T11:30:00Z' })).toBe('12 October 2026, 2:00 PM – 5:00 PM IST');
});
