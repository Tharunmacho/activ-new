/**
 * An event's public address: `/events/nlc-business-opportunities-2026-09-27`.
 *
 * The readable slug when the server has given the event one, the id otherwise.
 * The server accepts either on every event endpoint, so old id links keep
 * working; this is what every NEW link is built from, so a link a person shares
 * reads as the event rather than as 24 hex characters.
 */
export const eventPath = (event?: { id?: string; slug?: string } | null): string =>
    `/events/${encodeURIComponent(event?.slug || event?.id || '')}`;
