import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import BackArrow from '@/components/shared/BackArrow';
import { EYEBROW } from '@/components/layout/typography';

const ACTIV_LOGO = '/logo_ACTIVian-removebg-preview.png';

/**
 * The shell both auth screens stand in — sign in and register.
 *
 * =========================================================================
 * ONE SHELL, TWO SCREENS, BECAUSE THEY HAD ALREADY DRIFTED
 * =========================================================================
 *
 * Login and Register each carried their own copy of the split: the same
 * gradient, the same mark, the same "hidden md:flex md:w-1/2", written twice.
 * They were already a shade apart — one ran `from-blue-500 … to-blue-700` and
 * the other `to-blue-800` — and every fix to one left the other behind. This
 * is that layout, once.
 *
 * --------------------------------------------------------------- the brand
 *
 * The panel keeps the LIGHT BLUE GRADIENT the two sign-in screens have always
 * had. It was briefly repainted `brand-900` to match the site's navy header,
 * and the association asked for the blue back — it is the colour people who
 * use this platform associate with signing in, and a brand rule is not worth
 * changing the one screen everybody sees first.
 *
 * Everything else here IS the site's own: the concentric rings and the
 * drifting blooms from `AboutBlock` and `MissionCarousel`, and the type scale
 * from `typography.ts`. The blooms are white at 10% rather than brand-tinted,
 * because a navy bloom on this blue is a smudge rather than a light.
 *
 * ------------------------------------------------------------ the geometry
 *
 * `lg`, not `md`, for the split. At 768px each half is 384px, and a form
 * column that narrow puts a label, a 48px field and a two-line hint into a
 * space with no margins left — the panel is hidden below `lg` and the form
 * gets the whole screen.
 *
 * `my-auto` on the form column, never `items-center`: when the form is taller
 * than the window, centring pushes its top off screen where no amount of
 * scrolling reaches it. Auto margins centre when there is room and collapse
 * when there is not.
 */

interface Props {
    /** The eyebrow over the panel headline — "ACTIV MEMBER PORTAL". */
    eyebrow: string;
    /** Two lines, as the reference has it: a greeting and the point. */
    headline: React.ReactNode;
    /** The association's line under the headline, set in italics. */
    quote?: string;
    /** The paragraph under it. */
    lede: string;
    /** The small label above the form's own heading. */
    formEyebrow: string;
    /** The form's heading. */
    title: string;
    /** One sentence under the title. */
    subtitle: string;
    /** The line under the submit button, beside a shield. */
    assurance?: string;
    /**
     * How the form is presented.
     *
     * `plain` — sign-in: the fields sit straight on the white column, which
     * is what that screen was designed around and what the association kept.
     * `card` — register: the long two-step form stands on a white card over
     * the site's tint, the way it did before this shell existed and the way
     * every other long form in the product does.
     *
     * One prop rather than two components: everything else about the two
     * screens is identical, and a fork here is how they drifted last time.
     */
    surface?: 'plain' | 'card';
    children: React.ReactNode;
}

export default function AuthSplitLayout({
    eyebrow, headline, quote, lede, formEyebrow, title, subtitle,
    assurance = 'Your details are sent over a secure connection.',
    surface = 'plain',
    children,
}: Props) {
    const carded = surface === 'card';
    return (
        <div className="flex min-h-screen flex-col bg-white font-sans lg:flex-row">

            {/* ============================================ the brand panel */}
            {/*
              THE GREETING FOLLOWS THE MARK, and the copyright is pushed to the
              floor on its own (`mt-auto`). With `justify-between` the three
              blocks were spread over the full height, which on a 900px window
              left a third of the panel empty between the logo and the
              headline — read as a gap where something had failed to render.
            */}
            {/*
              THE PANEL TAKES 58%, NOT HALF.

              A 50/50 split put the form in a 960px column with 200px of white
              down each side of it, which reads as a form that has slipped off
              centre rather than as a column. The reference runs its panel at
              about 60% and its form in the remainder, and the proportion is
              what makes the two halves read as one composition: the blue is
              the picture, the white is the work.
            */}
            <aside className="relative hidden w-[58%] flex-col overflow-hidden
                              bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700
                              p-10 text-white lg:flex xl:p-14">

                {/* Two out-of-focus blooms on different clocks, and the
                    concentric rings from the About block. Decorative: no text,
                    nothing to read, `aria-hidden`. */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-activ-float-slow" />
                    <div className="absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl animate-activ-float" />
                    <svg
                        /* The rings are the effect the association picked out
                           of this panel, so they are drawn a little stronger on
                           the blue than they were on the navy — at 0.18 they
                           were almost gone against a lighter field. */
                        className="absolute -right-24 top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 opacity-30
                                   animate-activ-orbit origin-center"
                        viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle cx="250" cy="250" r="150" stroke="white" strokeWidth="1" />
                        <circle cx="250" cy="250" r="210" stroke="white" strokeWidth="1" />
                        <circle cx="250" cy="250" r="180" stroke="white" strokeWidth="1" strokeDasharray="4 4" />
                    </svg>
                    {/* A second set on the reverse clock, low and left, so the
                        panel is never quite static and the two never line up.
                        `AboutBlock` runs the same pair for the same reason. */}
                    <svg
                        className="absolute -bottom-40 -left-32 h-[30rem] w-[30rem] opacity-20
                                   animate-activ-orbit-reverse origin-center"
                        viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle cx="250" cy="250" r="170" stroke="white" strokeWidth="1" />
                        <circle cx="250" cy="250" r="230" stroke="white" strokeWidth="1" strokeDasharray="6 6" />
                    </svg>
                </div>

                {/* ---- the mark ---- */}
                <Link to="/" className="relative z-10 inline-flex items-center gap-4" aria-label="ACTIV home">
                    <img
                        src={ACTIV_LOGO}
                        alt="ACTIV"
                        className="h-14 w-auto object-contain brightness-0 invert"
                    />
                    <span className="max-w-[14rem] text-[0.8125rem] font-bold uppercase leading-[1.35]
                                     tracking-[0.06em] text-white/70">
                        Adidravidar Confederation of Trade and Industrial Vision
                    </span>
                </Link>

                {/* ---- the greeting ---- */}
                <div className="relative z-10 mt-14 xl:mt-20">
                    <div className="mb-6 flex items-center gap-4">
                        <span aria-hidden="true" className="h-px w-10 bg-white/40" />
                        <span className={`${EYEBROW} text-white/70`}>{eyebrow}</span>
                    </div>

                    <h1 className="text-[3rem] font-extrabold leading-[1.03] tracking-tight xl:text-[4rem]">
                        {headline}
                    </h1>

                    {quote && (
                        <p className="mt-5 max-w-xl text-[1.375rem] font-medium italic leading-snug text-white/85">
                            {quote}
                        </p>
                    )}

                    <p className="mt-6 max-w-xl text-[1.1875rem] font-medium leading-relaxed text-white/75">
                        {lede}
                    </p>
                </div>

                <p className="relative z-10 mt-auto pt-12 text-[0.9375rem] font-medium text-white/50">
                    © {new Date().getFullYear()} ACTIV. All rights reserved.
                </p>
            </aside>

            {/* ============================================== the form column */}
            {/* The tint comes with the card: a white card on a white column
                has only a hairline to say where it is. The plain surface keeps
                the white column it was designed on. */}
            <main
                className={`relative flex flex-1 flex-col overflow-auto p-6 sm:p-10
                            ${carded ? 'bg-[#f3f6fb]' : 'bg-white'}`}
            >
                {/*
                  THE WAY OUT, at the top of the white column.

                  `useHistory={false}` because of who lands here: a visitor
                  whose session expired arrives with the page that bounced them
                  still in history, so "back" would return them to a screen that
                  immediately sends them here again.
                */}
                <BackArrow shape="link" useHistory={false} fallback="/" />

                {/*
                  `34rem`, not `28rem`. In the right half of a 1920px display a
                  448px form leaves 250px of white down each side of it and
                  reads as a column that has slipped off centre; the reference
                  runs its form at about 540px for the same reason.
                */}
                <div className="mx-auto my-auto w-full max-w-[32rem] py-6">

                    {/*
                      THE MARK STANDS OVER THE FORM AT EVERY WIDTH.

                      It used to be `lg:hidden` — drawn only where the blue
                      panel is not — on the reasoning that one mark per screen
                      is enough. The reference puts it over the form as well,
                      and it is right to: the panel is decoration a reader's
                      eye leaves immediately, and the half they are typing into
                      carried nothing saying whose sign-in this is.
                    */}
                    {/* CENTRED ON BOTH SCREENS. The mark is the one element
                        that belongs to the page rather than to the form, and a
                        centred header over a centred mark is what makes the
                        column read as a column — including on the register
                        screen, where it sits over the card. */}
                    {/*
                      THE MARK ITSELF IS ON THE CENTRE LINE.

                      Side by side with the lockup, the PAIR was centred and
                      the mark therefore sat left of centre — which is what
                      reads as a logo that has slipped. Stacked, the mark is
                      the thing that lines up with the heading and the card
                      below it, and the lockup is a caption under it.
                    */}
                    <Link
                        to="/"
                        aria-label="ACTIV home"
                        className="mx-auto mb-8 flex flex-col items-center gap-2.5"
                    >
                        {/* THE MARK ALONE. The full name is set twice the size
                            on the panel beside this, and repeating it here in
                            10px grey was a second, quieter copy of something
                            already said — and the thing that stopped the logo
                            sitting on the column's centre line. */}
                        <img src={ACTIV_LOGO} alt="ACTIV" className="h-14 w-auto object-contain" />
                    </Link>

                    {/* The heading stands ABOVE the card, as the register
                        screen has always had it — the card holds the form, and
                        a heading inside it would put the step title and the
                        first label in the same box. */}
                    <div className="text-center">
                    <p className={`${EYEBROW} mb-3 text-brand-600`}>{formEyebrow}</p>

                    <h2 className="text-[3rem] font-bold leading-[1.05] tracking-tight text-slate-900">
                        {title}
                    </h2>

                    {subtitle && (
                        <p className="mt-4 text-[1.3125rem] font-medium leading-relaxed text-slate-500">
                            {subtitle}
                        </p>
                    )}
                    </div>

                    <div
                        className={carded
                            ? `mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8
                               shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]`
                            : 'mt-9'}
                    >
                        {children}
                    </div>

                    {assurance && (
                        <p className="mt-7 flex items-center justify-center gap-2 text-[1.0625rem]
                                      font-medium text-slate-400">
                            <ShieldCheck size={16} className="shrink-0" />
                            {assurance}
                        </p>
                    )}
                </div>
            </main>
        </div>
    );
}
