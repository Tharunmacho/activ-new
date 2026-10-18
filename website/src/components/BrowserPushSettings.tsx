import { useEffect, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { browserPushRegistered, browserPushSubscribed, browserPushStatus, enableBrowserPush, disableBrowserPush, PUSH_EVENT } from '@/services/browserPush';
import { pushConfigured } from '@/lib/firebasePushConfig';
import { SESSION_EVENT } from '@/services/api';

export default function BrowserPushSettings({ administrator = false }: { administrator?: boolean }) {
  const [message, setMessage] = useState('Checking notification settings…');
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const refreshVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const version = ++refreshVersion.current;
      try {
        const [registered, saved, status] = await Promise.all([browserPushRegistered(true), browserPushSubscribed(true), browserPushStatus(true)]);
        if (active && version === refreshVersion.current) { setEnabled(registered); setSubscribed(saved); if (!working.current) setMessage(status); }
      } catch { if (active && version === refreshVersion.current) { setEnabled(false); setSubscribed(false); if (!working.current) setMessage('Browser storage is unavailable. Please check your browser settings.'); } }
    };
    const events = [PUSH_EVENT, SESSION_EVENT, 'storage', 'focus'];
    void refresh(); events.forEach(event => window.addEventListener(event, refresh));
    return () => { active = false; events.forEach(event => window.removeEventListener(event, refresh)); };
  }, []);
  const change = async (enable: boolean) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      if (enable) await enableBrowserPush(true); else await disableBrowserPush();
      setMessage(await browserPushStatus(true));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update notifications. Please try again.'); }
    finally { refreshVersion.current++; setEnabled(await browserPushRegistered(true).catch(() => false)); setSubscribed(await browserPushSubscribed(true).catch(() => false)); working.current = false; setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Browser notifications">
    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><BellRing className="h-5 w-5 text-blue-700" />Browser notifications</h2>
    <p role="status" className="text-sm leading-6 text-slate-600">{administrator && !pushConfigured()
      ? 'Browser notifications are not configured in this website build. Add the Firebase web settings to the website environment in Dokploy, then rebuild and deploy the website.'
      : message}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !pushConfigured()} onClick={() => void change(true)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Updating…' : enabled || subscribed ? 'Check notification connection' : 'Enable notifications'}</button>
      {subscribed && <button type="button" disabled={busy} onClick={() => void change(false)} className="min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:opacity-50">Turn off for this browser</button>}
    </div>
  </section>;
}
