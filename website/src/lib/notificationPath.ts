export function notificationPath(row: any): string {
  const data = row?.data || {};
  if (data.kind === 'test') return '/super-admin/notifications';
  const id = (value: unknown) => encodeURIComponent(String(value || ''));
  if (data.conversationId) return `/member/messages?c=${id(data.conversationId)}`;
  if (data.announcementId || data.kind === 'announcement') return `/member/updates/${id(data.announcementId || data.sourceId)}`;
  if (data.eventId || data.kind === 'event') return `/member/events/${id(data.slug || data.eventId || data.sourceId)}`;
  if (data.kind === 'news') return data.slug ? `/news/${id(data.slug)}` : '/news';
  if (data.kind === 'gallery') return data.slug ? `/gallery/${id(data.slug)}` : '/gallery';
  if (data.kind === 'scheme') return data.slug ? `/schemes/view/${id(data.slug)}` : '/schemes';
  if (data.orderId) return '/member/plan';
  return '/member/application-status';
}
