/// <reference lib="webworker" />
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebasePushConfig } from './lib/firebasePushConfig';
import { readPushIdentity, ownsPush } from './lib/pushIdentity';
import { notificationPath } from './lib/notificationPath';

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
    const url = new URL(notificationPath({ data }), self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin) as WindowClient | undefined;
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })().catch(() => undefined));
});
onBackgroundMessage(getMessaging(initializeApp(firebasePushConfig)), async message => {
  try {
    if (!ownsPush(await readPushIdentity(), message.data)) return;
    await self.registration.showNotification('ACTIV', {
      body: 'You have an update from ACTIV. Open to view it.',
      tag: message.data?.notificationId || message.messageId,
      data: { activPush: true, payload: message.data },
    });
  } catch { /* Storage unavailable: fail closed rather than display another account's alert. */ }
});
