import { PermissionsAndroid, Platform } from 'react-native';

/** Android 10+ saves our own files with MediaStore and needs no storage prompt. */
export async function ensureDownloadsPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) >= 29) return;
  const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
  if (await PermissionsAndroid.check(permission)) return;
  const result = await PermissionsAndroid.request(permission, {
    title: 'Save to Downloads',
    message: 'Allow ACTIV to save your documents in the Downloads folder on this device.',
    buttonPositive: 'Continue',
    buttonNegative: 'Cancel',
  });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Storage access is needed to save to Downloads on this Android version.');
}
