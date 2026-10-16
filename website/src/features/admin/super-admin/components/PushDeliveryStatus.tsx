import { useCallback, useEffect, useState } from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/services/activApi';
import { CARD_TITLE, STAT_FIGURE } from '@/components/layout/appTypography';

export default function PushDeliveryStatus() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/notifications/push/status');
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setStatus(body.data);
    }
    catch { setMessage('Push status could not be loaded. Please try again.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const test = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/notifications/push/test', { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'The test could not be queued.');
      setMessage('Test queued for phones signed in to your Super Admin account.');
      await load();
    } catch (error: any) { setMessage(error?.message || 'The test could not be queued.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm space-y-4" aria-label="Mobile push notifications">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><BellRing className="shrink-0 text-blue-600" /><div>
        <h2 className={`${CARD_TITLE} text-slate-900`}>Mobile push notifications</h2>
        <p className="text-sm text-slate-600">{status ? status.configured ? 'Firebase configured' : 'Firebase setup required' : 'Loading status…'}</p>
      </div></div>
      <button type="button" onClick={() => void load()} className="inline-flex gap-2 items-center rounded-xl border px-3 py-2 text-sm font-semibold"><RefreshCw size={16} />Refresh</button>
    </div>
    {status && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {[[status.devices, 'Registered phones'], [status.queued, 'Queued alerts'], [status.broadcasts, 'Publications processing'], [status.failed, 'Failed alerts']].map(([value, label]) =>
        <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-3"><p className={`${STAT_FIGURE} text-slate-900 [overflow-wrap:anywhere]`}>{value}</p><p className="mt-2 text-ui-caption text-slate-600 break-words">{label}</p></div>)}
    </div>}
    {status?.workerEnabled === false && <p className="text-amber-800">Notification delivery is paused on the server.</p>}
    <p className="text-sm text-slate-600">Sign in to the ACTIV mobile app and allow notifications before testing. Events and updates reach members according to their membership and region.</p>
    <button type="button" onClick={() => void test()} disabled={busy || !status?.configured || !status?.workerEnabled} className="rounded-xl bg-blue-700 px-4 py-3 text-ui-body font-semibold text-white disabled:opacity-50">{busy ? 'Queuing…' : 'Send test to my phones'}</button>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </section>;
}
