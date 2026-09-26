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

/**
 * A gallery item's public address: `/gallery/activ-inked-mou-with-gem`.
 * The slug when the server has given it one, the id otherwise; the server
 * accepts either, so old links keep working.
 */
export const galleryPath = (item?: { _id?: string; id?: string; slug?: string } | null): string =>
    `/gallery/${encodeURIComponent(item?.slug || item?._id || item?.id || '')}`;
