import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import { deleteToken, getToken, onMessage, onNotificationOpenedApp, onTokenRefresh, requestPermission, hasPermission, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import api, { getAuthToken, getUserData } from '../src/services/api';
import { navigationRef } from '../src/navigation/navigationRef';
import { detachPushDevice, enablePushFromSettings, flushPushNavigation, pushPermission, registerBackgroundPush, syncPushRegistration, usePushNotifications } from '../src/services/pushNotifications';

jest.mock('../src/services/api', () => ({
  __esModule: true, default: { post: jest.fn(), delete: jest.fn() },
  getAuthToken: jest.fn(), getUserData: jest.fn(),
}));
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(() => true), getCurrentRoute: jest.fn(() => ({ name: 'PaidDashboard' })), navigate: jest.fn() },
}));

const mock = (value: any) => value as jest.Mock;
const TOKEN_KEY = '@activ_push_token';
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const until = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) await Promise.resolve();
  expect(condition()).toBe(true);
};
let cleanup: (() => void) | undefined;
let currentAuth: string | null;
let currentUser: any;
beforeEach(async () => {
  jest.clearAllMocks();
  NativeModules.ActivNotifications = undefined;
  await AsyncStorage.clear();
  currentAuth = 'account-a-session';
  currentUser = { memberId: 'account-a', role: 'member' };
  mock(getAuthToken).mockImplementation(async () => currentAuth);
  mock(getUserData).mockImplementation(async () => currentUser);
  mock(getApps).mockReturnValue([{}]);
  mock(getToken).mockResolvedValue('firebase-token-for-account-a');
  mock(deleteToken).mockResolvedValue(undefined);
  mock(api.post).mockResolvedValue({ data: { registered: true } });
  mock(api.delete).mockResolvedValue({ data: { removed: true } });
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => 34 });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mock(navigationRef.getCurrentRoute).mockReturnValue({ name: 'PaidDashboard' });
});
afterEach(async () => {
  cleanup?.(); cleanup = undefined;
  await detachPushDevice();
  jest.restoreAllMocks();
});
function startListeners() {
  jest.spyOn(React, 'useEffect').mockImplementation(effect => { cleanup = effect() as (() => void) | undefined; });
  usePushNotifications();
}

test('registration requires Firebase and a complete signed-in account', async () => {
  mock(getApps).mockReturnValue([]);
  expect(await syncPushRegistration()).toBe('unconfigured');
  mock(getApps).mockReturnValue([{}]);
  currentUser = null;
  expect(await syncPushRegistration()).toBe('signed-out');
  currentUser = { memberId: 'account-a' }; currentAuth = null;
  expect(await syncPushRegistration()).toBe('signed-out');
  expect(getToken).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

test('Android permission approval registers the token under the authenticated account', async () => {
  mock(PermissionsAndroid.check).mockResolvedValue(false);
  expect(await syncPushRegistration(true)).toBe('enabled');
  expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  expect(api.post).toHaveBeenCalledWith('/notifications/push/devices', { token: 'firebase-token-for-account-a', platform: 'android', enabled: true }, { timeout: 5000 });
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBe('firebase-token-for-account-a');
});

test('passive signed-in sync does not request permission before the explanatory Allow action', async () => {
  mock(PermissionsAndroid.check).mockResolvedValue(false);
  expect(await syncPushRegistration()).toBe('disabled');
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@activ_push_permission_asked')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

test('iOS provisional authorization registers without asking permission again', async () => {
  Platform.OS = 'ios';
  mock(hasPermission).mockResolvedValue(2);
  expect(await syncPushRegistration()).toBe('enabled');
  expect(requestPermission).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith('/notifications/push/devices', expect.objectContaining({ platform: 'ios' }), { timeout: 5000 });
});

test('revoking permission removes the previous server registration', async () => {
  await AsyncStorage.setItem(TOKEN_KEY, 'old-firebase-token');
  await AsyncStorage.setItem('@activ_push_permission_asked', 'true');
  mock(PermissionsAndroid.check).mockResolvedValue(false);
  expect(await syncPushRegistration()).toBe('disabled');
  expect(api.delete).toHaveBeenCalledWith('/notifications/push/devices', { data: { token: 'old-firebase-token' }, timeout: 5000 });
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBeNull();
  expect(getToken).not.toHaveBeenCalled();
});

test('an explicit enable action is preserved while a passive sync is in flight', async () => {
  await AsyncStorage.setItem('@activ_push_permission_asked', 'true');
  const permission = deferred<boolean>();
  mock(PermissionsAndroid.check).mockReturnValueOnce(permission.promise).mockResolvedValue(false);
  const passive = syncPushRegistration();
  await until(() => mock(PermissionsAndroid.check).mock.calls.length === 1);
  const explicit = syncPushRegistration(true);
  permission.resolve(false);
  expect(await passive).toBe('disabled');
  expect(await explicit).toBe('enabled');
  expect(PermissionsAndroid.request).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('logout waits for an accepted registration before deleting it and the FCM token', async () => {
  const response = deferred<any>();
  mock(api.post).mockReturnValueOnce(response.promise);
  const registration = syncPushRegistration();
  await until(() => mock(api.post).mock.calls.length === 1);
  const logout = detachPushDevice();
  expect(api.delete).not.toHaveBeenCalled();
  response.resolve({ data: { registered: true } });
  expect(await registration).toBe('signed-out');
  await logout;
  expect(api.delete).toHaveBeenCalledWith('/notifications/push/devices', { data: { token: 'firebase-token-for-account-a' }, timeout: 5000 });
  expect(deleteToken).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBeNull();
});

test('logout during FCM token acquisition prevents any server registration', async () => {
  const token = deferred<string>();
  mock(getToken).mockReturnValueOnce(token.promise);
  const registration = syncPushRegistration();
  await until(() => mock(getToken).mock.calls.length === 1);
  const logout = detachPushDevice();
  token.resolve('late-firebase-token');
  expect(await registration).toBe('signed-out');
  await logout;
  expect(api.post).not.toHaveBeenCalled();
  expect(deleteToken).toHaveBeenCalledTimes(1);
});

test.each(['permission', 'token'])('logout cancels hung SDK %s acquisition without touching the next account', async stage => {
  const sdk = deferred<any>();
  if (stage === 'permission') {
    mock(PermissionsAndroid.check).mockResolvedValue(false);
    mock(PermissionsAndroid.request).mockReturnValueOnce(sdk.promise);
  } else mock(getToken).mockReturnValueOnce(sdk.promise);
  const registration = syncPushRegistration(true);
  await until(() => mock(stage === 'permission' ? PermissionsAndroid.request : getToken).mock.calls.length === 1);
  // The SDK promise deliberately stays unresolved while logout completes.
  await detachPushDevice();
  expect(await registration).toBe('signed-out');
  expect(api.post).not.toHaveBeenCalled();
  currentAuth = 'account-b-session'; currentUser = { memberId: 'account-b' };
  mock(PermissionsAndroid.check).mockResolvedValue(true);
  mock(getToken).mockResolvedValue('account-b-firebase-token');
  expect(await syncPushRegistration()).toBe('enabled');
  sdk.resolve(stage === 'permission' ? PermissionsAndroid.RESULTS.GRANTED : 'late-account-a-token');
  await Promise.resolve();
  expect(mock(api.post).mock.calls.map(([, body]) => body.token)).toEqual(['account-b-firebase-token']);
  expect(deleteToken).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBe('account-b-firebase-token');
});

test('a hung FCM token deletion cannot hold logout or delete a new account registration later', async () => {
  jest.useFakeTimers();
  const deletion = deferred<void>();
  mock(deleteToken).mockReturnValueOnce(deletion.promise);
  const logout = detachPushDevice();
  await until(() => jest.getTimerCount() > 0);
  jest.advanceTimersByTime(5000);
  await logout;
  currentAuth = 'account-b-session'; currentUser = { memberId: 'account-b' };
  mock(getToken).mockResolvedValue('account-b-firebase-token');
  const retryWhileDeleting = syncPushRegistration();
  await until(() => jest.getTimerCount() > 0);
  jest.advanceTimersByTime(5000);
  expect(await retryWhileDeleting).toBe('failed');
  expect(getToken).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  // A new token is requested only after the old SDK deletion actually finishes.
  deletion.resolve();
  await deletion.promise;
  expect(await syncPushRegistration()).toBe('enabled');
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBe('account-b-firebase-token');
  jest.useRealTimers();
});

test('a 401 inside registration can clear push state without a circular wait', async () => {
  mock(api.post).mockImplementationOnce(async () => {
    await detachPushDevice(false);
    currentAuth = null;
    throw new Error('Unauthorized');
  });
  expect(await syncPushRegistration()).toBe('failed');
  expect(deleteToken).toHaveBeenCalledTimes(1);
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBeNull();
});

test('settings reports a registration failure instead of silently implying notifications work', async () => {
  mock(api.post).mockRejectedValueOnce(new Error('Offline'));
  await enablePushFromSettings();
  expect(Alert.alert).toHaveBeenCalledWith('Could not enable notifications', expect.any(String));
});

test.each([{ data: { registered: false } }, { data: {} }, { data: null }])('registration requires an affirmative API acknowledgement: %j', async response => {
  mock(api.post).mockResolvedValueOnce(response);
  expect(await syncPushRegistration(true)).toBe('failed');
});

test('wrapped registration acknowledgement works and an unconfigured service is reported honestly', async () => {
  mock(api.post).mockResolvedValueOnce({ data: { data: { registered: true, configured: true } } });
  expect(await syncPushRegistration(true)).toBe('enabled');
  mock(api.post).mockResolvedValueOnce({ data: { data: { registered: true, configured: false } } });
  await enablePushFromSettings();
  expect(Alert.alert).toHaveBeenCalledWith('Notifications are not ready', expect.any(String));
  expect(Alert.alert).not.toHaveBeenCalledWith('Notifications enabled', expect.any(String));
});

test('a persisted device with failed provider readiness remains registered without claiming delivery is enabled', async () => {
  mock(api.post).mockResolvedValueOnce({ data: { data: { registered: true, configured: true, ready: false } } });
  await enablePushFromSettings();
  expect(Alert.alert).toHaveBeenCalledWith('Notifications are not ready', expect.any(String));
  expect(Alert.alert).not.toHaveBeenCalledWith('Notifications enabled', expect.any(String));
  expect(await AsyncStorage.getItem(TOKEN_KEY)).toBe('firebase-token-for-account-a');
  expect(api.delete).not.toHaveBeenCalled();
});

test.each([null, {}])('settings requires a complete member account rather than opting in as a visitor: %j', async user => {
  currentUser = user; currentAuth = user ? 'incomplete-session' : null;
  await enablePushFromSettings();
  expect(Alert.alert).toHaveBeenCalledWith('Sign in to enable notifications', expect.any(String));
  expect(getToken).not.toHaveBeenCalled();
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@activ_visitor_push_enabled')).toBeNull();
});

test('an incomplete authenticated session never asks for visitor permission', async () => {
  currentUser = null;
  expect(await syncPushRegistration(true)).toBe('signed-out');
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(getToken).not.toHaveBeenCalled();
});

test('settings suppresses duplicate enable taps and cannot confirm success for a changed account', async () => {
  const response = deferred<any>(); mock(api.post).mockReturnValueOnce(response.promise);
  const first = enablePushFromSettings();
  await until(() => mock(api.post).mock.calls.length === 1);
  await enablePushFromSettings();
  expect(api.post).toHaveBeenCalledTimes(1);
  currentAuth = 'account-b-session'; currentUser = { memberId: 'account-b' };
  response.resolve({ data: { registered: true } });
  await first;
  expect(Alert.alert).toHaveBeenCalledWith('Sign in to enable notifications', expect.stringContaining('account changed'));
  expect(Alert.alert).not.toHaveBeenCalledWith('Notifications enabled', expect.any(String));
});

test('token refresh re-registers for the current signed-in account and stops after logout', async () => {
  startListeners();
  await syncPushRegistration();
  const refresh = mock(onTokenRefresh).mock.calls[0][1];
  mock(getToken).mockResolvedValue('refreshed-firebase-token');
  refresh('refreshed-firebase-token');
  await until(() => mock(api.post).mock.calls.some(([, body]) => body.token === 'refreshed-firebase-token'));
  await detachPushDevice();
  currentAuth = null; currentUser = null;
  mock(api.post).mockClear();
  refresh('signed-out-firebase-token');
  await syncPushRegistration();
  expect(api.post).not.toHaveBeenCalled();
});

test('foreground messages require the current account and taps route to their content', async () => {
  startListeners();
  await syncPushRegistration();
  const receive = mock(onMessage).mock.calls[0][1];
  await receive({ data: { userId: 'account-b', kind: 'announcement', sourceId: 'notice' } });
  await receive({ data: { kind: 'announcement', sourceId: 'notice' } });
  expect(Alert.alert).not.toHaveBeenCalled();
  await receive({ data: { userId: 'account-a', kind: 'announcement', sourceId: 'notice' } });
  const actions = mock(Alert.alert).mock.calls[0][2];
  actions.find((action: any) => action.text === 'View').onPress();
  await until(() => mock(navigationRef.navigate).mock.calls.length === 1);
  expect(navigationRef.navigate).toHaveBeenCalledWith('UpdateDetail', { id: 'notice' });
});

test('foreground messages are suppressed when the account changes during identity reads', async () => {
  startListeners();
  await detachPushDevice();
  const receive = mock(onMessage).mock.calls[0][1];
  mock(getUserData).mockImplementationOnce(async () => {
    const previousUser = currentUser;
    currentAuth = 'account-b-session'; currentUser = { memberId: 'account-b' };
    return previousUser;
  });
  await receive({ data: { userId: 'account-a', kind: 'announcement', sourceId: 'notice' } });
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('notification opens wait for admin session restoration and ignore other accounts', async () => {
  currentUser = { id: 'account-a', role: 'super_admin' };
  mock(navigationRef.getCurrentRoute).mockReturnValue({ name: 'AdminLogin' });
  startListeners();
  await syncPushRegistration();
  const open = mock(onNotificationOpenedApp).mock.calls[0][1];
  await open({ data: { userId: 'account-a', kind: 'test' } });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  mock(navigationRef.getCurrentRoute).mockReturnValue({ name: 'SuperAdminDashboard' });
  await flushPushNavigation();
  expect(navigationRef.navigate).toHaveBeenCalledWith('SuperNotifications', { view: 'delivery' });
  mock(navigationRef.navigate).mockClear();
  await open({ data: { userId: 'account-b', eventId: 'event' } });
  await open({ data: { eventId: 'event' } });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
});

test('concurrent navigation callbacks open a pending notification only once', async () => {
  startListeners();
  await syncPushRegistration();
  const user = deferred<any>();
  mock(getUserData).mockReturnValue(user.promise);
  const open = mock(onNotificationOpenedApp).mock.calls[0][1];
  const first = open({ data: { userId: 'account-a', eventId: 'event' } });
  const second = flushPushNavigation();
  user.resolve(currentUser);
  await Promise.all([first, second]);
  expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
});

function installAndroidTray() {
  const native = { areNotificationsEnabled: jest.fn(async () => true), show: jest.fn(async () => true),
    openSettings: jest.fn(async () => true), getInitialOpen: jest.fn(async (): Promise<any> => null),
    addListener: jest.fn(), removeListeners: jest.fn() };
  NativeModules.ActivNotifications = native;
  return native;
}

test.each([32, 34])('blocked Android app/channel is disabled on API %i despite granted runtime permission', async version => {
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  const native = installAndroidTray();
  native.areNotificationsEnabled.mockResolvedValue(false);
  expect(await pushPermission()).toBe('disabled');
  expect(await syncPushRegistration()).toBe('disabled');
  expect(api.post).not.toHaveBeenCalled();
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  await enablePushFromSettings();
  expect(native.openSettings).toHaveBeenCalledTimes(1);
  expect(Alert.alert).not.toHaveBeenCalledWith('Notifications enabled', expect.any(String));
  expect(api.post).not.toHaveBeenCalled();
});

test('foreground Android messages create a private tray entry and native taps use account-checked routing', async () => {
  const native = installAndroidTray(); startListeners(); await syncPushRegistration();
  const receive = mock(onMessage).mock.calls[0][1];
  const data = { userId: 'account-a', kind: 'announcement', sourceId: 'notice' };
  await receive({ messageId: 'message-one', notification: { title: 'Private title', body: 'Private details' }, data });
  expect(native.show).toHaveBeenCalledWith('message-one', 'Private title', 'Private details', data);
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  DeviceEventEmitter.emit('activ:notification-opened', data);
  await until(() => mock(navigationRef.navigate).mock.calls.length === 1);
  expect(navigationRef.navigate).toHaveBeenCalledWith('UpdateDetail', { id: 'notice' });
  mock(navigationRef.navigate).mockClear(); native.show.mockClear();
  await receive({ data: { ...data, userId: 'account-b' } });
  DeviceEventEmitter.emit('activ:notification-opened', { ...data, userId: 'account-b' });
  await Promise.resolve(); await Promise.resolve();
  expect(native.show).not.toHaveBeenCalled(); expect(navigationRef.navigate).not.toHaveBeenCalled();
});

test('a cold local tray tap waits for restored identity/navigation before opening its destination', async () => {
  const native = installAndroidTray();
  native.getInitialOpen.mockResolvedValue({ userId: 'account-a', kind: 'announcement', sourceId: 'notice' });
  mock(navigationRef.getCurrentRoute).mockReturnValue({ name: 'Login' });
  startListeners(); await syncPushRegistration();
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  mock(navigationRef.getCurrentRoute).mockReturnValue({ name: 'PaidDashboard' });
  await flushPushNavigation();
  expect(navigationRef.navigate).toHaveBeenCalledWith('UpdateDetail', { id: 'notice' });
  await flushPushNavigation();
  expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
});

test('background notification payloads rely on FCM display and never post a duplicate local entry', async () => {
  const native = installAndroidTray(); registerBackgroundPush();
  const background = mock(setBackgroundMessageHandler).mock.calls[0][1];
  await background({ notification: { title: 'ACTIV update', body: 'New update' }, data: { userId: 'account-a' } });
  expect(native.show).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});
