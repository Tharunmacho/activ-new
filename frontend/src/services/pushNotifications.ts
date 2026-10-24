import { useEffect } from 'react';
import { Alert, AppState, DeviceEventEmitter, Linking, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import { getMessaging, getToken, deleteToken, requestPermission, hasPermission, AuthorizationStatus,
  onMessage, onTokenRefresh, onNotificationOpenedApp, getInitialNotification, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import api, { getAuthToken, getUserData } from './api';
import { navigationRef } from '../navigation/navigationRef';
import { nativeContentRoute } from './nativeContentRoute';
import { visitorPushEnabled, setVisitorPushEnabled, visitorIdentity, registerVisitorToken, detachVisitorToken, retryVisitorDetach, recordVisitorOpen } from './visitorNotifications';

const TOKEN_KEY = '@activ_push_token';
const ASKED_KEY = '@activ_push_permission_asked';
export const SESSION_CHANGED = 'activ:session-changed';
let pending: Record<string, string> | null = null;
type RegistrationResult = 'enabled' | 'disabled' | 'signed-out' | 'unconfigured' | 'failed';
const CANCELLED = Symbol('push-registration-cancelled');
type RegistrationAttempt = { version: number; promise: Promise<RegistrationResult>; cancelled: Promise<typeof CANCELLED>; cancel: () => void };
let syncing: RegistrationAttempt | null = null;
let deletingToken: Promise<void> | null = null;
let syncAgain = false;
let detaching = 0;
let sessionVersion = 0;
let enablingFromSettings = false;
export const firebaseReady = () => getApps().length > 0;
const accountId = (user: any) => String(user?.memberId || user?.id || user?._id || user?.userId || '');

async function waitForSdk<T>(operation: Promise<T>, attempt: RegistrationAttempt): Promise<T> {
  const result = await Promise.race([operation, attempt.cancelled]);
  if (result === CANCELLED) throw CANCELLED;
  return result as T;
}
async function withinCleanupDeadline(operation: Promise<unknown>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation.then(() => true), new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), 5000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
async function invalidateFirebaseToken() {
  if (!firebaseReady()) return;
  if (!deletingToken) {
    const deletion = Promise.resolve().then(() => deleteToken(getMessaging())).catch(() => undefined);
    deletingToken = deletion;
    void deletion.then(() => { if (deletingToken === deletion) deletingToken = null; });
  }
  // The native SDK has no timeout. Do not trap logout, but retain this promise
  // so a late deletion cannot race a new account's getToken/registration.
  await withinCleanupDeadline(deletingToken);
}

export function notificationDestination(data: Record<string, any> | null = {}): { route: string; params?: any } {
  data = data || {};
  const event = String(data.event || '').toUpperCase();
  if (data.kind === 'message' && data.conversationId) return { route: 'MessageThread', params: { conversationId: data.conversationId, ...(data.from ? { name: String(data.from) } : {}) } };
  if (data.announcementId || data.kind === 'announcement') return { route: 'UpdateDetail', params: { id: data.announcementId || data.sourceId } };
  if (data.bookingRef) return { route: 'EventBooking', params: { eventId: data.eventId || '', ...(data.eventId ? { id: data.eventId } : {}), ref: data.bookingRef } };
  if (data.eventId) return { route: 'MemberEventDetail', params: { eventId: data.eventId, id: data.eventId } };
  if (['news', 'gallery', 'scheme'].includes(data.kind)) {
    const path = data.kind === 'news' ? (data.slug ? `/news/${encodeURIComponent(data.slug)}` : '/news')
      : data.kind === 'gallery' ? '/gallery' : '/schemes';
    const title = data.kind === 'news' ? 'ACTIV news' : data.kind === 'gallery' ? 'Gallery' : 'Government schemes';
    const destination = nativeContentRoute(path, title);
    if (destination) return { route: destination.name, params: destination.params };
  }
  if (event.startsWith('DONATION_')) return { route: 'MemberDonations' };
  // Failed, outstanding and business payments are not membership receipts.
  // PaymentResult fetches the current server state and offers the valid action.
  if (['PAYMENT_REQUIRED', 'PAYMENT_FAILED', 'COMPANY_PAYMENT_CONFIRMED'].includes(event)) {
    if (data.orderId) return { route: 'PaymentResult', params: { orderId: data.orderId } };
    return { route: event === 'COMPANY_PAYMENT_CONFIRMED' ? 'ManageCompanies' : 'MembershipPlans' };
  }
  if (['MEMBERSHIP_RENEWAL_DUE', 'MEMBERSHIP_PLAN_ADVANCED'].includes(event)) return { route: 'MembershipPlanDetails' };
  if (data.orderId) return { route: 'PaymentSuccess', params: { orderId: data.orderId } };
  if (/^(MEMBERSHIP_|APPLICATION_|PLATINUM_)/.test(event) || ['ACCOUNT_REGISTERED', 'CORRECTION_REQUESTED'].includes(event)) return { route: 'ApplicationStatus' };
  return { route: 'MemberNotifications' };
}
export async function flushPushNavigation() {
  if (!pending || !navigationRef.isReady()) return;
  const data = pending;
  const version = sessionVersion;
  const token = await getAuthToken();
  const user = await getUserData();
  const latestUser = await getUserData();
  if (await getAuthToken() !== token || accountId(latestUser) !== accountId(user)) return;
  if (pending !== data || version !== sessionVersion || detaching) return;
  if (data.audience === 'visitor' && /^[a-f\d]{24}$/i.test(data.publicNotificationId || '')) {
    if (token) { pending = null; return; }
    const visitor = await visitorIdentity();
    const enabled = await visitorPushEnabled();
    if (await getAuthToken() || version !== sessionVersion || detaching || pending !== data) return;
    if (!enabled || visitor?.id !== data.visitorId) { pending = null; return; }
    pending = null;
    void recordVisitorOpen(data.publicNotificationId, 'push');
    (navigationRef.navigate as any)('PublicNotifications', { id: data.publicNotificationId });
    return;
  }
  if (!token || !user) return;
  if (!data.userId || data.userId !== accountId(user)) { pending = null; return; }
  // Session restoration chooses a landing screen before a push opens its target.
  if (['Onboarding', 'Login', 'AdminLogin', 'Welcome', 'SocialSignIn'].includes(navigationRef.getCurrentRoute()?.name || '')) return;
  const target = data.kind === 'test' && user.role === 'super_admin'
    ? { route: 'SuperNotifications', params: { view: 'delivery' } } : notificationDestination(data);
  pending = null;
  if (/^[a-f\d]{24}$/i.test(data.notificationId || '')) void api.patch('/notifications/' + data.notificationId + '/open', { channel: 'push' }, { timeout: 5000 }).catch(() => undefined);
  (navigationRef.navigate as any)(target.route, target.params);
}
async function receiveOpen(message: any) {
  if (message?.data) { pending = message.data; await flushPushNavigation(); }
}
async function androidNotificationsEnabled() {
  const native = NativeModules.ActivNotifications;
  return typeof native?.areNotificationsEnabled === 'function' ? await native.areNotificationsEnabled() === true : true;
}
export async function openPushSettings() {
  if (Platform.OS === 'android' && NativeModules.ActivNotifications?.openSettings) {
    await NativeModules.ActivNotifications.openSettings();
  } else await Linking.openSettings();
}
export async function pushPermission() {
  if (!firebaseReady()) return 'unconfigured';
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33 && !await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) return 'disabled';
    if (!await androidNotificationsEnabled()) return 'disabled';
    if (Number(Platform.Version) >= 33) return 'enabled';
  }
  const status = await hasPermission(getMessaging());
  return (status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL) ? 'enabled' : 'disabled';
}
async function allowNotifications(explicit: boolean, attempt: RegistrationAttempt) {
  if (await waitForSdk(pushPermission(), attempt) === 'enabled') return true;
  // Permission dialogs follow the user's Allow action on the shared welcome
  // prompt/settings. A foreground sync must never surprise them with a prompt.
  if (!explicit) return false;
  if (detaching || attempt.version !== sessionVersion) throw CANCELLED;
  await AsyncStorage.setItem(ASKED_KEY, 'true');
  if (detaching || attempt.version !== sessionVersion) throw CANCELLED;
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const granted = (await waitForSdk(PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS), attempt)) === PermissionsAndroid.RESULTS.GRANTED;
    return granted && await waitForSdk(androidNotificationsEnabled(), attempt);
  }
  if (Platform.OS === 'android') return await waitForSdk(androidNotificationsEnabled(), attempt);
  const permission = await waitForSdk(requestPermission(getMessaging()), attempt);
  return (permission === AuthorizationStatus.AUTHORIZED || permission === AuthorizationStatus.PROVISIONAL);
}
async function registerDevice(explicit: boolean, attempt: RegistrationAttempt): Promise<RegistrationResult> {
  const version = attempt.version;
  try {
    const auth = await getAuthToken();
    const user = await getUserData();
    if (!auth) return await registerVisitor(explicit, attempt);
    if (!accountId(user)) return 'signed-out';
    const allowed = await allowNotifications(explicit, attempt);
    if (detaching || version !== sessionVersion || await getAuthToken() !== auth) return 'signed-out';
    if (!allowed) {
      const saved = await AsyncStorage.getItem(TOKEN_KEY);
      if (saved) await api.delete('/notifications/push/devices', { data: { token: saved }, timeout: 5000 });
      await AsyncStorage.removeItem(TOKEN_KEY);
      return 'disabled';
    }
    if (deletingToken && !await waitForSdk(withinCleanupDeadline(deletingToken), attempt)) return 'failed';
    if (detaching || version !== sessionVersion) return 'signed-out';
    const token = await waitForSdk(getToken(getMessaging()), attempt);
    if (detaching || version !== sessionVersion || await getAuthToken() !== auth) return 'signed-out';
    // Save before the request so logout can revoke a token even when the server
    // accepted registration but the response was lost or arrived during logout.
    await AsyncStorage.setItem(TOKEN_KEY, token);
    if (detaching || version !== sessionVersion || await getAuthToken() !== auth) return 'signed-out';
    const response = await api.post('/notifications/push/devices', { token, platform: Platform.OS, enabled: true }, { timeout: 5000 });
    if (detaching || version !== sessionVersion || await getAuthToken() !== auth) return 'signed-out';
    const registration = response?.data?.data ?? response?.data;
    if (registration?.registered !== true) return 'failed';
    return registration.configured === false || registration.ready === false ? 'unconfigured' : 'enabled';
  } catch (error) {
    // Connectivity/configuration must never block login. Retry on foreground.
    return error === CANCELLED ? 'signed-out' : 'failed';
  }
}
async function registerVisitor(explicit: boolean, attempt: RegistrationAttempt): Promise<RegistrationResult> {
  if (!explicit && !await visitorPushEnabled()) return 'signed-out';
  const current = async () => !detaching && attempt.version === sessionVersion && !await getAuthToken();
  const allowed = await allowNotifications(explicit, attempt);
  if (!await current()) return 'signed-out';
  if (!allowed) {
    await setVisitorPushEnabled(false);
    await detachVisitorToken().catch(() => undefined);
    await invalidateFirebaseToken();
    return 'disabled';
  }
  // Consent is intent, independent of network success. Foreground retries can
  // complete an explicit opt-in even when the first registration was offline.
  await setVisitorPushEnabled(true);
  if (!await current()) return 'signed-out';
  if (deletingToken && !await waitForSdk(withinCleanupDeadline(deletingToken), attempt)) return 'failed';
  const token = await waitForSdk(getToken(getMessaging()), attempt);
  if (!await current()) return 'signed-out';
  const registration = await registerVisitorToken(token, Platform.OS);
  if (!await current()) { await detachVisitorToken().catch(() => undefined); return 'signed-out'; }
  if (registration?.registered !== true) return 'failed';
  return registration.configured === false || registration.ready === false ? 'unconfigured' : 'enabled';
}
export async function enableVisitorNotifications() {
  const result = await syncPushRegistration(true);
  if (result === 'disabled') await openPushSettings();
  else if (result === 'unconfigured') Alert.alert('Notifications are not ready', 'Notification delivery is not ready. Please try again later.');
  else if (result === 'failed') throw new Error('Visitor notification registration failed');
}
export async function disableVisitorNotifications() {
  sessionVersion += 1;
  pending = null;
  const registration = syncing;
  registration?.cancel();
  await setVisitorPushEnabled(false);
  if (registration) await registration.promise;
  // A consent write already in progress may have completed during cancellation.
  await setVisitorPushEnabled(false);
  await detachVisitorToken().catch(() => undefined);
  if (!await getAuthToken()) await invalidateFirebaseToken();
}

export async function syncPushRegistration(explicit = false): Promise<RegistrationResult> {
  const requestedVersion = sessionVersion;
  await retryVisitorDetach().catch(() => undefined);
  if (requestedVersion !== sessionVersion) return 'signed-out';
  if (detaching) return 'signed-out';
  if (!firebaseReady()) return 'unconfigured';
  if (syncing) {
    // An explicit settings action must wait for registration and preserve its
    // permission request, even if a passive foreground sync is already running.
    if (explicit) { await syncing.promise; return requestedVersion === sessionVersion ? syncPushRegistration(true) : 'signed-out'; }
    syncAgain = true;
    return syncing.promise;
  }
  let cancel!: () => void;
  const cancelled = new Promise<typeof CANCELLED>(resolve => { cancel = () => resolve(CANCELLED); });
  const attempt: RegistrationAttempt = { version: sessionVersion, cancelled, cancel, promise: Promise.resolve('signed-out') };
  syncing = attempt;
  attempt.promise = registerDevice(explicit, attempt);
  try { return await attempt.promise; }
  finally {
    if (syncing === attempt) syncing = null;
    if (syncAgain) { syncAgain = false; if (!detaching) void syncPushRegistration(); }
  }
}
export async function detachPushDevice(server = true) {
  detaching += 1;
  sessionVersion += 1;
  pending = null;
  const registration = syncing;
  registration?.cancel();
  try {
    // Finish an in-flight registration before removing it. A 401 handler calls
    // this with server=false from inside that request, so it must never wait on
    // the same request; deleting the FCM token still invalidates its delivery.
    if (server && registration) await registration.promise;
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (server && token && await getAuthToken()) await api.delete('/notifications/push/devices', { data: { token }, timeout: 5000 }).catch(() => undefined);
    await invalidateFirebaseToken();
    await AsyncStorage.removeItem(TOKEN_KEY);
  } finally { detaching -= 1; }
}
export async function enablePushFromSettings() {
  if (enablingFromSettings) return;
  enablingFromSettings = true;
  try {
    if (!firebaseReady()) { Alert.alert('Notifications are being prepared', 'Push notifications will be available after ACTIV finishes notification setup and publishes the updated app.'); return; }
    const auth = await getAuthToken();
    const user = await getUserData();
    if (!auth || !accountId(user)) { Alert.alert('Sign in to enable notifications', 'Sign in to your ACTIV account, then try again.'); return; }
    const result = await syncPushRegistration(true);
    if (await getAuthToken() !== auth || accountId(await getUserData()) !== accountId(user)) {
      Alert.alert('Sign in to enable notifications', 'Your account changed. Open notification settings from your current account and try again.');
      return;
    }
    if (result === 'disabled') await openPushSettings();
    else if (result === 'unconfigured') Alert.alert('Notifications are not ready', 'Notification delivery is not ready. Please try again later.');
    else if (result === 'failed') Alert.alert('Could not enable notifications', 'Please check your connection and try again. If this continues, contact ACTIV support.');
    else if (result === 'signed-out') Alert.alert('Sign in to enable notifications', 'Sign in to your ACTIV account, then try again.');
    else if (result === 'enabled') Alert.alert('Notifications enabled', 'This phone is registered for updates available to your ACTIV account.');
  } catch {
    Alert.alert('Could not enable notifications', 'Please check your connection and try again.');
  } finally { enablingFromSettings = false; }
}
export function registerBackgroundPush() {
  if (firebaseReady()) setBackgroundMessageHandler(getMessaging(), async () => {
    // FCM/APNs displays the server-rendered title/body. Do not post a duplicate.
  });
}
async function showForegroundNotification(message: any, visitor = false) {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const title = text(message.data?.title) || text(message.notification?.title) || 'ACTIV update';
  const body = text(message.data?.body) || text(message.notification?.body)
    || (visitor ? 'Dear ACTIVian, there is a new public update for you.' : 'Dear member, you have a new notification.');
  if (Platform.OS === 'android' && NativeModules.ActivNotifications?.show) {
    // FCM displays background messages itself. Only foreground delivery is
    // posted here, through the existing channel and its current user settings.
    const id = String(message.data?.notificationId || message.data?.publicNotificationId || message.messageId || Date.now());
    await NativeModules.ActivNotifications.show(id, title, body, message.data || {}).catch(() => undefined);
    return;
  }
  Alert.alert(title, body, [{ text: 'Later', style: 'cancel' }, { text: 'View', onPress: () => void receiveOpen(message) }]);
}
export function usePushNotifications() {
  useEffect(() => {
    if (!firebaseReady()) return;
    const messaging = getMessaging();
    void syncPushRegistration();
    const foreground = onMessage(messaging, async message => {
      const version = sessionVersion;
      const auth = await getAuthToken();
      const user = await getUserData();
      if (message.data?.audience === 'visitor') {
        const visitor = await visitorIdentity();
        const enabled = await visitorPushEnabled();
        if (auth || await getAuthToken() || detaching || version !== sessionVersion || !enabled || visitor?.id !== message.data.visitorId) return;
        await showForegroundNotification(message, true);
        return;
      }
      if (!auth || detaching || version !== sessionVersion || !accountId(user) || !message.data?.userId || message.data.userId !== accountId(user)) return;
      const latestUser = await getUserData();
      if (await getAuthToken() !== auth || accountId(latestUser) !== accountId(user) || detaching || version !== sessionVersion) return;
      DeviceEventEmitter.emit('activ:notification');
      await showForegroundNotification(message);
    });
    const refresh = onTokenRefresh(messaging, () => { void syncPushRegistration(); });
    const opened = onNotificationOpenedApp(messaging, receiveOpen);
    void getInitialNotification(messaging).then(receiveOpen).catch(() => undefined);
    const native = Platform.OS === 'android' ? NativeModules.ActivNotifications : null;
    const localOpened = native ? new NativeEventEmitter(native).addListener('activ:notification-opened', data => { void receiveOpen({ data }); }) : null;
    if (native?.getInitialOpen) void native.getInitialOpen().then((data: any) => receiveOpen({ data })).catch(() => undefined);
    const session = DeviceEventEmitter.addListener(SESSION_CHANGED, () => { void syncPushRegistration(); });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void syncPushRegistration(); });
    return () => { foreground(); refresh(); opened(); localOpened?.remove(); session.remove(); appState.remove(); };
  }, []);
}
