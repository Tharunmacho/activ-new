import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export const APP_PACKAGE = 'in.activ.membership';
export const APP_PLAY_URL = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
// Retain the key so an already-confirmed update survives migration from the
// former admin policy. Only Google's device-specific availability is binding.
export const UPDATE_CACHE_KEY = '@activ_android_update_policy_v1';
interface AvailabilityProof {
  installedVersionCode: number;
  availableVersionCode: number;
}
export interface AppUpdateDecision {
  required: boolean;
  versionCode?: number;
  availableVersionCode?: number;
  checkFailed?: boolean;
}

const positiveCode = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= 2100000000;

export function installedAndroidBuild(): {
  versionCode: number;
  versionName: string;
} | null {
  try {
    const native = NativeModules.AppUpdate;
    if (
      Platform.OS !== 'android' ||
      native?.packageName !== APP_PACKAGE ||
      !positiveCode(native?.versionCode)
    )
      return null;
    return {
      versionCode: native.versionCode,
      versionName: String(native.versionName || ''),
    };
  } catch {
    return null;
  }
}

const deadline = async <T>(operation: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Update check timed out')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
function validProof(
  value: any,
  versionCode: number,
): value is AvailabilityProof {
  return (
    value?.installedVersionCode === versionCode &&
    positiveCode(value?.availableVersionCode) &&
    value.availableVersionCode > versionCode
  );
}

async function performCheck(): Promise<AppUpdateDecision> {
  const build = installedAndroidBuild();
  if (!build) return { required: false };
  const native = NativeModules.AppUpdate;
  // A server toggle or minimum version cannot prove that this device can
  // install a release. Check Play directly and keep only its confirmed result.
  const [cachedResult, playResult] = await Promise.allSettled([
    deadline(AsyncStorage.getItem(UPDATE_CACHE_KEY), 2000),
    deadline(
      Promise.resolve().then(() => {
        if (typeof native?.checkAvailability !== 'function')
          throw new Error('Play check unavailable');
        return native.checkAvailability() as Promise<{
          available: boolean;
          availableVersionCode: number;
        }>;
      }),
      5000,
    ),
  ]);
  let proof: AvailabilityProof | undefined;
  if (cachedResult.status === 'fulfilled' && cachedResult.value) {
    try {
      const raw = JSON.parse(cachedResult.value);
      const packageName = raw?.packageName ?? raw?.policy?.packageName;
      if (
        packageName === APP_PACKAGE &&
        validProof(raw?.proof, build.versionCode)
      )
        proof = raw.proof;
    } catch {
      /* Corrupt storage never creates an update requirement. */
    }
  }
  let checkFailed = true;
  if (playResult.status === 'fulfilled') {
    const play = playResult.value;
    if (play?.available === false) {
      // Withdrawn rollouts and builds already installed must release the gate.
      proof = undefined;
      checkFailed = false;
    } else if (
      play?.available === true &&
      positiveCode(play.availableVersionCode)
    ) {
      proof =
        play.availableVersionCode > build.versionCode
          ? {
              installedVersionCode: build.versionCode,
              availableVersionCode: play.availableVersionCode,
            }
          : undefined;
      checkFailed = false;
    }
  }
  await deadline(
    AsyncStorage.setItem(
      UPDATE_CACHE_KEY,
      JSON.stringify({
        packageName: APP_PACKAGE,
        ...(proof ? { proof } : {}),
      }),
    ),
    2000,
  ).catch(() => {});
  return {
    required: !!proof,
    versionCode: build.versionCode,
    ...(proof ? { availableVersionCode: proof.availableVersionCode } : {}),
    checkFailed,
  };
}

let inFlight: Promise<AppUpdateDecision> | null = null;
export function checkAppUpdate(): Promise<AppUpdateDecision> {
  if (!inFlight)
    inFlight = performCheck()
      .catch(() => ({
        required: false,
        versionCode: installedAndroidBuild()?.versionCode,
        checkFailed: true,
      }))
      .finally(() => {
        inFlight = null;
      });
  return inFlight;
}
export async function openAppUpdateStore(): Promise<void> {
  try {
    if (
      !installedAndroidBuild() ||
      typeof NativeModules.AppUpdate?.openStore !== 'function'
    )
      throw new Error();
    await NativeModules.AppUpdate.openStore();
  } catch {
    throw new Error(
      'Google Play could not be opened. Please check your connection and try again.',
    );
  }
}
