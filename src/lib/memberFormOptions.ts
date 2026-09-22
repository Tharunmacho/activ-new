/**
 * The option lists the member forms may offer, mirroring the backend exactly.
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
 *   backend/src/modules/members/businessOptions.js
 *   backend/src/modules/members/demographicOptions.js
 *   backend/src/modules/members/businessTypes.js
 */

/** `businessOptions.js` -> `CONSTITUTION_TYPES`. `LLP` is new. */
export const CONSTITUTION_TYPES = [
    'OPC',
    'TRUST',
    'SOCIETY',
    'Proprietorship',
    'Partnership',
    'Private Limited',
    'LLP',
] as const;

/** `businessTypes.js` -> `BUSINESS_TYPES`. `Dealer` and `Franchise` are new. */
export const BUSINESS_TYPE_OPTIONS = [
    'Manufacturing',
    'Trader',
    'Service Provider',
    'Dealer',
    'Franchise',
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
 * `businessOptions.js` -> `GOVT_REGISTRATIONS`.
 *
 * Each answer opens its own detail field. A Udyam number, an export council
 * membership number and "whatever else you are registered with" are three
 * different things, and one shared free-text box loses which is which.
 *
 * `NSIC` — the National Small Industries Corporation, the government company
 * that supports MSMEs — is a separate answer from `MSME / Udyam`: Udyam is the
 * registration that MAKES a firm an MSME, NSIC is a body a firm then registers
 * with. Members are routinely both.
 */
export const GOVT_REGISTRATIONS = [
    'Export Councils',
    'MSME / Udyam',
    'NSIC',
    'Other',
] as const;

/**
 * `businessOptions.js` -> `TURNOVER_SLABS`.
 *
 * The lakh ranges first, the crore slabs after them — the crore slabs are an
 * ADDITION to the old list, not a replacement, so a small trader can still
 * answer honestly while a 500-crore manufacturer is no longer in the same band
 * as a 5-crore one.
 *
 * The spacing is load-bearing all the way through: the backend enum holds these
 * strings verbatim, and "50 Lakhs-1 Crore" is a different string from
 * "50 Lakhs - 1 Crore" and a failed save.
 *
 * `Above 1 Crore` is deliberately NOT here. It is the band the seven crore
 * slabs replace, and offering both would let two companies describe the same
 * turnover two ways. The backend still accepts it, for rows that already hold
 * it.
 */
export const TURNOVER_RANGES = [
    'Below 1 Lakh',
    '1-5 Lakhs',
    '5-10 Lakhs',
    '10-50 Lakhs',
    '50 Lakhs - 1 Crore',
    '₹1 Crore - ₹10 Crore',
    '₹10 Crore - ₹25 Crore',
    '₹25 Crore - ₹50 Crore',
    '₹51 Crore - ₹100 Crore',
    '₹101 Crore - ₹200 Crore',
    '₹201 Crore - ₹500 Crore',
    'Above ₹500 Crore',
    'Other / Manual Entry',
] as const;

/** The slab that opens the free-text box. Compared, never re-typed. */
export const TURNOVER_MANUAL = 'Other / Manual Entry';

/**
 * `demographicOptions.js` -> `SOCIAL_CATEGORIES`. Casing matters.
 *
 * `Christian ST` has been withdrawn: religion is its own field now, so the
 * combination is recorded as category + religion rather than baked into one
 * label. The backend enum still accepts it, because rows already carry it.
 */
export const SOCIAL_CATEGORIES = [
    'SC',
    'Christian SC',
    'ST',
    'Others',
] as const;

/**
 * `demographicOptions.js` -> `RELIGIONS`.
 *
 * Named for the religion, not the adherent — see the note on the server copy
 * for why, and for why no migration goes with the rename.
 */
export const RELIGIONS = [
    'Hindu',
    'Christian',
    'Buddhist',
    'Sikh',
    'Muslim',
] as const;

/** `demographicOptions.js` -> `GENDERS`. See the note there before removing one. */
export const GENDERS = ['Male', 'Female', 'Others'] as const;

/**
 * Which religions each social category may hold — the browser's copy of
 * `demographicOptions.religionsFor`.
 *
 * Scheduled Caste status under the Constitution (Scheduled Castes) Order 1950
 * is confined to Hindu, Sikh and Buddhist members, so offering an SC applicant the
 * other two offers a combination that cannot be true. `Christian SC` is the
 * label that names its own religion. Scheduled Tribe status carries no
 * religious bar, so `ST` — and `Others` — see the whole list.
 *
 * A category absent from this map means "no restriction". That is the safe
 * default on purpose: a category added to the list above still shows every
 * religion rather than silently showing none, which would read as a broken
 * dropdown.
 */
const RELIGIONS_BY_SOCIAL_CATEGORY: Record<string, readonly string[]> = {
    'SC': ['Hindu', 'Buddhist', 'Sikh'],
    'Christian SC': ['Christian'],
};

/**
 * What the religion field used to hold, mapped onto what it holds now — the
 * browser's copy of `demographicOptions.normalizeReligion`.
 *
 * Religion was a free-text box, and the mobile screen offered a longer list
 * with different spellings ("Hinduism", "Christianity", "Islam", "Sikhism",
 * "Buddhism"). Those are on live records. Without this map a returning member
 * opens the form to an EMPTY religion select — a value that is not among the
 * options cannot be the selected one — and has to answer a question they
 * already answered, with nothing on screen saying why it went blank.
 *
 * Every entry is an exact synonym. No near-misses: "Jainism" and "Others" are
 * deliberately unmapped, because they have no equivalent on the new list and
 * inventing one would put a religion on a member's record that they never gave.
 * Same line `normalizeBusinessType` draws.
 */
const RELIGION_SYNONYMS: Record<string, string> = {
    hindu: 'Hindu',
    hinduism: 'Hindu',
    christian: 'Christian',
    christianity: 'Christian',
    muslim: 'Muslim',
    islam: 'Muslim',
    islamic: 'Muslim',
    sikh: 'Sikh',
    sikhism: 'Sikh',
    buddhist: 'Buddhist',
    buddhism: 'Buddhist',
};

/** A stored religion as one of the five, or `''` when it is not one of them. */
export const normalizeReligion = (value?: string | null): string => {
    const raw = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!raw) return '';
    return RELIGION_SYNONYMS[raw] || '';
};

/** The religions offered for a category. Unknown or blank category -> all. */
export const religionsFor = (socialCategory?: string | null): readonly string[] =>
    RELIGIONS_BY_SOCIAL_CATEGORY[String(socialCategory || '').trim()] || RELIGIONS;

/** The government schemes the financial section offers, in its order. */
export const GOVT_SCHEMES = [
    'Startup India',
    'MUDRA',
    'Stand-Up India',
    'PMEGP',
    'None',
    'Others',
] as const;

/**
 * 1950 to this year, newest first.
 *
 * A dropdown rather than a free-text box: the commencement year decides the
 * membership band and therefore the price, and a typed `2081` was found out
 * about at the payment step, if at all. Newest first because most applicants
 * pick a recent year and should not scroll seventy-odd rows to reach it.
 */
export const COMMENCEMENT_YEAR_FLOOR = 1950;

export const commencementYears = (): string[] => {
    const years: string[] = [];
    for (let year = new Date().getFullYear(); year >= COMMENCEMENT_YEAR_FLOOR; year -= 1) {
        years.push(String(year));
    }
    return years;
};

/**
 * The bodies authorised to issue a Registration-Cum-Membership Certificate —
 * DGFT Appendix 2T.
 *
 * =========================================================================
 * WHY THIS IS A LIST AND NOT A TEXT BOX
 * =========================================================================
 *
 * It was a text box, with the placeholder "e.g. FIEO, EEPC India". What comes
 * back from a text box is "EEPC", "eepc india", "Engineering Export Promotion
 * Council" and "Engg. Export Council" — four spellings of one council, which is
 * four councils to anything counting them, and nothing to match a member
 * against when the association wants to know who holds an RCMC from whom.
 *
 * The same argument `ProductCategoryInput` makes for NIC codes over free-typed
 * product names, and `RegionInput` makes for region spellings: a name typed
 * from memory is not data.
 *
 * =========================================================================
 * GROUPED AS THE APPENDIX GROUPS THEM
 * =========================================================================
 *
 * Councils, Commodity Boards, Development Authorities and the apex body are
 * four different kinds of organisation, and a member looking for the Spices
 * Board is not looking among the councils. The picker prints these as headings.
 *
 * =========================================================================
 * A BODY THAT IS NOT LISTED CAN STILL BE ENTERED
 * =========================================================================
 *
 * The DGFT amends Appendix 2T without telling anybody here — "The Sports Goods
 * Export Promotion Council" became "Sports Goods and Toys Export Promotion
 * Council" by Public Notice 11/2025-26 on 12 June 2025 — so a member holding a
 * valid RCMC from a body added last month must still be able to answer. The
 * picker offers what they typed when nothing matches, exactly as
 * `ProductCategoryInput` does for a product NIC does not list.
 *
 * The abbreviation is part of the label rather than a separate field, because
 * exporters say "we have EEPC membership" and a search for "EEPC" has to find
 * it. It is also what appears on the certificate.
 */
export interface ExportCouncilOption {
    name: string;
    /** The heading it sits under in the picker. */
    group: string;
}

export const EXPORT_COUNCIL_GROUPS = [
    'Export Promotion Councils',
    'Commodity Boards',
    'Export Development Authorities',
    'Apex Body',
] as const;

export const EXPORT_COUNCILS: ExportCouncilOption[] = [
    /* ---------------------------------------- Export Promotion Councils */
    'Apparel Export Promotion Council (AEPC)',
    'AYUSH Export Promotion Council (AYUSHEXCIL)',
    'Basic Chemicals, Cosmetics and Dyes Export Promotion Council (CHEMEXCIL)',
    'Carpet Export Promotion Council (CEPC)',
    'Cashew Export Promotion Council of India (CEPCI)',
    'Chemicals and Allied Products Export Promotion Council (CAPEXIL)',
    'Council for Leather Exports (CLE)',
    'Electronics and Computer Software Export Promotion Council (ESC)',
    'Engineering Export Promotion Council India (EEPC India)',
    'Export Promotion Council for EOUs and SEZs (EPCES)',
    'Export Promotion Council for Handicrafts (EPCH)',
    'Export Promotion Council for Medical Devices (EPCMD)',
    'Gem and Jewellery Export Promotion Council (GJEPC)',
    'Handloom Export Promotion Council (HEPC)',
    'Indian Oilseeds and Produce Export Promotion Council (IOPEPC)',
    'Indian Silk Export Promotion Council (ISEPC)',
    'Jute Products Development and Export Promotion Council (JPDEPC)',
    'Man-made and Technical Textiles Export Promotion Council (MATEXIL)',
    'Mobile and Electronics Devices Export Promotion Council (MEDEPC)',
    'Pharmaceuticals Export Promotion Council of India (PHARMEXCIL)',
    'Plastics Export Promotion Council (PLEXCONCIL)',
    'Powerloom Development and Export Promotion Council (PDEXCIL)',
    'Project Exports Promotion Council of India (PEPC)',
    'Services Export Promotion Council (SEPC)',
    'Shellac and Forest Products Export Promotion Council (SHEFEXIL)',
    // Renamed by DGFT Public Notice 11/2025-26 on 12 June 2025, when toys were
    // added to its scope. The old name is what most search results still show.
    'Sports Goods and Toys Export Promotion Council (SGEPC)',
    'Telecom Equipment and Services Export Promotion Council (TEPC)',
    'The Cotton Textiles Export Promotion Council (TEXPROCIL)',
    'Wool and Woollens Export Promotion Council (WWEPC)',
].map((name) => ({ name, group: 'Export Promotion Councils' }))
    .concat([
        /* -------------------------------------------- Commodity Boards */
        'Coffee Board',
        'Coir Board',
        'Coconut Development Board',
        'Rubber Board',
        'Spices Board',
        'Tea Board',
        'Tobacco Board',
    ].map((name) => ({ name, group: 'Commodity Boards' })))
    .concat([
        /* ------------------------------- Export Development Authorities */
        'Agricultural and Processed Food Products Export Development Authority (APEDA)',
        'Marine Products Export Development Authority (MPEDA)',
    ].map((name) => ({ name, group: 'Export Development Authorities' })))
    .concat([
        /*
         * The apex body of every export promotion organisation in India, and an
         * RCMC issuer in its own right for exporters whose product no council
         * covers — which is why it is on the list rather than assumed.
         */
        'Federation of Indian Export Organisations (FIEO)',
    ].map((name) => ({ name, group: 'Apex Body' })));

/** Whether a stored value is one this list knows. Used to flag a custom entry. */
export const isKnownExportCouncil = (value: string): boolean => {
    const needle = String(value || '').trim().toLowerCase();
    return !!needle && EXPORT_COUNCILS.some((c) => c.name.toLowerCase() === needle);
};
