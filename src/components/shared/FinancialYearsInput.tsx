import { useMemo } from 'react';
import { AlertCircle, Check } from 'lucide-react';

/**
 * ============================================================================
 * WHICH FINANCIAL YEARS A COMPANY HAS FILED RETURNS FOR
 * ============================================================================
 *
 * This was a free-text box hinted with "whatever describes it — 'last 3 years',
 * '2021-22 to 2023-24', 'since inception'". Every one of those is a different
 * answer to the same question, and none of them can be counted, compared or
 * checked against a year: "last 3 years" typed in 2024 means something else
 * read in 2026.
 *
 * The association asked for the years to be PICKED, three of them, so the
 * answer is a set of financial years rather than a sentence about them.
 *
 * ----------------------------------------------------------------- the list
 *
 * Indian financial years run April to March and are written `2024-25`. The
 * options are generated from today, newest first, because the years anybody
 * files for are the recent ones — and generated rather than stored, so the list
 * cannot go stale the way a hardcoded one does every April.
 *
 * The CURRENT year is the one whose returns are not due yet, so the list starts
 * at the one before it: in September 2026 the first option is 2025-26.
 *
 * ---------------------------------------------------------------- the value
 *
 * Stored as it always was — one string, comma-separated, `2023-24, 2022-23,
 * 2021-22`. The field on the company is unchanged and so is everything that
 * reads it; only the way it is ENTERED is different. A value typed before this
 * existed still loads, still shows, and is replaced the moment a year is
 * ticked.
 */

/** How many financial years to offer. Three back is what a bank asks for. */
const YEARS_OFFERED = 8;

/** How many the form expects. Not enforced — see the note on `expected`. */
const YEARS_EXPECTED = 3;

/**
 * `2024-25`, `2023-24`, … newest first.
 *
 * April is the boundary: before it, the year that has just ended is the one
 * beginning in the previous calendar year.
 */
const financialYears = (from: Date = new Date()): string[] => {
    const year = from.getFullYear();
    /* getMonth() is 0-based, so 3 is April. Before April the current financial
       year still began last calendar year. */
    const current = from.getMonth() >= 3 ? year : year - 1;

    return Array.from({ length: YEARS_OFFERED }, (_, i) => {
        const start = current - 1 - i;
        return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
    });
};

/** The stored string, as a set of years. Tolerant of whatever was typed before. */
const parseYears = (value: string): string[] =>
    String(value || '')
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean);

interface Props {
    value: string;
    onChange: (next: string) => void;
    /** How many the form is asking for. Shown, never enforced. */
    expected?: number;
}

export function FinancialYearsInput({ value, onChange, expected = YEARS_EXPECTED }: Props) {
    const options = useMemo(() => financialYears(), []);
    const chosen = useMemo(() => parseYears(value), [value]);
    const chosenSet = useMemo(() => new Set(chosen), [chosen]);

    /*
     * A year that was typed before this control existed, and is not in the
     * generated list — "2016-17", or "since inception".
     *
     * Offered as an extra option rather than dropped. Silently losing somebody's
     * stored answer because the new control cannot express it is the worst
     * thing a replacement field can do.
     */
    const carried = chosen.filter((y) => !options.includes(y));

    const toggle = (year: string) => {
        const next = chosenSet.has(year)
            ? chosen.filter((y) => y !== year)
            /* Kept newest-first, matching the order they are offered in, so the
               stored string reads the same whichever order they were ticked. */
            : [...chosen, year].sort().reverse();
        onChange(next.join(', '));
    };

    const short = chosen.length < expected;

    return (
        <div>
            <div className="flex flex-wrap gap-2">
                {[...options, ...carried].map((year) => {
                    const on = chosenSet.has(year);
                    return (
                        <button
                            key={year}
                            type="button"
                            onClick={() => toggle(year)}
                            aria-pressed={on}
                            className={
                                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 '
                                + 'text-[1.1875rem] font-semibold transition-colors '
                                + (on
                                    ? 'border-blue-600 bg-blue-600 text-white'
                                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 '
                                      + 'hover:text-blue-700')
                            }
                        >
                            {on && <Check className="h-3.5 w-3.5" />}
                            {year}
                        </button>
                    );
                })}
            </div>

            {/*
              SAY WHAT IS STILL MISSING, by name.

              The association asked for three years and for the form to say so
              until three are picked. "2 of 3 picked" answers the count; "one
              more year to pick" answers the question the person actually has,
              which is what they should do next.

              An amber band rather than a red one while it is short: nothing has
              gone wrong, the answer is simply not finished. It turns green the
              moment it is.
            */}
            <p
                role="status"
                className={`mt-2.5 flex items-center gap-2 rounded-lg px-3 py-2
                            text-[1.0625rem] font-semibold ${
                    short
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-emerald-50 text-emerald-800'
                }`}
            >
                {short ? <AlertCircle className="h-4 w-4 shrink-0" />
                       : <Check className="h-4 w-4 shrink-0" />}
                {chosen.length === 0
                    ? `Pick ${expected} financial years.`
                    : short
                        ? `${chosen.length} of ${expected} picked — `
                          + `${expected - chosen.length} more `
                          + `${expected - chosen.length === 1 ? 'year' : 'years'} to pick.`
                        : `${chosen.length} ${chosen.length === 1 ? 'year' : 'years'} picked.`}
            </p>
        </div>
    );
}

export default FinancialYearsInput;
