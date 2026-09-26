import { type ReactNode } from 'react';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TIERS, tierForRole } from './tierConfig';

import { CARD_SUBTITLE, CARD_TITLE, PAGE_SUBTITLE, PAGE_TITLE } from '@/components/layout/appTypography';
/**
 * The admin area's visual language, in one file.
 *
 * WHY THIS EXISTS. Each admin screen had grown its own weights — `border` here
 * and `border-slate-200 shadow-sm` there, `font-medium text-slate-700` labels
 * against `font-semibold text-slate-700`, inputs at `py-2` beside inputs at
 * `h-11`. Individually invisible; together they made the admin area read as a
 * thinner, less finished product than the pages the public sees, which is the
 * wrong way round for the screens that run the association.
 *
 * WHAT THE LOOK IS. Modelled on the CRM dashboard supplied as a reference —
 * the treatment only, never its content:
 *
 *   - a near-white page, so a WHITE card is a raised surface rather than a
 *     rectangle that needs an outline to be seen;
 *   - cards at `rounded-2xl` with a hairline border and a two-layer shadow so
 *     soft it reads as depth rather than as a drop shadow;
 *   - a soft tinted rounded square behind every icon, which is what makes a
 *     row of headings scannable;
 *   - one loud element per view — a single solid-blue card carrying the number
 *     that matters — and everything else quiet;
 *   - numbers set large and tight, labels small and muted, so a figure is read
 *     before the word beside it.
 *
 * THE SIDEBAR IS DELIBERATELY NOT HERE. It keeps its own colour; the brief was
 * the cards, the type and the page behind them.
 *
 * Change a weight here and every admin screen moves together — which is the
 * point, and is what stopped being true when a dozen screens each held their
 * own copy of a card.
 */

// ---------------------------------------------------------------- foundations

/**
 * The page behind the cards.
 *
 * `slate-50` and not white: a white card on a white page has to be outlined to
 * exist, and an outline is a heavier, busier thing than the shadow that
 * replaces it here.
 */
/*
 * White, because the admin area is a white-theme product: the card is defined
 * by its border and its shadow rather than by contrast against a tinted page.
 * The earlier `slate-100/70` was worse than a tint — being translucent, it let
 * whatever the body painted show through and the admin screens picked up a
 * lavender wash nobody had chosen.
 */
export const ADMIN_BG = 'bg-white';

/**
 * The card.
 *
 * TWO SHADOW LAYERS, not one — a tight dark one for the contact edge and a
 * wider soft one for the lift. A single `shadow-md` at this radius reads as a
 * box that has come unstuck from the page.
 *
 * THE FIRST VERSION OF THIS WAS TOO FAINT. At 4% and 6% on a `slate-50` page,
 * the card and the page were within a few percent of each other and the whole
 * screen read as one flat wash — every panel present but none of them raised,
 * which is exactly the "looks light" complaint. The numbers here are roughly
 * doubled and the border is at full opacity, so a card is a surface sitting ON
 * the page rather than a rectangle drawn on it.
 *
 * Still nowhere near `shadow-xl`: the aim is depth an eye reads without
 * noticing, not a drop shadow it notices instead of the content.
 */
/*
 * The BUSINESS area's card, to the pixel.
 *
 * Same radius, same hairline, and the same two-layer shadow that `BusinessUI`
 * defines — a tight contact edge plus a wide, soft lift. The admin card was
 * carrying its own slightly flatter pair, so an administrator moving between
 * the two halves of the product met two different surfaces for the same idea.
 */
export const ADMIN_CARD =
    'bg-white border border-slate-200 rounded-2xl '
    + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]';

/** The same card, lifting on hover — for a card that is also a link. */
export const ADMIN_CARD_HOVER =
    ADMIN_CARD
    + ' transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300'
    + ' hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.12),0_16px_32px_-8px_rgba(16,24,40,0.16)]';

/**
 * The content column: the business area's padding, and CENTRED.
 *
 * `mx-auto w-full` is the fix for a real misalignment rather than a preference.
 * This was `p-6 space-y-6 max-w-[90rem]` — a cap with no centring — so once the
 * pane was wider than 1440px the content stayed pinned to the left and the
 * surplus piled up on the right: measured at 1920px, 48px of padding on one
 * side and 167px of dead space on the other. It reads as a page that has come
 * loose from its own rail.
 *
 * THE CAP IS ON THE CHILDREN, NOT ON THE PANE. `max-w-[90rem] mx-auto` written
 * on the scroll container itself does centre the content — and it drags the
 * container's SCROLL BAR in with it, so on a wide display the bar floats ~80px
 * short of the window edge with a strip of page beside it. `[&>*]` puts the cap
 * on each direct child instead: the pane stays full width, its scroll bar stays
 * where a scroll bar belongs, and every card is centred on one column.
 *
 * The padding is `p-4 sm:p-5 lg:p-8` — the business shell's, so the admin area
 * and the business area indent by the same amount at the same breakpoints.
 */
export const ADMIN_PAGE =
    'p-4 sm:p-5 lg:p-8 space-y-6 w-full [&>*]:max-w-[90rem] [&>*]:mx-auto';

/**
 * The same width and centring, for anything that sits OUTSIDE the scrolling
 * pane and still has to line up with it — the page header, chiefly.
 *
 * Without it the heading starts at the pane's padding edge while the first card
 * starts wherever the centred column begins, so on a wide display the title
 * hangs ~44px to the left of everything beneath it. The business shell has that
 * mismatch; there is no reason to copy it.
 */
export const ADMIN_COLUMN = 'max-w-[90rem] mx-auto w-full';

/** The registration forms' input, to the pixel. */
/*
 * `h-12` and `text-[1.25rem]`, not `h-11` and `text-[1.1875rem]`.
 *
 * The business forms set every label at 16px and every control to match; the
 * admin area was a step down throughout, which is what made these screens read
 * as the thinner, less finished half of the same product. 16px is also the size
 * below which mobile Safari zooms the viewport on focus.
 */
export const ADMIN_INPUT =
    'h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-[1.25rem] text-slate-900 '
    + 'outline-none transition-colors placeholder:text-slate-400 '
    + 'focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 '
    + 'disabled:bg-slate-50 disabled:text-slate-400';

/* `h-12` / `text-[1.25rem]` / `font-bold`, in step with the input above. */
export const ADMIN_PRIMARY_BTN =
    'inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-blue-600 '
    + 'text-[1.25rem] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 '
    + 'disabled:opacity-60 whitespace-nowrap';

export const ADMIN_SECONDARY_BTN =
    'inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border border-slate-200 '
    + 'bg-white text-[1.25rem] font-bold text-slate-700 shadow-sm transition-colors '
    + 'hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap';

/**
 * Money, as the admin area prints it: `₹10,000`.
 *
 * ONE FORMATTER, because there were three and they did not agree. Membership
 * printed `₹10,000`, the booking screens printed `Rs. 2,000`, and once the
 * Bookings section grew a list page above its detail page the SAME booking was
 * shown as `₹2,000` on one screen and `Rs. 2,000` on the next — which reads as
 * two different figures to anyone not looking closely, on the two screens an
 * organiser moves between most.
 *
 * `₹` and not `Rs.`: it is what the rest of the product uses, what the public
 * site uses, and what the membership prices — the other money in this area —
 * have always used.
 *
 * `en-IN` grouping, which puts the separators where an Indian reader expects
 * them: 10,00,000 rather than 1,000,000.
 */
export const rupees = (value: number) =>
    '₹' + Number(value || 0).toLocaleString('en-IN');

/** The tinted square behind an icon. Quiet fill, saturated glyph. */
const TILE: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
};

export function AdminIconTile({ tone = 'blue', children, size = 'md' }: {
    tone?: keyof typeof TILE | string;
    children: ReactNode;
    size?: 'sm' | 'md';
}) {
    return (
        <span className={`${size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl flex items-center
                          justify-center shrink-0 ${TILE[tone] || TILE.blue}`}>
            {children}
        </span>
    );
}

// ---------------------------------------------------------------- surfaces

export function AdminCard({
    icon,
    title,
    subtitle,
    actions,
    tone = 'blue',
    children,
    flush = false,
}: {
    icon?: ReactNode;
    title?: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    tone?: string;
    children?: ReactNode;
    /** For a card whose body is a table or list that should meet the edges. */
    flush?: boolean;
}) {
    const warning = tone === 'amber';

    return (
        <section className={warning
            ? 'bg-amber-50 border border-amber-200 rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
            : ADMIN_CARD}>
            {(title || actions) && (
                <header className={`flex flex-wrap items-start gap-3 p-6 ${children ? 'pb-0' : ''} ${
                    flush ? 'border-b border-slate-100 pb-5' : ''
                }`}>
                    {icon && <AdminIconTile tone={tone}>{icon}</AdminIconTile>}
                    <div className="min-w-0 flex-1">
                        {title && (
                            /* `text-[1.625rem] font-extrabold` — `BusinessUI`'s
                               `SectionHeading`, so a card heading is the same
                               size and weight on both sides of the product. */
                            <h2 className={`${CARD_TITLE} ${
                                warning ? 'text-amber-900' : 'text-slate-900'
                            }`}>
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className={`${CARD_SUBTITLE} mt-1.5 ${
                                warning ? 'text-amber-800' : 'text-slate-500'
                            }`}>
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {actions && <div className="shrink-0">{actions}</div>}
                </header>
            )}
            {children && <div className={flush ? '' : 'p-6'}>{children}</div>}
        </section>
    );
}

/**
 * The way back, on every admin screen that is not the tier's landing page.
 *
 * The rail is a way SIDEWAYS — it moves between the six sections and says
 * nothing about where you have just been. Once a screen is opened from
 * somewhere else (Hub → a region → an application, Admins → an editor, a
 * mobile drawer entry) there was nothing on the page to retrace that step, so
 * the only way back on a phone — where the rail is behind a hamburger — was the
 * browser's own chrome.
 *
 * `navigate(-1)` when there IS somewhere to go back to, and the tier's landing
 * page otherwise. React Router keeps an `idx` on `history.state`; at `idx` 0
 * this tab has no earlier entry, and `-1` there leaves the admin sitting on the
 * same screen having pressed a button that did nothing. Deep-linked and
 * newly-opened tabs get a real destination instead.
 *
 * Hidden on the landing page itself, where "back" out of the product is not a
 * thing to offer.
 */
export function AdminBackButton({ to }: { to?: string }) {
    const navigate = useNavigate();
    const location = useLocation();

    const role = (typeof window !== 'undefined' ? localStorage.getItem('role') : '') || '';
    const home = TIERS[tierForRole(role)].nav[0].to;

    if (!to && location.pathname === home) return null;

    const back = () => {
        const idx = (typeof window !== 'undefined'
            ? (window.history.state as { idx?: number } | null)?.idx
            : 0) || 0;
        if (to) navigate(to);
        else if (idx > 0) navigate(-1);
        else navigate(home);
    };

    return (
        <button
            type="button"
            onClick={back}
            aria-label="Back"
            title="Back"
            className="shrink-0 w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center shadow-sm active:scale-90
                       text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>
    );
}

/**
 * The page banner.
 *
 * `flex-wrap` on the row and `min-w-0` on the text: the action button used to be
 * pushed off the right edge on a narrow window, and the page — which has no
 * horizontal scroll — simply clipped it.
 */
export function AdminPageHeader({
    title,
    subtitle,
    actions,
    onMenu,
    back = true,
    backTo,
}: {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
    onMenu?: () => void;
    /** False on a screen that IS the landing page for its tier. */
    back?: boolean;
    /** A fixed destination instead of retracing history. */
    backTo?: string;
}) {
    return (
        /*
         * STACKED ON A PHONE, ONE ROW FROM `sm`.
         *
         * `flex-wrap` alone will not do it. The title block is `flex-1`, so it
         * shrinks to make room for the action rather than pushing it onto a
         * second line — which is how "Membership Plans" ended up wrapping over
         * two lines with its explanation squeezed into a 150px column beside an
         * "Add plan" button. At this width the heading gets the whole bar and
         * the action goes underneath it, full width, where a thumb reaches it.
         */
        <header className="bg-white border-b border-slate-200 px-4 sm:px-5 lg:px-8 py-4 sm:py-5">
          {/*
            * The header's CONTENTS are centred on the same column as the cards
            * below it — see `ADMIN_COLUMN`. The bar itself stays full-bleed so
            * its bottom rule still runs the width of the pane.
            */}
          <div className={`${ADMIN_COLUMN} flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`}>
            {/* On a phone the menu and back tiles are their own row and the
                title takes the full width under them; beside the title they
                squeezed it and its explanation into a narrow column. */}
            <div className="flex flex-col gap-3 min-w-0 sm:flex-row sm:items-start sm:gap-2.5 sm:flex-1">
              {(onMenu || back) && (
              <div className="flex shrink-0 items-center gap-2">
                {onMenu && (
                    /* THE MENU TILE — the same three-bar mark the public site's
                       header uses, in a 40px tile a thumb cannot miss. It was a
                       bare 20px icon floating in the corner. */
                    <button
                        type="button"
                        className="lg:hidden shrink-0 grid h-10 w-10 place-items-center rounded-xl border
                                   border-slate-200 bg-slate-50 text-slate-700 shadow-sm transition
                                   hover:bg-slate-100 active:scale-90"
                        onClick={onMenu}
                        aria-label="Open menu"
                    >
                        <span aria-hidden="true" className="flex w-5 flex-col gap-[4px]">
                            <span className="h-[2px] w-5 rounded-full bg-current" />
                            <span className="h-[2px] w-3.5 rounded-full bg-current" />
                            <span className="h-[2px] w-4 rounded-full bg-current" />
                        </span>
                    </button>
                )}
                {back && (
                    <div className="shrink-0">
                        <AdminBackButton to={backTo} />
                    </div>
                )}
              </div>
              )}
                <div className="min-w-0">
                    {/* `font-extrabold` at 26px — the business shell's own
                        heading, so the two halves of the product open with the
                        same voice. It was `font-bold` at 28px, which is larger
                        and lighter: bigger without reading as more important. */}
                    <h1 className={`${PAGE_TITLE} text-slate-900`}>
                        {title}
                    </h1>
                    {subtitle && (
                        <p className={`${PAGE_SUBTITLE} text-slate-500 mt-1`}>{subtitle}</p>
                    )}
                </div>
            </div>
            {actions && (
                /* Each action fills the row on a phone and sizes to its label
                   from `sm` — a 48px-tall button the width of the screen is the
                   one shape a thumb never misses. */
                <div className="flex flex-wrap gap-2 shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{actions}</div>
            )}
          </div>
        </header>
    );
}

/**
 * A headline figure.
 *
 * ONE OF THESE IS `primary` PER VIEW, AND ONLY ONE. The solid fill is the
 * loudest thing on the page, and its whole job is to say which number to read
 * first; a row of four of them says nothing at all. The rest are white and
 * quiet, and the eye lands on the blue one.
 *
 * The number is set at `text-[2.5625rem]` with tight tracking above a small muted label,
 * rather than the other way round, because a stat card is read as a figure that
 * happens to be labelled and not as a label that happens to have a figure.
 */
export function AdminStat({
    icon,
    label,
    hint,
    value,
    tone = 'blue',
    primary = false,
    footer,
    onClick,
}: {
    icon?: ReactNode;
    label: string;
    hint?: string;
    value: ReactNode;
    tone?: string;
    primary?: boolean;
    /** The action line along the bottom — text only; the arrow is drawn here. */
    footer?: string;
    onClick?: () => void;
}) {
    const interactive = !!onClick;

    const body = (
        <>
            <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-3">
                {icon && (
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        primary ? 'bg-white/20 text-white' : (TILE[tone] || TILE.blue)
                    }`}>
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <p className={`text-[1.05rem] sm:text-[1.25rem] font-extrabold tracking-tight leading-snug ${
                        primary ? 'text-white' : 'text-slate-900'
                    }`}>
                        {label}
                    </p>
                    {hint && (
                        <p className={`text-[0.95rem] sm:text-[1.1875rem] mt-1 leading-snug ${
                            primary ? 'text-blue-100' : 'text-slate-500'
                        }`}>
                            {hint}
                        </p>
                    )}
                </div>
            </div>

            {/*
              * `text-[2.5625rem] sm:text-[3.375rem] font-extrabold` — the business area's stat
              * tile, one step up from what this was.
              *
              * A stat card is read as a figure that happens to be labelled, not
              * as a label that happens to have a figure, so the number is the
              * thing that has to carry across a room. `tabular-nums` keeps a
              * column of them aligned on the digit rather than on the glyph.
              */}
            {/*
              * `mt-auto`, NOT a fixed `mt-5`.
              *
              * A row of these is a grid, so every card is the height of the
              * tallest — but the figure was placed a fixed distance below its
              * label, so a card WITHOUT a hint line sat its number ~20px higher
              * than the card beside it. Four stat cards with their numbers on
              * two different baselines reads as a rendering fault, and it only
              * shows up when some of the row has a hint and some does not,
              * which is most of the time.
              *
              * `mt-auto` pushes the figure to the bottom of whatever height the
              * grid settled on, so the row aligns whether or not each card was
              * given a second line.
              */}
            <p className={`mt-auto pt-5 text-[2.5625rem] sm:text-[3.375rem] font-extrabold tracking-tight tabular-nums ${
                primary ? 'text-white' : 'text-slate-900'
            }`}>
                {value}
            </p>

            {footer && (
                <span className={`mt-5 pt-4 flex items-center justify-between text-[1.25rem] font-bold border-t ${
                    primary
                        ? 'border-white/25 text-white'
                        : 'border-slate-100 text-slate-700 group-hover:text-blue-600'
                }`}>
                    {footer}
                    <ArrowRight className="w-4 h-4 shrink-0" />
                </span>
            )}
        </>
    );

    const shell = `group flex flex-col p-5 sm:p-6 text-left w-full min-w-0 ${
        primary
            ? 'rounded-2xl bg-blue-600 shadow-[0_10px_28px_-6px_rgba(37,99,235,0.55)]'
            : (interactive ? ADMIN_CARD_HOVER : ADMIN_CARD)
    } ${interactive ? 'cursor-pointer' : ''}`;

    return interactive
        ? <button type="button" onClick={onClick} className={shell}>{body}</button>
        : <div className={shell}>{body}</div>;
}

/**
 * A pill toggle — "This week / This month".
 *
 * An inset track with the active option raised out of it in solid blue. Options
 * are data rather than children so the group can own its own semantics; see
 * `CmsChoice` for the same argument made at length.
 */
export function AdminSegmented<T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
    label?: string;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1"
        >
            {options.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={`rounded-full px-4 h-9 text-[1.1875rem] font-semibold transition-colors ${
                            active
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

/** `FormField` from the registration shell: bold label, hint underneath. */
export function AdminField({
    label,
    hint,
    full,
    required,
    children,
}: {
    label: string;
    hint?: ReactNode;
    full?: boolean;
    required?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={`min-w-0 ${full ? 'sm:col-span-2' : ''}`}>
            <label className="block text-[1.1875rem] font-semibold text-slate-700 mb-2">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {hint && <p className="text-[1.0625rem] text-slate-500 mt-1.5">{hint}</p>}
        </div>
    );
}
