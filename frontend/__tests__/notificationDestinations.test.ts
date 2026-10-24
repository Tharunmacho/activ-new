import { notificationDestination } from '../src/services/pushNotifications';

test.each([
  [{ kind: 'news', slug: 'member-story' }, '/news/member-story', 'ACTIV news'],
  [{ kind: 'news' }, '/news', 'ACTIV news'],
  [{ kind: 'gallery', sourceId: 'album' }, '/gallery', 'Gallery'],
  [{ kind: 'scheme', sourceId: 'scheme' }, '/schemes', 'Government schemes'],
])('published content opens its native content screen: %j', (payload, path, title) => {
  expect(notificationDestination(payload as Record<string, string>)).toEqual({
    route: 'PublicContent', params: { path, title },
  });
});

test('content routing preserves booking, chat, announcement and payment destinations', () => {
  expect(notificationDestination({ eventId: 'event', bookingRef: 'REF' })).toEqual({
    route: 'EventBooking', params: { eventId: 'event', id: 'event', ref: 'REF' },
  });
  expect(notificationDestination({ eventId: 'event' }).route).toBe('MemberEventDetail');
  expect(notificationDestination({ kind: 'message', conversationId: 'thread' })).toEqual({
    route: 'MessageThread', params: { conversationId: 'thread' },
  });
  expect(notificationDestination({ kind: 'announcement', sourceId: 'notice' })).toEqual({
    route: 'UpdateDetail', params: { id: 'notice' },
  });
  expect(notificationDestination({ orderId: 'order' })).toEqual({ route: 'PaymentSuccess', params: { orderId: 'order' } });
  for (const payload of [undefined, null, {}, { kind: 'unknown' }]) {
    expect(notificationDestination(payload)).toEqual({ route: 'MemberNotifications' });
  }
});

test('lifecycle notices open current payment status, bookings and member records', () => {
  expect(notificationDestination({ event: 'PAYMENT_FAILED', orderId: 'failed-order' })).toEqual({
    route: 'PaymentResult', params: { orderId: 'failed-order' },
  });
  expect(notificationDestination({ event: 'PAYMENT_REQUIRED', orderId: 'pending-order' })).toEqual({
    route: 'PaymentResult', params: { orderId: 'pending-order' },
  });
  expect(notificationDestination({ event: 'COMPANY_PAYMENT_CONFIRMED', orderId: 'company-order' }).route).toBe('PaymentResult');
  expect(notificationDestination({ event: 'EVENT_BOOKING_REMINDER', bookingRef: 'ACTIV-BOOKING' })).toEqual({
    route: 'EventBooking', params: { eventId: '', ref: 'ACTIV-BOOKING' },
  });
  expect(notificationDestination({ event: 'DONATION_RECEIPT', orderId: 'donation-order' }).route).toBe('MemberDonations');
  expect(notificationDestination({ event: 'MEMBERSHIP_RENEWAL_DUE' }).route).toBe('MembershipPlanDetails');
  expect(notificationDestination({ event: 'MEMBERSHIP_PLAN_ADVANCED' }).route).toBe('MembershipPlanDetails');
  expect(notificationDestination({ event: 'APPLICATION_APPROVED' }).route).toBe('ApplicationStatus');
  expect(notificationDestination({ event: 'CORRECTION_REQUESTED' }).route).toBe('ApplicationStatus');
});
