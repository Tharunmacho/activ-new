import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Eye, EyeOff, MapPin, AlertCircle } from 'lucide-react';
import { getRegionMap, type RegionMapEntry } from '@/services/cmsRegionsApi';
import { errorMessage } from '@/services/cmsApi';
import { CmsEmpty, CmsError } from './CmsUI';

/**
 * ============================================================================
 * WHICH REGION TILES THE BAND DRAWS
 * ============================================================================
 *
 * The same list the public band shows — National, South, North, East, West,
 * North East — with the state counts an editor sees on the page, and a switch
 * per row. Until now the band was the one thing on the site nobody could see
 * from the CMS without opening the live page in another tab.
 *
 * ---------------------------------------------------------------------------
 * A DENY LIST, AND THE DIRECTION MATTERS
 * ---------------------------------------------------------------------------
 *
 * What is stored is the regions left OUT (`acrossIndia.hidden`), not the ones
 * put in. The tiles are derived: a region appears the moment its page is
 * published, which is the behaviour the association asked for and the reason
 * there is no "add a region" button here. An allow list would invert that —
 * every newly published region invisible until somebody remembered to tick it,
 * which is a publish that silently does nothing.
 *
 * ---------------------------------------------------------------------------
 * IT SAVES WITH THE CARD, UNLIKE THE EVENTS PICKER BESIDE IT
 * ---------------------------------------------------------------------------
 *
 * Both answer "what goes on the home page", and they save differently on
 * purpose. An event's switch writes that EVENT — one document per row, so it
 * cannot ride a card's single save. This writes one field of the site settings,
 * which is the document this card already saves. Making it write immediately
 * would be a second, invisible save on a card that has a visible one.
 */
export function HomeRegionsPicker({ hidden, onChange }: {
    /** Region keys left out of the band. */
    hidden: string[];
    onChange: (next: string[]) => void;
}) {
    const [regions, setRegions] = useState<RegionMapEntry[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        getRegionMap()
            .then((rows) => { if (!cancelled) setRegions(rows || []); })
            .catch((err) => {
                if (cancelled) return;
                setError(errorMessage(err, 'Could not load the regions'));
                setRegions([]);
            });
        return () => { cancelled = true; };
    }, []);

    if (regions === null) {
        return (
            <p className="flex items-center gap-2 py-6 text-[1.0625rem] font-medium text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading the regions…
            </p>
        );
    }

    /* Case-insensitive, because the key is read back from a stored string. */
    const off = new Set((hidden || []).map((k) => String(k || '').toLowerCase()));
    const isOn = (r: RegionMapEntry) => !off.has(String(r.key || '').toLowerCase());

    const toggle = (r: RegionMapEntry) => {
        const key = String(r.key || '');
        if (!key) return;
        onChange(isOn(r)
            ? [...(hidden || []), key]
            : (hidden || []).filter((k) => String(k || '').toLowerCase() !== key.toLowerCase()));
    };

    const shown = regions.filter(isOn);

    return (
        <div>
            <CmsError message={error} />

            {regions.length === 0 ? (
                <CmsEmpty
                    title="No regions yet"
                    hint="Publish a region page under Regions & States and its tile appears here."
                />
            ) : (
                <>
                    <p className="mb-3 text-[1.0625rem] font-semibold text-slate-500 dark:text-neutral-400">
                        {shown.length} of {regions.length} tiles are drawn.
                        {shown.length === 0 && (
                            <span className="text-amber-700 dark:text-amber-400">
                                {' '}The band is empty and will not render at all.
                            </span>
                        )}
                    </p>

                    <ul className="grid gap-2.5 sm:grid-cols-2">
                        {regions.map((region) => {
                            const on = isOn(region);
                            const states = (region.states || []).filter((st) => st.hasPage).length;

                            return (
                                <li
                                    key={region.key}
                                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors
                                                ${on
                                            ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'
                                            : 'border-slate-200 bg-white dark:border-[#232323] dark:bg-[#0d0d0d]'}`}
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center
                                                     rounded-lg bg-slate-100 text-slate-500
                                                     dark:bg-[#161616] dark:text-neutral-400">
                                        <MapPin className="h-4 w-4" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[1.125rem] font-bold text-slate-900 dark:text-white">
                                            {region.label || region.key}
                                        </p>
                                        <p className="text-[1rem] font-medium text-slate-500 dark:text-neutral-400">
                                            {region.national
                                                ? 'The whole country'
                                                : `${states} ${states === 1 ? 'state' : 'states'}`}
                                            {!region.hasPage && (
                                                <span className="ml-1.5 inline-flex items-center gap-1
                                                                 text-amber-700 dark:text-amber-400">
                                                    <AlertCircle className="h-3 w-3" /> no page yet
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => toggle(region)}
                                        title={on ? 'Leave it out of the band' : 'Draw its tile'}
                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border
                                                    px-3 py-1.5 text-[1rem] font-bold transition-colors ${on
                                                ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    + ' dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                                                : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                                                    + ' dark:border-[#2a2a2a] dark:bg-[#111] dark:text-neutral-400'}`}
                                    >
                                        {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        {on ? 'On' : 'Off'}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    <p className="mt-3 text-[1rem] font-medium text-slate-400">
                        The tiles and their state counts come from the published pages. A region
                        published under{' '}
                        <a href="/cms/regions" className="font-semibold text-blue-700 dark:text-blue-400">
                            Regions &amp; States <ExternalLink className="inline h-3 w-3" />
                        </a>{' '}
                        appears here on its own. Leaving one out removes its tile only — its page
                        and its menu entry stay.
                    </p>
                </>
            )}
        </div>
    );
}
