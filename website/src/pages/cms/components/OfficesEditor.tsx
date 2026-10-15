import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Loader2, MapPin, Plus, Trash2, ExternalLink } from 'lucide-react';
import { previewContactMap, EMPTY_OFFICE, errorMessage, type ContactOffice } from '@/services/cmsApi';
import { getRegionTree } from '@/services/activApi';
import { CmsField, CmsInput, CmsTextarea, CmsChoice, CmsCheck } from './CmsUI';
import { LineList } from './CmsEditors';

/**
 * STATE-WISE OFFICES — CMS → Contact → Contact details.
 *
 * The public Contact page shows these as a switcher, head office first. Each
 * office has its own address, numbers, hours and MAP. The map box takes
 * whatever an editor has to hand — a Google Maps share link, the "Embed a map"
 * code, or just the address — and the preview asks the server what it becomes,
 * the same resolution the save runs, so what shows here is what visitors see.
 */

const newOffice = (order: number): ContactOffice => ({
    ...EMPTY_OFFICE,
    id: `office-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    order,
});

function MapPreview({ input, address }: { input: string; address: string }) {
    const [state, setState] = useState<{ loading: boolean; embedUrl: string; mapLink: string; error: string }>(
        { loading: false, embedUrl: '', mapLink: '', error: '' });
    const seq = useRef(0);

    useEffect(() => {
        const mine = ++seq.current;
        if (!input.trim() && !address.trim()) { setState({ loading: false, embedUrl: '', mapLink: '', error: '' }); return undefined; }
        setState((s) => ({ ...s, loading: true, error: '' }));
        // Debounced: one request per pause in typing.
        const t = window.setTimeout(async () => {
            try {
                const r = await previewContactMap(input, address);
                if (mine === seq.current) setState({ loading: false, embedUrl: r.embedUrl, mapLink: r.mapLink, error: '' });
            } catch (err) {
                if (mine === seq.current) setState({ loading: false, embedUrl: '', mapLink: '', error: errorMessage(err, 'Could not preview the map') });
            }
        }, 600);
        return () => window.clearTimeout(t);
    }, [input, address]);

    return (
        <div className="rounded-xl border border-slate-200 dark:border-[#262626] overflow-hidden">
            <div className="relative aspect-[16/9] bg-slate-50 dark:bg-[#111]">
                {state.embedUrl ? (
                    <iframe key={state.embedUrl} src={state.embedUrl} title="Map preview" loading="lazy"
                        className="absolute inset-0 h-full w-full border-0" referrerPolicy="no-referrer-when-downgrade" />
                ) : (
                    <div className="absolute inset-0 grid place-items-center p-4 text-center text-[1rem] text-slate-500">
                        {state.error || 'Paste a Google Maps link, the “Embed a map” code, or type the address above — the map appears here.'}
                    </div>
                )}
                {state.loading ? (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[0.875rem] text-slate-600 shadow">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
                    </span>
                ) : null}
            </div>
            {state.mapLink ? (
                <a href={state.mapLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 border-t border-slate-200 dark:border-[#262626] px-3 py-2 text-[0.9375rem] font-semibold text-blue-600 hover:underline">
                    <ExternalLink className="h-4 w-4" /> Open this in Google Maps to check the pin
                </a>
            ) : null}
        </div>
    );
}

export default function OfficesEditor({ offices, onChange }: { offices: ContactOffice[]; onChange: (next: ContactOffice[]) => void }) {
    const [states, setStates] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        getRegionTree(false, 'all')
            .then((t) => { if (!cancelled) setStates((t.states || []).map((s: any) => String(s.name || '')).filter(Boolean)); })
            .catch(() => { /* free text still works */ });
        return () => { cancelled = true; };
    }, []);

    const list = offices.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const head = list.find((o) => o.isHeadOffice && o.isActive !== false) || list.find((o) => o.isActive !== false) || null;

    const commit = (next: ContactOffice[]) => onChange(next.map((o, i) => ({ ...o, order: i })));
    const patch = (id: string, p: Partial<ContactOffice>) => commit(list.map((o) => (o.id === id ? { ...o, ...p } : o)));
    const setHead = (id: string) => commit(list.map((o) => ({ ...o, isHeadOffice: o.id === id })));
    const move = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= list.length) return;
        const next = list.slice();
        [next[i], next[j]] = [next[j], next[i]];
        commit(next);
    };
    const remove = (id: string) => {
        const next = list.filter((o) => o.id !== id);
        // Removing the head office hands the title to the first remaining one.
        if (next.length && !next.some((o) => o.isHeadOffice)) next[0] = { ...next[0], isHeadOffice: true };
        commit(next);
    };
    const add = () => commit([...list, { ...newOffice(list.length), isHeadOffice: list.length === 0 }]);

    const name = (o: ContactOffice) => o.label || (o.state ? `${o.state} office` : 'New office');

    return (
        <div className="space-y-5">
            <datalist id="office-states">{states.map((s) => <option key={s} value={s} />)}</datalist>

            {list.length > 1 ? (
                <div>
                    <p className="mb-2 text-ui-caption font-bold text-slate-800 dark:text-neutral-200">Head office</p>
                    <CmsChoice
                        label="Head office"
                        value={head?.id || ''}
                        onChange={setHead}
                        options={list.filter((o) => o.isActive !== false).map((o) => ({
                            value: o.id,
                            icon: <Building2 className="h-4 w-4" />,
                            title: name(o),
                            detail: o.state || 'State not set',
                        }))}
                    />
                    <p className="mt-2 text-[0.9375rem] text-slate-500">
                        Shown first on the Contact page, labelled “Head Office”, and used by the site’s header and footer.
                    </p>
                </div>
            ) : null}

            {list.map((o, i) => (
                <div key={o.id} className="rounded-2xl border border-slate-200 dark:border-[#262626] p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 text-[1.125rem] font-bold text-slate-900 dark:text-neutral-100">
                            {o.isHeadOffice ? <Building2 className="h-5 w-5 text-blue-600" /> : <MapPin className="h-5 w-5 text-slate-400" />}
                            <span className="truncate">{name(o)}</span>
                            {o.isHeadOffice ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.8125rem] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Head office</span> : null}
                            {o.isActive === false ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.8125rem] font-semibold text-slate-500 dark:bg-white/10">Hidden</span> : null}
                        </p>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"
                                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down"
                                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => remove(o.id)} aria-label={`Delete ${name(o)}`}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.9375rem] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 className="h-4 w-4" /> Delete</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="State" hint="The name on the switcher. Suggestions are the states your admins cover; any name is accepted.">
                                <CmsInput list="office-states" value={o.state} onChange={(e) => patch(o.id, { state: e.target.value })} placeholder="Karnataka" />
                            </CmsField>
                            <CmsField label="Label" hint="Optional — e.g. “Head Office” or “Tamil Nadu State Office”.">
                                <CmsInput value={o.label} onChange={(e) => patch(o.id, { label: e.target.value })} placeholder={o.isHeadOffice ? 'Head Office' : `${o.state || 'State'} Office`} />
                            </CmsField>
                        </div>

                        <LineList label="Address" hint="One line per row, as it should appear." value={o.addressLines}
                            onChange={(addressLines) => patch(o.id, { addressLines })} />

                        <div className="grid gap-4 sm:grid-cols-3">
                            <CmsField label="Phone"><CmsInput value={o.phone} onChange={(e) => patch(o.id, { phone: e.target.value })} placeholder="+91 82201 12188" /></CmsField>
                            <CmsField label="Alternate phone" hint="Optional."><CmsInput value={o.alternatePhone} onChange={(e) => patch(o.id, { alternatePhone: e.target.value })} /></CmsField>
                            <CmsField label="WhatsApp" hint="Optional — a number."><CmsInput value={o.whatsapp} onChange={(e) => patch(o.id, { whatsapp: e.target.value })} placeholder="+91 82201 12188" /></CmsField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Email"><CmsInput type="email" value={o.email} onChange={(e) => patch(o.id, { email: e.target.value })} placeholder="info@activ.org.in" /></CmsField>
                            <LineList label="Working hours" value={o.workingHours} rows={3} onChange={(workingHours) => patch(o.id, { workingHours })}
                                placeholder={'Mon - Sat : 9.00 AM - 6.00 PM\nSunday : Closed'} />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <CmsField label="Map" hint="Paste a Google Maps link (a “Share” link works), the “Embed a map” code, or just the address. Leave blank to use the address above.">
                                <CmsTextarea rows={5} value={o.mapInput} onChange={(e) => patch(o.id, { mapInput: e.target.value })}
                                    placeholder={'https://maps.app.goo.gl/…\nor <iframe src="https://www.google.com/maps/embed?pb=…">\nor 6, Ilayaperumal Apartments, Guindy, Chennai'} />
                            </CmsField>
                            <div>
                                <p className="mb-1.5 text-ui-caption font-bold text-slate-800 dark:text-neutral-200">Preview</p>
                                <MapPreview input={o.mapInput} address={o.addressLines.join(', ')} />
                            </div>
                        </div>

                        <CmsCheck
                            checked={o.isActive !== false}
                            onChange={(isActive) => patch(o.id, { isActive })}
                            title="Show this office on the Contact page"
                            detail="Untick to keep it here without showing it."
                        />
                    </div>
                </div>
            ))}

            <button type="button" onClick={add}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-blue-300 px-4 text-ui-caption font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10">
                <Plus className="h-4 w-4" /> Add an office
            </button>
        </div>
    );
}
