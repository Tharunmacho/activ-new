import { useEffect, useMemo, useState } from 'react';
import { Share2, Save, RotateCcw, ExternalLink, Search, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import { errorMessage, type CmsMedia } from '@/services/cmsApi';
import { getSharePreviewEditor, getPublicSharePreview, saveSharePreview, resetSharePreview, type CmsSharePreview } from '@/services/cmsSharePreviewsApi';
import { CmsPage, CmsField, CmsInput, CmsLoading, CmsError, cmsSaved, cmsFailed } from './components/CmsUI';
import MediaPicker from './components/MediaPicker';

export default function SharePreviewsManager() {
    const [routes, setRoutes] = useState<CmsSharePreview[]>([]);
    const [selected, setSelected] = useState('/');
    const [preview, setPreview] = useState<CmsSharePreview | null>(null);
    const [draft, setDraft] = useState<{ title: string; description: string; image: CmsMedia } | null>(null);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [reading, setReading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [imageDirty, setImageDirty] = useState(false);
    const [error, setError] = useState('');

    const apply = (card: CmsSharePreview) => {
        setPreview(card);
        setDraft({ title: card.overrides.title, description: card.overrides.description, image: card.imageSource || card.image });
        setDirty(false); setImageDirty(false);
        setRoutes(current => current.some(row => row.path === card.path)
            ? current.map(row => row.path === card.path ? card : row) : [...current, card]);
    };
    const load = async() => {
        setLoading(true); setError('');
        try { setRoutes((await getSharePreviewEditor()).routes); }
        catch (err) { setError(errorMessage(err, 'Could not load social previews')); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);
    useEffect(() => {
        if (loading || !routes.length) return;
        let active = true;
        setReading(true); setError(''); setPreview(null); setDraft(null);
        getPublicSharePreview(selected).then(card => { if (active) apply(card); })
            .catch(err => { if (active) setError(errorMessage(err, 'Could not load this route')); })
            .finally(() => { if (active) setReading(false); });
        return () => { active = false; };
        // Only route selection reloads; saving updates its existing card.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, loading]);

    const groups = useMemo(() => {
        const result = new Map<string, CmsSharePreview[]>();
        for (const row of routes.filter(row => `${row.label} ${row.path}`.toLowerCase().includes(filter.toLowerCase()) || row.path === selected)) {
            const group = row.group || 'Other public pages';
            result.set(group, [...(result.get(group) || []), row]);
        }
        return result;
    }, [routes, filter, selected]);

    const choose = (path: string) => {
        if (saving || uploading) return;
        if (path === selected) return;
        if (dirty && !window.confirm('Discard unsaved changes for this route?')) return;
        setDirty(false); setSelected(path);
    };
    const submit = async(reset = false) => {
        if (!draft || !preview || uploading) return;
        if (reset && !window.confirm('Reset this route to its default preview?')) return;
        setSaving(true); setError('');
        try {
            apply(reset ? await resetSharePreview(selected) : await saveSharePreview({ path: selected, title: draft.title, description: draft.description, ...(imageDirty ? { image: draft.image } : {}) }));
            cmsSaved('Social preview');
        } catch (err) {
            const message = errorMessage(err, 'Could not save the social preview');
            setError(message); cmsFailed('Social preview', message);
        } finally { setSaving(false); }
    };
    const change = (patch: Partial<NonNullable<typeof draft>>) => {
        setDraft(current => current ? { ...current, ...patch } : current);
        setDirty(true);
    };

    if (loading) return <CmsLoading label="Loading social previews…" />;
    if (!routes.length) return <CmsError message={error || 'No public routes available'} onRetry={load} />;
    return <CmsPage>
        <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm p-5 sm:p-7 space-y-5">
            <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Share2 size={24} /></div>
                <div className="min-w-0"><h2 className="text-2xl sm:text-3xl font-semibold">Social previews</h2>
                    <p className="mt-2 text-slate-500">Choose the image and text shown when someone shares this page on WhatsApp, Facebook, LinkedIn and other platforms.</p>
                </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                <div className="relative"><Search className="absolute left-3 top-4 text-slate-400" size={20} /><CmsInput aria-label="Filter routes" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find a page or route" className="pl-10" /></div>
                <select aria-label="Website route" value={selected} disabled={saving || uploading} onChange={e => choose(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-4 py-3 text-lg">
                    {Array.from(groups).map(([group, rows]) => <optgroup key={group} label={group}>{rows.map(row => <option key={row.path} value={row.path}>{row.label} — {row.path}</option>)}</optgroup>)}
                </select>
            </div>
            <p className="text-sm text-slate-500">Event, news, gallery and zone detail links use their published banner and details automatically.</p>
        </section>
        <CmsError message={error} />
        {reading && <CmsLoading label="Loading this page’s preview…" />}
        {preview && draft && <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 dark:border-neutral-800 p-5 sm:p-7 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0"><h3 className="text-xl sm:text-2xl font-semibold">{preview.label}</h3><p className="text-slate-500 break-all mt-1">{selected}</p></div>
                <a href={selected} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600"><ExternalLink size={18} /> Open page</a>
            </div>
            <fieldset disabled={saving} className="p-5 sm:p-7 grid gap-7">
                <div className="min-w-0 space-y-5">
                    <CmsField label="Preview title" hint="Leave blank to use the page’s own title."><CmsInput aria-label="Preview title" maxLength={200} value={draft.title} placeholder={preview.title} onChange={e => change({ title: e.target.value })} /></CmsField>
                    <CmsField label="Preview description" hint="Leave blank to use the page’s own description."><textarea aria-label="Preview description" maxLength={700} rows={4} value={draft.description} placeholder={preview.description} onChange={e => change({ description: e.target.value })} className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-4 py-3 text-lg" /></CmsField>
                    <MediaPicker label="Preview image" imagesOnly showLayoutControls={false} onUploadStateChange={setUploading} aspect="1200 / 630" value={draft.image} onChange={image => { setImageDirty(true); change({ image }); }} hint="Upload a photo to replace this route’s image. A wide image works best." />
                </div>
                <div className="min-w-0">
                    <p className="mb-3 font-medium text-slate-600 dark:text-slate-300">Link preview</p>
                    <div className="rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden">
                        <img src={resolveMediaUrl(draft.image.url || preview.image.url)} alt={draft.image.alt || preview.title} className="w-full aspect-[1200/630] object-contain bg-slate-100 dark:bg-neutral-900" />
                        <div className="p-5 space-y-2"><p className="text-xs uppercase tracking-wide text-slate-500">activ.org.in</p><p className="text-xl font-semibold break-words">{draft.title || preview.title}</p><p className="text-slate-500 break-words line-clamp-4">{draft.description || preview.description}</p></div>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">Saved changes apply to new preview requests. A platform may keep an older card until it refreshes its cached preview.</p>
                </div>
            </fieldset>
            <div className="border-t border-slate-100 dark:border-neutral-800 px-5 sm:px-7 py-4 flex flex-col-reverse sm:flex-row gap-3 justify-between">
                <button disabled={saving || uploading} type="button" onClick={() => void submit(true)} className="inline-flex justify-center items-center gap-2 rounded-lg border border-slate-200 dark:border-neutral-700 px-5 py-3 disabled:opacity-50"><RotateCcw size={18} /> Reset this route</button>
                <button disabled={saving || uploading || !dirty} type="button" onClick={() => void submit()} className="inline-flex justify-center items-center gap-2 rounded-lg bg-blue-600 text-white px-6 py-3 font-semibold disabled:opacity-50">{saving || uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {uploading ? 'Uploading image…' : saving ? 'Saving…' : 'Save social preview'}</button>
            </div>
        </section>}
    </CmsPage>;
}
