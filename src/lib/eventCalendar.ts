/**
 * Taking an event OFF the page — into a calendar, into a chat, into maps.
 *
 * =========================================================================
 * A PAGE THAT CANNOT BE LEFT WITH IS A PAGE THAT IS FORGOTTEN
 * =========================================================================
 *
 * An event detail page had one thing a reader could do with it: book, now, in
 * this sitting. Everybody who was interested but not ready in that minute —
 * which is most people — closed the tab and the event was gone. The three
 * things they actually want are to put it in their diary, to send it to the two
 * colleagues who would come with them, and to find out how far away the venue
 * is, and none of those were on the page.
 *
 * All of it is derived from the event the server already sends. Nothing here
 * talks to the API, nothing here needs an account, and every function copes
 * with an event that has no date, no venue and no description — which is the
 * normal state of a half-written event, because nothing on the event form is
 * required.
 */

/** The subset of an event these helpers read. Deliberately structural. */
export interface CalendarEventLike {
    id?: string;
    title?: string;
    description?: string;
    startAt?: string | null;
    endAt?: string | null;
    venue?: string;
    location?: string;
    venueAddress?: string;
    venueMapUrl?: string;
    /** `online` has no place to walk to — see `directionsUrl`. */
    mode?: 'offline' | 'online';
    onlinePlatform?: string;
}

/** Two hours, the length assumed for an event announced without an end time. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

const parse = (iso?: string | null): Date | null => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * `20260920T043000Z` — the one timestamp format both iCalendar and Google's
 * template URL accept.
 *
 * UTC, always. A local-time stamp has to carry its zone in a separate property
 * or it is read in the reader's own zone, which silently moves a Chennai event
 * by five and a half hours for anybody travelling.
 */
const stamp = (date: Date): string =>
    date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * Start and end, with an end invented when the organiser did not give one.
 *
 * Returns `null` for an undated event: a calendar entry with no date is not a
 * degraded calendar entry, it is a broken one, so the controls are hidden
 * instead of offering something that would import as 1 January 1970.
 */
export const eventWindow = (event: CalendarEventLike): { start: Date; end: Date } | null => {
    const start = parse(event.startAt);
    if (!start) return null;
    const declaredEnd = parse(event.endAt);
    // An end at or before the start is data we cannot use — a typo, or a time
    // with no date behind it. Two hours is the honest fallback either way.
    const end = declaredEnd && declaredEnd.getTime() > start.getTime()
        ? declaredEnd
        : new Date(start.getTime() + DEFAULT_DURATION_MS);
    return { start, end };
};

/** "Hall A, Chennai — 12 Mount Road" as one line, or empty. */
export const eventPlace = (event: CalendarEventLike): string =>
    [event.venue || event.location, event.venueAddress].filter(Boolean).join(', ');

/**
 * WHERE THE EVENT LIVES ON THE WEB.
 *
 * Put into the calendar entry and into every share, because the message a
 * member forwards is only useful if it can be opened. Built from the running
 * origin rather than a configured base URL so it is right on localhost, on a
 * staging host and in production without three different answers.
 */
export const eventPageUrl = (event: CalendarEventLike): string => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/events/${event.id || ''}`;
};

/**
 * A Google Calendar "add event" link.
 *
 * The template URL rather than the API: it needs no key, no consent screen and
 * no account of ours, and it lands the reader on a pre-filled Google form that
 * they confirm. Anything heavier would be a sign-in wall in front of a
 * convenience.
 */
export const googleCalendarUrl = (event: CalendarEventLike): string => {
    const window_ = eventWindow(event);
    if (!window_) return '';
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title || 'ACTIV event',
        dates: `${stamp(window_.start)}/${stamp(window_.end)}`,
        details: [event.description || '', eventPageUrl(event)].filter(Boolean).join('\n\n'),
        location: eventPlace(event),
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/*
 * iCalendar's own escapes. Backslash FIRST — escaping it after the others would
 * go back over the backslashes this function had just introduced and double
 * them, turning every semicolon into a literal `\\;` in the file.
 */
const BACKSLASH = String.fromCharCode(92);
const icsText = (value: string): string =>
    String(value || '')
        .split(BACKSLASH).join(BACKSLASH + BACKSLASH)
        .split(';').join(BACKSLASH + ';')
        .split(',').join(BACKSLASH + ',')
        .replace(/\r?\n/g, BACKSLASH + 'n');

/** iCalendar is a CRLF format. Not "usually"; the spec says so and parsers mind. */
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

/**
 * Folds a property onto continuation lines, as iCalendar requires.
 *
 * The rule is 75 OCTETS, not characters, and a continuation line begins with a
 * single space which the parser removes. Split on characters and a description
 * carrying one rupee sign (three bytes in UTF-8) folds a line to 76 octets,
 * which is exactly the sort of nearly-valid file that imports everywhere except
 * the one calendar the reader is using.
 */
const foldLine = (line: string): string => {
    const bytes = new TextEncoder().encode(line);
    if (bytes.length <= 75) return line;

    const out: string[] = [];
    let current = '';
    let used = 0;
    for (const ch of line) {
        const size = new TextEncoder().encode(ch).length;
        // 74 on a continuation line, because the leading space counts too.
        const limit = out.length === 0 ? 75 : 74;
        if (used + size > limit) {
            out.push(current);
            current = '';
            used = 0;
        }
        current += ch;
        used += size;
    }
    if (current) out.push(current);
    return out.join(CRLF + ' ');
};

/**
 * The event as an `.ics` file — Apple Calendar, Outlook, and everything else.
 *
 * Google gets its own link above because its web calendar handles the template
 * URL better than a downloaded file; every other calendar on earth reads this.
 */
export const buildIcs = (event: CalendarEventLike): string => {
    const window_ = eventWindow(event);
    if (!window_) return '';
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ACTIV//Events//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        // Stable per event, so re-importing updates the entry the reader
        // already has instead of adding a second copy of the same evening.
        `UID:activ-event-${event.id || stamp(window_.start)}@activ`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(window_.start)}`,
        `DTEND:${stamp(window_.end)}`,
        `SUMMARY:${icsText(event.title || 'ACTIV event')}`,
        `DESCRIPTION:${icsText([event.description || '', eventPageUrl(event)].filter(Boolean).join(' '))}`,
        `LOCATION:${icsText(eventPlace(event))}`,
        `URL:${eventPageUrl(event)}`,
        'END:VEVENT',
        'END:VCALENDAR',
    ];
    return lines.map(foldLine).join(CRLF) + CRLF;
};

/** Saves the `.ics` to the reader's machine. No-op on an undated event. */
export const downloadIcs = (event: CalendarEventLike): void => {
    const body = buildIcs(event);
    if (!body) return;
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${(event.title || 'activ-event').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Released on the next tick: revoking it synchronously can race the click
    // in Safari and save a zero-byte file.
    setTimeout(() => URL.revokeObjectURL(href), 0);
};

/**
 * DIRECTIONS, whether or not the organiser pasted a map link.
 *
 * `venueMapUrl` is an optional field and is usually empty, which left a venue
 * printed as text the reader had to retype into their phone. A Google Maps
 * search built from the venue name is not as precise as a dropped pin, but it
 * is the difference between one tap and copying an address by hand.
 */
export const directionsUrl = (event: CalendarEventLike): string => {
    /*
     * AN ONLINE EVENT HAS NOWHERE TO GO.
     *
     * Checked before the map link rather than after, because an online event
     * can still carry a stale `venueMapUrl` from before it was switched — and
     * a Directions button on a Zoom call sends somebody to an address nobody
     * will be at. The mode is the answer; the leftover field is not.
     */
    if (event.mode === 'online') return '';

    if (event.venueMapUrl) return event.venueMapUrl;
    const place = eventPlace(event);
    if (!place) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
};

/** "Tue, 20 Jan · 10:30" — the one-line summary a share message leads with. */
export const shareLine = (event: CalendarEventLike): string => {
    const start = parse(event.startAt);
    const when = start
        ? start.toLocaleString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit',
        })
        : '';
    return [event.title || 'ACTIV event', when, eventPlace(event)]
        .filter(Boolean)
        .join(' · ');
};

/**
 * Twelve hours, the point after a start time at which an event with no end time
 * is assumed to be over.
 *
 * Generous on purpose. The cost of calling a finished event "happening now" is
 * a stale chip; the cost of the reverse is telling somebody standing in the
 * hall that they have missed it.
 */
const ASSUMED_LENGTH_MS = 12 * 60 * 60 * 1000;

/**
 * WHETHER THE EVENT IS AHEAD, ON, OR OVER.
 *
 * The page used to decide this from the start time alone, so an event that
 * began an hour ago read as "This event has taken place" while the room was
 * still full - and a Book Now button sat underneath that sentence.
 *
 * An undated event is `upcoming`. Nothing on the event form is required, so a
 * missing date means "not announced yet", which is emphatically not "over".
 */
export const eventPhase = (
    event: CalendarEventLike,
    now: Date = new Date(),
): 'upcoming' | 'live' | 'past' => {
    const start = parse(event.startAt);
    if (!start) return 'upcoming';
    if (now.getTime() < start.getTime()) return 'upcoming';
    const declaredEnd = parse(event.endAt);
    const end = declaredEnd && declaredEnd.getTime() > start.getTime()
        ? declaredEnd
        : new Date(start.getTime() + ASSUMED_LENGTH_MS);
    return now.getTime() <= end.getTime() ? 'live' : 'past';
};

/**
 * HOW LONG UNTIL IT STARTS, in words.
 *
 * `null` when there is no date or the event has passed — the caller draws
 * nothing rather than "in -4 days", and an undated event says nothing at all
 * rather than claiming to be imminent.
 */
export const countdownLabel = (iso?: string | null, now: Date = new Date()): string | null => {
    const start = parse(iso);
    if (!start) return null;
    const ms = start.getTime() - now.getTime();
    if (ms <= 0) return null;

    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `Starts in ${Math.max(1, minutes)} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Starts in ${hours} hour${hours === 1 ? '' : 's'}`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Tomorrow';
    if (days < 30) return `In ${days} days`;

    const months = Math.round(days / 30);
    return `In ${months} month${months === 1 ? '' : 's'}`;
};
