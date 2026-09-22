import { toast } from 'sonner';
import { Children, createContext, isValidElement, useContext, useState, type ReactNode, type ReactElement } from 'react';
import {
    Loader2, AlertCircle, Save, X, Check,
    Trash2, Undo2, Plus, ArrowUp, ArrowDown, EyeOff,
} from 'lucide-react';

import type { CmsExtraField, CmsSectionOverride } from '@/services/cmsApi';
import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * Shared pieces for the CMS screens.
 *
 * Extracted because all seven screens have the same three states — loading,
 * failed, saving — and a screen that forgets one of them is a screen that
 * silently does nothing when the API is down. Defining them once means no
 * screen can omit them by accident.
 */

export function CmsCard({ title, description, children, actions }: {
    title: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <section className="bg-white dark:bg-[#0A0A0A] border border-slate-200 dark:border-[#1F1F1F]
                            rounded-2xl overflow-hidden mb-6
                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-24px_rgba(15,23,42,0.35)]
                            dark:shadow-none">
            {/* The action drops below the heading on a phone. Side by side it
                got about 90px, so "Add slide" and "Add section" wrapped to two
                lines inside a button and the description beside them ran four
                words to a line. */}
            <header className="px-4 sm:px-6 pt-5 sm:pt-6 pb-2 flex flex-col sm:flex-row sm:items-start
                               sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                    {/* 24px black: the card title is the top of the page's
                        hierarchy and has to win against the section headings
                        under it, which are themselves extrabold. */}
                    <h2 className={`font-display ${CARD_TITLE} text-slate-900 dark:text-white`}>
                        {title}
                    </h2>
                    {description && (
                        <p className="text-[1.25rem] font-medium text-slate-600 dark:text-[#A1A1AA] mt-1.5
                                      leading-relaxed max-w-4xl">
                            {description}
                        </p>
                    )}
                </div>
                {actions && <div className="shrink-0">{actions}</div>}
            </header>
            <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2">{children}</div>
        </section>
    );
}

/**
 * The page shell every manager sits in.
 *
 * One place decides how wide a manager is. `SiteSettingsManager` was capped at
 * `max-w-4xl` while `HomeManager` used the full column, so the two screens
 * ended at different points and the settings card left a wide band of empty
 * space beside it. The cap is gone: the CMS column is already padded by the
 * layout, and a form of labelled fields does not need a second margin inside
 * it.
 */
/**
 * Say that a save landed, where the editor is looking.
 *
 * Every manager used to report a save by swapping its own button's label to
 * "Saved" for two and a half seconds. On a long form that button is usually
 * scrolled off the bottom of the screen — an editor who pressed Ctrl+S, or who
 * clicked and then scrolled up to check their work, saw nothing at all and had
 * no way to tell whether the save had happened.
 *
 * A toast appears wherever the page is scrolled to. The inline label stays as
 * well: the two answer different questions — "did that work" and "which block
 * am I looking at".
 */
/**
 * Styled to the CMS panel, not to the page underneath it.
 *
 * `CmsLayout` scopes its `dark` class to its own subtree so the panel's theme
 * cannot leak into the public site. Sonner's Toaster renders at the app root —
 * outside that subtree — so it reads the *root* theme and would always appear
 * light while the CMS is dark. Reading the same `cms_theme` key the layout
 * writes keeps the two in step, and a failure to read it falls back to dark,
 * which is the panel's default.
 */
const cmsToastStyle = (accent: string) => {
    let dark = true;
    try { dark = localStorage.getItem('cms_theme') !== 'light'; } catch { /* private mode */ }

    return {
        background: dark ? '#0f172a' : '#ffffff',
        color: dark ? '#f8fafc' : '#0f172a',
        border: '1px solid ' + (dark ? '#1e293b' : '#e2e8f0'),
        borderLeft: '4px solid ' + accent,
    };
};

export const cmsSaved = (what: string) =>
    toast.success(what + ' saved', {
        description: 'The live site has been updated.',
        style: cmsToastStyle('#16a34a'),
    });

/**
 * A success that is not a save, in the panel's own styling.
 *
 * `cmsSaved` appends the word "saved", which is right for a form and wrong for
 * an action — "“Annual General Meeting” in the gallery saved" is not a
 * sentence. This takes the whole headline, so the caller says what happened.
 */
export const cmsDone = (headline: string, detail?: string) =>
    toast.success(headline, {
        description: detail,
        style: cmsToastStyle('#16a34a'),
        // Long enough to read two lines, since nothing else reports it.
        duration: 6000,
    });

export const cmsFailed = (what: string, detail?: string) =>
    toast.error('Could not save ' + what.toLowerCase(), {
        description: detail,
        style: cmsToastStyle('#dc2626'),
        // Long enough to read a server message, since nothing else reports it.
        duration: 6000,
    });

export const cmsDeleted = (what: string) =>
    toast.success(what + ' deleted', { style: cmsToastStyle('#dc2626') });

export function CmsPage({ children }: { children: ReactNode }) {
    return <div className="w-full space-y-6 pb-12">{children}</div>;
}

/**
 * A titled division inside a card.
 *
 * Both managers grew their own version of this — an inline `<p>` with a
 * `border-t pt-6` wrapper, repeated at every division and drifting in weight,
 * spacing and wording between the two files. One component means a card reads
 * as sections everywhere rather than as one unbroken column of fields.
 *
 * The rule and the top padding are suppressed on the first section, so a card
 * does not open with a line immediately under its own heading.
 */
/**
 * ==========================================================================
 * SAVE WITHOUT SCROLLING TO THE BOTTOM
 * ==========================================================================
 *
 * A CMS page is a few thousand pixels of form with ONE Save button, at the
 * very end. Correcting one telephone number meant scrolling to the foot of
 * the page and back, every time — and an editor who has to travel to save is
 * an editor who batches up changes and loses them.
 *
 * The WRITE is unchanged: these endpoints take the whole page, and splitting
 * it would mean one request per section and a half-written page if the third
 * one failed. What changes is that the button can be rendered anywhere. A
 * screen wraps its form in `SaveNowProvider` and hands over its own submit;
 * every `CmsSection` below it then carries a Save in its heading row, and any
 * component can drop a `<SaveNow />` of its own.
 *
 * The label says "Save page", not "Save this section", wherever it appears —
 * because that is what it does, and a button implying it saved one section
 * would be lying about the other eleven.
 *
 * A screen that has NOT wrapped itself gets nothing: `SaveNow` returns null
 * without a provider, so adding it to `CmsSection` cannot put a dead button
 * on the managers that have not adopted this yet.
 */
type SaveNowValue = { save: () => Promise<void> | void; saving: boolean; dirty: boolean };

const SaveNowContext = createContext<SaveNowValue | null>(null);

export function SaveNowProvider({ value, children }: { value: SaveNowValue; children: ReactNode }) {
    return <SaveNowContext.Provider value={value}>{children}</SaveNowContext.Provider>;
}

/**
 * A compact Save, for a section heading or a card.
 *
 * It renders NOTHING while there is nothing to save. A column of
 * permanently-lit Save buttons down a long form is a column of buttons nobody
 * reads; one that appears the moment a field changes is a prompt.
 */
export function SaveNow({ className = '', always = false, block = false }: {
    className?: string;
    /**
     * Render even when nothing has changed.
     *
     * A save INSIDE a card — on an open office-bearer, say — appears only
     * when there is something to save, because a lit button on each of nine
     * cards is nine buttons nobody reads. A save in a card's FOOTER is the
     * opposite case: it is the card's furniture, it is where an editor
     * learns to look, and a control that is sometimes there and sometimes
     * not is a control nobody learns.
     */
    always?: boolean;
    /** Full width, for a footer band. */
    block?: boolean;
}) {
    const ctx = useContext(SaveNowContext);
    if (!ctx) return null;
    if (!always && !ctx.dirty && !ctx.saving) return null;

    const idle = !ctx.dirty && !ctx.saving;
    return (
        <button
            type="button"
            onClick={() => ctx.save()}
            disabled={ctx.saving}
            className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold
                        transition-colors disabled:opacity-60
                        ${block ? 'w-full px-4 py-3 text-[1.1875rem]' : 'shrink-0 px-3 py-1.5 text-[1rem]'}
                        ${idle
                            /*
                             * IDLE IS BLUE TOO, just quieter.
                             *
                             * It was slate on slate, which is the palette this
                             * CMS uses for text that is switched OFF — a
                             * disabled control, a hint nobody can act on. The
                             * save is neither: it is the most important button
                             * on the card and it is still there and still
                             * clickable when there is nothing outstanding.
                             *
                             * Outline rather than solid, so a saved card and a
                             * card with work in it are still one glance apart
                             * down a long form. Same blue, two weights.
                             */
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                              + ' dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900'
                            : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'}
                        ${className}`}
        >
            {ctx.saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {ctx.saving ? 'Saving…' : idle ? 'Saved' : 'Save page'}
        </button>
    );
}

/**
 * ==========================================================================
 * A NUMBERED STEP — the card every CMS screen is built out of
 * ==========================================================================
 *
 * A tinted header band with a step number and a heading, the fields, and a
 * footer band holding the save. It was written for the Regions & States
 * editor and lived inside that file; every other screen was a single long
 * `CmsCard` with headings inside it, which is a different product to look
 * at and a different thing to learn.
 *
 * Three things it does that a heading in a column does not:
 *
 * WHERE A SECTION STARTS IS VISIBLE WITHOUT READING IT. A heading that is
 * only larger text in the same column is a heading an editor scrolls past;
 * one on its own band is a lid.
 *
 * THE STEP NUMBER SAYS HOW MUCH IS LEFT. "Section 3" on a screen with five
 * is an answer to a question every long form raises and few answer.
 *
 * THE SAVE NEVER MOVES. It is in the footer of every card, full width, so
 * an editor never hunts for it and never wonders whether the one they can
 * see belongs to the section they are in.
 *
 * The footer is drawn only where a `SaveNowProvider` is above it. A screen
 * that saves some other way gets the card and the band without an empty
 * grey stripe at the bottom of it.
 */
export function CmsStep({
    step, title, hint, actions, sectionKey, fixed, ownFields = true, children,
}: {
    step?: string;
    title?: string;
    hint?: string;
    /** Right-aligned control in the header band — a Preview link, a count. */
    actions?: ReactNode;
    /**
     * The slug this card is stored under — see `SectionToolsProvider`.
     *
     * Given one (and a provider above), the card grows a Remove button and an
     * editable field list of its own. Omitted, the card behaves exactly as it
     * did before either existed.
     */
    sectionKey?: string;
    /**
     * This card cannot be removed, only added to.
     *
     * For a section the page has no layout without — the headline a hero is
     * built around, the article list on the newsroom. Offering Remove on one
     * of those offers an editor a blank page, and the honest answer to
     * "can I turn this off" is no rather than a button that breaks the site.
     */
    fixed?: boolean;
    /**
     * ======================================================================
     * THIS CARD HAS SOMEWHERE TO PUT A LABELLED LINE
     * ======================================================================
     *
     * `false` on a card that CONTROLS something rather than saying it: the
     * header's colours, the slide list, how many posters the banner takes.
     * Those render no prose, so a row typed into them has nowhere to go —
     * and one was typed, into Colours, and vanished.
     *
     * The rule is not about the card, it is about the PAGE: a section that
     * draws a `CmsExtraFields` for this key gets the control, and one that
     * does not must not offer it. An editor typing into a field that
     * changes nothing is worse served than one who never saw the field.
     *
     * Default true, because most sections are prose. Every `false` below is
     * a card whose public counterpart was checked and renders nothing.
     */
    ownFields?: boolean;
    children: ReactNode;
}) {
    const save = useContext(SaveNowContext);
    const tools = useSectionTools(sectionKey);
    const removable = !!tools && !fixed;

    /*
     * A removed card collapses rather than disappearing.
     *
     * Disappearing would leave an editor with no way back and no sign that
     * anything had been there — and the card numbers would jump, which reads
     * as a bug in the CMS rather than as a choice they made.
     */
    if (tools?.hidden) {
        return (
            <section className="overflow-hidden rounded-2xl border border-dashed border-slate-300
                                bg-slate-50/60 dark:border-[#2a2a2a] dark:bg-[#0c0c0c]">
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center
                                sm:justify-between sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                                         bg-slate-200/70 text-slate-500
                                         dark:bg-[#161616] dark:text-neutral-400">
                            <EyeOff className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-[1.1875rem] font-bold text-slate-600
                                          dark:text-neutral-300">
                                {title || step || 'Section'}
                            </p>
                            <p className="text-[1rem] text-slate-500 dark:text-neutral-400">
                                Removed — this section is not shown on the public page.
                                {tools.fields.length > 0 && ' Your fields in it are kept.'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => tools.setHidden(false)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                   border-slate-300 bg-white px-3 py-1.5 text-[1rem] font-semibold
                                   text-slate-700 transition-colors hover:bg-slate-100
                                   dark:border-[#2a2a2a] dark:bg-[#111] dark:text-neutral-200
                                   dark:hover:bg-[#1a1a1a]"
                    >
                        <Undo2 className="h-4 w-4" /> Restore
                    </button>
                </div>

                {save ? (
                    <footer className="border-t border-slate-200 bg-slate-100/60 px-4 py-4 sm:px-6
                                       dark:border-[#1a1a1a] dark:bg-[#0F0F0F]">
                        <SaveNow always block />
                    </footer>
                ) : null}
            </section>
        );
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white
                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-24px_rgba(15,23,42,0.35)]
                            dark:border-[#1F1F1F] dark:bg-[#0A0A0A] dark:shadow-none">

            {title ? (
                <header className="flex items-start justify-between gap-4 border-b border-slate-100
                                   bg-slate-50/70 px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6
                                   dark:border-[#1a1a1a] dark:bg-[#0F0F0F]">
                    <div className="min-w-0">
                        {step ? (
                            <p className="text-[0.8125rem] font-bold uppercase tracking-[0.16em]
                                          text-blue-600 dark:text-blue-400">
                                {step}
                            </p>
                        ) : null}
                        <h3 className={`${CARD_TITLE} mt-1 text-slate-900 dark:text-neutral-100`}>
                            {title}
                        </h3>
                        {hint && (
                            <p className="mt-1.5 text-[1.1875rem] leading-snug text-slate-500
                                          dark:text-neutral-400">
                                {hint}
                            </p>
                        )}
                    </div>

                    {(actions || removable) ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {actions}
                            {removable && <RemoveSection onRemove={() => tools.setHidden(true)} />}
                        </div>
                    ) : null}
                </header>
            ) : null}

            <div className="px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
                {children}
                {tools && ownFields ? (
                    <SectionFields fields={tools.fields} onChange={tools.setFields} />
                ) : null}
            </div>

            {save ? (
                <footer className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5
                                   dark:border-[#1a1a1a] dark:bg-[#0F0F0F]">
                    <SaveNow always block />
                </footer>
            ) : null}
        </section>
    );
}

/**
 * Remove a section, with the click it deserves.
 *
 * Two clicks, not a browser `confirm()`: this is reversible — the card
 * collapses to a Restore strip and the fields inside it are kept — so a modal
 * asking "are you sure" would overstate what is happening. But it is still a
 * change to the live public page, and a single stray click on a trash icon
 * next to the section titles is too cheap for that.
 *
 * The second click is armed for a few seconds and then disarms itself, so a
 * button left half-pressed does not stay dangerous behind a scroll.
 */
function RemoveSection({ onRemove }: { onRemove: () => void }) {
    const [armed, setArmed] = useState(false);

    if (!armed) {
        return (
            <button
                type="button"
                onClick={() => {
                    setArmed(true);
                    setTimeout(() => setArmed(false), 4000);
                }}
                title="Remove this section from the page"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[1rem]
                           font-semibold text-slate-500 transition-colors hover:bg-red-50
                           hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950/40
                           dark:hover:text-red-400"
            >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Remove</span>
            </button>
        );
    }

    return (
        <span className="inline-flex items-center gap-1">
            <button
                type="button"
                onClick={() => { setArmed(false); onRemove(); }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1.5
                           text-[1rem] font-semibold text-white transition-colors hover:bg-red-700"
            >
                <Trash2 className="h-4 w-4" /> Remove it
            </button>
            <button
                type="button"
                onClick={() => setArmed(false)}
                title="Keep this section"
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200
                           dark:text-neutral-400 dark:hover:bg-[#1c1c1c]"
            >
                <X className="h-4 w-4" />
            </button>
        </span>
    );
}

/**
 * The column the steps sit in.
 *
 * The gap between cards is set ONCE, here, so two screens cannot drift
 * apart by a few pixels of margin that nobody would think to check.
 */
export function CmsSteps({ children }: { children: ReactNode }) {
    /*
     * 32px, not 20px.
     *
     * Each card is a white panel on a near-white page, so the gap is the
     * only thing separating one from the next. At 20px a card's last field
     * and the following card's heading read as one continuous column and
     * the cards stopped looking like cards.
     */
    return <div className="space-y-8">{children}</div>;
}

/**
 * ==========================================================================
 * WHICH BAR, OR WHICH BLOCK, THESE CARDS BELONG TO
 * ==========================================================================
 *
 * Two screens here hold more than one thing. Header & Footer is eleven cards
 * of which the first four are the header; the Home page is thirteen, split
 * across the banner, the About block and two bands that belong to other
 * documents entirely.
 *
 * Numbered straight through, that reads as one very long form. An editor
 * looking at “Section 5 — Logo and name” had no way to know it was the
 * FOOTER's logo, four cards after a header card with the same title; and the
 * saves are per block, so “Saved” under card 7 meant something different
 * from “Saved” under card 2 with nothing on screen to say so.
 *
 * A heading before each run, and the step labels carry the block's name
 * rather than a running count. “Footer 1” says what “Section 5” could not.
 */
export function CmsBlock({ title, hint }: { title: string; hint?: string }) {
    return (
        <header className="mb-4 mt-2 border-l-4 border-[#2563EB] pl-4">
            <h2 className={`font-display ${CARD_TITLE} text-slate-900 dark:text-white`}>
                {title}
            </h2>
            {hint && (
                <p className="mt-1 text-[1.1875rem] font-medium leading-snug text-slate-600
                              dark:text-[#A1A1AA]">
                    {hint}
                </p>
            )}
        </header>
    );
}

/**
 * ==========================================================================
 * TWO THINGS EVERY CARD CAN NOW DO: BE REMOVED, AND CARRY ITS OWN FIELDS
 * ==========================================================================
 *
 * A CMS screen is a fixed run of cards. Until now that run was the whole of
 * what a page could say and the whole of what it had to say:
 *
 *   - an association that does not run a Buttons row could only blank both
 *     labels and infer from the public page that blanking is what hides it;
 *   - an association wanting one more line inside the Buttons card had a
 *     single "Your own fields" list at the very foot of the screen, which put
 *     the line nowhere near the section it belongs to and rendered it at the
 *     bottom of the page rather than in that section.
 *
 * Both are answered on the card itself now. The card's key goes in
 * `sectionKey`, the screen wraps its cards in `SectionToolsProvider`, and
 * `CmsStep` grows a Remove button in its header and an editable field list in
 * its body. Nothing else on the screen changes.
 *
 * REMOVING IS NOT DELETING. A removed card collapses to a strip with a
 * Restore button and keeps every field inside it. The public page skips the
 * section; the CMS still shows that it exists and that somebody turned it
 * off — which is the difference between a section an editor removed and one
 * they never noticed.
 *
 * A card with no `sectionKey`, or a screen with no provider, gets exactly
 * what it got before: no Remove, no field list, no empty affordance.
 */
type SectionToolsValue = {
    sections: CmsSectionOverride[];
    onChange: (next: CmsSectionOverride[]) => void;
};

const SectionToolsContext = createContext<SectionToolsValue | null>(null);

export function SectionToolsProvider({ value, children }: {
    value: SectionToolsValue;
    children: ReactNode;
}) {
    return <SectionToolsContext.Provider value={value}>{children}</SectionToolsContext.Provider>;
}

const EMPTY_OVERRIDE: CmsSectionOverride = { key: '', hidden: false, fields: [] };

/**
 * Read and write one card's row.
 *
 * The row is created on first WRITE, never on read: a card the editor only
 * scrolled past must not add a row, or every save would store one inert entry
 * per card and a later schema change would orphan them all. The server drops
 * the empty ones as well — belt and braces, because the two halves of this
 * are a browser and a database and only one of them is trustworthy.
 */
const useSectionTools = (sectionKey?: string) => {
    const ctx = useContext(SectionToolsContext);
    if (!ctx || !sectionKey) return null;

    const row = (ctx.sections || []).find(s => s && s.key === sectionKey);

    const write = (patch: Partial<CmsSectionOverride>) => {
        const current = (ctx.sections || []).filter(s => s && s.key);
        const next = current.some(s => s.key === sectionKey)
            ? current.map(s => (s.key === sectionKey ? { ...s, ...patch } : s))
            : [...current, { ...EMPTY_OVERRIDE, key: sectionKey, ...patch }];
        ctx.onChange(next);
    };

    return {
        hidden: row?.hidden === true,
        fields: row?.fields || [],
        setHidden: (hidden: boolean) => write({ hidden }),
        setFields: (fields: CmsExtraField[]) => write({ fields }),
    };
};

/**
 * The editor's own rows inside ONE card.
 *
 * Deliberately not `RepeatableList`: that component is the card treatment for
 * a list that IS the section — slides, columns, office-bearers — and using it
 * here would put a card inside a card and read as a second section. These
 * rows are an addition to the section around them and are drawn as one.
 *
 * Add, rename, retype, reorder and delete, all inline. The order is the order
 * they render in on the public page, which is why the arrows are here: "third
 * line down" is the only positioning this feature offers.
 */
function SectionFields({ fields, onChange }: {
    fields: CmsExtraField[];
    onChange: (next: CmsExtraField[]) => void;
}) {
    const rows = fields || [];

    const move = (i: number, by: number) => {
        const j = i + by;
        if (j < 0 || j >= rows.length) return;
        const next = [...rows];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    };

    return (
        <div className="mt-6 border-t border-dashed border-slate-200 pt-5 dark:border-[#232323]">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[1.125rem] font-bold text-slate-700 dark:text-neutral-200">
                        Your own fields in this section
                    </p>
                    <p className="text-[1rem] text-slate-500 dark:text-neutral-400">
                        Each row shows as a labelled line inside this section on the public page.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => onChange([...rows, { label: '', value: '' }])}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200
                               bg-blue-50 px-3 py-1.5 text-[1rem] font-semibold text-blue-700
                               transition-colors hover:bg-blue-100
                               dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                >
                    <Plus className="h-4 w-4" /> Add field
                </button>
            </div>

            {rows.length === 0 ? null : (
                <div className="space-y-2.5">
                    {rows.map((field, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3
                                       dark:border-[#232323] dark:bg-[#0d0d0d]"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
                                <CmsInput
                                    value={field.label}
                                    onChange={e => onChange(rows.map((r, k) =>
                                        (k === i ? { ...r, label: e.target.value } : r)))}
                                    placeholder="Field name"
                                />
                                <CmsTextarea
                                    rows={2}
                                    value={field.value}
                                    onChange={e => onChange(rows.map((r, k) =>
                                        (k === i ? { ...r, value: e.target.value } : r)))}
                                    placeholder="What it says"
                                />

                                <div className="flex items-start gap-1">
                                    <button
                                        type="button"
                                        onClick={() => move(i, -1)}
                                        disabled={i === 0}
                                        title="Move up"
                                        className="rounded-lg p-2 text-slate-500 transition-colors
                                                   hover:bg-slate-200 disabled:opacity-30
                                                   dark:text-neutral-400 dark:hover:bg-[#1c1c1c]"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(i, 1)}
                                        disabled={i === rows.length - 1}
                                        title="Move down"
                                        className="rounded-lg p-2 text-slate-500 transition-colors
                                                   hover:bg-slate-200 disabled:opacity-30
                                                   dark:text-neutral-400 dark:hover:bg-[#1c1c1c]"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </button>
                                    {/*
                                      LABELLED, like every other delete in the
                                      panel. A bare bin between two arrows is a
                                      control an editor has to hover to identify,
                                      and this is the one that throws work away.
                                    */}
                                    <button
                                        type="button"
                                        onClick={() => onChange(rows.filter((_, k) => k !== i))}
                                        title="Delete this field"
                                        className="inline-flex items-center gap-1.5 rounded-lg border
                                                   border-red-200 px-2.5 py-1.5 text-[1rem] font-semibold
                                                   text-red-600 transition-colors hover:bg-red-50
                                                   dark:border-red-500/30 dark:text-red-400
                                                   dark:hover:bg-red-950/40"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CmsSection({ title, hint, actions, children }: {
    title: string;
    hint?: string;
    /** Right-aligned control for this section, e.g. a Show toggle. */
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="pt-7 first:pt-0 border-t first:border-t-0 border-slate-200 dark:border-[#1F1F1F]">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                    {/* 19px and extrabold: a section heading has to win against
                        the bold field labels under it, or the form reads as one
                        undifferentiated column of text. */}
                    <h3 className={`${CARD_TITLE} text-slate-900 dark:text-white`}>
                        {title}
                    </h3>
                    {hint && (
                        <p className="text-[1.125rem] font-medium text-slate-600 dark:text-[#A1A1AA]
                                      mt-1.5 leading-snug max-w-3xl">
                            {hint}
                        </p>
                    )}
                </div>
                {/* No Save here any more. Every section on the region and state
                    editors sits in a card with a save in its FOOTER, and a second
                    one in the heading put two of the same button a few hundred
                    pixels apart. */}
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            {children}
        </section>
    );
}

/**
 * Work out how to empty the control this field wraps, without being told.
 *
 * Every text field in this CMS is written the same way — a controlled input
 * whose handler reads `e.target.value` and nothing else:
 *
 *     <CmsField label="Heading">
 *         <CmsInput value={x.heading} onChange={e => set({ heading: e.target.value })} />
 *     </CmsField>
 *
 * So the field already holds everything needed to clear itself: the current
 * value, and the function that sets it. Reading them off the child is what puts
 * a Clear button on ~200 fields across seven screens without touching a single
 * one of them — and, more importantly, on every field added from here on,
 * automatically. Wiring each by hand would have been the same behaviour with a
 * guarantee that somebody eventually forgets one.
 *
 * The synthetic event is a deliberate minimum: `target.value` and
 * `currentTarget.value`, which is the whole of what these handlers read. A
 * handler that reached for anything else would be the exception, and the
 * caller can always pass `onClear` explicitly instead.
 *
 * Deliberately NOT offered for:
 *   - checkboxes and radios, which have no empty state, only a false one
 *   - number inputs, where "empty" becomes 0 — a value with its own meaning
 *     (`pageSize: 0` means "show every image"), not an absence
 *   - anything that is not a plain text control, e.g. an icon or media picker,
 *     which carry their own Remove
 */
const inferClear = (children: ReactNode): (() => void) | undefined => {
    const child = Children.toArray(children).find(isValidElement) as ReactElement<Record<string, unknown>> | undefined;
    if (!child) return undefined;

    const isTextControl =
        child.type === CmsInput || child.type === CmsTextarea ||
        child.type === 'input' || child.type === 'textarea' || child.type === 'select';
    if (!isTextControl) return undefined;

    const { value, onChange, type } = (child.props || {}) as {
        value?: unknown; onChange?: unknown; type?: string;
    };

    if (type === 'checkbox' || type === 'radio' || type === 'number') return undefined;
    if (typeof value !== 'string' || value === '') return undefined;
    if (typeof onChange !== 'function') return undefined;

    return () => (onChange as (e: unknown) => void)({
        target: { value: '' },
        currentTarget: { value: '' },
    });
};

/**
 * One labelled control, with a Clear button when there is something to clear.
 *
 * Clearing IS deleting. The built-in fields cannot be removed from the form —
 * the public pages know them by name — but every one of them is hidden on the
 * site when it is empty, so emptying a field takes it off the page. The button
 * exists because that is not obvious, and because clearing a seven-line
 * write-up by dragging a cursor is tedious.
 *
 * `onClear` overrides the inference above; `canClear={false}` suppresses the
 * button on a field that must always hold a value.
 */
export function CmsField({ label, hint, children, onClear, canClear = true }: {
    label?: string;
    /**
     * The line under the field.
     *
     * A NODE, not a string. Several hints now carry a computed sentence with
     * emphasis in it — the member-price field prints "Members save ₹400 (40%
     * off)" in green, or a red warning when the rate is above the public price
     * — and a `string` type forced those to be built as plain text with the
     * meaning left to the reader.
     */
    hint?: ReactNode;
    children: ReactNode;
    /** Empties this field. Omit to let the field work it out — see `inferClear`. */
    onClear?: () => void;
    /** False hides the button — typically "this field is already empty". */
    canClear?: boolean;
}) {
    const clear = onClear || inferClear(children);
    const showClear = !!clear && canClear;

    return (
        /*
          Still a <label>, so clicking the caption focuses the control as it
          always has. The button inside it stops its own click from propagating:
          without that, the label activates as well and the browser re-focuses
          the input in the same gesture that emptied it.
        */
        <label className="block">
            {(label || showClear) ? (
                <span className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[1.25rem] font-semibold text-slate-800 dark:text-neutral-100">{label}</span>
                    {showClear && (
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); clear!(); }}
                            title="Empty this field — it is then not shown on the site"
                            className="inline-flex items-center gap-1 text-[1.0625rem] font-semibold
                                       text-slate-500 dark:text-[#A1A1AA] hover:text-red-600
                                       dark:hover:text-red-400 transition-colors shrink-0"
                        >
                            <X size={12} /> Clear
                        </button>
                    )}
                </span>
            ) : null}
            {children}
            {hint && (
                <span className="block text-[1.0625rem] font-medium text-slate-600 dark:text-[#A1A1AA]
                                 mt-2 leading-snug">
                    {hint}
                </span>
            )}
        </label>
    );
}

/*
 * THE SAME CONTROL THE PUBLIC FORMS USE.
 *
 * This was a grey field on a white card, in medium weight — which reads as
 * disabled rather than as "type here", and is why the screen looked flat. The
 * association's own forms (the business account, the booking form) are a WHITE
 * field with a light border that darkens on hover and a blue ring on focus, at
 * the same 16px. Matching them is not decoration: an editor moving between the
 * site and the CMS should not have to learn a second set of controls.
 */
const inputBase =
    'w-full bg-white dark:bg-[#0b0b0b] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-3 '
    + 'text-[1.25rem] font-medium text-slate-900 dark:text-white '
    + 'placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-[#52525B] '
    + 'hover:border-slate-300 dark:hover:border-[#3a3a3a] focus:outline-none focus:ring-2 '
    + 'focus:ring-blue-500 focus:border-transparent transition-colors';

export function CmsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={`${inputBase} ${props.className || ''}`} />;
}

/**
 * A colour, as a swatch and as text.
 *
 * Two controls over one value: the native picker for choosing, the text field
 * for pasting an exact brand hex. The picker alone cannot be given a value from
 * a brand guide; the text field alone makes an editor guess what #1c2e68 looks
 * like.
 *
 * Only `#rgb` / `#rrggbb` reaches the swatch, because a native colour input
 * silently resets to black on anything it cannot parse — which would look like
 * the field clearing itself while the value was being typed.
 */
export function CmsColorInput({ value, onChange, fallback = '#ffffff' }: {
    value: string;
    onChange: (next: string) => void;
    fallback?: string;
}) {
    const raw = (value || '').trim();
    const valid = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw);

    return (
        <div className="flex items-center gap-3">
            <input
                type="color"
                aria-label="Pick a colour"
                value={valid ? raw : fallback}
                onChange={e => onChange(e.target.value)}
                className="h-11 w-14 shrink-0 rounded-lg border border-slate-300 dark:border-[#262626]
                           bg-transparent p-1 cursor-pointer"
            />
            <CmsInput
                value={raw}
                onChange={e => onChange(e.target.value)}
                placeholder={fallback}
                spellCheck={false}
                className="font-mono uppercase"
            />
        </div>
    );
}

export function CmsTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={`${inputBase} resize-y ${props.className || ''}`} />;
}

export function CmsButton({
    children, loading, variant = 'primary', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: 'primary' | 'ghost' | 'danger';
}) {
    const styles = {
        primary: 'bg-blue-600 hover:bg-blue-500 text-white',
        ghost: 'bg-slate-100 dark:bg-[#1A1A1A] hover:bg-slate-200 dark:hover:bg-[#262626] text-slate-800 dark:text-[#E4E4E7]',
        danger: 'bg-red-600 hover:bg-red-500 text-white',
    }[variant];

    return (
        <button
            {...rest}
            // Disabled while saving: a second click would fire a second write,
            // and for the singletons that is a race over the same document.
            disabled={rest.disabled || loading}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[1.25rem]
                        font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${styles} ${rest.className || ''}`}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {children}
        </button>
    );
}

export function SaveButton({ loading, label = 'Save changes' }: { loading?: boolean; label?: string }) {
    return (
        <CmsButton type="submit" loading={loading}>
            {!loading && <Save className="w-4 h-4" />}
            {loading ? 'Saving…' : label}
        </CmsButton>
    );
}

export function CmsLoading({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="flex items-center gap-3 text-slate-500 dark:text-[#A1A1AA] py-10 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[1.25rem]">{label}</span>
        </div>
    );
}

/**
 * A failure the admin can act on.
 *
 * Shows the server's own message where there is one — the API answers with
 * things like "An image is required", which is more use than a generic
 * "something went wrong".
 */
export function CmsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
    if (!message) return null;
    return (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <p className="text-[1.25rem] text-red-800 dark:text-red-200">{message}</p>
                {onRetry && (
                    <button onClick={onRetry} className="text-[1.1875rem] text-red-700 dark:text-red-300 underline mt-1">
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
}

export function CmsEmpty({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="text-center py-12">
            <p className="text-slate-700 dark:text-[#D4D4D8] font-medium">{title}</p>
            {hint && <p className="text-[1.25rem] text-slate-500 dark:text-[#A1A1AA] mt-1">{hint}</p>}
        </div>
    );
}

/**
 * A pick-exactly-one choice, rendered as cards.
 *
 * WHY THIS EXISTS: three of these had been written separately — the audience
 * pair, the region-mode pair, the onboarding pair — and all three were TWO
 * INDEPENDENT TOGGLE BUTTONS carrying `aria-pressed`. They looked exclusive
 * because the styling was derived from one boolean, and they were not: two
 * pressed-state buttons are two on/off controls, so assistive tech announced
 * each as separately switchable, keyboard users tabbed through them as two
 * unrelated stops, and nothing on the card said "one of these" the way a radio
 * mark does. An editor reporting that both could be selected was reading the
 * control correctly; only the paint said otherwise.
 *
 * So: one `radiogroup`, `role="radio"` with `aria-checked`, and a visible mark.
 * `aria-checked` cannot be true on two radios of one group, and the mark makes
 * the exclusivity visible rather than implied by a border colour.
 *
 * ROVING TABINDEX AND ARROW KEYS, per the WAI-ARIA radio group pattern: the
 * group is ONE tab stop and the arrows move within it. Two tab stops for one
 * decision is the keyboard half of the same mistake.
 *
 * The options are data rather than children so the group can own that keyboard
 * behaviour. Three call sites passing JSX would be three chances to leave the
 * roving tabindex out of one of them.
 */
export function CmsChoice<T extends string>({
    label,
    value,
    options,
    onChange,
    size = 'md',
}: {
    /** Names the group for assistive tech; the visible heading is the section's. */
    label: string;
    value: T;
    options: { value: T; icon?: ReactNode; title: string; detail?: ReactNode }[];
    onChange: (value: T) => void;
    /** `lg` is the heavier treatment used where the choice leads a section. */
    size?: 'md' | 'lg';
}) {
    const index = options.findIndex(o => o.value === value);

    /*
     * Arrows wrap, and MOVE THE SELECTION, not just the focus.
     *
     * That is the standard behaviour for a radio group and the reason it is one
     * tab stop: there is always a selection, so arrowing to an option and
     * arrowing away again cannot leave the group in a state nobody chose.
     * Home/End are the same idea at the ends.
     */
    const onArrow = (e: React.KeyboardEvent) => {
        const last = options.length - 1;
        if (last < 1) return;

        // -1 when nothing matches, so the first arrow press lands on a real
        // option instead of counting from a phantom position.
        const from = index < 0 ? 0 : index;
        let next: number | null = null;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = from >= last ? 0 : from + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = from <= 0 ? last : from - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = last;

        if (next === null) return;
        e.preventDefault();
        onChange(options[next].value);

        // Focus follows selection, or the group announces a change the caret is
        // not standing on.
        const group = e.currentTarget.closest('[role="radiogroup"]');
        const radios = group ? group.querySelectorAll('[role="radio"]') : null;
        const target = radios ? radios[next] : null;
        if (target instanceof HTMLElement) target.focus();
    };

    const pad = size === 'lg' ? 'p-3.5 rounded-xl border-2' : 'p-3 rounded-lg border';

    return (
        <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-2">
            {options.map((option, i) => {
                const selected = option.value === value;

                return (
                    <div
                        key={option.value}
                        role="radio"
                        aria-checked={selected}
                        /*
                         * ONE tab stop for the group. The selected option holds
                         * it; with nothing selected the first option does, so
                         * the group is never unreachable by keyboard.
                         */
                        tabIndex={selected || (index < 0 && i === 0) ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                onChange(option.value);
                                return;
                            }
                            onArrow(e);
                        }}
                        /* `min-w-0`: these sit in a grid column and the detail
                           line is a full sentence, which without it widens the
                           column past the card holding it. */
                        className={`min-w-0 cursor-pointer text-left transition-colors
                                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600
                                    focus-visible:ring-offset-1 ${pad} ${
                            selected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
                        }`}
                    >
                        <span className="flex items-start gap-2.5">
                            {/*
                              The mark. Drawn rather than borrowed from an
                              `<input type="radio">` so it keeps the card's own
                              colours in both themes — but it is what makes the
                              group readable as pick-one at a glance, which a
                              border tint alone never did.
                            */}
                            <span
                                aria-hidden="true"
                                className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 flex items-center
                                            justify-center transition-colors ${
                                    selected
                                        ? 'border-blue-600'
                                        : 'border-slate-300 dark:border-[#3a3a3a]'
                                }`}
                            >
                                {selected && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                            </span>

                            <span className="min-w-0">
                                <span className={`flex items-center gap-2 ${
                                    size === 'lg' ? 'text-[1.25rem] font-bold' : 'text-[1.25rem] font-semibold'
                                } ${
                                    selected
                                        ? 'text-blue-700 dark:text-blue-400'
                                        : 'text-slate-800 dark:text-neutral-200'
                                }`}>
                                    {option.icon}
                                    <span className="min-w-0">{option.title}</span>
                                </span>

                                {option.detail && (
                                    <span className="block text-[1.1875rem] text-slate-500 dark:text-[#A1A1AA]
                                                     mt-1 leading-snug">
                                        {option.detail}
                                    </span>
                                )}
                            </span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * A single card that is on or off — an ADDITION, not a choice between two.
 *
 * The distinction from `CmsChoice` is the whole reason both exist, and getting
 * it wrong is not cosmetic. A pair of cards states "one of these two"; a
 * checkbox states "this as well". Rendering an addition as a pair claims the
 * unticked option is a real alternative that the ticked one replaces — so an
 * editor reading "Keep it inside the association | Post it in the onboarding
 * events section" reasonably concluded that posting it publicly TOOK IT AWAY
 * from the member dashboards. It never did: `event.service.listEvents` does not
 * read `showOnOnboarding` at all, and both are true at once.
 *
 * Use `CmsChoice` when the states are mutually exclusive in the data — the
 * region mode is, because the target list is either empty or it is not. Use
 * this when one state is the other plus something.
 */
export function CmsCheck({
    checked,
    onChange,
    icon,
    title,
    detail,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: ReactNode;
    title: string;
    detail?: ReactNode;
}) {
    return (
        <div
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={() => onChange(!checked)}
            onKeyDown={(e) => {
                if (e.key !== ' ' && e.key !== 'Enter') return;
                e.preventDefault();
                onChange(!checked);
            }}
            className={`min-w-0 cursor-pointer text-left transition-colors p-3 rounded-lg border
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600
                        focus-visible:ring-offset-1 ${
                checked
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
            }`}
        >
            <span className="flex items-start gap-2.5">
                {/* Square, not round. The shape is the only thing distinguishing
                    this from a radio at a glance, and it is what says the option
                    is independent rather than one of a set. */}
                <span
                    aria-hidden="true"
                    className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center
                                justify-center transition-colors ${
                        checked
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-300 dark:border-[#3a3a3a]'
                    }`}
                >
                    {checked && <Check size={11} strokeWidth={3} />}
                </span>

                <span className="min-w-0">
                    <span className={`flex items-center gap-2 text-[1.25rem] font-semibold ${
                        checked
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-slate-800 dark:text-neutral-200'
                    }`}>
                        {icon}
                        <span className="min-w-0">{title}</span>
                    </span>

                    {detail && (
                        <span className="block text-[1.1875rem] text-slate-500 dark:text-[#A1A1AA] mt-1 leading-snug">
                            {detail}
                        </span>
                    )}
                </span>
            </span>
        </div>
    );
}

/**
 * A card that is on or off, in the heavier "mode card" treatment.
 *
 * The visual is the original one — a thick border and a tinted fill, no
 * checkbox square — because that is what these read as best at the top of a
 * section. What changed is only the semantics behind it: `role="checkbox"` and
 * `aria-checked`, so several may be on at once and assistive tech says so.
 *
 * `CmsChoice` is the other shape, for a genuine one-of-N. Reach for this when
 * the options are independent — when ticking one does not un-tick another.
 */
export function CmsModeCard({
    checked,
    onChange,
    icon,
    title,
    detail,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: ReactNode;
    title: string;
    detail?: ReactNode;
}) {
    return (
        <div
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onClick={() => onChange(!checked)}
            onKeyDown={(e) => {
                if (e.key !== ' ' && e.key !== 'Enter') return;
                e.preventDefault();
                onChange(!checked);
            }}
            className={`min-w-0 cursor-pointer text-left rounded-xl border-2 p-3.5 transition-colors
                        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600
                        focus-visible:ring-offset-1 ${
                checked
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300'
            }`}
        >
            <span className={`inline-flex items-center gap-2 text-[1.25rem] font-bold ${
                checked ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-neutral-200'
            }`}>
                {icon}
                {title}
            </span>
            <span className="block text-[1.1875rem] text-slate-500 dark:text-[#A1A1AA] mt-1 leading-snug">
                {detail}
            </span>
        </div>
    );
}
