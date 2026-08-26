import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';

/**
 * The public site's header.
 *
 * Everything visible here — the mark, the lockup beside it, each nav entry and
 * the button on the right — comes from `/cms/site`. Nothing is hardcoded, so
 * removing a nav link in the CMS removes it from the site rather than appearing
 * to do nothing.
 *
 * The header is fetched per page rather than lifted to a shared provider. It is
 * one small cached GET, and threading it through would couple every public page
 * to a context that exists for one component.
 */
export function HeaderSection() {
    const location = useLocation();
    const pathname = location.pathname;

    const [site, setSite] = useState<SiteSettings | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            // `getSiteSettings` already resolves to an empty shape on failure;
            // this catches only the unexpected. The page still renders.
            .catch(() => { if (!cancelled) setSite(null); });
        return () => { cancelled = true; };
    }, []);

    // Collapse the drawer on navigation, or it stays open over the new page.
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    const brand = site?.brand;
    const navLinks = site?.header?.navLinks || [];
    const ctaLabel = site?.header?.ctaLabel || '';
    const ctaHref = site?.header?.ctaHref || '/login';

    const navClass = (href: string) => {
        // '/' and '/onboarding' are the same page, so both light the Home link.
        const isActive = pathname === href || (href === '/' && pathname === '/onboarding');
        return isActive
            ? 'text-[#1c2e68] border-b-2 border-[#1c2e68] pb-1 font-semibold transition-all'
            : 'text-gray-600 hover:text-[#1c2e68] pb-1 transition-all font-medium';
    };

    return (
        <header className="w-full flex flex-col font-sans bg-white shadow-sm sticky top-0 z-50">
            <div className="container mx-auto px-4 md:px-8 py-4">
                <div className="flex justify-between items-center gap-4">

                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-2 min-w-0">
                        {brand?.logo?.url && (
                            <span className="h-12 w-auto shrink-0">
                                <CmsMediaFrame
                                    media={brand.logo}
                                    className="h-12 w-auto max-w-[180px] object-contain"
                                />
                            </span>
                        )}
                        {brand?.fullName && (
                            <span className="text-[10px] text-[#1c2e68] font-bold leading-tight hidden md:block
                                             uppercase tracking-wider pl-2 border-l-2 border-[#1c2e68] max-w-[220px]">
                                {brand.fullName}
                            </span>
                        )}
                    </Link>

                    {/* Navigation */}
                    {navLinks.length > 0 && (
                        <nav className="hidden lg:flex items-center space-x-8 text-sm">
                            {navLinks.map((item, i) => (
                                <Link key={`${item.href}-${i}`} to={item.href || '/'} className={navClass(item.href)}>
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    )}

                    <div className="flex items-center gap-3">
                        {ctaLabel && (
                            <Link
                                to={ctaHref}
                                className="bg-[#1c2e68] hover:bg-blue-900 text-white px-6 py-2 rounded-full
                                           font-medium transition-colors shadow-sm text-sm whitespace-nowrap"
                            >
                                {ctaLabel}
                            </Link>
                        )}

                        {/* The nav collapses below `lg`; without this it is unreachable. */}
                        {navLinks.length > 0 && (
                            <button
                                className="lg:hidden text-[#1c2e68] p-1"
                                onClick={() => setMenuOpen(v => !v)}
                                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                                aria-expanded={menuOpen}
                            >
                                {menuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                        )}
                    </div>
                </div>

                {menuOpen && navLinks.length > 0 && (
                    <nav className="lg:hidden flex flex-col gap-1 pt-4 mt-4 border-t border-gray-100">
                        {navLinks.map((item, i) => (
                            <Link
                                key={`m-${item.href}-${i}`}
                                to={item.href || '/'}
                                className="px-2 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
}
