import { useEffect, useState } from 'react';
import { Plus, Save, Check, Loader2 } from 'lucide-react';
import {
    getHome, updateHome, errorMessage, EMPTY_MEDIA,
    type HomeContent, type HeroSlide,
} from '@/services/cmsApi';
import { CmsCard, CmsField, CmsInput, CmsTextarea, CmsButton, CmsLoading, CmsError, CmsEmpty } from './components/CmsUI';
import { RepeatableList, StatList, BulletList, IconPicker } from './components/CmsEditors';
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
 * What is NOT here is as considered as what is. The events strip on this page is
 * edited under Events Manager because it is the same list the Events page shows,
 * and the header and footer under Site Settings because they are on every page.
 * A field with no corresponding place on the public page would be an edit that
 * appears to do nothing.
 */

type BlockKey = 'carousel' | 'about';

export default function HomeManager() {
    const [home, setHome] = useState<HomeContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [savingBlock, setSavingBlock] = useState<BlockKey | null>(null);
    const [savedBlock, setSavedBlock] = useState<BlockKey | null>(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setHome(await getHome());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the home page'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    /** Save one block. The server leaves the other untouched. */
    const saveBlock = async (key: BlockKey) => {
        if (!home) return;
        setSavingBlock(key);
        setSavedBlock(null);
        setError('');
        try {
            // Take the server's copy back: it drops empty slides and unknown
            // icons, and the editor should show what was actually stored.
            setHome(await updateHome({ [key]: home[key] } as Partial<HomeContent>));
            setSavedBlock(key);
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

    const setCarousel = (patch: Partial<typeof carousel>) =>
        setHome({ ...home, carousel: { ...carousel, ...patch } });

    const setCard = (patch: Partial<typeof card>) =>
        setCarousel({ highlightCard: { ...card, ...patch } });

    const setAbout = (patch: Partial<typeof about>) =>
        setHome({ ...home, about: { ...about, ...patch } });

    const SaveRow = ({ block, label }: { block: BlockKey; label: string }) => (
        <div className="mt-6">
            <button
                type="button"
                disabled={savingBlock === block}
                onClick={() => saveBlock(block)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500
                           text-white rounded-lg text-sm font-medium transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {savingBlock === block
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : savedBlock === block ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savingBlock === block ? 'Saving…' : savedBlock === block ? 'Saved — live page updated' : label}
            </button>
        </div>
    );

    return (
        <div className="space-y-8 w-full pb-12">
            <CmsError message={error} onRetry={load} />

            {/* ============================================== 1. CAROUSEL */}
            <CmsCard
                title="1. Banner"
                description="The rotating banner at the top of the page, the headline over it and the card that overlaps its bottom edge."
                actions={
                    <CmsButton
                        type="button"
                        variant="ghost"
                        onClick={() => setCarousel({
                            slides: [...carousel.slides, { media: { ...EMPTY_MEDIA }, caption: '' }],
                        })}
                    >
                        <Plus className="w-4 h-4" /> Add slide
                    </CmsButton>
                }
            >
                <div className="space-y-6">

                    {/* ---- headline ---- */}
                    <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Headline</p>
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
                    </div>

                    {/* ---- buttons ---- */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Buttons</p>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Primary</p>
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

                            <div className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Secondary</p>
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
                    </div>

                    {/* ---- slides ---- */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Slides
                            <span className="font-normal text-slate-500"> — they rotate in this order.</span>
                        </p>

                        {carousel.slides.length === 0 ? (
                            <CmsEmpty title="No slides yet" hint="Without one the banner is not shown at all." />
                        ) : (
                            <RepeatableList<HeroSlide>
                                items={carousel.slides}
                                onChange={slides => setCarousel({ slides })}
                                noun="slide"
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
                    </div>

                    {/* ---- highlight card ---- */}
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Highlight card
                                <span className="font-normal text-slate-500"> — overlaps the bottom of the banner.</span>
                            </p>
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={card.enabled}
                                    onChange={e => setCard({ enabled: e.target.checked })}
                                    className="rounded border-slate-400"
                                />
                                Show
                            </label>
                        </div>

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
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
                    </div>
                </div>

                <SaveRow block="carousel" label="Save banner" />
            </CmsCard>

            {/* ============================================== 2. ABOUT */}
            <CmsCard
                title="2. About block"
                description="The badge, heading, paragraph, icon points, image and figures bar."
            >
                <div className="space-y-6">

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

                    <CmsField label="Introduction">
                        <RichTextEditor
                            rows={4}
                            value={about.body}
                            onChange={body => setAbout({ body })}
                            placeholder="ACTIV is an Indian Chamber of Commerce for SC/ST entrepreneurs…"
                        />
                    </CmsField>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Points
                            <span className="font-normal text-slate-500"> — the icon list under the introduction.</span>
                        </p>
                        <BulletList items={about.bullets} onChange={bullets => setAbout({ bullets })} />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-5">
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

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Figures bar
                            <span className="font-normal text-slate-500"> — the white card below this section.</span>
                        </p>
                        <StatList
                            items={about.statsBar}
                            onChange={statsBar => setAbout({ statsBar })}
                            max={6}
                        />
                    </div>
                </div>

                <SaveRow block="about" label="Save About block" />
            </CmsCard>
        </div>
    );
}
