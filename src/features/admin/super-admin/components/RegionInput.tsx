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

/**
 * How far wrong a typed name may be and still be offered.
 *
 * Proportional to length, because one wrong letter in "Erode" is a different
 * kind of mistake from one wrong letter in "Tiruchirappalli". Capped at three
 * so a long name cannot drag in half the list.
 */
const editBudget = (needle: string) => Math.min(3, Math.max(1, Math.floor(needle.length / 4)));

/**
 * Levenshtein distance, abandoned as soon as it cannot come in under `budget`.
 *
 * Two rows rather than a full matrix, and an early exit on the whole row, so
 * this can run over every block of a district on each keystroke without the
 * field going heavy. It is only ever reached when the substring pass found
 * nothing, so on the common path it does not run at all.
 *
 * Returns `budget + 1` for "further than you care about" rather than the true
 * distance — the caller only ever compares against the budget, and computing
 * the rest is work with no reader.
 */
const editDistance = (a: string, b: string, budget: number): number => {
    // A length gap alone can exceed the budget; no alignment can close it.
    if (Math.abs(a.length - b.length) > budget) return budget + 1;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        const row = new Array<number>(b.length + 1);
        row[0] = i;
        let best = row[0];

        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(
                prev[j] + 1,                                        // deletion
                row[j - 1] + 1,                                     // insertion
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),      // substitution
            );
            if (row[j] < best) best = row[j];
        }

        // Every alignment from here on is at least `best`, so if that already
        // exceeds the budget nothing below this row can qualify.
        if (best > budget) return budget + 1;
        prev = row;
    }

    return prev[b.length];
};

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

    /**
     * Substring first, and a near-miss pass behind it.
     *
     * A plain `includes` is right while somebody is typing forwards — "kar"
     * finds Karnataka — and useless the moment they finish a word they cannot
     * spell. "karanataka" contains no substring of "Karnataka", so a list
     * holding all 36 states answered "nothing matches" and offered to create a
     * 37th. Region names are free text matched by an anchored regex
     * (`buildGeoFilter`), so accepting that typo does not create a harmless
     * duplicate — it creates a region whose queue nothing else can see.
     *
     * The near-miss pass runs ONLY when the exact pass found nothing, so a real
     * substring match is never diluted by approximations, and only from three
     * characters, below which most short names are within the tolerance of each
     * other. `NEAR` is the mode, so the list can say these are approximate
     * rather than presenting a guess as a match.
     */
    const NEAR_MIN_LENGTH = 3;

    const matches = (list: string[]): { names: string[]; near: boolean } => {
        if (!typed) return { names: list, near: false };

        const needle = typed.toLowerCase();
        const exact = list.filter(n => n.toLowerCase().includes(needle));
        if (exact.length || typed.length < NEAR_MIN_LENGTH) return { names: exact, near: false };

        const budget = editBudget(needle);
        const near = list
            .map(n => ({ name: n, distance: editDistance(needle, n.toLowerCase(), budget) }))
            .filter(row => row.distance <= budget)
            .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name))
            .map(row => row.name);

        return { names: near, near: near.length > 0 };
    };

    const addedMatches = useMemo(() => matches(added), [added, typed]);
    const usedMatches = useMemo(() => matches(inUse), [inUse, typed]);
    // Never repeat a name that is already staffed — it belongs in one group.
    const refMatches = useMemo(
        () => matches(reference.filter(r => !inUse.includes(r) && !added.includes(r))),
        [reference, inUse, added, typed],
    );

    /** True when every group that found anything found it only approximately. */
    const approximate = [addedMatches, usedMatches, refMatches].some(m => m.near)
        && [addedMatches, usedMatches, refMatches].every(m => m.near || !m.names.length);

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
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 sticky top-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${tone}`} />
                    <span className="min-w-0 truncate text-[1.0625rem] font-semibold uppercase
                                     tracking-wider text-slate-500">
                        {title}
                    </span>
                    {/* The count is here so it is obvious nothing was truncated. */}
                    <span className="shrink-0 text-[1.0625rem] text-slate-400">{names.length}</span>
                </div>

                {names.map(name => (
                    <div key={name} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => pick(name)}
                            /*
                              `min-w-0` and `break-words`: a region name is free
                              text and some real ones are long ("Dakshina
                              Kannada", "Sri Potti Sriramulu Nellore"). A flex
                              child will not shrink below its content without
                              `min-w-0`, so without these the row widened the
                              panel past the card and the dialog — which has no
                              horizontal scroll — simply clipped it.
                            */
                            className={`flex-1 min-w-0 text-left px-3 py-2 text-[1.25rem] break-words hover:bg-blue-50 ${
                                name === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-800'
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
                                className="px-2 text-slate-400 hover:text-red-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const nothing = !addedMatches.names.length && !usedMatches.names.length && !refMatches.names.length;

    return (
        /*
          `min-w-0` on the wrapper.
          
          This field sits inside a flex/grid form column, and a flex child does
          not shrink below its content unless told to. Without it a long region
          name in the list below pushed this whole field wider than the dialog,
          which has no horizontal scroll to reach it with — so the right-hand
          edge of every field on the form was simply clipped.
        */
        <div className="space-y-1.5 min-w-0" ref={wrap}>
            <label className="block text-[1.25rem] font-medium text-slate-700">{label}</label>

            <div className="relative">
                <input
                    type="text"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => { onChange(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={disabled ? 'Pick the level above first' : `Type or pick a ${label.toLowerCase()}`}
                    autoComplete="off"
                    className="w-full px-3 py-2 pr-16 border border-slate-200 rounded-lg text-[1.25rem]
                               focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent
                               disabled:bg-slate-50 disabled:text-slate-400"
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
                        className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-40"
                        disabled={disabled}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {open && !disabled && (
                    /*
                      IN FLOW, NOT FLOATING OVER THE FORM.
                      
                      An absolutely-positioned panel covered the two fields below
                      it — on the Add-admin dialog, opening the State list hid
                      Full Name entirely, and there is no way to scroll a dialog
                      out from under its own dropdown. In flow the card grows and
                      the dialog's own vertical scroll reaches everything, so
                      every field stays reachable with the list open.
                      
                      `max-h-64` keeps that growth bounded: 402 blocks in flow
                      would push the Create button off the screen.
                    */
                    <div className="mt-1 w-full max-h-64 overflow-y-auto overflow-x-hidden bg-white
                                    border border-slate-200 rounded-lg shadow-sm">
                        {/*
                          Said once, above the groups, when everything on offer is
                          a near-miss rather than a match.
                          
                          Without it a corrected spelling looks like a match and
                          gets picked by reflex — which is the right outcome here,
                          but it should be a decision. The alternative it replaces
                          is worse: "Nothing matches" beside a + button, which is
                          how `karanataka` came to exist as a region of its own.
                        */}
                        {approximate && (
                            <p className="px-3 py-2 text-[1.1875rem] text-amber-700 bg-amber-50 border-b border-amber-100">
                                Nothing matches “{typed}” exactly. Closest names below — pick one, or
                                press <strong>+</strong> to open “{typed}” as a new region.
                            </p>
                        )}

                        {group('Added now', addedMatches.names, Sparkles, 'text-amber-500', true)}
                        {group('Already in use', usedMatches.names, CheckCircle2, 'text-green-600')}
                        {group(
                            `All ${label.toLowerCase()}s${scopeLabel ? ` ${scopeLabel}` : ''}`,
                            refMatches.names, Globe, 'text-slate-400',
                        )}

                        {nothing && (
                            <p className="px-3 py-4 text-[1.25rem] text-slate-500 break-words">
                                {typed
                                    ? <>Nothing matches “{typed}”. Press <strong>+</strong> to open it as a new region.</>
                                    : 'No regions to show yet.'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {hint && <p className="text-[1.1875rem] text-slate-500">{hint}</p>}
        </div>
    );
}
