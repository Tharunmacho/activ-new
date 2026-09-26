import api from '@/services/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Calendar, CheckCircle2, IndianRupee, Loader2, Lock, MapPin, Users, UserPlus, AlertCircle, ExternalLink, Eye, EyeOff, Check, Menu, Info, Ticket, User, Mail, Phone, Video,
} from 'lucide-react';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import MemberSidebar from '@/features/member/pages/MemberSidebar';
import MemberTopBar from '@/features/member/components/MemberTopBar';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { sizedMediaUrl } from '@/config/api.config';
import { SECTION_HEADING, MICRO_LABEL } from '@/components/layout/typography';
import { BIZ_CARD_TITLE, BIZ_BADGE, BIZ_FIELD_LABEL } from '@/components/layout/surface';

/**
 * ============================================================================
 * THE GROUND EVERY BOOKING STEP STANDS ON
 * ============================================================================
 *
 * White, and the same on all four steps.
 *
 * They used `SHEET` — `#f3f6fb`, a pale blue-grey. Over the dotted page that
 * reads as a tint rather than as a surface, so the white cards on it looked
 * like outlines drawn over nothing rather than like a form on a document.
 * The association asked for the treatment the business account forms use,
 * which is this one.
 *
 * Defined once, because the failure this replaces was four steps with three
 * different grounds between them.
 */
const BOOKING_SHEET =
    'rounded-[1.75rem] border border-gray-200 bg-white p-4 sm:p-6 lg:p-8 '
    + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-20px_rgba(28,46,104,0.28)]';

/**
 * A block INSIDE that sheet — a bordered panel, and no shadow of its own.
 *
 * `BIZ_CARD` carries a shadow because it is made to sit on a tint. On a white
 * sheet a shadowed white card is a card on a card, which is the same mistake
 * the tint was making, in the other direction.
 */
const BOOKING_PANEL = 'bg-white border border-slate-200 rounded-2xl';
import { errorMessage } from '@/services/api';
import { login } from '@/services/activApi';
import { STORAGE_KEYS } from '@/config/api.config';
import {
    getBookableEvent, bookAndPay, getEventBooking,
    type BookableEvent, type BookingParticipant, type EventBooking,
} from '@/services/eventBookingApi';
import EventPriceTiers from '@/components/shared/EventPriceTiers';
import EventActions from '@/components/shared/EventActions';

/**
 * "Book Now" — the public booking flow, end to end.
 *
 * =========================================================================
 * ONE ROUTE, FOUR STEPS, ONE PIECE OF STATE
 * =========================================================================
 *
 * The reference site puts each step on its own URL. This does not, and the
 * reason is the participant list: it is typed by hand, it can be a dozen rows
 * of three fields, and it exists only in the browser until the booking is
 * taken. Split across four routes it would have to survive navigation — either
 * in a store, in the URL, or in session storage — and every one of those is a
 * way for somebody to land on step three holding half of step two. Held in one
 * component it cannot be half-there: either the page is mounted and the draft
 * is complete, or it is not.
 *
 * The one thing that DOES get its own URL is the confirmation, keyed on the
 * booking reference. A guest has no account and no list of bookings; that URL
 * in their history is the only way back to what they bought.
 *
 *   choice   Guest Member, or Sign In & Checkout
 *   form     who is booking, how many, and who is coming
 *   review   Event / Booking / Participant details, then pay
 *   done     the reference, and what happens next
 *
 * =========================================================================
 * THE TOTAL ON SCREEN IS AN ESTIMATE UNTIL THE SERVER SAYS OTHERWISE
 * =========================================================================
 *
 * `price * count` is computed here to show the visitor what they are about to
 * pay, and NOTHING is sent from this page that could influence the charge —
 * `createEventBooking` takes no amount and there is no parameter for one. The
 * figure that is charged comes back ON the booking, and the review step prints
 * the server's number once it has one. The two agree in every ordinary case;
 * where they could not is if an organiser changed the fee while somebody was
 * typing, and in that case the server's answer is the right one.
 */

/* ------------------------------------------------------------------ shared */

/*
 * WHAT SOMEBODY TYPED IS THE HEAVIEST TEXT ON THE FIELD.
 *
 * It was `text-[1.25rem] font-medium` in the default grey — lighter than the label
 * above it and the hint below, so the one piece of real information in the
 * control was the faintest thing in it. The placeholder stays light, which is
 * what keeps the two distinguishable at a glance.
 */
const INPUT_CLASS =
    /*
     * THE BUSINESS AREA'S FIELD, EXACTLY.
     *
     * `CompanyForm` — the screen a member creates their business account on —
     * sets every control to a slate-50 well inside a slate-200 hairline that
     * turns white on focus, at `text-[1.25rem]`. A white field on a white card has
     * only its border to say it is a field at all; the tinted well says it
     * before the reader looks for the edge, and it is the idiom this product
     * already uses on its longest form.
     */
    'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[1.25rem] ' +
    'font-semibold text-slate-900 hover:border-slate-300 ' +
    'focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-600 focus:border-transparent ' +
    'transition-colors placeholder:font-normal placeholder:text-slate-400 ' +
    'disabled:bg-slate-100 disabled:text-slate-400 ' +
    /*
     * No spinner. The seat box is `type="number"` for the phone keypad it
     * summons, and Chrome repays that by drawing two arrows inside the field —
     * clutter, and a second way to change the number that walks around the
     * digits-only handler.
     */
    '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none ' +
    '[&::-webkit-inner-spin-button]:appearance-none';

/**
 * A FORM LABEL, which is not the same thing as a card caption.
 *
 * These were `MICRO_LABEL` — 11px, and 10px above the `sm` breakpoint, so the
 * labels got smaller as the screen got bigger. At that size the whole form read
 * as annotation. 12px bold, and it does not shrink.
 */
const FIELD_LABEL = BIZ_FIELD_LABEL;

/*
 * The card, its heading and its badge come from `components/layout/surface.ts`
 * now, alongside the sheet they stand on. They were defined here first, and the
 * event detail page needed the same three — a second copy is how two screens
 * that are meant to match stop matching.
 */

const PRIMARY_BUTTON =
    'inline-flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-700 text-white ' +
    'px-8 py-4 rounded-full font-bold text-[1.125rem] uppercase tracking-[0.1em] ' +
    'transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const GHOST_BUTTON =
    'inline-flex items-center justify-center gap-2 border border-brand-200 text-brand-700 ' +
    'hover:bg-brand-50 px-8 py-4 rounded-full font-bold text-[1.125rem] uppercase ' +
    'tracking-[0.1em] transition-colors disabled:opacity-60';


/**
 * WHERE YOU ARE IN THE BOOKING, on every step.
 *
 * The four screens each opened with their own heading and nothing else, so a
 * visitor part-way through had no way to tell how much was left — and the two
 * middle steps ("Book Now", "Review your booking") read as two unrelated
 * pages rather than as one flow. A checkout that does not say how long it is
 * is a checkout people abandon at the first field they did not expect.
 *
 * Drawn, not interactive. A step behind you is settled and a step ahead has
 * no data yet, so neither is a link — the way back is the button at the foot
 * of each step, which also carries what has been typed.
 */
const BOOKING_STEPS = [
    { key: 'choice', label: 'How to book' },
    { key: 'form', label: 'Your details' },
    { key: 'review', label: 'Review' },
    { key: 'done', label: 'Confirmed' },
] as const;

function BookingSteps({ current }: { current: Step }) {
    const index = BOOKING_STEPS.findIndex((s) => s.key === current);

    return (
        <ol
            className="mx-auto mb-7 flex w-full max-w-3xl items-center gap-2 sm:gap-3"
            aria-label="Booking progress"
        >
            {BOOKING_STEPS.map((stepItem, i) => {
                const done = i < index;
                const here = i === index;
                return (
                    <li key={stepItem.key} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <span
                            aria-current={here ? 'step' : undefined}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                                        text-[1.0625rem] font-extrabold transition-colors ${
                                done
                                    ? 'bg-brand-800 text-white'
                                    : here
                                        ? 'bg-brand-800 text-white ring-4 ring-brand-100'
                                        : 'bg-white text-slate-400 ring-1 ring-slate-200'
                            }`}
                        >
                            {done ? <Check size={15} strokeWidth={3} /> : i + 1}
                        </span>

                        <span
                            className={`hidden truncate text-[1.0625rem] sm:block ${
                                here ? 'font-extrabold text-brand-800' : 'font-bold text-slate-400'
                            }`}
                        >
                            {stepItem.label}
                        </span>

                        {/* The rule between one step and the next, filled as far
                            as the reader has come. Not drawn after the last. */}
                        {i < BOOKING_STEPS.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={`h-0.5 min-w-4 flex-1 rounded-full ${
                                    done ? 'bg-brand-800' : 'bg-slate-200'
                                }`}
                            />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

/** "25-08-2026" — the form the client's own screens print. */
const formatDay = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

/** "Rs. 1,000". Indian grouping, which `toLocaleString('en-IN')` gets right. */
/**
 * `₹`, not `Rs.` — the same glyph the event page this flow starts from uses.
 *
 * A visitor read "₹2,000 per seat" on the event, pressed Book Now, and was
 * shown "Rs. 2,000". The same figure written two ways across two steps of one
 * purchase invites the reader to check whether it is the same figure.
 */
const rupees = (amount: number): string => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Ten digits starting 6-9, which is what the server's validator accepts. */
const MOBILE_RE = /^[6-9]\d{9}$/;

const digits = (value: string) => String(value || '').replace(/\D/g, '');

/**
 * A mobile number as the server will read it.
 *
 * A pasted number arrives as "+91 90923 17264", "091-9092317264" or
 * "9092317264", and all three are the same number. Stripping the country code
 * and the trunk zero here means the field validates what the server validates,
 * rather than rejecting a number the server would have accepted — which is the
 * more annoying of the two failures, because the visitor can see the number is
 * right.
 */
const nationalMobile = (value: string): string => {
    let d = digits(value);
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return d;
};

const emptyPerson = (): BookingParticipant => ({ name: '', email: '', phone: '' });

/* ---------------------------------------------------------------- the page */

type Step = 'choice' | 'form' | 'review' | 'done';


export default function EventBookingPage({ chrome = 'public' }: {
    /**
     * Which shell this booking sits in.
     *
     * `public` is the onboarding site — header, footer, the marketing
     * typography. `member` is the dashboard: the sidebar, the slate background
     * and the member's own way back. The FLOW is identical, deliberately: a
     * second booking screen for members is what produced two attendee lists for
     * one room, and this page exists to have ended that.
     */
    chrome?: 'public' | 'member';
}) {
    const { id = '' } = useParams<{ id: string }>();
    /* Only the member chrome has a sidebar; harmless in the public one. */
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const [event, setEvent] = useState<BookableEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    /**
     * Signed in already?
     *
     * Read once, from storage, rather than subscribed to. There is no auth
     * context on this site — `activApi.login` writes to `localStorage` and the
     * pages read it — and a booking flow is short enough that a session
     * changing underneath it is not a case worth engineering for. The only
     * thing it decides is whether the choice step is shown at all.
     */
    const [signedIn, setSignedIn] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === 'true';
        } catch {
            // A private window with storage blocked. Treated as a guest, which
            // is the answer that still lets them book.
            return false;
        }
    });

    const [step, setStep] = useState<Step>('choice');

    // ---- the draft booking
    const [booker, setBooker] = useState<BookingParticipant>(emptyPerson);
    const [count, setCount] = useState(1);
    /**
     * What is literally in the box, while it is being typed in.
     *
     * Separate from `count` because the two answer different questions: `count`
     * is how many seats are being booked and is always valid, this is what the
     * field currently shows and may be empty or half-typed. Binding the input
     * to `count` is what made the box unclearable.
     */
    const [countText, setCountText] = useState('');
    /*
     * NO ROWS UNTIL A NUMBER IS GIVEN.
     *
     * This started as one row for one seat, so the form opened with a
     * Participant 1 box and a total already priced — an answer the member had
     * not given, presented as one they had. The rows appear with the number.
     */
    const [participants, setParticipants] = useState<BookingParticipant[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ---- the sign-in panel
    const [creds, setCreds] = useState({ email: '', password: '' });
    const [signingIn, setSigningIn] = useState(false);
    /** Whether the sign-in password is shown as text. */
    const [showPassword, setShowPassword] = useState(false);
    const [signInError, setSignInError] = useState('');

    /*
     * EVERY STEP OPENS AT ITS TOP.
     *
     * "Continue as guest" and "Sign in & checkout" swapped the step in place
     * and left the page scrolled to where the button was — so the form opened
     * with its first fields above the fold and the visitor had to scroll up to
     * find them. In the member chrome the scroller is `<main>`, not the
     * window, which is why a `window.scrollTo` alone never reached it.
     */
    const firstStep = useRef(true);
    useEffect(() => {
        if (firstStep.current) { firstStep.current = false; return; }
        try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.querySelectorAll('main').forEach((el) => {
                if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
            });
        } catch { /* scrolling is a nicety */ }
    }, [step]);

    // ---- submitting
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState('');
    const [booking, setBooking] = useState<EventBooking | null>(null);

    /*
     * `?ref=` OPENS STRAIGHT ON THE CONFIRMATION.
     *
     * Where the buyer lands after paying on Instamojo (`/payment-success`
     * hands over here once the server has confirmed the booking), and the
     * "View your booking" link in the confirmation email. The page is a fresh
     * load in both cases, so the booking is read back by its reference.
     */
    const [searchParams] = useSearchParams();
    const refFromUrl = (searchParams.get('ref') || '').trim();
    const [loadingRef, setLoadingRef] = useState(!!refFromUrl);

    useEffect(() => {
        if (!refFromUrl) { setLoadingRef(false); return; }
        let cancelled = false;
        setLoadingRef(true);

        getEventBooking(refFromUrl)
            .then((found) => {
                if (cancelled) return;
                /*
                 * The address carries the event's readable SLUG now, the booking
                 * its id — comparing the two never matched, so every paid buyer
                 * landed back on step 1. Checked once the event has loaded: its
                 * id is what the slug resolves to.
                 */
                const here = [String(id), String(event?.id || '')];
                if (found?.bookingRef && (!found.eventId || here.includes(String(found.eventId)) || !event)) {
                    setBooking(found);
                    setStep('done');
                }
            })
            .catch(() => { /* an unknown reference just opens the normal booking form */ })
            .finally(() => { if (!cancelled) setLoadingRef(false); });

        return () => { cancelled = true; };
    }, [refFromUrl, id, event]);

    /* -------------------------------------------------------------- loading */

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError('');
        window.scrollTo({ top: 0, behavior: 'auto' });

        getBookableEvent(id)
            .then((found) => {
                if (cancelled) return;
                setEvent(found);
                setLoading(false);
            })
            .catch((error) => {
                if (cancelled) return;
                setLoadError(errorMessage(error, 'This event is not available for booking.'));
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [id]);

    /**
     * =====================================================================
     * THE PRICE IS ASKED FOR AGAIN THE MOMENT SOMEBODY SIGNS IN
     * =====================================================================
     *
     * `getBookableEvent` resolves the amount SERVER-SIDE from whoever is
     * asking, and the load effect above runs on `[id]` alone. So a member who
     * arrived signed out, pressed "Sign in & checkout" and signed in correctly
     * went on looking at the payload fetched for a guest: ₹2,000 per seat,
     * `memberRateApplied: false`, and an order total that never moved.
     *
     * Their booking WAS charged ₹1,500 — `createBooking` prices it again with
     * their token — so the page and the checkout disagreed, which is the exact
     * failure the one-lookup rule exists to prevent, arriving from the other
     * direction: not a second copy of the rule, but a stale answer from the
     * only copy.
     *
     * Quietly: no `setLoading`, no scroll reset. The member is mid-flow and the
     * only thing that should change under them is the number.
     */
    useEffect(() => {
        if (!signedIn || !id) return;
        let cancelled = false;

        getBookableEvent(id)
            .then((fresh) => { if (!cancelled) setEvent(fresh); })
            /* A failed refresh leaves the guest price on screen, which is the
               safe direction: it is never lower than what will be charged. */
            .catch(() => {});

        return () => { cancelled = true; };
    }, [signedIn, id]);

    /* ------------------------------------------------------- derived values */

    /**
     * WHAT THIS VISITOR PAYS — `amount`, resolved by the server.
     *
     * Not `price`, and NOT `isMember ? memberPrice : price`. The server already
     * answered that question with the member's live membership status in hand,
     * and re-deciding it here would be a second copy of the pricing rule in the
     * one place a disagreement costs money: the page would advertise ₹600 and
     * the checkout would take ₹1,000.
     *
     * `?? Number(event?.price || 0)` only for an older server that does not
     * send the field — falling back to the COMMON price, which is the safe
     * direction to be wrong in. Falling back to the member price would hand a
     * discount to everybody.
     */
    const price = Number(event?.amount ?? event?.price ?? 0);
    /** The common price, for the "members save" line beside it. */
    const listPrice = Number(event?.price || 0);
    const memberPrice = Number(event?.memberPrice ?? listPrice);
    const hasMemberRate = !!event?.hasMemberRate && memberPrice < listPrice;
    /** Whether THIS visitor is already getting it, rather than being offered it. */
    const gettingMemberRate = !!event?.memberRateApplied;
    const isFree = price <= 0;
    const capped = Number(event?.capacity || 0) > 0;
    const seatsLeft = capped ? Number(event?.seatsLeft || 0) : null;
    const maxPerBooking = Math.max(1, Number(event?.maxPerBooking || 1));

    /** What the visitor is about to pay. The server prices it again. */
    const estimatedTotal = price * count;

    /**
     * Resize the participant list when the count changes.
     *
     * Existing rows are KEPT, not rebuilt. Somebody who has typed three
     * colleagues in and then corrects the count to four must not find the three
     * they already typed wiped — and somebody who corrects it downwards and back
     * up again is doing the same thing twice. Only the tail moves.
     */
    const setPeople = useCallback((next: number) => {
        const clamped = Math.min(Math.max(1, Math.round(next || 1)), maxPerBooking);
        setCount(clamped);
        // Keeps the box in step when the count is changed from anywhere other
        // than the box itself — the seat cap lowering it, for instance. An
        // empty box stays empty: normalising it here is what made it impossible
        // to clear.
        setCountText((text) => (text === '' ? '' : String(clamped)));
        setParticipants((rows) => {
            if (clamped === rows.length) return rows;
            if (clamped < rows.length) return rows.slice(0, clamped);
            return [...rows, ...Array.from({ length: clamped - rows.length }, emptyPerson)];
        });
    }, [maxPerBooking]);

    const setParticipant = (index: number, field: keyof BookingParticipant, value: string) => {
        setParticipants((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    };

    /* ----------------------------------------------------------- validation */

    /**
     * The same rules the server applies, so the form refuses what the server
     * would refuse and accepts what it would accept.
     *
     * Deliberately NOT stricter. A client-side rule the server does not have is
     * a field somebody cannot get past for a reason nobody can explain — and the
     * participant rows are optional on the server precisely because an office
     * manager booking colleagues may not have their email addresses.
     */
    const validate = useCallback((): Record<string, string> => {
        const found: Record<string, string> = {};

        if (!booker.name.trim()) found.name = 'Please enter your name';
        if (!booker.email.trim()) found.email = 'Please enter your email address';
        else if (!EMAIL_RE.test(booker.email.trim())) found.email = 'Enter a valid email address';

        const mobile = nationalMobile(booker.phone);
        if (!mobile) found.phone = 'Please enter your mobile number';
        else if (!MOBILE_RE.test(mobile)) found.phone = 'Enter a valid 10-digit mobile number';

        if (!Number.isFinite(count) || count < 1) found.count = 'Enter how many people are attending';
        else if (count > maxPerBooking) found.count = `At most ${maxPerBooking} per booking`;

        participants.forEach((person, i) => {
            if (person.email.trim() && !EMAIL_RE.test(person.email.trim())) {
                found[`p${i}.email`] = 'Enter a valid email address';
            }
            const digitsOnly = nationalMobile(person.phone);
            if (digitsOnly && !MOBILE_RE.test(digitsOnly)) {
                found[`p${i}.phone`] = 'Enter a valid 10-digit mobile number';
            }
        });

        /*
         * PARTICIPANTS MAY NOT REPEAT EACH OTHER. You and a participant may
         * share details (booking for yourself); two participant rows with the
         * same email or mobile may not. The server applies the same rule.
         */
        const seenEmail = new Set<string>();
        const seenPhone = new Set<string>();
        participants.forEach((person, i) => {
            const email = person.email.trim().toLowerCase();
            const phone = nationalMobile(person.phone);
            if (email && !found[`p${i}.email`] && seenEmail.has(email)) {
                found[`p${i}.email`] = 'Email already used by another participant';
            }
            if (phone && !found[`p${i}.phone`] && seenPhone.has(phone)) {
                found[`p${i}.phone`] = 'Mobile number already used by another participant';
            }
            if (email) seenEmail.add(email);
            if (phone) seenPhone.add(phone);
        });

        return found;
    }, [booker, count, participants, maxPerBooking]);

    const [checking, setChecking] = useState(false);

    /** Server-side "already registered for this event" — messages keyed like `errors`. */
    const alreadyBooked = async (): Promise<Record<string, string>> => {
        try {
            await api.post(`/event-bookings/event/${encodeURIComponent(id)}/check`, {
                email: booker.email.trim(),
                phone: nationalMobile(booker.phone),
                participants: participants.map((p) => ({ email: p.email.trim(), phone: nationalMobile(p.phone) })),
            });
            return {};
        } catch (error) {
            const fields = (error as { response?: { data?: { fields?: Record<string, string> } } })?.response?.data?.fields || {};
            const mapped: Record<string, string> = {};
            Object.entries(fields).forEach(([key, message]) => {
                const m = key.match(/^participants\.(\d+)\.(email|phone)$/);
                mapped[m ? `p${m[1]}.${m[2]}` : key] = String(message);
            });
            return mapped; // a network failure returns {}; the booking itself re-checks
        }
    };

    const goToReview = async () => {
        let found = validate();
        if (!Object.keys(found).length) {
            setChecking(true);
            found = await alreadyBooked();
            setChecking(false);
        }
        setErrors(found);
        if (Object.keys(found).length) {
            // Put the first bad field in view. Without this, a validation error
            // on the participant rows of a long form is announced entirely
            // off-screen and the button simply appears not to work.
            // After React paints the new messages.
            setTimeout(() => {
                const first = document.querySelector('[data-invalid="true"]');
                if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return;
        }
        setPayError('');
        setStep('review');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /*
     * AS YOU TYPE: "Email already registered" / "Mobile number already
     * registered" appear under the box while the form is being filled, not only
     * after Continue. Half a second after the last keystroke, the repeats inside
     * this booking are checked here and the event's existing bookings (and the
     * registered-member rule) on the server. Only those messages are managed
     * here — "please enter…" is still left for Continue, so an empty box is not
     * scolded while somebody is typing.
     */
    const liveKeys = useRef<Set<string>>(new Set());
    const CONTACT_KEY = /^(email|phone|p\d+\.(email|phone))$/;
    useEffect(() => {
        if (step !== 'form') return undefined;
        let cancelled = false;
        const timer = setTimeout(async () => {
            const local = validate();
            const found: Record<string, string> = {};
            Object.entries(local).forEach(([k, v]) => {
                // Everything about a box somebody has typed in; "please enter…" waits for Continue.
                if (CONTACT_KEY.test(k) && !/^please enter/i.test(v)) found[k] = v;
            });
            const anyContact = EMAIL_RE.test(booker.email.trim()) || MOBILE_RE.test(nationalMobile(booker.phone))
                || participants.some((p) => EMAIL_RE.test(p.email.trim()) || MOBILE_RE.test(nationalMobile(p.phone)));
            if (anyContact) {
                const server = await alreadyBooked();
                Object.entries(server).forEach(([k, v]) => { if (!found[k]) found[k] = v; });
            }
            if (cancelled) return;
            setErrors((prev) => {
                const next = { ...prev };
                liveKeys.current.forEach((k) => { delete next[k]; });
                Object.assign(next, found);
                liveKeys.current = new Set(Object.keys(found));
                return next;
            });
        }, 500);
        return () => { cancelled = true; clearTimeout(timer); };
        // `validate` and `alreadyBooked` read these same values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, booker.email, booker.phone, participants]);

    /* -------------------------------------------------------------- signing in */

    const handleSignIn = async (submit: React.FormEvent) => {
        submit.preventDefault();
        setSignInError('');

        /*
         * SAID HERE RATHER THAN BY GREYING THE BUTTON.
         *
         * The button used to be `disabled` until both boxes had something in
         * them, which paints it at 60% and explains nothing — a member's first
         * sight of this card was the control they came for, dead, for a reason
         * the page never gave. Pressing it now says what is missing.
         */
        if (!creds.email.trim() || !creds.password) {
            setSignInError(!creds.email.trim() && !creds.password
                ? 'Enter your email address and password.'
                : !creds.email.trim()
                    ? 'Enter your email address.'
                    : 'Enter your password.');
            return;
        }

        setSigningIn(true);

        try {
            await login(creds.email, creds.password);
            /*
             * `signedIn` flipping re-asks the server for the price with the new
             * token — see the refetch effect — and the step moves on here.
             *
             * It used to be moved by an effect that ALSO hid this whole step
             * from anybody already signed in. That effect is gone (the
             * association asked for both cards to stay on screen), so the
             * advance has to happen where the sign-in actually succeeds.
             *
             * NOTHING IS PREFILLED. The association asked for every field to be
             * entered deliberately — a booking often is not for the person
             * holding the account. It changes nothing about the price: the
             * member rate is resolved by the SERVER from the token on the
             * request, never from what is typed into this form.
             */
            setSignedIn(true);
            setStep('form');
        } catch (error) {
            setSignInError(errorMessage(error, 'Those details were not recognised'));
        } finally {
            setSigningIn(false);
        }
    };

    /* ---------------------------------------------------------------- paying */

    const confirm = async () => {
        setPaying(true);
        setPayError('');

        try {
            const result = await bookAndPay(id, {
                name: booker.name.trim(),
                email: booker.email.trim(),
                phone: nationalMobile(booker.phone),
                noOfPersons: count,
                participants: participants.map((p) => ({
                    name: p.name.trim(),
                    email: p.email.trim(),
                    phone: nationalMobile(p.phone),
                })),
            });

            /*
             * `null` MEANS WE ARE LEAVING THIS PAGE.
             *
             * With a hosted gateway `bookAndPay` redirects the browser to
             * Instamojo and there is no booking to show — the seats are
             * confirmed by the webhook, and the visitor comes back to
             * `/payment-success`. Falling through to the confirmation step
             * here would flash "booking confirmed" for the instant before the
             * redirect lands, which is a promise nobody has kept yet.
             *
             * `paying` is deliberately left ON in that case (see `finally`),
             * so the button cannot be pressed twice while the page unloads.
             */
            if (!result) return;

            setBooking(result);
            setStep('done');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            /*
             * Stay on the review step. The draft is still in memory and the
             * visitor can correct whatever the server objected to — sending them
             * back to an empty form after a failed payment is how somebody
             * re-types eight participants.
             */
            /*
             * ALREADY REGISTERED: the server names the boxes (`fields`). Back to
             * the form with each message under its own box, rather than a
             * generic error at the foot of the review step.
             */
            const fields = (error as { response?: { data?: { fields?: Record<string, string> } } })
                ?.response?.data?.fields;
            if (fields && typeof fields === 'object' && Object.keys(fields).length) {
                const mapped: Record<string, string> = {};
                Object.entries(fields).forEach(([key, message]) => {
                    const m = key.match(/^participants\.(\d+)\.(email|phone)$/);
                    mapped[m ? `p${m[1]}.${m[2]}` : key] = String(message);
                });
                setErrors(mapped);
                setPaying(false);
                setStep('form');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            setPayError(errorMessage(error, 'The booking could not be completed'));
            setPaying(false);
        }
    };

    /*
     * WHERE "BACK" AND "OTHER EVENTS" GO.
     *
     * A member came from the dashboard and belongs back in it; sending them to
     * the public event page would drop them out of the area they were working
     * in, which is the whole fault this chrome exists to fix.
     */
    const eventHref = chrome === 'member' ? `/member/events/${id}` : `/events/${id}`;
    const eventsHref = chrome === 'member' ? '/member/events' : '/events';

    /* ----------------------------------------------------------------- shell */

    const shell = (children: React.ReactNode) => (chrome === 'member' ? (
        <div className="flex h-screen bg-slate-50 font-sans">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 z-10">
                    <div className="h-[5.5rem] px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                            <button
                                className="lg:hidden shrink-0 p-2 rounded-xl hover:bg-slate-100"
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open menu"
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-[1.5625rem] sm:text-[2.0625rem] leading-tight font-bold
                                               tracking-tight text-slate-900 truncate">
                                    Book your place
                                </h1>
                                <p className="text-[1.25rem] text-slate-500 mt-0.5 truncate hidden sm:block">
                                    {event?.title || 'Reserve seats for this event'}
                                </p>
                            </div>
                        </div>
                        <MemberTopBar />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto">
                    {/* The same column the rest of the member area uses, so the
                        booking sits under the header rather than beside it. */}
                    <div className="w-full max-w-[110rem] mx-auto pb-12">{children}</div>
                </main>
            </div>
        </div>
    ) : (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />
            <main className="flex-grow">{children}</main>
            <FooterSection />
        </div>
    ));

    if (loading || loadingRef) {
        return shell(
            <div className={`${SCREEN_CONTAINER} py-20 animate-pulse`}>
                <div className="h-4 w-32 bg-slate-200 rounded mb-10" />
                <div className="grid lg:grid-cols-[20rem_minmax(0,1fr)] gap-8">
                    <div className="h-80 bg-slate-200 rounded-3xl" />
                    <div className="space-y-4">
                        <div className="h-8 w-1/2 bg-slate-200 rounded" />
                        <div className="h-12 bg-slate-200 rounded-xl" />
                        <div className="h-12 bg-slate-200 rounded-xl" />
                    </div>
                </div>
            </div>,
        );
    }

    if (loadError || !event) {
        return shell(
            <div className={`${SCREEN_CONTAINER} py-24 text-center`}>
                <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Booking unavailable</h1>
                <p className="text-[1.25rem] text-gray-500 font-semibold mb-8 max-w-lg mx-auto">
                    {loadError || 'This event is not taking bookings.'}
                </p>
                <Link to={eventsHref} className={PRIMARY_BUTTON}>
                    <ArrowLeft size={15} /> Back to Events
                </Link>
            </div>,
        );
    }

    /* ------------------------------------------------------------ the tiles */

    /**
     * Date, seats, price and location — the reference site's four facts, in this
     * site's visual language rather than its four coloured blocks.
     *
     * The information architecture is the client's and is kept exactly: those
     * four things, in that order, beside the form. The treatment is ours,
     * because a page that switches to another site's palette halfway through is
     * a page that looks broken.
     */
    const facts: { icon: React.ReactNode; label: string; value: string; muted?: boolean }[] = [
        {
            icon: <Calendar size={16} />,
            label: 'Date',
            value: formatDay(event.startAt) || 'To be confirmed',
        },
        {
            icon: <Users size={16} />,
            label: 'Seats',
            // An uncapped event reports MAX_SAFE_INTEGER, which must never reach
            // the page. `capacity > 0` is the check that keeps it off.
            value: capped
                ? `${seatsLeft} of ${event.capacity} left`
                : 'Open registration',
        },
        {
            icon: <IndianRupee size={16} />,
            label: 'Price',
            /*
             * BOTH FIGURES, EVEN IN THE SUMMARY LINE.
             *
             * It printed one number — whichever the reader was entitled to — so
             * a member's summary read "₹1,500 per person" with nothing to say
             * the public figure was ₹2,000, and a visitor's read "₹2,000" with
             * nothing to say a membership would take ₹500 off it. Either way the
             * one thing this pair of prices exists to show was missing from the
             * first place a reader looks. The panel under the total makes the
             * full argument; this line at least names both numbers.
             */
            value: isFree
                ? 'Free'
                : (hasMemberRate
                    ? `${rupees(listPrice)} · members ${rupees(memberPrice)} per person`
                    : `${rupees(price)} per person`),
        },
        {
            icon: <MapPin size={16} />,
            label: 'Location',
            value: [event.venue, event.venueAddress].filter(Boolean).join(' · ') || 'To be announced',
        },
    ];

    const eventCard = (
      <div className="space-y-4">
        {/*
          * THE PHOTOGRAPH, ABOVE THE CARD AND ON ITS OWN.
          *
          * The reference keeps the title with "Book Now" in the form column and
          * lets the picture be a picture. No banner simply means no picture —
          * the facts card below is the column's real content.
          */}
        {event.bannerUrl ? (
            <img
                src={sizedMediaUrl(event.bannerUrl, 700)}
                alt=""
                aria-hidden="true"
                className="h-36 w-full rounded-2xl object-cover
                           shadow-[0_8px_24px_-16px_rgba(28,46,104,0.5)]"
            />
        ) : null}

        <aside className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4
                          shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_36px_-22px_rgb(28_46_104/0.35)]
                          lg:sticky lg:top-28 h-fit">
            <div className="px-2 sm:px-3">
                {facts.map((fact) => (
                    <div
                        key={fact.label}
                        className="flex items-start gap-3 py-4 border-b border-gray-100 last:border-0"
                    >
                        <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center
                                         justify-center shrink-0">
                            {fact.icon}
                        </span>
                        <div className="min-w-0">
                            <p className="text-[1.0625rem] font-semibold text-gray-500">{fact.label}</p>
                            <p className="text-[1.0625rem] font-bold text-brand-800 leading-snug break-words">
                                {fact.value}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {event.venueMapUrl && (
                <a
                    href={event.venueMapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-2 sm:mx-3 mb-2 inline-flex items-center gap-1.5 text-brand-600
                               hover:text-brand-800 text-[1.0625rem] font-bold transition-colors"
                >
                    Open in maps <ExternalLink size={13} />
                </a>
            )}

            {/* Quiet, and inside the card: something to bring, not a warning. */}
            {event.registrationNote && (
                <div className="rounded-xl bg-brand-50/70 px-4 py-3 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-white text-brand-600 flex items-center
                                     justify-center shrink-0">
                        <Info size={15} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-[0.8125rem] font-extrabold uppercase tracking-[0.08em]
                                      text-brand-700">
                            Please note
                        </p>
                        <p className="text-[1.0625rem] font-semibold text-gray-700 whitespace-pre-line">
                            {event.registrationNote}
                        </p>
                    </div>
                </div>
            )}
        </aside>
      </div>
    );

    /*
     * WHERE "BACK" AND "OTHER EVENTS" GO.
     *
     * A member came from the dashboard and belongs back in it; sending them to
     * the public event page would drop them out of the area they were working
     * in, which is the whole fault this chrome exists to fix.
     */
    const crumb = (
        <div className={`${SCREEN_CONTAINER} pt-8`}>
            {/* A control, not a caption. It was 13px grey with no padding on a
                page set in 17px — the smallest thing on the screen was the only
                way off it. */}
            <Link
                to={eventHref}
                className="inline-flex items-center gap-2 -ml-3 px-3 py-2 rounded-lg text-[1.0625rem]
                           font-bold text-gray-600 hover:text-brand-800 hover:bg-brand-50
                           transition-colors"
            >
                <ArrowLeft size={16} /> Back to event
            </Link>
        </div>
    );

    /* ==================================================== step: sold out */

    if (capped && Number(seatsLeft) <= 0 && step !== 'done') {
        return shell(
            <>
                {crumb}
                <div className={`${SCREEN_CONTAINER} py-16 text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Fully booked</h1>
                    <p className="text-[1.25rem] text-gray-500 font-semibold mb-8 max-w-lg mx-auto">
                        Every seat for {event.title || 'this event'} has been taken.
                    </p>
                    <Link to={eventsHref} className={PRIMARY_BUTTON}>See other events</Link>
                </div>
            </>,
        );
    }

    if (event.closed && step !== 'done') {
        return shell(
            <>
                {crumb}
                <div className={`${SCREEN_CONTAINER} py-16 text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Bookings closed</h1>
                    <p className="text-[1.25rem] text-gray-500 font-semibold mb-8 max-w-lg mx-auto">
                        The booking deadline for {event.title || 'this event'} has passed.
                        {event.contactEmail ? ` Write to ${event.contactEmail} if you need a place.` : ''}
                    </p>
                    <Link to={eventsHref} className={PRIMARY_BUTTON}>See other events</Link>
                </div>
            </>,
        );
    }

    /* ==================================================== step: choice */

    if (step === 'choice') {
        /* The two things a guest gives up, and the two they keep. Short lines,
           because a card of prose is a card nobody reads. */
        const guestPoints = [
            'No account and no password to remember',
            'Name, email and mobile number only',
            'Your booking reference is emailed to you',
            'Register as a member later if you want to',
        ];

        /**
         * ==============================================================
         * ONE SHAPE FOR BOTH RATES, ALWAYS RENDERED
         * ==============================================================
         *
         * The two panels were written separately and hung at different heights
         * from different places in their cards — the guest's below a bullet
         * list, the member's above a form — so the two figures a visitor is
         * being asked to compare sat sixty-five pixels apart with nothing
         * lining them up. They are the heaviest thing on the step and the whole
         * point of it; they belong on one baseline.
         *
         * Built by one function, placed at the same point in both cards, and
         * emitted in EVERY case — free event, no member rate, member rate — so
         * neither card ever collapses to a different height than the other. A
         * conditional block is what produced the hole in the guest card that
         * made it read as unfinished.
         */
        const rateBlock = (
            caption: string,
            figure: string,
            unit: string,
            note: string,
            tone: 'slate' | 'emerald',
        ) => (
            <div
                className={`rounded-xl border px-4 py-3.5 ${tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-slate-200 bg-slate-50'}`}
            >
                <p className={`text-[1.0625rem] font-extrabold uppercase tracking-widest ${tone === 'emerald' ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {caption}
                </p>
                <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-[2rem] leading-none font-black tracking-tight tabular-nums ${tone === 'emerald' ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {figure}
                    </span>
                    {unit ? (
                        <span className="text-[1.25rem] font-bold text-slate-500">{unit}</span>
                    ) : null}
                </p>
                <p className={`mt-1.5 text-[1.25rem] font-semibold ${tone === 'emerald' ? 'text-emerald-700/90' : 'text-slate-500'}`}>
                    {note}
                </p>
            </div>
        );

        const guestRate = isFree
            ? rateBlock('You pay', 'Free', '', 'No payment is taken for this event.', 'slate')
            : rateBlock('You pay', rupees(listPrice), 'per seat',
                'The standard rate, for every seat on the booking.', 'slate');

        /*
         * NOT STRUCK THROUGH — see the note at the head of `EventPriceTiers`,
         * which this panel is the small twin of. A struck price is a shop
         * saying "this was the price and is not any more"; the list price is
         * still exactly what the guest card beside this one charges, and
         * striking it here contradicts that card directly. "instead of" says
         * the same thing and says it truthfully.
         *
         * The last branch matters as much as the first: an event with no member
         * rate must still print a panel, and it must say so rather than promise
         * a discount the event does not carry.
         */
        const memberRate = isFree
            ? rateBlock('Members pay', 'Free', '', 'No payment is taken for this event.', 'slate')
            : hasMemberRate
                ? rateBlock('Members pay', rupees(memberPrice), 'per seat',
                    `instead of ${rupees(listPrice)} — you save ${rupees(Math.max(0, listPrice - memberPrice))}`,
                    'emerald')
                : rateBlock('Members pay', rupees(listPrice), 'per seat',
                    'The same rate as a guest for this event.', 'slate');

        return shell(
            <>
                {crumb}
                <div className={`${SCREEN_CONTAINER} py-8 md:py-12`}>
                  <div className="mx-auto max-w-6xl">
                    <BookingSteps current="choice" />

                    {/*
                      * THE QUESTION, PUT.
                      *
                      * The step used to open with two cards and no sentence
                      * between them and the back link, so what was being asked
                      * had to be inferred from the two answers.
                      */}
                    <div className="text-center mb-7 md:mb-9">
                        <p className={`${MICRO_LABEL} text-slate-400 mb-2.5`}>
                            {event.title || 'This event'}
                        </p>
                        <h1 className={`${SECTION_HEADING} text-brand-800`}>
                            How would you like to book?
                        </h1>
                        <p className="mt-3 max-w-xl mx-auto text-[1.25rem] sm:text-[1.375rem] font-semibold text-slate-500">
                            Both take the same seats. Members get their rate applied automatically.
                        </p>
                    </div>

                    {/* The sheet the cards stand on — see `BOOKING_SHEET`. */}
                    <div className={BOOKING_SHEET}>
                    <div className="grid md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 items-stretch">

                        {/* ---- guest ---- */}
                        <div className={`${BOOKING_PANEL} p-6 sm:p-7 flex flex-col`}>
                            <span className={`${BIZ_BADGE} bg-slate-100 text-slate-600 border border-slate-200`}>
                                <UserPlus size={13} /> No account needed
                            </span>

                            <h2 className={`${BIZ_CARD_TITLE} mt-4`}>Book as a guest</h2>
                            {/* `min-h` on both cards' lede, so the rule beneath
                                it falls on one line across the pair whether the
                                sentence runs to one line or to two. */}
                            <p className="mt-2 min-h-[3.5rem] text-[1.25rem] leading-relaxed font-medium text-slate-600">
                                Checkout takes about a minute, with no account to create.
                            </p>

                            <div className="my-5 border-t border-slate-100" />

                            {guestRate}

                            <ul className="mt-5 space-y-4">
                                {guestPoints.map((point) => (
                                    <li key={point} className="flex items-start gap-2.5">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                                                         rounded-full bg-brand-50 text-brand-700">
                                            <Check size={12} strokeWidth={3} />
                                        </span>
                                        <span className="text-[1.25rem] font-semibold text-slate-700">
                                            {point}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            {/* A spacer, not `mt-auto` on the button: `mt-auto`
                                and a minimum gap are the same CSS property, so
                                one silently wins over the other. This holds the
                                two cards' buttons on one line AND keeps a real
                                gap above this one when the pair is stacked. */}
                            <div className="flex-1 min-h-[2rem]" />

                            <button
                                type="button"
                                onClick={() => setStep('form')}
                                className={`${PRIMARY_BUTTON} w-full`}
                            >
                                Continue as guest <ArrowRight size={15} />
                            </button>

                            {/* The twin of "No account? Join ACTIV" opposite.
                                Without it the guest button sits exactly one
                                line lower than the member one — the cards are
                                the same height, so whatever the right card
                                carries below its button the left card must
                                carry too, or the two buttons do not align. */}
                            <p className="mt-3 text-center text-[1.25rem] font-semibold text-slate-500">
                                You can check everything before paying.
                            </p>
                        </div>

                        {/* ---- sign in ---- */}
                        {/*
                          * ==========================================================
                          * BOTH CARDS ARE ALWAYS ON SCREEN
                          * ==========================================================
                          *
                          * This step used to be skipped outright for anybody already
                          * signed in — the reasoning being that offering a signed-in
                          * member a guest checkout is offering them something worse
                          * than what they have. The association asked for the two
                          * cards to be shown regardless, and the objection is
                          * answered without hiding the step.
                          */}
                        <div className={`${BOOKING_PANEL} p-6 sm:p-7 flex flex-col`}>
                            <span className={`${BIZ_BADGE} bg-brand-50 text-brand-700 border border-brand-100`}>
                                <Lock size={13} /> Members
                            </span>

                            <h2 className={`${BIZ_CARD_TITLE} mt-4`}>Sign in &amp; checkout</h2>
                            <p className="mt-2 min-h-[3.5rem] text-[1.25rem] leading-relaxed font-medium text-slate-600">
                                Sign in and your membership rate is applied automatically.
                            </p>

                            <div className="my-5 border-t border-slate-100" />

                            {memberRate}

                            <form onSubmit={handleSignIn} className="mt-5 flex flex-1 flex-col">
                                {/* LABELLED. A placeholder disappears the moment
                                    somebody types, which leaves two filled boxes
                                    and nothing saying which is which. */}
                                <div>
                                    <label htmlFor="booking-email" className={FIELD_LABEL}>
                                        Email address
                                    </label>
                                    <input
                                        id="booking-email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={creds.email}
                                        onChange={(e) => setCreds({ ...creds, email: e.target.value })}
                                        className={INPUT_CLASS}
                                    />
                                </div>

                                <div className="mt-4">
                                    {/* The label keeps its own `mb-2`, which is
                                        what spaces the row from the field — one
                                        margin, declared in one place. */}
                                    <div className="flex items-baseline justify-between gap-3">
                                        <label htmlFor="booking-password" className={FIELD_LABEL}>
                                            Password
                                        </label>
                                        <Link
                                            to="/forgot-password"
                                            className="mb-2 text-[1.25rem] font-bold text-brand-600 hover:text-brand-800"
                                        >
                                            Forgot?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <input
                                            id="booking-password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            placeholder="Your password"
                                            value={creds.password}
                                            onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                                            className={`${INPUT_CLASS} pr-12`}
                                        />
                                        {/* The eye every other password box on
                                            this site has. A member mistyping on
                                            a phone had no way to check. */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((on) => !on)}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center
                                                       text-slate-400 hover:text-brand-700 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {signInError && (
                                    <p className="mt-3 flex items-start gap-2 text-[1.25rem] font-bold text-red-600">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0" /> {signInError}
                                    </p>
                                )}

                                <div className="flex-1 min-h-[1.25rem]" />

                                <button
                                    type="submit"
                                    disabled={signingIn}
                                    className={`${PRIMARY_BUTTON} w-full`}
                                >
                                    {signingIn
                                        ? <><Loader2 size={15} className="animate-spin" /> Signing in…</>
                                        : <>Sign in <ArrowRight size={15} /></>}
                                </button>

                                <p className="mt-3 text-center text-[1.25rem] font-semibold text-slate-500">
                                    No account?{' '}
                                    <Link
                                        to="/register"
                                        state={{ from: `/events/${id}/book` }}
                                        className="font-bold text-brand-600 hover:text-brand-800"
                                    >
                                        Join ACTIV
                                    </Link>
                                </p>
                            </form>
                        </div>
                    </div>
                    </div>
                  </div>
                </div>
            </>,
        );
    }

    /* ==================================================== step: form */

    if (step === 'form') {
        return shell(
            <>
                {crumb}
                <div className={`${SCREEN_CONTAINER} py-8 md:py-12`}>
                  <BookingSteps current="form" />
                  <div className={BOOKING_SHEET}>
                    <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
                        {eventCard}

                        <div>
                            {/*
                              * THE HEADER THE REFERENCE HAS: the event as a chip,
                              * the instruction as a heading, and the one piece of
                              * urgency the page is allowed — how many seats are
                              * left — opposite it rather than buried in the card.
                              */}
                            <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
                                <div className="min-w-0">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50
                                                     px-3.5 py-1.5 text-[1.0625rem] font-bold text-brand-700">
                                        <Calendar size={13} className="shrink-0" />
                                        <span className="truncate">{event.title}</span>
                                    </span>
                                    <h1 className="mt-3 text-[2.25rem] sm:text-[2.75rem] font-black leading-[1.05]
                                                   tracking-tight text-brand-800">Book Now</h1>
                                    <p className="text-[1.0625rem] font-semibold text-gray-500 mt-1">
                                        Secure your seat for this event
                                    </p>
                                </div>

                                {capped && seatsLeft > 0 ? (
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600
                                                         flex items-center justify-center">
                                            <Ticket size={20} />
                                        </span>
                                        <div>
                                            <p className="text-[1.0625rem] font-bold text-brand-800">
                                                {seatsLeft} seats left
                                            </p>
                                            <p className="text-[1.0625rem] font-semibold text-gray-500">
                                                Book early to avoid missing out
                                            </p>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/*
                              * THE FIELDS, IN A CARD.
                              *
                              * They were loose on the page background while the
                              * order total beside them had a card of its own —
                              * so the half the member has to fill in looked like
                              * the least considered thing on the screen.
                              */}
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 mb-6
                                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-20px_rgba(28,46,104,0.3)]">
                                <h2 className="flex items-center gap-2.5 text-[1.0625rem] font-bold
                                               tracking-tight text-brand-800 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex
                                                     items-center justify-center">
                                        <User size={16} />
                                    </span>
                                    Your details
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-5">
                                <Field
                                    label="Name"
                                    icon={<User size={16} />}
                                    required
                                    error={errors.name}
                                    value={booker.name}
                                    onChange={(v) => setBooker({ ...booker, name: v })}
                                    autoComplete="name"
                                />
                                <Field
                                    label="Email"
                                    icon={<Mail size={16} />}
                                    required
                                    type="email"
                                    error={errors.email}
                                    value={booker.email}
                                    onChange={(v) => setBooker({ ...booker, email: v })}
                                    autoComplete="email"
                                />
                                <Field
                                    label="Mobile Number"
                                    icon={<Phone size={16} />}
                                    required
                                    type="tel"
                                    inputMode="numeric"
                                    error={errors.phone}
                                    value={booker.phone}
                                    onChange={(v) => setBooker({ ...booker, phone: v })}
                                    autoComplete="tel"
                                />
                                <Field
                                    label="No of Participants"
                                    icon={<Users size={16} />}
                                    required
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={maxPerBooking}
                                    error={errors.count}
                                    /*
                                     * BOUND TO THE TEXT, NOT THE NUMBER.
                                     *
                                     * While the field is being typed in it shows
                                     * exactly what was typed, including nothing
                                     * at all. `count` only follows when the text
                                     * is a real number, and the box is normalised
                                     * on blur — so an empty field is a state you
                                     * can be in mid-edit, not an error the form
                                     * corrects out from under you.
                                     */
                                    value={countText}
                                    onChange={(v) => {
                                        // Digits only: a number input still
                                        // accepts "e", "+" and "-" from a
                                        // keyboard, and `parseInt` reads "1e5"
                                        // as 1 without complaining.
                                        const digits = v.replace(/[^0-9]/g, '');
                                        setCountText(digits);
                                        if (digits) setPeople(parseInt(digits, 10));
                                    }}
                                    onBlur={() => { if (countText) setPeople(parseInt(countText, 10)); }}
                                    hint={`Up to ${maxPerBooking} per booking`}
                                />
                                </div>
                            </div>

                            {/* ---- participants ----
                                Drawn once the number of participants has been
                                typed. Before that there is nothing to draw: a
                                row per seat, and no seats have been asked for
                                yet. */}
                            <div className={`mb-8 ${countText ? '' : 'hidden'}`}>
                                <h2 className="text-[1.375rem] font-black tracking-tight text-brand-800 mb-1">
                                    Participants
                                </h2>
                                <p className="text-[1.0625rem] text-gray-600 font-semibold mb-5">
                                    Who is attending. Leave a row blank if you do not have their
                                    details yet — only your own are required.
                                </p>

                                <div className="space-y-4">
                                    {participants.map((person, i) => (
                                        <div
                                            key={i}
                                            /* WHITE, WITH AN EDGE. An
                                               off-white card on a white page,
                                               bordered one shade off white, is
                                               a card nobody can see — and the
                                               white fields inside it had
                                               nothing to sit on. */
                                            className="rounded-2xl border border-gray-200 bg-white p-5
                                                       shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(28,46,104,0.25)]"
                                        >
                                            {/*
                                              * The card's own heading, given
                                              * the weight of one.
                                              *
                                              * "Participant 2" is how a reader
                                              * keeps their place in a column of
                                              * identical three-field cards, and
                                              * it was set lighter than the
                                              * labels inside the card.
                                              */}
                                            <p className="text-[1.0625rem] font-extrabold uppercase
                                                          tracking-widest text-brand-800 mb-3">
                                                Participant {i + 1}
                                                {i === 0 && (
                                                    <span className="text-gray-400"> — defaults to you</span>
                                                )}
                                            </p>
                                            <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
                                                <Field
                                                    label="Name"
                                                    compact
                                                    value={person.name}
                                                    onChange={(v) => setParticipant(i, 'name', v)}
                                                    /*
                                                     * PLAIN "Name", even on the
                                                     * first row.
                                                     *
                                                     * It echoed the booker's own
                                                     * details as the placeholder,
                                                     * which reads as a value
                                                     * already filled in: the box
                                                     * looks answered and is
                                                     * empty. The caption above
                                                     * the card is what states the
                                                     * default; a box shows what
                                                     * is IN it, and nothing is.
                                                     */
                                                    placeholder="Name"
                                                />
                                                <Field
                                                    label="Email"
                                                    compact
                                                    type="email"
                                                    error={errors[`p${i}.email`]}
                                                    value={person.email}
                                                    onChange={(v) => setParticipant(i, 'email', v)}
                                                    placeholder="Email"
                                                />
                                                <Field
                                                    label="Mobile"
                                                    compact
                                                    type="tel"
                                                    inputMode="numeric"
                                                    error={errors[`p${i}.phone`]}
                                                    value={person.phone}
                                                    onChange={(v) => setParticipant(i, 'phone', v)}
                                                    placeholder="Mobile"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ---- total + go ---- */}
                            {/* The card that carries the money, drawn like one
                                — the border was `brand-100` on a 40%-opacity
                                tint, which is two near-whites describing an
                                edge between them. */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:justify-between
                                            rounded-2xl border border-gray-200 bg-white p-5 sm:p-6
                                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_28px_-18px_rgba(28,46,104,0.35)]">
                                <div>
                                    <p className="flex items-center gap-2 text-[1.0625rem] font-bold uppercase
                                                  tracking-wider text-gray-600">
                                        <span className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex
                                                         items-center justify-center">
                                            <Ticket size={14} />
                                        </span>
                                        Order total
                                    </p>
                                    {/* A price needs a number of people. Until
                                        one is given, the total says so rather
                                        than quoting for one seat nobody asked
                                        for. */}
                                    {/* No figure until there is a number of
                                        people. The dash that used to stand here
                                        reads on screen as a stray underscore,
                                        and the rate is already on the line
                                        below. */}
                                    {(isFree || countText) && (
                                        <p className="text-[1.5625rem] font-black tracking-tight text-brand-800">
                                            {isFree ? 'Free' : rupees(estimatedTotal)}
                                        </p>
                                    )}
                                    {!isFree && (
                                        <p className="text-[1.0625rem] text-gray-500 font-semibold">
                                            {countText
                                                ? `${rupees(price)} × ${count} ${count === 1 ? 'person' : 'people'}`
                                                : `${rupees(price)} per person`}
                                            {hasMemberRate && !gettingMemberRate && (
                                                /* The figure a membership would
                                                   make this, said where the total
                                                   is being read. */
                                                <span className="ml-2 font-bold text-emerald-700">
                                                    members {rupees(memberPrice)}
                                                </span>
                                            )}
                                        </p>
                                    )}

                                    {/*
                                      * THE MEMBERSHIP DISCOUNT, WHERE IT DOES ITS
                                      * WORK — beside the number about to be paid.
                                      *
                                      * Two different sentences, because the two
                                      * readers want opposite things. Somebody
                                      * already receiving it wants confirmation
                                      * that it was applied; somebody paying full
                                      * price wants to know what joining would have
                                      * saved them, on this booking, in rupees.
                                      * One combined sentence serves neither.
                                      */}
                                    {/*
                                      * The two tiers, sized to THIS booking.
                                      *
                                      * Four seats save four times as much, and
                                      * the panel says so — the saving quoted
                                      * per seat is the weaker half of the same
                                      * argument. `seats={count}` is what makes
                                      * the join link read "save ₹2,000 on these
                                      * 4 seats" rather than "save ₹500".
                                      */}
                                    {!isFree && hasMemberRate ? (
                                        <div className="mt-3 max-w-md">
                                            <EventPriceTiers
                                                price={listPrice}
                                                memberPrice={memberPrice}
                                                hasMemberRate={hasMemberRate}
                                                memberRateApplies={gettingMemberRate}
                                                seats={count}
                                                variant="inline"
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                {/* The button the reference gives this panel: one
                                    target, saying what it costs to press it. */}
                                <button
                                    type="button"
                                    onClick={goToReview}
                                    disabled={checking}
                                    className="shrink-0 inline-flex flex-col items-center justify-center
                                               rounded-2xl bg-brand-800 hover:bg-brand-700 px-8 py-4
                                               text-white transition-colors shadow-lg disabled:opacity-70
                                               shadow-brand-900/20 min-w-[13rem]"
                                >
                                    <span className="text-[1.25rem] font-black tracking-tight">
                                        {checking ? 'Checking…' : 'Continue'}
                                    </span>
                                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-[1.0625rem]
                                                     font-semibold text-white/75">
                                        {isFree ? 'Confirm your seats' : 'Proceed to payment'}
                                        <ArrowRight size={12} />
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>
            </>,
        );
    }

    /* ==================================================== step: review */

    if (step === 'review') {
        /*
         * The people this booking names, with the blanks dropped.
         *
         * The form keeps a box per seat and requires none of them, so a
         * booking for four with one name typed would otherwise review as four
         * rows, three of them dashes. The FIRST row still falls back to the
         * booker, because that is what the server stores for seat one — the
         * review would otherwise disagree with the receipt.
         */
        const participantRows = participants
            .map((person, i) => ({
                name: person.name.trim() || (i === 0 ? booker.name : ''),
                email: person.email.trim() || (i === 0 ? booker.email : ''),
                phone: nationalMobile(person.phone) || (i === 0 ? nationalMobile(booker.phone) : ''),
            }))
            .filter((row) => row.name || row.email || row.phone);

        return shell(
            <>
                {crumb}
                <div className={`${SCREEN_CONTAINER} py-8 md:py-12`}>
                  <BookingSteps current="review" />
                  <div className={BOOKING_SHEET}>
                    {/* THE SAME TWO COLUMNS AS THE FORM.
                        The review used to be a narrow centred column, so the
                        event being booked disappeared at the moment of
                        confirming it and the two steps read as two pages. */}
                    <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)] gap-6 xl:gap-8 items-start">
                        {eventCard}

                        <div className="min-w-0">
                    {/* The same header the form carries, so the two steps read
                        as one screen a page further on. */}
                    <div className="mb-7">
                        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50
                                         px-3.5 py-1.5 text-[1.0625rem] font-bold text-brand-700">
                            <Calendar size={13} className="shrink-0" />
                            <span className="truncate">{event.title}</span>
                        </span>
                        <h1 className="mt-3 text-[2.25rem] sm:text-[2.75rem] font-black leading-[1.05]
                                     tracking-tight text-brand-800">Review your booking</h1>
                        <p className="text-[1.0625rem] font-semibold text-gray-500 mt-1">
                            Check these details before {isFree ? 'confirming' : 'paying'}.
                        </p>
                    </div>

                    <DetailTable
                        icon={<Calendar size={16} />}
                        title="Event Details"
                        /* PRICE IS NOT REPEATED HERE. It was printed under
                           Event Details and again under Booking Details, the
                           same figure from the same variable, a few
                           centimetres apart. It belongs beside the total it
                           multiplies into. */
                        rows={[
                            ['Event Name', event.title || 'Untitled event'],
                            ['Date', formatDay(event.startAt) || 'To be confirmed'],
                            ['Venue', [event.venue, event.venueAddress].filter(Boolean).join(', ')],
                        ]}
                    />

                    <DetailTable
                        icon={<Ticket size={16} />}
                        title="Booking Details"
                        rows={[
                            ['Name', booker.name],
                            ['Email', booker.email],
                            ['Mobile', nationalMobile(booker.phone)],
                            ['Price per seat', isFree ? 'Free' : rupees(price)],
                            ['No Of Person', String(count)],
                            ['Total Amount', isFree ? 'Free' : rupees(estimatedTotal)],
                        ]}
                        emphasiseLast
                    />

                    {/* ---- participants ----
                        THE ROWS ARE COMPUTED FIRST, and the section is not
                        drawn at all when there are none.

                        A booking for one seat has no per-participant boxes to
                        fill, so the table rendered as a header row over
                        nothing — three column captions and a white band under
                        them, which reads as a table that failed to load rather
                        than as "there is nobody else on this booking". The
                        person who booked is already named under Booking
                        Details, so an empty section here says nothing twice. */}
                    {participantRows.length > 0 && (
                    <section className="mb-8">
                        <h2 className="flex items-center gap-2.5 text-[1.0625rem] font-bold
                                       tracking-tight text-brand-800 mb-3">
                            <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex
                                             items-center justify-center">
                                <Users size={16} />
                            </span>
                            Participant Details
                        </h2>
                        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white
                                        shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(28,46,104,0.25)]">
                            <table className="w-full text-left border-collapse min-w-[34rem]">
                                <thead>
                                    <tr className="bg-[#f7f8fa]">
                                        {['Name', 'Email', 'Mobile'].map((head) => (
                                            <th
                                                key={head}
                                                className="text-[1.0625rem] font-semibold uppercase
                                                           tracking-[0.08em] text-gray-500 px-5 sm:px-6 py-3.5
                                                           border-b border-gray-200"
                                            >
                                                {head}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/*
                                      * ONLY THE PEOPLE WHO WERE TYPED IN.
                                      *
                                      * The form keeps a box per seat and
                                      * requires none of them, so a booking for
                                      * four with one name entered used to
                                      * review as four rows, three of them
                                      * dashes. A row of dashes is not a
                                      * participant; the seat count is stated
                                      * above, where it is a number.
                                      *
                                      * The first row still falls back to the
                                      * booker, because that IS what the server
                                      * stores for seat one - the review would
                                      * otherwise disagree with the receipt.
                                      */}
                                    {participantRows.map(({ name, email, phone }, i) => {
                                        return (
                                            <tr key={i} className="border-b border-gray-100 last:border-0">
                                                <td className="px-5 sm:px-6 py-4 text-[1.25rem] sm:text-[1.0625rem]
                                                               font-extrabold text-brand-900">
                                                    {name}
                                                </td>
                                                <td className="px-5 sm:px-6 py-4 text-[1.25rem] sm:text-[1.0625rem]
                                                               text-gray-700 font-semibold break-all">
                                                    {email}
                                                </td>
                                                <td className="px-5 sm:px-6 py-4 text-[1.25rem] sm:text-[1.0625rem]
                                                               text-gray-700 font-semibold tabular-nums">
                                                    {phone}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                    )}

                    {payError && (
                        <p className="flex items-start gap-2 mb-5 rounded-xl bg-red-50 border border-red-100
                                      px-4 py-3 text-[1.0625rem] font-bold text-red-700">
                            <AlertCircle size={15} className="mt-0.5 shrink-0" /> {payError}
                        </p>
                    )}

                    {/* The pay button carries the figure, as it does on the
                        form's Continue — the last thing pressed should say what
                        it is about to do. */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <button
                            type="button"
                            onClick={() => { setStep('form'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={paying}
                            className={GHOST_BUTTON}
                        >
                            <ArrowLeft size={15} /> Edit details
                        </button>

                        <button type="button" onClick={confirm} disabled={paying} className={PRIMARY_BUTTON}>
                            {paying
                                ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                                : isFree
                                    ? <>Confirm booking <ArrowRight size={15} /></>
                                    : <>Pay {rupees(estimatedTotal)} <ArrowRight size={15} /></>}
                        </button>
                    </div>

                    <p className="mt-5 text-[1.0625rem] text-gray-500 font-semibold">
                        By continuing you agree to our{' '}
                        <Link to="/terms-and-conditions" className="text-brand-600 hover:text-brand-800 font-bold">
                            Terms &amp; Conditions
                        </Link>{' '}and{' '}
                        <Link to="/cancellation-policy" className="text-brand-600 hover:text-brand-800 font-bold">
                            Cancellation Policy
                        </Link>.
                    </p>
                        </div>
                    </div>
                  </div>
                </div>
            </>,
        );
    }

    /* ==================================================== step: done */

    const confirmed = booking;
    /*
     * A reference opened from a link may belong to a booking that is not
     * (or no longer) confirmed — an unfinished checkout, or one the organiser
     * cancelled. The heading must say so rather than print "confirmed".
     */
    const settled = !!confirmed && confirmed.status === 'active'
        && (confirmed.payment?.status === 'paid' || confirmed.payment?.status === 'not_required');
    const headline = !confirmed || settled ? 'Booking confirmed'
        : confirmed.status === 'cancelled' ? 'Booking cancelled'
            : confirmed.status === 'waitlist' ? 'You are on the waitlist'
                : 'Payment not completed';

    return shell(
        <div className={`${SCREEN_CONTAINER} py-12 md:py-16 max-w-4xl`}>
          <BookingSteps current="done" />
          <div className={BOOKING_SHEET}>
          {/* A plain wrapper. It used to be a second, TINTED sheet inside
              this one — which put a blue-grey panel in the middle of a white
              document. Kept as a div so the tree below is untouched. */}
          <div>
            {/*
              * ONE CARD FOR THE CONFIRMATION ITSELF.
              *
              * The tick, the heading, the reference and the two actions were
              * four loose blocks on the page. On the off-white the rest of the
              * flow uses they had nothing holding them together; as a card they
              * read as the receipt they are — and the reference, which is the
              * thing somebody screenshots, sits in the middle of it.
              */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-9 mb-8 text-center
                            shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-20px_rgba(28,46,104,0.35)]">
                <span className="inline-flex w-14 h-14 rounded-full bg-emerald-50 text-emerald-600
                                 items-center justify-center mb-5">
                    <CheckCircle2 size={28} />
                </span>
                <h1 className={`${SECTION_HEADING} text-brand-800 mb-3`}>{headline}</h1>
                <p className="text-[1.25rem] sm:text-[1.0625rem] text-gray-600 font-semibold">
                    {!confirmed || settled ? (
                        <>
                            We have emailed the details to {confirmed?.bookedBy?.email || booker.email}
                            {confirmed?.bookedBy?.phone ? ' and sent a WhatsApp confirmation.' : '.'}
                        </>
                    ) : confirmed.status === 'cancelled'
                        ? 'This booking was cancelled by the organiser. Contact them if you have a question.'
                        : confirmed.status === 'waitlist'
                            ? 'The event is full. No seat is held and nothing has been charged.'
                            : 'We have not received the payment for this booking, so no seat is held. '
                                + 'You can book again, or pay the organiser directly.'}
                </p>

                <div className="mt-7 rounded-xl border border-brand-200 bg-brand-50/70 px-5 py-5">
                    <p className="text-[1.0625rem] font-bold uppercase tracking-wider text-gray-600 mb-2">
                        Your booking reference
                    </p>
                    <p className="text-[1.5625rem] sm:text-3xl font-black tracking-tight text-brand-800 break-all">
                        {confirmed?.bookingRef}
                    </p>
                    <p className="text-[1.0625rem] text-gray-600 font-semibold mt-2">
                        Keep this — it is how we find your booking.
                    </p>
                </div>

                {/*
                  * DIARY IT, AND TELL SOMEBODY — in the minute after booking.
                  *
                  * A seat has just been committed to and the tab is still open,
                  * which is the one moment a calendar entry gets made. The
                  * share is here for the same reason: the colleague who should
                  * also come is thought of now, not next week.
                  *
                  * The event shape rather than the booking's, because the
                  * booking carries only a flattened copy of three of these
                  * fields.
                  */}
                {/*
                  * ============================================================
                  * THE JOIN LINK, AND THIS IS THE ONLY PLACE IT APPEARS
                  * ============================================================
                  *
                  * Withheld from the event page, the events grid and the
                  * pre-booking payload — a link on a public page is a seat
                  * given away. It arrives here because the booking reference in
                  * this URL is the proof of booking, which is the same bargain
                  * the page already makes with the amount paid and the
                  * participant names.
                  *
                  * Drawn whenever the event is online, with or without a link:
                  * an online event whose organiser has not pasted one yet must
                  * say "it is coming by email" rather than look like an
                  * in-person event missing its address.
                  */}
                {confirmed?.mode === 'online' && (
                    <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50/70 px-5 py-5 text-left">
                        <p className="text-[1.0625rem] font-extrabold uppercase tracking-widest text-emerald-700">
                            Register for this webinar
                        </p>
                        {confirmed.onlineUrl ? (
                            <>
                                <p className="mt-1.5 text-[1.25rem] font-semibold text-emerald-900">
                                    {confirmed.onlinePlatform
                                        ? `This event runs on ${confirmed.onlinePlatform}.`
                                        : 'This event is online.'}
                                </p>
                                <a
                                    href={confirmed.onlineUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl
                                               bg-emerald-600 px-5 text-[1.25rem] font-bold text-white
                                               transition-colors hover:bg-emerald-700"
                                >
                                    <Video size={16} /> Complete your registration
                                </a>
                                <p className="mt-3 break-all text-[1.25rem] font-semibold text-emerald-800/80">
                                    {confirmed.onlineUrl}
                                </p>
                                <p className="mt-2 text-[1.25rem] font-semibold text-emerald-700/80">
                                    Once you register, your personal joining link is emailed to you.
                                </p>
                            </>
                        ) : (
                            <p className="mt-1.5 text-[1.25rem] font-semibold text-emerald-900">
                                {confirmed.onlinePlatform
                                    ? `This event runs on ${confirmed.onlinePlatform}. `
                                    : 'This event is online. '}
                                The registration link will be shared with you soon.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex justify-center mt-7">
                    <EventActions event={{
                        id: event.id,
                        title: confirmed?.eventTitle || event.title,
                        description: event.description,
                        startAt: confirmed?.eventStartAt || event.startAt,
                        endAt: event.endAt,
                        venue: confirmed?.eventVenue || event.venue,
                        venueAddress: event.venueAddress,
                        venueMapUrl: confirmed?.eventMapUrl || event.venueMapUrl,
                        // No Directions button on an online event — see
                        // `directionsUrl`, which answers on the mode rather than
                        // on a venue field a switched event may still carry.
                        mode: confirmed?.mode ?? event.mode,
                        onlinePlatform: confirmed?.onlinePlatform ?? event.onlinePlatform,
                    }} />
                </div>
            </div>

            <DetailTable
                icon={<Calendar size={16} />}
                title="Event Details"
                rows={[
                    ['Event Name', confirmed?.eventTitle || event.title],
                    ['Date', formatDay(confirmed?.eventStartAt || event.startAt) || 'To be confirmed'],
                    // `DetailTable` drops a row with no value, so an online
                    // event simply has no Venue line rather than an empty one.
                    (confirmed?.mode ?? event.mode) === 'online'
                        ? ['Attend', confirmed?.onlinePlatform || event.onlinePlatform || 'Online']
                        : ['Venue', confirmed?.eventVenue || event.venue || ''],
                ]}
            />

            <DetailTable
                icon={<Ticket size={16} />}
                title="Booking Details"
                rows={[
                    ['Name', confirmed?.bookedBy.name || booker.name],
                    ['Email', confirmed?.bookedBy.email || booker.email],
                    ['Mobile', confirmed?.bookedBy.phone || nationalMobile(booker.phone)],
                    /* The rate this booking was actually taken at — read off
                       the booking, never recomputed. A member who booked at the
                       member price last spring must not have today's price
                       printed on their receipt. */
                    [
                        'Price per seat',
                        (confirmed?.unitAmount ?? 0) > 0 ? rupees(confirmed!.unitAmount) : 'Free',
                    ],
                    ['No Of Person', String(confirmed?.noOfPersons ?? count)],
                    [
                        'Payment Status',
                        confirmed?.payment.status === 'paid' ? 'Paid'
                            : confirmed?.payment.status === 'not_required' ? 'Not required'
                                : 'Pending',
                    ],
                    /*
                     * LAST, because `emphasiseLast` sets the big figure — and
                     * it was landing on the word "Paid" while the amount sat
                     * above it in body text. The money is what a receipt is
                     * read for.
                     *
                     * The SERVER's total, not the estimate this page computed.
                     * They agree in every ordinary case; where they could not
                     * is if the fee changed while the form was open, and a
                     * receipt printing the browser's arithmetic instead of what
                     * was actually charged is a receipt that is wrong.
                     */
                    [
                        'Total Amount',
                        (confirmed?.totalAmount ?? 0) > 0 ? rupees(confirmed!.totalAmount) : 'Free',
                    ],
                ]}
                emphasiseLast
            />

            <div className="flex flex-col sm:flex-row gap-3 mt-9">
                <Link to={eventsHref} className={GHOST_BUTTON}>See other events</Link>
                {!signedIn && (
                    <button
                        type="button"
                        /* Carries where to return to, so the arrow on the
                           register page is not a dead end. In the history
                           entry, not the address. */
                        onClick={() => navigate('/register', { state: { from: `/events/${id}` } })}
                        className={PRIMARY_BUTTON}
                    >
                        {/* The "option to register later" the guest card promised. */}
                        Become a member <ArrowRight size={15} />
                    </button>
                )}
            </div>
          </div>
          </div>
        </div>,
    );
}

/* ------------------------------------------------------------- components */

/**
 * One labelled input, with its error underneath.
 *
 * `data-invalid` is what `goToReview` scrolls to. An error message rendered
 * below the fold on a long form is a button that appears not to work.
 */
function Field(props: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    inputMode?: 'numeric' | 'text' | 'tel' | 'email';
    required?: boolean;
    error?: string;
    hint?: string;
    placeholder?: string;
    compact?: boolean;
    min?: number;
    max?: number;
    autoComplete?: string;
    /** Normalise on leaving the field — see the participants box. */
    onBlur?: () => void;
    /** A glyph inside the field, as the reference has it. */
    icon?: React.ReactNode;
}) {
    const {
        label, value, onChange, type = 'text', inputMode, required, error, hint,
        placeholder, compact, min, max, autoComplete, onBlur, icon,
    } = props;

    return (
        <div data-invalid={error ? 'true' : undefined}>
            <label className={FIELD_LABEL}>
                {label}
                {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
            </label>
            <div className="relative">
                {icon && (
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2
                                     text-gray-400">
                        {icon}
                    </span>
                )}
                <input
                    type={type}
                    inputMode={inputMode}
                    onBlur={onBlur}
                    min={min}
                    max={max}
                    autoComplete={autoComplete}
                    placeholder={placeholder || label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={label}
                    aria-invalid={error ? true : undefined}
                    className={
                        INPUT_CLASS
                        + (icon ? ' pl-11' : '')
                        + (compact ? ' py-2.5 text-[1.0625rem]' : '')
                        + (error ? ' border-red-300 focus:ring-red-500' : '')
                    }
                />
            </div>
            {error
                ? <p className="mt-1.5 text-[1.0625rem] font-bold text-red-600">{error}</p>
                : hint
                    ? <p className="mt-1.5 text-[1.0625rem] font-semibold text-gray-500">{hint}</p>
                    : null}
        </div>
    );
}

/**
 * A titled label/value table — the client's own "Event Details / Booking
 * Details" treatment.
 *
 * A definition list rather than a `<table>`: these are label-and-value pairs,
 * not a grid of comparable rows, and `<dl>` is what tells a screen reader that
 * "Total Amount" names the figure beside it. The participant list below IS a
 * real table and is marked up as one.
 */
function DetailTable(props: {
    title: string;
    rows: [string, string][];
    emphasiseLast?: boolean;
    /** The glyph beside the heading — the form's cards all carry one. */
    icon?: React.ReactNode;
}) {
    const { title, rows, emphasiseLast, icon } = props;

    /*
     * A ROW WITH NO VALUE IS NOT PRINTED.
     *
     * It used to render the label with an em dash beside it, so a booking that
     * named no venue said "Venue —" on the receipt the member keeps.
     */
    const kept = rows.filter(([, value]) => String(value || '').trim());
    if (!kept.length) return null;

    return (
        <section className="mb-10">
            {/*
              * WEIGHT WHERE IT MEANS SOMETHING.
              *
              * Every value here used to be extrabold navy — the email address,
              * the mobile number, the seat count — over alternating grey bands.
              * With everything emphasised nothing is, and a summary read as a
              * warning. Labels in one narrow column, values in normal weight at
              * reading size, hairlines between them, and a single tinted row
              * for the figure about to be paid.
              */}
            <h2 className="flex items-center gap-2.5 text-[1.25rem] font-extrabold tracking-tight
                           text-brand-900 mb-3">
                {icon && (
                    <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center
                                     justify-center">
                        {icon}
                    </span>
                )}
                {title}
            </h2>

            {/* No shadow: this now stands on a white sheet, and a shadowed
                white card on white is a card on a card. The hairline border
                is enough to group the rows. */}
            <dl className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {kept.map(([label, value], i) => {
                    const last = emphasiseLast && i === kept.length - 1;
                    return (
                        <div
                            key={label}
                            className={
                                'flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 '
                                + 'px-5 sm:px-6 py-3.5 border-b border-gray-100 last:border-0 '
                                + (last ? 'bg-brand-50/60' : '')
                            }
                        >
                            {/* A step darker. `gray-500` on white is the grey
                                a disabled control uses, and a receipt's labels
                                are not disabled. */}
                            <dt className="text-[1.0625rem] font-bold uppercase tracking-[0.08em]
                                           text-gray-600 sm:w-44 shrink-0">
                                {label}
                            </dt>
                            <dd
                                className={
                                    'min-w-0 break-words '
                                    + (last
                                        ? 'text-[1.5rem] font-extrabold tracking-tight text-brand-800'
                                        /* `font-medium text-slate-800` read as washed
                                           out beside the headings above it. This is the
                                           answer somebody is checking before paying, and
                                           reading back off a screenshot months later. */
                                        : 'text-[1.1875rem] sm:text-[1.3125rem] font-semibold text-brand-900')
                                }
                            >
                                {value}
                            </dd>
                        </div>
                    );
                })}
            </dl>
        </section>
    );
}

