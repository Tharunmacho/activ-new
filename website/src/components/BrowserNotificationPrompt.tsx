import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { enableBrowserPush, pushEnabled } from '@/services/browserPush';
import { pushConfigured } from '@/lib/firebasePushConfig';
const DISMISSED = 'activ:notification-prompt-dismissed';

export default function BrowserNotificationPrompt() {
  const { pathname } = useLocation();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (/\/(super-admin|admin|state-admin|district-admin|block-admin|cms)(\/|$)/.test(pathname)) { setShow(false); return; }
    const timer = setTimeout(() => {
      try { setShow(pushConfigured() && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator
        && 'PushManager' in window && Notification.permission === 'default' && !pushEnabled() && !localStorage.getItem(DISMISSED)); } catch { setShow(false); }
    }, 1500);
    return () => clearTimeout(timer);
  }, [pathname]);
  const later = () => { localStorage.setItem(DISMISSED, 'true'); setShow(false); };
  const allow = async () => {
    setBusy(true); setError('');
    try { await enableBrowserPush(); localStorage.setItem(DISMISSED, 'true'); setShow(false); }
    catch (cause) {
      if (Notification.permission === 'denied') later();
      else setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally { setBusy(false); }
  };
  if (!show) return null;
  return <aside aria-label="Enable ACTIV notifications" className="fixed bottom-5 left-4 right-4 z-[80] mx-auto max-w-md rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl sm:left-auto sm:right-6">
    <h2 className="flex items-center gap-2 text-ui-body font-bold text-slate-900"><BellRing className="h-5 w-5 text-blue-600" />Stay updated with ACTIV</h2>
    <p className="mt-2 text-ui-caption text-slate-600">Allow notifications for events and community updates. You can turn them off in your browser settings.</p>
    {!!error && <p role="status" className="mt-2 text-ui-caption text-amber-700">{error}</p>}
    <div className="mt-4 flex gap-3"><button disabled={busy} onClick={() => void allow()} className="min-h-11 flex-1 rounded-xl bg-blue-700 px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Connecting…' : 'Allow notifications'}</button>
      <button onClick={later} className="min-h-11 rounded-xl border border-slate-200 px-4 font-semibold text-slate-600">Later</button></div>
  </aside>;
}
