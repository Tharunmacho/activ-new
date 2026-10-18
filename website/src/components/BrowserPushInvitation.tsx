import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { pushConfigured } from '@/lib/firebasePushConfig';
import { isNativePublicApp } from '@/lib/nativePublicApp';
import { enableBrowserPush, PUSH_EVENT } from '@/services/browserPush';

const LATER = 'activ:push-invitation-later';
const ASKED = 'activ:browser-permission-requested';
const PREFERENCE = 'activ:browser-push-enabled';

/** The browser permission dialog requires an intentional Enable click. */
export default function BrowserPushInvitation() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    const eligible = () => {
      if (!pushConfigured() || isNativePublicApp() || !window.isSecureContext ||
          !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window) ||
          Notification.permission !== 'default' ||
          /^\/(?:admin|super-admin|state-admin|district-admin|block-admin|events-admin|cms|payment|checkout|auth)(?:\/|$)/.test(pathname)) return false;
      try {
        return localStorage.getItem(PREFERENCE) !== 'false' && !sessionStorage.getItem(ASKED) &&
          Number(localStorage.getItem(LATER) || 0) <= Date.now();
      } catch { return true; }
    };
    setVisible(false);
    const refresh = () => { if (active && !working.current && !eligible()) setVisible(false); };
    const timer = setTimeout(() => { if (active) setVisible(eligible()); }, 1200);
    const events = [PUSH_EVENT, 'storage', 'focus'];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => { active = false; clearTimeout(timer); events.forEach(event => window.removeEventListener(event, refresh)); };
  }, [pathname]);
  const later = () => {
    try { localStorage.setItem(LATER, String(Date.now() + 7 * 86400000)); } catch { /* Current visit still dismisses. */ }
    setVisible(false);
  };
  const enable = async () => {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      try { sessionStorage.setItem(ASKED, 'true'); } catch { /* Click guard still applies. */ }
      await enableBrowserPush();
      setVisible(false);
    } catch (cause) {
      if (Notification.permission !== 'granted') setVisible(false);
      else setError(cause instanceof Error ? cause.message : 'Could not connect notifications. Please try again.');
    } finally { working.current = false; setBusy(false); }
  };
  if (!visible) return null;
  return <aside aria-label="Enable ACTIV notifications" className="fixed bottom-4 left-3 right-3 z-[70] mx-auto w-auto max-w-md rounded-2xl border border-blue-100 bg-white p-5 text-slate-900 shadow-xl sm:left-auto sm:right-5 sm:w-96" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
    <div className="flex items-start gap-3">
      <Bell className="mt-1 shrink-0 text-blue-700" size={24} aria-hidden="true" />
      <div className="min-w-0"><h2 className="text-lg font-bold leading-6">Get ACTIV notifications</h2>
        <p className="mt-1 text-base leading-6 text-slate-600">Get event and community updates on your phone or computer, even when this website is closed.</p></div>
    </div>
    {error && <p role="status" className="mt-3 break-words text-sm leading-5 text-amber-800">{error}</p>}
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <button type="button" disabled={busy} onClick={later} className="min-h-11 rounded-xl px-4 py-2 font-semibold text-slate-600 disabled:opacity-60">Not now</button>
      <button type="button" disabled={busy} onClick={() => void enable()} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? 'Connecting…' : error ? 'Try again' : 'Enable notifications'}</button>
    </div>
  </aside>;
}
