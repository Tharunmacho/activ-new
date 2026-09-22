import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Phone, Mail, Package, ShieldCheck, ShieldPlus, Users, ArrowLeft, Pencil, Tag, CalendarDays, Eye, Loader2, Landmark, Briefcase, Link2, Check, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import BusinessPageShell from './BusinessPageShell';
import { Card, Loading, EmptyState, Chip } from './BusinessUI';
import { resolveMediaUrl } from '@/config/api.config';
import { CARD_TITLE } from '@/components/layout/appTypography';
import {
    getPublicCompany, addToTrustList, removeFromTrustList, errorMessage,
    type PublicCompany,
} from '@/services/activApi';

/**
 * VIEW AS MEMBER — a company exactly as the rest of the network sees it.
 *
 * The business area had no such page. A member filled in a company and a
 * catalogue and could see them only as their own edit forms and their own
 * lists; what another member found in Discover was a card, and nothing joined
 * the two. So the answer to "what does our company look like to everyone else?"
 * was "open Discover and search for yourself".
 *
 * WHAT IT SHOWS IS SERVER-DECIDED. Everything here comes from
 * `GET /business-profiles/public/:id`, whose `PUBLIC_FIELDS` whitelist is what
 * makes the page safe to open on somebody else's company: PAN, GSTIN, turnover,
 * ITR and every registration number are absent from the response, not merely
 * unrendered. A page that fetched the whole document and chose what to draw
 * would leak all of it to anyone who opened the network tab.
 *
 * The owner gets one thing nobody else does: a bar saying this is a preview,
 * and a way back to the edit form. Everything below that bar is identical for
 * both, which is the only way a preview is worth anything.
 *
 * SHAPE: a cover strip, an identity block that overlaps it, one row of actions,
 * underlined section tabs, then cards — the arrangement every professional
 * network page uses, because it answers "who is this / can I contact them /
 * what do they sell" in that order without scrolling.
 */

type Tab = 'home' | 'about' | 'products';

const TABS: { key: Tab; label: string }[] = [
    { key: 'home', label: 'Home' },
    { key: 'about', label: 'About' },
    { key: 'products', label: 'Products' },
];

const money = (value?: number) =>
    `₹${Number(value || 0).toLocaleString('en-IN')}`;

const monthYear = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

/** A label / value row. `—` rather than an empty line, so a gap reads as data. */
/**
 * One answered question.
 *
 * NOTHING IS RENDERED FOR AN UNANSWERED ONE. It used to print the label with an
 * em dash under it, so a company that had filled in three of six fields showed
 * a grid half made of dashes — which reads as data that failed to load rather
 * than as a question nobody had to answer. Everything on the company form is
 * optional bar four fields; a profile is meant to grow, and the public page
 * should show what is there instead of listing what is not.
 */
const Detail = ({ label, value }: { label: string; value?: string | null }) => {
    const text = (value || '').trim();
    if (!text) return null;
    return (
        <div>
            <dt className="text-[1.1875rem] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
            <dd className="text-[1.25rem] text-slate-700 mt-1 break-words">{text}</dd>
        </div>
    );
};

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className={`${CARD_TITLE} text-slate-900 mb-4`}>{children}</h2>
);

/** One product tile, used by both the Home preview and the Products grid. */
const ProductTile = ({ product }: { product: NonNullable<PublicCompany['products']>[number] }) => (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col">
        <div className="h-36 bg-slate-50 flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
                <img
                    src={resolveMediaUrl(product.imageUrl)}
                    alt={product.name || 'Product'}
                    className="w-full h-full object-cover"
                />
            ) : (
                <Package className="h-9 w-9 text-slate-300" />
            )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
            <p className="font-semibold text-[1.25rem] text-slate-900 line-clamp-1">
                {product.name || 'Untitled product'}
            </p>
            <p className="text-[1.1875rem] text-slate-500 mt-0.5 line-clamp-1">
                {product.category || 'General'}{product.sku ? ` · ${product.sku}` : ''}
            </p>
            {product.description ? (
                <p className="text-[1.1875rem] text-slate-500 mt-2 line-clamp-2">{product.description}</p>
            ) : null}
            <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="font-bold text-[1.25rem] text-blue-600 tabular-nums">
                    {money(product.price)}
                </span>
                {product.stock ? (
                    <span className="text-[1rem] text-slate-500 border border-slate-200 rounded-md px-1.5 py-0.5">
                        Stock {product.stock}
                    </span>
                ) : null}
            </div>
        </div>
    </div>
);

export default function CompanyPublicView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [company, setCompany] = useState<PublicCompany | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [trusting, setTrusting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [tab, setTab] = useState<Tab>('home');
    /** Set when the logo cannot be fetched — see the note at the image. */
    const [logoFailed, setLogoFailed] = useState(false);
    const [bannerFailed, setBannerFailed] = useState(false);

    /*
      `?preview=1` is what the owner's own "View as member" link carries.

      It changes nothing about the page — the server decides that from who is
      asking — it only tells the preview bar to offer "Back to my companies"
      rather than "Back to Discover", which is where the member actually came
      from.
    */
    const cameFromOwner = searchParams.get('preview') === '1';

    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const data = await getPublicCompany(id);
            if (!data) { setNotFound(true); return; }
            setCompany(data);
        } catch (error) {
            console.warn('Could not load the company:', error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    /**
     * Re-read after an edit, and on coming back to the tab.
     *
     * This page fetched once and then never again, so an owner who opened the
     * preview, edited the company in another tab and came back was still looking
     * at the version from before the edit — and concluded the change had not
     * saved. The company screens already announce a save on `companyUpdated` /
     * `companyDataUpdated`; this listens to the same two, and refreshes on focus
     * for the edit that happened somewhere that does not announce.
     */
    useEffect(() => {
        const refresh = () => { load(); };
        window.addEventListener('companyUpdated', refresh);
        window.addEventListener('companyDataUpdated', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            window.removeEventListener('companyUpdated', refresh);
            window.removeEventListener('companyDataUpdated', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, [load]);

    const toggleTrust = async () => {
        if (!company?._id || trusting) return;
        setTrusting(true);
        // Optimistic, and reverted on failure. The button is the whole
        // interaction; a spinner where a tick belongs makes it feel broken.
        const next = !company.isTrusted;
        setCompany((current) => current && ({
            ...current,
            isTrusted: next,
            trustedBy: Math.max(0, Number(current.trustedBy || 0) + (next ? 1 : -1)),
        }));
        try {
            const result = next
                ? await addToTrustList(company._id)
                : await removeFromTrustList(company._id);
            setCompany((current) => current && ({
                ...current,
                isTrusted: result.isTrusted,
                trustedBy: result.trustedBy,
            }));
            toast.success(next ? 'Added to your trust list' : 'Removed from your trust list');
        } catch (error) {
            setCompany((current) => current && ({
                ...current,
                isTrusted: !next,
                trustedBy: Math.max(0, Number(current.trustedBy || 0) + (next ? -1 : 1)),
            }));
            toast.error(errorMessage(error, 'Could not update your trust list'));
        } finally {
            setTrusting(false);
        }
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard access is refused in some contexts. Saying so beats a
            // button that silently does nothing.
            toast.error('Could not copy the link — select the address bar instead.');
        }
    };

    const products = useMemo(() => company?.products || [], [company]);
    const categories = useMemo(() => company?.productCategories || [], [company]);

    if (loading) {
        return (
            <BusinessPageShell title="Company" width="standard">
                <Loading label="Loading company…" />
            </BusinessPageShell>
        );
    }

    if (notFound || !company) {
        return (
            <BusinessPageShell title="Company" width="standard">
                <Card>
                    <EmptyState
                        icon={Building2}
                        title="This company is not available"
                        hint="It may have been removed, or taken out of the member directory by its owner."
                        action={
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/business/discover')}>
                                Back to Discover
                            </Button>
                        }
                    />
                </Card>
            </BusinessPageShell>
        );
    }

    const isOwner = company.isOwner === true;
    const trustedBy = Number(company.trustedBy || 0);
    const location = [company.area, company.location].filter(Boolean).join(', ');

    return (
        <BusinessPageShell
            title={company.businessName || 'Company'}
            subtitle="How this company appears to other members"
            width="standard"
            actions={
                <Button
                    type="button"
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => navigate(isOwner && cameFromOwner ? '/business/companies' : '/business/discover')}
                >
                    <ArrowLeft className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Back</span>
                </Button>
            }
        >
            <div className="space-y-5">
                                {/*
                    NO PREVIEW BAR.

                    It read "Viewing as a member. This is exactly what other
                    members see. Only you can see this bar." — a paragraph
                    stating that the page below it is unremarkable, on the one
                    screen an owner opens to look at their own company.

                    The claim it made is still true and is now simply the case:
                    an owner sees their company exactly as a member does. A
                    banner is not needed to say that nothing is different.
                */}
                {/* ------------------------------------------------ identity */}
                <Card padded={false} className="overflow-hidden">
                    {/*
                        A cover strip, drawn rather than uploaded.

                        There is no cover-image field on a company and inventing
                        one would be a second image to size, crop and moderate.
                        A flat brand band gives the header the same anchor a
                        photo would without asking anybody for a photo.
                    */}
                    {/*
                        THE COVER: the company's own, or a drawn one.

                        The drawn default is deliberately NOT brand blue. A blue
                        band is the association's colour, so every company
                        wearing it made the directory look like one organisation
                        with many names — and a company that HAD uploaded a cover
                        was the only one that looked like itself. A quiet warm
                        grey reads as "no cover yet" and lets the logo and the
                        name be the only colour in the header.
                    */}
                    {company.banner ? (
                        <img
                            src={resolveMediaUrl(company.banner)}
                            alt=""
                            onError={() => setBannerFailed(true)}
                            className={`w-full h-32 sm:h-44 object-cover ${bannerFailed ? 'hidden' : ''}`}
                        />
                    ) : null}

                    {(!company.banner || bannerFailed) && (
                        <div
                            className="h-32 sm:h-44 bg-slate-100"
                            style={{
                                backgroundImage:
                                    'radial-gradient(circle at 1px 1px, rgba(100,116,139,0.18) 1px, transparent 0)',
                                backgroundSize: '14px 14px',
                            }}
                        />
                    )}

                    <div className="px-5 sm:px-8 pb-6">
                        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
                            <span className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-4 border-white
                                             shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                                {company.logo && !logoFailed ? (
                                    <img
                                        src={resolveMediaUrl(company.logo)}
                                        alt={company.businessName || 'Company'}
                                        onError={() => setLogoFailed(true)}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Building2 className="h-11 w-11 text-slate-300" />
                                )}
                            </span>
                        </div>

                        <div className="mt-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                                <h1 className="text-[2rem] sm:text-[2.5625rem] font-extrabold tracking-tight text-slate-900 break-words">
                                    {company.businessName || 'Company'}
                                </h1>

                                {/* The one-line "who are you" — type, constitution,
                                    and the headline category if one is set. */}
                                <p className="text-[1.375rem] text-slate-600 mt-1.5 font-medium">
                                    {[
                                        company.businessType,
                                        company.constitutionType,
                                        categories[0]?.description,
                                    ].filter(Boolean).join(' · ') || 'Business'}
                                </p>

                                <p className="text-[1.25rem] text-slate-500 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    {location ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <MapPin className="h-4 w-4" />
                                            {location}
                                        </span>
                                    ) : null}
                                    {location ? <span aria-hidden="true">·</span> : null}
                                    <span className="inline-flex items-center gap-1.5">
                                        <Package className="h-4 w-4" />
                                        {products.length} {products.length === 1 ? 'product' : 'products'}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Users className="h-4 w-4" />
                                        {trustedBy} {trustedBy === 1 ? 'member trusts' : 'members trust'} this
                                    </span>
                                    {company.numberOfEmployees ? (
                                        <>
                                            <span aria-hidden="true">·</span>
                                            <span>{company.numberOfEmployees} employees</span>
                                        </>
                                    ) : null}
                                </p>
                            </div>

                            {/* ------------------------------------ actions */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {/*
                                    Trust is the primary action, and it is not
                                    offered on your own company — a trust list of
                                    yourself is not a list of anything.
                                */}
                                {!isOwner && (
                                    <Button
                                        onClick={toggleTrust}
                                        disabled={trusting}
                                        className={company.isTrusted
                                            ? 'bg-white text-blue-700 border border-blue-600 hover:bg-blue-50'
                                            : 'bg-blue-600 hover:bg-blue-700'}
                                    >
                                        {trusting
                                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            : company.isTrusted
                                                ? <ShieldCheck className="h-4 w-4 mr-2" />
                                                : <ShieldPlus className="h-4 w-4 mr-2" />}
                                        {company.isTrusted ? 'Trusted' : 'Add to trust list'}
                                    </Button>
                                )}

                                {company.mobileNumber ? (
                                    <a href={`tel:${company.mobileNumber}`}>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                                            <Phone className="h-4 w-4 mr-2" />
                                            Call
                                        </Button>
                                    </a>
                                ) : null}

                                {company.email ? (
                                    <a href={`mailto:${company.email}`}>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                                            <Mail className="h-4 w-4 mr-2" />
                                            Email
                                        </Button>
                                    </a>
                                ) : null}

                                <Button
                                    variant="outline"
                                    onClick={copyLink}
                                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                                    aria-label="Copy a link to this company"
                                >
                                    {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* --------------------------------------------- tabs */}
                    <div className="border-t border-slate-200 px-5 sm:px-8">
                        <nav className="flex gap-6 -mb-px" aria-label="Company sections">
                            {TABS.map((entry) => {
                                const active = tab === entry.key;
                                return (
                                    <button
                                        key={entry.key}
                                        type="button"
                                        onClick={() => setTab(entry.key)}
                                        aria-current={active ? 'page' : undefined}
                                        className={`py-3 text-[1.25rem] font-semibold border-b-2 transition-colors ${active
                                            ? 'border-blue-600 text-blue-700'
                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        {entry.label}
                                        {entry.key === 'products' && products.length > 0 ? (
                                            <span className="ml-1.5 text-[1.1875rem] text-slate-400 tabular-nums">
                                                {products.length}
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </Card>

                {/* --------------------------------------- body: main + rail */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                    <div className="lg:col-span-2 space-y-5">
                        {tab === 'home' && (
                            <>
                                <Card>
                                    <SectionTitle>Overview</SectionTitle>
                                    <p className="text-[1.25rem] text-slate-600 leading-relaxed whitespace-pre-line">
                                        {company.description
                                            || company.businessActivities
                                            || 'This company has not written an overview yet.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setTab('about')}
                                        className="mt-4 text-[1.25rem] font-semibold text-blue-700 hover:underline"
                                    >
                                        Show all details →
                                    </button>
                                </Card>

                                {categories.length > 0 && (
                                    <Card>
                                        <SectionTitle>What they do</SectionTitle>
                                        {/*
                                            The NIC code is printed, not hidden.
                                            It is how a buyer confirms they are
                                            looking at the right classification,
                                            and how the association counts an
                                            industry at all.
                                        */}
                                        <ul className="flex flex-wrap gap-2">
                                            {categories.map((category, index) => (
                                                <li
                                                    key={`${category?.code || 'custom'}-${index}`}
                                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                                >
                                                    <span className="block text-[1.25rem] text-slate-800">
                                                        {category?.description || '—'}
                                                    </span>
                                                    <span className="block text-[1rem] text-slate-500 mt-0.5">
                                                        {category?.code
                                                            ? `NIC ${category.code}${category?.industryType ? ` · ${category.industryType}` : ''}`
                                                            : 'Custom category'}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </Card>
                                )}

                                <Card>
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className={`${CARD_TITLE} text-slate-900`}>Products &amp; services</h2>
                                        {products.length > 3 ? (
                                            <button
                                                type="button"
                                                onClick={() => setTab('products')}
                                                className="text-[1.25rem] font-semibold text-blue-700 hover:underline"
                                            >
                                                Show all {products.length} →
                                            </button>
                                        ) : null}
                                    </div>

                                    {products.length === 0 ? (
                                        <p className="text-[1.25rem] text-slate-500">
                                            No products listed yet.
                                            {isOwner ? ' Add some so other members can find you by what you sell.' : ''}
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {products.slice(0, 3).map((product) => (
                                                <ProductTile key={product._id} product={product} />
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </>
                        )}

                        {tab === 'about' && (
                            <Card>
                                <SectionTitle>About {company.businessName}</SectionTitle>
                                <p className="text-[1.25rem] text-slate-600 leading-relaxed whitespace-pre-line">
                                    {company.description || 'No overview provided.'}
                                </p>

                                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6 pt-6 border-t border-slate-100">
                                    <Detail label="Type of business" value={company.businessType} />
                                    <Detail label="Constitution" value={company.constitutionType} />
                                    <Detail label="Business activities" value={company.businessActivities} />
                                    <Detail label="Employees" value={company.numberOfEmployees} />
                                    <Detail label="Location" value={location} />
                                    {/* Only when the answer is yes. "Not a member of
                                        another chamber" is a non-fact taking up a
                                        row beside real ones. */}
                                    <Detail
                                        label="Other chamber"
                                        value={company.memberOfOtherChamber
                                            ? (company.otherChamber || 'Yes')
                                            : ''}
                                    />
                                </dl>

                                {/*
                                    WHAT THE COMPANY IS REGISTERED WITH.

                                    These were filled in on the form and then
                                    appeared nowhere a buyer could see them, which
                                    makes the questions pointless. Chips rather than
                                    a list: they are labels, not sentences, and a
                                    reader scans them.
                                */}
                                {((company.govtRegistrations || []).length > 0
                                  || (company.govtSchemes || []).length > 0) && (
                                    <div className="mt-6 pt-6 border-t border-slate-100 space-y-5">
                                        {(company.govtRegistrations || []).length > 0 && (
                                            <div>
                                                <p className="text-[1.1875rem] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                                                    Registered with
                                                </p>
                                                <ul className="flex flex-wrap gap-2">
                                                    {(company.govtRegistrations || []).map((body) => (
                                                        <li key={body}>
                                                            <Chip tone="blue" icon={BadgeCheck}>{body}</Chip>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {(company.govtSchemes || []).length > 0 && (
                                            <div>
                                                <p className="text-[1.1875rem] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                                                    Schemes availed
                                                </p>
                                                <ul className="flex flex-wrap gap-2">
                                                    {(company.govtSchemes || []).map((scheme) => (
                                                        <li key={scheme}>
                                                            <Chip tone="green">{scheme}</Chip>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}


                                {/*
                                    ONLY UNTIL THERE ARE PRODUCTS.

                                    The NIC categories answer "what does this
                                    company make" in the abstract; a list of
                                    actual products answers it concretely and
                                    better. Showing both puts a general claim
                                    next to the specific evidence for it, and the
                                    reader has to work out that they are the same
                                    answer twice. While the catalogue is empty
                                    the categories are all there is, so they stay.
                                */}
                                {categories.length > 0 && products.length === 0 && (
                                    <div className="mt-6 pt-6 border-t border-slate-100">
                                        <p className="text-[1.1875rem] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                                            Product categories
                                        </p>
                                        <ul className="space-y-2">
                                            {categories.map((category, index) => (
                                                <li
                                                    key={`${category?.code || 'custom'}-${index}`}
                                                    className="flex items-start gap-2.5 text-[1.25rem]"
                                                >
                                                    <Tag className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                                    <span className="min-w-0">
                                                        <span className="block text-slate-800">
                                                            {category?.description || '—'}
                                                        </span>
                                                        <span className="block text-[1.1875rem] text-slate-500">
                                                            {category?.code
                                                                ? `NIC ${category.code}${category?.industryType ? ` · ${category.industryType}` : ''}`
                                                                : 'Custom category'}
                                                        </span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </Card>
                        )}

                        {tab === 'products' && (
                            <Card>
                                <SectionTitle>Products &amp; services</SectionTitle>
                                {products.length === 0 ? (
                                    <EmptyState
                                        icon={Package}
                                        title="Nothing listed yet"
                                        hint={isOwner
                                            ? 'Add products so other members can find you by what you sell.'
                                            : 'This company has not published a catalogue.'}
                                        action={isOwner ? (
                                            <Button
                                                className="bg-blue-600 hover:bg-blue-700"
                                                onClick={() => navigate('/business/add-product')}
                                            >
                                                Add a product
                                            </Button>
                                        ) : undefined}
                                    />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {products.map((product) => (
                                            <ProductTile key={product._id} product={product} />
                                        ))}
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>

                    {/* ------------------------------------------- right rail */}
                    <div className="space-y-5">
                        <Card>
                            <SectionTitle>Contact</SectionTitle>
                            <dl className="space-y-4 text-[1.25rem]">
                                {company.mobileNumber ? (
                                    <div className="flex items-start gap-3">
                                        <Phone className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                        <a href={`tel:${company.mobileNumber}`} className="text-slate-700 hover:underline">
                                            {company.mobileNumber}
                                        </a>
                                    </div>
                                ) : null}
                                {company.email ? (
                                    <div className="flex items-start gap-3 min-w-0">
                                        <Mail className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                        <a href={`mailto:${company.email}`} className="text-slate-700 hover:underline break-all">
                                            {company.email}
                                        </a>
                                    </div>
                                ) : null}
                                {location ? (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                        <span className="text-slate-700">{location}</span>
                                    </div>
                                ) : null}
                                {!company.mobileNumber && !company.email && !location ? (
                                    <p className="text-[1.25rem] text-slate-500">No contact details published.</p>
                                ) : null}
                            </dl>
                        </Card>

                        <Card>
                            <SectionTitle>At a glance</SectionTitle>
                            <dl className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <Detail label="Type" value={company.businessType} />
                                </div>
                                <div className="flex items-start gap-3">
                                    <Landmark className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <Detail label="Constitution" value={company.constitutionType} />
                                </div>
                                <div className="flex items-start gap-3">
                                    <Users className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <Detail
                                        label="Trusted by"
                                        value={`${trustedBy} ${trustedBy === 1 ? 'member' : 'members'}`}
                                    />
                                </div>
                                <div className="flex items-start gap-3">
                                    <CalendarDays className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <Detail label="On ACTIV since" value={monthYear(company.createdAt)} />
                                </div>
                            </dl>
                        </Card>
                    </div>
                </div>
            </div>
        </BusinessPageShell>
    );
}
