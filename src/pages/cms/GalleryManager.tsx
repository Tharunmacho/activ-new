import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Star, Save, Check, Loader2 } from 'lucide-react';
import {
    getGallery, addGalleryItem, updateGalleryItem, deleteGalleryItem,
    getGallerySettings, updateGallerySettings, errorMessage,
    EMPTY_MEDIA, type GalleryItem, type GallerySettings, type CmsMedia,
} from '@/services/cmsApi';
import { CmsCard, CmsField, CmsInput, CmsTextarea, CmsButton, CmsLoading, CmsError, CmsEmpty } from './components/CmsUI';
import { RepeatableList, LineList, IconPicker } from './components/CmsEditors';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import MediaPicker from './components/MediaPicker';

/**
 * The gallery page: the copy around the grid, and the images in it.
 *
 * Two independent saves. The page copy is a singleton and the images are their
 * own records, so putting them behind one button would mean a failure adding an
 * image discards a heading edit made a minute earlier.
 *
 * Hiding and deleting are separate actions on purpose. Hiding takes an image off
 * the site but keeps it — the usual case is "not right now", not "gone forever"
 * — while delete is permanent and asks first.
 */

const BLANK_ITEM = {
    media: { ...EMPTY_MEDIA } as CmsMedia,
    title: '',
    category: '',
    eventDate: '',
    location: '',
    featured: false,
};

export default function GalleryManager() {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [settings, setSettings] = useState<GallerySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [savingCopy, setSavingCopy] = useState(false);
    const [savedCopy, setSavedCopy] = useState(false);

    const [draft, setDraft] = useState({ ...BLANK_ITEM });
    const [adding, setAdding] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [list, config] = await Promise.all([
                // Includes hidden images: this is the admin grid, and an image
                // you cannot see is an image you cannot un-hide.
                getGallery(true),
                getGallerySettings(),
            ]);
            setItems(list);
            setSettings(config);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the gallery'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const saveCopy = async () => {
        if (!settings) return;
        setSavingCopy(true);
        setSavedCopy(false);
        setError('');
        try {
            setSettings(await updateGallerySettings(settings));
            setSavedCopy(true);
            setTimeout(() => setSavedCopy(false), 2500);
        } catch (err) {
            setError(errorMessage(err, 'Could not save the page copy'));
        } finally {
            setSavingCopy(false);
        }
    };

    /**
     * Media fields are sent flat rather than nested.
     *
     * A file upload goes as multipart, where a nested object would arrive as the
     * string "[object Object]". The server reads `url`/`alt`/`fit`/`position`
     * off the payload root when there is no `media` key, so one flat shape works
     * for both the JSON and the multipart path.
     */
    const flatten = (item: typeof BLANK_ITEM & { visible?: boolean }) => ({
        url: item.media.url,
        alt: item.media.alt,
        fit: item.media.fit,
        position: item.media.position,
        type: item.media.type,
        title: item.title,
        category: item.category,
        eventDate: item.eventDate,
        location: item.location,
        featured: item.featured,
        ...(item.visible === undefined ? {} : { visible: item.visible }),
    });

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draft.media.url) {
            setError('Choose a file or paste a URL first.');
            return;
        }
        setAdding(true);
        setError('');
        try {
            await addGalleryItem(flatten(draft));
            setDraft({ ...BLANK_ITEM, media: { ...EMPTY_MEDIA } });
            await load();
        } catch (err) {
            setError(errorMessage(err, 'Could not add the image'));
        } finally {
            setAdding(false);
        }
    };

    /** Patch one field on one stored item. */
    const patchItem = async (id: string, patch: Record<string, any>) => {
        setBusyId(id);
        setError('');
        try {
            await updateGalleryItem(id, patch);
            await load();
        } catch (err) {
            setError(errorMessage(err, 'Could not update the image'));
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (item: GalleryItem) => {
        if (!window.confirm(`Delete "${item.title || 'this image'}" permanently? Hiding it is reversible; this is not.`)) return;
        setBusyId(item._id);
        try {
            await deleteGalleryItem(item._id);
            await load();
        } catch (err) {
            setError(errorMessage(err, 'Could not delete the image'));
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <CmsLoading label="Loading gallery…" />;

    const categories = settings?.categories || [];
    const featuredCount = items.filter(i => i.featured).length;

    return (
        <div className="space-y-6 max-w-5xl pb-12">
            <CmsError message={error} onRetry={load} />

            {/* ============================================== page copy */}
            {settings && (
                <CmsCard title="Page copy" description="The heading, description and filter chips above the grid.">
                    <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                            <IconPicker
                                value={settings.badgeIcon}
                                onChange={badgeIcon => setSettings({ ...settings, badgeIcon })}
                                label="Badge icon"
                            />
                            <CmsField label="Badge text" hint="The small pill above the heading.">
                                <CmsInput
                                    value={settings.badgeText}
                                    onChange={e => setSettings({ ...settings, badgeText: e.target.value })}
                                    placeholder="Our Gallery"
                                />
                            </CmsField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={settings.heading}
                                    onChange={e => setSettings({ ...settings, heading: e.target.value })}
                                    placeholder="Moments That Tell Our"
                                />
                            </CmsField>
                            <CmsField label="Highlighted word" hint="Rendered in blue at the end of the heading.">
                                <CmsInput
                                    value={settings.headingHighlight}
                                    onChange={e => setSettings({ ...settings, headingHighlight: e.target.value })}
                                    placeholder="Story"
                                />
                            </CmsField>
                        </div>

                        <CmsField label="Description">
                            <CmsTextarea
                                rows={3}
                                value={settings.description}
                                onChange={e => setSettings({ ...settings, description: e.target.value })}
                            />
                        </CmsField>

                        <LineList
                            label="Handwritten note"
                            hint="One line each, shown beside the collage on wide screens. Leave empty to hide it."
                            value={settings.noteLines}
                            onChange={noteLines => setSettings({ ...settings, noteLines })}
                            rows={3}
                            placeholder={'Our Work\nOur People\nOur Impact'}
                        />

                        <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Filter chips</p>
                            <p className="text-xs text-slate-500 mb-3">
                                An "All" chip is always shown first. A chip's label is what an image's
                                category must match for it to appear under that filter.
                            </p>
                            <RepeatableList<{ label: string; icon: string }>
                                items={categories}
                                onChange={next => setSettings({ ...settings, categories: next })}
                                noun="chip"
                                blank={() => ({ label: '', icon: 'image' })}
                                row={(chip, update) => (
                                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
                                        <IconPicker value={chip.icon} onChange={icon => update({ icon })} />
                                        <CmsField label="Label">
                                            <CmsInput
                                                value={chip.label}
                                                onChange={e => update({ label: e.target.value })}
                                                placeholder="Conferences"
                                            />
                                        </CmsField>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-200 dark:border-slate-800 pt-5">
                            <CmsField label="Images before 'view more'" hint="0 shows every image at once.">
                                <CmsInput
                                    type="number" min={0} max={200}
                                    value={String(settings.pageSize)}
                                    onChange={e => setSettings({ ...settings, pageSize: Number(e.target.value) || 0 })}
                                />
                            </CmsField>
                            <CmsField label="'View more' label" hint="Blank hides the button.">
                                <CmsInput
                                    value={settings.viewMoreLabel}
                                    onChange={e => setSettings({ ...settings, viewMoreLabel: e.target.value })}
                                    placeholder="View More Photos"
                                />
                            </CmsField>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Nothing published yet" hint="Shown in place of the grid.">
                                <CmsInput
                                    value={settings.emptyText}
                                    onChange={e => setSettings({ ...settings, emptyText: e.target.value })}
                                    placeholder="No photographs have been published yet."
                                />
                            </CmsField>
                            <CmsField
                                label="Filter matched nothing"
                                hint="Write {category} where the chosen filter should appear."
                            >
                                <CmsInput
                                    value={settings.emptyFilterText}
                                    onChange={e => setSettings({ ...settings, emptyFilterText: e.target.value })}
                                    placeholder="Nothing in {category} yet."
                                />
                            </CmsField>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            disabled={savingCopy}
                            onClick={saveCopy}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500
                                       text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {savingCopy ? <Loader2 size={16} className="animate-spin" />
                                : savedCopy ? <Check size={16} /> : <Save size={16} />}
                            {savingCopy ? 'Saving…' : savedCopy ? 'Saved — live page updated' : 'Save page copy'}
                        </button>
                    </div>
                </CmsCard>
            )}

            {/* ============================================== add an image */}
            <CmsCard title="Add an image" description="Appears at the end of the grid.">
                <form onSubmit={handleAdd} className="space-y-5">
                    {/* 4/3 — the shape of a card in the grid. */}
                    <MediaPicker
                        label="Image or video"
                        aspect="4 / 3"
                        value={draft.media}
                        onChange={media => setDraft({ ...draft, media })}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Title">
                            <CmsInput
                                value={draft.title}
                                onChange={e => setDraft({ ...draft, title: e.target.value })}
                                placeholder="Annual Business Conference 2024"
                            />
                        </CmsField>

                        <CmsField label="Category" hint="Must match a filter chip above to be filterable.">
                            <select
                                value={draft.category}
                                onChange={e => setDraft({ ...draft, category: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700
                                           rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            >
                                <option value="">No category</option>
                                {categories.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                            </select>
                        </CmsField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Date" hint="Free text — shown on the card exactly as typed.">
                            <CmsInput
                                value={draft.eventDate}
                                onChange={e => setDraft({ ...draft, eventDate: e.target.value })}
                                placeholder="20 Jan 2024"
                            />
                        </CmsField>
                        <CmsField label="Location">
                            <CmsInput
                                value={draft.location}
                                onChange={e => setDraft({ ...draft, location: e.target.value })}
                                placeholder="Chennai, India"
                            />
                        </CmsField>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={draft.featured}
                            onChange={e => setDraft({ ...draft, featured: e.target.checked })}
                            className="rounded border-slate-400"
                        />
                        Feature in the collage at the top of the page
                        <span className="text-xs text-slate-500">(the first three featured images are used)</span>
                    </label>

                    <CmsButton type="submit" loading={adding}>
                        <Plus className="w-4 h-4" /> Add to gallery
                    </CmsButton>
                </form>
            </CmsCard>

            {/* ============================================== the images */}
            <CmsCard
                title={`Images (${items.length})`}
                description={
                    featuredCount === 0
                        ? 'No image is featured, so the collage at the top of the page is not shown.'
                        : `${featuredCount} featured — the first three fill the collage at the top of the page.`
                }
            >
                {items.length === 0 ? (
                    <CmsEmpty title="No images yet" hint="The grid is not shown until one is added." />
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={item._id}
                                className={`flex gap-4 border border-slate-200 dark:border-slate-700 rounded-lg p-3
                                            ${item.visible === false ? 'opacity-60' : ''}`}
                            >
                                <div className="w-28 h-20 shrink-0 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                                    <CmsMediaFrame media={item.media} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                        {item.title || 'Untitled'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                                        {[item.category, item.eventDate, item.location].filter(Boolean).join(' · ') || 'No details'}
                                    </p>
                                    {item.visible === false && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Hidden from the site</p>
                                    )}
                                </div>

                                <div className="flex items-start gap-1 shrink-0">
                                    <button
                                        type="button"
                                        disabled={busyId === item._id}
                                        onClick={() => patchItem(item._id, { featured: !item.featured })}
                                        title={item.featured ? 'Remove from the collage' : 'Feature in the collage'}
                                        className={`p-2 rounded transition-colors disabled:opacity-40 ${
                                            item.featured
                                                ? 'text-amber-500 hover:bg-amber-500/10'
                                                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Star size={16} fill={item.featured ? 'currentColor' : 'none'} />
                                    </button>

                                    <button
                                        type="button"
                                        disabled={busyId === item._id}
                                        onClick={() => patchItem(item._id, { visible: item.visible === false })}
                                        title={item.visible === false ? 'Show on the site' : 'Hide from the site'}
                                        className="p-2 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800
                                                   disabled:opacity-40"
                                    >
                                        {item.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={busyId === item._id}
                                        onClick={() => handleDelete(item)}
                                        title="Delete permanently"
                                        className="p-2 rounded text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CmsCard>
        </div>
    );
}
