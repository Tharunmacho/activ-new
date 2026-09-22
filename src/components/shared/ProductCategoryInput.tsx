import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Plus, Loader2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    loadNicCategories,
    searchNicCategories,
    isKnownDescription,
    categoryLabel,
    sameCategory,
    type NicCategory,
    type ProductCategory,
} from '@/lib/nicCodes';

/**
 * PRODUCT CATEGORY — type the product, pick the NIC row.
 *
 * 1,846 NIC categories is far too many for a `<select>`: the list a member
 * needs is the two or three rows that match what they actually make, and the
 * only way to get there is to type it. So this is a filter, not a dropdown that
 * happens to be long — nothing is listed until there is a query.
 *
 * Each row carries the three things the association asked for: the description,
 * the NIC code, and whether NIC classifies it as manufacturing or service. The
 * code is what makes the answer useful later — free-typed product names cannot
 * be counted, and "Rice milling", "rice mill" and "Rice Mills" are three
 * industries to anything totalling them up.
 *
 * A CATEGORY NIC DOES NOT LIST CAN STILL BE ENTERED. The dataset is a reference,
 * not a census, and a member whose product is genuinely absent must not be stuck
 * — so when nothing matches, the typed text is offered as its own category and
 * stored with an empty code. Exactly the reasoning behind the `+` on
 * `RegionInput` (see ADMIN-FIRST REGION ARCHITECTURE in CLAUDE.md): refusing the
 * unknown case makes the field unanswerable, and an unanswerable field gets
 * filled with nonsense.
 */

const MAX_RESULTS = 50;

/**
 * What the field offers before anything is typed.
 *
 * An empty combobox whose whole content is "start typing" is a dead end: it
 * asks the member to guess which of 1,846 rows exists and what it is called
 * there. NIC's own wording is not what a person calls their trade — rice is
 * under "Milling of rice", software under "Computer programming activities" —
 * so the first search a member tries is routinely the one that finds nothing.
 *
 * These are the sectors this association's members actually work in, each one a
 * QUERY rather than a category: clicking fills the box and runs the search, so
 * the member lands in the right neighbourhood and picks the exact row from
 * there. They are a way in, not a shortlist — every one of the 1,846 is still
 * reachable by typing.
 */
const STARTERS = [
    'Food', 'Textile', 'Garment', 'Rice', 'Plastic', 'Steel', 'Furniture',
    'Construction', 'Transport', 'Software', 'Trading', 'Repair',
];

/**
 * The matched run, marked in the row.
 *
 * A result list of forty rows that all merely resemble the query leaves the
 * member reading every one to find out why it is there. Marking the hit says it
 * at a glance, and is the difference between a list that feels like a search
 * and one that feels like a dump.
 */
const markMatch = (text: string, query: string) => {
    const q = query.trim();
    if (!q) return text;
    const at = text.toLowerCase().indexOf(q.toLowerCase());
    if (at < 0) return text;
    return (
        <>
            {text.slice(0, at)}
            <mark className="bg-blue-100 text-blue-900 rounded-[3px] px-0.5">
                {text.slice(at, at + q.length)}
            </mark>
            {text.slice(at + q.length)}
        </>
    );
};

const TYPE_TONE: Record<string, string> = {
    Manufacturing: 'bg-amber-50 text-amber-700 border-amber-200',
    Service: 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function ProductCategoryInput({
    value,
    onChange,
    /** Nothing on this form is required; the cap is about the data, not the rule. */
    max = 10,
    placeholder = 'Type a product or service — e.g. rice, plywood, software',
}: {
    value: ProductCategory[];
    onChange: (next: ProductCategory[]) => void;
    max?: number;
    placeholder?: string;
}) {
    const [query, setQuery] = useState('');
    const [catalogue, setCatalogue] = useState<NicCategory[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);

    const boxRef = useRef<HTMLDivElement | null>(null);
    const selected = useMemo(() => value || [], [value]);
    const atLimit = selected.length >= max;

    /**
     * The catalogue is fetched when the field is first used, not on mount.
     *
     * Most members opening this form never touch this field, and 155 KB
     * downloaded for a control nobody focused is 155 KB spent on nothing.
     */
    const ensureLoaded = useCallback(() => {
        if (catalogue || loading) return;
        setLoading(true);
        loadNicCategories()
            .then(setCatalogue)
            .finally(() => setLoading(false));
    }, [catalogue, loading]);

    /** A click anywhere else closes the list. */
    useEffect(() => {
        if (!open) return;
        const onDocumentClick = (event: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, [open]);

    const { results, total } = useMemo(
        () => (catalogue
            ? searchNicCategories(catalogue, query, MAX_RESULTS)
            : { results: [], total: 0 }),
        [catalogue, query],
    );

    /**
     * Offer the typed text as its own category only when NIC has nothing for it.
     *
     * Offered alongside real matches it would be the wrong answer made equally
     * easy — a member who sees their product listed AND an "add it anyway" row
     * has been given a way to store an uncountable duplicate of a code that
     * already exists.
     */
    const trimmed = query.trim();
    const showCustom = Boolean(
        trimmed.length >= 2
        && catalogue
        && total === 0
        && !isKnownDescription(catalogue, trimmed),
    );

    // The highlight has to come back inside the list whenever the list changes,
    // or Enter fires on a row that has scrolled out of existence.
    useEffect(() => { setHighlight(0); }, [query, catalogue]);

    const rowCount = results.length + (showCustom ? 1 : 0);

    const add = (category: ProductCategory) => {
        if (atLimit) return;
        if (selected.some((existing) => sameCategory(existing, category))) {
            // Already chosen. Clearing the box is the useful response — it says
            // "that one is in" without a second identical chip appearing.
            setQuery('');
            return;
        }
        onChange([...selected, category]);
        setQuery('');
        setOpen(false);
    };

    const addCustom = () => add({ code: '', description: trimmed, industryType: '' });

    const remove = (index: number) =>
        onChange(selected.filter((_, i) => i !== index));

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, Math.max(0, rowCount - 1)));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (event.key === 'Enter') {
            // The picker sits inside a form; without this, Enter submits it.
            event.preventDefault();
            if (highlight < results.length) {
                const row = results[highlight];
                if (row) add({
                    code: row.code,
                    description: row.description,
                    industryType: row.industryType,
                });
            } else if (showCustom) {
                addCustom();
            }
        } else if (event.key === 'Escape') {
            setOpen(false);
        } else if (event.key === 'Backspace' && !query && selected.length) {
            // Backspace on an empty box removes the last chip — the behaviour
            // every tag input has, and the only way to undo without reaching
            // for the mouse.
            remove(selected.length - 1);
        }
    };

    return (
        <div ref={boxRef} className="relative">
            {/* ---------------------------------------------- chosen categories */}
            {selected.length > 0 && (
                <ul className="flex flex-wrap gap-2 mb-3">
                    {selected.map((category, index) => (
                        <li
                            key={`${category.code}-${category.description}-${index}`}
                            className="inline-flex items-start gap-2 max-w-full rounded-xl border border-blue-200
                                       bg-blue-50 pl-3 pr-2 py-1.5"
                        >
                            <Tag className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                            <span className="min-w-0">
                                <span className="block text-[1.125rem] font-bold text-slate-800 break-words">
                                    {category.description}
                                </span>
                                <span className="block text-[1rem] text-slate-500 mt-0.5">
                                    {category.code
                                        ? `NIC ${category.code}${category.industryType ? ` · ${category.industryType}` : ''}`
                                        : 'Custom category'}
                                </span>
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                aria-label={`Remove ${categoryLabel(category)}`}
                                className="shrink-0 rounded-md p-0.5 text-slate-400 hover:text-red-600
                                           hover:bg-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* ------------------------------------------------------- the input */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[1.125rem] w-[1.125rem] text-slate-400 pointer-events-none" />
                <Input
                    value={query}
                    onFocus={() => { ensureLoaded(); setOpen(true); }}
                    onChange={(e) => {
                        ensureLoaded();
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    disabled={atLimit}
                    placeholder={atLimit ? `Up to ${max} categories` : placeholder}
                    className="h-12 pl-10 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                    role="combobox"
                    aria-expanded={open}
                    aria-autocomplete="list"
                />
                {loading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                )}
            </div>

            {/* ------------------------------------------------------ the results */}
            {open && !atLimit && (
                <div
                    className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white
                               shadow-lg overflow-hidden"
                >
                    {!trimmed ? (
                        <div className="px-4 py-4">
                            <p className="text-[1.1875rem] text-slate-500">
                                Search {catalogue ? catalogue.length.toLocaleString() : '1,846'} NIC categories by
                                product name or code — or start from one of these.
                            </p>
                            <ul className="mt-3 flex flex-wrap gap-2">
                                {STARTERS.map((starter) => (
                                    <li key={starter}>
                                        <button
                                            type="button"
                                            /*
                                              `onMouseDown`, and the event stops here.
                                              
                                              Two things had to be handled. The input is
                                              focused, so a plain click blurs it first — hence
                                              mousedown and `preventDefault`. And this
                                              component closes itself on any `mousedown` that
                                              reaches `document`; that listener runs inside the
                                              SAME native event as this handler, so its
                                              `setOpen(false)` batches with the `setOpen(true)`
                                              below and lands last. The panel opened and shut
                                              in one tick, leaving the query set and nothing
                                              on screen. Stopping the native event keeps it
                                              from reaching that listener at all.
                                            */
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                e.nativeEvent.stopImmediatePropagation();
                                                ensureLoaded();
                                                setQuery(starter);
                                                setOpen(true);
                                            }}
                                            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5
                                                       text-[1.1875rem] font-semibold text-slate-600 transition-colors
                                                       hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                        >
                                            {starter}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : loading ? (
                        <p className="px-4 py-3 text-[1.1875rem] text-slate-500">Loading categories…</p>
                    ) : rowCount === 0 ? (
                        <p className="px-4 py-3 text-[1.1875rem] text-slate-500">
                            Nothing matches “{trimmed}”. Try a shorter or more common word.
                        </p>
                    ) : (
                        <>
                            {/*
                              A JSX COMMENT NEEDS ITS BRACES.

                              What stood here was a bare block comment with no
                              surrounding braces, which inside JSX is not a
                              comment at all but TEXT — so five lines of
                              reasoning about row heights were rendered to the
                              editor as a paragraph above their search results.

                              What it was trying to say: 20rem showed about five
                              rows, and this list runs to hundreds of categories.
                              Capped against the viewport as well, so the box can
                              never grow taller than the screen it opens on.
                            */}
                            <ul
                                className="overflow-y-auto py-1"
                                style={{ maxHeight: 'min(40rem, 80vh)' }}
                                role="listbox"
                            >
                                {results.map((row, index) => (
                                    <li key={row.code}>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={index === highlight}
                                            onMouseEnter={() => setHighlight(index)}
                                            onClick={() => add({
                                                code: row.code,
                                                description: row.description,
                                                industryType: row.industryType,
                                            })}
                                            className={`flex w-full items-center gap-3 px-4 py-2
                                                        text-left transition-colors ${index === highlight
                                                ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                        >
                                            {/*
                                              ONE LINE A ROW.

                                              The description was on its own line with
                                              the code, the industry and the level
                                              stacked underneath, so every row was two
                                              lines tall and seven of them filled the
                                              box. Fifteen of those is 1,100px — taller
                                              than the screen it opens on, so no height
                                              could have fixed it.

                                              `truncate` on the description is what
                                              holds the line: a few NIC descriptions run
                                              to twenty words, and one of them wrapping
                                              would put the whole list back to two lines
                                              a row. The full text is on `title`.
                                            */}
                                            <span
                                                className="min-w-0 flex-1 truncate text-[1.125rem] text-slate-800"
                                                title={row.description}
                                            >
                                                {markMatch(row.description, trimmed)}
                                            </span>

                                            <span className="flex shrink-0 items-center gap-1.5">
                                                <span className="inline-flex items-center rounded-md border border-slate-200
                                                                 bg-slate-50 px-1.5 py-0.5 text-[0.8125rem] font-semibold
                                                                 text-slate-600 tabular-nums">
                                                    NIC {row.code}
                                                </span>
                                                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5
                                                                  text-[0.8125rem] font-semibold ${TYPE_TONE[row.industryType] || 'bg-slate-50 text-slate-600 border-slate-200'
                                                    }`}>
                                                    {row.industryType}
                                                </span>
                                                {/* Hidden on a narrow box: it is the least
                                                    useful of the three and the first that
                                                    should give way to the description. */}
                                                <span className="hidden text-[0.8125rem] text-slate-400 sm:inline">
                                                    {row.level}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                ))}

                                {showCustom && (
                                    <li>
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={highlight === results.length}
                                            onMouseEnter={() => setHighlight(results.length)}
                                            onClick={addCustom}
                                            className={`w-full text-left px-4 py-2.5 transition-colors ${highlight === results.length ? 'bg-blue-50' : 'hover:bg-slate-50'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2 text-[1.1875rem] font-semibold text-blue-700">
                                                <Plus className="h-4 w-4" />
                                                Add “{trimmed}”
                                            </span>
                                            <span className="block text-[1.0625rem] text-slate-500 mt-0.5">
                                                Not in the NIC list — saved as a custom category, with no code.
                                            </span>
                                        </button>
                                    </li>
                                )}
                            </ul>

                            {/*
                                Said, rather than silently truncated. A list that
                                stops at 50 with no note reads as "these are all of
                                them", and the member stops refining a search that
                                would have found their row.
                            */}
                            {total > results.length && (
                                <p className="border-t border-slate-100 px-4 py-2 text-[1.0625rem] text-slate-500">
                                    Showing {results.length} of {total.toLocaleString()} matches — keep typing to narrow it down.
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
