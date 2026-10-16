import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { browserPushStatus, enableBrowserPush, disableBrowserPush, pushEnabled, PUSH_EVENT } from '@/services/browserPush';

export default function BrowserPushSettings() {
  const [message, setMessage] = useState('Checking notification settings…');
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { setEnabled(pushEnabled()); void browserPushStatus().then(value => { if (active) setMessage(value); }).catch(() => { if (active) setMessage('Browser storage is unavailable. Please check your browser settings.'); }); };
    refresh(); window.addEventListener(PUSH_EVENT, refresh);
    return () => { active = false; window.removeEventListener(PUSH_EVENT, refresh); };
  }, []);
  const change = async (enable: boolean) => {
    setBusy(true);
    try {
      if (enable) await enableBrowserPush(); else await disableBrowserPush();
      setMessage(await browserPushStatus());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update notifications. Please try again.'); }
    finally { setEnabled(pushEnabled()); setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Browser notifications">
    <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900"><BellRing className="h-5 w-5 text-blue-700" />Browser notifications</h2>
    <p role="status" className="text-sm leading-6 text-slate-600">{message}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void change(true)} className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Updating…' : enabled ? 'Check notification connection' : 'Enable notifications'}</button>
      {enabled && <button type="button" disabled={busy} onClick={() => void change(false)} className="min-h-11 rounded-xl border px-4 py-2 font-semibold disabled:opacity-50">Turn off for this browser</button>}
    </div>
  </section>;
}
