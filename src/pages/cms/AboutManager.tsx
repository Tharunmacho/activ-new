import { useEffect, useState } from 'react';
import { getAbout, updateAbout, errorMessage, type AboutContent } from '@/services/cmsApi';
import { CmsCard, CmsField, CmsInput, CmsTextarea, SaveButton, CmsLoading, CmsError } from './components/CmsUI';
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
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            setError(errorMessage(err, 'Could not save the About page'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CmsLoading label="Loading About page…" />;
    if (!about) return <CmsError message={error || 'No content'} onRetry={load} />;

    const set = (patch: Partial<AboutContent>) => setAbout({ ...about, ...patch });

    return (
        <form onSubmit={submit} className="space-y-6 max-w-5xl pb-12">
            <CmsError message={error} />

            <CmsCard
                title="About page"
                description="Shown at /about. Separate content from the About block on the home page."
            >
                <div className="space-y-6">

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

                    <CmsField label="Introduction">
                        <RichTextEditor
                            rows={4}
                            value={about.body}
                            onChange={body => set({ body })}
                            placeholder="ACTIV is an Indian Chamber of Commerce for SC/ST entrepreneurs…"
                        />
                    </CmsField>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Points
                            <span className="font-normal text-slate-500"> — the icon list under the introduction.</span>
                        </p>
                        <BulletList items={about.bullets} onChange={bullets => set({ bullets })} />
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-5">
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

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                            Figures bar
                            <span className="font-normal text-slate-500"> — the white card below the split layout.</span>
                        </p>
                        <StatList
                            items={about.statsBar}
                            onChange={statsBar => set({ statsBar })}
                            max={6}
                        />
                    </div>
                </div>

                <div className="mt-6">
                    <SaveButton loading={saving} label={saved ? 'Saved — live page updated' : 'Save About page'} />
                </div>
            </CmsCard>
        </form>
    );
}
