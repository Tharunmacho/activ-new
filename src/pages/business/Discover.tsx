import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Building2, Phone, Mail, MapPin, Package, X, Compass } from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, EmptyState, Loading } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

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
}

const SEARCH_DEBOUNCE_MS = 400;

/** A single character matches too many names to be a useful search. */
const MIN_QUERY_LENGTH = 2;

type DiscoverFilter = 'all' | 'companies' | 'products';

const FILTERS: { key: DiscoverFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'companies', label: 'Companies' },
    { key: 'products', label: 'Products' },
];

const Discover = () => {
    const { activeCompany, loadCompanies } = useActiveCompanyStore();

    const [searchQuery, setSearchQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [filter, setFilter] = useState<DiscoverFilter>('all');
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

                // No search term: stay inside the switched company, like every
                // other business screen. Only its own catalog is fetched.
                if (!term) {
                    const companyId = activeCompany?._id;
                    if (!companyId) {
                        setCompanies([]);
                        setProducts([]);
                        return;
                    }

                    const ownRes = await apiFetch(
                        `/products/discover?companyId=${encodeURIComponent(companyId)}`,
                    );
                    const ownBody = await ownRes.json();

                    if (requestIdRef.current !== requestId) return;

                    const ownPayload = ownBody?.data ?? [];
                    const ownProducts: ProductItem[] = (Array.isArray(ownPayload) ? ownPayload : [])
                        .filter((p: ProductItem) => p && p._id);

                    setCompanies([
                        { ...(activeCompany as CompanyItem), products: ownProducts, matchedProducts: [] },
                    ]);
                    setProducts([]);
                    return;
                }

                // Search term present: open up to the whole network.
                const q = encodeURIComponent(term);

                const [compRes, prodRes] = await Promise.allSettled([
                    apiFetch(`/business-profiles/discover?q=${q}`),
                    apiFetch(`/products/discover?q=${q}`),
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
        [activeCompany],
    );

    useEffect(() => {
        fetchDiscoverData(activeQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeQuery, activeCompany?._id]);

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
            <Card key={item._id} className="flex flex-col">
                <div className="flex items-start gap-4">
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
                        <h3 className="font-bold text-lg text-slate-900 truncate">
                            {item.businessName || 'Business'}
                        </h3>
                        <p className="text-sm text-slate-500">{item.businessType || '—'}</p>

                        <dl className="mt-3 space-y-1.5 text-sm">
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
                    <p className="text-sm text-slate-600 mt-4 line-clamp-2">{item.description}</p>
                ) : null}

                {ordered.length > 0 ? (
                    <div className="mt-5 pt-5 border-t border-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                            {hasQuery && !companyMatchesQuery(item)
                                ? `Matching Products (${ordered.length})`
                                : `Products & Services (${ordered.length})`}
                        </p>

                        <div className="space-y-2">
                            {ordered.map((prod, index) => {
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
                                            <p className="font-semibold text-sm text-slate-800 truncate">
                                                {prod?.name || 'Item'}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {prod?.category || 'General'}
                                                {prod?.sku ? ` · ${prod.sku}` : ''}
                                            </p>
                                            {prod?.description ? (
                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                    {prod.description}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-sm text-blue-600 tabular-nums">
                                                ₹{Number(prod?.price || 0).toLocaleString('en-IN')}
                                            </p>
                                            {prod?.stock ? (
                                                <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-600">
                                                    Stock {prod.stock}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
                <Card className="sticky top-0 z-10 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            type="text"
                            placeholder="Search any product or company (e.g. chairs)…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-10 h-11 border-slate-200 focus-visible:ring-blue-500"
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
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            );
                        })}
                    </div>

                    <p className="text-sm text-slate-500 lg:max-w-xs lg:text-right shrink-0">
                        {hasQuery
                            ? `Showing results matching "${activeQuery}".`
                            : isTermTooShort
                                ? `Type at least ${MIN_QUERY_LENGTH} characters to search.`
                                : `Showing ${activeCompany?.businessName || 'your company'} only.`}
                    </p>
                </Card>

                {loading ? (
                    <Loading label={hasQuery ? 'Searching the business network…' : 'Loading your catalog…'} />
                ) : companyResults.length > 0 ? (
                    <>
                        <h2 className="text-lg font-semibold text-slate-800">
                            {hasQuery ? `Results (${companyResults.length})` : 'Your Business'}
                        </h2>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                            {companyResults.map(renderCompanyCard)}
                        </div>
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
