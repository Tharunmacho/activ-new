import { EventMediaFiles } from '@/components/shared/EventMediaFiles';
import { PosterFrame } from '@/components/shared/PosterFrame';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Calendar, Clock, MapPin, Phone, Mail, User, Users, ExternalLink,
    Timer, Lock, Video,
} from 'lucide-react';
import {
    getCmsEvent, getCmsEvents, getEventsSettings,
    type CmsEvent, type EventsSettings,
} from '@/services/cmsApi';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import EventPriceTiers from '@/components/shared/EventPriceTiers';
import EventActions from '@/components/shared/EventActions';
import { countdownLabel, eventPhase } from '@/lib/eventCalendar';
import { getBookableEvent, type BookableEvent } from '@/services/eventBookingApi';
import { SCREEN_CONTAINER } from '@/components/layout/pageContainer';
import { SECTION_HEADING, SECTION_LEDE, MICRO_LABEL } from '@/components/layout/typography';
import {
    SHEET, BIZ_CARD, BIZ_CARD_TITLE, BIZ_BADGE, BIZ_WELL,
    BIZ_DETAIL_LABEL, BIZ_DETAIL_VALUE,
} from '@/components/layout/surface';
import { Reveal } from '@/components/shared/Reveal';
import { eventPath } from '@/lib/eventPath';
import { setShareMeta } from '@/lib/shareMeta';
import { EventQrFeature } from '@/components/shared/EventQr';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * One event, in full.
 *
 * Where an events card goes when it is clicked, on the home page or on
 * `/events`. The Event model has carried an agenda, a speaker list, a venue
 * address, contact details and registration terms since it was written, and
 * until now the public site rendered a title, a date and a location — the rest
 * was captured in the CMS and shown to nobody.
 *
 * The same shape as the gallery poster page on purpose: a visitor who has
 * opened one knows how to read the other, and the two pages share their
 * skeleton, their missing-item state and their related row.
 *
 * ------------------------------------------------------------ the surface
 *
 * Everything below the banner sits on the tinted `SHEET` in white `BIZ_CARD`s —
 * the same surface the booking flow this page hands off to uses, and the same
 * one the member meets creating their business account. See
 * `components/layout/surface.ts`.
 *
 * It was white panels on a white page before, separated by a `brand-100/70`
 * hairline at 70% opacity, which at reading distance is no separation at all:
 * the side card, the speaker boxes and the document were one continuous sheet
 * of white and the page read as unfinished rather than as calm.
 */

/**
 * The side card's button, shared by its internal and external forms.
 *
 * The navy pill the booking flow opens with, so pressing this and landing on
 * "Continue as guest" is one control repeated rather than two that resemble
 * each other.
 */
const CTA_CLASS =
    'mt-5 w-full inline-flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-700 ' +
    'text-white px-6 py-3.5 rounded-full font-bold text-[1rem] uppercase tracking-[0.1em] transition-colors';

/** "Tue, 20 Jan 2024" — the date as it reads on the page. */
const formatDay = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
};

/** "10:30" — empty when the event carries no time of day. */
/**
 * A time a reader can act on — "09:00 AM", not "09:00".
 *
 * `en-GB` with no `hour12` is a 24-hour clock, so a conference running
 * 9am to 5pm printed as "09:00 – 05:00": the end reads as earlier than the
 * start, and the one thing the row exists to say — morning or evening — is
 * the thing it does not say. Reported exactly that way.
 *
 * `hour12: true` rather than switching locale, so the date formatting either
 * side of it is untouched.
 */
const formatTime = (iso?: string | null): string => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
        .toUpperCase();
};

/**
 * An Indian mobile as a reader dials it: "+91 82201 12188".
 *
 * Only a ten-digit mobile, or one already carrying 91, is reformatted. A
 * trunk zero is dropped — "09940175051" is eleven digits beginning with a
 * 0, which is how it is dialled inside India and is wrong with a country
 * code in front of it. Anything else is returned untouched, because a
 * landline or a foreign number is not this shape and guessing would mangle
 * it.
 */
const formatPhone = (value?: string | null): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const digits = raw.replace(/\D/g, '');
    const national = digits.length === 12 && digits.startsWith('91')
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith('0')
            ? digits.slice(1)
            : digits;

    /*
     * AN INDIAN MOBILE STARTS 6, 7, 8 OR 9, and that check is what keeps a
     * landline out. "044 2851 1234" is eleven digits beginning with a trunk
     * zero, so the rule above strips it to ten — and without this it would be
     * printed as "+91 44285 11234", a mobile number that does not exist, in
     * place of a switchboard somebody is meant to ring.
     */
    if (national.length !== 10 || !/^[6-9]/.test(national)) return raw;
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
};

/** The facts list joins multi-line values with this. */
const NEWLINE = String.fromCharCode(10);

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();

    const [event, setEvent] = useState<CmsEvent | null>(null);
    const [related, setRelated] = useState<CmsEvent[]>([]);
    const [settings, setSettings] = useState<EventsSettings | null>(null);
    /**
     * The LIVE booking position - seats taken, seats left, whether the deadline
     * has passed, and what THIS reader would be charged.
     *
     * A second call rather than more fields on the CMS event, because it is the
     * same resolver the booking page uses. Two endpoints answering "how many
     * seats are left" is how a page comes to promise a seat the checkout then
     * refuses. Null until it lands, and null for ever if it fails.
     */
    const [availability, setAvailability] = useState<BookableEvent | null>(null);
    const [loading, setLoading] = useState(true);
    const [missing, setMissing] = useState(false);
    // Portrait poster? Decided from the loaded image; see the banner below.
    const [bannerTall, setBannerTall] = useState(false);

    /*
     * ONE ADDRESS PER EVENT. Opened by its old id link, the address bar is
     * swapped for the readable one (`/events/<slug>`) without a reload, so the
     * link a visitor copies from here is the one worth sharing.
     */
    useEffect(() => {
        /*
         * ONLY when this page was opened by THIS event's old id. Moving from one
         * event to another renders once with the new `id` and the previous
         * `event` still in state; comparing slugs alone then wrote the previous
         * event's address over the new one.
         */
        if (!event?.slug || !id || id !== event.id) return;
        try {
            window.history.replaceState(window.history.state, '', `${eventPath(event)}${window.location.search}`);
        } catch {
            /* the old address still works */
        }
    }, [event, id]);

    // The share tags for this event; see lib/shareMeta and server.mjs.
    useEffect(() => {
        if (!event) return undefined;
        return setShareMeta({
            title: event.title || 'ACTIV event',
            description: event.description || '',
            image: event.imageUrl || '',
            url: `${window.location.origin}${eventPath(event)}`,
            type: 'article',
        });
    }, [event]);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setMissing(false);
        setEvent(null);
        setBannerTall(false);
        // Arriving from a card lower down the previous page would otherwise open
        // this one already scrolled past its own banner.
        window.scrollTo({ top: 0, behavior: 'auto' });

        getEventsSettings()
            .then(config => { if (!cancelled) setSettings(config); })
            .catch(() => { /* the labels fall back to their defaults */ });

        getCmsEvent(String(id || ''))
            .then((found) => {
                if (cancelled) return;
                setEvent(found);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setMissing(true);
                setLoading(false);
            });

        // Silent by design: the page was complete before this existed, and an
        // availability call that fails must not blank an event listing.
        setAvailability(null);
        getBookableEvent(String(id || ''))
            .then((live) => { if (!cancelled) setAvailability(live); })
            .catch(() => { /* the seat meter is simply not drawn */ });

        // Only for the row at the foot of the page, so its failure is silent.
        getCmsEvents()
            .then((list) => { if (!cancelled) setRelated(list || []); })
            .catch(() => { /* the row is simply not drawn */ });

        return () => { cancelled = true; };
    }, [id]);

    // ---------------------------------------------------------------- states

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-20 animate-pulse flex-grow`}>
                    <div className="h-4 w-32 bg-slate-200 rounded mb-10" />
                    <div className="h-[22rem] md:h-[30rem] bg-slate-200 rounded-3xl mb-10" />
                    <div className="h-8 w-2/3 bg-slate-200 rounded mb-4" />
                    <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                    <div className="h-4 w-5/6 bg-slate-200 rounded" />
                </div>
                <FooterSection />
            </div>
        );
    }

    if (missing || !event) {
        return (
            <div className="flex flex-col min-h-screen font-sans dot-band">
                <HeaderSection />
                <div className={`${SCREEN_CONTAINER} py-24 flex-grow text-center`}>
                    <h1 className={`${SECTION_HEADING} text-brand-800 mb-4`}>Not found</h1>
                    <p className={`${SECTION_LEDE} text-gray-500 mb-8`}>
                        This event is no longer listed.
                    </p>
                    <Link
                        to="/events"
                        className="inline-flex items-center gap-2 bg-brand-800 hover:bg-brand-700 text-white
                                   px-8 py-3.5 rounded-full font-bold text-[1rem] uppercase tracking-[0.1em]
                                   transition-colors"
                    >
                        <ArrowLeft size={15} /> Back to Events
                    </Link>
                </div>
                <FooterSection />
            </div>
        );
    }

    // ---------------------------------------------------------------- content

    /*
     * ONLINE OR IN PERSON. Anything but an explicit `online` is in person,
     * which is every event written before the field existed.
     */
    const isOnline = event.mode === 'online';

    const flatAgenda = (event.agenda || []).filter(row => row && (row.title || row.startTime));

    /*
     * ==================================================================
     * THE PROGRAMME, DAY BY DAY — but only when there IS more than one
     * ==================================================================
     *
     * `days` is empty on a single-day event and on everything written before
     * the field existed, and in that case nothing below changes: the flat
     * `agenda` is drawn exactly as it always was, with no day headings. A
     * "Day 1" over the only day of a one-day event is furniture describing
     * nothing, and the association asked for it not to appear.
     *
     * A day is kept when it has hours of its own OR sessions of its own. A day
     * with neither is a row the editor never filled in — printing an empty
     * "Day 2" would read as a day with nothing happening on it rather than as
     * a day nobody has written up yet.
     */
    const days = (event.days || []).filter(d => d && d.date
        && (d.startTime || d.endTime || (d.agenda || []).some(r => r && (r.title || r.startTime))));
    /*
     * DAY HEADINGS WHENEVER THE EVENT ITSELF SPANS SEVERAL DAYS — counted on
     * the event's days, not on the ones with content.
     *
     * This read `days.length > 1` AFTER the empty days were filtered out, so a
     * two-day event whose editor had filled in only Day 1 counted as one day,
     * fell through to the flat `agenda` (empty on every event written with the
     * day editor) and showed NO programme at all — the sessions were saved and
     * simply never drawn.
     */
    const perDay = days.length > 0 && (event.days || []).filter(d => d && d.date).length > 1;

    /* A one-day event written with the day editor keeps its sessions on that
       day, not in the flat agenda — so they are the programme when the flat
       list is empty. */
    const agenda = flatAgenda.length
        ? flatAgenda
        : (days[0]?.agenda || []).filter(row => row && (row.title || row.startTime));

    /** "Sat, 10 Oct 2026" — the wording the facts list uses for a date. */
    const dayHeading = (iso: string) => {
        const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        });
    };

    /** "09:30" -> "09:30 AM". The stored value is a 24-hour string. */
    const clock = (hhmm?: string) => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
        if (!m) return '';
        const h = Number(m[1]);
        const meridiem = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${String(h12).padStart(2, '0')}:${m[2]} ${meridiem}`;
    };

    /** "09:30 AM – 05:00 PM", or just the one that was given. */
    const span = (from?: string, to?: string) => {
        const a = clock(from);
        const b = clock(to);
        if (a && b) return `${a} – ${b}`;
        return a || b || '';
    };
    const speakers = (event.speakers || []).filter(person => person && person.name);
    const day = formatDay(event.startAt);
    /*
     * The last day, and only when it is a DIFFERENT day.
     *
     * `endAt` carries the finishing time of a single-day event as well, so
     * comparing the formatted days rather than the instants is what keeps a
     * one-day conference from reading as "12 Oct - 12 Oct".
     */
    const lastDay = formatDay(event.endAt);
    const runsOverDays = !!lastDay && lastDay !== day;
    const startTime = formatTime(event.startAt);
    const endTime = formatTime(event.endAt);

    /* ------------------------------------------------- the booking position
     *
     * Derived ABOVE the facts list because the list needs it: "Book by" is a
     * fact about the event like the date and the venue, and it is drawn only
     * while the deadline is still ahead. It used to hang below the seat meter
     * in markup of its own, one indent out of step with the four rows above it.
     */
    const capacity = Number(availability?.capacity || 0);
    const capped = capacity > 0;
    const seatsLeft = capped ? Math.max(0, Number(availability?.seatsLeft || 0)) : null;
    const soldOut = capped && seatsLeft === 0;
    // `closed` is the server's answer about the deadline; it is not derived
    // here, because the deadline is applied in the timezone the server keeps.
    const bookingClosed = !!availability?.closed;
    const takenPercent = capped
        ? Math.min(100, Math.round(((capacity - Number(seatsLeft)) / capacity) * 100))
        : 0;
    // Under a quarter left is worth saying out loud. Above it, a bar is enough
    // - an urgency line on a half-empty hall is the kind of claim that stops
    // being believed the second time somebody reads it.
    const fillingFast = capped && !soldOut && Number(seatsLeft) <= Math.max(1, capacity * 0.25);

    const deadline = formatDay(event.registrationDeadline);

    const facts = [
        day ? {
            icon: <Calendar size={16} />,
            label: runsOverDays ? 'Dates' : 'Date',
            /* A three-day conclave says so here. Printing only the first day
               tells somebody booking travel they need one night. */
            value: runsOverDays ? `${day} – ${lastDay}` : day,
        } : null,
        /*
         * ONE ROW PER DAY when the days differ, one row when they do not.
         *
         * A three-day conclave printed a single "09:00 – 05:00" here, which is
         * the hours of nothing in particular — day one opens late and day three
         * closes at lunch. Worse, it was a 24-hour clock, so the end read as
         * earlier than the start. The facts list joins multi-line values on
         * `NEWLINE`, so each day gets its own line under the one heading.
         */
        /* Only when at least one day HAS hours — `.filter(Boolean)` below drops
           a null entry but keeps an object whose value is an empty string,
           which would draw a "Times" heading with nothing under it. */
        (perDay && days.some(d => span(d.startTime, d.endTime))) ? {
            icon: <Clock size={16} />,
            label: 'Times',
            value: days
                .map((d, i) => {
                    const hours = span(d.startTime, d.endTime);
                    /* "Day 1 : 10:30 AM – 05:00 PM". Two spaces read as a
                       ragged gap once the day numbers reach double figures;
                       a colon is what makes it a label and its value. */
                    return hours ? `Day ${i + 1} : ${hours}` : '';
                })
                .filter(Boolean)
                .join(NEWLINE),
        } : startTime ? {
            icon: <Clock size={16} />,
            label: 'Time',
            // An end time is optional — many events are announced without one.
            value: endTime ? `${startTime} – ${endTime}` : startTime,
        } : null,
        /*
         * WHERE, AND IT IS TWO DIFFERENT ANSWERS.
         *
         * An online event has no venue row — printing one would have a reader
         * looking for an address that does not exist — and an offline one has
         * no platform row. The mode decides which, not the presence of the
         * fields: an event switched from in-person to online keeps whatever
         * address was typed before, and reading the fields would show both.
         */
        isOnline ? {
            icon: <Video size={16} />,
            label: 'Online event',
            value: event.onlinePlatform
                ? `Joining link on ${event.onlinePlatform}`
                : 'Attend from anywhere — a joining link is sent to everyone who books',
        } : (event.venue || event.location) ? {
            icon: <MapPin size={16} />,
            label: 'Venue',
            value: event.venueAddress
                ? `${event.venue || event.location}\n${event.venueAddress}`
                : (event.venue || event.location),
        } : null,
        /*
         * ======================================================================
         * THREE ROWS, NOT ONE BLOCK — a number needs to say it is a number
         * ======================================================================
         *
         * This was one "Contact" row with the name, the number and the address
         * stacked inside it as plain lines. A reader met a bare string of
         * digits and a bare email with nothing naming either, which is exactly
         * what was reported: "before the number I should get the field as
         * phone, and before the email address the field as email".
         *
         * Split into their own rows, each keeps the label and the icon the
         * facts list already gives every other fact — so PHONE and EMAIL read
         * the same way DATES and VENUE do, with no new furniture invented for
         * them. They are also `href`ed now: a number on a phone is something to
         * tap, and printing it as dead text makes the reader copy it by hand.
         */
        event.contactName ? {
            icon: <User size={16} />,
            label: 'Contact',
            value: event.contactName,
        } : null,
        event.contactPhone ? {
            icon: <Phone size={16} />,
            label: 'Phone',
            value: formatPhone(event.contactPhone),
            href: `tel:${String(event.contactPhone).replace(/[^\d+]/g, '')}`,
        } : null,
        event.contactEmail ? {
            icon: <Mail size={16} />,
            label: 'Email',
            value: event.contactEmail,
            href: `mailto:${event.contactEmail}`,
        } : null,
        /*
         * The static capacity, ONLY until the live meter arrives.
         *
         * Once `availability` has landed the side card draws seats taken
         * against seats left, which says everything this row said and more.
         * Printing both puts "60" three centimetres above "12 of 60 left" and
         * asks the reader to work out that they are the same event.
         */
        (event.capacity && !availability) ? {
            icon: <Users size={16} />,
            label: 'Seats',
            value: String(event.capacity),
        } : null,
        /*
         * WHEN BOOKING SHUTS — a fact, in the facts list.
         *
         * The deadline was captured in the CMS and shown to nobody, so the
         * first a visitor heard of it was the checkout turning them away. Not
         * drawn once it has passed: the button says so by then, and a date that
         * has gone reads as an invitation.
         */
        /*
         * "REGISTRATION CLOSES", not "Book by".
         *
         * Every other row in this list is a LABEL and its value — DATES, TIMES,
         * VENUE, PHONE. "Book by" is an instruction, so beside them it read as
         * the start of a sentence the date finished, and a visitor scanning
         * the column had to stop and re-read it.
         *
         * It also says the right thing for an event that is not charging. The
         * label is what the date IS — the last day the list is open — rather
         * than an order to the reader, and it matches the wording of the
         * deadline field in the CMS.
         */
        (deadline && !bookingClosed) ? {
            icon: <Clock size={16} />,
            label: event.registrationFee && Number(event.registrationFee) > 0
                ? 'Book before'
                : 'Register before',
            value: deadline,
        } : null,
    ].filter(Boolean) as {
        icon: React.ReactNode; label: string; value: string;
        /** Set where the value is something to tap — a number, an address. */
        href?: string;
    }[];

    const countdown = countdownLabel(event.startAt);
    /*
     * Ahead, on, or over - and an end time is respected where there is one.
     * Deciding this from the start time alone called a running event finished.
     */
    const phase = eventPhase(event);
    const hasPassed = phase === 'past';
    const isLive = phase === 'live';

    /* Same category first, then anything else — and never this event itself. */
    const others = (related || []).filter(e => e.id !== event.id);
    const sameCategory = event.category ? others.filter(e => e.category === event.category) : [];
    const moreEvents = [...sameCategory, ...others.filter(e => !sameCategory.includes(e))].slice(0, 4);

    return (
        <div className="flex flex-col min-h-screen font-sans dot-band">
            <HeaderSection />

            <main className="flex-grow">
                <section className="w-full pt-10 pb-16 md:pt-14 md:pb-24 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50/60 rounded-full blur-3xl transform-gpu
                                    -z-10 translate-x-1/3 -translate-y-1/3 transform-gpu pointer-events-none" />

                    <div className={`${SCREEN_CONTAINER} relative z-10`}>

                        {/* A control, not a caption — the booking flow's own
                            "Back to event" link, so the two steps offer the same
                            way out. */}
                        <Link
                            to="/events"
                            className="inline-flex items-center gap-2 -ml-3 px-3 py-2 rounded-lg
                                       text-[1.125rem] font-bold text-slate-600 hover:text-brand-800
                                       hover:bg-brand-50 transition-colors mb-6"
                        >
                            <ArrowLeft size={16} /> Back to Events
                        </Link>

                        {/* ---- the banner ---- */}
                        {event.media?.url && (
                            <Reveal>
                                <div className={`${BIZ_CARD} overflow-hidden p-0 rounded-[1.75rem]`}>
                                    {/*
                                      * 16/9, not a fixed 30rem strip.
                                      *
                                      * A tall poster or a screenshot dropped
                                      * into a 480px band is cropped through its
                                      * middle — the live page was showing the
                                      * top third of somebody's screenshot with
                                      * the heading sliced off, which reads as a
                                      * broken image rather than as a crop. An
                                      * aspect ratio keeps the same shape at
                                      * every width and matches the card the
                                      * visitor clicked to get here.
                                      */}
                                    {/*
                                      * TALLER, and the whole poster is visible.
                                      *
                                      * 30rem cropped a 16:9 banner on any screen
                                      * wider than about 1330px — the frame kept
                                      * the ratio, the height cap overrode it, and
                                      * the sides were cut. 38rem lets a 1600px
                                      * banner show at its full width on a laptop.
                                      *
                                      * `contain` on a tinted ground, so an image
                                      * that is NOT 16:9 is shown whole rather
                                      * than cropped through its middle. A poster
                                      * with the date along the bottom loses the
                                      * date under `cover`, and that was the
                                      * complaint: the image has to fit the frame,
                                      * not the frame the image. An editor who
                                      * wants edge-to-edge still sets Fit to
                                      * "cover" on the banner and gets it.
                                      */}
                                    {/*
                                      * THE POSTER'S OWN SHAPE. A fixed 16/9 box
                                      * with a 38rem cap stopped being 16/9 on any
                                      * screen wider than ~1080px, and the poster
                                      * was cropped top and bottom — its logo and
                                      * footer strip cut off. An image is now drawn
                                      * full width at its own height, whole, and
                                      * only a very tall poster is capped (85vh)
                                      * and shown whole inside that. Video keeps
                                      * the 16/9 frame it needs.
                                      */}
                                    {event.media.type === 'video' ? (
                                        <div className="w-full aspect-[16/9] bg-slate-50">
                                            <CmsMediaFrame
                                                media={{ ...event.media, fit: event.media.fit || 'contain' }}
                                                priority
                                                width={1600}
                                            />
                                        </div>
                                    ) : (
                                        /*
                                         * FILLS THE CARD. A landscape or square
                                         * poster has no height cap: full width,
                                         * its own height, edge to edge. A cap on
                                         * it (85vh) shrank a 16:9 banner on a
                                         * laptop and left white bands either side.
                                         *
                                         * Only a PORTRAIT poster is capped, so it
                                         * cannot run several screens tall; its
                                         * sides are then the same poster blurred,
                                         * never an empty plate.
                                         */
                                        <div className={`relative w-full overflow-hidden ${bannerTall ? "bg-slate-900" : "bg-slate-100"}`}>
                                            {bannerTall && (
                                                <img
                                                    src={resolveMediaUrl(event.media.url)}
                                                    alt=""
                                                    aria-hidden="true"
                                                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
                                                />
                                            )}
                                            <CmsMediaFrame
                                                media={event.media}
                                                natural
                                                className={`relative ${bannerTall ? 'max-h-[85vh]' : ''}`}
                                                onNaturalSize={(w, h) => setBannerTall(h > w * 1.05)}
                                                priority
                                                width={1600}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Reveal>
                        )}

                        {/* ---- title and facts ---- */}
                        {/*
                          * THE SHEET THE CARDS STAND ON.
                          *
                          * Everything from here down was white on white with a
                          * 70%-opacity hairline between the layers, which is not
                          * a layer. One tinted sheet, and the cards on it have an
                          * edge without any of them being outlined more heavily.
                          */}
                        <div className={`${SHEET} mt-10`}>
                        <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">

                            <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
                            <div className={`${BIZ_CARD} p-6 sm:p-8 min-w-0`}>
                                {event.category && (
                                    <span className={`${BIZ_BADGE} bg-brand-50 text-brand-700 border border-brand-100 mb-5`}>
                                        {event.category}
                                    </span>
                                )}

                                <h1 className={`${SECTION_HEADING} text-brand-800 mb-5 break-words [overflow-wrap:anywhere] hyphens-auto`}>
                                    {/* Never an empty heading - the same fallback
                                        the cards use, because nothing on the
                                        event form is required. */}
                                    {event.title || 'Untitled event'}
                                </h1>

                                {/*
                                  * HOW SOON, AND HOW FULL - one line, above the
                                  * description.
                                  *
                                  * A date in a sidebar is a fact to be looked
                                  * up; "In 6 days" beside the title is a fact
                                  * that has already been read. The two chips
                                  * answer the questions somebody skims for
                                  * before deciding whether to read the rest,
                                  * and each is drawn only when it has something
                                  * to say.
                                  */}
                                {(countdown || hasPassed || isLive || fillingFast || soldOut) && (
                                    <div className="flex flex-wrap items-center gap-2 mb-6">
                                        {hasPassed ? (
                                            <span className={`${BIZ_BADGE} bg-slate-100 text-slate-500 normal-case tracking-normal`}>
                                                <Timer size={13} /> This event has taken place
                                            </span>
                                        ) : isLive ? (
                                            /* A live event gets the one chip on
                                               the page that moves, because
                                               "happening now" is the only state
                                               a reader might act on this
                                               minute. */
                                            <span className={`${BIZ_BADGE} bg-emerald-50 text-emerald-700 border border-emerald-100 normal-case tracking-normal`}>
                                                <span className="relative flex h-2 w-2">
                                                    <span className="absolute inline-flex h-full w-full animate-ping
                                                                     rounded-full bg-emerald-400 opacity-75" />
                                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                </span>
                                                Happening now
                                            </span>
                                        ) : countdown && (
                                            <span className={`${BIZ_BADGE} bg-brand-50 text-brand-700 border border-brand-100 normal-case tracking-normal`}>
                                                <Timer size={13} /> {countdown}
                                            </span>
                                        )}
                                        {soldOut ? (
                                            <span className={`${BIZ_BADGE} bg-rose-50 text-rose-700 border border-rose-100 normal-case tracking-normal`}>
                                                <Users size={13} /> Fully booked
                                            </span>
                                        ) : fillingFast && (
                                            <span className={`${BIZ_BADGE} bg-amber-50 text-amber-800 border border-amber-100 normal-case tracking-normal`}>
                                                <Users size={13} /> Only {seatsLeft} seats left
                                            </span>
                                        )}
                                    </div>
                                )}

                                {event.description && (
                                    <p className="text-[1.25rem] sm:text-[1.375rem] leading-relaxed font-medium text-slate-600
                                                  whitespace-pre-line mb-6">
                                        {event.description}
                                    </p>
                                )}

                                {/*
                                  * DIARY, SHARE, DIRECTIONS.
                                  *
                                  * Under the description and above the
                                  * programme, which is where a reader is when
                                  * they have decided they are interested and
                                  * have not decided they are ready to book.
                                  * That reader used to have nothing to press.
                                  */}
                                <EventActions event={event} className="mb-8" />

                                {/* ---- programme ----

                                    DAY BY DAY when the event runs over more than
                                    one, and exactly as it always was when it does
                                    not. See `days` above: a single-day event gets
                                    no "Day 1" heading, because a day label over
                                    the only day of an event says nothing.
                                */}
                                {perDay ? (
                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <h2 className={`${BIZ_CARD_TITLE} mb-5`}>Programme</h2>
                                        <div className="space-y-8">
                                            {days.map((day, d) => {
                                                const rows = (day.agenda || [])
                                                    .filter(r => r && (r.title || r.startTime));
                                                const hours = span(day.startTime, day.endTime);
                                                return (
                                                    <section key={day.id || day.date || d}>
                                                        {/* Which day it is, the date, and its hours. */}
                                                        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                            <span className="inline-flex items-center rounded-lg bg-brand-50
                                                                             px-2.5 py-1 text-[1.0625rem] font-bold
                                                                             uppercase tracking-wide text-brand-700">
                                                                Day {d + 1}
                                                            </span>
                                                            <span className="text-[1.25rem] font-bold text-slate-900">
                                                                {dayHeading(day.date)}
                                                            </span>
                                                            {hours && (
                                                                <span className="text-[1.125rem] font-semibold text-slate-500">
                                                                    {hours}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {rows.length > 0 ? (
                                                            <ol className="border-l-2 border-slate-200 pl-5 space-y-6">
                                                                {rows.map((row, i) => (
                                                                    <li key={row.id || i} className="relative">
                                                                        <span className="absolute -left-[1.6875rem] top-1.5 w-3 h-3 rounded-full
                                                                                         bg-brand-600 ring-4 ring-white" />
                                                    {(row.startTime || row.endTime) && (
                                                                            <p className={`${BIZ_DETAIL_LABEL} mb-1`}>
                                                                                {span(row.startTime, row.endTime)}
                                                                            </p>
                                                                        )}
                                                                        <p className="text-[1.25rem] font-bold text-slate-900">{row.title}</p>
                                                                        {row.description && (
                                                                            <p className="text-[1.25rem] text-slate-500 mt-1 whitespace-pre-line">
                                                                                {row.description}
                                                                            </p>
                                                                        )}
                                                                        {(row.speaker || row.location) && (
                                                                            <p className={`${BIZ_DETAIL_LABEL} mt-1.5`}>
                                                                                {[row.speaker, row.location].filter(Boolean).join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ol>
                                                        ) : (
                                                            /* Hours but no sessions is a real state: the day
                                                               is settled and the programme is not written
                                                               yet. Say so, rather than leave a heading with
                                                               nothing under it. */
                                                            <p className="pl-5 text-[1.1875rem] text-slate-400">
                                                                The programme for this day is still being confirmed.
                                                            </p>
                                                        )}
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : agenda.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <h2 className={`${BIZ_CARD_TITLE} mb-5`}>Programme</h2>
                                        <ol className="border-l-2 border-slate-200 pl-5 space-y-6">
                                            {agenda.map((row, i) => (
                                                <li key={row.id || i} className="relative">
                                                    {/* The dot sits on the rule, so the times read as a
                                                        timeline rather than as a table with a stray border. */}
                                                    <span className="absolute -left-[1.6875rem] top-1.5 w-3 h-3 rounded-full
                                                                     bg-brand-600 ring-4 ring-white" />
                                                    {(row.startTime || row.endTime) && (
                                                        <p className={`${BIZ_DETAIL_LABEL} mb-1`}>
                                                            {span(row.startTime, row.endTime)}
                                                        </p>
                                                    )}
                                                    <p className="text-[1.25rem] font-bold text-slate-900">{row.title}</p>
                                                    {row.description && (
                                                        <p className="text-[1.25rem] text-slate-500 mt-1 whitespace-pre-line">
                                                            {row.description}
                                                        </p>
                                                    )}
                                                    {(row.speaker || row.location) && (
                                                        <p className={`${BIZ_DETAIL_LABEL} mt-1.5`}>
                                                            {[row.speaker, row.location].filter(Boolean).join(' · ')}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* ---- speakers ---- */}
                                {speakers.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <h2 className={`${BIZ_CARD_TITLE} mb-5`}>Speakers</h2>
                                        {/*
                                          * `auto-fit` rather than a fixed two
                                          * columns.
                                          *
                                          * A single speaker took half the width
                                          * and left the other half empty — a
                                          * bordered box with one name in it,
                                          * which reads as a card that failed to
                                          * fill. The track collapses to the
                                          * content when there is one, and still
                                          * gives two or three a row.
                                          */}
                                        {/* 18rem, not 15rem: the portrait grew to 5.5rem and
                                            a designation runs to three lines beside it, so the
                                            old track squeezed "Minister for Social Justice
                                            Department, Government of Tamilnadu" into a column
                                            of single words. */}
                                        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fit,minmax(18rem,max-content))]">
                                            {speakers.map((person, i) => (
                                                <div
                                                    key={person.id || i}
                                                    /* A tinted well inside the card, not a second
                                                       card: `slate-50` on white is the same step
                                                       down the sheet is from the page. */
                                                    className="flex items-start gap-3 sm:gap-4 rounded-xl border border-slate-200
                                                               bg-slate-50 p-3.5 sm:p-4"
                                                >
                                                    {/*
                                                      * A PORTRAIT BIG ENOUGH TO BE A FACE.
                                                      *
                                                      * 3.5rem is a thumbnail — at that size a
                                                      * minister is a smudge, and the card read
                                                      * as a list item rather than as somebody
                                                      * worth turning up for. 5.5rem is the
                                                      * smallest a head reads at across a
                                                      * two-column row.
                                                      *
                                                      * `fit: 'cover'` and `position: 'top'`,
                                                      * explicitly. A portrait is taller than it
                                                      * is wide, so fitting the WHOLE image into
                                                      * a circle would pad the sides and leave a
                                                      * small head in a large ring. Cover fills
                                                      * the circle; anchoring to the top is what
                                                      * keeps the face in it, because a centred
                                                      * crop of a standing photograph is a chest.
                                                      *
                                                      * `width` is twice the rendered size, so a
                                                      * retina screen gets a sharp portrait.
                                                      */}
                                                    <div className="w-16 h-16 sm:w-[5.5rem] sm:h-[5.5rem] rounded-full overflow-hidden bg-white
                                                                    border border-slate-200 shrink-0 flex items-center
                                                                    justify-center">
                                                        {person.photoUrl
                                                            ? (
                                                                <CmsMediaFrame
                                                                    media={{
                                                                        url: person.photoUrl,
                                                                        fit: 'cover',
                                                                        position: 'top',
                                                                    }}
                                                                    width={176}
                                                                />
                                                            )
                                                            : <User size={30} className="text-slate-400" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[1.25rem] font-bold text-slate-900">{person.name}</p>
                                                        {(person.role || person.organization) && (
                                                            <p className="text-[1.1875rem] font-semibold text-slate-500 mt-0.5">
                                                                {[person.role, person.organization].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                        {person.bio && (
                                                            <p className="text-[1.25rem] text-slate-500 mt-2">{person.bio}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                                {/*
                                  * THE EVENT'S QR — a feature card of its own in
                                  * the wide column, under the programme and the
                                  * speakers, where there is room for a code a
                                  * phone reads from across a room. Hidden when
                                  * the editor turned it off.
                                  */}
                                {/* The event's video and agenda / documents, when it has any. */}
                                <EventMediaFiles videoUrl={event.videoUrl} attachments={event.attachments} />
                                {event.showQrOnPage !== false && <EventQrFeature event={event} />}
                            </div>

                            {/* ---- the side card ---- */}
                            <aside className={`${BIZ_CARD} p-6 sm:p-7 lg:sticky lg:top-28 min-w-0`}>
                                {/*
                                  * ONE ROW SHAPE, REPEATED.
                                  *
                                  * Each fact was its own `flex … mb-5` block and
                                  * "Book by" was a fourth variation of the same
                                  * markup further down the card, so the rows sat
                                  * at four different rhythms and the labels did
                                  * not line up with each other. One list, one
                                  * padding, one divider — and the deadline is a
                                  * fact in it like the rest.
                                  */}
                                <ul className="divide-y divide-slate-100">
                                {facts.map((fact, i) => (
                                    <li key={`${fact.label}-${i}`}
                                        className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0">
                                        <span className="mt-0.5 h-9 w-9 rounded-xl bg-slate-100 text-slate-600
                                                         flex items-center justify-center shrink-0">
                                            {fact.icon}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className={BIZ_DETAIL_LABEL}>{fact.label}</p>
                                            {/*
                                              * A NUMBER AND AN ADDRESS ARE
                                              * TAPPABLE, in the one place they
                                              * are printed.
                                              *
                                              * The duplicate rows below the
                                              * Book button existed because this
                                              * list rendered plain text and
                                              * somebody wanted a link. Removing
                                              * the duplicate without adding the
                                              * links here would have taken a
                                              * working feature away — so each
                                              * line of the Contact fact is
                                              * matched and wrapped, and every
                                              * other fact prints as before.
                                              */}
                                            <p className={`${BIZ_DETAIL_VALUE} mt-1 break-words whitespace-pre-line`}>
                                                {/*
                                                  * THE ROW SAYS WHETHER IT IS A LINK.
                                                  *
                                                  * This matched each line of the
                                                  * Contact block against a regex to
                                                  * guess "is that a phone number".
                                                  * Phone and Email are rows of their
                                                  * own now, each carrying its own
                                                  * `href`, so the guess is gone —
                                                  * along with the case it got wrong:
                                                  * a venue name with digits in it
                                                  * came out as a telephone link.
                                                  */}
                                                {fact.href
                                                    ? (
                                                        <a
                                                            href={fact.href}
                                                            className="hover:text-brand-700 transition-colors"
                                                        >
                                                            {fact.value}
                                                        </a>
                                                    )
                                                    : fact.value}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                                </ul>

                                {/*
                                  * SEATS, DRAWN RATHER THAN STATED.
                                  *
                                  * "60" told a reader the size of the room.
                                  * This tells them whether they can still get
                                  * in, which is the only thing the number was
                                  * ever being read for. The bar is the part
                                  * that is understood without being read.
                                  *
                                  * Only on a capped event: a bar on an uncapped
                                  * one would be a progress meter with no end,
                                  * and `seatsLeft` there is MAX_SAFE_INTEGER.
                                  */}
                                {capped && (
                                    <div className={`${BIZ_WELL} mt-5`}>
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                            <p className={BIZ_DETAIL_LABEL}>Availability</p>
                                            <p className={`text-[1.1875rem] font-bold whitespace-nowrap ${
                                                soldOut ? 'text-rose-600'
                                                    : fillingFast ? 'text-amber-700' : 'text-slate-900'
                                            }`}>
                                                {soldOut ? 'Fully booked' : `${Number(seatsLeft || 0).toLocaleString('en-IN')} of ${Number(capacity || 0).toLocaleString('en-IN')} left`}
                                            </p>
                                        </div>
                                        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${
                                                    soldOut ? 'bg-rose-500'
                                                        : fillingFast ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${Math.max(3, takenPercent)}%` }}
                                            />
                                        </div>
                                        <p className="mt-2 text-[1.1875rem] font-semibold text-slate-500">
                                            {Math.max(0, Number(capacity || 0) - Number(seatsLeft || 0)).toLocaleString('en-IN')} booked so far
                                        </p>
                                    </div>
                                )}

                                {/* "Book by" is a row in the facts list above now — see the
                                    note on that list. It used to be a fourth variation of the
                                    same row shape, three blocks further down the card. */}

                                {/*
                                  * The map link lives on the Directions button
                                  * under the description now.
                                  *
                                  * It was printed here as well, three
                                  * centimetres below the address it opens - the
                                  * same "telling the reader twice" the contact
                                  * rows were cleaned up for. One control, in the
                                  * row where the other two actions are.
                                  */}

                                {/*
                                  * The organiser's note, LABELLED.
                                  *
                                  * It rendered as a bare grey line above the
                                  * price — "membership id" floating between the
                                  * seat count and the fee, reading as debris
                                  * rather than as an instruction to the person
                                  * booking. A heading is what makes one short
                                  * phrase legible as a note.
                                  */}
                                {event.registrationNote && (
                                    <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3.5">
                                        <p className="text-[0.9375rem] font-extrabold uppercase tracking-widest
                                                      text-amber-700">
                                            Please note
                                        </p>
                                        <p className="mt-1.5 text-[1.25rem] font-semibold text-amber-900 whitespace-pre-line">
                                            {event.registrationNote}
                                        </p>
                                    </div>
                                )}

                                {/*
                                  "Book Now", and it goes to the booking flow
                                  rather than to the sign-in page.

                                  It used to read "Register" and link to /login,
                                  because taking a booking needed an account. It
                                  does not any more: `/events/:id/book` opens the
                                  guest checkout, offers signing in as the
                                  alternative rather than the requirement, and
                                  offers membership afterwards. Sending a visitor
                                  who wants a seat to a password field first is
                                  the step the association asked us to remove.
                                */}
                                {event.registrationEnabled && (
                                    <>
                                        {/*
                                          THE PRICE, DIRECTLY ABOVE THE BUTTON —
                                          and the membership offer with it.

                                          This was a figure and a small green
                                          caption saying other people pay less.
                                          `EventPriceTiers` shows the two prices
                                          against each other and carries the link
                                          to join, because a visitor about to book
                                          is the best-qualified audience the
                                          association has for a membership.
                                        */}
                                        {/*
                                          * PRICES FROM THE BOOKING RESOLVER when
                                          * it has answered, from the listing
                                          * until then.
                                          *
                                          * `memberRateApplied` is the half that
                                          * cannot be worked out here: it is the
                                          * server's answer about THIS reader's
                                          * membership, and it is what turns the
                                          * panel from an offer into a
                                          * confirmation for somebody who has
                                          * already joined. Deriving it in the
                                          * browser would be a second copy of a
                                          * rule that decides what is charged.
                                          */}
                                        <EventPriceTiers
                                            price={Number(availability?.price ?? event.registrationFee) || 0}
                                            memberPrice={Number(availability?.memberPrice ?? event.memberPrice) || 0}
                                            hasMemberRate={!!(availability?.hasMemberRate ?? event.hasMemberRate)}
                                            memberRateApplies={!!availability?.memberRateApplied}
                                        />

                                        {/*
                                          * THE BUTTON STOPS BEING A BUTTON when
                                          * there is nothing behind it.
                                          *
                                          * A sold-out or closed event used to
                                          * link straight into the booking form,
                                          * and the refusal came after the
                                          * participant names had been typed.
                                          * Saying it here costs one line and
                                          * saves that whole journey - and it
                                          * says WHICH of the two it is, because
                                          * "full" and "closed" have different
                                          * answers ("ask about the next one"
                                          * versus "call and ask").
                                          */}
                                        {soldOut || bookingClosed || hasPassed ? (
                                            <div className="mt-5">
                                                <div className="w-full inline-flex items-center justify-center gap-2
                                                                rounded-full bg-slate-100 px-6 py-3.5 text-[1rem]
                                                                font-bold uppercase tracking-[0.1em] text-slate-400">
                                                    <Lock size={15} />
                                                    {hasPassed ? 'Event has ended'
                                                        : soldOut ? 'Fully booked' : 'Booking closed'}
                                                </div>
                                                <p className="mt-3 text-center text-[1.1875rem] font-semibold text-slate-500">
                                                    {hasPassed
                                                        ? 'This event has already taken place.'
                                                        : soldOut
                                                            ? 'Every seat has been taken.'
                                                            : 'The booking deadline for this event has passed.'}
                                                    {(event.contactPhone || event.contactEmail) && (
                                                        <> Contact the organiser{' '}
                                                            <a
                                                                href={event.contactPhone
                                                                    ? `tel:${event.contactPhone}`
                                                                    : `mailto:${event.contactEmail}`}
                                                                className="font-bold text-brand-600 hover:text-brand-800"
                                                            >
                                                                {event.contactPhone || event.contactEmail}
                                                            </a>{' '}
                                                            about the next one.
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <Link to={`/events/${id}/book`} className={CTA_CLASS}>
                                                Book Now <ArrowRight size={15} />
                                            </Link>
                                        )}
                                    </>
                                )}

                                {/*
                                  * THE CONTACT IS PRINTED ONCE, in the facts
                                  * list above.
                                  *
                                  * These two rows repeated the same number and
                                  * the same address a few centimetres below it,
                                  * on the grounds that a tappable copy was worth
                                  * having. It is — so the facts list carries the
                                  * links now, and the reader is not asked to
                                  * work out why the page is telling them twice.
                                  */}

                            </aside>
                        </div>
                        </div>

                        {/* ---- more events ---- */}
                        {/*
                          * The related row gets the sheet too.
                          *
                          * Left on the white page these four tiles were white
                          * cards on white again — the same fault the block above
                          * was fixed for, three centimetres below the fix.
                          */}
                        {moreEvents.length > 0 && (
                            <div className={`${SHEET} mt-6`}>
                                <h2 className={`${BIZ_CARD_TITLE} mb-5`}>
                                    {settings?.viewAllLabel ? 'More events' : 'More events'}
                                </h2>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                    {moreEvents.map(other => (
                                        <Link
                                            key={other.id}
                                            to={eventPath(other)}
                                            className={`${BIZ_CARD} group block overflow-hidden
                                                        transition-all duration-300 hover:-translate-y-0.5
                                                        hover:border-slate-300
                                                        hover:shadow-[0_4px_8px_-2px_rgba(16,24,40,0.12),0_16px_32px_-8px_rgba(16,24,40,0.16)]`}
                                        >
                                            {/*
                                              * A TILE WITH NO BANNER GETS A
                                              * PLACEHOLDER, not an empty box.
                                              *
                                              * Banners are optional, so an event
                                              * without one rendered as 160px of
                                              * blank grey above a title — which
                                              * on a row of four photographs reads
                                              * as an image that failed to load.
                                              */}
                                            {other.media?.url ? (
                                                <PosterFrame
                                                    media={other.media}
                                                    width={360}
                                                    imageClassName="group-hover:scale-105 transition-transform duration-700 transform-gpu"
                                                />
                                            ) : (
                                                <div className="w-full aspect-[16/9] overflow-hidden bg-slate-50
                                                                flex items-center justify-center">
                                                    <Calendar size={28} className="text-slate-300" />
                                                </div>
                                            )}
                                            <div className="p-4">
                                                {/* A FIXED TWO-LINE BOX, so the dates line up
                                                    across the row. `line-clamp-2` caps a long
                                                    title but does nothing for a short one, so a
                                                    one-line title pulled its date 24px up and the
                                                    four tiles read as four different cards. */}
                                                <p className="min-h-[3rem] text-[1.25rem] font-bold text-slate-900 line-clamp-2
                                                              group-hover:text-brand-700 transition-colors">
                                                    {/* Never an empty line — the same
                                                        fallback every other card uses. */}
                                                    {other.title || 'Untitled event'}
                                                </p>
                                                {formatDay(other.startAt) && (
                                                    <p className={`${BIZ_DETAIL_LABEL} mt-2`}>
                                                        {formatDay(other.startAt)}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <FooterSection />
        </div>
    );
}
