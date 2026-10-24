import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import { deleteToken, getToken, onMessage, onNotificationOpenedApp } from '@react-native-firebase/messaging';
import api, { getAuthToken, getUserData } from '../src/services/api';
import publicApi from '../src/services/publicApi';
import { navigationRef } from '../src/navigation/navigationRef';
import { detachPushDevice, disableVisitorNotifications, syncPushRegistration, usePushNotifications } from '../src/services/pushNotifications';
import { registerVisitorToken, visitorPushEnabled } from '../src/services/visitorNotifications';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn(), delete: jest.fn(), patch: jest.fn() }, getAuthToken: jest.fn(), getUserData: jest.fn() }));
jest.mock('../src/services/publicApi', () => ({ __esModule: true, default: { post: jest.fn(), put: jest.fn(), delete: jest.fn(), patch: jest.fn() } }));
jest.mock('../src/navigation/navigationRef', () => ({ navigationRef: { isReady: jest.fn(() => true), getCurrentRoute: jest.fn(() => ({ name: 'PublicExplore' })), navigate: jest.fn() } }));
const mock = (value: any) => value as jest.Mock;
const storageRead = mock(AsyncStorage.getItem).getMockImplementation()!;
const PREFERENCE = '@activ_visitor_push_enabled';
const IDENTITY = '@activ_visitor_push_identity';
const DETACH = '@activ_visitor_push_detach_pending';
const identity = { id: '507f1f77bcf86cd799439011', key: 'a'.repeat(64) };
const noticeId = '607f1f77bcf86cd799439011';
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const until = async (condition: () => boolean) => { for (let i = 0; i < 200 && !condition(); i++) await Promise.resolve(); expect(condition()).toBe(true); };
let currentAuth: string | null, currentUser: any, cleanup: (() => void) | undefined;
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear(); currentAuth = null; currentUser = null;
  mock(AsyncStorage.getItem).mockImplementation(storageRead);
  NativeModules.ActivNotifications = undefined;
  mock(getAuthToken).mockImplementation(async () => currentAuth); mock(getUserData).mockImplementation(async () => currentUser);
  mock(getApps).mockReturnValue([{}]); mock(getToken).mockResolvedValue('visitor-firebase-token-123456'); mock(deleteToken).mockResolvedValue(undefined);
  mock(publicApi.post).mockResolvedValue({ data: { data: identity } }); mock(publicApi.put).mockResolvedValue({ data: { data: { registered: true } } });
  mock(publicApi.delete).mockResolvedValue({ data: { data: { removed: true } } }); mock(publicApi.patch).mockResolvedValue({ data: { data: { recorded: true } } });
  mock(api.post).mockResolvedValue({ data: { registered: true } }); mock(api.delete).mockResolvedValue({ data: { removed: true } }); mock(api.patch).mockResolvedValue({});
  Platform.OS = 'android'; Object.defineProperty(Platform, 'Version', { configurable: true, get: () => 34 });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true); jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => { cleanup?.(); cleanup = undefined; await detachPushDevice(false); jest.restoreAllMocks(); });
function startListeners() { jest.spyOn(React, 'useEffect').mockImplementation(effect => { cleanup = effect() as (() => void) | undefined; }); usePushNotifications(); }

test('a signed-out installation never opts in or prompts without an explicit action', async () => {
  expect(await syncPushRegistration()).toBe('signed-out');
  expect(getToken).not.toHaveBeenCalled(); expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(publicApi.post).not.toHaveBeenCalled(); expect(await visitorPushEnabled()).toBe(false);
});

test('offline first opt-in retains consent and retries automatically on foreground', async () => {
  mock(publicApi.put).mockRejectedValueOnce(new Error('Offline'));
  expect(await syncPushRegistration(true)).toBe('failed');
  expect(await visitorPushEnabled()).toBe(true);
  expect(await syncPushRegistration()).toBe('enabled');
  expect(publicApi.post).toHaveBeenCalledTimes(1); expect(publicApi.put).toHaveBeenCalledTimes(2);
  expect(api.post).not.toHaveBeenCalled();
});

test.each([{ registered: false }, {}, null])('visitor registration requires a successful API acknowledgement: %j', async result => {
  mock(publicApi.put).mockResolvedValueOnce({ data: { data: result } });
  expect(await syncPushRegistration(true)).toBe('failed');
  expect(await visitorPushEnabled()).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

test('visitor registration cannot claim enabled while notification delivery is unconfigured', async () => {
  mock(publicApi.put).mockResolvedValueOnce({ data: { data: { registered: true, configured: false } } });
  expect(await syncPushRegistration(true)).toBe('unconfigured');
  expect(await visitorPushEnabled()).toBe(true);
  expect(await syncPushRegistration()).toBe('enabled');
});

test('visitor registration retains consent when the provider is configured but not ready', async () => {
  mock(publicApi.put).mockResolvedValueOnce({ data: { data: { registered: true, configured: true, ready: false } } });
  expect(await syncPushRegistration(true)).toBe('unconfigured');
  expect(await visitorPushEnabled()).toBe(true);
  expect(publicApi.delete).not.toHaveBeenCalled();
});

test('a stale installation is replaced after a confirmed 401 without losing consent', async () => {
  await AsyncStorage.setItem(IDENTITY, JSON.stringify({ id: 'old', key: 'old-key' }));
  mock(publicApi.put).mockRejectedValueOnce({ response: { status: 401 } });
  await registerVisitorToken('visitor-firebase-token-123456', 'android');
  expect(publicApi.put).toHaveBeenCalledTimes(2);
  expect(mock(publicApi.put).mock.calls[1][2].headers['x-activ-visitor-key']).toBe(identity.key);
  expect(JSON.parse((await AsyncStorage.getItem(IDENTITY))!)).toEqual(identity);
});

test('offline opt-out persists a revocation and retries it even without Firebase', async () => {
  await syncPushRegistration(true);
  mock(publicApi.delete).mockRejectedValueOnce(new Error('Offline')); mock(deleteToken).mockRejectedValueOnce(new Error('Offline SDK'));
  await disableVisitorNotifications();
  expect(await visitorPushEnabled()).toBe(false); expect(await AsyncStorage.getItem(DETACH)).toBe('true');
  mock(getApps).mockReturnValue([]);
  expect(await syncPushRegistration()).toBe('unconfigured');
  expect(publicApi.delete).toHaveBeenCalledTimes(2); expect(await AsyncStorage.getItem(DETACH)).toBeNull();
  expect(publicApi.put).toHaveBeenCalledTimes(1);
});

test('turning alerts off during accepted registration revokes the late registration', async () => {
  const response = deferred<any>(); mock(publicApi.put).mockReturnValueOnce(response.promise);
  const registration = syncPushRegistration(true);
  await until(() => mock(publicApi.put).mock.calls.length === 1);
  const disable = disableVisitorNotifications();
  response.resolve({ data: { data: { registered: true } } });
  expect(await registration).toBe('signed-out'); await disable;
  expect(await visitorPushEnabled()).toBe(false); expect(publicApi.delete).toHaveBeenCalled();
  mock(publicApi.put).mockClear(); expect(await syncPushRegistration()).toBe('signed-out'); expect(publicApi.put).not.toHaveBeenCalled();
});

test('login during token acquisition blocks anonymous registration and uses account registration next', async () => {
  const token = deferred<string>(); mock(getToken).mockReturnValueOnce(token.promise);
  const registration = syncPushRegistration(true);
  await until(() => mock(getToken).mock.calls.length === 1);
  currentAuth = 'member-session'; currentUser = { id: 'member-id' }; token.resolve('late-visitor-token');
  expect(await registration).toBe('signed-out'); expect(publicApi.put).not.toHaveBeenCalled();
  expect(await syncPushRegistration()).toBe('enabled'); expect(api.post).toHaveBeenCalled();
});

test('visitor alerts and taps require the opted-in installation and stop after login', async () => {
  await syncPushRegistration(true); startListeners(); await syncPushRegistration();
  const receive = mock(onMessage).mock.calls[0][1]; const opened = mock(onNotificationOpenedApp).mock.calls[0][1];
  const data = { audience: 'visitor', visitorId: identity.id, publicNotificationId: noticeId };
  await receive({ data: { ...data, visitorId: 'other-installation' } }); expect(Alert.alert).not.toHaveBeenCalled();
  await receive({ data }); expect(Alert.alert).toHaveBeenCalledTimes(1);
  await opened({ data }); expect(navigationRef.navigate).toHaveBeenCalledWith('PublicNotifications', { id: noticeId });
  await until(() => mock(publicApi.patch).mock.calls.length === 1);
  expect(publicApi.patch).toHaveBeenCalledWith(`/public-notifications/${noticeId}/open`, { channel: 'push' }, expect.any(Object));
  mock(navigationRef.navigate).mockClear(); mock(Alert.alert).mockClear(); currentAuth = 'member-session'; currentUser = { id: 'member-id' };
  await receive({ data }); await opened({ data }); expect(Alert.alert).not.toHaveBeenCalled(); expect(navigationRef.navigate).not.toHaveBeenCalled();
});

test.each(['foreground', 'tap'])('login during visitor preference read suppresses stale %s action', async kind => {
  await syncPushRegistration(true); startListeners(); await syncPushRegistration();
  const read = mock(AsyncStorage.getItem).getMockImplementation()!;
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async key => {
    if (key === PREFERENCE) { currentAuth = 'new-member-session'; currentUser = { id: 'new-member' }; }
    return read(key);
  });
  const handler = mock(kind === 'foreground' ? onMessage : onNotificationOpenedApp).mock.calls[0][1];
  await handler({ data: { audience: 'visitor', visitorId: identity.id, publicNotificationId: noticeId } });
  expect(Alert.alert).not.toHaveBeenCalled(); expect(navigationRef.navigate).not.toHaveBeenCalled();
});

test('turning off alerts cancels an enable action still retrying an earlier revocation', async () => {
  await AsyncStorage.setItem(IDENTITY, JSON.stringify(identity)); await AsyncStorage.setItem(DETACH, 'true');
  const retry = deferred<any>(); mock(publicApi.delete).mockReturnValueOnce(retry.promise);
  const enabling = syncPushRegistration(true);
  await until(() => mock(publicApi.delete).mock.calls.length === 1);
  await disableVisitorNotifications();
  retry.resolve({ data: { data: { removed: true } } });
  expect(await enabling).toBe('signed-out'); expect(publicApi.put).not.toHaveBeenCalled(); expect(await visitorPushEnabled()).toBe(false);
});

test('Android visitor tray alerts and native taps require the current opted-in installation', async () => {
  const native = { areNotificationsEnabled: jest.fn(async () => true), show: jest.fn(async () => true),
    getInitialOpen: jest.fn(async () => null), addListener: jest.fn(), removeListeners: jest.fn() };
  NativeModules.ActivNotifications = native;
  await syncPushRegistration(true); startListeners(); await syncPushRegistration();
  const receive = mock(onMessage).mock.calls[0][1];
  const data = { audience: 'visitor', visitorId: identity.id, publicNotificationId: noticeId, title: 'Community meeting', body: 'Join us at 10 AM on Sunday.' };
  await receive({ data });
  expect(native.show).toHaveBeenCalledWith(noticeId, data.title, data.body, data);
  expect(Alert.alert).not.toHaveBeenCalled();
  DeviceEventEmitter.emit('activ:notification-opened', data);
  await until(() => mock(navigationRef.navigate).mock.calls.length > 0);
  expect(navigationRef.navigate).toHaveBeenCalledWith('PublicNotifications', { id: noticeId });
  native.show.mockClear(); mock(navigationRef.navigate).mockClear();
  await disableVisitorNotifications();
  await receive({ data }); DeviceEventEmitter.emit('activ:notification-opened', data);
  await Promise.resolve(); await Promise.resolve();
  expect(native.show).not.toHaveBeenCalled(); expect(navigationRef.navigate).not.toHaveBeenCalled();
});
