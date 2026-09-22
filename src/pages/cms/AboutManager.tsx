import { useEffect, useState } from 'react';
import {
    getAbout, updateAbout, errorMessage,
    type AboutContent, type CmsSectionOverride,
} from '@/services/cmsApi';
import {
    CmsField,
    CmsInput,
    CmsLoading,
    CmsError,
    cmsSaved,
    cmsFailed,
    CmsPage,
    CmsSteps,
    CmsStep,
    SaveNowProvider,
    SectionToolsProvider,
} from './components/CmsUI';
import { BulletList, StatList, IconPicker , ExtraFieldsEditor } from './components/CmsEditors';
import MediaPicker from './components/MediaPicker';
import RichTextEditor from './components/RichTextEditor';

/**
 * The dedicated About page at `/about`.
 *
 * Its own document, separate from the home page's About block. They render the
 * same layout, which is why the fields look identical — but they are not the
 * same content, and editing one must not overwrite the other.
 */
export default function AboutManager() {
    const [about, setAbout] = useState<AboutContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    /*
     * Whether there is anything to save.
     *
     * Set by `set` rather than by comparing against the loaded document: a
     * deep compare of a page with two media objects and three lists is more
     * code than the question deserves, and an editor who typed a character
     * and deleted it again is not harmed by the save staying lit.
     */
    const [dirty, setDirty] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setAbout(await getAbout());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the About page'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const submit = async () => {
        if (!about) return;
        setSaving(true);
        setError('');
        try {
            // The server's copy back: it drops empty points and unknown icons.
            setAbout(await updateAbout(about));
            setDirty(false);
            cmsSaved('About page');
        } catch (err) {
            const message = errorMessage(err, 'Could not save the About page');
            setError(message);
            cmsFailed('About page', message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CmsLoading label="Loading About page…" />;
    if (!about) return <CmsError message={error || 'No content'} onRetry={load} />;

    const set = (patch: Partial<AboutContent>) => {
        setAbout({ ...about, ...patch });
        setDirty(true);
    };

    /* Removing a card, or adding a field to one — see `SectionToolsProvider`. */
    const setSections = (sections: CmsSectionOverride[]) => set({ sections });

    /*
 * ==========================================================================
 * FIVE NUMBERED CARDS, LIKE EVERY OTHER SCREEN
 * ==========================================================================
 *
 * This was one long card with five headings inside it and a save at the
 * bottom. Every other screen in the CMS is now a column of numbered cards
 * with the save in each footer, and a screen that is built differently is a
 * screen an editor has to learn separately.
 *
 * NO `<form>` ANY MORE. The save is a button in a footer band, not a submit,
 * because there are five footers and one form cannot have five submits that
 * mean the same thing. Enter in a text field no longer saves the page, which
 * is the behaviour the rest of the CMS has always had.
 */
    return (
        <SaveNowProvider value={{ save: submit, saving, dirty }}>
            <CmsPage>
                <CmsError message={error} />

                <SectionToolsProvider value={{ sections: about.sections || [], onChange: setSections }}>
                <CmsSteps>
                    <CmsStep
                        sectionKey="about.badge"
                        step="Section 1"
                        title="Badge"
                        hint="The small pill above the heading. Blank hides it."
                    >
                        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                            <IconPicker
                                value={about.badgeIcon}
                                onChange={(badgeIcon) => set({ badgeIcon })}
                                label="Badge icon"
                            />
                            <CmsField label="Badge text">
                                <CmsInput
                                    value={about.badgeText}
                                    onChange={(e) => set({ badgeText: e.target.value })}
                                    placeholder="About Us"
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep
                        sectionKey="about.heading"
                        step="Section 2"
                        title="Heading and introduction"
                        hint="What the page opens with, at /about. Separate content from the About block on the home page."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Heading">
                                <CmsInput
                                    value={about.heading}
                                    onChange={(e) => set({ heading: e.target.value })}
                                    placeholder="About the Activities"
                                />
                            </CmsField>
                            <CmsField label="Second line" hint="Rendered in blue on its own line.">
                                <CmsInput
                                    value={about.headingHighlight}
                                    onChange={(e) => set({ headingHighlight: e.target.value })}
                                    placeholder="of ACTIV"
                                />
                            </CmsField>
                        </div>

                        <div className="mt-4">
                            <CmsField label="Introduction">
                                <RichTextEditor
                                    rows={4}
                                    value={about.body}
                                    onChange={(body) => set({ body })}
                                    placeholder="ACTIV is an Indian Chamber of Commerce for SC/ST entrepreneurs…"
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep
                        sectionKey="about.image"
                        step="Section 3"
                        title="Image"
                        hint="The arched portrait frame, and the mark that floats over it."
                    >
                        <div className="space-y-5">
                            {/* 3/4 — the arched portrait frame on the page. */}
                            <MediaPicker
                                label="Image or video"
                                aspect="3 / 4"
                                value={about.media}
                                onChange={(media) => set({ media })}
                            />

                            <MediaPicker
                                label="Logo overlay"
                                aspect="16 / 6"
                                value={about.logoOverlay}
                                onChange={(logoOverlay) => set({ logoOverlay })}
                                hint="Floats over the top-right of the image. Leave empty to hide it."
                            />
                        </div>
                    </CmsStep>

                    {/*
                      * FOURTH, because it is fourth on the page.
                      *
                      * The editor’s order and the reader’s order are the same
                      * order wherever that is possible — an editor filling this
                      * screen top to bottom is writing the page top to bottom,
                      * and a card numbered 1 that appears fourth on the site is
                      * a small lie the CMS tells every time it is opened.
                      *
                      * It led this screen while it led the page. It now sits
                      * under the About block and over the objectives, so it
                      * sits there here too.
                      */}
                    <CmsStep
                        sectionKey="about.quote"
                        step="Section 4"
                        title="The chairman’s words"
                        hint="A quotation, set large under the About block and above Our Mission &amp; Objectives. Leave the words blank and the block is not drawn at all."
                    >
                        <CmsField
                            label="The words"
                            hint="Without quotation marks: the page draws those. Bold a phrase to have it picked out in the brand colour."
                        >
                            <RichTextEditor
                                rows={5}
                                value={about.quote?.text || ''}
                                onChange={(text) => set({ quote: { ...about.quote, text } })}
                                placeholder="We were founded on a simple conviction — that an entrepreneur’s community should never decide how far they can go."
                            />
                        </CmsField>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <CmsField label="Who said it">
                                <CmsInput
                                    value={about.quote?.author || ''}
                                    onChange={(e) => set({
                                        quote: { ...about.quote, author: e.target.value },
                                    })}
                                    placeholder="Mr K Rajendran"
                                />
                            </CmsField>
                            <CmsField label="Their position" hint="Printed under the name.">
                                <CmsInput
                                    value={about.quote?.role || ''}
                                    onChange={(e) => set({
                                        quote: { ...about.quote, role: e.target.value },
                                    })}
                                    placeholder="National Chairman, ACTIV"
                                />
                            </CmsField>
                        </div>

                        <MediaPicker
                            label="Portrait"
                            aspect="1 / 1"
                            value={about.quote?.photo}
                            onChange={(photo) => set({ quote: { ...about.quote, photo } })}
                            hint="Optional. A small round portrait beside the name; with none, the name stands on its own."
                        />
                    </CmsStep>

                    <CmsStep
                        sectionKey="about.points"
                        step="Section 5"
                        title="Points"
                        hint="The icon list under the introduction."
                    >
                        <BulletList items={about.bullets} onChange={(bullets) => set({ bullets })} />
                    </CmsStep>

                    <CmsStep
                        sectionKey="about.statsBar"
                        step="Section 6"
                        title="Figures bar"
                        hint="The white card below the split layout."
                    >
                        <StatList
                            items={about.statsBar}
                            onChange={(statsBar) => set({ statsBar })}
                            max={6}
                        />

                        <ExtraFieldsEditor
                            items={about.extraFields || []}
                            onChange={(extraFields) => set({ extraFields })}
                            hint="Anything else this page should say. Each row shows as a labelled line under the figures bar."
                        />
                    </CmsStep>
                </CmsSteps>
                </SectionToolsProvider>
            </CmsPage>
        </SaveNowProvider>
    );
}
