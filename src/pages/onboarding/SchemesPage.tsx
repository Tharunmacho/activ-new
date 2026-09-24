import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { META_TEXT } from '@/components/layout/appTypography';
import { getRegionMap } from '@/services/cmsRegionsApi';
import {
    getSchemes, getSchemeSettings, normRegion, type SchemeRecord, type SchemeSettings,
} from '@/services/cmsSchemesApi';
import { SCHEME_COLUMN, SchemesBand, Crumbs, SchemeGrid, slugifyRegion } from './components/SchemeUI';

/**
 * ============================================================================
 * GOVERNMENT SCHEMES — two lists, chosen from the header
 * ============================================================================
 *
 *     /schemes, /schemes/central   every central scheme
 *     /schemes/state/:slug         that state's schemes, then its districts'
 *
 * Choosing happens in the header's Schemes dropdown (`SchemesMenu`) — Central,
 * or a region and then a state — the same way the Regions menu works. So this
 * page does no choosing of its own: no landing cards, no grid of states, no
 * search box, no filter chips. It prints the list it was opened on.
 *
 * On a state page the district schemes are GROUPED under a heading per
 * district rather than filtered behind chips, so every district's schemes are
 * on the page at once and a reader scrolls to their own.
 */

type View = 'central' | 'state';

export default function SchemesPage({ view }: { view: View }) {
    const { slug = '' } = useParams();

    const [settings, setSettings] = useState<SchemeSettings | null>(null);
    const [stateName, setStateName] = useState('');
    const [schemes, setSchemes] = useState<SchemeRecord[]>([]);
    const [loading, setLoading] = useState(true);

    /* The name the slug stands for: the region map's spelling where it has
       one, otherwise the slug read back as words ("tamil-nadu" -> "Tamil Nadu").
       The server compares names case- and space-insensitively, so either works. */
    const fromSlug = useMemo(
        () => slug.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
        [slug],
    );

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setSchemes([]);

        (async () => {
            const [config, map] = await Promise.all([
                getSchemeSettings().catch(() => null),
                view === 'state' ? getRegionMap().catch(() => []) : Promise.resolve([]),
            ]);

            let name = '';
            if (view === 'state') {
                const found = (map || [])
                    .flatMap((r) => r.states || [])
                    .find((s) => s.slug === slug || slugifyRegion(s.name) === slug);
                name = found?.name || fromSlug;
            }

            const rows = await (view === 'central'
                ? getSchemes({ tier: 'national' })
                : getSchemes({ state: name })
            ).catch(() => [] as SchemeRecord[]);

            if (cancelled) return;
            setSettings(config);
            setStateName(name);
            setSchemes(rows || []);
            setLoading(false);
        })();

        return () => { cancelled = true; };
    }, [view, slug, fromSlug]);

    const empty = settings?.emptyMessage || 'Nothing has been published here yet.';
    const title = view === 'central' ? (settings?.centralLabel || 'Central schemes') : (stateName || fromSlug);

    const stateOwn = useMemo(() => schemes.filter((s) => s.tier === 'state'), [schemes]);
    /* District schemes, one group per district, in alphabetical order. */
    const byDistrict = useMemo(() => {
        const groups = new Map<string, { name: string; rows: SchemeRecord[] }>();
        schemes.filter((s) => s.tier === 'district').forEach((s) => {
            const key = normRegion(s.district) || 'other';
            const g = groups.get(key) || { name: s.district || 'Other districts', rows: [] };
            g.rows.push(s);
            groups.set(key, g);
        });
        return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [schemes]);

    return (
        <div className="flex min-h-screen flex-col bg-white font-sans">
            <HeaderSection />

            <main className="flex-grow bg-gray-50/60">
                {view === 'central' ? (
                    <SchemesBand settings={settings} title={title} description={settings?.centralDescription} />
                ) : (
                    <SchemesBand settings={settings} title={title} highlight="schemes"
                                 description={`Schemes run by the ${title} government, and by its districts.`} />
                )}

                <Crumbs trail={[{ label: 'Schemes' }, { label: title }]} />

                <section className={`${SCHEME_COLUMN} space-y-14 py-8 md:py-10`}>
                    {loading ? (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-gray-100" />)}
                        </div>
                    ) : view === 'central' ? (
                        <SchemeGrid schemes={schemes} empty={empty} showWhere={false} />
                    ) : (
                        <>
                            {/* A section with nothing in it is not drawn; the page
                                closes up around it. Only a state with nothing at
                                all says so, once. */}
                            {stateOwn.length === 0 && byDistrict.length === 0 && (
                                <SchemeGrid schemes={[]} empty={empty} />
                            )}

                            {stateOwn.length > 0 && (
                                <div>
                                    <SectionTitle title={`${title} state schemes`}
                                                  note={`Run by the ${title} government for members anywhere in the state.`} />
                                    <SchemeGrid schemes={stateOwn} empty={empty} showWhere={false} />
                                </div>
                            )}

                            {byDistrict.length > 0 && (
                                <div>
                                    <SectionTitle title="District schemes" note="Run by a district, for members in that district." />
                                    <div className="space-y-10">
                                        {byDistrict.map((g) => (
                                            <div key={g.name}>
                                                <h3 className="mb-4 text-[1.0625rem] font-bold uppercase tracking-[0.16em] text-brand-500">
                                                    {g.name}
                                                </h3>
                                                <SchemeGrid schemes={g.rows} empty={empty} showWhere={false} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>

            <FooterSection />
        </div>
    );
}

function SectionTitle({ title, note }: { title: string; note: string }) {
    return (
        <div className="mb-6">
            <h2 className="text-[1.75rem] font-black tracking-tight text-brand-900">{title}</h2>
            <p className={`mt-1 ${META_TEXT} text-gray-500`}>{note}</p>
        </div>
    );
}
