import { API_BASE_URL, STORAGE_KEYS } from '@/config/api.config';
import { firebasePushConfig, pushConfigured, vapidKey } from '@/lib/firebasePushConfig';
import { readPushIdentity, writePushIdentity, ownsPush } from '@/lib/pushIdentity';
import { notificationPath } from '@/lib/notificationPath';

const PREFERENCE = 'activ:browser-push-enabled';
export const PUSH_EVENT = 'activ:push-changed';
let generation = 0;
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
async function registrationDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Notification registration timed out. Please try again.')), 12000);
    })]);
  } finally { clearTimeout(timer); }
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
export async function browserPushStatus(): Promise<string> {
  if (!pushConfigured()) return 'Notifications are being prepared. Please check again after the next website update.';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window))
    return 'This browser does not support notifications here. On iPhone, add ACTIV to your Home Screen and open it there.';
  if (Notification.permission === 'denied') return 'Notifications are blocked. Allow notifications in your browser’s site settings, then try again.';
  const identity = await readPushIdentity().catch(() => null);
  return pushEnabled() && identity?.userId === session().userId && identity?.expiresAt > Date.now()
    ? 'Notifications are enabled for this account on this browser.' : 'Enable notifications to receive ACTIV updates on this browser.';
}
export function clearBrowserPushSession(auth = session().auth): Promise<void> {
  generation++;
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
    if (identity?.token && auth) await deviceRequest('DELETE', identity.token, auth).catch(() => undefined);
    changed();
  });
}
export async function disableBrowserPush() {
  localStorage.setItem(PREFERENCE, 'false');
  await clearBrowserPushSession();
  // Remove the subscription as well; old server registrations cannot deliver to it.
  await serial(async () => {
    if (!pushEnabled() && pushConfigured()) {
      const { sdk, messaging } = await client();
      await sdk.deleteToken(messaging);
    }
  });
  changed();
}
export async function enableBrowserPush() {
  if (!pushConfigured()) throw new Error('Website notifications are not configured yet.');
  if (!session().userId) throw new Error('Please sign in first.');
  if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator))
    throw new Error('Notifications need a supported browser over HTTPS. On iPhone, open ACTIV from your Home Screen.');
  // Request directly from the button gesture, before loading the SDK.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can enable them in your browser’s site settings.');
  localStorage.setItem(PREFERENCE, 'true');
  await syncBrowserPush();
}
export function syncBrowserPush(): Promise<void> {
  const snapshot = session();
  const revision = generation;
  return serial(async () => {
    const previousIdentity = await readPushIdentity();
    if (revision !== generation || session().auth !== snapshot.auth) return;
    // Account changes and browser permission revocation also happen outside our controls.
    // Remove the worker's display permission before any slow Firebase work.
    const canReceive = snapshot.auth && snapshot.userId && snapshot.expiresAt > Date.now()
      && pushConfigured() && pushEnabled() && 'Notification' in window && Notification.permission === 'granted';
    if (previousIdentity && (!canReceive || previousIdentity.userId !== snapshot.userId)) {
      await writePushIdentity(null);
      stopMessages?.(); stopMessages = undefined;
      const registration = await navigator.serviceWorker?.getRegistration('/firebase-messaging-sw.js').catch(() => undefined);
      (await registration?.getNotifications())?.forEach(notification => notification.close());
      if (snapshot.auth && previousIdentity.token) await deviceRequest('DELETE', previousIdentity.token, snapshot.auth).catch(() => undefined);
      changed();
    }
    if (!snapshot.auth || !snapshot.userId || snapshot.expiresAt <= Date.now() || !pushConfigured() || !pushEnabled()) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      await writePushIdentity(null); return;
    }
    const current = () => revision === generation && session().auth === snapshot.auth && snapshot.expiresAt > Date.now() && pushEnabled();
    // Bound external SDK work so logout is never trapped behind a stalled request.
    // A late SDK result cannot reach the server registration or write an identity.
    const { sdk, messaging, token } = await registrationDeadline((async () => {
      const { sdk, messaging } = await client();
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      const token = current() ? await sdk.getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }) : null;
      return { sdk, messaging, token };
    })());
    if (!current()) return;
    if (!token) throw new Error('The browser did not return a notification registration. Please try again.');
    const previous = await readPushIdentity();
    await writePushIdentity(null);
    if (previous?.token && previous.token !== token) await deviceRequest('DELETE', previous.token, snapshot.auth).catch(() => undefined);
    const result = await deviceRequest('POST', token, snapshot.auth);
    if (!current()) {
      await deviceRequest('DELETE', token, snapshot.auth).catch(() => undefined); return;
    }
    await writePushIdentity({ userId: snapshot.userId, token, expiresAt: snapshot.expiresAt });
    stopMessages?.();
    stopMessages = sdk.onMessage(messaging, async message => {
      if (!current() || document.visibilityState !== 'visible') return;
      if (!ownsPush(await readPushIdentity(), message.data)) return;
      const { toast } = await import('sonner');
      toast('You have an update from ACTIV.', { id: message.data?.notificationId || message.messageId,
        action: { label: 'Open', onClick: () => {
          if (current()) window.location.assign(notificationPath({ data: message.data }));
        } } });
    });
    changed();
    if (!result.data?.configured) throw new Error('This browser is registered. Notification delivery is still being configured on the server.');
  });
}
