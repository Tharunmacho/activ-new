import type { MemberEvent } from '@/services/memberHubApi';

/**
 * How an event reads to a person.
 *
 * Every one of these was written inline on at least two screens before — the
 * dashboard card, the events list and the event page all print a date, a time
 * range and a "closes in" line, and three copies of the same formatting is
 * three chances to disagree about whether an event that ends at midnight is
 * today or tomorrow.
 *
 * All formatting is in the VIEWER's timezone, which is correct: the instant was
 * built in the editor's timezone at the point where it was the intended one
 * (see the note on `toInstant` in `EventsManager`), and from there it is a fixed
 * moment that everyone should see in their own clock.
 */

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const DATE_SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

const parse = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (value?: string | null): string => {
    const date = parse(value);
    return date ? date.toLocaleDateString('en-GB', DATE) : '';
};

export const formatShortDate = (value?: string | null): string => {
    const date = parse(value);
    return date ? date.toLocaleDateString('en-GB', DATE_SHORT) : '';
};

export const formatTime = (value?: string | null): string => {
    const date = parse(value);
    return date ? date.toLocaleTimeString('en-GB', TIME) : '';
};

/**
 * "14 September 2026, 09:30 – 17:00", collapsing whatever is not known.
 *
 * A multi-day event prints both dates rather than a time range, because
 * "09:30 – 17:00" across two days is a statement about neither of them.
 */
export const formatWhen = (event: Pick<MemberEvent, 'startAt' | 'endAt'>): string => {
    const start = parse(event.startAt);
    if (!start) return '';

    const end = parse(event.endAt);
    const startDate = start.toLocaleDateString('en-GB', DATE);

    if (!end) return `${startDate}, ${formatTime(event.startAt)}`;

    const sameDay = start.toDateString() === end.toDateString();
    if (!sameDay) return `${startDate} – ${end.toLocaleDateString('en-GB', DATE)}`;

    return `${startDate}, ${formatTime(event.startAt)} – ${formatTime(event.endAt)}`;
};

/** The calendar tile on a card: { day: '14', month: 'SEP' }. */
export const calendarTile = (value?: string | null): { day: string; month: string } => {
    const date = parse(value);
    if (!date) return { day: '--', month: '' };

    return {
        day: String(date.getDate()),
        month: date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    };
};

export const isPast = (event: Pick<MemberEvent, 'startAt' | 'endAt'>): boolean => {
    // An event is over when it ENDS, not when it starts — an all-day conference
    // would otherwise move into "past" over its own morning coffee.
    const end = parse(event.endAt) || parse(event.startAt);
    return !!end && end.getTime() < Date.now();
};

/**
 * Whether a member can still take a seat, and why not when they cannot.
 *
 * The same four rules the server applies in `register()`, in the same order.
 * They are duplicated here on purpose and the duplication is one-directional:
 * this decides what the button SAYS, the server decides what happens. A client
 * rule that drifts optimistic shows a button that answers 400; one that drifts
 * pessimistic hides a seat that was available. The second is recoverable by
 * reloading, so where this is unsure it refuses.
 */
export interface RegistrationGate {
    open: boolean;
    /** Why not, when it is shut. Empty when it is open. */
    reason: string;
}

export const registrationGate = (event: MemberEvent): RegistrationGate => {
    if (!event.registrationEnabled) {
        return { open: false, reason: 'Registration is not open for this event' };
    }

    if (isPast(event)) return { open: false, reason: 'This event has finished' };

    const closes = parse(event.registrationClosesAt);
    if (closes && closes.getTime() < Date.now()) {
        return { open: false, reason: 'Registration closed on ' + formatDate(event.registrationClosesAt) };
    }

    return { open: true, reason: '' };
};

/**
 * Seats left, or `null` when the event is uncapped or nothing was counted.
 *
 * `registeredCount` is `null` when the caller did not ask for it — distinct
 * from zero, and treating the two alike would print "40 seats left" for an
 * event nobody has counted.
 */
export const seatsLeft = (event: MemberEvent): number | null => {
    if (!event.capacity || event.registeredCount === null) return null;
    return Math.max(0, event.capacity - event.registeredCount);
};

/** "Reminder 24 hours before", "Reminders 1 day and 2 hours before". */
export const formatReminders = (hours: number[]): string => {
    const parts = (hours || [])
        .filter((h) => Number.isFinite(h) && h > 0)
        .map((h) => (h % 24 === 0
            ? `${h / 24} ${h / 24 === 1 ? 'day' : 'days'}`
            : `${h} ${h === 1 ? 'hour' : 'hours'}`));

    if (!parts.length) return '';
    if (parts.length === 1) return `Reminder ${parts[0]} before`;

    return `Reminders ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]} before`;
};
