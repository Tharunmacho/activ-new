/**
 * The business types a company may have.
 *
 * Mirrors `backend/src/modules/members/businessTypes.js`, which is the
 * definition both Mongoose schemas enforce. Kept as a local constant rather
 * than fetched, because a dropdown cannot wait on a request to render — but it
 * is a mirror, not an independent list: anything added here must be added there
 * first, or the option saves as a 400.
 *
 * Two screens on this site used to carry their own lists — eight values in
 * "Add New Company" (Manufacturer, Wholesaler, Retailer, Distributor,
 * Exporter, Importer, Other) and nine lowercase ones in the business profile
 * form (retail, wholesale, technology, food, healthcare, education…). Neither
 * overlapped the database enum except for "Service Provider", so picking
 * almost anything produced a server error after the whole form was filled in.
 */
export const BUSINESS_TYPES = [
    'Manufacturing',
    'Trader',
    'Service Provider',
    'Others',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/**
 * Match a stored value to one of the four, or return '' when it is not one.
 *
 * Existing rows were written before the lists were reconciled, so an edit form
 * can be handed a value that is no longer offered. Returning '' leaves the
 * select empty and makes the user choose, which is honest — silently mapping it
 * to a neighbouring type would save something they did not pick.
 */
export const normalizeBusinessType = (value?: string | null): string => {
    const raw = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!raw) return '';
    return BUSINESS_TYPES.find((type) => type.toLowerCase() === raw) || '';
};
