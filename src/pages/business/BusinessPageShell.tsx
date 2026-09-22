import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ArrowLeft } from 'lucide-react';
import BusinessSidebar from './BusinessSidebar';

import { PAGE_SUBTITLE, PAGE_TITLE } from '@/components/layout/appTypography';
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

export type ShellWidth = 'wide' | 'form' | 'standard' | 'narrow';

/*
 * THE SAME MEASUREMENTS THE MEMBER AREA USES.
 *
 * These were `w-full` / `max-w-6xl` / `max-w-4xl`, which disagreed with
 * `MemberPageShell` on every count: a member walked from a dashboard that
 * stopped at 90rem into a business screen that either ran edge to edge or
 * stopped at 72rem, and the product appeared to change its right margin
 * depending on which half of it you were in. Content that stops at one margin
 * on one screen and a different one on the next reads as a layout fault even
 * when each is fine alone.
 *
 * So: 90rem beside the rail, 108rem without one (the rail's 18rem plus that
 * 90rem, so a railless screen fills the window to the same place a railed one
 * does), and 4rem-short-of-64 for a single form. Identical to
 * `MemberPageShell.WIDTHS` / `.RAILLESS`.
 */
const WIDTHS: Record<ShellWidth, string> = {
    /** Grids and directories. */
    wide: 'max-w-[90rem] mx-auto',
    /** Dashboards and settings. */
    standard: 'max-w-[90rem] mx-auto',
    /**
     * A form with no rail beside it — so it takes the rail's width as well.
     * Capped rather than `w-full`: past about 108rem the two-column field grids
     * stretch each input past 580px, which is the "850px-wide input" this file's
     * own `FieldGrid` note warns about.
     */
    form: 'max-w-[108rem] mx-auto',
    /** Single forms, where a full-width input would be absurd. */
    narrow: 'max-w-4xl mx-auto',
};

export default function BusinessPageShell({
    title,
    subtitle,
    actions,
    width = 'standard',
    disableNavigation = false,
    sidebar = true,
    backTo,
    surface = 'muted',
    children,
}: {
    title: string;
    subtitle?: string;
    /** Page-level buttons, right-aligned in the header bar. */
    actions?: ReactNode;
    width?: ShellWidth;
    disableNavigation?: boolean;
    /**
     * Whether this screen is a place to navigate FROM.
     *
     * The business rail lists Products, Stock, Discover, Analytics — every one
     * of which describes a company. A member who has not created one yet has
     * nothing behind any of those links, so the rail was shown greyed out and
     * inert: eight dead controls framing the one form that matters, and the
     * only live link in it pointing away from that form. The create-first-
     * company screen passes `false` and gets a back arrow instead, the way the
     * member registration forms already do (`MemberPageShell`'s `sidebar`).
     */
    sidebar?: boolean;
    /** Where the back arrow goes when there is no rail. */
    backTo?: string;
    /**
     * The page behind the cards.
     *
     * `muted` is the slate-100 the dashboards use. `white` is the near-white
     * slate-50 a single form sits on — lighter, so the page reads as white,
     * but NOT the same white as the cards.
     *
     * It was literally `bg-white` for one revision and that was the mistake: a
     * white card on a white page has only its shadow to prove it is a card, and
     * a soft shadow on white is almost nothing. The card needs somewhere to sit.
     * Two points of difference is all it takes, and it costs nothing in how
     * bright the screen looks.
     */
    surface?: 'muted' | 'white';
    children: ReactNode;
}) {
    const [drawer, setDrawer] = useState(false);
    const navigate = useNavigate();

    return (
        <div className={`min-h-screen flex ${surface === 'white' ? 'bg-slate-50' : 'bg-slate-100'}`}>
            {sidebar ? (
                <BusinessSidebar
                    isOpen={drawer}
                    onClose={() => setDrawer(false)}
                    disableNavigation={disableNavigation}
                />
            ) : null}

            <div className="flex-1 min-w-0 flex flex-col">
                {/* `px-4` and a tighter gap on a phone: the menu button and the
                    action group take a fixed bite out of a 390px bar, and the
                    title gets whatever is left. */}
                <header className="h-[5.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 sm:gap-3 px-4 sm:px-5 lg:px-8">
                    {sidebar ? (
                        <button
                            type="button"
                            className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0"
                            onClick={() => setDrawer(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    ) : (
                        /* Without a rail there has to be a way out, at every width. */
                        <button
                            type="button"
                            onClick={() => navigate(backTo || '/member/unpaid-dashboard')}
                            className="shrink-0 w-12 h-12 rounded-full border border-slate-200 bg-white
                                       flex items-center justify-center text-slate-700
                                       hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-[1.375rem] h-[1.375rem]" />
                        </button>
                    )}

                    {/* `flex-1`, and a smaller heading on a phone. "Business
                        Dashboard" beside a "Switch company" button read as
                        "Business …" at 390px, which is not a page title. */}
                    <div className="min-w-0 flex-1">
                        {/* The size this header has always been. It was raised
                            to 26px/extrabold during a pass over the panel's
                            typography; the association preferred the original. */}
                        <h1 className={`${PAGE_TITLE} text-slate-900 truncate`}>
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className={`${PAGE_SUBTITLE} text-slate-500 truncate hidden sm:block`}>{subtitle}</p>
                        ) : null}
                    </div>

                    {actions ? (
                        <div className="flex items-center gap-2 shrink-0">{actions}</div>
                    ) : null}
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-8">
                    <div className={WIDTHS[width]}>{children}</div>
                </main>
            </div>
        </div>
    );
}
