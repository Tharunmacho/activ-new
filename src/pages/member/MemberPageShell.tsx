import { useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MenuTile } from '@/components/shared/MenuTile';
import MemberSidebar from './MemberSidebar';
import MemberTopBar from '@/features/member/components/MemberTopBar';
import { useNavigate } from 'react-router-dom';
/*
 * The same two constants the dashboard's header band uses. This shell draws the
 * band for every OTHER member screen, so reading the title and subtitle from
 * here is what stops the band changing size as the member moves between them.
 */
import { PAGE_SUBTITLE, PAGE_TITLE } from '@/components/layout/appTypography';

export type ShellWidth = 'wide' | 'standard' | 'narrow';

/*
 * THE SAME THREE WIDTHS THE ADMIN AREA USES.
 *
 * `wide` was an uncapped `w-full`, so a dashboard ran edge to edge on a large
 * monitor while every admin screen stopped at 90rem — one product disagreeing
 * with itself about where the right margin is. One cap for every member screen
 * for the same reason: content that stops at one right margin on one screen and
 * a different one on the next reads as a layout fault even when each is fine
 * alone. Where the column SITS inside the window is decided below, by whether
 * there is a rail to act as the left margin.
 */
const WIDTHS: Record<ShellWidth, string> = {
    wide: 'max-w-[90rem]',
    // The same 90rem the admin screens and the dashboards use. `standard` and
    // `wide` differing by 18rem meant two member screens one click apart stopped
    // at different right margins for no reason a reader could see.
    standard: 'max-w-[90rem]',
    narrow: 'max-w-4xl',
};

/*
 * THE SAME PAGE, MEASURED FROM THE WINDOW EDGE RATHER THAN THE RAIL.
 *
 * A screen WITH the sidebar paints 18rem of rail plus a 90rem column — 108rem
 * of the window in total. A screen without one painted the 90rem column alone,
 * so a member walking from the dashboard into the four application steps
 * watched the product lose 18rem of width at the exact moment the rail
 * disappeared, and the difference came back as bare white down both sides.
 *
 * Railless screens are capped at that same 108rem instead, so every member
 * screen fills the window to the same place whether or not it has a rail. The
 * text column inside them does not get wider — the four forms still lay out in
 * two columns — the page simply stops leaving a gutter it has no use for.
 */
const RAILLESS: Record<ShellWidth, string> = {
    wide: 'max-w-[108rem]',
    standard: 'max-w-[108rem]',
    // Narrow is narrow on purpose — a single-column form does not want 108rem.
    narrow: 'max-w-4xl',
};

/**
 * The member page shell.
 *
 * `sidebar` decides whether this screen is a place a member navigates TO or a
 * step they are working THROUGH. The four screens the sidebar itself links to —
 * Dashboard, My Profile, Business Account, Explore Members — plus Settings keep
 * it, so its own links always lead somewhere that has it. The registration
 * forms, the submission screens and the whole payment flow do not: offering a
 * member four ways to leave halfway through paying is how a half-finished
 * application happens. Those get a back arrow instead.
 */
export default function MemberPageShell({
    title,
    shortTitle,
    subtitle,
    actions,
    width = 'standard',
    sidebar = true,
    backTo = '/member/unpaid-dashboard',
    onBack,
    children,
}: {
    title: string;
    /**
     * The title below `sm`, when the full one does not fit.
     *
     * "Welcome back, Rajeshwari 👋" truncates to "Welcome back, …" on a 360px
     * screen — the member's own name, which is the entire content of the line,
     * is the part thrown away. A screen with a long title passes a short form
     * for that width; everything else leaves this unset and keeps one title.
     */
    shortTitle?: string;
    subtitle?: string;
    actions?: ReactNode;
    width?: ShellWidth;
    /** False for a linear flow — see the note above. */
    sidebar?: boolean;
    /** Where the back arrow goes when there is no sidebar. */
    backTo?: string;
    /**
     * What the back arrow does instead, when a path is the wrong answer.
     *
     * A screen reached from three different places cannot name one path that
     * is right for all of them; it passes a handler that steps back through
     * history and falls back to `backTo` on a direct visit.
     */
    onBack?: () => void;
    children: ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {sidebar ? (
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            ) : null}

            <div className="flex-1 min-w-0 flex flex-col relative">
                {/*
                  * `px-4` on a phone, `px-6` from `sm`.
                  *
                  * Two 40px icon buttons and a hamburger already take 130px out
                  * of a 390px bar; 24px of padding on each side of that is what
                  * pushed the title into an ellipsis after nine characters.
                  */}
                {/*
                  `z-30`, not `z-10`.

                  The page content was lifted to `z-10` so it would sit above
                  the decorative layer behind it — and that put it level with
                  this header, which comes EARLIER in the document. Equal
                  z-index is decided by document order, so the cards painted
                  over the sticky header and scrolled across the title. The
                  header outranks the page it heads.
                */}
                <header className="h-[5.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 sticky top-0 z-30">
                    {sidebar ? (
                        <MenuTile onClick={() => setSidebarOpen(true)} />
                    ) : (
                        /* Without a rail there has to be a way out, at every width. */
                        <button
                            type="button"
                            className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 shadow-sm active:scale-90 flex items-center
                                       justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={() => (onBack ? onBack() : navigate(backTo))}
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    {/*
                      * `flex-1`, and a title that steps down on a phone.
                      *
                      * The heading was `text-[2rem]` at every width with
                      * `truncate` on it, so "Welcome back, Rajeshwari" read as
                      * "Welcome ba…" on a 390px screen — the member's own name,
                      * which is the entire content of the line, was the part
                      * that got cut. 1.25rem on a phone fits it; the desktop
                      * size is unchanged from `sm` up.
                      *
                      * Without `flex-1` the block is sized by its content and
                      * the icon group on the right is pushed off instead.
                      */}
                    <div className="min-w-0 flex-1">
                        {/* Two spans rather than a JS width check: a media query
                            has no re-render and no flash of the wrong one. */}
                        <h1 className={`${PAGE_TITLE} text-slate-900 truncate`}>
                            {shortTitle ? (
                                <>
                                    <span className="sm:hidden">{shortTitle}</span>
                                    <span className="hidden sm:inline">{title}</span>
                                </>
                            ) : title}
                        </h1>
                        {subtitle ? (
                            <p className={`${PAGE_SUBTITLE} text-slate-500 mt-0.5 truncate hidden sm:block`}>{subtitle}</p>
                        ) : null}
                    </div>

                    {/*
                      * Messages and alerts, at the same place on every member
                      * screen.
                      *
                      * In the header rather than the rail on purpose: they are
                      * checked in passing, and a rail entry makes checking them
                      * a departure from whatever the member was doing. A screen's
                      * own `actions` sit to their left, so the two icons keep one
                      * fixed position the eye learns once.
                      *
                      * Not rendered without the rail: those screens are linear
                      * flows — the registration forms, the payment steps — and
                      * `MemberPageShell` already refuses to offer a way out of
                      * them. A notification panel is a way out.
                      */}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                        {actions}
                        {sidebar ? <MemberTopBar /> : null}
                    </div>
                </header>

                {/*
                  * With a rail, the rail IS the left margin and the column is
                  * left-aligned behind it. Without one the column is centred and
                  * given the rail's width back — see RAILLESS above — so the
                  * page fills the window to the same place either way.
                  */}
                {/* `p-4` on a phone: 24px gutters on a 390px screen leave a
                    342px column, and every card inside adds its own padding on
                    top of that. */}
                {/*
                  * THE SHEET. The member area's cards stand ON something now.
                  *
                  * This was white, inside a shell that is also white, under
                  * cards that are white. Three layers of the same colour, with
                  * nothing between a card and the page but a `slate-200`
                  * hairline — and a hairline is not a layer. Every panel read as
                  * dim and slightly unfinished, which is exactly the complaint.
                  *
                  * `#f3f6fb` is not a new colour: it is `SHEET` from
                  * `components/layout/surface.ts`, lifted from the Business
                  * Account form — the densest screen in the product and the one
                  * place the house style has already been argued through. The
                  * association asked for this area to read the same way, and
                  * using the same value is the only way to be sure it does.
                  */}
                {/*
                  * THE PAGE THE CARDS STAND ON — plain, and deliberately so.
                  *
                  * This had borrowed the PUBLIC site's surface: a 22px dot
                  * field, two out-of-focus brand blooms and a set of slowly
                  * rotating orbit rings. The argument was that a flat page
                  * gives a card nothing to be on top of, and half of it is
                  * right — a white card on a white page has only its shadow to
                  * prove it is a card.
                  *
                  * But a dot field and a moving ring are the marketing site's
                  * voice, and this is the screen somebody does an hour's work
                  * on. Texture that is charming behind a hero is noise behind a
                  * table of members, a message thread or a catalogue. The
                  * association read it as unfinished, and on a screen this
                  * dense they are right.
                  *
                  * So the depth stays and the decoration goes. `slate-100` is
                  * two steps off white — enough for a white card to read as a
                  * card — and it is the exact value the Business Account
                  * screens have always used, which is the house style this
                  * product argued through once already.
                  *
                  * The public pages keep `.dot-band`. It is still their voice.
                  */}
                <main className="relative flex-1 overflow-y-auto bg-slate-100 p-4 sm:p-6">
                    {/*
                      * `mx-auto` IN BOTH CASES, and that is the load-bearing half.
                      *
                      * `mx-auto` IN BOTH CASES — the column is CENTRED in the pane.
                      *
                      * The railless branch had it and the sidebar branch did not, so a
                      * capped column with no centring stayed pinned to the left and the
                      * whole surplus piled up on the right: measured on a 1920px window,
                      * 24px of gutter beside the rail and about 120px of dead space at
                      * the far edge. It reads as a page that has come loose from its own
                      * margin, and it is the same fault `ADMIN_PAGE` in
                      * `features/admin/components/AdminUI.tsx` carries a note about —
                      * fixed there, missed here.
                      *
                      * The cap sits on this INNER div rather than on `<main>`, which is
                      * what keeps the fix off the scroll bar: centring the scroll
                      * container itself would drag the bar in from the window edge and
                      * leave a strip of page beside it.
                      */}
                    <div className={`relative z-10 w-full mx-auto ${sidebar ? WIDTHS[width] : RAILLESS[width]}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
