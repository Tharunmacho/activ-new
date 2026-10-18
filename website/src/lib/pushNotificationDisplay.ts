/** Shared tray presentation for foreground pages and the background worker. */
export function pushNotificationDisplay(message: { data?: Record<string, string>; notification?: { title?: string; body?: string }; messageId?: string }) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  return {
    title: text(message.data?.title) || text(message.notification?.title) || 'ACTIV',
    options: {
      body: text(message.data?.body) || text(message.notification?.body) || 'Open this notification to view the update.',
      icon: '/notification-icon.png',
      tag: message.data?.notificationId || message.data?.publicNotificationId || message.messageId,
      data: { activPush: true, payload: message.data },
    } satisfies NotificationOptions,
  };
}
