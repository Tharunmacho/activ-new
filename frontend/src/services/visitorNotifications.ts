import AsyncStorage from '@react-native-async-storage/async-storage';
import publicApi from './publicApi';

const IDENTITY = '@activ_visitor_push_identity';
const PREFERENCE = '@activ_visitor_push_enabled';
const DETACH_PENDING = '@activ_visitor_push_detach_pending';
export type VisitorIdentity = { id: string; key: string };
export type PublicNotice = { id: string; kind: 'event' | 'announcement'; sourceId: string; title: string; summary: string; body: string; imageUrl: string; createdAt: string };
export const visitorPushEnabled = async () => await AsyncStorage.getItem(PREFERENCE) === 'true';
export const setVisitorPushEnabled = (enabled: boolean) => AsyncStorage.setItem(PREFERENCE, String(enabled));
export async function visitorIdentity(): Promise<VisitorIdentity | null> {
  try { const value = JSON.parse(await AsyncStorage.getItem(IDENTITY) || 'null'); return value?.id && value?.key ? value : null; }
  catch { return null; }
}
async function identity() {
  const existing = await visitorIdentity();
  if (existing) return existing;
  const response = await publicApi.post('/public-notifications/installations', {}, { timeout: 5000 });
  const value = response.data.data as VisitorIdentity;
  await AsyncStorage.setItem(IDENTITY, JSON.stringify(value));
  return value;
}
export async function registerVisitorToken(token: string, platform: string) {
  await retryVisitorDetach();
  for (let attempt = 0; attempt < 2; attempt++) {
    const value = await identity();
    try {
      const response = await publicApi.put('/public-notifications/devices', { token, platform }, { timeout: 5000, headers: { 'x-activ-visitor-key': value.key } });
      return response.data?.data;
    } catch (error: any) {
      if (error?.response?.status !== 401) throw error;
      await AsyncStorage.removeItem(IDENTITY);
      if (attempt) throw error;
    }
  }
}
export async function detachVisitorToken() {
  // Keep revocation intent across app restarts/offline failures. A foreground
  // retry must still run when notifications have already been turned off.
  await AsyncStorage.setItem(DETACH_PENDING, 'true');
  await retryVisitorDetach();
}
export async function retryVisitorDetach() {
  if (await AsyncStorage.getItem(DETACH_PENDING) !== 'true') return;
  const value = await visitorIdentity();
  try {
    if (value) await publicApi.delete('/public-notifications/devices', { timeout: 5000, headers: { 'x-activ-visitor-key': value.key } });
    await AsyncStorage.removeItem(DETACH_PENDING);
  } catch (error: any) {
    if (error?.response?.status !== 401) throw error;
    // An expired/deleted installation no longer owns a server token.
    await AsyncStorage.removeItem(IDENTITY);
    await AsyncStorage.removeItem(DETACH_PENDING);
  }
}
export const getPublicNotices = async (): Promise<PublicNotice[]> => (await publicApi.get('/public-notifications', { timeout: 10000 })).data.data;
export const getPublicNotice = async (id: string): Promise<PublicNotice> => (await publicApi.get('/public-notifications/' + encodeURIComponent(id), { timeout: 10000 })).data.data;
export async function recordVisitorOpen(id: string, channel: 'push' | 'in_app') {
  const value = await visitorIdentity();
  if (!value || !/^[a-f\d]{24}$/i.test(id)) return;
  await publicApi.patch('/public-notifications/' + id + '/open', { channel }, { timeout: 5000, headers: { 'x-activ-visitor-key': value.key } }).catch(() => undefined);
}
