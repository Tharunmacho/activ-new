import { onlinePlatformName } from './onlineEvent';

/**
 * The "where" line on an event card, never a bare dash.
 *
 * A card whose footer read "Location —" looked broken and told the reader
 * nothing. Every event carries SOME answer to "where / how do I attend", so
 * the line falls through the real facts in order:
 *
 *   online          -> "Zoom"            (the mode decides, not the fields —
 *                      an event switched online keeps its old address)
 *   venue/location  -> the venue
 *   region target   -> "Tamil Nadu › Sivaganga" (who it is for, which is where)
 *   start time      -> "10:00 AM"
 *   nothing         -> "Venue to be announced"
 */
export interface EventWhereInput {
    mode?: string | null;
    onlinePlatform?: string | null;
    venue?: string | null;
    location?: string | null;
    targetLabel?: string | null;
    state?: string | null;
    district?: string | null;
    startAt?: string | null;
}

export interface EventWhere {
    online: boolean;
    label: string;
    value: string;
}

const clean = (v: unknown) => String(v ?? '').trim();

const timeOf = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    // A date-only value lands on midnight UTC; that is not a real start time.
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
};

export function eventWhere(event: EventWhereInput | null | undefined): EventWhere {
    const e = event || {};
    if (e.mode === 'online') {
        return { online: true, label: 'Platform', value: onlinePlatformName(e.onlinePlatform) };
    }

    const venue = clean(e.venue) || clean(e.location);
    if (venue) return { online: false, label: 'Location', value: venue };

    const region = clean(e.targetLabel) || [clean(e.district), clean(e.state)].filter(Boolean).join(', ');
    if (region) return { online: false, label: 'Region', value: region };

    const time = timeOf(e.startAt);
    if (time) return { online: false, label: 'Starts at', value: time };

    return { online: false, label: 'Location', value: 'Venue to be announced' };
}
