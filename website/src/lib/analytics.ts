// The production server supplies Dokploy's runtime setting in the initial HTML.
// Nullish fallback preserves an explicit blank override that disables collection.
const runtimeId = typeof document === 'undefined'
  ? null
  : document.querySelector('meta[name="activ-ga-measurement-id"]')?.getAttribute('content');
const ID = String(runtimeId ?? import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
const KEY = 'activ:analytics-consent';
let loaded = false;
export const analyticsConfigured = () => /^G-[A-Z0-9]+$/.test(ID);
export function analyticsConsent(): string { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
function tag(..._args: any[]) { const w = window as any; w.dataLayer = w.dataLayer || []; w.dataLayer.push(arguments); }
export function setAnalyticsConsent(allow: boolean) {
  try { localStorage.setItem(KEY, allow ? 'granted' : 'denied'); } catch { /* optional */ }
  (window as any)[`ga-disable-${ID}`] = !allow;
  if (loaded) tag('consent', 'update', { analytics_storage: allow ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  if (!allow) { analyticsLogout(); return; }
  startAnalytics();
}
export function startAnalytics() {
  if (loaded || !analyticsConfigured() || analyticsConsent() !== 'granted') return;
  loaded = true;
  tag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  tag('js', new Date());
  tag('config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    page_location: window.location.origin, page_referrer: '', page_title: 'ACTIV' });
  const script = document.createElement('script');
  script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
  document.head.appendChild(script);
}
// Report route families only: no query strings, tokens, member names or booking references.
export function analyticsPage(path: string) {
  startAnalytics();
  if (!loaded || analyticsConsent() !== 'granted') return;
  const family = path.split('/').filter(Boolean)[0] || 'home';
  const allowed = ['home', 'events', 'news', 'gallery', 'schemes', 'member', 'business', 'login', 'register', 'payment', 'membership', 'about', 'contact', 'zones'];
  const page = allowed.includes(family) ? family : 'other';
  tag('event', 'page_view', { page_title: `ACTIV ${page}`, page_location: `${window.location.origin}/${page}`, page_referrer: '' });
}
export function analyticsLogin(user: any) {
  if (!analyticsConfigured() || analyticsConsent() !== 'granted') return;
  startAnalytics();
  const id = String(user?.memberId || user?.id || user?._id || '');
  tag('set', { user_id: /^[a-f\d]{24}$/i.test(id) ? id : null });
  tag('event', 'login', { method: ['google', 'facebook', 'linkedin'].includes(user?.loginMethod) ? user.loginMethod : 'password', page_location: window.location.origin, page_referrer: '' });
}
export function analyticsLogout() { if (loaded) tag('set', { user_id: null }); }
