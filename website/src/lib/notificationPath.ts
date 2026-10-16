export function notificationPath(row: any): string {
  const data = row?.data || {};
  if (data.audience === 'visitor') return '/notifications?notice=' + encodeURIComponent(String(data.publicNotificationId || ''));
  if (data.kind === 'test') return '/super-admin/notifications';
  const id = (value: unknown) => encodeURIComponent(String(value || ''));
  if (data.conversationId) return `/member/messages?c=${id(data.conversationId)}`;
  if (data.announcementId || data.kind === 'announcement') return `/member/updates/${id(data.announcementId || data.sourceId)}`;
  if (data.eventId && data.bookingRef) return `/member/events/${id(data.eventId)}/book?ref=${id(data.bookingRef)}`;
  if (data.eventId || data.kind === 'event') return `/member/events/${id(data.slug || data.eventId || data.sourceId)}`;
  if (data.kind === 'news') return data.slug ? `/news/${id(data.slug)}` : '/news';
  if (data.kind === 'gallery') return data.slug ? `/gallery/${id(data.slug)}` : '/gallery';
  if (data.kind === 'scheme') return data.slug ? `/schemes/view/${id(data.slug)}` : '/schemes';
  if (String(data.event || '').startsWith('DONATION_')) return '/member/donation-certificate';
  if (data.orderId && ['PAYMENT_FAILED', 'PAYMENT_REQUIRED', 'COMPANY_PAYMENT_CONFIRMED'].includes(data.event)) return `/payment-success?orderId=${id(data.orderId)}`;
  if (data.orderId || String(data.event || '').startsWith('MEMBERSHIP_') || data.event === 'PAYMENT_REQUIRED') return '/member/plan';
  return '/member/application-status';
}
