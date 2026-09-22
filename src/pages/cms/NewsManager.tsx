import { useCallback, useEffect, useMemo, useState } from 'react';
import { Newspaper, Plus, Trash2, ExternalLink, Pencil, ArrowLeft } from 'lucide-react';
import {
    CmsPage, CmsCard, CmsSection, CmsField, CmsInput, CmsTextarea, CmsButton,
    CmsLoading, CmsError, CmsCheck, cmsSaved, cmsFailed, cmsDeleted,
    CmsSteps, CmsStep, SectionToolsProvider,
} from './components/CmsUI';
import { UploadField } from './components/UploadField';
import { LineList, ExtraFieldsEditor } from './components/CmsEditors';
import { errorMessage } from '@/services/api';
import { CARD_TITLE } from '@/components/layout/appTypography';
import {
    listNewsAdmin, saveArticle, deleteArticle, saveScheme, deleteScheme, saveNewsSettings,
    type NewsArticle, type Scheme, type NewsSettings,
} from '@/services/cmsNewsApi';

/**
 * ============================================================================
 * THE NEWSROOM EDITOR — articles, schemes, and the page's own copy
 * ============================================================================
 *
 * Three tabs on one screen, because they are one page on the site and an
 * editor posting a story and the scheme it announces should not have to go
 * looking for a second screen.
 *
 * ------------------------------------------------------- one form at a time
 *
 * A list, and an editor OPENS one row. Not an accordion of forty open forms,
 * and not a modal — a modal over a long form is a scroll inside a scroll, and
 * this CMS has none anywhere else.
 *
 * ------------------------------------------------------------- what saves
 *
 * Only the keys the form sends. The server treats an absent key as untouched,
 * so a save from the article form cannot blank a scheme, and a save of the
 * page copy cannot touch either.
 */

type Tab = 'news' | 'schemes' | 'settings';

const blankArticle = (): Partial<NewsArticle> => ({
    title: '',
    summary: '',
    body: '',
    image: { url: '', type: 'image', alt: '', fit: 'cover', position: 'center' },
    photos: [],
    externalUrl: '',
    sourceName: '',
    displayDate: '',
    publishedAt: null,
    category: '',
    location: '',
    state: '',
    district: '',
    featured: false,
    status: 'draft',
});

const blankScheme = (): Partial<Scheme> => ({
    title: '',
    summary: '',
    body: '',
    tier: 'national',
    state: '',
    district: '',
    authority: '',
    eligibility: '',
    deadline: '',
    applyUrl: '',
    documentUrl: '',
    icon: 'file-text',
    status: 'draft',
});

/** `<input type="date">` wants `YYYY-MM-DD`; the record holds an ISO string. */
const dateValue = (value?: string | null) => {
    if (!value) return '';
    try { return new Date(value).toISOString().slice(0, 10); } catch { return ''; }
};

function StatusPill({ status }: { status?: string }) {
    const live = status === 'published';
    return (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[1rem] font-bold ${live
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-[#161616] dark:text-neutral-400'}`}
        >
            {live ? 'Published' : 'Draft'}
        </span>
    );
}

function RowCard({ title, subtitle, status, onOpen, onRemove, badge }: {
    title: string;
    subtitle?: string;
    status?: string;
    onOpen: () => void;
    onRemove: () => void;
    badge?: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5
                        transition-colors hover:border-slate-300 dark:border-[#2a2a2a]
                        dark:bg-[#0f0f0f]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                             bg-blue-50 text-[#2563EB] dark:bg-blue-950/40">
                <Newspaper className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
                <p className="truncate text-[1.25rem] font-bold text-slate-900 dark:text-white">
                    {title || 'Untitled'}
                </p>
                {subtitle && (
                    <p className="truncate text-[1rem] text-slate-500 dark:text-neutral-400">
                        {subtitle}
                    </p>
                )}
            </div>

            {badge && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[1rem]
                                 font-semibold text-slate-600 dark:bg-[#161616] dark:text-neutral-300">
                    {badge}
                </span>
            )}
            <StatusPill status={status} />

            <button
                type="button"
                onClick={onOpen}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5
                           text-[1rem] font-semibold text-blue-700 transition-colors
                           hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
                <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label="Delete"
                className="shrink-0 rounded p-2 text-red-500 transition-colors hover:bg-red-500/10"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}

export default function NewsManager() {
    const [tab, setTab] = useState<Tab>('news');
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [schemes, setSchemes] = useState<Scheme[]>([]);
    const [settings, setSettings] = useState<Partial<NewsSettings>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    /** The row being edited. `null` is the list; an object is the form. */
    const [article, setArticle] = useState<Partial<NewsArticle> | null>(null);
    const [scheme, setScheme] = useState<Partial<Scheme> | null>(null);

    /**
     * `quiet` refetches WITHOUT blanking the screen.
     *
     * The loading flag swaps the whole list for a spinner. On first open
     * that is right; after a write it throws the editor back to the top of
     * a long page, because the page briefly becomes short enough that the
     * browser clamps the scroll position.
     */
    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        setError('');
        try {
            const data = await listNewsAdmin();
            setNews(data.news || []);
            setSchemes(data.schemes || []);
            setSettings(data.settings || {});
        } catch (err) {
            setError(errorMessage(err, 'The newsroom could not be loaded'));
        } finally {
            if (!quiet) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const byTier = useMemo(() => ({
        national: schemes.filter((s) => s.tier === 'national'),
        state: schemes.filter((s) => s.tier === 'state'),
        district: schemes.filter((s) => s.tier === 'district'),
    }), [schemes]);

    const setA = (patch: Partial<NewsArticle>) => setArticle((a) => ({ ...(a || {}), ...patch }));
    const setS = (patch: Partial<Scheme>) => setScheme((s) => ({ ...(s || {}), ...patch }));

    const submitArticle = async () => {
        if (!article) return;
        setSaving(true);
        try {
            await saveArticle(article.id || null, article);
            cmsSaved('Article');
            setArticle(null);
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Article', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    const submitScheme = async () => {
        if (!scheme) return;
        setSaving(true);
        try {
            await saveScheme(scheme.id || null, scheme);
            cmsSaved('Scheme');
            setScheme(null);
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Scheme', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    const submitSettings = async () => {
        setSaving(true);
        try {
            await saveNewsSettings(settings);
            cmsSaved('Newsroom settings');
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Newsroom settings', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    const removeArticle = async (row: NewsArticle) => {
        /* A published article has been read by somebody; unpublishing is almost
           always what is meant, and it is reversible. The confirm names the
           title so a mis-click on a list of forty is survivable. */
        if (!window.confirm(`Delete “${row.title || 'Untitled'}”? This cannot be undone.`)) return;
        try {
            await deleteArticle(row.id);
            cmsDeleted('Article');
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Article', errorMessage(err, ''));
        }
    };

    const removeScheme = async (row: Scheme) => {
        if (!window.confirm(`Delete “${row.title || 'Untitled'}”? This cannot be undone.`)) return;
        try {
            await deleteScheme(row.id);
            cmsDeleted('Scheme');
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Scheme', errorMessage(err, ''));
        }
    };

    if (loading) return <CmsPage><CmsLoading /></CmsPage>;
    if (error) return <CmsPage><CmsError message={error} onRetry={load} /></CmsPage>;

    /* ------------------------------------------------------ the article form */
    if (article) {
        return (
            <CmsPage>
                <CmsCard
                    title={article.id ? 'Edit article' : 'New article'}
                    description="A headline, a photograph and the story. Nothing here is required — an article is written over several sittings, and Draft is what says it is not ready."
                >
                    <button
                        type="button"
                        onClick={() => setArticle(null)}
                        className="mb-6 inline-flex items-center gap-2 rounded-lg border
                                   border-slate-300 px-3.5 py-2 text-[1.0625rem] font-semibold
                                   text-slate-600 transition-colors hover:border-[#2563EB]
                                   hover:text-[#2563EB] dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> All articles
                    </button>

                    {/* 32px between the cards. Without it Section 4's last
                        field and Section 5's heading read as one column. */}
                    <CmsSteps>
                    <CmsStep step="Section 1" title="The story" hint="What a reader sees on the card and at the top of the article.">
                        <CmsField label="Headline">
                            <CmsInput
                                value={article.title || ''}
                                placeholder="ACTIV opens its Coimbatore chapter"
                                onChange={(e) => setA({ title: e.target.value })}
                            />
                        </CmsField>

                        <CmsField
                            label="Standfirst"
                            hint="The bold paragraph under the headline. Printed on the card too, so it has to work on its own."
                        >
                            <CmsTextarea
                                rows={3}
                                value={article.summary || ''}
                                onChange={(e) => setA({ summary: e.target.value })}
                            />
                        </CmsField>

                        <CmsField label="The article" hint="Leave a blank line between paragraphs.">
                            <CmsTextarea
                                rows={12}
                                value={article.body || ''}
                                onChange={(e) => setA({ body: e.target.value })}
                            />
                        </CmsField>
                    </CmsStep>

                    <CmsStep step="Section 2" title="Photograph" hint="Shown across the top of the article and on its card.">
                        <UploadField
                            label="Main picture"
                            url={article.image?.url || ''}
                            onChange={(url) => setA({
                                image: { ...(article.image || blankArticle().image!), url },
                            })}
                        />
                    </CmsStep>

                    <CmsStep
                        step="Section 3"
                        title="A link to another site"
                        hint="Fill this in and the card opens THAT page in a new tab instead of an article here — a YouTube video, a newspaper, a ministry notice. Leave it blank for a story of your own."
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <CmsField label="Link">
                                <CmsInput
                                    value={article.externalUrl || ''}
                                    placeholder="https://www.youtube.com/watch?v=…"
                                    onChange={(e) => setA({ externalUrl: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Where it goes" hint="Printed on the card, so the reader knows before clicking.">
                                <CmsInput
                                    value={article.sourceName || ''}
                                    placeholder="YouTube"
                                    onChange={(e) => setA({ sourceName: e.target.value })}
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep step="Section 4" title="When and where" hint="The date orders the newsroom. An article with no date leads the list.">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <CmsField label="Date">
                                <CmsInput
                                    type="date"
                                    value={dateValue(article.publishedAt)}
                                    onChange={(e) => setA({ publishedAt: e.target.value || null })}
                                />
                            </CmsField>
                            <CmsField label="Date as printed" hint="Leave blank to print the date above.">
                                <CmsInput
                                    value={article.displayDate || ''}
                                    placeholder="20 Jan 2026"
                                    onChange={(e) => setA({ displayDate: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Category" hint="Becomes a chip over the grid.">
                                <CmsInput
                                    value={article.category || ''}
                                    placeholder="Announcement"
                                    onChange={(e) => setA({ category: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Place">
                                <CmsInput
                                    value={article.location || ''}
                                    placeholder="Chennai"
                                    onChange={(e) => setA({ location: e.target.value })}
                                />
                            </CmsField>
                            <CmsField
                                label="State"
                                hint="Leave both blank for national news — it then appears under every filter."
                            >
                                <CmsInput
                                    value={article.state || ''}
                                    placeholder="Tamil Nadu"
                                    onChange={(e) => setA({ state: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="District">
                                <CmsInput
                                    value={article.district || ''}
                                    placeholder="Coimbatore"
                                    onChange={(e) => setA({ district: e.target.value })}
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep step="Section 5" title="Publishing">
                        <CmsCheck
                            checked={article.status === 'published'}
                            onChange={(on) => setA({ status: on ? 'published' : 'draft' })}
                            title="Published"
                            detail="Off means only you can see it, on the site as well as here."
                        />
                        <div className="mt-3">
                            <CmsCheck
                                checked={article.featured === true}
                                onChange={(featured) => setA({ featured })}
                                title="Lead the newsroom"
                                detail="Puts this in the wide card at the top, ahead of the newest."
                            />
                        </div>
                    </CmsStep>

                    {/*
                      LAST, and that is where it belongs.
                      
                      Everything above is a field the LAYOUT knows: the
                      headline is the heading, the date orders the newsroom,
                      the photograph runs across the top. These are the
                      editor's own, printed as labelled rows under the story
                      in the order they are entered.
                    */}
                    <CmsStep
                        step="Section 6"
                        title="Your own fields"
                        hint="Photographer, First published in, Correction — anything this article
                              should record that the fields above do not cover. Delete a row to
                              drop it."
                    >
                        <ExtraFieldsEditor
                            bare
                            items={article.extraFields || []}
                            onChange={(extraFields) => setA({ extraFields })}
                        />
                    </CmsStep>
                    </CmsSteps>

                    <div className="mt-8 flex gap-3">
                        <CmsButton onClick={submitArticle} disabled={saving}>
                            {saving ? 'Saving…' : 'Save article'}
                        </CmsButton>
                        <CmsButton variant="ghost" onClick={() => setArticle(null)}>Cancel</CmsButton>
                    </div>
                </CmsCard>
            </CmsPage>
        );
    }

    /* ------------------------------------------------------- the scheme form */
    if (scheme) {
        return (
            <CmsPage>
                <CmsCard
                    title={scheme.id ? 'Edit scheme' : 'New scheme'}
                    description="Something a member can apply to. The tier decides which band of the page it appears in."
                >
                    <button
                        type="button"
                        onClick={() => setScheme(null)}
                        className="mb-6 inline-flex items-center gap-2 rounded-lg border
                                   border-slate-300 px-3.5 py-2 text-[1.0625rem] font-semibold
                                   text-slate-600 transition-colors hover:border-[#2563EB]
                                   hover:text-[#2563EB] dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> All schemes
                    </button>

                    {/* The same 32px gap the article editor has. */}
                    <CmsSteps>

                    <CmsStep
                        step="Section 1"
                        title="Which tier"
                        hint="National schemes appear for everybody. A state or district scheme appears for members there — and this is stored, not worked out from the fields below, because a national scheme run from Chennai is still national."
                    >
                        <div className="grid gap-3 sm:grid-cols-3">
                            {(['national', 'state', 'district'] as const).map((tier) => (
                                <button
                                    key={tier}
                                    type="button"
                                    onClick={() => setS({ tier })}
                                    className={`rounded-xl border px-4 py-3 text-left text-[1.125rem]
                                                font-bold capitalize transition-colors ${
                                        scheme.tier === tier
                                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB] dark:bg-blue-950/30'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-[#2a2a2a] dark:text-neutral-300'}`}
                                >
                                    {tier}
                                </button>
                            ))}
                        </div>

                        {scheme.tier !== 'national' && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <CmsField label="State">
                                    <CmsInput
                                        value={scheme.state || ''}
                                        placeholder="Tamil Nadu"
                                        onChange={(e) => setS({ state: e.target.value })}
                                    />
                                </CmsField>
                                {scheme.tier === 'district' && (
                                    <CmsField label="District">
                                        <CmsInput
                                            value={scheme.district || ''}
                                            placeholder="Coimbatore"
                                            onChange={(e) => setS({ district: e.target.value })}
                                        />
                                    </CmsField>
                                )}
                            </div>
                        )}
                    </CmsStep>

                    <CmsStep step="Section 2" title="The scheme">
                        <CmsField label="Name">
                            <CmsInput
                                value={scheme.title || ''}
                                placeholder="Credit Guarantee Scheme for Micro Enterprises"
                                onChange={(e) => setS({ title: e.target.value })}
                            />
                        </CmsField>
                        <CmsField label="What it offers" hint="Two or three lines. Printed on the card.">
                            <CmsTextarea
                                rows={3}
                                value={scheme.summary || ''}
                                onChange={(e) => setS({ summary: e.target.value })}
                            />
                        </CmsField>
                        <CmsField label="Who it is for">
                            <CmsTextarea
                                rows={2}
                                value={scheme.eligibility || ''}
                                placeholder="Registered MSMEs with fewer than 50 employees"
                                onChange={(e) => setS({ eligibility: e.target.value })}
                            />
                        </CmsField>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <CmsField label="Run by">
                                <CmsInput
                                    value={scheme.authority || ''}
                                    placeholder="Ministry of MSME"
                                    onChange={(e) => setS({ authority: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Closing date" hint="Free text: “Open”, “Closes 31 Mar 2026”.">
                                <CmsInput
                                    value={scheme.deadline || ''}
                                    placeholder="Open"
                                    onChange={(e) => setS({ deadline: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Where to apply" hint="Opens in a new tab.">
                                <CmsInput
                                    value={scheme.applyUrl || ''}
                                    placeholder="https://…"
                                    onChange={(e) => setS({ applyUrl: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Notification or form">
                                <CmsInput
                                    value={scheme.documentUrl || ''}
                                    placeholder="https://…"
                                    onChange={(e) => setS({ documentUrl: e.target.value })}
                                />
                            </CmsField>
                        </div>
                    </CmsStep>

                    <CmsStep step="Section 3" title="Publishing">
                        <CmsCheck
                            checked={scheme.status === 'published'}
                            onChange={(on) => setS({ status: on ? 'published' : 'draft' })}
                            title="Published"
                            detail="Off means only you can see it."
                        />
                    </CmsStep>

                    {/*
                      A scheme is a government instrument and every department
                      describes one differently — a circular number, a subsidy
                      rate, the order that superseded it. A fixed set of
                      columns is a set that is wrong for the next scheme.
                    */}
                    <CmsStep
                        step="Section 4"
                        title="Your own fields"
                        hint="Circular no., Sanctioned by, Subsidy, Superseded by — anything this
                              scheme should record that the fields above do not cover. Delete a
                              row to drop it."
                    >
                        <ExtraFieldsEditor
                            bare
                            items={scheme.extraFields || []}
                            onChange={(extraFields) => setS({ extraFields })}
                        />
                    </CmsStep>
                    </CmsSteps>

                    <div className="mt-8 flex gap-3">
                        <CmsButton onClick={submitScheme} disabled={saving}>
                            {saving ? 'Saving…' : 'Save scheme'}
                        </CmsButton>
                        <CmsButton variant="ghost" onClick={() => setScheme(null)}>Cancel</CmsButton>
                    </div>
                </CmsCard>
            </CmsPage>
        );
    }

    /* ------------------------------------------------------------- the lists */
    return (
        <CmsPage>
            <CmsCard
                title="News & Schemes"
                description="The newsroom at /news — the articles, the schemes under them, and the page's own wording. An article with a link to another site opens that site instead of a page here."
            >
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#1f1f1f]">
                    {([
                        ['news', 'Articles', news.length],
                        ['schemes', 'Schemes', schemes.length],
                        ['settings', 'Page wording', null],
                    ] as [Tab, string, number | null][]).map(([key, label, count]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`-mb-px border-b-2 px-5 py-3 text-[1.25rem] font-semibold
                                        transition-colors ${tab === key
                                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200'}`}
                        >
                            {label}
                            {count !== null && (
                                <span className="ml-2 text-[1.1875rem] text-slate-400">{count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {tab === 'news' && (
                    <div className="space-y-3">
                        <div className="flex justify-end">
                            <CmsButton onClick={() => setArticle(blankArticle())}>
                                <Plus className="h-4 w-4" /> New article
                            </CmsButton>
                        </div>

                        {news.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-300 p-8
                                          text-center text-[1.25rem] text-slate-500
                                          dark:border-[#2a2a2a]">
                                No articles yet.
                            </p>
                        ) : news.map((row) => (
                            <RowCard
                                key={row.id}
                                title={row.title}
                                subtitle={[row.displayDate, row.category, row.state, row.district]
                                    .filter(Boolean).join(' · ')}
                                status={row.status}
                                badge={row.externalUrl ? 'Link' : undefined}
                                onOpen={() => setArticle(row)}
                                onRemove={() => removeArticle(row)}
                            />
                        ))}
                    </div>
                )}

                {tab === 'schemes' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            <CmsButton onClick={() => setScheme(blankScheme())}>
                                <Plus className="h-4 w-4" /> New scheme
                            </CmsButton>
                        </div>

                        {(['national', 'state', 'district'] as const).map((tier) => (
                            <div key={tier}>
                                {/* The tier, and no count beside it.

                                    The number was decoration: the schemes at
                                    that tier are listed directly underneath,
                                    so it counted something already on screen
                                    — and it read as part of the heading,
                                    "national 4". An empty tier still says so
                                    in words, which is the only case the count
                                    was answering. */}
                                <h3 className={`${CARD_TITLE} mb-3 capitalize text-slate-900 dark:text-white`}>
                                    {tier}
                                </h3>
                                {byTier[tier].length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-300 p-5
                                                  text-[1.125rem] text-slate-400 dark:border-[#2a2a2a]">
                                        Nothing at this tier yet.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {byTier[tier].map((row) => (
                                            <RowCard
                                                key={row.id}
                                                title={row.title}
                                                subtitle={[row.authority, row.deadline, row.state, row.district]
                                                    .filter(Boolean).join(' · ')}
                                                status={row.status}
                                                onOpen={() => setScheme(row)}
                                                onRemove={() => removeScheme(row)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'settings' && (
                    <SectionToolsProvider
                        value={{
                            sections: settings.sections || [],
                            onChange: (sections) => setSettings({ ...settings, sections }),
                        }}
                    >
                    <div>
                        <CmsStep sectionKey="news.header" step="Section 1" title="The band at the top" hint="What the newsroom opens with.">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <CmsField label="Small label">
                                    <CmsInput
                                        value={settings.badgeText || ''}
                                        placeholder="Newsroom"
                                        onChange={(e) => setSettings({ ...settings, badgeText: e.target.value })}
                                    />
                                </CmsField>
                                <CmsField label="Icon" hint="A name from the CMS icon set.">
                                    <CmsInput
                                        value={settings.badgeIcon || ''}
                                        placeholder="newspaper"
                                        onChange={(e) => setSettings({ ...settings, badgeIcon: e.target.value })}
                                    />
                                </CmsField>
                                <CmsField label="Heading">
                                    <CmsInput
                                        value={settings.heading || ''}
                                        onChange={(e) => setSettings({ ...settings, heading: e.target.value })}
                                    />
                                </CmsField>
                                <CmsField label="Heading, highlighted" hint="Drawn in the accent colour after the heading.">
                                    <CmsInput
                                        value={settings.headingHighlight || ''}
                                        onChange={(e) => setSettings({ ...settings, headingHighlight: e.target.value })}
                                    />
                                </CmsField>
                            </div>

                            <CmsField label="Description" hint="Three lines at most — the band clamps it.">
                                <CmsTextarea
                                    rows={3}
                                    value={settings.description || ''}
                                    onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                                />
                            </CmsField>

                            {/*
                              * THE CHIPS OVER THE GRID, and they had no editor.
                              *
                              * The field was on the record and read by the page
                              * from the day the newsroom was built, and nothing
                              * on this screen could set it — so the chips fell
                              * back to whatever categories the articles happened
                              * to carry, in whatever order they came out of the
                              * database. Named here, they are the association’s
                              * own words in the association’s own order.
                              *
                              * Left empty, the fallback still applies, which is
                              * why this is not a required field.
                              */}
                            <LineList
                                label="Filter chips"
                                hint="One per line, in the order they appear. Leave empty and the chips are built from the categories the articles carry."
                                value={settings.categories || []}
                                onChange={(categories) => setSettings({ ...settings, categories })}
                                placeholder={'Chapters\nPolicy\nSkills\nEvents'}
                                clearable
                            />

                            <UploadField
                                label="Background picture"
                                url={settings.heroImage?.url || ''}
                                onChange={(url) => setSettings({
                                    ...settings,
                                    heroImage: {
                                        url, type: 'image', alt: '', fit: 'cover', position: 'center',
                                    },
                                })}
                            />
                        </CmsStep>

                        <CmsStep
                            sectionKey="news.schemes"
                            step="Section 2"
                            title="The schemes band"
                            hint="The heading over the three tiers. The tiers themselves are always drawn — a tier with nothing in it says so rather than disappearing."
                        >
                            <CmsField label="Heading">
                                <CmsInput
                                    value={settings.schemesHeading || ''}
                                    placeholder="Schemes & Benefits"
                                    onChange={(e) => setSettings({ ...settings, schemesHeading: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Description">
                                <CmsTextarea
                                    rows={2}
                                    value={settings.schemesDescription || ''}
                                    onChange={(e) => setSettings({ ...settings, schemesDescription: e.target.value })}
                                />
                            </CmsField>
                        </CmsStep>

                        <div className="mt-8 flex items-center gap-3">
                            <CmsButton onClick={submitSettings} disabled={saving}>
                                {saving ? 'Saving…' : 'Save wording'}
                            </CmsButton>
                            <a
                                href="/news"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[1.0625rem]
                                           font-semibold text-blue-700 dark:text-blue-400"
                            >
                                View the newsroom <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </div>
                    </SectionToolsProvider>
                )}
            </CmsCard>
        </CmsPage>
    );
}
