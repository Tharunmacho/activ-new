import { toast } from 'sonner';
import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import {
    Loader2, AlertCircle, Save, X, Check, Pencil,
    Trash2, Undo2, Plus, ArrowUp, ArrowDown, EyeOff, ChevronDown,
} from 'lucide-react';

import type { CmsExtraField, CmsSectionOverride } from '@/services/cmsApi';
import { ICON_GROUPS } from '@/services/cmsApi';
import { CmsIcon, hasIcon } from '@/components/shared/CmsIcon';
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
type SaveNowValue = {
    save: () => Promise<void> | void;
    saving: boolean;
    dirty: boolean;
    /**
     * WHAT THIS BUTTON ACTUALLY SAVES.
     *
     * "Save page" is right on a page document — the endpoint takes the whole
     * thing, so a Save in card three saves cards one and two with it, and
     * saying "save this section" would be a lie about the other eleven.
     *
     * It is the WRONG word on a record: the scheme form and the legal
     * document editor are built from the same cards, and there the button
     * writes one scheme, not the Schemes page. A screen that saves a record
     * passes its own noun — "Save scheme" — rather than telling the editor
     * they have just saved a page they have not touched.
     */
    label?: string;
};

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
                        ${block ? 'w-full px-4 py-3 text-[1.1875rem]' : 'shrink-0 px-3 py-1.5 text-[1.0625rem]'}
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
            {ctx.saving ? 'Saving…' : idle ? 'Saved' : (ctx.label || 'Save page')}
        </button>
    );
}

/*
 * ============================================================================
 * `RepeatableList` LIVES HERE NOW, and is re-exported from `CmsEditors`.
 * ============================================================================
 *
 * It was written in `CmsEditors`, which imports FROM this file, so this file
 * could not use it. That mattered the moment "Your own fields in this section"
 * had to become a list like every other list in the CMS: the control that
 * draws those rows is `CmsStep`, and `CmsStep` is here.
 *
 * Same move and the same reason as `IconPicker` before it — the shared piece
 * goes in the LOWER of the two modules and the higher one re-exports it, so
 * every call site that already names it keeps working and nothing imports in
 * a circle.
 */

interface ListProps<T> {
    items: T[];
    onChange: (next: T[]) => void;
    /** Used for the add button and the empty state, e.g. "slide", "nav link". */
    noun: string;
    /** A fresh, blank record. */
    blank: () => T;
    /** Render one row's fields; the frame around it is drawn here. */
    row: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
    /** Off for lists where position carries no meaning. */
    reorderable?: boolean;
    max?: number;
    /**
     * Change this number to close whichever row is open — the screen bumps it
     * after a successful save, so a saved slide folds back to its summary
     * instead of staying open looking unsaved.
     */
    collapseSignal?: number;
}

/**
 * ============================================================================
 * ONE CARD PER ROW — the treatment the Regions & States editor uses
 * ============================================================================
 *
 * Every repeating thing in the CMS is drawn by this: the banner slides, the
 * nav links, the footer columns, the figures, the icon points, the filter
 * chips, the extra fields. It was a stack of always-open boxes labelled
 * "slide 1", "slide 2", with the controls in a row of unlabelled icons.
 *
 * Two problems with that, and the second is the one editors hit.
 *
 * A LIST OF OPEN FORMS IS NOT A LIST. Six slides with four fields each is
 * twenty-four inputs in one column and no way to see what is in the list
 * without reading all of them. A row that is CLOSED shows what it is; a row
 * that is open shows how to change it; and one row is open at a time.
 *
 * "SLIDE 3" IS NOT WHAT THE SLIDE IS. The number is the one thing about a row
 * an editor already knows from where it sits. `summary` lets a caller put the
 * caption, the link label, the figure — whatever the row actually says — on
 * the closed card, so the list reads as its contents.
 *
 * ------------------------------------------------- add above, and add below
 *
 * On every card, not just at the end. A list is edited in the middle as often
 * as at the bottom, and "add, then press the up arrow four times" is what an
 * editor does when the only Add is underneath the last row.
 */
export function RepeatableList<T>({
    items, onChange, noun, blank, row, reorderable = true, max, summary, compact = false, collapseSignal,
}: ListProps<T> & {
    /**
     * What the CLOSED card says. Without it a row is "slide 3", which is the
     * one thing about it the editor can already see.
     */
    /**
     * What a CLOSED row says about itself.
     *
     * `thumb` is a picture, and it matters on any list whose rows ARE
     * pictures: a banner slide closed to "Untitled slide" over a CDN path
     * tells an editor nothing they can act on, and reordering three of them
     * by filename is guesswork. With the image there the row is the thing
     * it represents.
     */
    summary?: (item: T, index: number) => {
        title?: string;
        subtitle?: string;
        thumb?: string;
    };
    /**
     * ======================================================================
     * A LIST OF LABELS DOES NOT NEED THE FULL CARD
     * ======================================================================
     *
     * Add above and Add below on every row is right for a bench of
     * office-bearers: nine fields each, ten of them, and the one you want to
     * insert always goes in the middle. On the header nav — seven rows of a
     * label and a path — it is two buttons per row that nobody presses, under
     * a card whose whole content is two words.
     *
     * `compact` keeps the card, the summary, the reorder arrows, the delete
     * and the Edit; it drops the two insert buttons and leans on the Add at
     * the top. The same list, without the furniture a short row cannot carry.
     *
     * Set per CALLER and not guessed from the field count: only the caller
     * knows whether its rows are read in an order somebody cares about.
     */
    compact?: boolean;
}) {
    /*
     * Which row is open. One at a time — six open forms is the thing this
     * replaced — and a row that has just been added opens itself, because
     * adding one is always followed by filling it in.
     */
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    /* Saved -> fold the open row away. Skips the first render. */
    const lastSignal = useRef(collapseSignal);
    useEffect(() => {
        if (collapseSignal === lastSignal.current) return;
        lastSignal.current = collapseSignal;
        setOpenIndex(null);
    }, [collapseSignal]);

    const update = (index: number, patch: Partial<T>) =>
        onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    /**
     * Confirmed, because it cannot be undone.
     *
     * This deleted on a single click of a 14px icon with no label and no
     * confirmation — the same size and position as the two reorder arrows
     * beside it, so losing a slide to a misclick took one slip and there was
     * no way back. The button is labelled and asks first.
     */
    const remove = (index: number) => {
        const ok = window.confirm(
            `Delete this ${noun}? It is removed from the live site when you save, and cannot be undone.`,
        );
        if (!ok) return;
        onChange(items.filter((_, i) => i !== index));
        setOpenIndex(null);
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
        /* The open row travels with the row, not with the position. */
        if (openIndex === index) setOpenIndex(target);
        else if (openIndex === target) setOpenIndex(index);
    };

    const insertAt = (at: number) => {
        const next = [...items];
        next.splice(at, 0, blank());
        onChange(next);
        setOpenIndex(at);
    };

    const atLimit = typeof max === 'number' && items.length >= max;

    const addButton = (label: string, at: number, subtle = false) => (
        <button
            type="button"
            onClick={() => insertAt(at)}
            disabled={atLimit}
            className={subtle
                ? `inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5
                   text-[1.0625rem] font-semibold text-slate-600 transition-colors
                   hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-40
                   dark:border-[#2a2a2a] dark:text-neutral-300`
                : `inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3.5 py-2
                   text-[1.1875rem] font-semibold text-blue-600 transition-colors
                   hover:bg-blue-500/10 disabled:opacity-40 dark:border-blue-500/30
                   dark:text-blue-400`}
        >
            <Plus className={subtle ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> {label}
        </button>
    );

    return (
        <div className="space-y-3">
            {/* The Add is at the TOP as well. A list of twelve puts the only
                control that grows it a screen away from the heading. */}
            <div className="flex justify-end">
                {addButton(atLimit ? `Maximum of ${max}` : `Add ${noun}`, items.length)}
            </div>

            {items.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center
                                dark:border-[#2a2a2a]">
                    <p className="text-[1.25rem] text-slate-500 dark:text-neutral-400">
                        No {noun}s yet.
                    </p>
                </div>
            )}

            {items.map((item, index) => {
                const open = openIndex === index;
                const said = summary ? summary(item, index) : {};
                return (
                    <div
                        key={index}
                        className={`rounded-xl border bg-white transition-colors dark:bg-[#0f0f0f] ${open
                            ? 'border-[#2563EB] dark:border-[#2563EB]'
                            : 'border-slate-200 hover:border-slate-300 dark:border-[#2a2a2a]'}`}
                    >
                        {/* ---------------- closed: what this row IS ---------------- */}
                        <div className="flex flex-wrap items-center gap-3 p-3.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                                             bg-blue-50 text-[1.0625rem] font-bold text-[#2563EB]
                                             dark:bg-blue-950/40">
                                {index + 1}
                            </span>

                            {/* The row's own picture, where it has one. */}
                            {said.thumb ? (
                                <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg
                                                 bg-slate-100 dark:bg-[#161616]">
                                    <img
                                        src={said.thumb}
                                        alt=""
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                            // A broken URL leaves the frame empty rather
                                            // than a torn-image glyph, which reads as a
                                            // fault in the CMS instead of in the link.
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </span>
                            ) : null}

                            <div className="!min-w-[9rem] flex-1">
                                <p className="truncate text-[1.25rem] font-bold text-slate-900
                                              dark:text-white">
                                    {said.title || `Untitled ${noun}`}
                                </p>
                                {said.subtitle && (
                                    <p className="truncate text-[1.0625rem] text-slate-500
                                                  dark:text-neutral-400">
                                        {said.subtitle}
                                    </p>
                                )}
                            </div>

                            <div className="ml-auto flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(open ? null : index)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5
                                                text-[1.0625rem] font-semibold transition-colors ${open
                                        ? 'bg-blue-50 text-[#2563EB] dark:bg-blue-950/40'
                                        : 'text-blue-700 hover:bg-blue-50 dark:text-blue-400'}`}
                                >
                                    {open ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                    {open ? 'Done' : 'Edit'}
                                </button>

                                {reorderable && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => move(index, -1)}
                                            disabled={index === 0}
                                            aria-label={`Move this ${noun} up`}
                                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100
                                                       disabled:opacity-30 dark:hover:bg-[#161616]"
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(index, 1)}
                                            disabled={index === items.length - 1}
                                            aria-label={`Move this ${noun} down`}
                                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100
                                                       disabled:opacity-30 dark:hover:bg-[#161616]"
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                    </>
                                )}

                                {/*
                                  LABELLED, like Edit beside it.

                                  This was a bare red bin with an `aria-label`,
                                  sitting third in a row of three small icons. An
                                  editor scanning a list of fifteen advantages read
                                  the row as having an Edit and nothing else, and
                                  said so — an icon a sighted user has to hover to
                                  identify is a control they have to go looking for.

                                  It is also the one action on the row that cannot
                                  be undone, which is the last thing that should be
                                  the hardest to find. The events table already made
                                  this change for the same reason.
                                */}
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    aria-label={`Delete ${noun} ${index + 1}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border
                                               border-red-200 px-2.5 py-1.5 text-[1.0625rem]
                                               font-semibold text-red-600 transition-colors
                                               hover:bg-red-50 dark:border-red-500/30
                                               dark:text-red-400 dark:hover:bg-red-500/10"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>

                        {/* Add above / add below — see `compact`. */}
                        {!compact && (
                            <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
                                {addButton('Add above', index, true)}
                                {addButton('Add below', index + 1, true)}
                            </div>
                        )}

                        {/* ---------------- open: the fields ---------------- */}
                        {open && (
                            <div className="border-t border-slate-100 p-4 dark:border-[#1f1f1f]">
                                {row(item, (patch) => update(index, patch), index)}

                                {/*
                                  A SECOND "Done", at the foot of the form.
                                  The first sits on the row's header, which on a
                                  long form (a slide with its banner words) is
                                  scrolled far out of sight by the time the
                                  editor has finished — so the row just stayed
                                  open with no visible way to close it.
                                */}
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setOpenIndex(null)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2
                                                   text-[1.0625rem] font-semibold text-white transition-colors hover:bg-blue-700"
                                    >
                                        <Check className="w-4 h-4" /> Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
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
    step, title, hint, actions, sectionKey, fixed,
    ownFields = true, fieldMode = 'both', fieldNoun = 'detail', children,
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
    /**
     * WHICH SHAPES OF FIELD THIS CARD'S SURFACE CAN ACTUALLY DRAW.
     *
     * A named field is either a labelled fact in a details card, with an
     * icon, or a section of writing in the body. Most surfaces draw both, so
     * `both` is the default and the editor is asked which.
     *
     * Some draw only one, and asking on those is worse than not offering the
     * choice: the banner is white words over a photograph and has NO details
     * card, so "a labelled fact, with the icon you pick" describes something
     * that does not exist on that page. An editor picking it got a caption
     * and a glyph floating over the picture. Reported as "this is not logic
     * related to this card, why is it in the CMS".
     *
     * `content` hides the choice and the icon and writes `content`;
     * `card` hides the choice and keeps the icon. Either way the editor is
     * shown one form that does what the card can do, instead of two where one
     * is a dead end.
     */
    fieldMode?: 'both' | 'card' | 'content';
    /**
     * THIS CARD'S OWN WORD FOR ONE OF ITS EXTRA ROWS.
     *
     * "+ Add detail" by default, and a card says something better where it
     * has one: a rail of pills adds a "chip", a bench of people adds a
     * "person", a page of policy adds a "clause". It names the Add button,
     * the empty state and the delete confirmation, exactly as `noun` does on
     * every other list in this CMS — which is the point: an editor should
     * not have to learn that this particular list calls its rows "fields"
     * when the list above it calls its rows "chips".
     *
     * Singular. The list adds the "s".
     */
    fieldNoun?: string;
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
                                {/* The editor's name, if they gave the card
                                    one — a collapsed card that reverts to the
                                    shipped heading is a card they cannot find
                                    again by the name they know it by. */}
                                {tools.title || title || step || 'Section'}
                            </p>
                            <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                                Removed — this section is not shown on the public page.
                                {tools.fields.length > 0 && ' Your fields in it are kept.'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => tools.setHidden(false)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                   border-slate-300 bg-white px-3 py-1.5 text-[1.0625rem] font-semibold
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
        /*
         * ======================================================================
         * NO `overflow-hidden` HERE, AND THAT IS THE ICON BUG.
         * ======================================================================
         *
         * It was there to clip the header and footer bands to the card's
         * rounded corners — and it also clipped anything that OPENS inside the
         * card. The icon picker is an absolutely-positioned panel under its
         * button, so on a field near the bottom of a card the panel was cut
         * off at the card's edge: a sliver showing "PEOPLE" and a scrollbar,
         * with the icons themselves outside the clip and simply not drawn.
         *
         * The two bands round themselves instead (`rounded-t-2xl` /
         * `rounded-b-2xl`), which is the same corner treatment without a clip
         * that reaches every descendant. A dropdown that has to escape its
         * card is the normal case in a form, not the exception.
         */
        <section className="rounded-2xl border border-slate-200 bg-white
                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-24px_rgba(15,23,42,0.35)]
                            dark:border-[#1F1F1F] dark:bg-[#0A0A0A] dark:shadow-none">

            {title ? (
                <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 rounded-t-2xl border-b
                                   border-slate-100 bg-slate-50/70 px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6
                                   dark:border-[#1a1a1a] dark:bg-[#0F0F0F]">
                    <div className="min-w-0">
                        {step ? (
                            <p className="text-[1.0625rem] font-bold uppercase tracking-[0.16em]
                                          text-blue-600 dark:text-blue-400">
                                {step}
                            </p>
                        ) : null}
                        {/*
                          * THE CARD'S OWN HEADING, RENAMEABLE IN PLACE.
                          *
                          * `tools.title` is the editor's; `title` is the one
                          * this code ships. Blank falls back, so a card an
                          * editor has never renamed reads exactly as it
                          * always did and nothing had to be migrated.
                          *
                          * The rename pencil sits ON the heading rather than
                          * in the actions row, because that is the thing it
                          * changes — an Edit button four inches to the right
                          * of the word it renames is a button whose target
                          * has to be guessed.
                          *
                          * Only where there is a `sectionKey` and a provider
                          * to store it: a card with nowhere to write the
                          * new name must not offer to take one.
                          */}
                        {tools ? (
                            <StepTitle
                                shipped={title}
                                value={tools.title}
                                onChange={tools.setTitle}
                            />
                        ) : (
                            <h3 className={`${CARD_TITLE} mt-1 text-slate-900 dark:text-neutral-100`}>
                                {title}
                            </h3>
                        )}
                        {hint && (
                            <p className="mt-1.5 text-[1.1875rem] leading-snug text-slate-500
                                          dark:text-neutral-400">
                                {hint}
                            </p>
                        )}
                    </div>

                    {(actions || removable) ? (
                        <div className="flex flex-wrap shrink-0 items-center gap-2">
                            {actions}
                            {removable && <RemoveSection onRemove={() => tools.setHidden(true)} />}
                        </div>
                    ) : null}
                </header>
            ) : null}

            <div className="px-4 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
                {children}
                {tools && ownFields ? (
                    <SectionFields
                        fields={tools.fields}
                        onChange={tools.setFields}
                        mode={fieldMode}
                        noun={fieldNoun}
                    />
                ) : null}
            </div>

            {save ? (
                <footer className="rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-4 py-4
                                   sm:px-6 sm:py-5 dark:border-[#1a1a1a] dark:bg-[#0F0F0F]">
                    <SaveNow always block />
                </footer>
            ) : null}
        </section>
    );
}

/**
 * ==========================================================================
 * A CARD'S HEADING, WHICH THE EDITOR CAN RENAME
 * ==========================================================================
 *
 * Reads as a heading until the pencil beside it is pressed, then it is an
 * input with Save and Cancel. Not an always-on text box: forty cards' worth
 * of input boxes down a CMS screen is forty things that look editable and
 * one heading nobody can find, and an editor who tabs through the form would
 * land in every card title on the way to the field they wanted.
 *
 * `Reset` appears only once a name has been set, and puts the shipped
 * heading back — because "clear it" and "put it back to the default" are
 * two different intentions, and an empty box means the first of them.
 *
 * ESCAPE CANCELS, ENTER SAVES. Both, because this is one line of text in a
 * form with no submit of its own, and Enter in a lone input that does
 * nothing is the most surprising thing a text field can do.
 */
function StepTitle({ shipped, value, onChange }: {
    /** The heading this code ships for the card. */
    shipped: string;
    /** The editor's own, or '' for "use the shipped one". */
    value: string;
    onChange: (next: string) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    const open = () => { setDraft(value || shipped); setEditing(true); };
    const commit = () => {
        /* Typing the shipped heading back in stores NOTHING, so the card goes
           back to following the code rather than pinning today's wording. */
        const next = draft.trim();
        onChange(next === shipped.trim() ? '' : next);
        setEditing(false);
    };

    if (!editing) {
        return (
            <div className="mt-1 flex items-center gap-2">
                <h3 className={`${CARD_TITLE} min-w-0 text-slate-900 dark:text-neutral-100`}>
                    {value || shipped}
                </h3>
                <button
                    type="button"
                    onClick={open}
                    title="Rename this section"
                    aria-label={`Rename the section “${value || shipped}”`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1
                               text-[1.0625rem] font-semibold text-slate-400 transition-colors
                               hover:bg-blue-50 hover:text-blue-700
                               dark:text-neutral-500 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Rename</span>
                </button>
            </div>
        );
    }

    return (
        <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                }}
                aria-label="Section heading"
                className="min-w-0 flex-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5
                           text-[1.375rem] font-bold text-slate-900 outline-none
                           focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/20
                           dark:border-blue-900 dark:bg-[#0A0A0A] dark:text-neutral-100"
            />
            <button
                type="button"
                onClick={commit}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5
                           text-[1.0625rem] font-semibold text-white transition-colors
                           hover:bg-[#1d4ed8]"
            >
                <Check className="h-3.5 w-3.5" /> Done
            </button>
            <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5
                           text-[1.0625rem] font-semibold text-slate-500 transition-colors
                           hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-[#161616]"
            >
                Cancel
            </button>
            {value ? (
                <button
                    type="button"
                    onClick={() => { onChange(''); setEditing(false); }}
                    title={`Put back “${shipped}”`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5
                               text-[1.0625rem] font-semibold text-slate-500 transition-colors
                               hover:bg-slate-100 dark:text-neutral-400 dark:hover:bg-[#161616]"
                >
                    <Undo2 className="h-3.5 w-3.5" /> Reset
                </button>
            ) : null}
        </div>
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
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[1.0625rem]
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
                           text-[1.0625rem] font-semibold text-white transition-colors hover:bg-red-700"
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

const EMPTY_OVERRIDE: CmsSectionOverride = { key: '', hidden: false, title: '', fields: [] };

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
        /* Blank means "the heading this code ships" — see `title` on the
           section-override schema. Never falls back to the key. */
        title: (row?.title || '').trim(),
        fields: row?.fields || [],
        setHidden: (hidden: boolean) => write({ hidden }),
        setTitle: (title: string) => write({ title }),
        setFields: (fields: CmsExtraField[]) => write({ fields }),
    };
};

/**
 * ==========================================================================
 * THE EDITOR'S OWN ROWS INSIDE ONE CARD — the same list as every other list
 * ==========================================================================
 *
 * This was a stack of always-open boxes: a placement pair, an icon select, a
 * name box and a value box, all four visible on every row at once. Four rows
 * of that is sixteen controls in one column, and nothing in it says what the
 * rows ARE without reading every one of them.
 *
 * Every other repeating thing in this CMS — the filter chips, the banner
 * slides, the footer columns, the office-bearers — is drawn by
 * `RepeatableList`: a numbered card per row that is CLOSED and shows what the
 * row says, with Edit/Done, the reorder arrows, a labelled Delete, and Add
 * above / Add below. The editor asked for exactly that here, and they were
 * right: if that treatment is on every card, this does not need a treatment
 * of its own.
 *
 * So this IS that list now, and the whole of what is left below is the ROW —
 * the three questions one field answers — handed to the component that has
 * always drawn the frame. The bespoke frame is gone rather than kept beside
 * it: two treatments for one idea is how the icon and the placement control
 * ended up on the gallery's rows and missing from every other card.
 *
 * `compact` is left off, so Add above and Add below are there. The order of
 * these rows is the order they appear in on the public page — the only
 * positioning this feature offers — and inserting one in the middle is the
 * ordinary case, not the exception.
 */
function SectionFields({ fields, onChange, mode = 'both', noun = 'detail' }: {
    fields: CmsExtraField[];
    onChange: (next: CmsExtraField[]) => void;
    /** What this card's surface can draw — see `fieldMode` on `CmsStep`. */
    mode?: 'both' | 'card' | 'content';
    /** This card's own word for one of these rows — see `fieldNoun`. */
    noun?: string;
}) {
    const rows = fields || [];
    /* A card that draws only one shape writes that shape, and does not ask. */
    const fixedPlacement = mode === 'both' ? null : mode;

    /** Which of the two shapes a row is, once the card's own limit is applied. */
    const shapeOf = (field: CmsExtraField) =>
        ((fixedPlacement || field.placement) === 'content' ? 'content' : 'card');

    return (
        <div className="mt-6 border-t border-dashed border-slate-200 pt-5 dark:border-[#232323]">
            {/*
              * ONE LINE, AND THE CARD'S OWN WORD FOR THE THING.
              *
              * This carried a bold "Your own fields in this section" over two
              * lines of explanation, which made a block inside a card look
              * like a second card with a heading of its own. The filter-chip
              * list four inches above it is the same idea and says nothing at
              * all — its card heading is the label, and "+ Add chip" is the
              * whole instruction.
              *
              * So this is one muted line and the shared list, which draws its
              * own "+ Add <noun>" and its own empty state. The noun comes
              * from the card (`fieldNoun`), so a card about people says
              * "+ Add person" and not "+ Add field".
              */}
            <p className="mb-3 text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                {mode === 'content'
                    ? `Each ${noun} appears inside this section on the public page, as a piece of `
                      + 'writing under the heading you give it.'
                    : mode === 'card'
                        ? `Each ${noun} appears inside this section on the public page, under the `
                          + 'name and the mark you give it.'
                        : `Each ${noun} appears inside this section on the public page — as a labelled `
                          + 'fact with a mark, or as a piece of writing of its own.'}
            </p>

            <RepeatableList<CmsExtraField>
                items={rows}
                onChange={onChange}
                noun={noun}
                blank={() => ({
                    label: '', value: '', icon: 'info', placement: fixedPlacement || 'card',
                })}
                /*
                 * THE CLOSED ROW IS THE FIELD'S OWN NAME.
                 *
                 * Not "field 3". The name is what the editor typed and what
                 * the public page prints beside the value, so it is the one
                 * string that identifies the row — the same reason the filter
                 * chips had to be told to read their `label` rather than a
                 * `title` they do not have, which is what printed "Untitled
                 * chip" six times down that card.
                 *
                 * The subtitle names the SHAPE, because that is the other
                 * thing a closed row cannot show and the one an editor is
                 * most likely to have set the other way round by accident.
                 */
                summary={(field) => ({
                    title: (field.label || '').trim(),
                    subtitle: [
                        shapeOf(field) === 'content' ? 'A section of writing' : 'A labelled fact',
                        (field.value || '').replace(/\s+/g, ' ').trim().slice(0, 60),
                    ].filter(Boolean).join(' · '),
                })}
                row={(field, update) => (
                    <div className="space-y-3">
                        {/* Asked only where there is something to choose. */}
                        {!fixedPlacement && (
                            <StepFieldPlacement
                                value={field.placement === 'content' ? 'content' : 'card'}
                                onChange={placement => update({ placement })}
                            />
                        )}

                        {/*
                          * `minmax(0, …)` ON EVERY TRACK.
                          *
                          * A bare `1fr` is `minmax(auto, 1fr)`, which refuses
                          * to shrink below its content's minimum — and the
                          * icon picker's content is the longest icon name in
                          * the list. That is the icon bug: the select was
                          * squeezed to its minimum and the name inside it
                          * rendered as "briefc…". An 11rem floor is wide
                          * enough for the mark, the name and the chevron.
                          */}
                        <div className="grid grid-cols-1 gap-3
                                        sm:grid-cols-[minmax(0,11rem)_minmax(0,15rem)_minmax(0,1fr)]">
                            {/* Only a card row is drawn with a mark. */}
                            {shapeOf(field) !== 'content' ? (
                                <IconPicker
                                    label="Icon"
                                    value={field.icon || 'info'}
                                    onChange={icon => update({ icon })}
                                />
                            ) : <div className="hidden sm:block" />}

                            <CmsField label="Field name">
                                <CmsInput
                                    value={field.label}
                                    onChange={e => update({ label: e.target.value })}
                                    placeholder={shapeOf(field) === 'content'
                                        ? 'How we chose the venue'
                                        : 'Field name'}
                                />
                            </CmsField>
                            <CmsField label="What it says">
                                <CmsTextarea
                                    rows={shapeOf(field) === 'content' ? 5 : 2}
                                    value={field.value}
                                    onChange={e => update({ value: e.target.value })}
                                    placeholder={shapeOf(field) === 'content'
                                        ? 'A paragraph. Blank lines start a new one.'
                                        : 'What it says'}
                                />
                            </CmsField>
                        </div>
                    </div>
                )}
            />
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
                        <p className="text-[1.1875rem] font-medium text-slate-600 dark:text-[#A1A1AA]
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

/**
 * Where a section's own field goes — exactly one of two, so a radio group.
 *
 * `CmsStep`'s rows are drawn inline rather than in a card, so this is a
 * compact pair rather than the two description cards `ExtraFieldsEditor`
 * uses. The ANSWER is the same in both, and the same field on the record.
 */
function StepFieldPlacement({ value, onChange }: {
    value: 'card' | 'content';
    onChange: (next: 'card' | 'content') => void;
}) {
    const options: { value: 'card' | 'content'; label: string }[] = [
        { value: 'card', label: 'A labelled fact' },
        { value: 'content', label: 'A section of writing' },
    ];

    return (
        <div role="radiogroup" aria-label="Where it appears" className="flex flex-wrap items-center gap-2">
            <span className="text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400">
                Show it as
            </span>
            {options.map(opt => {
                const on = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(opt.value)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1
                                    text-[1.0625rem] font-semibold transition-colors ${on
                            ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200'
                            : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-[#2a2a2a] dark:text-neutral-300'}`}
                    >
                        <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border-2 ${on
                            ? 'border-blue-600' : 'border-slate-400'}`}>
                            {on && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
                        </span>
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================ icon picker
//
// Lives here rather than in `CmsEditors` because `CmsStep` above needs it
// and that file imports from this one. Re-exported there for its old
// callers.

/**
 * ==========================================================================
 * PICK A MARK, OR TYPE ITS NAME
 * ==========================================================================
 *
 * It was a button and a grid: the only way to set an icon was to find it
 * among fifty-four squares, and the only thing the closed control told you
 * was the name it had already been given. Two problems with that.
 *
 * AN EDITOR WHO KNOWS THE NAME HAD NO WAY TO SAY IT. "camera" is four
 * keystrokes and a hunt through ten groups. Typing is now the primary
 * action — the control IS a text box — and the grid is what it falls back
 * to when you do not know what is available.
 *
 * AND THE GRID DID NOT OFFER EVERYTHING. Ten names the site draws were
 * missing from it, so they could not be reached at all. That list is one
 * list now (see `ICON_GROUPS`), but the lesson stands: a chooser that is the
 * ONLY way in has to be complete, and a typed name does not depend on it.
 *
 * WHAT YOU TYPE IS CHECKED, VISIBLY. `icon()` on the server swaps a name it
 * does not know for a fallback and says nothing, so a typo would be stored
 * as `star` and the editor would find out by looking at the live page. The
 * line under the box says whether this name will draw, before the save.
 */
export function IconPicker({ value, onChange, label = 'Icon' }: {
    value: string;
    onChange: (icon: string) => void;
    label?: string;
}) {
    const [open, setOpen] = useState(false);
    const typed = String(value || '').trim();
    const known = hasIcon(typed);

    /*
     * The grid narrows to what has been typed, so typing "cal" and opening
     * the list shows the two calendars rather than all ten groups. It matches
     * anywhere in the name, not just the start: an editor looking for
     * "graduation-cap" is as likely to type "cap".
     */
    const needle = typed.toLowerCase();
    const groups = ICON_GROUPS
        .map(group => ({
            label: group.label,
            icons: known || !needle
                ? group.icons
                : group.icons.filter(name => name.includes(needle)),
        }))
        .filter(group => group.icons.length > 0);

    return (
        <div className="relative">
            <span className="block text-[1.25rem] font-medium text-slate-700 dark:text-neutral-300 mb-1.5">
                {label}
            </span>

            <div className={`flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2
                             dark:bg-black ${known || !typed
                    ? 'border-slate-300 dark:border-[#2a2a2a]'
                    : 'border-amber-400 dark:border-amber-600'}`}>
                {/* The mark itself, drawn from what is in the box. It updates as
                    you type, which is the whole answer to "will this work". */}
                <CmsIcon
                    name={typed}
                    size={18}
                    fallback="info"
                    className={`shrink-0 ${known
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-neutral-600'}`}
                />
                <input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value.trim())}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
                    placeholder="Type a name, or pick one"
                    aria-label={label}
                    spellCheck={false}
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-[1.25rem] text-slate-900 outline-none
                               placeholder:text-slate-400 dark:text-neutral-100
                               dark:placeholder:text-neutral-600"
                />
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    aria-label={open ? 'Hide the icons' : 'Show all the icons'}
                    aria-expanded={open}
                    className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-800
                               dark:text-neutral-400 dark:hover:text-neutral-100"
                >
                    <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
                </button>
            </div>

            {/*
              * SAID BEFORE THE SAVE, not discovered on the live page.
              *
              * An unknown name is not refused — the box keeps what was typed,
              * so a half-finished word is not deleted out from under the
              * editor mid-keystroke. It is simply reported, because the
              * server will quietly replace it with a fallback otherwise.
              */}
            {typed && !known && (
                <p className="mt-1 text-[1.0625rem] font-medium text-amber-700 dark:text-amber-500">
                    No icon is called “{typed}”. Saved as it is, the page draws the
                    plain note mark instead — open the list to see the names.
                </p>
            )}

            {open && (
                /*
                 * `min-w` AS WELL AS `w-full`: eight icons to a row needs about
                 * 20rem, and `w-full` alone makes the panel as wide as its
                 * control — in a three-column row that is 11rem, which squeezed
                 * the grid to about 20px a cell.
                 */
                <div className="absolute z-30 mt-1 w-full min-w-[20rem] max-h-72 overflow-y-auto
                                bg-white dark:bg-[#0a0a0a]
                                border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl p-3 space-y-3">
                    {groups.length === 0 ? (
                        <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                            No icon name contains “{typed}”.
                        </p>
                    ) : groups.map(group => (
                        <div key={group.label}>
                            <p className="text-[1.0625rem] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                                {group.label}
                            </p>
                            <div className="grid grid-cols-8 gap-1">
                                {group.icons.map(name => (
                                    <button
                                        key={name}
                                        type="button"
                                        title={name}
                                        onClick={() => { onChange(name); setOpen(false); }}
                                        className={`aspect-square flex items-center justify-center rounded-md transition-colors ${
                                            value === name
                                                ? 'bg-blue-600 text-white'
                                                : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#161616]'
                                        }`}
                                    >
                                        <CmsIcon name={name} size={16} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

