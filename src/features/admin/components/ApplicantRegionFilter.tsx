import { useMemo } from 'react';
import { MapPin, X } from 'lucide-react';
import type { Applicant } from '@/services/activApi';

/**
 * Narrowing an approvals queue to one block, or one district's worth of blocks.
 *
 * A district admin oversees every block in their district and a state admin
 * every district in their state, so both arrive at Approvals with a list that
 * is already correct and already too long: a state with forty blocks reporting
 * gives one screen holding forty blocks' worth of applicants, ordered by date,
 * with nothing to say which of them belong together. "Approve everything from
 * Ariyalur" — the way the work is actually parcelled out — meant reading every
 * card and remembering.
 *
 * THIS IS A VIEW, NOT A PERMISSION. The geofence has already been applied by
 * the server (`resolveAdminScope` + `buildGeoFilter`), and this cannot widen
 * it: the options are built from the applicants that arrived, so a district
 * that is not in this admin's patch has no row here to generate an option from.
 * Nothing is fetched, and no filter reaches the API — which also means the
 * mobile app is untouched by any of this.
 *
 * CASCADING, AND ONLY AS DEEP AS THE TIER LOOKS DOWN. `approvalFilters` in
 * `tierConfig` names the levels: none for a block admin, `block` for a district
 * admin, `district` then `block` for a state admin. Choosing a district clears
 * the block under it, because a block filter naming a block of another district
 * can only ever match nothing, and an empty queue with no explanation is
 * exactly the bug this screen keeps producing.
 *
 * OPTIONS COME FROM THE APPLICANTS, NOT THE REGION TREE. A tree-driven list
 * would offer every block in the district including the thirty with nothing
 * pending, so most choices would empty the screen. Derived, a filter can only
 * ever offer something that matches at least one file — and each option carries
 * its own count, so the admin can see where the work is before choosing.
 */

export type RegionLevel = 'state' | 'district' | 'block';

export interface RegionSelection {
    state: string;
    district: string;
    block: string;
}

export const EMPTY_SELECTION: RegionSelection = { state: '', district: '', block: '' };

/**
 * Region names are free text a Super Admin typed, so "Ariyalur" and "ariyalur "
 * are one place to a person. Normalised the way `regionMatch.js` normalises on
 * the server — trim, collapse whitespace, case-fold — so this filter and the
 * geofence behind it agree about which applicants are in a district.
 */
const norm = (value?: string | null) =>
    String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Does one applicant sit inside the chosen region, as far as it is chosen? */
export const matchesSelection = (applicant: Applicant, selection: RegionSelection): boolean =>
    (['state', 'district', 'block'] as RegionLevel[]).every((level) => {
        const chosen = norm(selection[level]);
        if (!chosen) return true;
        return norm((applicant as Record<string, any>)[level]) === chosen;
    });

const LABELS: Record<RegionLevel, string> = {
    state: 'State',
    district: 'District',
    block: 'Block',
};

export default function ApplicantRegionFilter({
    applicants,
    levels,
    selection,
    onChange,
}: {
    /**
     * Every applicant this tier can see — the `all` bucket, not the filtered
     * view. Building the options from the visible rows instead would make each
     * choice delete the options beside it: pick Ariyalur, and Ariyalur becomes
     * the only block on offer with no way back except Reset.
     */
    applicants: Applicant[];
    levels: RegionLevel[];
    selection: RegionSelection;
    onChange: (selection: RegionSelection) => void;
}) {
    /**
     * The options at each level, narrowed by the levels above it, each with the
     * number of files behind it.
     *
     * One pass per level rather than one grouped index: there are at most three
     * levels and a few hundred applicants, and a shape that reads directly is
     * worth more here than the microseconds a lookup table would save.
     */
    const options = useMemo(() => {
        const rows = Array.isArray(applicants) ? applicants : [];

        return levels.map((level, depth) => {
            // Everything chosen ABOVE this level, which is what narrows it.
            const above: RegionSelection = { ...EMPTY_SELECTION };
            levels.slice(0, depth).forEach((upper) => { above[upper] = selection[upper]; });

            const counts = new Map<string, { name: string; count: number }>();

            rows.filter((row) => matchesSelection(row, above)).forEach((row) => {
                const raw = String((row as Record<string, any>)[level] || '').trim();
                if (!raw) return;

                const key = norm(raw);
                const seen = counts.get(key);
                // First spelling wins, and the count is shared: two files whose
                // editors typed "Ariyalur" and "ariyalur " are one place, and
                // offering both would split one queue across two options.
                if (seen) seen.count += 1;
                else counts.set(key, { name: raw, count: 1 });
            });

            return {
                level,
                rows: [...counts.values()].sort((a, b) => a.name.localeCompare(b.name)),
            };
        });
    }, [applicants, levels, selection]);

    /**
     * Choosing a level clears everything under it.
     *
     * Without this, switching district while a block of the old one is selected
     * leaves a filter that cannot match anything, and the queue empties with no
     * clue why.
     */
    const pick = (level: RegionLevel, value: string) => {
        const next = { ...selection, [level]: value };
        const depth = levels.indexOf(level);
        levels.slice(depth + 1).forEach((below) => { next[below] = ''; });
        onChange(next);
    };

    const active = levels.some((level) => !!selection[level]);

    // Nothing to filter by: a tier with no levels beneath it, or a queue whose
    // files all carry the same region. Rendering an empty toolbar would take
    // vertical space to say nothing.
    if (!levels.length || options.every((group) => group.rows.length < 2)) return null;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[1.25rem] font-medium text-slate-500">
                <MapPin className="w-4 h-4 text-slate-400" />
                Region
            </span>

            {options.map((group) => (
                /*
                  A level is shown once it has something to choose between, and
                  only after the level above it has been answered. Rendering all
                  three at once means two disabled selects on a state admin's
                  screen with nothing to say why.
                */
                group.rows.length > 1 ? (
                    <select
                        key={group.level}
                        aria-label={LABELS[group.level]}
                        value={selection[group.level]}
                        onChange={(e) => pick(group.level, e.target.value)}
                        className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-[1.25rem]
                                   font-medium text-slate-700 outline-none transition-colors
                                   hover:border-slate-300 focus:border-blue-600 focus:ring-2
                                   focus:ring-blue-600/15"
                    >
                        <option value="">All {LABELS[group.level].toLowerCase()}s</option>
                        {group.rows.map((row) => (
                            <option key={row.name} value={row.name}>
                                {row.name} ({row.count})
                            </option>
                        ))}
                    </select>
                ) : null
            ))}

            {/* Offered only when there is something to undo. */}
            {active && (
                <button
                    type="button"
                    onClick={() => onChange({ ...EMPTY_SELECTION })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200
                               px-3 text-[1.25rem] font-semibold text-slate-500 transition-colors
                               hover:border-blue-600 hover:text-blue-600"
                >
                    <X className="w-3.5 h-3.5" />
                    Reset
                </button>
            )}
        </div>
    );
}
