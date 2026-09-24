import { useState, type ReactNode } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, Pencil, Check } from 'lucide-react';
import { CmsInput, CmsTextarea, CmsField, CmsSection, IconPicker, RepeatableList } from './CmsUI';
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

/*
 * `IconPicker` AND `RepeatableList` moved to `CmsUI`, and are re-exported at
 * the foot of this file.
 *
 * `CmsStep`'s own section-fields control needs it — those rows carry an icon
 * now — and this file imports FROM `CmsUI`, so `CmsUI` importing back would be
 * a cycle. It lives in the lower of the two; the re-export keeps every call
 * site that already names it working unchanged.
 */


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
export function ExtraFieldsEditor({ items, onChange, hint, title, bare = false }: {
    items: CmsExtraField[];
    onChange: (next: CmsExtraField[]) => void;
    /** Where these appear on the public page, in the editor's words. */
    hint?: string;
    /**
     * The card's heading. "Your own fields" reads right on a page; a list
     * nested inside one row of another list wants to say whose fields these
     * are — "Its own fields", on a photograph.
     */
    title?: string;
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
                summary={(field) => ({
                    title: field.label,
                    subtitle: [
                        field.placement === 'content' ? 'In the write-up' : 'In the details card',
                        field.value,
                    ].filter(Boolean).join(' · '),
                })}
                blank={() => ({ label: '', value: '', icon: 'info', placement: 'card' })}
                row={(field, update) => (
                    <div className="space-y-4">
                        {/*
                          * WHERE IT GOES, asked first, because it decides what
                          * the two boxes below are for: a card field is a
                          * one-line fact, a content field is a section of prose.
                          *
                          * Every named field on every screen used to land in the
                          * details card, so an editor with a paragraph to write
                          * had only a box built for one line to put it in.
                          */}
                        <FieldPlacement
                            value={field.placement === 'content' ? 'content' : 'card'}
                            onChange={placement => update({ placement })}
                        />

                        {/* Stacked below `sm`: a long value must never push the
                            row wider than the card it sits in. */}
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-3">
                            {/* Only a card field is drawn with a mark, so the
                                picker is only asked for when it is one. */}
                            {field.placement !== 'content' ? (
                                <IconPicker
                                    value={field.icon || 'info'}
                                    onChange={icon => update({ icon })}
                                />
                            ) : <div className="hidden sm:block" />}

                            <div className="space-y-3">
                                <CmsField label="Field name" hint="Printed exactly as you type it.">
                                    <CmsInput
                                        value={field.label}
                                        onChange={e => update({ label: e.target.value })}
                                        placeholder={field.placement === 'content'
                                            ? 'How we chose the venue'
                                            : 'Registration desk'}
                                    />
                                </CmsField>
                                <CmsField label="Content">
                                    <CmsTextarea
                                        rows={field.placement === 'content' ? 5 : 2}
                                        value={field.value}
                                        onChange={e => update({ value: e.target.value })}
                                        placeholder={field.placement === 'content'
                                            ? 'A paragraph. Blank lines start a new one.'
                                            : 'Open 9am–5pm, Monday to Friday'}
                                    />
                                </CmsField>
                            </div>
                        </div>
                    </div>
                )}
            />
    );

    if (bare) return rows;

    return (
        <CmsSection
            title={title || 'Your own fields'}
            hint={hint || 'Add anything this form does not already ask for. Each row can sit in the '
                + 'details card as a labelled fact, or become a section of its own in the write-up.'}
        >
            {rows}
        </CmsSection>
    );
}


/**
 * Where a named field goes — exactly one of two, so a radio group.
 *
 * Two `aria-pressed` buttons would look exclusive and not be: assistive tech
 * announces each as separately switchable and the keyboard tabs through two
 * stops. The same rule the CMS applies to every other pick-one on the site.
 */
function FieldPlacement({ value, onChange }: {
    value: 'card' | 'content';
    onChange: (next: 'card' | 'content') => void;
}) {
    const options: { value: 'card' | 'content'; label: string; hint: string }[] = [
        {
            value: 'card',
            label: 'In the details card',
            hint: 'A labelled fact beside the page, with the icon you pick. Best for one line — a name, a date, a number.',
        },
        {
            value: 'content',
            label: 'In the write-up',
            hint: 'A section of its own in the body, with your name for it as the heading. Best for a paragraph.',
        },
    ];

    return (
        <div role="radiogroup" aria-label="Where it appears">
            <span className="mb-1.5 block text-[1.25rem] font-medium text-slate-700 dark:text-neutral-300">
                Where it appears
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
                {options.map(opt => {
                    const on = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onChange(opt.value)}
                            className={`rounded-xl border p-3 text-left transition-colors ${on
                                ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                                : 'border-slate-300 hover:border-slate-400 dark:border-[#2a2a2a]'}`}
                        >
                            <span className="flex items-center gap-2">
                                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on
                                    ? 'border-blue-600' : 'border-slate-400'}`}>
                                    {on && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                </span>
                                <span className="text-[1.1875rem] font-bold text-slate-900 dark:text-white">
                                    {opt.label}
                                </span>
                            </span>
                            <span className="mt-1 block pl-6 text-[1.0625rem] leading-snug text-slate-500 dark:text-neutral-400">
                                {opt.hint}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export { IconPicker, RepeatableList } from './CmsUI';
