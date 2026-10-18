/** Shared tray presentation for foreground pages and the background worker. */
export function pushNotificationDisplay(message: { data?: Record<string, string>; messageId?: string }) {
  return {
    title: 'ACTIV',
    options: {
      body: 'You have an update from ACTIV. Open to view it.',
      icon: '/notification-icon.png',
      tag: message.data?.notificationId || message.data?.publicNotificationId || message.messageId,
      data: { activPush: true, payload: message.data },
    } satisfies NotificationOptions,
  };
}
