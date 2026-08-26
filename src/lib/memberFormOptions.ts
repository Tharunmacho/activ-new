/**
 * The option lists the four member forms may offer, mirroring the backend
 * schemas exactly.
 *
 * Every one of these is enum-constrained server-side, so a value that is not on
 * the list is not "unusual" — it is a `400 Bad Request` after the member has
 * filled in the whole form, with a Mongoose sentence for a message:
 *
 *     `Agriculture` is not a valid enum value for path `businessTypes.0`.
 *
 * `pages/member/Profile.tsx` carried its own hand-written lists and most of them
 * disagreed with the database:
 *
 *   - Type of Business offered "Agriculture" and "Retailer" — neither exists in
 *     the enum, so any member who ticked one could not get past step 2.
 *   - Constitution offered "LLP", "Public Limited" and "Others", none of which
 *     exist, while omitting "OPC", "TRUST" and "SOCIETY", which do.
 *   - Turnover offered "0-1cr", "1-5cr", "5-10cr", "10-25cr", "25-50cr",
 *     "50cr+". **Not one of the six matched.** The financial step could not be
 *     saved at all, by anyone, ever.
 *   - Social Category offered "Christian St" / "Christian Sc" — right words,
 *     wrong casing, so the value was silently dropped rather than rejected.
 *
 * Keep these in step with:
 *   backend/src/modules/members/businessinfo.model.js
 *   backend/src/modules/members/memberfinancialinfo.model.js
 *   backend/src/modules/members/memberdetails.model.js
 *   backend/src/modules/members/businessTypes.js
 */

/** `businessinfo.model.js` -> `constitutionType`. */
export const CONSTITUTION_TYPES = [
    'OPC',
    'TRUST',
    'SOCIETY',
    'Proprietorship',
    'Partnership',
    'Private Limited',
] as const;

/** `businessTypes.js` -> `BUSINESS_TYPES`, enforced on `businessInfo.businessTypes`. */
export const BUSINESS_TYPE_OPTIONS = [
    'Manufacturing',
    'Trader',
    'Service Provider',
    'Others',
] as const;

/** `businessinfo.model.js` -> `govtOrganizations`. */
export const GOVT_ORGANIZATIONS = [
    'MSME',
    'KVIC',
    'NABARD',
    'None',
    'Others',
] as const;

/**
 * `memberfinancialinfo.model.js` -> `turnoverRange`.
 *
 * The spacing is load-bearing: the schema says "50 Lakhs - 1 Crore" with spaces
 * around the dash, and "50 Lakhs-1 Crore" is a different string and a failed
 * save.
 */
export const TURNOVER_RANGES = [
    'Below 1 Lakh',
    '1-5 Lakhs',
    '5-10 Lakhs',
    '10-50 Lakhs',
    '50 Lakhs - 1 Crore',
    'Above 1 Crore',
] as const;

/** `memberdetails.model.js` -> `socialCategory`. Casing matters. */
export const SOCIAL_CATEGORIES = [
    'Christian ST',
    'Christian SC',
    'ST',
    'SC',
    'Others',
] as const;

/** The religions the mobile Personal Details screen offers, in its order. */
export const RELIGIONS = [
    'Hinduism',
    'Christianity',
    'Islam',
    'Sikhism',
    'Buddhism',
    'Jainism',
    'Others',
] as const;

/** The government schemes the mobile Financial screen offers, in its order. */
export const GOVT_SCHEMES = [
    'Startup India',
    'MUDRA',
    'Stand-Up India',
    'PMEGP',
    'None',
    'Others',
] as const;
