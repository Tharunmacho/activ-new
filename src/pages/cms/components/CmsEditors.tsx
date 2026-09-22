import { useState, type ReactNode } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, Pencil, Check } from 'lucide-react';
import { CmsInput, CmsTextarea, CmsField, CmsSection } from './CmsUI';
import RichTextEditor from './RichTextEditor';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { ICON_GROUPS, type CmsLink, type CmsStat, type CmsBullet, type CmsExtraField } from '@/services/cmsApi';

/**
 * Editors for the repeating parts of a page.
 *
 * Nav links, footer columns, stats, bullets and filter chips are all "a list of
 * small records the admin can add to, reorder and remove". Written once here
 * rather than seven times across the managers: the add/remove/reorder logic is
 * where off-by-one bugs live, and one copy of it is one copy to get right.
 */

// ============================================================ icon picker

/**
 * Pick an icon by name.
 *
 * A grid of the real glyphs rather than a `<select>` of names: nobody knows what
 * "hard-hat" looks like from the string, and choosing the wrong one is only
 * discovered on the live site.
 */
export function IconPicker({ value, onChange, label = 'Icon' }: {
    value: string;
    onChange: (icon: string) => void;
    label?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative">
            <span className="block text-[1.25rem] font-medium text-slate-700 dark:text-neutral-300 mb-1.5">{label}</span>

            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 bg-slate-50 dark:bg-black border border-slate-300
                           dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-[1.25rem] text-slate-900 dark:text-neutral-100"
            >
                <CmsIcon name={value} size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="truncate flex-1 text-left">{value || 'none'}</span>
                <ChevronDown size={14} className="shrink-0 opacity-60" />
            </button>

            {open && (
                <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white dark:bg-[#0a0a0a]
                                border border-slate-200 dark:border-[#2a2a2a] rounded-lg shadow-xl p-3 space-y-3">
                    {ICON_GROUPS.map(group => (
                        <div key={group.label}>
                            <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
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

// ============================================================ generic list

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
    items, onChange, noun, blank, row, reorderable = true, max, summary, compact = false,
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
                        <div className="flex items-center gap-3 p-3.5">
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

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[1.25rem] font-bold text-slate-900
                                              dark:text-white">
                                    {said.title || `Untitled ${noun}`}
                                </p>
                                {said.subtitle && (
                                    <p className="truncate text-[1rem] text-slate-500
                                                  dark:text-neutral-400">
                                        {said.subtitle}
                                    </p>
                                )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
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
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================ typed lists

/** Links: a label and where it goes. Used by the nav and every footer column. */
export function LinkList({ items, onChange, noun = 'link' }: {
    items: CmsLink[];
    onChange: (next: CmsLink[]) => void;
    noun?: string;
}) {
    return (
        <RepeatableList<CmsLink>
            items={items}
            onChange={onChange}
            noun={noun}
            /* Two fields a row. See the note on `compact`. */
            compact
            /* The label and where it goes — which is the whole of a link. */
            summary={(item) => ({ title: item.label, subtitle: item.href })}
            blank={() => ({ label: '', href: '' })}
            row={(item, update) => (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <CmsField label="Label">
                        <CmsInput
                            value={item.label}
                            onChange={e => update({ label: e.target.value })}
                            placeholder="About"
                        />
                    </CmsField>
                    <CmsField label="Link" hint="A path like /about, or a full https:// address.">
                        <CmsInput
                            value={item.href}
                            onChange={e => update({ href: e.target.value })}
                            placeholder="/about"
                        />
                    </CmsField>
                </div>
            )}
        />
    );
}

/** Figures: an icon, a number and what it counts. */
export function StatList({ items, onChange, noun = 'figure', max }: {
    items: CmsStat[];
    onChange: (next: CmsStat[]) => void;
    noun?: string;
    max?: number;
}) {
    return (
        <RepeatableList<CmsStat>
            items={items}
            onChange={onChange}
            noun={noun}
            max={max}
            /* The figure leads, because it is what the card shows. */
            summary={(item) => ({ title: item.value, subtitle: item.label })}
            blank={() => ({ icon: 'users', value: '', label: '' })}
            row={(item, update) => (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <IconPicker value={item.icon} onChange={ic => update({ icon: ic })} />
                    <CmsField label="Figure">
                        <CmsInput
                            value={item.value}
                            onChange={e => update({ value: e.target.value })}
                            placeholder="10K+"
                        />
                    </CmsField>
                    <CmsField label="Caption">
                        <CmsInput
                            value={item.label}
                            onChange={e => update({ label: e.target.value })}
                            placeholder="Active Members"
                        />
                    </CmsField>
                </div>
            )}
        />
    );
}

/** Bullets: an icon and a line of text, which may carry simple markup. */
export function BulletList({ items, onChange }: {
    items: CmsBullet[];
    onChange: (next: CmsBullet[]) => void;
}) {
    return (
        <RepeatableList<CmsBullet>
            items={items}
            onChange={onChange}
            noun="point"
            /* The markup is stripped: a closed row is a line of prose, not tags. */
            summary={(item) => ({ title: (item.text || '').replace(/<[^>]+>/g, '').slice(0, 90) })}
            blank={() => ({ icon: 'users', text: '' })}
            row={(item, update) => (
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
                    <IconPicker value={item.icon} onChange={ic => update({ icon: ic })} />
                    <CmsField label="Text">
                        <RichTextEditor
                            rows={3}
                            value={item.text}
                            onChange={text => update({ text })}
                            placeholder="A Non-Government, Non-Profit business association…"
                        />
                    </CmsField>
                </div>
            )}
        />
    );
}

/**
 * A list of plain lines, edited as a textarea.
 *
 * Address lines and opening hours are ordered prose, not records. A row editor
 * for them would be four boxes and three buttons to type what is naturally one
 * short block of text.
 */
/**
 * A list of plain lines, edited as a textarea.
 *
 * `label` is optional: inside a section that already names the field, a second
 * identical label above the box is noise rather than guidance.
 */
export function LineList({ label = '', hint, value, onChange, rows = 4, placeholder, clearable = false }: {
    label?: string;
    hint?: string;
    value: string[];
    onChange: (next: string[]) => void;
    rows?: number;
    placeholder?: string;
    /** Offer a Clear button when the list holds anything. */
    clearable?: boolean;
}) {
    // A list of empty strings is an empty list — the textarea leaves one behind
    // after the last newline, so `length` alone would keep offering to clear a
    // list that is already blank.
    const hasContent = (value || []).some(line => (line || '').trim());

    return (
        <CmsField
            label={label}
            hint={hint || 'One per line.'}
            onClear={clearable ? () => onChange([]) : undefined}
            canClear={hasContent}
        >
            <CmsTextarea
                rows={rows}
                value={(value || []).join('\n')}
                // Split on save rather than per keystroke, so a trailing blank
                // line being typed does not vanish under the cursor.
                onChange={e => onChange(e.target.value.split('\n'))}
                placeholder={placeholder}
            />
        </CmsField>
    );
}

/**
 * The editor's own fields, on any page.
 *
 * Every page in this CMS declares the fields its LAYOUT depends on — a heading
 * is set in the heading's type, a hero image fills the hero — and no schema can
 * enumerate what an association will want to say next. This is the escape
 * hatch: name a field, write its content, and the page renders it. Delete the
 * row and it is gone.
 *
 * One component rather than one per screen, so "your own fields" means the same
 * thing, looks the same and is edited the same way on Home, About, Events,
 * Gallery, Contact and the footer.
 */
export function ExtraFieldsEditor({ items, onChange, hint, bare = false }: {
    items: CmsExtraField[];
    onChange: (next: CmsExtraField[]) => void;
    /** Where these appear on the public page, in the editor's words. */
    hint?: string;
    /**
     * Drop the heading, because the card around it already carries one.
     *
     * This renders a `CmsSection` — a heading inside a card — and on three
     * screens it was dropped straight into the column with no card at all,
     * so it sat between two numbered cards as loose text on the page
     * background. Given its own card it needs no second heading.
     */
    bare?: boolean;
}) {
    const rows = (
            <RepeatableList<CmsExtraField>
                items={items || []}
                onChange={onChange}
                noun="field"
                summary={(field) => ({ title: field.label, subtitle: field.value })}
                blank={() => ({ label: '', value: '' })}
                row={(field, update) => (
                    /* Stacked below `sm`: a long value must never push the row
                       wider than the card it sits in. */
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-3">
                        <CmsField label="Field name">
                            <CmsInput
                                value={field.label}
                                onChange={e => update({ label: e.target.value })}
                                placeholder="Registration desk"
                            />
                        </CmsField>
                        <CmsField label="Content">
                            <CmsTextarea
                                rows={2}
                                value={field.value}
                                onChange={e => update({ value: e.target.value })}
                                placeholder="Open 9am–5pm, Monday to Friday"
                            />
                        </CmsField>
                    </div>
                )}
            />
    );

    if (bare) return rows;

    return (
        <CmsSection
            title="Your own fields"
            hint={hint || 'Add anything this form does not already ask for. Each row shows as a labelled '
                + 'line on the page, in this order. Delete a row to remove it.'}
        >
            {rows}
        </CmsSection>
    );
}
