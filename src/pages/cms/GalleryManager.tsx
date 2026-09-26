import { galleryPath } from '@/lib/eventPath';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft,
    Plus, Trash2, Eye, EyeOff, Star, Save, Check, Loader2,
    Home, Pencil, X, ExternalLink, ArrowUpToLine, Search, Images,
} from 'lucide-react';
import { type GalleryPhotoMedia,
    getGallery, addGalleryItem, updateGalleryItem, deleteGalleryItem,
    getGallerySettings, updateGallerySettings, errorMessage,
    EMPTY_MEDIA, type GalleryItem, type GallerySettings, type CmsMedia, type GalleryField,
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
    SaveNowProvider,
    CmsCheck,
    CmsBlock,
    SectionToolsProvider,
} from './components/CmsUI';
import { RepeatableList, LineList, IconPicker , ExtraFieldsEditor } from './components/CmsEditors';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import MediaPicker from './components/MediaPicker';
import BannerWordsFields from './components/BannerWordsFields';
import { resolveMediaUrl } from '@/config/api.config';

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
    photos: GalleryPhotoMedia[];
    /** Fields the editor named themselves. */
    customFields: GalleryField[];
    featured: boolean;
    /** Leads both the banner and the gallery grid. */
    pinned: boolean;
    /** Rides in the landing page banner. */
    showOnHome: boolean;
    /** What the home banner says over this image, and on which side. */
    bannerHeadline: string;
    bannerHighlight: string;
    bannerSubheadline: string;
    bannerAlign: 'left' | 'right';
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
    bannerHeadline: '',
    bannerHighlight: '',
    bannerSubheadline: '',
    bannerAlign: 'left',
};

/** How many rows the list opens on. “Show more” adds another page. */
const PAGE = 12;

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

/**
 * Did the server keep this image's banner words?
 *
 * A backend running a build from before those fields existed answers 200 and
 * silently drops them (Mongoose strict mode). Returns the sentence to show
 * when something typed did not come back, or '' when it all did.
 */
const bannerWordsLost = (sent: ItemDraft, back: Partial<GalleryItem> | null) => {
    if (!back) return '';
    const lost = (!!sent.bannerHeadline && !back.bannerHeadline)
        || (!!sent.bannerHighlight && !back.bannerHighlight)
        || (!!sent.bannerSubheadline && !back.bannerSubheadline)
        || (sent.bannerAlign === 'right' && back.bannerAlign !== 'right');
    return lost
        ? 'The server did not store the banner heading for this image. Your backend is running an older '
            + 'build — restart it (npm run dev), then save again. Your text is still in the form.'
        : '';
};

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
    /* `title` and `customFields` are defaulted HERE as well as spread: a row
       written before they existed has neither, and the editor's inputs would
       read `undefined` — which React logs as an uncontrolled-to-controlled
       switch the first time somebody types. */
    photos: (item.photos || []).map(p => ({
        ...EMPTY_MEDIA,
        title: '',
        caption: '',
        ...(p || {}),
        customFields: ((p && p.customFields) || []).map(f => ({
            label: f.label || '', value: f.value || '',
            icon: f.icon || 'info', placement: f.placement === 'content' ? 'content' as const : 'card' as const,
        })),
    })),
    /* `icon` and `placement` defaulted on load as well as on save: a row
       written before they existed has neither, and the editor's controls would
       read `undefined`. */
    customFields: (item.customFields || []).map(f => ({
        label: f.label || '', value: f.value || '',
        icon: f.icon || 'info', placement: f.placement === 'content' ? 'content' as const : 'card' as const,
    })),
    featured: !!item.featured,
    pinned: !!item.pinned,
    // Rows written before the field existed have no value, and they are the
    // ones already on the site — so absent reads as on, as it does server-side.
    showOnHome: item.showOnHome !== false,
    bannerHeadline: item.bannerHeadline || '',
    bannerHighlight: item.bannerHighlight || '',
    bannerSubheadline: item.bannerSubheadline || '',
    bannerAlign: item.bannerAlign === 'right' ? 'right' : 'left',
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
                title="Main photo — the album cover"
                hint="The one photo the gallery shows for this album. Opening the album shows it with every photo below. Shown at 4:3; a video works too."
            >
                <MediaPicker
                    label=""
                    aspect="4 / 3"
                    value={value.media}
                    onChange={media => set({ media })}
                />
            </CmsSection>

            {/*
              * THE HOME PAGE BANNER — directly under the photo it is about.
              *
              * It used to sit at the foot of "Where it appears", near the bottom
              * of a long form and only after a box was ticked, and an editor
              * looking for "the heading over this picture" never found it — so
              * every gallery slide kept printing the banner's shared sentence.
              * The switch and the words are one decision, so they live together.
              */}
            <CmsSection
                title="Home page banner — the words over this photo"
                hint="Give this photo its own heading and subheading on the home page banner, and choose which side they sit on so the subject of the photo stays visible."
            >
                <CmsCheck
                    checked={value.showOnHome}
                    onChange={showOnHome => set({ showOnHome })}
                    icon={<Home className="h-4 w-4" />}
                    title="Show this photo on the home page banner"
                    detail="Newest first. Clicking the slide opens this album's own page."
                />

                {/* Only while it is in the banner — the words are shown nowhere else. */}
                {value.showOnHome && (
                    <div className="mt-4">
                        <BannerWordsFields
                            value={{
                                headline: value.bannerHeadline || '',
                                highlight: value.bannerHighlight || '',
                                subheadline: value.bannerSubheadline || '',
                                align: value.bannerAlign === 'right' ? 'right' : 'left',
                            }}
                            onChange={(next) => set({
                                ...(next.headline !== undefined ? { bannerHeadline: next.headline } : {}),
                                ...(next.highlight !== undefined ? { bannerHighlight: next.highlight } : {}),
                                ...(next.subheadline !== undefined ? { bannerSubheadline: next.subheadline } : {}),
                                ...(next.align !== undefined ? { bannerAlign: next.align } : {}),
                            })}
                            preview={value.media?.url ? resolveMediaUrl(value.media.url) : ''}
                            whenBlank={value.title
                                ? `Leave them all blank and this album's own title and caption are shown instead ("${value.title}"). The banner's shared heading is used only when the album has no title either.`
                                : "Leave them all blank and the banner's shared heading is shown, because this album has no title yet."}
                            fallback={{ headline: value.title || '', subheadline: value.caption || '' }}
                        />
                    </div>
                )}
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
            {/*
              * THE ALBUM'S OWN FIELDS, on the same control the photographs use.
              *
              * This was a plain label-and-value list, so two things the side
              * card needs were never asked for: the ICON drawn beside each one
              * (a field without one left an empty circle next to Date and
              * Location — reported), and WHERE it goes. Every field landed in
              * the card, which left an editor wanting to add a paragraph of
              * writing with nowhere to put it.
              *
              * Same control at both levels: an editor filling in a photograph
              * is doing exactly what they did on the album.
              */}
            <ExtraFieldsEditor
                hint="Chief Guest, Organised by, Sponsors, Attendance — anything about this album the fields above do not cover. Each can sit beside the picture as a labelled fact, or become a section of its own in the write-up."
                items={value.customFields}
                onChange={customFields => set({ customFields })}
            />

{/*
              * ==================================================================
              * EACH PHOTOGRAPH IS EDITED LIKE A PAGE, BECAUSE IT IS ONE
              * ==================================================================
              *
              * This card was a picture and one Description box. Every photograph
              * now opens a page of its own at `/gallery/:id/photo/:n`, and that
              * page was left with nothing to print but the one line — a heading
              * and no detail under it, which is what an editor reported.
              *
              * So it carries what the ALBUM card above carries, one level down,
              * in the same order and with the same words: a name, a description,
              * and the editor's own fields. An editor who has filled in the album
              * already knows this form.
              *
              * "Its own fields" is the part that matters and the part that was
              * missing: the layout can only ever declare the fields it draws, and
              * what an association wants to record about a photograph — who took
              * it, who is in it, which sponsor's stand it was on — is theirs to
              * name. Whatever label is typed here is exactly the label the page
              * prints; nothing is invented and nothing is renamed.
              */}
            <CmsSection
                title="Photos in this album"
                hint="Every photo from the event. Each one gets a page of its own on the site — give it a name, describe it, and add any fields of your own. Up to 100."
            >
                <RepeatableList<GalleryPhotoMedia>
                    items={value.photos}
                    onChange={photos => set({ photos })}
                    noun="photo"
                    /*
                     * What the CLOSED row says, and the picture it is.
                     *
                     * Every row read "Untitled photo" — so a list of twelve was
                     * twelve identical cards and reordering them was guesswork.
                     * `RepeatableList` has taken a `summary` all along; this
                     * list simply never passed one.
                     */
                    summary={(photo, i) => ({
                        title: photo.title || photo.caption || `Photo ${i + 1}`,
                        subtitle: photo.title ? (photo.caption || '') : '',
                        thumb: photo.url,
                    })}
                    blank={() => ({ ...EMPTY_MEDIA, title: '', caption: '', description: '', customFields: [] })}
                    /*
                     * THE PICTURE ON ITS OWN ROW, NOT IN A 14rem COLUMN.
                     *
                     * `MediaPicker` carries an uploader, the address, the fill
                     * mode, the focal point and the alt text. At 14rem its labels
                     * wrapped into each other — "How it fills the space" over
                     * "Focal point" over a squashed "Fill frame" — which is what
                     * the screenshot showed. It is a form in its own right and it
                     * needs the width of one.
                     */
                    row={(photo, update) => (
                        <div className="space-y-4">
                            <MediaPicker
                                label=""
                                aspect="4 / 3"
                                value={photo}
                                /*
                                 * The picker returns MEDIA only, so everything
                                 * else on the row has to be carried across by
                                 * hand — without this, changing the image wipes
                                 * the title, the description and the fields, and
                                 * the save reports success.
                                 */
                                onChange={next => update({
                                    ...next,
                                    title: photo.title || '',
                                    caption: photo.caption || '',
                                    customFields: photo.customFields || [],
                                })}
                            />

                            <div className="space-y-4">
                                <CmsField
                                    label="Name"
                                    hint="The heading on this photo's own page, and how it is listed in the album."
                                >
                                    <CmsInput
                                        value={photo.title || ''}
                                        onChange={e => update({ ...photo, title: e.target.value })}
                                        placeholder="The chief guest opens the exhibition hall"
                                    />
                                </CmsField>

                                <CmsField label="One line" hint="Sits directly under the heading on that page.">
                                    <CmsTextarea
                                        rows={2}
                                        value={photo.caption || ''}
                                        onChange={e => update({ ...photo, caption: e.target.value })}
                                        placeholder="Shri R Kumar, Minister for Industries, opening the hall on the first morning."
                                    />
                                </CmsField>

                                {/*
                                  * THE SAME THREE TIERS THE ALBUM HAS.
                                  *
                                  * Name, one line, then the write-up. The album
                                  * card above reads Title → Caption → About this
                                  * event; this is that form one level down, in the
                                  * same order and with the same words, so an editor
                                  * who has filled in an album already knows it.
                                  *
                                  * The write-up is what was missing: a photograph's
                                  * page had a heading and one line and then stopped,
                                  * which reads as a page whose body failed to load.
                                  */}
                                <CmsField
                                    label="About this photograph"
                                    hint="The longer write-up, printed under its own heading on that page. Leave it empty and no such section is drawn."
                                >
                                    <CmsTextarea
                                        rows={6}
                                        value={photo.description || ''}
                                        onChange={e => update({ ...photo, description: e.target.value })}
                                        placeholder={'Who is in the photograph, what was happening, and why it mattered.\n\nBlank lines start a new paragraph.'}
                                    />
                                </CmsField>

                                {/*
                                  * ITS OWN FIELDS, EACH WITH AN ICON THE EDITOR PICKS.
                                  *
                                  * `ExtraFieldsEditor` is the album's control and has
                                  * no icon, because the album prints its fields as a
                                  * plain list. These are drawn in a card beside Date
                                  * and Location, which are illustrated — so a field
                                  * with no mark left an empty circle, reported as
                                  * "icons are missed". The glyph cannot be guessed
                                  * from a label somebody typed a moment ago, so it is
                                  * asked for, and `info` stands in until it is.
                                  */}
                                <ExtraFieldsEditor
                                    title="Its own fields"
                                    hint="Photographer, Chief Guest, Venue — anything about THIS photograph the fields above do not cover. Each can sit beside the picture as a labelled fact, or become a section of its own in the write-up."
                                    items={photo.customFields || []}
                                    onChange={customFields => update({ ...photo, customFields })}
                                />
                            </div>
                        </div>
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
                hint="The gallery page, and optionally the collage. The home page banner has its own section, under the main photo."
            >
                <div className="mb-3">
                    <CmsCheck
                        checked={value.visible !== false}
                        onChange={on => set({ visible: on })}
                        icon={<Images className="h-4 w-4" />}
                        title="Show this album on the gallery page"
                        detail="Untick to hide it from the site without deleting it."
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
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
                hint="Albums otherwise keep the order they were added in."
            >
                <CmsCheck
                    checked={value.pinned}
                    onChange={pinned => set({ pinned })}
                    icon={<ArrowUpToLine className="h-4 w-4" />}
                    title="Show this one first"
                    detail="Leads the gallery grid and the home page banner, ahead of everything else."
                />
            </CmsSection>
        </div>
    );
}

/**
 * A photograph's own named fields: an icon, a label and a value.
 *
 * Deliberately NOT `ExtraFieldsEditor` with an extra prop. That control serves
 * six screens whose fields are printed as a plain labelled list and have no
 * icon; adding one there would put a picker on all of them to serve this one.
 */
/*
 * `NamedFieldsEditor` and its `FieldPlacement` lived here, as the gallery's
 * own copy of a control the rest of the CMS did not have. They are gone: the
 * icon and the placement moved onto `ExtraFieldsEditor`, which every "Your own
 * fields" list on the site already used, so the gallery now shares it. One
 * control, and no second place to forget the next thing a named field needs.
 */

export default function GalleryManager() {
    const [items, setItems] = useState<GalleryItem[]>([]);
    /* A Save in every card's footer — see the note on `EventsManager`.
       The wrapper marks the page dirty so the twenty-odd call sites below do
       not each have to; the load and the copy back use the raw setter. */
    const [settings, setSettingsClean] = useState<GallerySettings | null>(null);
    const [copyDirty, setCopyDirty] = useState(false);
    const setSettings = (next: GallerySettings | null) => {
        setSettingsClean(next);
        setCopyDirty(true);
    };
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
     * A search box and a page size. Where each album shows is written on its
     * row in words, and changed inside the album — not by a row of icons.
     *
     * `addOpen`: the add form used to be open permanently, between the page
     * copy and the list. It is most of a screen tall, so the photographs
     * an editor came here for started below the fold on every visit.
     */
    const [query, setQuery] = useState('');
    const [shown, setShown] = useState(PAGE);
    const [addOpen, setAddOpen] = useState(false);

    /**
     * The row being edited, and the copy being edited.
     *
     * An inline panel rather than a dialog: the row stays where it is, so an
     * editor working down a long gallery does not lose their place, and there is
     * never a stack of overlays to dismiss.
     */
    /* Albums and the page's wording, as tabs — the Regions & States layout. */
    const [tab, setTab] = useState<'albums' | 'wording'>('albums');
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
    useEffect(() => {
        if (addOpen || editingId) window.scrollTo({ top: 0 });
    }, [addOpen, editingId]);

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
            const back = await updateGalleryItem(editingId, flatten(editDraft));
            const lost = bannerWordsLost(editDraft, back);
            if (lost) {
                // Keep the panel open with what was typed; say why it did not stick.
                setError(lost);
                cmsFailed('the banner words', lost);
                return;
            }
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
            setSettingsClean(config);
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
    useEffect(() => { setShown(PAGE); }, [query]);

    const saveCopy = async () => {
        if (!settings) return;
        setSavingCopy(true);
        setSavedCopy(false);
        setError('');
        try {
            setSettingsClean(await updateGallerySettings(settings));
            setCopyDirty(false);
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
        /* Each photograph's own blank field rows are dropped on the way out,
           exactly as the album's are on the line below — an editor who pressed
           "add field" and changed their mind should not leave a stray colon on
           that photograph's page. */
        photos: item.photos
            .filter(p => p && p.url)
            .map(p => ({ ...p, customFields: (p.customFields || []).filter(f => f.label || f.value) })),
        // A row left completely blank is not a field; the server drops it too.
        customFields: item.customFields.filter(f => f.label || f.value),
        featured: item.featured,
        pinned: item.pinned,
        showOnHome: item.showOnHome,
        bannerHeadline: item.bannerHeadline,
        bannerHighlight: item.bannerHighlight,
        bannerSubheadline: item.bannerSubheadline,
        bannerAlign: item.bannerAlign,
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
            const created = await addGalleryItem(flatten(draft));
            /* The image IS created either way — saving again would duplicate
               it — so a dropped heading is reported, to be re-entered by
               editing the row once the backend is restarted. */
            const lost = bannerWordsLost(draft, created);
            if (lost) cmsFailed('the banner words', lost);
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
    const handleDelete = async (item: GalleryItem) => {
        if (!window.confirm(`Delete "${item.title || 'this image'}" permanently? Hiding it is reversible; this is not.`)) return;
        setBusyId(item._id);
        try {
            await deleteGalleryItem(item._id);
            cmsDeleted(item.title || 'Image');
            // Dropped from the list rather than refetched: a reload loses the scroll.
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

    /* The search narrows the album list. */
    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return items.filter(i => !needle || haystack(i).includes(needle));
    }, [items, query]);

    const shownItems = filtered.slice(0, shown);

    if (loading) return <CmsLoading label="Loading gallery…" />;

    return (
        <CmsPage>
            <CmsError message={error} onRetry={load} />

            {/* ============================================== tabs
                Hidden while an album is open — that is its own screen. */}
            {!addOpen && !editingId && (
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#1f1f1f]">
                    {([['albums', 'Albums', items.length], ['wording', 'Page wording', null]] as ['albums' | 'wording', string, number | null][])
                        .map(([key, label, count]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={`-mb-px border-b-2 px-5 py-3 text-[1.25rem] font-semibold transition-colors ${tab === key
                                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200'}`}
                            >
                                {label}
                                {count !== null && <span className="ml-2 text-[1.1875rem] text-slate-400">{count}</span>}
                            </button>
                        ))}
                </div>
            )}

            {/* ============================================== page copy */}
            {tab === 'wording' && !addOpen && !editingId && settings && (
                <CmsCard
                    title="The gallery page"
                    description="Everything the page says around the photographs — and the labels on the page one photograph opens into."
                >
                    <SaveNowProvider value={{ save: saveCopy, saving: savingCopy, dirty: copyDirty }}>
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


                        <CmsStep
                            sectionKey="gallery.categories"
                            /*
                             * THIS CARD'S LOGIC IS CHIPS, so its extra rows
                             * are shaped like a chip: a mark and a name, with
                             * what it says beside them. No "show it as" pair
                             * — a rail of pills has no write-up to put a
                             * paragraph in, so the question has one answer.
                             */
                            fieldMode="card"
                            fieldNoun="label"
                            step="Gallery 4"
                            title="Filter chips"
                            hint={'An "All" chip is always shown first. A chip label is what an image\u2019s category must match to appear under that filter — the same words are offered on every image below.'}
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
                            step="Gallery 5"
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
                            step="Gallery 6"
                            title="When there is nothing to show"
                            hint="Two different situations — nothing published at all, and a filter that matched nothing — and a visitor should be told which."
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
                            step="Gallery 7"
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
                        hint="The page a visitor lands on after clicking a photograph. The words here are its furniture — the content of each one is edited on the image itself, further down."
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
                    </SaveNowProvider>

                    {/*
                      * NO SAVE BAND UNDER THE LAST CARD.
                      *
                      * There was one here, and the moment every card grew a
                      * Save in its footer it became a SECOND full-width blue
                      * button stacked directly under the first — same colour,
                      * same width, same action, four pixels apart. Two buttons
                      * that do one thing is a question the editor has to stop
                      * and answer, and it was reported as exactly that.
                      *
                      * The card footers are the save now, on every card, which
                      * is what the rest of the CMS does. Nothing is lost: each
                      * of them calls `saveCopy`, and this button called the
                      * same function.
                      */}
                </CmsCard>
            )}

            {/* ============================================== an album, open
                Its own screen, the way a state page opens in Regions & States:
                a Back button, the album's form, and Save. */}
            {(addOpen || (editingId && editDraft)) && (
                <div>
                    <button
                        type="button"
                        onClick={() => { setAddOpen(false); cancelEdit(); }}
                        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2
                                   text-[1.0625rem] font-semibold text-slate-600 transition-colors hover:border-[#2563EB]
                                   hover:text-[#2563EB] dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to the albums
                    </button>
                    <CmsCard
                        title={addOpen ? 'New album' : `Edit album${editDraft?.title ? ` — ${editDraft.title}` : ''}`}
                        description="An album is one event's photographs: a main photo for the gallery grid, and every photo inside it with its own description."
                    >
                        {addOpen ? (
                            <form onSubmit={handleAdd}>
                                <ItemFields value={draft} onChange={setDraft} categories={categories} />
                                <div className="mt-8 flex gap-3">
                                    <CmsButton type="submit" disabled={adding}>
                                        {adding ? 'Adding…' : 'Add the album'}
                                    </CmsButton>
                                    <CmsButton type="button" variant="ghost" onClick={() => setAddOpen(false)}>Cancel</CmsButton>
                                </div>
                            </form>
                        ) : editDraft && (
                            <>
                                <ItemFields value={editDraft} onChange={setEditDraft} categories={categories} />
                                <div className="mt-8 flex gap-3">
                                    <CmsButton type="button" onClick={saveEdit} disabled={savingEdit}>
                                        {savingEdit ? 'Saving…' : 'Save the album'}
                                    </CmsButton>
                                    <CmsButton type="button" variant="ghost" onClick={cancelEdit}>Cancel</CmsButton>
                                </div>
                            </>
                        )}
                    </CmsCard>
                </div>
            )}

            {/* ============================================== the albums */}
            {tab === 'albums' && !addOpen && !editingId && (
                <CmsCard
                    title={`Albums (${items.length})`}
                    description="The photographs posted after each event. The gallery shows every visible album by its main photo; opening one shows all its photos."
                    actions={
                        <CmsButton type="button" onClick={() => { setDraft({ ...BLANK_ITEM, media: { ...EMPTY_MEDIA } }); setAddOpen(true); }}>
                            <Plus className="h-4 w-4" /> New album
                        </CmsButton>
                    }
                >
                    {items.length > 0 && (
                        <div className="relative mb-4">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <CmsInput value={query} onChange={e => setQuery(e.target.value)}
                                      placeholder="Search albums by name, category, date or place" className="pl-9" />
                        </div>
                    )}

                    {items.length === 0 ? (
                        <CmsEmpty title="No albums yet" hint="Add an album after each event with its photographs." />
                    ) : filtered.length === 0 ? (
                        <CmsEmpty title="Nothing matches" hint="No album answers that search." />
                    ) : (
                        <div className="space-y-3">
                            {shownItems.map((item) => {
                                const photoCount = (item.photos || []).filter(p => p && p.url).length + (item.media?.url ? 1 : 0);
                                return (
                                    <div key={item._id}
                                         className={`flex items-center gap-4 rounded-xl border border-slate-200 p-3 transition-colors
                                                     hover:border-slate-300 dark:border-[#2a2a2a] ${item.visible === false ? 'opacity-60' : ''}`}>
                                        <button type="button" onClick={() => startEdit(item)}
                                                className="h-20 w-28 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-[#161616]">
                                            <CmsMediaFrame media={item.media} />
                                        </button>
                                        <button type="button" onClick={() => startEdit(item)} className="min-w-0 flex-1 text-left">
                                            <p className="truncate text-[1.25rem] font-bold text-slate-900 dark:text-neutral-100">
                                                {item.title || 'Untitled album'}
                                            </p>
                                            <p className="mt-0.5 truncate text-[1.0625rem] text-neutral-500">
                                                {[item.eventDate, item.location, `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`]
                                                    .filter(Boolean).join(' · ')}
                                            </p>
                                            {/* Where it shows, in words — changed inside the album. */}
                                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[1rem]">
                                                {item.visible === false
                                                    ? <span className="text-amber-600">Hidden from the site</span>
                                                    : <span className="text-emerald-600">On the gallery page</span>}
                                                {item.visible !== false && item.showOnHome !== false && (
                                                    <span className="text-blue-600">
                                                        On the home page banner
                                                        {/* Whether it has words of its own, or is still
                                                            printing the shared heading over itself. */}
                                                        {item.bannerHeadline || item.bannerHighlight || item.bannerSubheadline
                                                            ? ` · own heading (${item.bannerAlign === 'right' ? 'right' : 'left'})`
                                                            : ''}
                                                    </span>
                                                )}
                                                {item.visible !== false && item.showOnHome !== false
                                                    && !item.bannerHeadline && !item.bannerHighlight && !item.bannerSubheadline && (
                                                    item.title
                                                        ? <span className="text-slate-500">Banner shows its album title</span>
                                                        : <span className="text-amber-600">Shared banner heading — edit to add its own</span>
                                                )}
                                                {item.visible !== false && item.featured && <span className="text-blue-600">In the collage</span>}
                                                {item.pinned && <span className="text-slate-500">Shown first</span>}
                                            </div>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {item.visible !== false && (
                                                <a href={galleryPath(item)} target="_blank" rel="noopener noreferrer"
                                                   aria-label="Open on the site"
                                                   className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            )}
                                            <button type="button" onClick={() => startEdit(item)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[1.0625rem] font-semibold
                                                               text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400">
                                                <Pencil className="h-3.5 w-3.5" /> Edit
                                            </button>
                                            <button type="button" onClick={() => handleDelete(item)} disabled={busyId === item._id}
                                                    aria-label="Delete the album"
                                                    className="rounded p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {filtered.length > shownItems.length && (
                                <div className="pt-2 text-center">
                                    <CmsButton type="button" variant="ghost" onClick={() => setShown(n => n + PAGE)}>
                                        Show more ({filtered.length - shownItems.length} left)
                                    </CmsButton>
                                </div>
                            )}
                        </div>
                    )}
                </CmsCard>
            )}
        </CmsPage>
    );
}
