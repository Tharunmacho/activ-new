import { useState, type ReactNode } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import { CmsInput, CmsTextarea, CmsField } from './CmsUI';
import RichTextEditor from './RichTextEditor';
import { CmsIcon } from '@/components/shared/CmsIcon';
import { ICON_GROUPS, type CmsLink, type CmsStat, type CmsBullet } from '@/services/cmsApi';

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
            <span className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">{label}</span>

            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 bg-slate-50 dark:bg-black border border-slate-300
                           dark:border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-neutral-100"
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
                            <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
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
 * A list the admin can add to, reorder and remove from.
 *
 * Reordering matters more than it looks: these lists render in order, so the
 * first carousel slide is what most visitors see and the first nav link is the
 * leftmost. Without arrows the only way to reorder is to delete and retype.
 */
export function RepeatableList<T>({
    items, onChange, noun, blank, row, reorderable = true, max,
}: ListProps<T>) {
    const update = (index: number, patch: Partial<T>) =>
        onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

    /**
     * Confirmed, because it cannot be undone.
     *
     * This deleted on a single click of a 14px icon with no label and no
     * confirmation — the same size and position as the two reorder arrows
     * beside it, so losing a slide to a misclick took one slip and there was
     * no way back. The button is now labelled and asks first.
     */
    const remove = (index: number) => {
        const ok = window.confirm(
            `Delete this ${noun}? It is removed from the live site when you save, and cannot be undone.`,
        );
        if (!ok) return;
        onChange(items.filter((_, i) => i !== index));
    };

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const atLimit = typeof max === 'number' && items.length >= max;

    return (
        <div className="space-y-3">
            {items.length === 0 && (
                <p className="text-sm text-neutral-500 py-4 text-center border border-dashed
                              border-slate-300 dark:border-[#2a2a2a] rounded-lg">
                    No {noun}s yet.
                </p>
            )}

            {items.map((item, index) => (
                <div
                    key={index}
                    className="border border-slate-200 dark:border-[#2a2a2a] rounded-lg p-4
                               bg-slate-50/60 dark:bg-black/40"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                            {noun} {index + 1}
                        </span>
                        <div className="flex items-center gap-1">
                            {reorderable && (
                                <>
                                    <button
                                        type="button" onClick={() => move(index, -1)} disabled={index === 0}
                                        aria-label={`Move ${noun} up`}
                                        className="p-1.5 rounded text-neutral-500 hover:text-slate-900 dark:hover:text-white
                                                   disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1}
                                        aria-label={`Move ${noun} down`}
                                        className="p-1.5 rounded text-neutral-500 hover:text-slate-900 dark:hover:text-white
                                                   disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button" onClick={() => remove(index)}
                                aria-label={`Delete ${noun} ${index + 1}`}
                                className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                           text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30
                                           hover:bg-red-500/10 transition-colors"
                            >
                                <Trash2 size={13} /> Delete
                            </button>
                        </div>
                    </div>

                    {row(item, patch => update(index, patch), index)}
                </div>
            ))}

            <button
                type="button"
                onClick={() => onChange([...items, blank()])}
                disabled={atLimit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                           border border-dashed border-slate-300 dark:border-[#2a2a2a] text-slate-600
                           dark:text-neutral-300 hover:border-blue-500 hover:text-blue-600 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Plus size={16} />
                {atLimit ? `Maximum of ${max}` : `Add ${noun}`}
            </button>
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
export function LineList({ label = '', hint, value, onChange, rows = 4, placeholder }: {
    label?: string;
    hint?: string;
    value: string[];
    onChange: (next: string[]) => void;
    rows?: number;
    placeholder?: string;
}) {
    return (
        <CmsField label={label} hint={hint || 'One per line.'}>
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
