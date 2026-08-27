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
 */
export const formatApplicationRef = (application: any | null): { short: string; full: string } => {
    const full = String(application?._id || application?.applicationId || application?.id || '');
    if (!full) return { short: '', full: '' };
    return { short: `#${full.slice(-8).toUpperCase()}`, full };
};

