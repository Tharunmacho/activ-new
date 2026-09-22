import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Plus, Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    EXPORT_COUNCILS, EXPORT_COUNCIL_GROUPS, isKnownExportCouncil,
    type ExportCouncilOption,
} from '@/lib/memberFormOptions';

/**
 * EXPORT COUNCIL — pick the body that issued the RCMC.
 *
 * =========================================================================
 * WHY THIS REPLACED A TEXT BOX
 * =========================================================================
 *
 * The field was an `<Input>` with the placeholder "e.g. FIEO, EEPC India", and
 * what a text box collects is "EEPC", "eepc india", "Engineering Export
 * Promotion Council" and "Engg Export Council" — four spellings of one council,
 * which is four councils to anything counting them. The association cannot ask
 * "who holds an RCMC from CAPEXIL?" of data typed from memory.
 *
 * =========================================================================
 * A DROPDOWN THAT FILTERS, NOT A `<select>`
 * =========================================================================
 *
 * Thirty-nine bodies with names averaging fifty characters is past what a
 * native `<select>` handles well: on a phone it becomes a full-screen wheel of
 * truncated strings, and on a desktop it is a scroll through four screens of
 * "…Export Promotion Council". So the whole list opens on focus — a member who
 * does not know what theirs is called can read it — and typing narrows it.
 *
 * The search matches the ABBREVIATION as well as the name, because that is what
 * exporters actually say: somebody with EEPC membership types "EEPC", and the
 * bracketed short form in the label is what makes that find the row.
 *
 * =========================================================================
 * A BODY THE LIST DOES NOT HAVE CAN STILL BE ENTERED
 * =========================================================================
 *
 * The DGFT amends Appendix 2T without telling anybody here. A member holding a
 * valid RCMC from a body added last month must still be able to answer, so when
 * nothing matches, what they typed is offered as its own answer — the same rule
 * `ProductCategoryInput` follows for a product NIC does not list and
 * `RegionInput` follows for a block the reference dataset has never heard of.
 * A field that refuses the unknown case is a field that gets filled with
 * nonsense.
 *
 * A value that came back from the server and is NOT on the list is shown as a
 * custom entry rather than silently cleared — see the note on `custom` below.
 */

interface Props {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Matches the other fields on the company form. */
    className?: string;
    id?: string;
}

/** The matched run, marked in the row. */
function Marked({ text, query }: { text: string; query: string }) {
    const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (at < 0) return <>{text}</>;

    return (
        <>
            {text.slice(0, at)}
            <mark className="bg-blue-100 text-blue-900 rounded-[2px] px-0.5">
                {text.slice(at, at + query.length)}
            </mark>
            {text.slice(at + query.length)}
        </>
    );
}

export default function ExportCouncilInput({
    value, onChange, placeholder = 'Search by name or abbreviation — EEPC, APEDA, Spices Board', className = '', id,
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const box = useRef<HTMLDivElement>(null);

    const trimmed = query.trim();

    /**
     * A saved value the list does not contain.
     *
     * Real and common: a council renamed since this list was written, or one a
     * member typed before the field became a picker. Treating it as "nothing
     * selected" would blank a field the member had already answered, and they
     * would have no way to tell that saving the form was about to wipe it.
     */
    const custom = !!value && !isKnownExportCouncil(value);

    /* --------------------------------------------------------------- close */

    useEffect(() => {
        if (!open) return;

        const onDown = (event: MouseEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    /* -------------------------------------------------------------- filter */

    const matches = useMemo(() => {
        if (!trimmed) return EXPORT_COUNCILS;
        const needle = trimmed.toLowerCase();
        return EXPORT_COUNCILS.filter((c) => c.name.toLowerCase().includes(needle));
    }, [trimmed]);

    /** The matches, under their headings, empty groups dropped. */
    const grouped = useMemo(() => {
        const out: { group: string; rows: ExportCouncilOption[] }[] = [];
        for (const group of EXPORT_COUNCIL_GROUPS) {
            const rows = matches.filter((c) => c.group === group);
            if (rows.length) out.push({ group, rows });
        }
        return out;
    }, [matches]);

    const choose = useCallback((name: string) => {
        onChange(name);
        setQuery('');
        setOpen(false);
    }, [onChange]);

    /*
     * Offer the typed text only when it matches nothing AND is long enough to
     * be a name. Offering it alongside results would invite somebody to create
     * "EEPC" as a custom entry when the real row was one line below.
     */
    const offerCustom = !!trimmed && trimmed.length >= 3 && matches.length === 0;

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            setOpen(false);
            setQuery('');
            return;
        }
        if (event.key === 'Enter') {
            // A form field inside a form: Enter must pick a council, not submit
            // the whole company form with the dropdown still open.
            event.preventDefault();
            if (matches.length === 1) choose(matches[0].name);
            else if (offerCustom) choose(trimmed);
        }
    };

    const inputClass =
        'h-12 pl-10 pr-10 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 '
        + `focus-visible:bg-white focus-visible:ring-blue-500 ${className}`;

    return (
        <div ref={box} className="relative">
            {/* ------------------------------------------------ the chosen one */}
            {value && !open ? (
                <div
                    className="flex items-center gap-3 h-12 rounded-md border border-slate-200 bg-slate-50
                               px-3.5 text-left"
                >
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <button
                        type="button"
                        onClick={() => { setOpen(true); setQuery(''); }}
                        // The longest of these is 76 characters and truncates in
                        // the field even at full width. The title is what lets
                        // somebody confirm they picked CHEMEXCIL and not CAPEXIL
                        // without reopening the list.
                        title={value}
                        className="min-w-0 flex-1 text-left"
                    >
                        <span className="block truncate text-[1.25rem] text-slate-900">{value}</span>
                        {custom && (
                            /*
                             * Said out loud rather than hidden. A member whose
                             * council is not on the list should know it was
                             * accepted as typed — and an administrator reading
                             * the record later should know it was not chosen
                             * from the official list.
                             */
                            <span className="block text-[0.9375rem] text-amber-600">
                                Not on the DGFT list — saved as typed
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        aria-label="Clear the export council"
                        className="shrink-0 rounded-md p-1 text-slate-400 transition-colors
                                   hover:bg-white hover:text-red-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem]
                                       -translate-y-1/2 text-slate-400" />
                    <Input
                        id={id}
                        value={query}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onKeyDown={onKeyDown}
                        placeholder={placeholder}
                        className={inputClass}
                        role="combobox"
                        aria-expanded={open}
                        aria-autocomplete="list"
                    />
                    <ChevronDown
                        className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2
                                    text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </div>
            )}

            {/* ------------------------------------------------- the list */}
            {open && (
                <div
                    className="absolute z-30 mt-2 w-full overflow-y-auto rounded-xl border
                               border-slate-200 bg-white shadow-lg"
                    /* See the note in `ProductCategoryInput`: 20rem was five
                       rows of a forty-entry list. */
                    style={{ maxHeight: 'min(34rem, 70vh)' }}
                    role="listbox"
                >
                    {!grouped.length && !offerCustom && (
                        <p className="px-4 py-3 text-[1.1875rem] text-slate-500">
                            Nothing matches “{trimmed}”. Type at least three characters to add it
                            as your own entry.
                        </p>
                    )}

                    {grouped.map(({ group, rows }) => (
                        <div key={group}>
                            <p className="sticky top-0 bg-slate-50 px-4 py-1.5 text-[0.8125rem] font-bold
                                          uppercase tracking-wider text-slate-400">
                                {group}
                            </p>
                            <ul>
                                {rows.map((row) => {
                                    const chosen = row.name === value;
                                    return (
                                        <li key={row.name}>
                                            <button
                                                type="button"
                                                role="option"
                                                aria-selected={chosen}
                                                /*
                                                 * `onMouseDown` with `preventDefault`: the input
                                                 * is focused, so a plain click blurs it first and
                                                 * the close-on-outside-click listener fires before
                                                 * the click lands — the panel would shut with
                                                 * nothing chosen. `ProductCategoryInput` carries
                                                 * the same note for the same reason.
                                                 */
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    choose(row.name);
                                                }}
                                                className={
                                                    'flex w-full items-start gap-2.5 px-4 py-2.5 text-left '
                                                    + 'text-[1.125rem] transition-colors hover:bg-blue-50 '
                                                    + (chosen ? 'bg-blue-50/60 font-semibold text-blue-900'
                                                        : 'text-slate-700')
                                                }
                                            >
                                                <Check
                                                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                                                        chosen ? 'text-blue-600' : 'text-transparent'}`}
                                                />
                                                <span className="min-w-0">
                                                    <Marked text={row.name} query={trimmed} />
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}

                    {offerCustom && (
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); choose(trimmed); }}
                            className="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-3
                                       text-left text-[1.125rem] text-blue-700 transition-colors
                                       hover:bg-blue-50"
                        >
                            <Plus className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 truncate">
                                Use “{trimmed}” — a council the list does not have
                            </span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
