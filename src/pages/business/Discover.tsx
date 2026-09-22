import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import {
    Search, Building2, Phone, Mail, MapPin, Package, X, Compass,
    ShieldCheck, ShieldPlus, ArrowUpRight, Star, Grid3x3, List,
} from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, EmptyState, Loading } from "./BusinessUI";
import {
    apiFetch,
    getMyProfile,
    getTrustListIds,
    addToTrustList,
    removeFromTrustList,
    errorMessage,
    getPaymentStatus,
    listAllStates,
    listAllDistricts,
    listAllBlocks,
} from '@/services/activApi';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";
/* The unpaid member's own dashboard. A function, not a literal: these
   routes moved once already, which is why it exists.
*/
import { dashboardPathFor } from '@/features/member/memberAccess';

import { CARD_TITLE } from '@/components/layout/appTypography';
/**
 * Discover — the website's copy of `DiscoverScreen.tsx`.
 *
 * The page rendered blank for every search, and showed nothing at all until one
 * was run. Both came from the same mistake: it called `/products/discover` and
 * then read the response as though it were a list of *companies*.
 *
 * That endpoint returns Product documents. It reached for `businessName`,
 * `businessType`, `mobileNumber` and `productCount` on each one — none of which
 * exists on a product — so every card drew an empty title over "Not specified"
 * and "Not available", however many results came back. `key={company.companyId}`
 * compounded it: `companyId` is a populated *object*, so every row shared the
 * key `"[object Object]"`.
 *
 * The seller's details were in the payload the whole time, one level down, on
 * the populated `companyId` — which is what mobile has always read.
 *
 * Two behaviours were missing outright:
 *
 *   - **Idle state.** Mobile shows the company you have switched to, with its
 *     own catalog, before you type anything. The website showed a placeholder,
 *     so the panel beside the sidebar was empty on arrival.
 *   - **Company search.** Only `/products/discover` was called, so searching a
 *     business by *name* found nothing unless a product happened to share the
 *     word. Mobile queries `/business-profiles/discover` alongside it.
 */

interface ProductItem {
    _id: string;
    name?: string;
    category?: string;
    price?: number;
    stock?: number;
    description?: string;
    sku?: string;
    imageUrl?: string;
    isFeatured?: boolean;
    companyId?: any;
}

interface CompanyItem {
    _id: string;
    businessName?: string;
    businessType?: string;
    location?: string;
    area?: string;
    mobileNumber?: string;
    email?: string;
    description?: string;
    logo?: string;
    products?: ProductItem[];
    matchedProducts?: ProductItem[];
    /**
     * Does this company belong to a PAID member of the association?
     *
     * The star. Anybody may open a business account; the mark is what says
     * the owner has taken the membership. The server always sends it, so
     * `undefined` here means an older build answered — and is drawn as
     * unmarked, never as marked.
     */
    ownerIsMember?: boolean;
    /** How many members keep this company on their trust list. */
    trustedBy?: number;
}

const SEARCH_DEBOUNCE_MS = 400;

/** A single character matches too many names to be a useful search. */
const MIN_QUERY_LENGTH = 2;

type DiscoverFilter = 'all' | 'companies' | 'products';

/** One control style for the three region dropdowns. */
const REGION_SELECT =
    'h-10 min-w-[8.5rem] max-w-[12rem] rounded-lg border border-slate-200 bg-white px-3 '
    + 'text-[1.25rem] font-medium text-slate-700 hover:border-slate-300 focus:outline-none '
    + 'focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-slate-50 '
    + 'disabled:text-slate-400';

/**
 * The answer for somebody who has not paid.
 *
 * Deliberately a number and a sentence. No names, no cards, no prices, no
 * contact details — those are the membership. Telling them there are fourteen
 * matches in their district is what makes joining worth doing; listing the
 * fourteen is what makes it unnecessary.
 */
/**
 * The answer for somebody who has not paid.
 *
 * Deliberately a number and a sentence. No names, no cards, no prices, no
 * contact details — those are the membership. Telling them there are fourteen
 * matches in their district is what makes joining worth doing; listing the
 * fourteen is what makes it unnecessary.
 *
 * It was briefly four benefit tiles and an approval notice, which came out
 * taller than the results it stands in for and read as a sales page in the
 * middle of a directory. One button is enough.
 */
const CountOnly = ({ companies, products, term, regionLabel, onJoin }: {
    companies: number;
    products: number;
    term: string;
    regionLabel: string;
    onJoin: () => void;
}) => (
    <Card className="p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Compass className="h-7 w-7 text-blue-600" />
        </span>
        <p className="text-[2.125rem] font-bold text-slate-900">
            {companies} {companies === 1 ? 'company' : 'companies'}
            {products > 0 ? ` · ${products} ${products === 1 ? 'product' : 'products'}` : ''}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-[1.25rem] text-slate-600">
            {term ? <>match “{term}” in {regionLabel}. </> : <>in {regionLabel}. </>}
            Membership opens the directory — names, catalogues and contact details for
            every one of them.
        </p>
        <Button className="mt-6 bg-blue-600 hover:bg-blue-700" onClick={onJoin}>
            Become a member
        </Button>
    </Card>
);

const FILTERS: { key: DiscoverFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'companies', label: 'Companies' },
    { key: 'products', label: 'Products' },
];

const Discover = () => {
    const { activeCompany, loadCompanies } = useActiveCompanyStore();
    const navigate = useNavigate();

    /**
     * Which companies this member already trusts.
     *
     * ONE request for the whole set, not one per card. This screen renders up
     * to 200 results and each needs to know which way its button points; asking
     * per card would be 200 round trips to draw one icon 200 times.
     *
     * A Set rather than an array — `includes` on every card on every keystroke
     * is quadratic, and this list is redrawn as the query is typed.
     */
    const [trustedIds, setTrustedIds] = useState<Set<string>>(new Set());
    /** The company id currently being added or removed, for its button only. */
    const [trustPending, setTrustPending] = useState<string | null>(null);
    /** Every company this member owns, so their own rows do not offer Trust. */
    const [ownCompanyIds, setOwnCompanyIds] = useState<Set<string>>(new Set());

    /**
     * Cards, or one company a row.
     *
     * The same pair the Products screen offers, and the same default: a
     * member arrives comparing, and narrows to a list once they know what
     * they are looking for.
     */
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const [searchQuery, setSearchQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [filter, setFilter] = useState<DiscoverFilter>('all');

    /**
     * The viewer's own region, and whether the search is narrowed to it.
     *
     * A member looking for a supplier wants someone they can actually deal
     * with, so this opens on their own block — the same default the member
     * directory now uses, and the same escape: it is stated on screen and one
     * click widens it. Products and companies carry no region of their own, so
     * the server resolves it through the OWNER's member record; see
     * `regionOwners.js`.
     */
    const [homeRegion, setHomeRegion] = useState({ state: '', district: '', block: '' });

    /**
     * WHERE the member is looking — theirs to set, not fixed to their own block.
     *
     * It opens on their own region, which is the useful default, and every
     * level can be changed or cleared: a member opening a branch in another
     * district searches that district, and "Any state" is the whole network.
     */
    const [region, setRegion] = useState({ state: '', district: '', block: '' });
    const [stateList, setStateList] = useState<string[]>([]);
    const [districtList, setDistrictList] = useState<string[]>([]);
    const [blockList, setBlockList] = useState<string[]>([]);

    /**
     * The directory is a membership benefit.
     *
     * An unpaid member is told HOW MANY matches there are and nothing else —
     * see the note over `CountOnly`. Unknown counts as unpaid: showing a
     * paid-only listing to somebody who has not paid is the worse mistake.
     */
    const [paid, setPaid] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;

        // The member's own record, not the token: `auth.service` mints some
        // member tokens with no location claims at all.
        getMyProfile()
            .then((me: any) => {
                if (cancelled || !me) return;
                const mine = {
                    state: me.state || '',
                    district: me.district || '',
                    block: me.block || '',
                };
                setHomeRegion(mine);
                /*
                 * OPENS ON THEIR OWN REGION.
                 *
                 * Only if they have not already touched a dropdown — the
                 * profile request can land after a keystroke, and overwriting a
                 * deliberate choice with a default is worse than having no
                 * default at all.
                 */
                setRegion((current) => (
                    current.state || current.district || current.block ? current : mine
                ));
            })
            .catch(() => { /* no region simply means a network-wide search */ });

        getPaymentStatus()
            .then((status) => { if (!cancelled) setPaid(status === 'completed'); })
            .catch(() => { if (!cancelled) setPaid(false); });

        /* Plain arrays of names — see `listAllStates`. Reading the admin
           tree's `{ states: [...] }` as an array is what emptied these. */
        listAllStates()
            .then((rows) => { if (!cancelled) setStateList(rows); })
            .catch(() => { /* the dropdown simply offers nothing */ });

        return () => { cancelled = true; };
    }, []);

    /* Each level narrows the next, and clears what was below it. */
    useEffect(() => {
        let cancelled = false;
        if (!region.state) { setDistrictList([]); setBlockList([]); return undefined; }
        listAllDistricts(region.state)
            .then((rows) => { if (!cancelled) setDistrictList(rows); })
            .catch(() => { if (!cancelled) setDistrictList([]); });
        return () => { cancelled = true; };
    }, [region.state]);

    useEffect(() => {
        let cancelled = false;
        if (!region.state || !region.district) { setBlockList([]); return undefined; }
        listAllBlocks(region.state, region.district)
            .then((rows) => { if (!cancelled) setBlockList(rows); })
            .catch(() => { if (!cancelled) setBlockList([]); });
        return () => { cancelled = true; };
    }, [region.state, region.district]);

    /** The region query string, or empty when searching the whole network. */
    const regionParams = useMemo(() => (
        (['state', 'district', 'block'] as const)
            .filter((key) => !!region[key])
            .map((key) => `&${key}=${encodeURIComponent(region[key])}`)
            .join('')
    ), [region]);

    /** What the region reads as in a sentence. */
    const homeLabel = [region.block, region.district, region.state].filter(Boolean)[0] || '';
    const regionLabel = [region.block, region.district, region.state].filter(Boolean).join(', ')
        || 'the whole network';
    const [companies, setCompanies] = useState<CompanyItem[]>([]);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);

    // A slower earlier request must not overwrite a newer result.
    const requestIdRef = useRef(0);

    // The idle view needs to know which company is active.
    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    // Debounce keystrokes so typing doesn't fire a request per character.
    useEffect(() => {
        const handle = setTimeout(() => {
            setActiveQuery(searchQuery.trim());
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const fetchDiscoverData = useCallback(
        async (rawTerm: string) => {
            const term = (rawTerm || '').length >= MIN_QUERY_LENGTH ? rawTerm : '';
            const requestId = requestIdRef.current + 1;
            requestIdRef.current = requestId;

            try {
                setLoading(true);

                /*
                 * NO SEARCH TERM IS NOT THE SAME AS NO QUERY.
                 *
                 * This used to fetch the switched company's own catalogue and
                 * nothing else, so the directory opened on the one company the
                 * member already knows and the region filters above it did
                 * nothing until something was typed.
                 *
                 * Both endpoints treat `q` as OPTIONAL and filter on the
                 * region regardless — see `discoverCompanies` — so browsing a
                 * region is the same request with the term left off.
                 */
                /* Built as one string rather than concatenated around a
                   leading `&`, which produced `q=x&&state=…` whenever both a
                   term and a region were present. */
                const params = [
                    term ? `q=${encodeURIComponent(term)}` : '',
                    regionParams.replace(/^&/, ''),
                ].filter(Boolean).join('&');
                const suffix = params ? `?${params}` : '';

                const [compRes, prodRes] = await Promise.allSettled([
                    apiFetch(`/business-profiles/discover${suffix}`),
                    apiFetch(`/products/discover${suffix}`),
                ]);

                let compList: CompanyItem[] = [];
                if (compRes.status === 'fulfilled') {
                    const body = await compRes.value.json().catch(() => null);
                    const payload = body?.data ?? [];
                    compList = Array.isArray(payload) ? payload : [];
                }

                let prodList: ProductItem[] = [];
                if (prodRes.status === 'fulfilled') {
                    const body = await prodRes.value.json().catch(() => null);
                    const payload = body?.data ?? [];
                    prodList = Array.isArray(payload) ? payload : [];
                }

                if (requestIdRef.current !== requestId) return;

                // Drop obvious test rows from the public directory.
                compList = compList.filter((c) => {
                    const name = (c?.businessName || '').toLowerCase();
                    return name && !name.includes('test company') && !name.includes('dummy');
                });

                setCompanies(compList);
                setProducts(prodList.filter((p) => p && p._id));
            } catch (error) {
                console.error('Error fetching discover data:', error);
                if (requestIdRef.current === requestId) {
                    setCompanies([]);
                    setProducts([]);
                }
            } finally {
                if (requestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        },
        /*
         * `regionParams` BELONGS HERE, and its absence was a live bug.
         *
         * The effect below already re-ran when the region changed — but it
         * called THIS callback, which was memoised on `activeCompany` alone
         * and so kept a closure over whichever region string existed when it
         * was built. Changing the state, district or block fired a fetch that
         * asked for the previous region, and the filters appeared to do
         * nothing.
         *
         * Exactly the failure the exhaustive-deps rule was promoted to an
         * error over, and the linter named it the moment the browse path
         * started depending on the region for its whole result.
         *
         * `activeCompany` is NOT a dependency any more: the browse path stopped
         * reading it, because the directory lists a REGION rather than the
         * company the member happens to have switched to.
         */
        [regionParams],
    );

    useEffect(() => {
        fetchDiscoverData(activeQuery);
    }, [activeQuery, fetchDiscoverData]);

    const hasQuery = activeQuery.length >= MIN_QUERY_LENGTH;
    const isTermTooShort = activeQuery.length > 0 && !hasQuery;

    const includesTerm = useCallback(
        (value?: string | null) => {
            const term = (activeQuery || '').toLowerCase();
            if (!term) return false;
            return (value || '').toLowerCase().includes(term);
        },
        [activeQuery],
    );

    // Match only what a person actually types a search for — the item's own
    // name / category / sku. Free-text description is deliberately excluded:
    // matching it is what made a short term pull in the whole directory.
    const productMatchesQuery = useCallback(
        (p?: ProductItem | null) =>
            !!p && (includesTerm(p.name) || includesTerm(p.category) || includesTerm(p.sku)),
        [includesTerm],
    );

    const companyMatchesQuery = useCallback(
        (c?: CompanyItem | null) =>
            !!c && (includesTerm(c.businessName) || includesTerm(c.businessType)),
        [includesTerm],
    );

    const productResults = useMemo(() => {
        if (!hasQuery || filter === 'companies') return [];
        return (products || []).filter((p) => p && p.name && productMatchesQuery(p));
    }, [products, hasQuery, filter, productMatchesQuery]);

    /**
     * A company survives only if its own name/type matches, or it owns a product
     * that matches. Product hits are folded into their seller's card, so a search
     * for "chairs" renders the same detailed company card as a search for the
     * business name — never a thinner, different-looking result row.
     */
    const companyResults = useMemo(() => {
        if (!hasQuery) return companies || [];

        const byId = new Map<string, CompanyItem>();

        (companies || []).forEach((c) => {
            if (!c?._id) return;
            const nameHit = companyMatchesQuery(c);
            const productHit = (c?.matchedProducts || []).some(productMatchesQuery);
            if (!nameHit && !productHit) return;
            if (filter === 'companies' && !nameHit) return;
            if (filter === 'products' && !productHit) return;
            byId.set(String(c._id), c);
        });

        // A matching product whose seller the company search didn't return still
        // deserves a card — build one from the populated companyId. This is the
        // field the old page mistook for a plain id.
        if (filter !== 'companies') {
            (productResults || []).forEach((prod) => {
                const seller =
                    prod?.companyId && typeof prod.companyId === 'object' ? prod.companyId : null;
                const sellerId = seller?._id ? String(seller._id) : '';
                if (!sellerId) return;

                const existing = byId.get(sellerId);
                if (!existing) {
                    byId.set(sellerId, { ...seller, products: [prod], matchedProducts: [prod] });
                    return;
                }

                const known = new Set((existing.matchedProducts || []).map((p) => String(p?._id)));
                if (!known.has(String(prod?._id))) {
                    byId.set(sellerId, {
                        ...existing,
                        matchedProducts: [...(existing.matchedProducts || []), prod],
                    });
                }
            });
        }

        return Array.from(byId.values());
    }, [companies, productResults, hasQuery, filter, companyMatchesQuery, productMatchesQuery]);

    useEffect(() => {
        let cancelled = false;
        apiFetch('/business-profiles/all')
            .then((response) => (response.ok ? response.json() : { data: [] }))
            .then((body) => {
                if (cancelled) return;
                const rows = Array.isArray(body?.data) ? body.data : [];
                setOwnCompanyIds(new Set(rows.map((row: any) => String(row?._id))));
            })
            .catch(() => { /* worst case, Trust is offered on your own card and
                              the server refuses it with a message */ });
        return () => { cancelled = true; };
    }, []);

    /* Loaded once. Trusting from here keeps the set in step without a refetch. */
    useEffect(() => {
        let cancelled = false;
        getTrustListIds()
            .then((ids) => { if (!cancelled) setTrustedIds(new Set(ids || [])); })
            .catch(() => { /* the button simply starts in the untrusted state */ });
        return () => { cancelled = true; };
    }, []);

    /**
     * Trust or untrust, from the card.
     *
     * Optimistic, and reverted on failure: the icon IS the feedback, and a
     * spinner where a tick belongs makes the button read as broken. The server
     * add is an upsert, so a double-press cannot create two rows.
     */
    const toggleTrust = async (companyId: string, name: string) => {
        if (!companyId || trustPending) return;
        const wasTrusted = trustedIds.has(companyId);

        setTrustPending(companyId);
        setTrustedIds((current) => {
            const next = new Set(current);
            if (wasTrusted) next.delete(companyId); else next.add(companyId);
            return next;
        });

        try {
            if (wasTrusted) await removeFromTrustList(companyId);
            else await addToTrustList(companyId);
            toast.success(wasTrusted
                ? `${name} removed from your trust list`
                : `${name} added to your trust list`);
        } catch (error) {
            setTrustedIds((current) => {
                const next = new Set(current);
                if (wasTrusted) next.add(companyId); else next.delete(companyId);
                return next;
            });
            toast.error(errorMessage(error, 'Could not update your trust list'));
        } finally {
            setTrustPending(null);
        }
    };

    /**
     * Is this card the member's own company?
     *
     * Compared on id against every company this member owns — the store already
     * has that list, and matching on NAME would hide a different member's
     * company that happens to share a name, which in a directory of small
     * traders is not a rare accident.
     */
    const isOwnCompany = (item: CompanyItem) => ownCompanyIds.has(String(item._id));

    const renderCompanyCard = (item: CompanyItem) => {
        const catalog = item.products || [];
        const matched = (item.matchedProducts || []).filter(productMatchesQuery);
        const highlightIds = new Set(matched.map((p) => String(p?._id)));

        // The company itself matched -> show its catalog, hits first.
        // It only surfaced via a product -> show that product alone, so searching
        // "chairs" doesn't dump every other item the seller stocks.
        const ordered = !hasQuery
            ? catalog
            : companyMatchesQuery(item)
                ? [...matched, ...catalog.filter((p) => !highlightIds.has(String(p?._id)))]
                : matched;

        return (
            /* `h-full`: the grid stretches its rows, so a card with two
               products and one with none end on the same line. */
            <Card key={item._id} className="relative flex h-full flex-col">
                {/*
                  * THE STAR — the trust list, one tap.
                  *
                  * The labelled Trust button stays at the foot for anyone
                  * reading the card properly; this is the same action in the
                  * corner, where a member scanning a grid of results will
                  * actually reach for it. Filled means it is already on the
                  * list. Never drawn on your own company — a trust list of
                  * yourself is not a list of anything, and the server refuses
                  * it in any case.
                  */}
                {/*
                  * DRAWN ON EVERY CARD, including your own.
                  *
                  * It used to be hidden on your own company — a trust list of
                  * yourself is not a list of anything, and the server refuses
                  * it. But your own company is the only card on screen before a
                  * search, so hiding it there meant the control could not be
                  * found at all. It is shown and disabled instead, with the
                  * reason on the tooltip: visible, obviously a control, and
                  * still impossible to misuse.
                  */}
                <button
                    type="button"
                    disabled={isOwnCompany(item) || trustPending === String(item._id)}
                    onClick={() => toggleTrust(String(item._id), item.businessName || 'Company')}
                    aria-pressed={trustedIds.has(String(item._id))}
                    title={isOwnCompany(item)
                        ? 'This is your own company — the trust list is for others'
                        : trustedIds.has(String(item._id))
                            ? 'On your trust list — press to remove'
                            : 'Add to your trust list'}
                    className={`absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center
                                rounded-full border transition-colors
                                disabled:opacity-60 disabled:cursor-not-allowed ${
                        trustedIds.has(String(item._id))
                            ? 'border-amber-200 bg-amber-50 text-amber-500 hover:bg-amber-100'
                            : 'border-slate-200 bg-white text-slate-400 hover:text-amber-500 hover:border-amber-200'
                    }`}
                >
                    <Star
                        className="h-4.5 w-4.5"
                        fill={trustedIds.has(String(item._id)) ? 'currentColor' : 'none'}
                    />
                </button>

                <div className="flex items-start gap-4 pr-10">
                    {item.logo ? (
                        <img
                            src={resolveMediaUrl(item.logo)}
                            alt={item.businessName || 'Business'}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                        />
                    ) : (
                        <span className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <Building2 className="w-7 h-7 text-blue-600" />
                        </span>
                    )}

                    <div className="flex-1 min-w-0">
                        {/*
                            The name opens the company's member-facing page.

                            A directory whose rows go nowhere is a directory you
                            can only read: everything a card omits — the full
                            catalogue, the activities, the categories — was
                            unreachable, and a member who found the right
                            supplier had a phone number and nothing else.
                        */}
                        <button
                            type="button"
                            onClick={() => navigate(`/business/company/${item._id}`)}
                            className="group text-left w-full"
                        >
                            <h3 className={`${CARD_TITLE} text-slate-900 truncate group-hover:text-blue-700 transition-colors`}>
                                {item.businessName || 'Business'}
                                {/*
                                  THE MEMBER'S MARK — not the trust button.

                                  The star in the corner of this card is a
                                  CONTROL: press it and the company joins your
                                  trust list. This one is a FACT: the owner has
                                  paid their membership. Filled and inline with
                                  the name, against an outlined button in the
                                  corner, so the two cannot be read as the same
                                  thing in two places.
                                */}
                                {item.ownerIsMember === true && (
                                    <Star
                                        className="ml-1.5 inline h-4 w-4 text-amber-500"
                                        fill="currentColor"
                                        aria-label="ACTIV member"
                                    >
                                        <title>A paid member of the association</title>
                                    </Star>
                                )}
                                <ArrowUpRight className="inline h-4 w-4 ml-1 text-slate-300
                                                         group-hover:text-blue-600 transition-colors" />
                            </h3>
                        </button>
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[1.25rem]
                                      text-slate-500">
                            <span>{item.businessType || '—'}</span>
                            {/* No line at all when nobody has trusted them yet.
                                “0 members trust this” is a fact about a company
                                that has done nothing wrong, printed as though it
                                had. */}
                            {Number(item.trustedBy || 0) > 0 && (
                                <>
                                    <span aria-hidden="true" className="text-slate-300">·</span>
                                    <span className="inline-flex items-center gap-1 font-semibold
                                                     text-emerald-700">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {item.trustedBy}{item.trustedBy === 1 ? ' member trusts them' : ' members trust them'}
                                    </span>
                                </>
                            )}
                        </p>

                        <dl className="mt-3 space-y-1.5 text-[1.25rem]">
                            <div className="flex items-center gap-2 text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                <span className="truncate">
                                    {item.location || 'Location not set'}
                                    {item.area ? `, ${item.area}` : ''}
                                </span>
                            </div>

                            {item.mobileNumber ? (
                                <div className="flex items-center gap-2 text-slate-700">
                                    <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                                    <a href={`tel:${item.mobileNumber}`} className="hover:underline">
                                        {item.mobileNumber}
                                    </a>
                                </div>
                            ) : null}

                            {item.email ? (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                    <a href={`mailto:${item.email}`} className="truncate hover:underline">
                                        {item.email}
                                    </a>
                                </div>
                            ) : null}
                        </dl>
                    </div>
                </div>

                {item.description ? (
                    <p className="text-[1.25rem] text-slate-600 mt-4 line-clamp-2">{item.description}</p>
                ) : null}

                {/*
                  THE ROW IS ALWAYS DRAWN. Only the FIRST control in it changes.

                  The whole block used to be hidden on your own company, which is
                  the right instinct for the wrong element: a trust list of
                  yourself is not a list of anything, and the server refuses it.
                  But taking the row away took the height with it, so your own
                  company came out as a card with a hole where every other card
                  has two buttons — side by side in the same grid, it reads as a
                  card that failed to finish loading rather than as your own.

                  So the row stays, Trust is replaced by a chip that says whose
                  company it is, and View company is offered on every card
                  including your own — it works there, and it is the one thing
                  somebody looking at their own row actually wants.

                  `isOwnCompany` compares against the ACTIVE COMPANY rather than
                  the member, which is the id this screen actually has; the
                  server is the authority either way.
                */}
                <div className="mt-4 flex items-center gap-2">
                    {isOwnCompany(item) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200
                                         bg-blue-50 px-3 py-1.5 text-[1.125rem] font-semibold text-blue-700">
                            <Building2 className="h-4 w-4" />
                            Your company
                        </span>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={trustPending === String(item._id)}
                            onClick={() => toggleTrust(String(item._id), item.businessName || 'Company')}
                            className={trustedIds.has(String(item._id))
                                ? 'border-blue-600 text-blue-700 hover:bg-blue-50'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50'}
                        >
                            {trustedIds.has(String(item._id))
                                ? <ShieldCheck className="h-4 w-4 mr-1.5" />
                                : <ShieldPlus className="h-4 w-4 mr-1.5" />}
                            {trustedIds.has(String(item._id)) ? 'Trusted' : 'Trust'}
                        </Button>
                    )}

                    <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate(`/business/company/${item._id}`)}
                    >
                        View company
                    </Button>
                </div>

                {/*
                  THE CATALOGUE SITS AT THE FOOT OF THE CARD, and stops at three.

                  `mt-auto` pushes it down, so a company with no products leaves
                  the slot empty and its card still ends level with the one
                  beside it. The cap is what keeps a card a card: a company with
                  forty products was drawing forty rows and turning the grid
                  into a column. Three says what they sell; the card links to
                  the rest.
                */}
                {ordered.length > 0 ? (
                    <div className="mt-auto border-t border-slate-200 pt-5">
                        <p className="mb-3 text-[1.1875rem] font-semibold uppercase tracking-wider text-slate-500">
                            {hasQuery && !companyMatchesQuery(item)
                                ? `Matching Products (${ordered.length})`
                                : `Products & Services (${ordered.length})`}
                        </p>

                        <div className="space-y-2">
                            {ordered.slice(0, 3).map((prod, index) => {
                                const isMatch = highlightIds.has(String(prod?._id));
                                return (
                                    <div
                                        key={String(prod?._id || index)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border ${isMatch
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-slate-50 border-slate-200'
                                            }`}
                                    >
                                        {prod?.imageUrl ? (
                                            <img
                                                src={resolveMediaUrl(prod.imageUrl)}
                                                alt={prod?.name || 'Item'}
                                                className="w-11 h-11 rounded-lg object-cover shrink-0"
                                            />
                                        ) : (
                                            <span className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                                <Package className="w-5 h-5 text-blue-600" />
                                            </span>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-[1.25rem] text-slate-800 truncate">
                                                {prod?.name || 'Item'}
                                            </p>
                                            {/* No description. Two lines of free
                                                text per product is what made the
                                                rows inside one card different
                                                heights; it is on the company's own
                                                page, which this card links to. */}
                                            <p className="truncate text-[1.1875rem] text-slate-500">
                                                {prod?.category || 'General'}
                                                {prod?.sku ? ` · ${prod.sku}` : ''}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-[1.25rem] text-blue-600 tabular-nums">
                                                ₹{Number(prod?.price || 0).toLocaleString('en-IN')}
                                            </p>
                                            {prod?.stock ? (
                                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[1rem] text-slate-600">
                                                    Stock {prod.stock}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* What the cap left out, said plainly. A count with
                            nothing to explain it reads as a card that failed
                            to finish drawing. */}
                        {ordered.length > 3 ? (
                            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[1.125rem]
                                          font-semibold text-slate-500">
                                <Package className="h-3.5 w-3.5" />
                                +{ordered.length - 3} more on their company page
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </Card>
        );
    };

    return (
        <BusinessPageShell
            title="Discover Network"
            subtitle="Search companies and products across the member network"
            width="wide"
        >
            <div className="space-y-6">
                {/*
                    Search and filters as one sticky toolbar. Results are two
                    columns from xl up — this was a single centred column capped
                    at `max-w-4xl`, which on the most content-heavy screen in the
                    app meant ten results were ten screens of scrolling on a
                    monitor that could show six at once.
                */}
                {/*
                  TWO ROWS.

                  Nine controls shared one row at `lg` and above — the search
                  box, three filters, three region dropdowns and two links.
                  The search box is the only one of them that shrinks, so it
                  collapsed to about 230px and cut its own placeholder to
                  “Search any pro…”. It gets a row of its own, at full width,
                  because it is the control somebody actually types in.
                */}
                <Card className="sticky top-0 z-10 flex flex-col gap-4">
                    <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            type="text"
                            placeholder="Search any product or company (e.g. chairs)…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 pr-11 h-12 !text-[1.25rem] bg-slate-50 border-slate-200 placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-blue-500"
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                aria-label="Clear search"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        ) : null}
                    </div>

                    {/*
                      ONE ROW FOR EVERY FILTER.

                      The three chips and the three region selects were two
                      separate children of a column, so the toolbar came out as
                      three stacked rows of different lengths — which is the
                      ragged left edge the association reported. They are the
                      same kind of control doing the same job, so they sit on
                      one line and wrap together when there is no room.
                    */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {/* Chips sized to their labels — they used to be `flex-1`, so
                        three of them stretched into 290px-wide slabs. */}
                    <div className="flex gap-2 shrink-0">
                        {FILTERS.map((f) => {
                            const isActive = filter === f.key;
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    className={`px-4 py-2 rounded-lg text-[1.25rem] font-medium transition-colors ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>

                    {/*
                      * The region toggle, beside the filters rather than buried.
                      *
                      * The search opens narrowed to the member's own block, which
                      * is the right default and an invisible one unless it is
                      * shown. Without this control a member whose block has three
                      * suppliers would conclude the whole network has three.
                      */}
                    {/*
                      * STATE, DISTRICT, BLOCK — each narrowing the next.
                      *
                      * This was one chip that toggled between "my block" and
                      * "the whole network". A member opening a branch in
                      * another district could not ask about that district at
                      * all. It opens on their own region and every level is
                      * changeable; clearing the state searches everywhere.
                      */}
                    {/* A hairline between the two groups: they wrap onto one
                        line together, and without it "Products" and "Tamil
                        Nadu" read as one run of six controls. */}
                    <span aria-hidden="true" className="hidden h-6 w-px bg-slate-200 sm:block" />

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            aria-label="State"
                            value={region.state}
                            onChange={(e) => setRegion({ state: e.target.value, district: '', block: '' })}
                            className={REGION_SELECT}
                        >
                            <option value="">Any state</option>
                            {stateList.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>

                        <select
                            aria-label="District"
                            value={region.district}
                            disabled={!region.state}
                            onChange={(e) => setRegion((r) => ({
                                ...r, district: e.target.value, block: '',
                            }))}
                            className={REGION_SELECT}
                        >
                            <option value="">Any district</option>
                            {districtList.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>

                        <select
                            aria-label="Block"
                            value={region.block}
                            disabled={!region.district}
                            onChange={(e) => setRegion((r) => ({ ...r, block: e.target.value }))}
                            className={REGION_SELECT}
                        >
                            <option value="">Any block</option>
                            {blockList.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>

                        {/*
                          “Whole network” is gone. It cleared the three dropdowns
                          beside it — which is what setting all three to “Any”
                          already does — and it appeared and vanished depending on
                          whether a region was set, so the row reflowed as it was
                          used.

                          “My region” below stays: that one restores something the
                          dropdowns cannot, the member's own region, which they
                          would otherwise have to remember and re-pick.
                        */}
                        {homeRegion.state && (
                            region.state !== homeRegion.state
                            || region.district !== homeRegion.district
                            || region.block !== homeRegion.block
                        ) ? (
                            <button
                                type="button"
                                onClick={() => setRegion(homeRegion)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[1.25rem]
                                           font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                            >
                                <MapPin className="w-3.5 h-3.5" /> My region
                            </button>
                        ) : null}
                    </div>

                    {/*
                      THE FAR END OF THE FILTER ROW, and deliberately apart from it.

                      Everything else on this row narrows WHICH results come
                      back; this decides how they are drawn. `ml-auto` puts the
                      whole width between the two, which says that better than a
                      rule would. It is the same control the Products screen
                      carries, with the same two glyphs — a member who learns it
                      on one screen should not have to learn it twice.
                    */}
                    <div className="ml-auto flex shrink-0 items-center gap-1 self-stretch
                                    rounded-lg border border-slate-200 p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            aria-label="Card view"
                            aria-pressed={viewMode === 'grid'}
                            className={`rounded-md px-2.5 py-1.5 transition-colors ${viewMode === 'grid'
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Grid3x3 className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            aria-label="List view"
                            aria-pressed={viewMode === 'list'}
                            className={`rounded-md px-2.5 py-1.5 transition-colors ${viewMode === 'list'
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                    </div>

                    {/*
                      ONLY WHEN IT SAYS SOMETHING THE SCREEN DOES NOT.

                      The browse line — “2 companies in Ariyalur, Ariyalur, Tamil
                      Nadu. Search, or widen the region, for more.” — repeated
                      the count that heads the list directly beneath it, in a
                      region already named by the three dropdowns beside it.
                      What remains is the short-term hint, which nothing else
                      says.
                    */}
                    {isTermTooShort && (
                        <p className="shrink-0 text-[1.25rem] text-slate-500 lg:max-w-xs lg:text-right">
                            Type at least {MIN_QUERY_LENGTH} characters to search.
                        </p>
                    )}
                </Card>

                {loading ? (
                    <Loading label={hasQuery ? 'Searching the business network…' : 'Loading the directory…'} />
                ) : (paid === false) ? (
                    /*
                     * GATED ON THE MEMBERSHIP, NOT ON THERE BEING A SEARCH.
                     *
                     * This read `hasQuery && paid === false`, which was right
                     * only while the directory could not be BROWSED: with no
                     * term there was nothing to withhold. Now that arriving on
                     * the screen lists a region, keying the gate on the search
                     * box would hand an unpaid member the whole of their
                     * region's directory for the price of not typing.
                     */
                    /*
                     * WHAT AN UNPAID MEMBER SEES: HOW MANY, AND NOTHING ELSE.
                     *
                     * The directory is the membership benefit, so the names,
                     * prices and telephone numbers are what paying is for. A
                     * count is honest — it shows there is something here — and
                     * is no use as a substitute for joining.
                     */
                    <CountOnly
                        companies={companyResults.length}
                        products={productResults.length}
                        term={activeQuery}
                        regionLabel={regionLabel}
                        /*
                          THE UNPAID DASHBOARD, not the plans.

                          `/member/membership` — what this used to point at —
                          does not exist, so the button landed on the 404 page.

                          The plans screen would resolve, but it is a Pay button
                          with no idea whether an admin has approved anything. The
                          unpaid dashboard already knows where this member stands:
                          it shows the application's progress and offers the
                          payment step only once it has been approved. So the
                          button lands somewhere that tells them the truth about
                          their own state, whatever that state is.
                        */
                        onJoin={() => navigate(dashboardPathFor(false))}
                    />
                ) : companyResults.length > 0 ? (
                    <>
                        <h2 className={`${CARD_TITLE} text-slate-800`}>
                            {/* Not “Your Business” any more: with no search term this
                                is the region, not the member's own company. */}
                            {hasQuery
                                ? `Results (${companyResults.length})`
                                : `Companies in ${regionLabel} (${companyResults.length})`}
                        </h2>
                        {/*
                          AS MANY ACROSS AS THE SCREEN HOLDS.

                          Two columns of tall cards meant three matches filled
                          the window; three still meant five or six. A member
                          searching for a supplier is comparing, and comparing
                          needs them on screen together — so the grid goes to
                          four on a wide display and the gap tightens.
                        */}
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3
                                            2xl:grid-cols-4 gap-4">
                                {companyResults.map(renderCompanyCard)}
                            </div>
                        ) : (
                            /*
                              ONE COMPANY A ROW.

                              Deliberately NOT the card with its padding taken
                              off. It carries the four things somebody scans a
                              directory for — who, what trade, where, what number
                              — and drops the catalogue, the write-up and the
                              trust count. A row that wraps to three lines is a
                              card again, and fitting twenty on a screen is the
                              only reason this view exists.
                            */
                            <Card padded={false} className="overflow-hidden">
                                <ul className="divide-y divide-slate-200">
                                    {companyResults.map((item) => (
                                        <li key={item._id}>
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/business/company/${item._id}`)}
                                                className="flex w-full items-center gap-4 px-5 py-3.5 text-left
                                                           transition-colors hover:bg-slate-50"
                                            >
                                                {item.logo ? (
                                                    <img
                                                        src={resolveMediaUrl(item.logo)}
                                                        alt=""
                                                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <span className="flex h-11 w-11 shrink-0 items-center
                                                                     justify-center rounded-lg bg-blue-50">
                                                        <Building2 className="h-5 w-5 text-blue-600" />
                                                    </span>
                                                )}

                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="truncate text-[1.3125rem] font-bold
                                                                         text-slate-900">
                                                            {item.businessName || 'Business'}
                                                        </span>
                                                        {/* The member's mark, as on the card. */}
                                                        {item.ownerIsMember === true && (
                                                            <Star
                                                                className="h-3.5 w-3.5 shrink-0 text-amber-500"
                                                                fill="currentColor"
                                                                aria-label="ACTIV member"
                                                            />
                                                        )}
                                                    </span>
                                                    <span className="block truncate text-[1.1875rem] text-slate-500">
                                                        {item.businessType || '—'}
                                                    </span>
                                                </span>

                                                <span className="hidden min-w-0 flex-1 truncate text-[1.1875rem]
                                                                 text-slate-600 md:block">
                                                    {[item.location, item.area].filter(Boolean).join(', ')
                                                        || 'Location not set'}
                                                </span>

                                                <span className="hidden shrink-0 text-[1.1875rem] font-semibold
                                                                 tabular-nums text-slate-700 lg:block">
                                                    {item.mobileNumber || ''}
                                                </span>

                                                <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </>
                ) : (
                    <Card>
                        <EmptyState
                            icon={Compass}
                            title={hasQuery ? 'No matching results' : 'No active company'}
                            hint={
                                hasQuery
                                    ? `No ${filter === 'companies'
                                        ? 'businesses'
                                        : filter === 'products'
                                            ? 'products'
                                            : 'products or businesses'
                                    } matching "${activeQuery}"`
                                    : isTermTooShort
                                        ? `Type at least ${MIN_QUERY_LENGTH} characters to search.`
                                        : 'Switch to a company from the Business dashboard to see it here.'
                            }
                        />
                    </Card>
                )}
            </div>
        </BusinessPageShell>
    );
};

export default Discover;
