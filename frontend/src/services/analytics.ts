import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import { getAnalytics, logEvent, setAnalyticsCollectionEnabled, setConsent, setUserId } from '@react-native-firebase/analytics';
const KEY = '@activ_usage_analytics';
let enabled = false;
const ready = () => getApps().length > 0;
export const analyticsAllowed = async () => (await AsyncStorage.getItem(KEY)) === 'true';
export async function setAnalyticsAllowed(value: boolean) {
  enabled = value;
  await AsyncStorage.setItem(KEY, String(value));
  if (!ready()) return;
  try {
    const a = getAnalytics();
    await setConsent(a, { analyticsStorage: value, adStorage: false, adUserData: false, adPersonalization: false });
    await setAnalyticsCollectionEnabled(a, value);
    if (!value) await setUserId(a, null);
  } catch { /* Analytics must never affect app functionality. */ }
}
export async function initAnalytics() { await setAnalyticsAllowed(await analyticsAllowed()); }
export async function analyticsLogin(user: any) {
  if (!enabled || !ready()) return;
  try {
    const id = String(user?.memberId || user?.id || user?._id || '');
    await setUserId(getAnalytics(), /^[a-f\d]{24}$/i.test(id) ? id : null);
    const method = ['google', 'facebook', 'linkedin'].includes(user?.loginMethod) ? user.loginMethod : 'password';
    await logEvent(getAnalytics(), 'login', { method });
  } catch { /* optional */ }
}
export async function analyticsLogout() {
  if (ready()) await setUserId(getAnalytics(), null).catch(() => undefined);
}
export async function trackScreen(name?: string) {
  if (!enabled || !ready() || !name || !/^[a-zA-Z0-9_]+$/.test(name)) return;
  try { await logEvent(getAnalytics(), 'screen_view', { screen_name: name, screen_class: name }); } catch { /* optional */ }
}
