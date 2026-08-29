import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Plus, CheckCircle2, Sparkles, Globe, X } from 'lucide-react';

/**
 * A region name field: a grouped dropdown, free text, and a "+" for what is
 * missing.
 *
 * A plain `<datalist>` was wrong here, and the way it was wrong matters. It
 * merged the two staffed states with all thirty-odd names from the India
 * reference into one undifferentiated list, so "Tamil Nadu" — 405 staffed
 * blocks — looked exactly like "Andaman And Nicobar Islands", which nobody
 * covers. The list said nothing about which of them actually exists on this
 * platform.
 *
 * Three groups, as on mobile, because the distinction is the whole point:
 *
 *   Added now       typed on this form and not yet saved.
 *   Already in use  has an admin. Picking one JOINS that region, and the new
 *                   admin shares its queue.
 *   All <regions>   the canonical India reference. Nobody staffs these yet;
 *                   picking one CREATES the region on save.
 *
 * The "+" is the escape hatch: the reference data does not know every block in
 * the country. A name added that way joins the list immediately, so a second
 * admin for the same new region is picked rather than retyped — which is the
 * point, since `buildGeoFilter` matches an admin's region against an
 * application's with an anchored regex, and "Ariyalur" and "ariyalur " would be
 * two regions splitting one queue.
 */

interface Props {
    label: string;
    value: string;
    onChange: (name: string) => void;
    /** Regions that already have an admin. */
    inUse: string[];
    /** The canonical reference for this level, unstaffed. */
    reference: string[];
    /** e.g. "in Tamil Nadu" — says what the list is scoped to. */
    scopeLabel?: string;
    disabled?: boolean;
    hint?: string;
}

export default function RegionInput({
    label, value, onChange, inUse, reference, scopeLabel, disabled, hint,
}: Props) {
    const [open, setOpen] = useState(false);
    const [added, setAdded] = useState<string[]>([]);
    const wrap = useRef<HTMLDivElement>(null);

    // Close on an outside click; a combobox left open over the form swallows
    // the next field's focus.
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const typed = value.trim();
    const matches = (list: string[]) =>
        typed ? list.filter(n => n.toLowerCase().includes(typed.toLowerCase())) : list;

    const addedMatches = useMemo(() => matches(added), [added, typed]);
    const usedMatches = useMemo(() => matches(inUse), [inUse, typed]);
    // Never repeat a name that is already staffed — it belongs in one group.
    const refMatches = useMemo(
        () => matches(reference.filter(r => !inUse.includes(r) && !added.includes(r))),
        [reference, inUse, added, typed],
    );

    /** Offered only when what was typed exists in none of the three groups. */
    const canAdd = useMemo(() => {
        if (!typed) return false;
        const all = [...added, ...inUse, ...reference].map(n => n.toLowerCase());
        return !all.includes(typed.toLowerCase());
    }, [typed, added, inUse, reference]);

    const add = () => {
        if (!canAdd) return;
        setAdded(prev => [...prev, typed]);
        onChange(typed);
        setOpen(false);
    };

    const pick = (name: string) => {
        onChange(name);
        setOpen(false);
    };

    const group = (
        title: string,
        names: string[],
        Icon: typeof CheckCircle2,
        tone: string,
        removable = false,
    ) => {
        if (!names.length) return null;
        return (
            <div key={title}>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 sticky top-0">
                    <Icon className={`w-3.5 h-3.5 ${tone}`} />
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-gray-500">
                        {title}
                    </span>
                    {/* The count is here so it is obvious nothing was truncated. */}
                    <span className="text-[0.6875rem] text-gray-400">{names.length}</span>
                </div>

                {names.map(name => (
                    <div key={name} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => pick(name)}
                            className={`flex-1 text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                name === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-800'
                            }`}
                        >
                            {name}
                        </button>

                        {/* Only a name added on this form can be taken back — the
                            other two groups are not this list's to edit. */}
                        {removable && (
                            <button
                                type="button"
                                onClick={() => {
                                    setAdded(prev => prev.filter(n => n !== name));
                                    if (value === name) onChange('');
                                }}
                                aria-label={`Remove ${name}`}
                                className="px-2 text-gray-400 hover:text-red-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const nothing = !addedMatches.length && !usedMatches.length && !refMatches.length;

    return (
        <div className="space-y-1.5" ref={wrap}>
            <label className="block text-sm font-medium text-gray-700">{label}</label>

            <div className="relative">
                <input
                    type="text"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={disabled ? 'Pick the level above first' : `Type or pick a ${label.toLowerCase()}`}
                    autoComplete="off"
                    className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent
                               disabled:bg-gray-50 disabled:text-gray-400"
                />

                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    {canAdd && !disabled && (
                        <button
                            type="button"
                            onClick={add}
                            title={`Add "${typed}"`}
                            aria-label={`Add ${typed}`}
                            className="p-1.5 rounded-md text-white bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => !disabled && setOpen(o => !o)}
                        aria-label="Open the list"
                        className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-40"
                        disabled={disabled}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {open && !disabled && (
                    <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white
                                    border border-gray-200 rounded-lg shadow-xl">
                        {group('Added now', addedMatches, Sparkles, 'text-amber-500', true)}
                        {group('Already in use', usedMatches, CheckCircle2, 'text-green-600')}
                        {group(
                            `All ${label.toLowerCase()}s${scopeLabel ? ` ${scopeLabel}` : ''}`,
                            refMatches, Globe, 'text-gray-400',
                        )}

                        {nothing && (
                            <p className="px-3 py-4 text-sm text-gray-500">
                                {typed
                                    ? <>Nothing matches “{typed}”. Press <strong>+</strong> to open it as a new region.</>
                                    : 'No regions to show yet.'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {hint && <p className="text-xs text-gray-500">{hint}</p>}
        </div>
    );
}
