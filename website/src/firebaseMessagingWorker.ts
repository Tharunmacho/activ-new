/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebasePushConfig } from './lib/firebasePushConfig';
import { readPushIdentity, ownsPush } from './lib/pushIdentity';
import { notificationPath } from './lib/notificationPath';
import { pushNotificationDisplay } from './lib/pushNotificationDisplay';

declare const self: ServiceWorkerGlobalScope;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Install our click handler before initializing Firebase messaging.
self.addEventListener('notificationclick', event => {
  if (!event.notification.data?.activPush) return;
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data.payload || {};
    if (!ownsPush(await readPushIdentity(), data)) return;
    // Construct the path from known fields; never navigate to a payload-supplied URL.
    const target = new URL(notificationPath({ data }), self.location.origin);
    if (/^[a-f\d]{24}$/i.test(String(data.notificationId || ''))) { target.searchParams.set('notificationId', data.notificationId); target.searchParams.set('notificationSource', 'push'); }
    if (data.audience === 'visitor') target.searchParams.set('notificationSource', 'push');
    const url = target.href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin) as WindowClient | undefined;
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })().catch(() => undefined));
});
onBackgroundMessage(getMessaging(initializeApp(firebasePushConfig)), async message => {
  try {
    if (!ownsPush(await readPushIdentity(), message.data)) return;
    const notice = pushNotificationDisplay(message);
    await self.registration.showNotification(notice.title, notice.options);
  } catch { /* Storage unavailable: fail closed rather than display another account's alert. */ }
});
