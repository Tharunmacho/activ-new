import { API_BASE_URL, STORAGE_KEYS } from '@/config/api.config';
import { firebasePushConfig, pushConfigured, vapidKey } from '@/lib/firebasePushConfig';
import { readPushIdentity, writePushIdentity, ownsPush } from '@/lib/pushIdentity';
import { notificationPath } from '@/lib/notificationPath';
import { visitorIdentity, visitorRegistration, queueVisitorRevocation, drainVisitorRevocation } from './visitorBrowserPush';

const PREFERENCE = 'activ:browser-push-enabled';
export const PUSH_EVENT = 'activ:push-changed';
let generation = 0;
class RegistrationCancelled extends Error {}
let cancelSdkWork: (() => void) | undefined;
let deletingToken: Promise<boolean> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let stopMessages: (() => void) | undefined;
export const pushEnabled = () => {
  try { return localStorage.getItem(PREFERENCE) === 'true'; } catch { return false; }
};
const changed = () => window.dispatchEvent(new Event(PUSH_EVENT));
function session() {
  try {
    const auth = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    const claims = JSON.parse(atob(auth.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { auth, userId: String(claims.userId || ''), expiresAt: Number(claims.exp) * 1000 };
  } catch { return { auth: null, userId: '', expiresAt: 0 }; }
}
function serial<T>(run: () => Promise<T>): Promise<T> {
  const locked = async (): Promise<T> => navigator.locks ? await navigator.locks.request('activ-browser-push', run) : await run();
  const result = queue.then(locked, locked);
  queue = result.catch(() => undefined);
  return result;
}
async function registrationDeadline<T>(work: Promise<T>, stage = 'Notification registration', milliseconds = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  let cancel!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => { cancel = () => reject(new RegistrationCancelled()); });
  cancelSdkWork = cancel;
  try {
    return await Promise.race([work, cancelled, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`${stage} timed out. Check your connection, then try again.`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); if (cancelSdkWork === cancel) cancelSdkWork = undefined; }
}
async function registeredToken(current: () => boolean) {
  const { sdk, messaging } = await registrationDeadline(client(), 'Loading notification support');
  if (!current()) throw new RegistrationCancelled();
  const registration = await registrationDeadline(navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/', updateViaCache: 'none' }), 'Starting browser notifications');
  await registrationDeadline(navigator.serviceWorker.ready, 'Activating browser notifications');
  if (!current()) throw new RegistrationCancelled();
  // A fresh browser may need to establish its push subscription and Firebase
  // installation. Give that network step time without holding sign-out hostage.
  if (deletingToken) await registrationDeadline(deletingToken, 'Finishing notification settings');
  if (!current()) throw new RegistrationCancelled();
  const token = await registrationDeadline(sdk.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }), 'Connecting to Firebase notifications', 30000);
  if (!current()) throw new RegistrationCancelled();
  if (!token) throw new Error('The browser did not return a notification registration. Please try again.');
  return { sdk, messaging, token };
}
function foregroundMessages(sdk: any, messaging: any, current: () => boolean) {
  stopMessages?.();
  stopMessages = sdk.onMessage(messaging, async (message: any) => {
    if (!current() || document.visibilityState !== 'visible') return;
    if (!ownsPush(await readPushIdentity(), message.data)) return;
    const { toast } = await import('sonner');
    if (!current()) return;
    toast('You have an update from ACTIV.', { id: message.data?.notificationId || message.data?.publicNotificationId || message.messageId,
      action: { label: 'Open', onClick: () => {
        if (!current()) return;
        const target = new URL(notificationPath({ data: message.data }), window.location.origin);
        const id = message.data?.notificationId;
        if (/^[a-f\d]{24}$/i.test(String(id || ''))) { target.searchParams.set('notificationId', id!); target.searchParams.set('notificationSource', 'push'); }
        if (message.data?.audience === 'visitor') target.searchParams.set('notificationSource', 'push');
        window.location.assign(target.pathname + target.search);
      } } });
  });
}
async function deviceRequest(method: 'POST' | 'DELETE', token: string, auth: string) {
  const response = await fetch(`${API_BASE_URL}/notifications/push/devices`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    body: JSON.stringify({ token, platform: 'web' }), keepalive: method === 'DELETE',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Could not register this browser. Check your connection and sign in again.');
  return response.json();
}
async function client() {
  const [app, sdk] = await Promise.all([import('firebase/app'), import('firebase/messaging')]);
  if (!await sdk.isSupported()) throw new Error('Push notifications are not supported in this browser. On iPhone, try adding ACTIV to your Home Screen.');
  const firebase = app.getApps().find(item => item.name === 'activ-web-push') || app.initializeApp(firebasePushConfig, 'activ-web-push');
  return { sdk, messaging: sdk.getMessaging(firebase) };
}
/** True only after the device API succeeded for the current account/visitor. */
export async function browserPushRegistered(accountOnly = false): Promise<boolean> {
  if (!pushConfigured() || !pushEnabled() || !('Notification' in window) || Notification.permission !== 'granted') return false;
  const identity = await readPushIdentity();
  const account = session();
  if (accountOnly && (!account.auth || !account.userId || account.expiresAt <= Date.now())) return false;
  if (!identity?.token || !Number.isFinite(identity.expiresAt) || identity.expiresAt <= Date.now()) return false;
  return account.auth
    ? Boolean(account.userId && account.expiresAt > Date.now() && identity.userId === account.userId)
    : Boolean(!identity.userId && identity.visitorId && identity.visitorId === visitorIdentity()?.id);
}
export async function browserPushStatus(accountOnly = false): Promise<string> {
  if (!pushConfigured()) return 'Notifications are being prepared. Please check again after the next website update.';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window))
    return 'This browser does not support notifications here. On iPhone, add ACTIV to your Home Screen and open it there.';
  if (Notification.permission === 'denied') return 'Notifications are blocked. Allow notifications in your browser’s site settings, then try again.';
  const account = session();
  if (accountOnly && (!account.auth || !account.userId || account.expiresAt <= Date.now())) return 'Sign in again to connect notifications to your account.';
  if (await browserPushRegistered(accountOnly)) return account.userId ? 'Notifications are enabled for this account on this browser.' : 'Public notifications are enabled on this browser.';
  return pushEnabled() && Notification.permission === 'granted'
    ? 'Permission is allowed, but this browser is not connected yet. Choose Enable notifications to try again.'
    : 'Enable notifications to receive ACTIV updates on this browser.';
}
export function clearBrowserPushSession(auth = session().auth): Promise<void> {
  generation++;
  cancelSdkWork?.();
  stopMessages?.(); stopMessages = undefined;
  // Revoke local display immediately, even while a Firebase request owns the lock.
  const revoked = (async () => {
    const identity = await readPushIdentity().catch(() => null);
    await writePushIdentity(null).catch(() => undefined);
    return identity;
  })();
  return serial(async () => {
    const identity = await revoked;
    // An earlier registration may have been completing while we revoked it.
    await writePushIdentity(null).catch(() => undefined);
    const registration = await navigator.serviceWorker?.getRegistration('/firebase-messaging-sw.js').catch(() => undefined);
    const notifications = await registration?.getNotifications();
    notifications?.forEach(notification => notification.close());
    if (identity?.visitorId) { queueVisitorRevocation(); await drainVisitorRevocation().catch(() => undefined); }
    else if (identity?.token && auth) await deviceRequest('DELETE', identity.token, auth).catch(() => undefined);
    changed();
  });
}
export async function disableBrowserPush() {
  localStorage.setItem(PREFERENCE, 'false');
  queueVisitorRevocation();
  await clearBrowserPushSession();
  await drainVisitorRevocation().catch(() => undefined);
  // Remove the subscription as well; old server registrations cannot deliver to it.
  await serial(async () => {
    if (!pushEnabled() && pushConfigured()) {
      const { sdk, messaging } = await client();
      if (!deletingToken) {
        const operation = sdk.deleteToken(messaging);
        deletingToken = operation;
        const done = () => { if (deletingToken === operation) deletingToken = null; };
        void operation.then(done, done);
      }
      await registrationDeadline(deletingToken, 'Turning off browser notifications');
    }
  });
  changed();
}
export async function enableBrowserPush(accountOnly = false) {
  if (!pushConfigured()) throw new Error('Website notifications are not configured yet.');
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator))
    throw new Error('Notifications need a supported browser over HTTPS. On iPhone, open ACTIV from your Home Screen.');
  // Request directly from the button gesture, before loading the SDK.
  const account = session();
  if (accountOnly && (!account.auth || !account.userId || account.expiresAt <= Date.now())) throw new Error('Sign in again to connect notifications to your account.');
  const revision = generation;
  const permission = await Notification.requestPermission();
  if (revision !== generation) return;
  if (accountOnly && (session().auth !== account.auth || account.expiresAt <= Date.now())) throw new Error('Your sign-in changed. Sign in again to connect notifications to your account.');
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can enable them in your browser’s site settings.');
  localStorage.setItem(PREFERENCE, 'true');
  await syncBrowserPush();
}
export function syncBrowserPush(): Promise<void> {
  const snapshot = session();
  const revision = generation;
  return serial(async () => {
    if ('Notification' in window && Notification.permission === 'granted' && localStorage.getItem(PREFERENCE) === null) localStorage.setItem(PREFERENCE, 'true');
    await drainVisitorRevocation();
    const previousIdentity = await readPushIdentity();
    if (revision !== generation || session().auth !== snapshot.auth) return;
    if (!snapshot.auth) {
      const current = () => revision === generation && !session().auth && pushEnabled() && Notification.permission === 'granted';
      if (!pushConfigured() || !pushEnabled() || !('Notification' in window) || Notification.permission !== 'granted') {
        if (previousIdentity) { await writePushIdentity(null); stopMessages?.(); stopMessages = undefined; }
        if (visitorIdentity() && !('Notification' in window && Notification.permission === 'granted' && pushEnabled())) {
          queueVisitorRevocation(); await drainVisitorRevocation();
        }
        return;
      }
      await writePushIdentity(null);
      const { sdk, messaging, token } = await registeredToken(current);
      if (!current()) return;
      const visitor = await visitorRegistration(token);
      if (!current()) { queueVisitorRevocation(); await drainVisitorRevocation(); return; }
      await writePushIdentity({ visitorId: visitor.id, token, expiresAt: Date.now() + 90 * 86400000 });
      foregroundMessages(sdk, messaging, current);
      changed();
      return;
    }
    // Account changes and browser permission revocation also happen outside our controls.
    // Remove the worker's display permission before any slow Firebase work.
    const canReceive = snapshot.auth && snapshot.userId && snapshot.expiresAt > Date.now()
      && pushConfigured() && pushEnabled() && 'Notification' in window && Notification.permission === 'granted';
    if (previousIdentity && (!canReceive || previousIdentity.userId !== snapshot.userId)) {
      await writePushIdentity(null);
      stopMessages?.(); stopMessages = undefined;
      const registration = await navigator.serviceWorker?.getRegistration('/firebase-messaging-sw.js').catch(() => undefined);
      (await registration?.getNotifications())?.forEach(notification => notification.close());
      if (previousIdentity.visitorId) { queueVisitorRevocation(); await drainVisitorRevocation(); }
      else if (snapshot.auth && previousIdentity.token) await deviceRequest('DELETE', previousIdentity.token, snapshot.auth).catch(() => undefined);
      changed();
    }
    if (!snapshot.auth || !snapshot.userId || snapshot.expiresAt <= Date.now() || !pushConfigured() || !pushEnabled()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      await writePushIdentity(null); return;
    }
    const current = () => revision === generation && session().auth === snapshot.auth && snapshot.expiresAt > Date.now()
      && pushEnabled() && Notification.permission === 'granted';
    const { sdk, messaging, token } = await registeredToken(current);
    if (!current()) return;
    const previous = await readPushIdentity();
    await writePushIdentity(null);
    if (previous?.token && previous.token !== token) await deviceRequest('DELETE', previous.token, snapshot.auth).catch(() => undefined);
    const result = await deviceRequest('POST', token, snapshot.auth);
    if (!current()) {
      await deviceRequest('DELETE', token, snapshot.auth).catch(() => undefined); return;
    }
    await writePushIdentity({ userId: snapshot.userId, token, expiresAt: snapshot.expiresAt });
    stopMessages?.();
    foregroundMessages(sdk, messaging, current);
    changed();
    if (!result.data?.configured) throw new Error('This browser is registered. Notification delivery is still being configured on the server.');
  }).catch(error => { changed(); if (!(error instanceof RegistrationCancelled)) throw error; });
}
