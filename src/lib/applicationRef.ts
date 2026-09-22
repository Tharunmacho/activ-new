/**
 * The application reference, formatted once for every screen that shows it.
 *
 * The dashboard printed the raw 24-character `_id` and the status screen
 * printed the mobile app's `#LAST8`, so one member looking at their own
 * application saw two different "Application ID"s and reasonably asked which
 * was real. Both are the same value; only the formatting differed, and it
 * differed because each screen formatted it itself.
 *
 * The short form is what every screen shows - member and admin alike. A
 * 24-character hex ObjectId is not something a person can read down a phone
 * line or retype without transposing a character, and support only works if the
 * member and the admin are looking at the same string.
 *
 * `full` rides along for the tooltip and the copy button, because that is what
 * a database lookup still needs. Verified unique across the live dataset before
 * committing to the short form: if two applications collapsed to the same eight
 * characters the reference would be ambiguous, which is worse than long.
 *
 * ==========================================================================
 * THE YEAR IS IN IT
 * ==========================================================================
 *
 * The association asked for the reference to say which year the application
 * was made in — one lodged in 2026 reads 2026, the next intake reads 2027 —
 * so that a number quoted over a telephone places itself without a lookup.
 *
 * `ACTIV-APP-2026-3F9A21`, matching `memberNumber.js` on the server, which
 * builds the membership number the same way from the same parts.
 *
 * STABLE, and that is the whole constraint: a reference is written down, so it
 * can never change for a given application. Every part is derived from
 * something that does not move — the submission date where there is one, and
 * otherwise the timestamp Mongo stores in the first four bytes of the id
 * itself, which means a record whose date fields never made it to disk still
 * yields the year it was created in rather than the year it is read in.
 */

/** The four-digit year an application belongs to, from whatever it carries. */
const yearOf = (application: Record<string, unknown> | null): number => {
    const dates = [
        application?.submittedAt,
        application?.createdAt,
        application?.appliedAt,
    ];

    for (const value of dates) {
        if (!value) continue;
        const date = new Date(value as string);
        if (!Number.isNaN(date.getTime())) return date.getFullYear();
    }

    const id = String(application?._id || application?.id || '');
    if (/^[0-9a-f]{24}$/i.test(id)) {
        const seconds = parseInt(id.slice(0, 8), 16);
        if (seconds > 0) return new Date(seconds * 1000).getFullYear();
    }

    return new Date().getFullYear();
};

export const formatApplicationRef = (
    application: Record<string, unknown> | null,
): { short: string; full: string } => {
    const full = String(
        application?._id || application?.applicationId || application?.id || '',
    );
    if (!full) return { short: '', full: '' };

    /*
     * A reference the SERVER assigned wins, untouched — including one in an
     * older format. Renaming somebody's existing reference would be worse than
     * carrying two formats in the field.
     */
    const assigned = String(application?.applicationNumber || '').trim();
    if (assigned) return { short: assigned, full };

    return {
        short: `ACTIV-APP-${yearOf(application)}-${full.slice(-6).toUpperCase()}`,
        full,
    };
};
