import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Plus, Pencil, Trash2, ChevronUp, ChevronDown, History, RotateCcw, Eye, EyeOff,
    ExternalLink, AlertTriangle,
} from 'lucide-react';
import {
    CmsPage, CmsCard, CmsSection, CmsField, CmsInput, CmsTextarea, CmsButton,
    SaveButton, CmsLoading, CmsError, CmsEmpty, cmsSaved, cmsFailed, cmsDone,
    CmsStep,
    CmsSteps,
} from './components/CmsUI';
import {
    getLegalDocuments, saveLegalDocument, getLegalRevisions, restoreLegalRevision,
    retireLegalDocument,
    type LegalDocument, type LegalSection, type LegalRevision,
} from '@/services/cmsApi';
import { ExtraFieldsEditor } from './components/CmsEditors';
import { errorMessage } from '@/services/api';

/**
 * The association's legal notices — Privacy, Terms, Return, Cancellation.
 *
 * =========================================================================
 * WHY THIS SCREEN IS NOT LIKE THE OTHER SEVEN
 * =========================================================================
 *
 * Every other CMS screen edits marketing copy: a wrong headline is embarrassing
 * for an afternoon. This one edits the terms members and event bookers agree
 * to, and the question that matters about those is not "what do they say?" but
 * "what did they say on the day somebody agreed?" — which an ordinary content
 * box, overwritten in place, destroys the answer to.
 *
 * So three things here have no counterpart elsewhere in the CMS:
 *
 *   Every save ARCHIVES the previous wording, with the editor's name, the date
 *   and their note. The history panel lists them and any of them can be put
 *   back. Restoring is itself a save, so the version number goes up and the
 *   text it replaced is archived in its turn — the history stays a sequence
 *   rather than a thing that can be rewound over.
 *
 *   `effectiveFrom` is the EDITOR's date, separate from when the row was last
 *   touched. Fixing a typo does not change the date terms took effect, and a
 *   date that moved every time somebody corrected a comma would be useless as
 *   evidence of anything. It is left blank until somebody deliberately sets it.
 *
 *   Unpublishing, never deleting. A member agreed to a policy at a URL.
 *
 * =========================================================================
 * PARAGRAPHS ARE ONE PER LINE
 * =========================================================================
 *
 * The server stores `body` and `bullets` as arrays of strings and the textareas
 * here are joined and split on newlines — the same convention every other list
 * field in this CMS uses ("the admin forms send one item per line"). An array
 * rather than one blob means the renderer decides paragraph spacing from the
 * data instead of from `white-space: pre-line`, which collapses differently in
 * every browser.
 */

/** A blank clause, for the "Add clause" button. */
const emptySection = (): LegalSection => ({ heading: '', body: [], bullets: [], links: [] });

/** `Privacy Policy` -> `privacy-policy`, matching the server's own cleaner. */
const slugify = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

/** `2026-09-13` for a date input, from whatever the API returned. */
const toDateInput = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const formatWhen = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

export default function LegalManager() {
    const [docs, setDocs] = useState<LegalDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [slug, setSlug] = useState('');
    /** The document being edited. `null` until one is chosen or created. */
    const [draft, setDraft] = useState<LegalDocument | null>(null);
    const [changeNote, setChangeNote] = useState('');
    const [saving, setSaving] = useState(false);

    const [revisions, setRevisions] = useState<LegalRevision[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [restoring, setRestoring] = useState(0);

    /* --------------------------------------------------------------- load */

    const load = useCallback(() => {
        setLoading(true);
        setLoadError('');

        getLegalDocuments()
            .then((rows) => {
                setDocs(rows || []);
                setLoading(false);
            })
            .catch((error) => {
                setLoadError(errorMessage(error, 'The policies could not be loaded'));
                setLoading(false);
            });
    }, []);

    useEffect(() => { load(); }, [load]);

    /**
     * ======================================================================
     * THIS IS WHY "NEW POLICY" APPEARED TO DO NOTHING
     * ======================================================================
     *
     * The effect below opens the screen on the first policy rather than on an
     * empty editor, which is right on arrival. It keyed on `!slug` alone — and
     * `startNew` CLEARS the slug, because a policy that has not been saved has
     * no slug yet.
     *
     * So the sequence was: press New policy, the draft becomes a blank
     * document, this effect sees an empty slug, selects "Privacy Policy", and
     * the effect below THAT loads Privacy Policy over the blank draft. The
     * screen ended exactly where it started, with no error anywhere, which is
     * precisely what was reported.
     *
     * `creating` is the flag that tells the two apart: no slug because nothing
     * has been chosen yet, against no slug because a new policy is being
     * written. Cleared the moment an existing policy is opened, or the new one
     * is saved and has a slug of its own.
     */
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (creating) return;
        if (!slug && docs.length) setSlug(docs[0].slug);
    }, [docs, slug, creating]);

    /**
     * Load the chosen document into the draft.
     *
     * Keyed on `slug` alone, NOT on `docs`. Including the list would reset the
     * editor's unsaved work every time the list refreshed — which it does after
     * every save, so a second edit would be discarded the moment the first one
     * landed.
     */
    useEffect(() => {
        if (!slug) return;
        const found = docs.find((d) => d.slug === slug);
        if (found) {
            setDraft(JSON.parse(JSON.stringify(found)));
            setChangeNote('');
            setShowHistory(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    useEffect(() => {
        if (!showHistory || !slug) return;
        getLegalRevisions(slug)
            .then(setRevisions)
            .catch(() => setRevisions([]));
    }, [showHistory, slug]);

    /* -------------------------------------------------------------- edits */

    const set = (patch: Partial<LegalDocument>) =>
        setDraft((current) => (current ? { ...current, ...patch } : current));

    const setSection = (index: number, patch: Partial<LegalSection>) =>
        setDraft((current) => (current
            ? {
                ...current,
                sections: current.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
            }
            : current));

    const addSection = () =>
        setDraft((current) => (current
            ? { ...current, sections: [...current.sections, emptySection()] }
            : current));

    const removeSection = (index: number) =>
        setDraft((current) => (current
            ? { ...current, sections: current.sections.filter((_, i) => i !== index) }
            : current));

    /** Move a clause up or down. Clamped, so the ends are simply no-ops. */
    const moveSection = (index: number, by: -1 | 1) =>
        setDraft((current) => {
            if (!current) return current;
            const next = index + by;
            if (next < 0 || next >= current.sections.length) return current;
            const sections = [...current.sections];
            [sections[index], sections[next]] = [sections[next], sections[index]];
            return { ...current, sections };
        });

    /* --------------------------------------------------------------- save */

    const save = async (submit: React.FormEvent) => {
        submit.preventDefault();
        if (!draft) return;

        setSaving(true);
        try {
            await saveLegalDocument(draft.slug, { ...draft, changeNote });
            cmsSaved(draft.title || 'Policy');
            setChangeNote('');
            /* A new policy has a slug now, so it stops being “new” and the
               editor follows the saved row — otherwise the screen keeps
               showing an unsaved draft of something that exists. */
            setCreating(false);
            setSlug(draft.slug);
            load();
            if (showHistory) getLegalRevisions(draft.slug).then(setRevisions).catch(() => {});
        } catch (error) {
            cmsFailed(draft.title || 'Policy', errorMessage(error, ''));
        } finally {
            setSaving(false);
        }
    };

    const restore = async (version: number) => {
        if (!draft) return;
        setRestoring(version);
        try {
            const restored = await restoreLegalRevision(draft.slug, version);
            setDraft(JSON.parse(JSON.stringify(restored)));
            cmsSaved(`Version ${version}`);
            load();
            getLegalRevisions(draft.slug).then(setRevisions).catch(() => {});
        } catch (error) {
            cmsFailed('Restore', errorMessage(error, ''));
        } finally {
            setRestoring(0);
        }
    };

    /**
     * Start a new policy.
     *
     * Held in the draft and not written until Save, so an editor who clicks
     * "New policy" and changes their mind has not created an empty document on
     * the public site.
     */
    const startNew = () => {
        const fresh: LegalDocument = {
            slug: '',
            title: '',
            lede: '',
            footerLabel: '',
            sections: [emptySection()],
            status: 'draft',
            // Ten past the last one, so it lands at the end of the footer with
            // nine numbers free before it — see the seed's note on spacing.
            order: (docs.reduce((n, d) => Math.max(n, d.order), 0) || 0) + 10,
            effectiveFrom: null,
            version: 0,
            updatedAt: null,
        };
        setCreating(true);
        setSlug('');
        setDraft(fresh);
        setChangeNote('');
        setShowHistory(false);

        /*
         * SHOW THEM THE FORM THEY JUST ASKED FOR.
         *
         * The editor opens below the fold and the chip row cannot grow a new
         * chip — an unsaved policy is deliberately not written yet — so from
         * where the editor is standing, pressing the button did nothing at
         * all. That is the whole of “why can I not add a new policy”.
         *
         * After paint, not during: the card does not exist until this state
         * change has rendered.
         */
        requestAnimationFrame(() => {
            document.getElementById('legal-editor')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    /** Open an existing policy, and scroll to it for the same reason. */
    const openPolicy = (next: string) => {
        setCreating(false);
        setSlug(next);
        setShowHistory(false);
        requestAnimationFrame(() => {
            document.getElementById('legal-editor')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    /**
     * Take a policy off the site, or put it back.
     *
     * `DELETE /legal/:slug` UNPUBLISHES rather than deleting, and the
     * confirmation says so. A member agreed to a policy at a URL: a deleted
     * row makes that reference point at nothing, and takes with it the one
     * thing an editor would need to turn the page back on.
     */
    const [removing, setRemoving] = useState('');

    const removePolicy = async (doc: LegalDocument) => {
        const ok = window.confirm(
            `Take “${doc.title || doc.slug}” off the site?`
            + '\n\nIt stops appearing in the footer and its page stops resolving.'
            + '\n\nThe wording and its whole history are KEPT, so you can put it'
            + ' back from this screen at any time.',
        );
        if (!ok) return;

        setRemoving(doc.slug);
        try {
            await retireLegalDocument(doc.slug);
            cmsDone(`“${doc.title || doc.slug}” is off the site`,
                'Its wording is kept. Press Restore to put it back.');
            await load();
        } catch (error) {
            cmsFailed('the policy', errorMessage(error, ''));
        } finally {
            setRemoving('');
        }
    };

    /** Publish it again. The same save every other edit goes through. */
    const restorePolicy = async (doc: LegalDocument) => {
        setRemoving(doc.slug);
        try {
            await saveLegalDocument(doc.slug, {
                ...doc,
                status: 'published',
                changeNote: 'Put back on the site',
            });
            cmsDone(`“${doc.title || doc.slug}” is back on the site`);
            await load();
        } catch (error) {
            cmsFailed('the policy', errorMessage(error, ''));
        } finally {
            setRemoving('');
        }
    };

    const publicUrl = useMemo(() => (draft?.slug ? `/${draft.slug}` : ''), [draft?.slug]);

    /* ------------------------------------------------------------- render */

    if (loading) return <CmsPage><CmsLoading label="Loading policies…" /></CmsPage>;
    if (loadError) return <CmsPage><CmsError message={loadError} onRetry={load} /></CmsPage>;

    return (
        <CmsPage>
            {/* ------------------------------------------------ the list */}
            <CmsCard
                title="Legal notices"
                description={
                    'Privacy, Terms, refunds and cancellation. Every save keeps the previous '
                    + 'wording, so you can always see — and restore — what a policy said before.'
                }
                actions={
                    <CmsButton type="button" variant="ghost" onClick={startNew}>
                        <Plus className="w-4 h-4" /> New policy
                    </CmsButton>
                }
            >
                {!docs.length && (
                    <CmsEmpty
                        title="No policies yet"
                        hint="Create one and it appears in the site footer as soon as it is published."
                    />
                )}

                {/*
                  * EACH POLICY CARRIES ITS OWN ACTIONS.
                  *
                  * These were bare chips: clicking one selected it for editing,
                  * which is not a thing a chip looks like it does, and there was
                  * no way at all to take a policy off the site. A row with Edit
                  * and Remove on it says what can be done without being tried.
                  */}
                {!!docs.length && (
                    <div className="space-y-2">
                        {docs.map((d) => (
                            <div
                                key={d.slug}
                                className={
                                    'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 '
                                    + (slug === d.slug
                                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/25'
                                        : 'border-slate-200 dark:border-[#262626]')
                                }
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[1.25rem] font-bold text-slate-900 dark:text-white">
                                        {d.title || d.slug}
                                    </p>
                                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[1.0625rem]
                                                  text-neutral-500">
                                        <span>/{d.slug}</span>
                                        <span>·</span>
                                        <span>Version {d.version}</span>
                                        {/* A draft is invisible to the public site, and that
                                            has to be visible HERE or an editor cannot tell
                                            why their page 404s for everybody else. */}
                                        {d.status === 'draft' && (
                                            <span className="inline-flex items-center gap-1 rounded-full
                                                             bg-amber-100 px-2 py-0.5 text-[1rem] font-semibold
                                                             text-amber-800 dark:bg-amber-950/50
                                                             dark:text-amber-300">
                                                <EyeOff className="w-3 h-3" /> Off the site
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                    <CmsButton type="button" variant="ghost" onClick={() => openPolicy(d.slug)}>
                                        <Pencil className="w-4 h-4" /> Edit
                                    </CmsButton>

                                    {d.status === 'draft' ? (
                                        <CmsButton
                                            type="button"
                                            variant="ghost"
                                            disabled={removing === d.slug}
                                            onClick={() => restorePolicy(d)}
                                        >
                                            <RotateCcw className="w-4 h-4" /> Restore
                                        </CmsButton>
                                    ) : (
                                        <CmsButton
                                            type="button"
                                            variant="danger"
                                            disabled={removing === d.slug}
                                            onClick={() => removePolicy(d)}
                                        >
                                            <Trash2 className="w-4 h-4" /> Remove
                                        </CmsButton>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CmsCard>

            {/* ------------------------------------------------ the editor */}
            {draft && (
                /* The anchor `startNew` and `openPolicy` scroll to. Without it,
                   pressing "New policy" opened this card below the fold and
                   left the page where it was — so the button read as broken. */
                <form onSubmit={save} id="legal-editor" className="scroll-mt-6">
                    <CmsCard
                        title={draft.version
                            ? `Editing “${draft.title || draft.slug}”`
                            : 'New policy — not written yet'}
                        description={
                            draft.version
                                ? `Version ${draft.version}. Saving archives the current wording first.`
                                : 'Fill this in and press Save. Nothing appears in the list above, '
                                  + 'or on the site, until you do.'
                        }
                        actions={
                            <div className="flex gap-2">
                                {!!draft.version && publicUrl && (
                                    <a
                                        href={publicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                                                   text-[1.1875rem] font-medium bg-slate-100 dark:bg-[#1A1A1A]
                                                   text-slate-800 dark:text-[#E4E4E7] hover:bg-slate-200
                                                   dark:hover:bg-[#262626] transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" /> View page
                                    </a>
                                )}
                                {!!draft.version && (
                                    <CmsButton
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setShowHistory((v) => !v)}
                                    >
                                        <History className="w-4 h-4" />
                                        {showHistory ? 'Hide history' : 'History'}
                                    </CmsButton>
                                )}
                                <SaveButton loading={saving} />
                            </div>
                        }
                    >
                        {/* The 32px gap the other screens have. Without it a
                            card's last field and the next card's heading read
                            as one column. */}
                        <CmsSteps>
                        {/*
                          A SAVE ON EVERY CARD, and each of them saves the WHOLE
                          policy.

                          The form is four cards and a clause editor long, so the
                          button in the card header at the top is off the screen
                          wherever the work actually is. The label says “Save
                          policy” and not “Save section” because a policy is one
                          versioned row — there is no such thing as saving a
                          third of it, and a button implying otherwise would be
                          the lie.
                        */}
                        <CmsStep
                            step="Section 1"
                            title="The page"
                            hint="How this policy is titled and where it lives."
                            actions={<SaveButton loading={saving} label="Save policy" />}
                        >
                            <div className="grid sm:grid-cols-2 gap-4">
                                <CmsField label="Title" hint="The heading on the page, and the browser tab.">
                                    <CmsInput
                                        value={draft.title}
                                        onChange={(e) => {
                                            const title = e.target.value;
                                            // The slug follows the title ONLY while the document
                                            // is new. Changing it on a live policy would change
                                            // its URL and break every link anybody has to it.
                                            set(draft.version
                                                ? { title }
                                                : { title, slug: slugify(title) });
                                        }}
                                        placeholder="Privacy Policy"
                                    />
                                </CmsField>

                                <CmsField
                                    label="Web address"
                                    hint={draft.version
                                        ? 'Changing this changes the page’s URL. Existing links to it stop working.'
                                        : `The page will be at /${draft.slug || '…'}`}
                                >
                                    <CmsInput
                                        value={draft.slug}
                                        onChange={(e) => set({ slug: slugify(e.target.value) })}
                                        placeholder="privacy-policy"
                                    />
                                </CmsField>

                                <CmsField label="Intro line" hint="The sentence under the title.">
                                    <CmsInput
                                        value={draft.lede}
                                        onChange={(e) => set({ lede: e.target.value })}
                                        placeholder="How ACTIV collects and protects your information."
                                    />
                                </CmsField>

                                <CmsField
                                    label="Footer label"
                                    hint="Leave empty to use the title."
                                >
                                    <CmsInput
                                        value={draft.footerLabel}
                                        onChange={(e) => set({ footerLabel: e.target.value })}
                                        placeholder={draft.title || 'Privacy Policy'}
                                    />
                                </CmsField>

                                <CmsField
                                    label="In effect from"
                                    hint="The date this WORDING took effect. Leave empty if it is not being changed — correcting a typo does not move this date."
                                >
                                    <CmsInput
                                        type="date"
                                        value={toDateInput(draft.effectiveFrom)}
                                        onChange={(e) => set({ effectiveFrom: e.target.value || null })}
                                    />
                                </CmsField>

                                <CmsField label="Order in the footer" hint="Lower numbers come first.">
                                    <CmsInput
                                        type="number"
                                        value={String(draft.order)}
                                        onChange={(e) => set({ order: parseInt(e.target.value, 10) || 0 })}
                                    />
                                </CmsField>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <CmsButton
                                    type="button"
                                    variant={draft.status === 'published' ? 'ghost' : 'primary'}
                                    onClick={() => set({
                                        status: draft.status === 'published' ? 'draft' : 'published',
                                    })}
                                >
                                    {draft.status === 'published'
                                        ? <><EyeOff className="w-4 h-4" /> Unpublish</>
                                        : <><Eye className="w-4 h-4" /> Publish</>}
                                </CmsButton>

                                <p className="text-[1.0625rem] text-slate-500 dark:text-[#A1A1AA]">
                                    {draft.status === 'published'
                                        ? 'Live on the public site and listed in the footer.'
                                        : 'Hidden from the public site and from the footer.'}
                                </p>
                            </div>
                        </CmsStep>

                        {/* ------------------------------------ the clauses */}
                        <CmsStep
                            step="Section 2"
                            title="The document"
                            hint="One clause per heading. Paragraphs and bullets are one per line."
                            actions={
                                <div className="flex flex-wrap gap-2">
                                    <CmsButton type="button" variant="ghost" onClick={addSection}>
                                        <Plus className="w-4 h-4" /> Add clause
                                    </CmsButton>
                                    <SaveButton loading={saving} label="Save policy" />
                                </div>
                            }
                        >
                            <div className="space-y-4">
                                {draft.sections.map((section, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl border border-slate-200 dark:border-[#262626]
                                                   bg-slate-50/60 dark:bg-[#0A0A0A] p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            {/*
                                              CLAUSE, not “Section”.
                                              
                                              The cards down this screen are numbered
                                              “Section 1” to “Section 4”, and these rows
                                              were numbered the same way inside one of
                                              them — so a fourteen-clause policy printed
                                              “Section 2” through “Section 14” between
                                              the screen’s own Section 2 and Section 3,
                                              and the numbering read as one broken run.
                                            */}
                                            <span className="text-[1.0625rem] font-semibold uppercase tracking-wider
                                                             text-slate-400 dark:text-[#52525B] pt-2">
                                                Clause {i + 1}
                                                {!section.heading && ' — no heading'}
                                            </span>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => moveSection(i, -1)}
                                                    disabled={i === 0}
                                                    aria-label="Move section up"
                                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-200
                                                               dark:hover:bg-[#262626] disabled:opacity-30 transition-colors"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveSection(i, 1)}
                                                    disabled={i === draft.sections.length - 1}
                                                    aria-label="Move section down"
                                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-200
                                                               dark:hover:bg-[#262626] disabled:opacity-30 transition-colors"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeSection(i)}
                                                    aria-label="Remove section"
                                                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50
                                                               hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <CmsField
                                                label="Heading"
                                                hint="Leave empty for an opening run of paragraphs with no heading."
                                            >
                                                <CmsInput
                                                    value={section.heading}
                                                    onChange={(e) => setSection(i, { heading: e.target.value })}
                                                    placeholder="Consent"
                                                />
                                            </CmsField>

                                            <CmsField label="Paragraphs" hint="One paragraph per line.">
                                                <CmsTextarea
                                                    rows={Math.min(12, Math.max(3, section.body.length + 1))}
                                                    value={section.body.join('\n')}
                                                    onChange={(e) => setSection(i, {
                                                        body: e.target.value.split('\n'),
                                                    })}
                                                    placeholder="By using our website, you consent to this policy."
                                                />
                                            </CmsField>

                                            <CmsField label="Bullet points" hint="One bullet per line. Leave empty for none.">
                                                <CmsTextarea
                                                    rows={Math.min(12, Math.max(2, section.bullets.length + 1))}
                                                    value={section.bullets.join('\n')}
                                                    onChange={(e) => setSection(i, {
                                                        bullets: e.target.value.split('\n'),
                                                    })}
                                                />
                                            </CmsField>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CmsStep>

                        {/* ------------------------------------ the note */}
                        {/*
                          A notice often carries one statutory line that is not a
                          clause — a governing law, a grievance officer, a
                          registered address — and putting it in a numbered
                          section makes it read as part of the agreement.
                          Printed as labelled rows at the foot of the policy.
                        */}
                        <CmsStep
                            step="Section 3"
                            title="Your own fields"
                            hint="Governing law, Grievance officer, Registered address, Last reviewed by —
                                  anything this notice should state that is not one of its clauses.
                                  Delete a row to drop it."
                            actions={<SaveButton loading={saving} label="Save policy" />}
                        >
                            <ExtraFieldsEditor
                                bare
                                items={draft.extraFields || []}
                                onChange={(extraFields) => set({ extraFields })}
                            />
                        </CmsStep>

                        <CmsStep
                            step="Section 4"
                            title="What changed"
                            hint="Stored against the wording you are replacing. This is what the history list shows."
                            actions={<SaveButton loading={saving} label="Save policy" />}
                        >
                            <CmsField label="Note" hint="Optional, and worth a sentence on anything but a typo.">
                                <CmsInput
                                    value={changeNote}
                                    onChange={(e) => setChangeNote(e.target.value)}
                                    placeholder="Reworded the refund window from 14 to 30 days"
                                />
                            </CmsField>
                        </CmsStep>
                        </CmsSteps>

                        {/*
                          SAVE AT THE BOTTOM AS WELL AS THE TOP.
                          
                          This form is four cards and a clause editor long, so
                          the button in the card header is off the screen by the
                          time anybody has finished writing — which is the
                          position an editor is actually in when they want it.
                          The same button, not a second save path.
                        */}
                        <div className="mt-8 flex flex-wrap items-center gap-3 border-t
                                        border-slate-200 pt-6 dark:border-[#1f1f1f]">
                            <SaveButton loading={saving} />
                            <CmsButton type="button" variant="ghost" onClick={() => setDraft(null)}>
                                Cancel
                            </CmsButton>
                            {!!draft.version && (
                                <span className="text-[1.0625rem] text-neutral-500">
                                    Saving archives version {draft.version} first — nothing is overwritten.
                                </span>
                            )}
                        </div>
                    </CmsCard>
                </form>
            )}

            {/* ------------------------------------------------ the history */}
            {draft && showHistory && (
                <CmsCard
                    title="History"
                    description={
                        'What this policy said before each save. Restoring brings a wording back '
                        + 'as a new version — nothing in the history is overwritten.'
                    }
                >
                    {!revisions.length && (
                        <CmsEmpty
                            title="No earlier versions"
                            hint="This policy has not been changed since it was created."
                        />
                    )}

                    <div className="space-y-2">
                        {revisions.map((r) => (
                            <div
                                key={r.version}
                                className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between
                                           rounded-xl border border-slate-200 dark:border-[#262626] px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="text-[1.1875rem] font-semibold text-slate-900 dark:text-white">
                                        Version {r.version}
                                        <span className="ml-2 font-normal text-slate-500 dark:text-[#A1A1AA]">
                                            {r.sectionCount} section{r.sectionCount === 1 ? '' : 's'} ·{' '}
                                            {r.wordCount.toLocaleString('en-GB')} words
                                        </span>
                                    </p>
                                    <p className="text-[1.0625rem] text-slate-500 dark:text-[#A1A1AA] mt-0.5">
                                        {formatWhen(r.savedAt)}
                                        {r.savedBy ? ` · ${r.savedBy}` : ''}
                                        {r.note ? ` · ${r.note}` : ''}
                                    </p>
                                </div>

                                <CmsButton
                                    type="button"
                                    variant="ghost"
                                    loading={restoring === r.version}
                                    onClick={() => restore(r.version)}
                                    className="shrink-0"
                                >
                                    <RotateCcw className="w-4 h-4" /> Restore this wording
                                </CmsButton>
                            </div>
                        ))}
                    </div>

                    <p className="mt-4 flex items-start gap-2 text-[1.0625rem] text-slate-500 dark:text-[#A1A1AA]">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        A policy is never deleted, only unpublished — somebody agreed to it at
                        that address, and the record of what they agreed to has to survive.
                    </p>
                </CmsCard>
            )}
        </CmsPage>
    );
}
