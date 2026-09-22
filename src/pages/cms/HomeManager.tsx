import { useEffect, useState } from 'react';
import { Plus, Save, Check, Loader2 } from 'lucide-react';
import {
    getHome, updateHome, errorMessage, EMPTY_MEDIA,
    getEventsSettings, updateEventsSettings,
    getSiteSettings, updateSiteSettings,
    type HomeContent, type HeroSlide, type CmsSectionOverride,
    type EventsSettings, type SiteSettings,
} from '@/services/cmsApi';
import {
    CmsSteps,
    CmsStep,
    CmsBlock,
    SaveNowProvider,
    SectionToolsProvider,
    CmsField,
    CmsInput,
    CmsTextarea,
    CmsButton,
    CmsLoading,
    CmsError,
    CmsEmpty,
    CmsPage,
    CmsSection,
    cmsSaved,
    cmsFailed,
} from './components/CmsUI';
import { RepeatableList, StatList, BulletList, IconPicker , ExtraFieldsEditor } from './components/CmsEditors';
import { HomeEventsPicker } from './components/HomeEventsPicker';
import { HomeGalleryPicker } from './components/HomeGalleryPicker';
import { HomeRegionsPicker } from './components/HomeRegionsPicker';
import MediaPicker from './components/MediaPicker';
import RichTextEditor from './components/RichTextEditor';

/**
 * The home page, edited as the two blocks it is built from.
 *
 * Each block saves on its own. That is deliberate: the two are edited on one
 * screen but are independent, and a single "save everything" button would let a
 * stale copy of the carousel overwrite a change made to it moments earlier in
 * another tab.
 *
 * ---------------------------------------------------------------------------
 * EVERY BAND ON THE HOME PAGE IS ON THIS SCREEN
 * ---------------------------------------------------------------------------
 *
 * Two of them were not, and both were defensible one at a time and wrong
 * together: the upcoming-events strip is edited under Events because it is the
 * same wording the Events page uses, and the "Across India" band under Header
 * & Footer because seven pages draw it. Both true, and neither visible to an
 * editor looking at the screen called Home Page — who counts the bands on the
 * live page, counts the cards here, and finds two missing.
 *
 * They are cards here now, editing those same documents rather than copies of
 * them, and each says so on its face. That is the treatment the logo already
 * gets on Header & Footer: one value, edited wherever it is SHOWN, with the
 * consequence written next to the field.
 *
 * What is still not here is the events THEMSELVES. Those are records with
 * dates and venues, not wording, and they have a screen of their own.
 */

type BlockKey = 'carousel' | 'about';

export default function HomeManager() {
    const [home, setHome] = useState<HomeContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [savingBlock, setSavingBlock] = useState<BlockKey | null>(null);
    const [savedBlock, setSavedBlock] = useState<BlockKey | null>(null);

    /*
     * The two bands this page draws that another document owns.
     *
     * Held and saved separately, because they ARE separate documents — see
     * the note at the top. Loading them here rather than making the editor
     * go and find them is the whole point of the cards.
     */
    const [events, setEvents] = useState<EventsSettings | null>(null);
    const [site, setSite] = useState<SiteSettings | null>(null);
    const [savingExtra, setSavingExtra] = useState<'events' | 'site' | null>(null);
    const [dirtyExtra, setDirtyExtra] = useState({ events: false, site: false });

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [h, e, s] = await Promise.all([
                getHome(),
                // Both bands are on the page this screen is named after, so
                // they are fetched with it rather than on a second visit.
                getEventsSettings().catch(() => null),
                getSiteSettings().catch(() => null),
            ]);
            setHome(h);
            setEvents(e);
            setSite(s);
        } catch (err) {
            setError(errorMessage(err, 'Could not load the home page'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    /**
     * Which block has unsaved work.
     *
     * Per block, not per page: the footer save in a banner card must stay
     * grey when the only edit on screen was to the About block, or it says
     * "there is something to save here" about a card nothing changed in.
     */
    const [dirty, setDirty] = useState({ carousel: false, about: false });

    /** Save one block. The server leaves the other untouched. */
    const saveBlock = async (key: BlockKey) => {
        if (!home) return;
        setSavingBlock(key);
        setSavedBlock(null);
        setError('');
        try {
            // Take the server's copy back: it drops empty slides and unknown
            // icons, and the editor should show what was actually stored.
            // `sections` rides along with either block — see `setSections`.
            setHome(await updateHome({
                [key]: home[key],
                sections: home.sections,
            } as Partial<HomeContent>));
            setDirty((d) => ({ ...d, [key]: false }));
            setSavedBlock(key);
            cmsSaved(key === 'carousel' ? 'Banner' : 'About block');
            setTimeout(() => setSavedBlock(null), 2500);
        } catch (err) {
            setError(errorMessage(err, 'Could not save this block'));
        } finally {
            setSavingBlock(null);
        }
    };

    if (loading) return <CmsLoading label="Loading home page…" />;
    if (!home) return <CmsError message={error || 'No content'} onRetry={load} />;

    const carousel = home.carousel;
    const about = home.about;
    const card = carousel.highlightCard;

    /* Each setter marks its OWN block dirty — see the note on `dirty`. */
    const setCarousel = (patch: Partial<typeof carousel>) => {
        setHome({ ...home, carousel: { ...carousel, ...patch } });
        setDirty((d) => ({ ...d, carousel: true }));
    };

    const setCard = (patch: Partial<typeof card>) =>
        setCarousel({ highlightCard: { ...card, ...patch } });

    const setAbout = (patch: Partial<typeof about>) => {
        setHome({ ...home, about: { ...about, ...patch } });
        setDirty((d) => ({ ...d, about: true }));
    };

    /*
     * Removing a card, or adding a field to one.
     *
     * ONE list for the whole screen, because its cards run across both
     * blocks — so this marks BOTH saves dirty. That is true rather than
     * cautious: the list rides along with whichever block is sent, so
     * either button stores it, and lighting only one would leave an editor
     * who removed an About card looking at a grey Save under it.
     */
    /**
     * Save the upcoming-events band.
     *
     * Writes `EventsSettings` — the SAME document the Events screen edits,
     * not a copy of it. A copy would be a second answer to "what does the
     * events band say", and the first time somebody edited one and not the
     * other the home page and /events would disagree.
     */
    const saveEvents = async () => {
        if (!events) return;
        setSavingExtra('events');
        setError('');
        try {
            setEvents(await updateEventsSettings(events));
            setDirtyExtra((d) => ({ ...d, events: false }));
            cmsSaved('Upcoming events band');
        } catch (err) {
            const message = errorMessage(err, 'Could not save the events band');
            setError(message);
            cmsFailed('the events band', message);
        } finally {
            setSavingExtra(null);
        }
    };

    /**
     * Save the Across India band.
     *
     * Writes `SiteSettings.acrossIndia`, which seven pages draw. `brand` and
     * `extraFields` ride along because the server merges per block and this
     * is not one of its blocks — sending the band alone is safe, but sending
     * these with it keeps the payload the same shape the settings screen
     * uses, so there is one thing to reason about rather than two.
     */
    const saveSite = async () => {
        if (!site) return;
        setSavingExtra('site');
        setError('');
        try {
            setSite(await updateSiteSettings({ acrossIndia: site.acrossIndia }));
            setDirtyExtra((d) => ({ ...d, site: false }));
            cmsSaved('Across India band');
        } catch (err) {
            const message = errorMessage(err, 'Could not save the Across India band');
            setError(message);
            cmsFailed('the Across India band', message);
        } finally {
            setSavingExtra(null);
        }
    };

    const setEventsBand = (patch: Partial<EventsSettings>) => {
        if (!events) return;
        setEvents({ ...events, ...patch });
        setDirtyExtra((d) => ({ ...d, events: true }));
    };

    const setBand = (patch: Partial<SiteSettings['acrossIndia']>) => {
        if (!site) return;
        setSite({ ...site, acrossIndia: { ...site.acrossIndia, ...patch } });
        setDirtyExtra((d) => ({ ...d, site: true }));
    };

    const setSections = (sections: CmsSectionOverride[]) => {
        setHome({ ...home, sections });
        setDirty({ carousel: true, about: true });
    };

    /*
     * `SaveRow` is gone. The save is the footer band of every card now, which
     * is where it is on every other screen — see `CmsStep`.
     */

    return (
        <CmsPage>
            <CmsError message={error} onRetry={load} />

            {/*
              * ==============================================================
              * 1. THE BANNER — numbered cards, each saving the banner
              * ==============================================================
              *
              * This page saves by BLOCK: the banner and the About block are
              * two documents as far as the server is concerned, and saving
              * one must not touch the other.
              *
              * So the provider is per block rather than per page. Every card
              * inside this one saves the banner, whichever card’s footer the
              * editor happens to be looking at — which is the behaviour the
              * single "Save banner" button had, spread across the five cards
              * it covered.
              */}
            <SaveNowProvider
                value={{
                    save: () => saveBlock('carousel'),
                    saving: savingBlock === 'carousel',
                    dirty: dirty.carousel,
                }}
            >
                <SectionToolsProvider value={{ sections: home.sections || [], onChange: setSections }}>
                <CmsBlock
                    title="The banner"
                    hint="The rotating band at the top of the home page. These five cards save together."
                />
                <CmsSteps>

                    <CmsStep sectionKey="carousel.headline" step="Banner 1" title="Headline" hint="The words over the banner.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Headline">
                                <CmsInput
                                    value={carousel.headline}
                                    onChange={e => setCarousel({ headline: e.target.value })}
                                    placeholder="Empowering SC/ST Entrepreneurs for a"
                                />
                            </CmsField>
                            <CmsField label="Highlighted words" hint="Rendered in blue at the end of the headline.">
                                <CmsInput
                                    value={carousel.headlineHighlight}
                                    onChange={e => setCarousel({ headlineHighlight: e.target.value })}
                                    placeholder="Better Future"
                                />
                            </CmsField>
                        </div>

                        <div className="mt-4">
                            <CmsField label="Sub-headline">
                                <CmsTextarea
                                    rows={3}
                                    value={carousel.subheadline}
                                    onChange={e => setCarousel({ subheadline: e.target.value })}
                                    placeholder="Help us provide a strong platform, education, networking…"
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep sectionKey="carousel.buttons" ownFields={false} step="Banner 2" title="Buttons" hint="Leave a label blank to hide that button.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3 border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-4">
                                <p className="text-[1.0625rem] font-semibold uppercase tracking-wider text-neutral-400">Primary</p>
                                <CmsField label="Label" hint="Leave blank to hide this button.">
                                    <CmsInput
                                        value={carousel.ctaLabel}
                                        onChange={e => setCarousel({ ctaLabel: e.target.value })}
                                        placeholder="Donate Now"
                                    />
                                </CmsField>
                                <CmsField label="Link">
                                    <CmsInput
                                        value={carousel.ctaHref}
                                        onChange={e => setCarousel({ ctaHref: e.target.value })}
                                        placeholder="/register"
                                    />
                                </CmsField>
                                <IconPicker value={carousel.ctaIcon} onChange={ctaIcon => setCarousel({ ctaIcon })} />
                            </div>

                            <div className="space-y-3 border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-4">
                                <p className="text-[1.0625rem] font-semibold uppercase tracking-wider text-neutral-400">Secondary</p>
                                <CmsField label="Label" hint="Leave blank to hide this button.">
                                    <CmsInput
                                        value={carousel.secondaryCtaLabel}
                                        onChange={e => setCarousel({ secondaryCtaLabel: e.target.value })}
                                        placeholder="Learn More"
                                    />
                                </CmsField>
                                <CmsField label="Link">
                                    <CmsInput
                                        value={carousel.secondaryCtaHref}
                                        onChange={e => setCarousel({ secondaryCtaHref: e.target.value })}
                                        placeholder="/about"
                                    />
                                </CmsField>
                                <IconPicker
                                    value={carousel.secondaryCtaIcon}
                                    onChange={secondaryCtaIcon => setCarousel({ secondaryCtaIcon })}
                                />
                            </div>
                        </div>
                    </CmsStep>

                    <CmsStep sectionKey="carousel.slides" ownFields={false} step="Banner 3" title="Slides" hint="They rotate in this order. Add, reorder or remove as many as you need.">
                        {carousel.slides.length === 0 ? (
                            <CmsEmpty title="No slides yet" hint="Without one the banner is not shown at all." />
                        ) : (
                            <RepeatableList<HeroSlide>
                                items={carousel.slides}
                                onChange={slides => setCarousel({ slides })}
                                noun="slide"
                                /* The caption is what the slide says; the file name is
                                   how an editor tells two untitled ones apart. */
                                /* The picture IS the row — see `summary.thumb`.
                                   The caption is what the slide says; the file
                                   name is how an editor tells two untitled ones
                                   apart when neither has a caption yet. */
                                summary={(slide) => ({
                                    title: slide.caption,
                                    subtitle: (slide.media?.url || '').split('/').pop(),
                                    thumb: slide.media?.url,
                                })}
                                blank={() => ({ media: { ...EMPTY_MEDIA }, caption: '' })}
                                row={(slide, update) => (
                                    <div className="space-y-3">
                                        {/* 21/9 — the real shape of the banner on the page. */}
                                        <MediaPicker
                                            label="Image or video"
                                            aspect="21 / 9"
                                            value={slide.media}
                                            onChange={media => update({ media })}
                                        />
                                        <CmsField label="Caption" hint="Optional text shown over this slide.">
                                            <CmsInput
                                                value={slide.caption}
                                                onChange={e => update({ caption: e.target.value })}
                                            />
                                        </CmsField>
                                    </div>
                                )}
                            />
                        )}
                    </CmsStep>

                    {/*
                      The posters are not slides you edit here on purpose: they
                      are the gallery's own images, read when the page renders.
                      Post an event once at /cms/gallery and it appears in the
                      banner; delete it there and it leaves. Nothing to keep in
                      step, and nothing uploaded twice.
                    */}
                    <CmsStep
                        sectionKey="carousel.galleryPosters"
                        ownFields={false}
                        step="Banner 4"
                        title="Gallery posters in the banner"
                        hint="Recent gallery images ride in this banner alongside the slides above, and clicking one
                              opens that event's page. Manage which images qualify at /cms/gallery — the house button
                              on a row keeps it out of the banner."
                        actions={
                            <label className="flex items-center gap-2 text-[1.1875rem] text-slate-600 dark:text-neutral-300 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={carousel.galleryPosters.enabled}
                                    onChange={e => setCarousel({
                                        galleryPosters: { ...carousel.galleryPosters, enabled: e.target.checked },
                                    })}
                                    className="rounded border-slate-400"
                                />
                                Shown
                            </label>
                        }
                    >
                        {/*
                          * WHICH IMAGES, not just how many.
                          *
                          * This card offered a number and a dropdown. An editor
                          * could not see which six pictures the banner was
                          * carrying, could not take one off, and could not tell
                          * from here that it carried any at all.
                          *
                          * The switch writes `showOnHome` on the gallery item —
                          * the same field the Gallery screen's own button sets.
                          */}
                        <div className="mb-6 border-b border-slate-100 pb-6 dark:border-[#1a1a1a]">
                            <p className="mb-3 text-[1.1875rem] font-extrabold text-slate-900 dark:text-white">
                                Which images ride the banner
                            </p>
                            <HomeGalleryPicker />
                        </div>

                        {/* “How many posters” used to lead this row and is gone:
                            the switches above decide. Where they SIT is a layout
                            choice and stays. */}
                        <div className="grid gap-4">
                            <CmsField label="Where they sit" hint="Which a visitor sees first: your message, or your events.">
                                <select
                                    value={carousel.galleryPosters.position}
                                    onChange={e => setCarousel({
                                        galleryPosters: {
                                            ...carousel.galleryPosters,
                                            position: e.target.value === 'before' ? 'before' : 'after',
                                        },
                                    })}
                                    className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-[#2a2a2a]
                                               rounded-lg px-3 py-2 text-[1.1875rem] text-slate-900 dark:text-neutral-100"
                                >
                                    <option value="after">After the slides above</option>
                                    <option value="before">Before the slides above</option>
                                </select>
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep
                        sectionKey="carousel.highlightCard"
                        step="Banner 5"
                        title="Highlight card"
                        hint="Overlaps the bottom edge of the banner."
                        actions={
                            <label className="flex items-center gap-2 text-[1.1875rem] text-slate-600 dark:text-neutral-300 shrink-0">
                                <input
                                    type="checkbox"
                                    checked={card.enabled}
                                    onChange={e => setCard({ enabled: e.target.checked })}
                                    className="rounded border-slate-400"
                                />
                                Show
                            </label>
                        }
                    >
                        {card.enabled && (
                            <div className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-[200px_1fr_1fr]">
                                    <IconPicker value={card.icon} onChange={icon => setCard({ icon })} />
                                    <CmsField label="Eyebrow">
                                        <CmsInput
                                            value={card.eyebrow}
                                            onChange={e => setCard({ eyebrow: e.target.value })}
                                            placeholder="Growing Network"
                                        />
                                    </CmsField>
                                    <CmsField label="Headline figure">
                                        <CmsInput
                                            value={card.value}
                                            onChange={e => setCard({ value: e.target.value })}
                                            placeholder="5,000+"
                                        />
                                    </CmsField>
                                </div>

                                <CmsField label="Caption" hint="Sits beside the figure, in smaller grey text.">
                                    <CmsInput
                                        value={card.caption}
                                        onChange={e => setCard({ caption: e.target.value })}
                                        placeholder="Members Registered"
                                    />
                                </CmsField>

                                <div>
                                    <p className="text-[1.1875rem] font-medium text-slate-700 dark:text-neutral-300 mb-3">
                                        Figures on the right
                                    </p>
                                    <StatList
                                        items={card.stats}
                                        onChange={stats => setCard({ stats })}
                                        max={4}
                                    />
                                </div>
                            </div>
                        )}
                    </CmsStep>
                </CmsSteps>
                </SectionToolsProvider>
            </SaveNowProvider>

            {/* ============================================== 2. ABOUT */}
            <SaveNowProvider
                value={{
                    save: () => saveBlock('about'),
                    saving: savingBlock === 'about',
                    dirty: dirty.about,
                }}
            >
                <SectionToolsProvider value={{ sections: home.sections || [], onChange: setSections }}>
                <CmsBlock
                    title="The About block"
                    hint="Under the banner. These six cards save together, separately from the banner above."
                />
                <CmsSteps>

                    <CmsStep sectionKey="about.badge" step="About 1" title="Badge" hint="The small pill above the heading.">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                        <IconPicker value={about.badgeIcon} onChange={badgeIcon => setAbout({ badgeIcon })} label="Badge icon" />
                        <CmsField label="Badge text" hint="The small pill above the heading. Blank hides it.">
                            <CmsInput
                                value={about.badgeText || about.eyebrow}
                                onChange={e => setAbout({ badgeText: e.target.value, eyebrow: '' })}
                                placeholder="About Us"
                            />
                        </CmsField>
                    </div>
                    </CmsStep>

                    <CmsStep sectionKey="about.heading" step="About 2" title="Heading and introduction">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Heading">
                            <CmsInput
                                value={about.heading}
                                onChange={e => setAbout({ heading: e.target.value })}
                                placeholder="About the Activities"
                            />
                        </CmsField>
                        <CmsField label="Second line" hint="Rendered in blue on its own line.">
                            <CmsInput
                                value={about.headingHighlight}
                                onChange={e => setAbout({ headingHighlight: e.target.value })}
                                placeholder="of ACTIV"
                            />
                        </CmsField>
                    </div>

                    <div className="mt-4">
                        <CmsField label="Introduction">
                            <RichTextEditor
                                rows={4}
                                value={about.body}
                                onChange={body => setAbout({ body })}
                                placeholder="ACTIV is an Indian Chamber of Commerce for SC/ST entrepreneurs…"
                            />
                        </CmsField>
                    </div>
                    </CmsStep>

                    <CmsStep sectionKey="about.points" step="About 3" title="Points" hint="The icon list under the introduction.">
                        <BulletList items={about.bullets} onChange={bullets => setAbout({ bullets })} />
                    </CmsStep>

                    <CmsStep sectionKey="about.image" step="About 4" title="Image" hint="The arched portrait frame, and the mark that floats over it.">
                    <div className="space-y-5">
                        {/* 3/4 — the arched portrait frame on the page. */}
                        <MediaPicker
                            label="Image or video"
                            aspect="3 / 4"
                            value={about.media}
                            onChange={media => setAbout({ media })}
                        />

                        <MediaPicker
                            label="Logo overlay"
                            aspect="16 / 6"
                            value={about.logoOverlay}
                            onChange={logoOverlay => setAbout({ logoOverlay })}
                            hint="Floats over the top-right of the image. Leave empty to hide it."
                        />
                    </div>
                    </CmsStep>

                    <CmsStep sectionKey="about.statsBar" step="About 5" title="Figures bar" hint="The white card below this section.">
                        <StatList
                            items={about.statsBar}
                            onChange={statsBar => setAbout({ statsBar })}
                            max={6}
                        />
                    </CmsStep>

                    {/*
                      * The BLOCK's own list, as its own card.
                      *
                      * It used to sit here with no card around it, between two
                      * numbered ones, which read as a piece of the page that had
                      * failed to render rather than as a control.
                      *
                      * Distinct from the per-card lists above: a row here is a
                      * labelled line under the figures bar, wherever the About
                      * block ends. A row on a card is a line inside that card's
                      * own section — so `ownFields` is off, or this card would
                      * offer two lists that look identical and land in different
                      * places.
                      */}
                    <CmsStep
                        sectionKey="about.ownFields"
                        ownFields={false}
                        step="About 6"
                        title="Your own fields"
                        hint="Anything else this block should say. Each row shows as a labelled line under the figures bar."
                    >
                        <ExtraFieldsEditor
                            bare
                            items={about.extraFields || []}
                            onChange={extraFields => setAbout({ extraFields })}
                        />
                    </CmsStep>
                </CmsSteps>
                </SectionToolsProvider>
            </SaveNowProvider>

            {/*
              * ==============================================================
              * 3. THE UPCOMING-EVENTS BAND
              * ==============================================================
              *
              * The third band on the home page, and it was not on this screen.
              * It edits the EventsSettings document — the same wording the
              * /events hero uses — which is why the card says so rather than
              * letting an editor discover it on the other page.
              *
              * Three groups, not one column of eleven fields: what it SAYS,
              * what the button does, and WHICH events it carries. The third
              * is the one an editor actually came for.
              */}
            {events && (
                <SaveNowProvider
                    value={{
                        save: saveEvents,
                        saving: savingExtra === 'events',
                        dirty: dirtyExtra.events,
                    }}
                >
                    <SectionToolsProvider value={{ sections: home.sections || [], onChange: setSections }}>
                    <CmsBlock
                        title="The upcoming events band"
                        hint="Saves on its own, into the Events settings — the same wording /events uses."
                    />
                    <CmsSteps>
                        <CmsStep
                            sectionKey="home.eventsBand"
                            ownFields={false}
                            step="Events band"
                            title="Upcoming events band"
                            hint="The strip of upcoming events under the About block."
                            actions={
                                <a
                                    href="/cms/events"
                                    className="shrink-0 rounded-lg px-3 py-1.5 text-[1rem] font-semibold
                                               text-blue-700 transition-colors hover:bg-blue-50
                                               dark:text-blue-400 dark:hover:bg-blue-950/40"
                                >
                                    Manage the events
                                </a>
                            }
                        >
                            <div className="space-y-0">

                                {/* ---- which events ---- */}
                                {/*
                                  * FIRST, because it is what an editor opens this
                                  * card to do. The wording changes once a year; which
                                  * events are on the landing page changes weekly.
                                  */}
                                <CmsSection
                                    title="Which events appear here"
                                    hint="Every event switched on appears, however many that is. A switch saves straight away — it writes the event itself."
                                >
                                    <HomeEventsPicker />
                                </CmsSection>

                                {/* ---- the wording ---- */}
                                <CmsSection
                                    title="The wording over the strip"
                                    hint="The same wording the Events page uses — editing it here changes both."
                                >
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <CmsField label="Small label" hint="The pill above the heading.">
                                            <CmsInput
                                                value={events.badgeText}
                                                onChange={e => setEventsBand({ badgeText: e.target.value })}
                                                placeholder="Upcoming Events"
                                            />
                                        </CmsField>
                                        <CmsField label="Heading">
                                            <CmsInput
                                                value={events.heading}
                                                onChange={e => setEventsBand({ heading: e.target.value })}
                                                placeholder="Our Events"
                                            />
                                        </CmsField>
                                        <CmsField label="Highlighted words" hint="Rendered in blue.">
                                            <CmsInput
                                                value={events.headingHighlight}
                                                onChange={e => setEventsBand({ headingHighlight: e.target.value })}
                                                placeholder="&amp; Conclaves"
                                            />
                                        </CmsField>
                                    </div>

                                    <div className="mt-4">
                                        <CmsField label="Caption" hint="The small centred line under the heading, on the HOME page only.">
                                            <CmsInput
                                                value={events.subtitle}
                                                onChange={e => setEventsBand({ subtitle: e.target.value })}
                                                placeholder="join the network"
                                            />
                                        </CmsField>
                                    </div>
                                </CmsSection>

                                {/* ---- the button, and the empty case ---- */}
                                <CmsSection title="The button under them">
                                    {/* “How many to show” used to lead this row and is
                                        gone: the switches above decide. */}
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <CmsField label="Button label" hint="Blank hides the button.">
                                            <CmsInput
                                                value={events.viewAllLabel}
                                                onChange={e => setEventsBand({ viewAllLabel: e.target.value })}
                                                placeholder="See All Events"
                                            />
                                        </CmsField>
                                        <CmsField label="Button link">
                                            <CmsInput
                                                value={events.viewAllHref}
                                                onChange={e => setEventsBand({ viewAllHref: e.target.value })}
                                                placeholder="/events"
                                            />
                                        </CmsField>
                                    </div>

                                    <div className="mt-4">
                                        <CmsField label="Nothing published yet" hint="Shown in place of the strip.">
                                            <CmsInput
                                                value={events.emptyText}
                                                onChange={e => setEventsBand({ emptyText: e.target.value })}
                                                placeholder="No events have been published yet."
                                            />
                                        </CmsField>
                                    </div>
                                </CmsSection>
                            </div>
                        </CmsStep>
                    </CmsSteps>
                    </SectionToolsProvider>
                </SaveNowProvider>
            )}

            {/*
              * ==============================================================
              * 4. THE BAND ABOVE THE FOOTER
              * ==============================================================
              *
              * "Across India / Find ACTIV where you are", over the region
              * tiles. It was two string literals in the component, on seven
              * pages — the one band on the site an editor could not touch.
              *
              * It belongs to the SITE settings because those seven pages draw
              * it, and it is on this screen because the home page is one of
              * them. The card says which, so nobody edits it here expecting
              * the home page alone to change.
              */}
            {site && (
                <SaveNowProvider
                    value={{
                        save: saveSite,
                        saving: savingExtra === 'site',
                        dirty: dirtyExtra.site,
                    }}
                >
                    <SectionToolsProvider value={{ sections: home.sections || [], onChange: setSections }}>
                    <CmsBlock
                        title="The band above the footer"
                        hint="Saves on its own, into the site settings — it is on every public page."
                    />
                    <CmsSteps>
                        <CmsStep
                            sectionKey="home.acrossIndia"
                            ownFields={false}
                            step="Across India"
                            title="Across India band"
                            hint="The region tiles above the footer — on every public page, not just this one."
                            actions={
                                <label className="flex items-center gap-2 text-[1.1875rem] text-slate-600 dark:text-neutral-300 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={site.acrossIndia.enabled}
                                        onChange={e => setBand({ enabled: e.target.checked })}
                                        className="rounded border-slate-400"
                                    />
                                    Shown
                                </label>
                            }
                        >
                            <div className="space-y-0">

                                {/* ---- which tiles ---- */}
                                <CmsSection
                                    title="Which regions appear here"
                                    hint="Saved with this card. Leaving one out removes its tile only — its page and its menu entry stay."
                                >
                                    <HomeRegionsPicker
                                        hidden={site.acrossIndia.hidden || []}
                                        onChange={hidden => setBand({ hidden })}
                                    />
                                </CmsSection>

                                {/* ---- the wording ---- */}
                                <CmsSection
                                    title="The wording over the tiles"
                                    hint="On every public page. Editing it here changes all of them."
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <CmsField label="Small label" hint="The line above the heading. Blank hides it.">
                                            <CmsInput
                                                value={site.acrossIndia.eyebrow}
                                                onChange={e => setBand({ eyebrow: e.target.value })}
                                                placeholder="Across India"
                                            />
                                        </CmsField>
                                        <CmsField label="Heading">
                                            <CmsInput
                                                value={site.acrossIndia.heading}
                                                onChange={e => setBand({ heading: e.target.value })}
                                                placeholder="Find ACTIV where you are"
                                            />
                                        </CmsField>
                                    </div>

                                    <div className="mt-4">
                                        <CmsField label="Explanation" hint="Optional line under the heading.">
                                            <CmsTextarea
                                                rows={2}
                                                value={site.acrossIndia.subtitle}
                                                onChange={e => setBand({ subtitle: e.target.value })}
                                                placeholder="Pick a region to see its states, councils and office-bearers."
                                            />
                                        </CmsField>
                                    </div>
                                </CmsSection>
                            </div>
                        </CmsStep>
                    </CmsSteps>
                    </SectionToolsProvider>
                </SaveNowProvider>
            )}
        </CmsPage>
    );
}
