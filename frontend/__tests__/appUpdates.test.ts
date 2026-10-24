import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import api from '../src/services/api';
import {
  APP_PACKAGE,
  UPDATE_CACHE_KEY,
  checkAppUpdate,
  installedAndroidBuild,
  openAppUpdateStore,
} from '../src/services/appUpdates';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
const native = {
  versionCode: 26,
  versionName: '1.0.25',
  packageName: APP_PACKAGE,
  checkAvailability: jest.fn(),
  openStore: jest.fn(),
};
const proof = { installedVersionCode: 26, availableVersionCode: 27 };
const setCache = (value: unknown) =>
  AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(value));
const cached = async () =>
  JSON.parse((await AsyncStorage.getItem(UPDATE_CACHE_KEY)) || '{}');
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: 'android',
  });
  NativeModules.AppUpdate = native;
  native.versionCode = 26;
  native.checkAvailability.mockResolvedValue({
    available: true,
    availableVersionCode: 27,
  });
  native.openStore.mockResolvedValue(true);
});

it('automatically requires every genuinely offered newer Play version without a server toggle', async () => {
  await setCache({
    policy: {
      packageName: APP_PACKAGE,
      enabled: false,
      minimumVersionCode: 99,
    },
    proof,
  });
  expect(installedAndroidBuild()?.versionCode).toBe(26);
  expect((await checkAppUpdate()).required).toBe(true);
  expect((await cached()).proof).toEqual(proof);
  expect(api.get).not.toHaveBeenCalled();
  native.versionCode = 27;
  expect((await checkAppUpdate()).required).toBe(false);
  expect((await cached()).proof).toBeUndefined();
  native.checkAvailability.mockResolvedValue({
    available: true,
    availableVersionCode: 28,
  });
  expect((await checkAppUpdate()).required).toBe(true);
});

it('does not block a device for a release that Google Play does not offer', async () => {
  native.checkAvailability.mockResolvedValue({
    available: false,
    availableVersionCode: 0,
  });
  expect((await checkAppUpdate()).required).toBe(false);
  await setCache({ packageName: APP_PACKAGE, proof });
  expect((await checkAppUpdate()).required).toBe(false);
  expect((await cached()).proof).toBeUndefined();
});

it('allows an unconfirmed first launch offline and preserves a confirmed update until installed', async () => {
  native.checkAvailability.mockRejectedValue(
    new Error('Play offline or sideload not owned'),
  );
  expect(await checkAppUpdate()).toMatchObject({
    required: false,
    checkFailed: true,
  });
  await setCache({ packageName: APP_PACKAGE, proof });
  expect(await checkAppUpdate()).toMatchObject({
    required: true,
    availableVersionCode: 27,
    checkFailed: true,
  });
  native.versionCode = 27;
  expect((await checkAppUpdate()).required).toBe(false);
});

it('migrates only confirmed availability from the former manual policy cache', async () => {
  native.checkAvailability.mockRejectedValue(new Error('offline'));
  await setCache({
    policy: {
      packageName: APP_PACKAGE,
      enabled: false,
      minimumVersionCode: 99,
    },
    proof,
  });
  expect((await checkAppUpdate()).required).toBe(true);
  await setCache({
    policy: { packageName: APP_PACKAGE, enabled: true, minimumVersionCode: 99 },
  });
  expect((await checkAppUpdate()).required).toBe(false);
});

it.each([
  { packageName: 'other.app', proof },
  {
    packageName: APP_PACKAGE,
    proof: { installedVersionCode: 25, availableVersionCode: 27 },
  },
  {
    packageName: APP_PACKAGE,
    proof: { installedVersionCode: 26, availableVersionCode: 26 },
  },
  {
    packageName: APP_PACKAGE,
    proof: { installedVersionCode: 26, availableVersionCode: '27' },
  },
])('ignores stale or malformed cached availability %j', async value => {
  native.checkAvailability.mockRejectedValue(new Error('offline'));
  await setCache(value);
  expect((await checkAppUpdate()).required).toBe(false);
});

it('does not infer availability from missing native configuration or malformed Play responses', async () => {
  native.checkAvailability.mockResolvedValue({
    available: true,
    availableVersionCode: 0,
  });
  expect((await checkAppUpdate()).required).toBe(false);
  NativeModules.AppUpdate = undefined;
  expect(installedAndroidBuild()).toBeNull();
  expect((await checkAppUpdate()).required).toBe(false);
});

it('opens the fixed-package native Play action and reports an actionable launch failure', async () => {
  await openAppUpdateStore();
  expect(native.openStore).toHaveBeenCalledWith();
  native.openStore.mockRejectedValue(new Error('No activity'));
  await expect(openAppUpdateStore()).rejects.toThrow(
    'Google Play could not be opened',
  );
});

it('bounds hung Play checks and coalesces concurrent checks without losing confirmed updates', async () => {
  jest.useFakeTimers();
  try {
    native.checkAvailability.mockImplementation(() => new Promise(() => {}));
    const first = checkAppUpdate();
    expect(checkAppUpdate()).toBe(first);
    await jest.advanceTimersByTimeAsync(5000);
    expect((await first).required).toBe(false);
    await setCache({ packageName: APP_PACKAGE, proof });
    const confirmed = checkAppUpdate();
    await jest.advanceTimersByTimeAsync(5000);
    expect((await confirmed).required).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
