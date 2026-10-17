import { useEffect, useState } from 'react';
import { RefreshCw, Smartphone } from 'lucide-react';
import api, { unwrap } from '@/services/api';
import { errorMessage } from '@/services/activApi';

type Policy = { enabled: boolean; requireLatestAvailable: boolean; minimumVersionCode: number; message: string; updatedAt?: string | null };
const input = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[16px] text-slate-900 disabled:opacity-60';
export default function AppUpdateSettings() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [minimum, setMinimum] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setError('');
    api.get('/app-updates/admin').then(response => {
      const value = unwrap<Policy>(response, null);
      if (!value || !Number.isInteger(value.minimumVersionCode)) throw new Error('Could not load the Android update settings.');
      if (active) { setPolicy({ ...value, requireLatestAvailable: value.requireLatestAvailable !== false }); setMinimum(String(value.minimumVersionCode)); }
    }).catch(cause => { if (active) setError(errorMessage(cause, 'Could not load Android update settings.')); });
    return () => { active = false; };
  }, [attempt]);
  const save = async () => {
    if (!policy || busy) return;
    const value = Number(minimum);
    if (!/^\d+$/.test(minimum) || !Number.isSafeInteger(value) || value < 1 || value > 2100000000) { setError('Enter a valid positive Android build number.'); return; }
    if (policy.enabled && !confirmed) { setError('Confirm that members can get the required release from Google Play.'); return; }
    setBusy(true); setError(''); setSaved(false);
    try {
      const next = unwrap<Policy>(await api.put('/app-updates/admin', { enabled: policy.enabled, requireLatestAvailable: policy.requireLatestAvailable,
        minimumVersionCode: value, message: policy.message.trim(), productionAvailableConfirmed: confirmed }), null);
      if (!next) throw new Error('The settings could not be saved.');
      setPolicy(next); setMinimum(String(next.minimumVersionCode)); setConfirmed(false); setSaved(true);
    } catch (cause) { setError(errorMessage(cause, 'Could not save Android update settings.')); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="app-update-settings-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-[16px] leading-6 sm:p-6">
    <h2 id="app-update-settings-title" className="flex items-center gap-2 text-[22px] font-bold text-slate-900"><Smartphone size={22} className="shrink-0 text-blue-700"/>Android app updates</h2>
    <p className="text-slate-600">Members see an update screen before continuing when Google Play offers their device a required newer build. This applies to app versions that include the update check.</p>
    {!policy && !error ? <p role="status">Loading update settings…</p> : null}
    {policy && <fieldset disabled={busy} className="space-y-4">
      <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={policy.enabled} onChange={event => { setPolicy({ ...policy, enabled: event.target.checked }); setConfirmed(false); setSaved(false); }}/>Require app updates</label>
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" checked={policy.requireLatestAvailable} onChange={event => { setPolicy({ ...policy, requireLatestAvailable: event.target.checked }); setConfirmed(false); setSaved(false); }}/><span>Require every new release available to the member in Google Play<span className="block text-slate-500">Future releases are detected automatically. Staged releases affect members when Play offers them the update.</span></span></label>
      <label className="block space-y-2"><span className="block font-semibold">Minimum Android build number (version code)</span><input aria-label="Minimum Android build number" inputMode="numeric" value={minimum} onChange={event => { setMinimum(event.target.value); setConfirmed(false); setSaved(false); }} className={input}/><span className="block text-slate-500">Use the numeric version code from the Play release. A minimum of 1 adds no extra restriction; automatic updates above still apply.</span></label>
      <label className="block space-y-2"><span className="block font-semibold">Message shown to members</span><textarea aria-label="App update message" value={policy.message} maxLength={300} onChange={event => { setPolicy({ ...policy, message: event.target.value }); setSaved(false); }} className={input} rows={3}/></label>
      {policy.enabled && <label className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-blue-900"><input type="checkbox" aria-label="Required release is available in Google Play" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/><span>I confirm the required release is published and available to members in Google Play.</span></label>}
      <button type="button" onClick={() => void save()} disabled={busy || (policy.enabled && !confirmed)} className="min-h-11 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save update settings'}</button>
    </fieldset>}
    {saved && <p role="status" className="text-emerald-700">Android update settings saved.</p>}
    {error && <div role="alert" className="space-y-2 text-red-700"><p>{error}</p>{!policy && <button type="button" className="inline-flex min-h-11 items-center gap-2 font-semibold" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={18}/>Retry</button>}</div>}
  </section>;
}
