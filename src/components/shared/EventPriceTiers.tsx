import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

/**
 * What an event costs, and what a membership takes off it.
 *
 * =========================================================================
 * TWO PRICES, SIDE BY SIDE, AND A WAY TO GET THE LOWER ONE
 * =========================================================================
 *
 * The Super Admin sets two figures on an event: what anybody pays, and what an
 * ACTIV member pays. Both come from the server and both are shown, always, to
 * everybody. The panel exists to make one argument — that the gap between them
 * is worth joining for — and a person deciding whether to book is the best
 * audience the association will ever have for it: already interested in the
 * programme, already about to pay, and the membership pays for itself on the
 * spot.
 *
 * ------------------------------------------- WHAT THE STANDARD PRICE IS NOT
 *
 * IT IS NOT STRUCK THROUGH, and it is not greyed out. A struck price is the
 * language of a shop saying "this was the price and is not any more" — it reads
 * as withdrawn, and what this panel needs is for both numbers to be live and
 * comparable, because the comparison is the whole offer. A reader has to be able
 * to look at ₹2,000 and ₹1,500 as two real prices they are choosing between.
 *
 * The member column is headed "MEMBERS PRICE" for the same reason. It was
 * "Your price" for a signed-in member, which turns the offer into a receipt: it
 * stops describing what membership is worth and starts describing what this
 * particular reader owes.
 *
 * ---------------------------------------------------------------- the button
 *
 * A number a reader cannot act on is a fact, not an offer, so the saving is
 * also a button: "Become an ACTIV member · Save ₹500", going to registration.
 * The page to come back to travels in the history entry's state rather than the
 * address, so the URL stays a plain `/register`.
 *
 * EVERY READER GETS THAT BUTTON, a signed-in member included. It was withheld
 * from them at first — they cannot join twice — and the association asked for
 * it to be shown to everybody. A member is not misled by it: the green line
 * directly above says their price is already applied and what it saved them,
 * which is also the cheapest renewal notice an association will ever send.
 *
 * ------------------------------------------------------- two shapes, not more
 *
 *   no member rate   one price, plainly. Inventing a "standard/member" split
 *                    where the organiser set no member fee would advertise a
 *                    discount that does not exist.
 *   a member rate    both columns, the saving named in rupees and per cent, and
 *                    the button or the confirmation under them.
 *
 * ------------------------------------------------------------------ one copy
 *
 * Rendered by the public event page and the public booking page. Each had its
 * own arrangement of the same two numbers, which is how they ended up
 * disagreeing about whether to write `₹` or `Rs.`
 */

export interface EventPriceTiersProps {
    /** The common price, in rupees. `0` is a free event. */
    price: number;
    /** What a member with an active membership pays. */
    memberPrice?: number;
    /** Whether a real member rate exists — a lower number, deliberately set. */
    hasMemberRate?: boolean;
    /** Whether THIS reader is already getting it. */
    memberRateApplies?: boolean;
    /** How many seats, so the saving can be quoted for the whole booking. */
    seats?: number;
    /** `panel` leads a sidebar; `inline` sits inside a total row. */
    variant?: 'panel' | 'inline';
    /**
     * Where "become a member" goes. `/register` unless overridden.
     *
     * The page to come back to is NOT put in the address. It travels in the
     * history entry's state, so the member sees, copies and bookmarks a plain
     * `/register`.
     */
    joinHref?: string;
}

const rupees = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function EventPriceTiers({
    price,
    memberPrice = 0,
    hasMemberRate = false,
    memberRateApplies = false,
    seats = 1,
    variant = 'panel',
    joinHref,
}: EventPriceTiersProps) {
    /*
     * `useLocation` and not `window.location`: inside the router this is the
     * route actually being rendered, and it re-reads on navigation. Reading the
     * browser's copy would bake in whichever URL was current when the component
     * first mounted.
     */
    const location = useLocation();
    const backHere = `${location.pathname}${location.search || ''}`;
    const standard = Math.max(0, Number(price) || 0);
    const member = Math.max(0, Number(memberPrice) || 0);

    /*
     * The rate is only "real" if it is actually lower. An organiser who typed
     * the same number in both boxes has not made an offer, and a 0% saving
     * badge is worse than no badge.
     */
    const real = hasMemberRate && member < standard && standard > 0;
    const saving = real ? standard - member : 0;
    const percent = real ? Math.round((saving / standard) * 100) : 0;
    const bookingSaving = saving * Math.max(1, seats);

    /* ---------------------------------------------- free, or one price only */

    if (!real) {
        return (
            <div className={variant === 'panel'
                ? 'mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5'
                : ''}>
                {variant === 'panel' && (
                    <p className="text-[0.9375rem] font-extrabold uppercase tracking-widest text-slate-500">
                        You pay
                    </p>
                )}
                <span className={`${variant === 'panel' ? 'mt-1 inline-block ' : ''}text-[2.0625rem] font-black leading-none tracking-tight text-slate-900 tabular-nums`}>
                    {standard > 0 ? rupees(standard) : 'Free'}
                </span>
                {standard > 0 && (
                    <span className="ml-2 text-[1.1875rem] font-semibold text-slate-500">
                        per seat
                    </span>
                )}
            </div>
        );
    }

    /* ------------------------------------------------------------ both tiers */

    return (
        <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white
                         ${variant === 'panel' ? 'mt-5' : ''}`}>

            {/*
              * -------------------------------------------------- THE TWO COLUMNS
              *
              * EQUAL WEIGHT, AND NO STRIKE. Both are prices somebody can pay
              * today; the member column is tinted because it is the one being
              * argued for, not because the other has been withdrawn.
              *
              * THE SAVING LIVES IN THE COLUMN IT BELONGS TO. It was a pill in
              * the column's top corner first, where at sidebar width it covered
              * that column's own heading and clipped it to "MEMBERS P"; then a
              * full-width strip of its own, which left the card as four stacked
              * bands of four different colours reading top to bottom like a set
              * of traffic lights. Under the price, inside the tint, it is beside
              * the number it is the difference of and costs the card no band.
              *
              * `items-stretch` and the matching empty slot in the Standard
              * column are what keep the two sides level: without them the tinted
              * half is one chip taller than the white half and the card has a
              * step in its bottom edge.
              */}
            <div className="grid grid-cols-2 items-stretch">
                <div className="flex flex-col border-r border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                    <p className="text-[0.9375rem] font-extrabold uppercase tracking-widest
                                  text-slate-500">
                        Standard
                    </p>
                    <p className="mt-2 text-[2.0625rem] font-black leading-none tracking-tight
                                  text-slate-900 tabular-nums">
                        {rupees(standard)}
                    </p>
                    <p className="mt-1.5 text-[1.1875rem] font-semibold text-slate-500">per seat</p>
                    {/* The Standard column's half of the chip row — see above. */}
                    <span aria-hidden="true" className="mt-3 block h-[1.375rem]" />
                </div>

                <div className="flex flex-col bg-emerald-50 px-4 py-4 sm:px-5">
                    <p className="text-[0.9375rem] font-extrabold uppercase tracking-widest
                                  text-emerald-700">
                        Members price
                    </p>
                    <p className="mt-2 text-[2.0625rem] font-black leading-none tracking-tight
                                  text-emerald-700 tabular-nums">
                        {rupees(member)}
                    </p>
                    <p className="mt-1.5 text-[1.1875rem] font-semibold text-emerald-700/80">
                        per seat
                    </p>
                    <span className="mt-3 inline-flex h-[1.375rem] w-fit items-center gap-1
                                     rounded-full bg-emerald-600 px-2.5 text-[0.8125rem]
                                     font-extrabold uppercase tracking-wide text-white">
                        Save {rupees(saving)} · {percent}%
                    </span>
                </div>
            </div>

            {/*
              * ------------------------------------------- WHERE A MEMBER STANDS
              *
              * Only for somebody already getting the lower price, and only as a
              * statement of fact: the member rate is on this booking and this is
              * what it took off. It sits ABOVE the button rather than in place
              * of it — see the note on the button itself.
              *
              * A TINT, NOT A SOLID BAR. Solid emerald directly over solid navy
              * put two saturated blocks against each other at the foot of the
              * card and made the line compete with the button for the eye. The
              * tint reads as part of the prices above it, which is what it is.
              */}
            {memberRateApplies && (
                <p className="flex items-center justify-center gap-2 border-t border-emerald-100
                              bg-emerald-50/80 px-4 py-2.5 text-center text-[1.0625rem]
                              font-bold text-emerald-800 sm:px-5">
                    <Check size={16} className="shrink-0" />
                    Members price applied — you save {rupees(bookingSaving)}
                    {seats > 1 ? ` on these ${seats} seats` : ''}
                </p>
            )}

            {/*
              * ------------------------------------- THE BUTTON, FOR EVERY READER
              *
              * It used to be withheld from a signed-in member, on the reasoning
              * that somebody who has joined cannot join again and would read the
              * invitation as the site not knowing who they are. The association
              * asked for it to be shown to everybody, and the reasoning cuts the
              * other way too: this panel is the association's best-placed
              * argument for membership, and an editor, an officer or a lapsed
              * member looking at an event page is exactly who it is for. A
              * member also sees the green line above, so nothing here tells them
              * their own price is anything other than applied.
              *
              * THE FULL WIDTH OF THE PANEL, in the association's navy. The offer
              * was a tinted row of text before, which reads as a caption on the
              * prices rather than as the thing to press — and what this panel is
              * for is that press.
              */}
            <Link
                to={joinHref || '/register'}
                /* The way back, off the address bar. See the prop's note. */
                state={{ from: backHere }}
                className="group flex w-full items-center justify-between gap-3 bg-brand-800
                           px-4 py-3.5 text-white transition-colors hover:bg-brand-700
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-brand-400 sm:px-5"
            >
                <span className="flex items-center gap-2.5 text-left">
                    <Sparkles size={18} className="shrink-0 text-amber-300" />
                    <span>
                        <span className="block text-[1.125rem] font-black leading-tight">
                            Become an ACTIV member
                        </span>
                        <span className="block text-[1rem] font-semibold text-brand-100">
                            Save {rupees(bookingSaving)}
                            {seats > 1 ? ` on these ${seats} seats` : ' on this booking'}
                        </span>
                    </span>
                </span>
                <ArrowRight
                    size={18}
                    className="shrink-0 transition-transform duration-300
                               group-hover:translate-x-1"
                />
            </Link>
        </div>
    );
}

export default EventPriceTiers;
