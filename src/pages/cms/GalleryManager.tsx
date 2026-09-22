import { useEffect, useMemo, useState } from 'react';
import {
    Plus, Trash2, Eye, EyeOff, Star, Save, Check, Loader2,
    Home, Pencil, X, ExternalLink, ArrowUpToLine, Search, Images,
} from 'lucide-react';
import {
    getGallery, addGalleryItem, updateGalleryItem, deleteGalleryItem,
    getGallerySettings, updateGallerySettings, errorMessage,
    EMPTY_MEDIA, type GalleryItem, type GallerySettings, type CmsMedia,
} from '@/services/cmsApi';
import {
    CmsCard,
    CmsField,
    CmsInput,
    CmsTextarea,
    CmsButton,
    CmsLoading,
    CmsError,
    CmsEmpty,
    cmsSaved,
    cmsDone,
    cmsFailed,
    cmsDeleted,
    CmsPage,
    CmsSection,
    CmsStep,
    CmsSteps,
    CmsCheck,
    CmsBlock,
    SectionToolsProvider,
} from './components/CmsUI';
import { RepeatableList, LineList, IconPicker , ExtraFieldsEditor } from './components/CmsEditors';
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
 *
 * FIVE STATES PER IMAGE, and they are deliberately independent:
 *
 *   visible     on the site at all. Off removes it everywhere.
 *   showOnHome  rides in the landing page's banner, newest first. On by
 *               default, so posting an event here is all it takes to put it on
 *               the home page; off keeps it on the gallery page only.
 *   pinned      leads BOTH surfaces — the banner and the gallery grid — so the
 *               event you want seen first is seen first everywhere.
 *   featured    fills one of the three collage frames on the gallery page.
 *   description the write-up on the item's own page, which is where clicking a
 *               poster — on the landing page or in the grid — goes.
 */

/**
 * One gallery item as the editor works on it.
 *
 * The same shape backs the "add" form and the edit panel on a stored row, so
 * the fields are written once and both places stay in step — the failure this
 * avoids is a field that can be set when adding and then never changed again.
 */
interface ItemDraft {
    media: CmsMedia;
    title: string;
    caption: string;
    category: string;
    /** The industry. The gallery's second dropdown is built from these. */
    sector: string;
    eventDate: string;
    location: string;
    /** The write-up on the item's own page. */
    description: string;
    /** Bullet points beside the write-up, one per line. */
    highlights: string[];
    /** Further photographs, under the poster on its page. */
    photos: CmsMedia[];
    /** Fields the editor named themselves. */
    customFields: { label: string; value: string }[];
    featured: boolean;
    /** Leads both the banner and the gallery grid. */
    pinned: boolean;
    /** Rides in the landing page banner. */
    showOnHome: boolean;
    visible?: boolean;
}

const BLANK_ITEM: ItemDraft = {
    media: { ...EMPTY_MEDIA } as CmsMedia,
    title: '',
    caption: '',
    category: '',
    sector: '',
    eventDate: '',
    location: '',
    description: '',
    highlights: [],
    photos: [],
    customFields: [],
    featured: false,
    pinned: false,
    // On by default, matching the server: posting to the gallery is what puts
    // an event on the landing page, and needing to remember a second switch is
    // how a poster ends up published and invisible.
    showOnHome: true,
};

/**
 * The states one image can be in, as the list offers them.
 *
 * `nowrite` is not a state anybody sets — it is the one an image falls
 * into by being posted and never written up, which is exactly the queue an
 * editor needs and the one a flat list cannot show.
 */
type ItemView = 'all' | 'home' | 'featured' | 'pinned' | 'hidden' | 'nowrite';

/** How many rows the list opens on. “Show more” adds another page. */
const PAGE = 12;

/**
 * Is this image in that state?
 *
 * `!== false` and not `=== true` throughout: rows written before a flag
 * existed carry no value, and the server reads those as on. Asking for
 * `true` here would file every one of them under the opposite chip.
 */
const inView = (item: GalleryItem, v: ItemView): boolean => {
    if (v === 'all') return true;
    if (v === 'hidden') return item.visible === false;
    if (v === 'featured') return !!item.featured;
    if (v === 'pinned') return !!item.pinned;
    if (v === 'nowrite') return !(item.description || '').trim();
    return item.showOnHome !== false && item.visible !== false;
};

/**
 * Everything an editor might recognise the image by.
 *
 * The title is the obvious one and often the one they do NOT remember — a
 * photograph is “the Coimbatore one” or “the textiles one”, so the place,
 * the sector, the category and the date are all searched too.
 */
const haystack = (item: GalleryItem) => [
    item.title, item.caption, item.category, item.sector,
    item.location, item.eventDate, item.description,
].filter(Boolean).join(' ').toLowerCase();

/** A stored item, read back into the draft shape the form works on. */
const toDraft = (item: GalleryItem): ItemDraft => ({
    media: { ...EMPTY_MEDIA, ...(item.media || {}) },
    title: item.title || '',
    caption: item.caption || '',
    category: item.category || '',
    sector: item.sector || '',
    eventDate: item.eventDate || '',
    location: item.location || '',
    description: item.description || '',
    highlights: item.highlights || [],
    photos: (item.photos || []).map(p => ({ ...EMPTY_MEDIA, ...(p || {}) })),
    customFields: (item.customFields || []).map(f => ({ label: f.label || '', value: f.value || '' })),
    featured: !!item.featured,
    pinned: !!item.pinned,
    // Rows written before the field existed have no value, and they are the
    // ones already on the site — so absent reads as on, as it does server-side.
    showOnHome: item.showOnHome !== false,
    visible: item.visible,
});

/**
 * Every field of one item.
 *
 * Extracted rather than duplicated: the add form and the edit panel are the
 * same form against different state.
 */
function ItemFields({ value, onChange, categories }: {
    value: ItemDraft;
    onChange: (next: ItemDraft) => void;
    categories: { label: string; icon: string }[];
}) {
    const set = (patch: Partial<ItemDraft>) => onChange({ ...value, ...patch });

    return (
        <div className="space-y-5">
            <CmsSection
                title="The picture"
                hint="Shown at 4:3 — the shape of a card in the grid. A video file works too."
            >
                <MediaPicker
                    label=""
                    aspect="4 / 3"
                    value={value.media}
                    onChange={media => set({ media })}
                />
            </CmsSection>

            <CmsSection
                title="What it is"
                hint="How it is labelled in the grid and filtered. Every one of these can be left blank."
            >
            <div className="grid gap-4 sm:grid-cols-2">
                <CmsField label="Title" onClear={() => set({ title: '' })} canClear={!!value.title}>
                    <CmsInput
                        value={value.title}
                        onChange={e => set({ title: e.target.value })}
                        placeholder="Annual Business Conference 2024"
                    />
                </CmsField>

                <CmsField
                    label="Category"
                    hint="Must match a filter chip above to be filterable."
                    onClear={() => set({ category: '' })}
                    canClear={!!value.category}
                >
                    <select
                        value={value.category}
                        onChange={e => set({ category: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-[#2a2a2a]
                                   rounded-lg px-3 py-2 text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                    >
                        <option value="">No category</option>
                        {categories.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                    </select>
                </CmsField>

                {/*
                  * THE SECOND DROPDOWN ON THE GALLERY, and it had no editor.
                  *
                  * `sector` is on the record and the filtered gallery offers it
                  * beside Category — so the control existed for the READER and
                  * not for the person supposed to fill it in, and every
                  * photograph on the site has an empty one.
                  *
                  * Free text rather than a list: a sector is the association's
                  * own word for an industry and there is no fixed set of them,
                  * which is why the reader's dropdown is built from whatever
                  * the photographs actually carry.
                  */}
                <CmsField
                    label="Sector"
                    hint="The industry this belongs to. Offered as the gallery's second dropdown."
                    onClear={() => set({ sector: '' })}
                    canClear={!!value.sector}
                >
                    <CmsInput
                        value={value.sector || ''}
                        onChange={e => set({ sector: e.target.value })}
                        placeholder="Textiles"
                    />
                </CmsField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <CmsField
                    label="Date"
                    hint="Free text — shown exactly as typed."
                    onClear={() => set({ eventDate: '' })}
                    canClear={!!value.eventDate}
                >
                    <CmsInput
                        value={value.eventDate}
                        onChange={e => set({ eventDate: e.target.value })}
                        placeholder="20 Jan 2024"
                    />
                </CmsField>
                <CmsField label="Location" onClear={() => set({ location: '' })} canClear={!!value.location}>
                    <CmsInput
                        value={value.location}
                        onChange={e => set({ location: e.target.value })}
                        placeholder="Chennai, India"
                    />
                </CmsField>
            </div>
            </CmsSection>

            <CmsSection
                title="The write-up"
                hint="What a visitor reads on the page this photograph opens into.
                      Nothing here is shown in the grid."
            >
            <CmsField
                label="Short caption"
                hint="One line under the title on the item's own page."
                onClear={() => set({ caption: '' })}
                canClear={!!value.caption}
            >
                <CmsInput
                    value={value.caption}
                    onChange={e => set({ caption: e.target.value })}
                    placeholder="Three hundred entrepreneurs, one afternoon."
                />
            </CmsField>

            <CmsField
                label="Full details"
                hint="What a visitor reads after clicking the poster. Blank lines start a new paragraph."
                onClear={() => set({ description: '' })}
                canClear={!!value.description}
            >
                <CmsTextarea
                    rows={7}
                    value={value.description}
                    onChange={e => set({ description: e.target.value })}
                    placeholder={'What the event was, who attended, what came of it.'}
                />
            </CmsField>

            <LineList
                label="Highlights"
                hint="One per line, shown as a ticked list on the item's page. Leave empty to hide it."
                clearable
                value={value.highlights}
                onChange={highlights => set({ highlights })}
                rows={4}
                placeholder={'300+ attendees\n12 speakers\n40 new members'}
            />
            </CmsSection>

            {/*
              The fields above are the ones the LAYOUT knows: the date and the
              place have their own icons on the page, the title is the heading.
              These are the editor's own — name them whatever this event needs.
            */}
            <CmsSection
                title="Your own fields"
                hint="Add anything else worth recording — Chief Guest, Organised by, Sponsors, Attendance.
                      Each one shows as a labelled row on the item's page, in this order. Don't want a field
                      any more? Delete the row. Don't want one of the fields above? Leave it blank and it is
                      not shown at all."
            >
                <RepeatableList<{ label: string; value: string }>
                    items={value.customFields}
                    onChange={customFields => set({ customFields })}
                    noun="field"
                    blank={() => ({ label: '', value: '' })}
                    row={(field, update) => (
                        /* Stacked below `sm` so a long value never pushes the row
                           wider than the card it sits in. */
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-3">
                            <CmsField label="Field name">
                                <CmsInput
                                    value={field.label}
                                    onChange={e => update({ label: e.target.value })}
                                    placeholder="Chief Guest"
                                />
                            </CmsField>
                            <CmsField label="Content">
                                <CmsTextarea
                                    rows={2}
                                    value={field.value}
                                    onChange={e => update({ value: e.target.value })}
                                    placeholder="Hon'ble Minister for Industries"
                                />
                            </CmsField>
                        </div>
                    )}
                />
            </CmsSection>

            <CmsSection
                title="More photographs"
                hint="Shown under the poster on its own page. These do not appear in the grid."
            >
                <RepeatableList<CmsMedia>
                    items={value.photos}
                    onChange={photos => set({ photos })}
                    noun="photograph"
                    blank={() => ({ ...EMPTY_MEDIA })}
                    row={(photo, update) => (
                        <MediaPicker
                            label=""
                            aspect="4 / 3"
                            value={photo}
                            onChange={next => update(next)}
                        />
                    )}
                />
            </CmsSection>

            {/*
              * ==================================================================
              * WHERE IT APPEARS — THREE PLACES, AND ONE OF THEM IS NOT OPTIONAL
              * ==================================================================
              *
              * The gallery page is not a checkbox. Every photograph is on it;
              * that is what being in the gallery means, and there is no field
              * that could turn it off. Stated as a fact rather than offered as
              * an option — the same rule the events editor follows for the
              * half of a pair that is always true.
              *
              * The other two are ADDITIONS, and `CmsCheck` is the control for
              * an addition: a square box, independently on or off, neither one
              * replacing the other. Both on, both off and one of each are all
              * real answers.
              */}
            <CmsSection
                title="Where it appears"
                hint="Tick nothing and it shows on the gallery page only."
            >
                <p className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200
                              dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#0f0f0f] px-3 py-2.5
                              text-[1.125rem] text-slate-600 dark:text-neutral-300">
                    <Images className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span>
                        <strong className="font-semibold text-slate-800 dark:text-neutral-100">
                            On the gallery page, always.
                        </strong>{' '}
                        That is where a photograph lives, and it cannot be turned off here —
                        hide it from the site with the eye on its row instead.
                    </span>
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                    <CmsCheck
                        checked={value.showOnHome}
                        onChange={showOnHome => set({ showOnHome })}
                        icon={<Home className="h-4 w-4" />}
                        title="Also in the landing page banner"
                        detail="Newest first. The slide opens this item's own page."
                    />

                    <CmsCheck
                        checked={value.featured}
                        onChange={featured => set({ featured })}
                        icon={<Star className="h-4 w-4" />}
                        title="Also in the collage on the gallery page"
                        detail="The frames across the top. The first three ticked are the ones used."
                    />
                </div>
            </CmsSection>

            {/*
              * ITS OWN SECTION, because this is not a place.
              *
              * It was the first of the three, under a heading reading "Where it
              * appears" — so an editor scanning for destinations met an
              * ordering first and had no reason to read it as one. It changes
              * the position of this photograph in two places it is already in;
              * it does not put it anywhere new.
              */}
            <CmsSection
                title="Its place in the order"
                hint="Everything else runs newest first."
            >
                <CmsCheck
                    checked={value.pinned}
                    onChange={pinned => set({ pinned })}
                    icon={<ArrowUpToLine className="h-4 w-4" />}
                    title="Show this one first"
                    detail="Leads the gallery grid and the landing banner, ahead of everything else."
                />
            </CmsSection>
        </div>
    );
}

export default function GalleryManager() {
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [settings, setSettings] = useState<GallerySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [savingCopy, setSavingCopy] = useState(false);
    const [savedCopy, setSavedCopy] = useState(false);

    const [draft, setDraft] = useState<ItemDraft>({ ...BLANK_ITEM });
    const [adding, setAdding] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    /**
     * ==================================================================
     * FINDING ONE PHOTOGRAPH AMONG SIXTY-NINE
     * ==================================================================
     *
     * A search box, a set of chips over the states an image can be in, and
     * a page size. The chips carry their own counts, so “nothing is
     * featured” is visible without clicking the chip that proves it — the
     * same treatment the Regions screen gives thirty-six states.
     *
     * `addOpen`: the add form used to be open permanently, between the page
     * copy and the list. It is most of a screen tall, so the photographs
     * an editor came here for started below the fold on every visit.
     */
    const [query, setQuery] = useState('');
    const [view, setView] = useState<ItemView>('all');
    const [shown, setShown] = useState(PAGE);
    const [addOpen, setAddOpen] = useState(false);

    /**
     * The row being edited, and the copy being edited.
     *
     * An inline panel rather than a dialog: the row stays where it is, so an
     * editor working down a long gallery does not lose their place, and there is
     * never a stack of overlays to dismiss.
     */
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<ItemDraft | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    /*
     * ONE FORM AT A TIME.
     *
     * The add form and a row's edit panel were independent, so opening one
     * while the other was up put two nearly identical forms on the screen —
     * one headed “Add to gallery” and one “Update”, both full of fields, and
     * nothing saying which button wrote where.
     *
     * Editing a row closes the add form, and opening the add form closes the
     * row. The draft in the add form survives either way: it is component
     * state, and only `handleAdd` clears it.
     */
    const startEdit = (item: GalleryItem) => {
        setAddOpen(false);
        setEditingId(item._id);
        setEditDraft(toDraft(item));
        setError('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditDraft(null);
    };

    const saveEdit = async () => {
        if (!editingId || !editDraft) return;
        if (!editDraft.media.url) {
            setError('An image or video is required.');
            return;
        }

        setSavingEdit(true);
        setError('');
        try {
            await updateGalleryItem(editingId, flatten(editDraft));
            cmsSaved(editDraft.title || 'Image');
            cancelEdit();
            await load({ quiet: true });
        } catch (err) {
            setError(errorMessage(err, 'Could not save the image'));
        } finally {
            setSavingEdit(false);
        }
    };

    /**
     * `quiet` refetches WITHOUT blanking the screen.
     *
     * The loading flag swaps the whole grid for a spinner. On first open
     * that is right; after a row was switched it throws the editor back to
     * the top of a long page, because the page briefly becomes short enough
     * that the browser clamps the scroll.
     */
    const load = async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
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
            if (!quiet) setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    /* Back to the first page whenever the question changes. Carrying a
       “show more” across a filter change hands the editor sixty rows of a
       list they have just narrowed to four. */
    useEffect(() => { setShown(PAGE); }, [view, query]);

    const saveCopy = async () => {
        if (!settings) return;
        setSavingCopy(true);
        setSavedCopy(false);
        setError('');
        try {
            setSettings(await updateGallerySettings(settings));
            setSavedCopy(true);
            cmsSaved('Gallery copy');
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
    const flatten = (item: ItemDraft) => ({
        url: item.media.url,
        alt: item.media.alt,
        fit: item.media.fit,
        position: item.media.position,
        type: item.media.type,
        title: item.title,
        caption: item.caption,
        category: item.category,
        eventDate: item.eventDate,
        location: item.location,
        description: item.description,
        // Arrays and objects, not flattened: these two only ever travel as JSON
        // (the media above is already uploaded by the picker, so no save from
        // this screen is multipart).
        highlights: item.highlights,
        photos: item.photos.filter(p => p && p.url),
        // A row left completely blank is not a field; the server drops it too.
        customFields: item.customFields.filter(f => f.label || f.value),
        featured: item.featured,
        pinned: item.pinned,
        showOnHome: item.showOnHome,
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
            /*
             * CLOSE IT. The form stayed open on a successful save, emptied of
             * everything that had just been typed into it — which reads as the
             * save having failed and thrown the work away, and the only way to
             * tell otherwise was to scroll past the form to the list.
             *
             * It closes on success only. A failure leaves it open with the
             * draft intact, because the editor has to be able to fix whatever
             * the server objected to.
             */
            setAddOpen(false);
            /* “Added”, not “saved”. The form has just closed, so the toast is
               the only thing that says the photograph went anywhere. */
            cmsDone(
                draft.title
                    ? `“${draft.title}” added to the gallery`
                    : 'Added to the gallery',
                'It is at the end of the grid. Use Edit on its row to change it.',
            );
            await load({ quiet: true });
        } catch (err) {
            setError(errorMessage(err, 'Could not add the image'));
        } finally {
            setAdding(false);
        }
    };

    /** Patch one field on one stored item. */
    /**
     * One field on one row — the banner switch, hide, pin, feature.
     *
     * Patched IN PLACE rather than refetched. The refetch was correct and
     * cost the editor their place on the page every time they used it: the
     * grid unmounted, the page collapsed to a spinner, and the scroll came
     * back at the top. Nothing here needs the server's answer — the write
     * either succeeded, in which case the row now holds what was sent, or
     * it threw and the row is untouched.
     */
    /* `Partial<GalleryItem>`, not `Record<string, any>`: every caller sends
       one or two real fields of a gallery item, and `any` turned off the
       check that they are spelled the way the server reads them — which is
       precisely the mistake that fails silently here. */
    const patchItem = async (id: string, patch: Partial<GalleryItem>) => {
        setBusyId(id);
        setError('');
        try {
            await updateGalleryItem(id, patch);
            setItems((list) => list.map((i) => (i._id === id ? { ...i, ...patch } : i)));
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
            cmsDeleted(item.title || 'Image');
            // Dropped from the list rather than refetched, for the same
            // reason `patchItem` patches: a reload loses the scroll.
            setItems((list) => list.filter((i) => i._id !== item._id));
        } catch (err) {
            setError(errorMessage(err, 'Could not delete the image'));
        } finally {
            setBusyId(null);
        }
    };

    /*
     * ABOVE the early return, and it has to be: two of these are
     * `useMemo`, and a hook that runs on a loaded render but not on a
     * loading one changes the hook count between renders of the same
     * component, which React throws on.
     */
    const categories = settings?.categories || [];
    // `!== false`, not `=== true`: rows written before the flag existed have no
    // value and are on the landing page, which is what the server does too.

    /**
     * The chips, each carrying the number of images behind it.
     *
     * The count is the point. “Featured 0” answers “why is the collage
     * empty” from the list itself, which is a question that previously
     * needed the public page open in another tab to ask.
     */
    const chips = useMemo(() => ([
        { key: 'all' as ItemView, label: 'All images' },
        { key: 'home' as ItemView, label: 'In the landing banner' },
        { key: 'featured' as ItemView, label: 'In the collage' },
        { key: 'pinned' as ItemView, label: 'Shown first' },
        { key: 'hidden' as ItemView, label: 'Hidden' },
        { key: 'nowrite' as ItemView, label: 'No write-up' },
    ].map(c => ({ ...c, count: items.filter(i => inView(i, c.key)).length }))), [items]);

    const featuredCount = chips.find(c => c.key === 'featured')?.count || 0;
    const onHomeCount = chips.find(c => c.key === 'home')?.count || 0;

    /* The chip and the search box narrow together — a search inside the
       chip you are standing on, not a search that quietly leaves it. */
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return items.filter(i => inView(i, view)
            && (!needle || haystack(i).includes(needle)));
    }, [items, view, query]);

    const shownItems = filtered.slice(0, shown);

    if (loading) return <CmsLoading label="Loading gallery…" />;

    return (
        <CmsPage>
            <CmsError message={error} onRetry={load} />

            {/* ============================================== page copy */}
            {settings && (
                <CmsCard
                    title="The gallery page"
                    description="Everything the page says around the photographs — and the labels on the page one photograph opens into."
                >
                    <SectionToolsProvider
                        value={{
                            sections: settings.sections || [],
                            onChange: (sections) => setSettings({ ...settings, sections }),
                        }}
                    >
                    {/*
                      * TWO PAGES, AND THEY ARE NOT THE SAME PAGE.
                      *
                      * Everything in the first block is read above the grid.
                      * Everything in the second belongs to the page a visitor
                      * lands on after clicking one photograph. Run together in
                      * one column, "Write-up heading" reads as a heading on the
                      * gallery, which is the page the editor is looking at.
                      */}
                    <CmsBlock
                        title="Above the grid"
                        hint="What a visitor reads before the first photograph, in the order the page reads it."
                    />

                    <CmsSteps>
                        <CmsStep
                            sectionKey="gallery.badge"
                            step="Gallery 1"
                            title="Badge"
                            hint="The small pill above the heading. Leave the text blank to hide it."
                        >
                            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                                <IconPicker
                                    value={settings.badgeIcon}
                                    onChange={badgeIcon => setSettings({ ...settings, badgeIcon })}
                                    label="Badge icon"
                                />
                                <CmsField label="Badge text">
                                    <CmsInput
                                        value={settings.badgeText}
                                        onChange={e => setSettings({ ...settings, badgeText: e.target.value })}
                                        placeholder="Our Gallery"
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="gallery.heading"
                            step="Gallery 2"
                            title="Heading and description"
                            hint="The two of them are the first thing on the page."
                        >
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

                            <div className="mt-4">
                                <CmsField label="Description">
                                    <CmsTextarea
                                        rows={3}
                                        value={settings.description}
                                        onChange={e => setSettings({ ...settings, description: e.target.value })}
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="gallery.note"
                            step="Gallery 3"
                            title="Handwritten note"
                            hint="Shown beside the collage on wide screens. Leave it empty to hide it."
                        >
                            <LineList
                                label="Lines"
                                hint="One line each."
                                value={settings.noteLines}
                                onChange={noteLines => setSettings({ ...settings, noteLines })}
                                rows={3}
                                placeholder={'Our Work\nOur People\nOur Impact'}
                            />
                        </CmsStep>

                        {/*
                          * WHAT THIS PAGE IS.
                          *
                          * The gallery reads as decoration until somebody says
                          * it is the record of every event already held \u2014 which
                          * is where `/events` now sends a visitor looking for
                          * one. A grid of photographs cannot say that itself.
                          */}
                        <CmsStep
                            sectionKey="gallery.pastEvents"
                            step="Gallery 4"
                            title="The past-events band"
                            hint="A strip above the chips saying this page holds every event already held. It is where the events page points."
                            actions={
                                <label className="flex items-center gap-2 text-[1.1875rem] text-slate-600 dark:text-neutral-300 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={settings.pastEvents.enabled}
                                        onChange={e => setSettings({
                                            ...settings,
                                            pastEvents: { ...settings.pastEvents, enabled: e.target.checked },
                                        })}
                                        className="rounded border-slate-400"
                                    />
                                    Shown
                                </label>
                            }
                        >
                            <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                                <IconPicker
                                    value={settings.pastEvents.icon}
                                    onChange={icon => setSettings({
                                        ...settings,
                                        pastEvents: { ...settings.pastEvents, icon },
                                    })}
                                    label="Icon"
                                />
                                <CmsField label="Heading">
                                    <CmsInput
                                        value={settings.pastEvents.title}
                                        onChange={e => setSettings({
                                            ...settings,
                                            pastEvents: { ...settings.pastEvents, title: e.target.value },
                                        })}
                                        placeholder="Our past events"
                                    />
                                </CmsField>
                            </div>

                            <div className="mt-4">
                                <CmsField label="Explanation">
                                    <CmsTextarea
                                        rows={2}
                                        value={settings.pastEvents.subtitle}
                                        onChange={e => setSettings({
                                            ...settings,
                                            pastEvents: { ...settings.pastEvents, subtitle: e.target.value },
                                        })}
                                        placeholder="Every conclave, seminar and meeting we have held \u2014 open one for its photographs, the write-up and where it was."
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="gallery.categories"
                            step="Gallery 5"
                            title="Filter chips"
                            hint={'An "All" chip is always shown first. A chip label is what an image\u2019s category must match to appear under that filter \u2014 the same words are offered on every image below.'}
                        >
                            <RepeatableList<{ label: string; icon: string }>
                                items={categories}
                                onChange={next => setSettings({ ...settings, categories: next })}
                                noun="chip"
                                summary={(chip) => ({ title: chip.label, subtitle: chip.icon })}
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
                        </CmsStep>

                        <CmsStep
                            sectionKey="gallery.paging"
                            ownFields={false}
                            step="Gallery 6"
                            title="Paging"
                            hint="How many images the public page loads before the button appears."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
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
                        </CmsStep>

                        <CmsStep
                            sectionKey="gallery.empty"
                            ownFields={false}
                            step="Gallery 7"
                            title="When there is nothing to show"
                            hint="Two different situations \u2014 nothing published at all, and a filter that matched nothing \u2014 and a visitor should be told which."
                        >
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
                        </CmsStep>

                        <CmsStep
                            ownFields={false}
                            step="Gallery 8"
                            title="Your own fields"
                            hint="Anything else this page should say. Each row shows as a labelled line under the grid."
                        >
                            <ExtraFieldsEditor
                                bare
                                items={settings.extraFields || []}
                                onChange={extraFields => setSettings({ ...settings, extraFields })}
                            />
                        </CmsStep>
                    </CmsSteps>

                    {/* ------------------------------------ one item's page */}
                    <CmsBlock
                        title="A poster's own page"
                        hint="The page a visitor lands on after clicking a photograph. The words here are its furniture \u2014 the content of each one is edited on the image itself, further down."
                    />

                    <CmsSteps>
                        <CmsStep
                            sectionKey="gallery.detail"
                            step="Poster page 1"
                            title="Headings and labels"
                            hint="Leave one blank to hide that heading. The section under it is still shown if it has content."
                        >
                            <div className="grid gap-4 sm:grid-cols-2">
                                <CmsField label="Back link">
                                    <CmsInput
                                        value={settings.detail.backLabel}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, backLabel: e.target.value },
                                        })}
                                        placeholder="Back to Gallery"
                                    />
                                </CmsField>
                                <CmsField label="Write-up heading">
                                    <CmsInput
                                        value={settings.detail.aboutHeading}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, aboutHeading: e.target.value },
                                        })}
                                        placeholder="About this event"
                                    />
                                </CmsField>
                                <CmsField label="Highlights heading">
                                    <CmsInput
                                        value={settings.detail.highlightsHeading}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, highlightsHeading: e.target.value },
                                        })}
                                        placeholder="Highlights"
                                    />
                                </CmsField>
                                <CmsField label="Photographs heading">
                                    <CmsInput
                                        value={settings.detail.photosHeading}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, photosHeading: e.target.value },
                                        })}
                                        placeholder="More photographs"
                                    />
                                </CmsField>
                                <CmsField label="Related row heading" hint="Blank hides the heading, not the row.">
                                    <CmsInput
                                        value={settings.detail.relatedHeading}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, relatedHeading: e.target.value },
                                        })}
                                        placeholder="More from the gallery"
                                    />
                                </CmsField>
                                <CmsField label="Deleted or hidden item" hint="Shown when a link points at an item that is gone.">
                                    <CmsInput
                                        value={settings.detail.missingText}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, missingText: e.target.value },
                                        })}
                                        placeholder="This item is no longer available."
                                    />
                                </CmsField>
                                <CmsField label="Button label" hint="The button on the side card. Blank hides it.">
                                    <CmsInput
                                        value={settings.detail.ctaLabel}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, ctaLabel: e.target.value },
                                        })}
                                        placeholder="Join ACTIV"
                                    />
                                </CmsField>
                                <CmsField label="Button destination" hint="A path such as /register, or a full https:// address.">
                                    <CmsInput
                                        value={settings.detail.ctaHref}
                                        onChange={e => setSettings({
                                            ...settings, detail: { ...settings.detail, ctaHref: e.target.value },
                                        })}
                                        placeholder="/register"
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>
                    </CmsSteps>
                    </SectionToolsProvider>

                    <div className="mt-6">
                        <button
                            type="button"
                            disabled={savingCopy}
                            onClick={saveCopy}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500
                                       text-white rounded-lg text-[1.1875rem] font-medium transition-colors disabled:opacity-50"
                        >
                            {savingCopy ? <Loader2 size={16} className="animate-spin" />
                                : savedCopy ? <Check size={16} /> : <Save size={16} />}
                            {savingCopy ? 'Saving…' : savedCopy ? 'Saved — live page updated' : 'Save page copy'}
                        </button>
                    </div>
                </CmsCard>
            )}

            {/* ============================================== the images */}
            <CmsCard
                title={`Images (${items.length})`}
                description={[
                    featuredCount === 0
                        ? 'No image is featured, so the collage at the top of the gallery page is not shown.'
                        : `${featuredCount} featured — the first three fill the collage at the top of the gallery page.`,
                    onHomeCount === 0
                        ? 'None is set to appear in the landing page banner.'
                        : `${onHomeCount} riding in the landing page banner.`,
                ].join(' ')}
                actions={
                    /*
                      ADDING IS A BUTTON, not a form that is always open.

                      The form is most of a screen tall. Open permanently, it
                      put every photograph in the gallery below the fold, and
                      the work an editor comes to this screen for is almost
                      always on an image that is already here.
                    */
                    <CmsButton
                        type="button"
                        onClick={() => {
                            /* And the other way: opening this closes whichever
                               row was being edited. */
                            cancelEdit();
                            setAddOpen(o => !o);
                        }}
                    >
                        {addOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {addOpen ? 'Close' : 'Add a photograph'}
                    </CmsButton>
                }
            >
                {addOpen && (
                    <form
                        onSubmit={handleAdd}
                        className="mb-6 rounded-xl border border-blue-200 dark:border-blue-900/60
                                   bg-blue-50/40 dark:bg-blue-950/20 p-4 sm:p-5 space-y-5"
                    >
                        <p className="text-[1.1875rem] font-semibold text-slate-900 dark:text-white">
                            A new poster or photograph
                        </p>
                        <p className="-mt-3 text-[1.0625rem] text-slate-600 dark:text-neutral-400">
                            It goes at the end of the gallery grid and — unless you turn that off
                            below — into the landing page banner, where clicking it opens its own page.
                        </p>

                        <ItemFields value={draft} onChange={setDraft} categories={categories} />

                        <CmsButton type="submit" loading={adding}>
                            <Plus className="w-4 h-4" /> Add to gallery
                        </CmsButton>
                    </form>
                )}

                {items.length === 0 ? (
                    <CmsEmpty title="No images yet" hint="The grid is not shown until one is added." />
                ) : (
                    <>
                        {/* ------------------------------ narrowing the list */}
                        <div className="mb-5 space-y-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                                                   w-4 h-4 text-neutral-400" />
                                <input
                                    type="search"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search by title, place, sector, category or date…"
                                    aria-label="Search the gallery"
                                    className="w-full bg-slate-50 dark:bg-black border border-slate-300
                                               dark:border-[#2a2a2a] rounded-lg pl-10 pr-3 py-2.5
                                               text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {chips.map((chip) => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={() => setView(chip.key)}
                                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2
                                                    text-[1.125rem] font-semibold transition-colors ${
                                            view === chip.key
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 dark:bg-[#141414] text-slate-600 '
                                                  + 'dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-[#1c1c1c]'
                                        }`}
                                    >
                                        {chip.label}
                                        <span className={view === chip.key ? 'text-white/70' : 'text-slate-400'}>
                                            {chip.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <CmsEmpty
                                title="Nothing matches"
                                hint="No image answers both the chip and the search. Clear one of them."
                            />
                        ) : (
                    <div className="space-y-3">
                        {shownItems.map((item) => (
                            <div
                                key={item._id}
                                className={`border border-slate-200 dark:border-[#2a2a2a] rounded-lg
                                            ${item.visible === false ? 'opacity-60' : ''}`}
                            >
                                <div className="flex gap-4 p-3">
                                    <div className="w-28 h-20 shrink-0 rounded-md overflow-hidden bg-slate-100 dark:bg-[#161616]">
                                        <CmsMediaFrame media={item.media} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-[1.1875rem] font-semibold text-slate-900 dark:text-neutral-100 truncate">
                                            {item.title || 'Untitled'}
                                        </p>
                                        <p className="text-[1.0625rem] text-neutral-500 mt-0.5 truncate">
                                            {[item.category, item.eventDate, item.location].filter(Boolean).join(' · ') || 'No details'}
                                        </p>

                                        {/* What is true of this row right now, in words.
                                            The four icon buttons beside it say what can be
                                            changed; these say what the state IS, which is
                                            what an editor scanning the list is looking for. */}
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            {item.visible === false && (
                                                <span className="text-[1.0625rem] text-amber-600 dark:text-amber-400">Hidden from the site</span>
                                            )}
                                            {item.pinned && (
                                                <span className="text-[1.0625rem] text-emerald-600 dark:text-emerald-400">Shown first</span>
                                            )}
                                            {item.showOnHome !== false && item.visible !== false && (
                                                <span className="text-[1.0625rem] text-blue-600 dark:text-blue-400">In the landing banner</span>
                                            )}
                                            {!item.description && (
                                                <span className="text-[1.0625rem] text-neutral-500">No write-up yet</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-1 shrink-0">
                                        {/* Opens the item's public page — the fastest way to
                                            check that a write-up reads the way it was meant to. */}
                                        <a
                                            href={`/gallery/${item._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Open its page on the site"
                                            className="p-2 rounded text-neutral-400 hover:bg-slate-100 dark:hover:bg-[#161616]"
                                        >
                                            <ExternalLink size={16} />
                                        </a>

                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => patchItem(item._id, { pinned: !item.pinned })}
                                            title={item.pinned
                                                ? 'Stop showing this one first'
                                                : 'Show this one first, in the banner and the gallery grid'}
                                            className={`p-2 rounded transition-colors disabled:opacity-40 ${
                                                item.pinned
                                                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                                    : 'text-neutral-400 hover:bg-slate-100 dark:hover:bg-[#161616]'
                                            }`}
                                        >
                                            <ArrowUpToLine size={16} />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => patchItem(item._id, { showOnHome: item.showOnHome === false })}
                                            title={item.showOnHome === false
                                                ? 'Show in the landing page banner'
                                                : 'Remove from the banner (stays in the gallery)'}
                                            className={`p-2 rounded transition-colors disabled:opacity-40 ${
                                                item.showOnHome !== false
                                                    ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                                                    : 'text-neutral-400 hover:bg-slate-100 dark:hover:bg-[#161616]'
                                            }`}
                                        >
                                            <Home size={16} />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => patchItem(item._id, { featured: !item.featured })}
                                            title={item.featured ? 'Remove from the collage' : 'Feature in the collage'}
                                            className={`p-2 rounded transition-colors disabled:opacity-40 ${
                                                item.featured
                                                    ? 'text-amber-500 hover:bg-amber-500/10'
                                                    : 'text-neutral-400 hover:bg-slate-100 dark:hover:bg-[#161616]'
                                            }`}
                                        >
                                            <Star size={16} fill={item.featured ? 'currentColor' : 'none'} />
                                        </button>

                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => patchItem(item._id, { visible: item.visible === false })}
                                            title={item.visible === false ? 'Show on the site' : 'Hide from the site'}
                                            className="p-2 rounded text-neutral-500 hover:bg-slate-100 dark:hover:bg-[#161616]
                                                       disabled:opacity-40"
                                        >
                                            {item.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>

                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => (editingId === item._id ? cancelEdit() : startEdit(item))}
                                            title={editingId === item._id ? 'Close the editor' : 'Edit the details'}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[1.0625rem] font-medium
                                                       text-slate-700 dark:text-neutral-200 border border-slate-300
                                                       dark:border-[#2a2a2a] hover:bg-slate-100 dark:hover:bg-[#161616]
                                                       disabled:opacity-40 transition-colors"
                                        >
                                            {editingId === item._id ? <X size={13} /> : <Pencil size={13} />}
                                            {editingId === item._id ? 'Close' : 'Edit'}
                                        </button>

                                        {/* Labelled, not a bare icon: it sits beside the
                                            show/hide toggle at the same size, and one of
                                            the two is reversible while the other is not. */}
                                        <button
                                            type="button"
                                            disabled={busyId === item._id}
                                            onClick={() => handleDelete(item)}
                                            title="Delete permanently"
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[1.0625rem] font-medium
                                                       text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30
                                                       hover:bg-red-500/10 disabled:opacity-40 transition-colors"
                                        >
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    </div>
                                </div>

                                {/* ---- the editor for this row ---- */}
                                {editingId === item._id && editDraft && (
                                    <div className="border-t border-slate-200 dark:border-[#2a2a2a] p-4
                                                    bg-slate-50/60 dark:bg-black/40 rounded-b-lg">
                                        <ItemFields
                                            value={editDraft}
                                            onChange={setEditDraft}
                                            categories={categories}
                                        />

                                        <div className="flex flex-wrap gap-3 mt-6">
                                            {/* “Update”, because this row already
                                                exists — the other form in this card
                                                is the one that adds. */}
                                            <CmsButton type="button" onClick={saveEdit} loading={savingEdit}>
                                                <Save className="w-4 h-4" /> Update
                                            </CmsButton>
                                            <button
                                                type="button"
                                                onClick={cancelEdit}
                                                disabled={savingEdit}
                                                className="px-4 py-2.5 rounded-lg text-[1.1875rem] font-medium text-slate-600
                                                           dark:text-neutral-300 border border-slate-300 dark:border-[#2a2a2a]
                                                           hover:bg-slate-100 dark:hover:bg-[#161616] disabled:opacity-40
                                                           transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                        )}

                        {/*
                          * HOW MUCH OF THE LIST IS ON SCREEN.
                          *
                          * Stated whether or not there is more to show. A list
                          * that stops at twelve with nothing under it reads as a
                          * list of twelve, and the whole complaint here was an
                          * editor unable to tell what the screen was holding back.
                          */}
                        {filtered.length > 0 && (
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[1.0625rem] text-neutral-500">
                                    Showing {shownItems.length} of {filtered.length}
                                    {filtered.length === items.length
                                        ? ' images'
                                        : ` — ${items.length} in the gallery altogether`}
                                </p>

                                {filtered.length > shownItems.length && (
                                    <button
                                        type="button"
                                        onClick={() => setShown(n => n + PAGE)}
                                        className="rounded-lg border border-slate-300 dark:border-[#2a2a2a]
                                                   px-4 py-2 text-[1.1875rem] font-semibold text-slate-700
                                                   dark:text-neutral-200 transition-colors
                                                   hover:bg-slate-100 dark:hover:bg-[#161616]"
                                    >
                                        Show {Math.min(PAGE, filtered.length - shownItems.length)} more
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </CmsCard>
        </CmsPage>
    );
}
