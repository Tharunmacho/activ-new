import { useEffect, useState } from 'react';
import { getAbout, updateAbout, errorMessage, type AboutContent } from '@/services/cmsApi';
import {
    CmsCard,
    CmsField,
    CmsInput,
    CmsTextarea,
    SaveButton,
    CmsLoading,
    CmsError,
    cmsSaved,
    cmsFailed,
    CmsPage,
    CmsSection,
} from './components/CmsUI';
import { BulletList, StatList, IconPicker } from './components/CmsEditors';
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
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

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

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!about) return;
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            // The server's copy back: it drops empty points and unknown icons.
            setAbout(await updateAbout(about));
            setSaved(true);
            cmsSaved('About page');
            setTimeout(() => setSaved(false), 2500);
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

    const set = (patch: Partial<AboutContent>) => setAbout({ ...about, ...patch });

    return (
        <form onSubmit={submit} className="w-full">
            <CmsPage>
            <CmsError message={error} />

            <CmsCard
                title="About page"
                description="Shown at /about. Separate content from the About block on the home page."
            >
                <div className="space-y-0">

                    <CmsSection title="Badge" hint="The small pill above the heading.">
                    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                        <IconPicker value={about.badgeIcon} onChange={badgeIcon => set({ badgeIcon })} label="Badge icon" />
                        <CmsField label="Badge text" hint="The small pill above the heading. Blank hides it.">
                            <CmsInput
                                value={about.badgeText}
                                onChange={e => set({ badgeText: e.target.value })}
                                placeholder="About Us"
                            />
                        </CmsField>
                    </div>
                    </CmsSection>

                    <CmsSection title="Heading and introduction">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <CmsField label="Heading">
                            <CmsInput
                                value={about.heading}
                                onChange={e => set({ heading: e.target.value })}
                                placeholder="About the Activities"
                            />
                        </CmsField>
                        <CmsField label="Second line" hint="Rendered in blue on its own line.">
                            <CmsInput
                                value={about.headingHighlight}
                                onChange={e => set({ headingHighlight: e.target.value })}
                                placeholder="of ACTIV"
                            />
                        </CmsField>
                    </div>

                    <div className="mt-4">
                        <CmsField label="Introduction">
                            <RichTextEditor
                                rows={4}
                                value={about.body}
                                onChange={body => set({ body })}
                                placeholder="ACTIV is an Indian Chamber of Commerce for SC/ST entrepreneurs…"
                            />
                        </CmsField>
                    </div>
                    </CmsSection>

                    <CmsSection title="Points" hint="The icon list under the introduction.">
                        <BulletList items={about.bullets} onChange={bullets => set({ bullets })} />
                    </CmsSection>

                    <CmsSection title="Image" hint="The arched portrait frame, and the mark that floats over it.">
                    <div className="space-y-5">
                        {/* 3/4 — the arched portrait frame on the page. */}
                        <MediaPicker
                            label="Image or video"
                            aspect="3 / 4"
                            value={about.media}
                            onChange={media => set({ media })}
                        />

                        <MediaPicker
                            label="Logo overlay"
                            aspect="16 / 6"
                            value={about.logoOverlay}
                            onChange={logoOverlay => set({ logoOverlay })}
                            hint="Floats over the top-right of the image. Leave empty to hide it."
                        />
                    </div>
                    </CmsSection>

                    <CmsSection title="Figures bar" hint="The white card below the split layout.">
                        <StatList
                            items={about.statsBar}
                            onChange={statsBar => set({ statsBar })}
                            max={6}
                        />
                    </CmsSection>
                </div>

                <div className="mt-6">
                    <SaveButton loading={saving} label={saved ? 'Saved — live page updated' : 'Save About page'} />
                </div>
            </CmsCard>
            </CmsPage>
        </form>
    );
}
