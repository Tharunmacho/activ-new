import { useEffect, useId, useRef, useState } from 'react';
import { BellRing } from 'lucide-react';
import { browserPushSubscribed, browserPushStatus, enableBrowserPush, disableBrowserPush, PUSH_EVENT } from '@/services/browserPush';
import { pushConfigured } from '@/lib/firebasePushConfig';
import { SESSION_EVENT } from '@/services/api';

export default function BrowserPushSettings({ administrator = false }: { administrator?: boolean }) {
  const [message, setMessage] = useState('Checking notification settings…');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const statusId = useId();
  const working = useRef(false);
  const refreshVersion = useRef(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const version = ++refreshVersion.current;
      try {
        const [saved, status] = await Promise.all([browserPushSubscribed(true), browserPushStatus(true)]);
        if (active && version === refreshVersion.current) { setSubscribed(saved); if (!working.current) setMessage(status); }
      } catch { if (active && version === refreshVersion.current) { setSubscribed(false); if (!working.current) setMessage('Browser storage is unavailable. Please check your browser settings.'); } }
      finally { if (active && version === refreshVersion.current) setChecking(false); }
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
    finally { refreshVersion.current++; setSubscribed(await browserPushSubscribed(true).catch(() => false)); working.current = false; setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Browser notifications">
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex min-w-0 items-center gap-2 text-xl font-semibold text-slate-900"><BellRing aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700" />Browser notifications</h2>
      <div className="flex shrink-0 items-center gap-2">
        <span aria-hidden="true" className="text-sm font-semibold text-slate-600">{subscribed ? 'On' : 'Off'}</span>
        <button type="button" role="switch" aria-label="Browser notifications" aria-checked={subscribed} aria-describedby={statusId} aria-busy={busy}
          disabled={busy || checking || (!subscribed && !pushConfigured())} onClick={() => void change(!subscribed)}
          className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          <span aria-hidden="true" className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${subscribed ? 'bg-blue-700' : 'bg-slate-300'}`}>
            <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${subscribed ? 'translate-x-5' : 'translate-x-0'}`} />
          </span>
        </button>
      </div>
    </div>
    <p id={statusId} role="status" className="text-sm leading-6 text-slate-600">{busy ? 'Updating notifications…' : administrator && !pushConfigured()
      ? 'Browser notifications are not configured in this website build. Add the Firebase web settings to the website environment in Dokploy, then rebuild and deploy the website.'
      : message}</p>
  </section>;
}
