import { useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import BusinessSidebar from './BusinessSidebar';

/**
 * The page shell every business screen renders inside.
 *
 * Two problems made this necessary.
 *
 * **The mobile drawer was unreachable on most pages.** `BusinessSidebar` hides
 * its rail below the `lg` breakpoint and exposes a drawer gated on `isOpen`.
 * Ten screens declared `const [sidebarOpen, setSidebarOpen] = useState(false)`
 * and dutifully passed it down — but only two ever rendered a control that set
 * it to `true`, and two more passed no props at all. On a phone, the Dashboard,
 * Products, Discover, Analytics, Settings, Add Product, Edit Product, Company
 * Details and Add/Edit Company screens therefore had **no navigation of any
 * kind**: the rail was hidden and nothing could open the drawer. Owning the
 * state and its trigger in one place is what stops that recurring.
 *
 * **Every screen hand-rolled its own chrome.** There were three incompatible
 * headers across twelve files — a white `border-b` band on seven, a grey
 * `bg-gray-50` band on two, and no band at all on two others, which put a
 * mobile back-button above the title instead. Two screens carried a `md:hidden`
 * app bar *and* a separate desktop title.
 *
 * Layout follows `pages/cms/CmsLayout.tsx`, the best desktop shell in the repo,
 * including the two structural details the old business pages got wrong:
 * `lg:static` on the aside (so the rail participates in flow instead of
 * overlaying) and `min-w-0` on the main column (so long content can shrink
 * rather than forcing the page to scroll sideways).
 */

export type ShellWidth = 'wide' | 'standard' | 'narrow';

const WIDTHS: Record<ShellWidth, string> = {
    /** Grids and directories — fills the viewport. */
    wide: 'w-full',
    /** Dashboards and settings — wide, but still a measured column. */
    standard: 'max-w-6xl mx-auto',
    /** Single forms, where a full-width input would be absurd. */
    narrow: 'max-w-4xl mx-auto',
};

export default function BusinessPageShell({
    title,
    subtitle,
    actions,
    width = 'standard',
    disableNavigation = false,
    children,
}: {
    title: string;
    subtitle?: string;
    /** Page-level buttons, right-aligned in the header bar. */
    actions?: ReactNode;
    width?: ShellWidth;
    disableNavigation?: boolean;
    children: ReactNode;
}) {
    const [drawer, setDrawer] = useState(false);

    return (
        <div className="min-h-screen flex bg-slate-100">
            <BusinessSidebar
                isOpen={drawer}
                onClose={() => setDrawer(false)}
                disableNavigation={disableNavigation}
            />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-[4.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-5 lg:px-8">
                    <button
                        type="button"
                        className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0"
                        onClick={() => setDrawer(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="min-w-0">
                        <h1 className="text-[1.3125rem] font-bold tracking-tight text-slate-900 truncate">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="text-[0.8125rem] text-slate-500 truncate hidden sm:block">{subtitle}</p>
                        ) : null}
                    </div>

                    {actions ? (
                        <div className="ml-auto flex items-center gap-2 shrink-0">{actions}</div>
                    ) : null}
                </header>

                <main className="flex-1 overflow-y-auto p-5 lg:p-8">
                    <div className={WIDTHS[width]}>{children}</div>
                </main>
            </div>
        </div>
    );
}
