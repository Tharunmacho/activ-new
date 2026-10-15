import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import {
    getAssociationUpdatePreferences, saveAssociationUpdatePreference, UnconfirmedUpdatePreferencesError,
    type AssociationUpdateChannel, type AssociationUpdatePreferences as Preferences,
} from '@/services/associationUpdatePreferences';
import { errorMessage } from '@/services/activApi';
const preferenceError = (error: unknown, fallback: string) => error instanceof UnconfirmedUpdatePreferencesError ? error.message : errorMessage(error, fallback);

export default function AssociationUpdatePreferences() {
    const [preferences, setPreferences] = useState<Preferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const mounted = useRef(false);
    const pending = useRef(false);
    const load = useCallback(async () => {
        if (pending.current) return;
        pending.current = true; setLoading(true); setError(''); setSaved(false);
        try {
            const result = await getAssociationUpdatePreferences();
            if (mounted.current) setPreferences(result);
        } catch (err) {
            if (mounted.current) setError(preferenceError(err, 'Could not load your update preferences.'));
        } finally {
            pending.current = false;
            if (mounted.current) setLoading(false);
        }
    }, []);
    useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
    const change = async (channel: AssociationUpdateChannel, enabled: boolean) => {
        if (pending.current || !preferences || preferences[channel] === enabled) return;
        if (channel === 'whatsapp' && enabled && !(preferences.whatsappNumber || '').trim()) return;
        pending.current = true; setSaving(true); setError(''); setSaved(false);
        try {
            const result = await saveAssociationUpdatePreference(channel, enabled);
            if (mounted.current) { setPreferences(result); setSaved(true); }
        } catch (err) {
            if (mounted.current) setError(preferenceError(err, 'Could not save your preference. Please reload and try again.'));
        } finally {
            pending.current = false;
            if (mounted.current) setSaving(false);
        }
    };
    const phone = String(preferences?.whatsappNumber || '').trim();
    const row = (channel: AssociationUpdateChannel, title: string, description: string) => <label className="flex min-w-0 items-center justify-between gap-4 py-4">
        <span className="min-w-0"><span className="block text-base font-semibold text-slate-900">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-600">{description}</span></span>
        <input type="checkbox" role="switch" aria-label={`${channel === 'email' ? 'Email' : 'WhatsApp'} association updates`}
            checked={preferences?.[channel] === true} onChange={event => void change(channel, event.target.checked)}
            disabled={saving || !!error || (channel === 'whatsapp' && !phone && !preferences?.whatsapp)}
            className="h-6 w-6 shrink-0 cursor-pointer accent-blue-600 disabled:cursor-not-allowed disabled:opacity-50" />
    </label>;
    return <section aria-labelledby="association-update-preferences-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><BellRing className="h-5 w-5" /></span>
            <div><h2 id="association-update-preferences-title" className="text-xl font-semibold text-slate-900">Association updates</h2><p className="mt-1 text-base leading-relaxed text-slate-600">Choose how ACTIV sends updates for your membership and region.</p></div>
        </div>
        {loading ? <p role="status" className="flex items-center gap-2 py-5 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading your preferences…</p> : null}
        {!loading && preferences ? <div className="mt-2 divide-y divide-slate-100">
            {row('email', 'Email updates', 'Receive association updates at your account email.')}
            {row('whatsapp', 'WhatsApp updates', phone
                ? `By turning this on, you agree to receive association updates on WhatsApp at ${phone}. You can turn it off at any time.`
                : 'Save a WhatsApp number in your profile before enabling these updates.')}
        </div> : null}
        {saving ? <p role="status" className="text-sm text-slate-600">Saving your preference…</p> : null}
        {saved ? <p role="status" className="text-sm text-emerald-700">Your update preferences have been saved.</p> : null}
        {error ? <div className="mt-3 rounded-xl bg-rose-50 p-3"><p role="alert" className="text-sm leading-relaxed text-rose-800">{error}</p>
            <button type="button" onClick={() => void load()} disabled={loading || saving} className="mt-1 min-h-11 text-sm font-semibold text-blue-700 disabled:opacity-50">Reload preferences</button>
        </div> : null}
        <p className="mt-3 text-sm leading-relaxed text-slate-500">These choices apply to association updates. Your in-app updates and essential account messages remain available.</p>
    </section>;
}
