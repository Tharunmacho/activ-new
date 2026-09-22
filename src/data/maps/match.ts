/**
 * ============================================================================
 * MATCHING A CMS DISTRICT TO A DRAWN SHAPE — the one copy of the rule
 * ============================================================================
 *
 * A district gets a marker on the map because its NAME matches a boundary in
 * the generated dataset. Nothing else connects the two: the CMS stores free
 * text an editor typed, and the shapes carry the source's spelling.
 *
 * So a district can be filled in perfectly — office-bearers, a member count, a
 * region — and still draw nothing, because the name is a letter out. That
 * happened, silently, to a district entered as "TIRUVANNAMALI": one missing
 * `a` against "Tiruvannamalai", no marker, and nothing anywhere saying why.
 *
 * This file exists so the CMS can WARN about that before it is published, and
 * it has to be the same rule the map applies or the warning is worse than no
 * warning: a form that reports a problem the page does not have, or blesses a
 * name the page will drop. `StateDistrictMap` imports `normaliseDistrict` from
 * here; so does the district editor.
 *
 * Nothing here loads a map. The boundaries are dynamically imported, several
 * hundred KB each, and a validator that pulled one into the CMS bundle would
 * cost every editor of every screen the whole of Tamil Nadu.
 */

/**
 * ============================================================================
 * ONE SPELLING PER DISTRICT — and none of them is a district standing in for
 * another
 * ============================================================================
 *
 * This table used to do two quite different jobs, and only one of them was
 * legitimate.
 *
 * It still reconciles SPELLINGS. Indian district names are romanised more than
 * one way and the sources disagree freely — Thoothukudi and Thoothukkudi,
 * Virudhunagar and Virudunagar, Kancheepuram and Kanchipuram. An editor typing
 * any of them means the same place, and so does the boundary file.
 *
 * WHAT IT NO LONGER DOES is pretend one district is another. Six Tamil Nadu
 * districts — Chengalpattu, Kallakkurichi, Mayiladuthurai, Ranipet, Tenkasi
 * and Tirupathur — were carved out of neighbours in 2019-2020, after the 2011
 * census the maps were built from, so no outline for any of them existed. Each
 * was aliased to its PARENT as a stopgap: a Chengalpattu chapter pinned on the
 * Kancheepuram shape, in roughly the right part of the state, with no border
 * between the two and both chapters listed on one popover.
 *
 * The maps are generated from current boundaries now and all six are real
 * shapes, so the stopgap is gone. Leaving it would be actively wrong — it
 * would take a Chengalpattu chapter OFF the Chengalpattu shape it now has.
 *
 * ---------------------------------------------------------------------------
 *
 * Both sides of a comparison are put through this, so an entry only has to
 * make the two CONVERGE — it does not matter which spelling is the key, as
 * long as every spelling of one district lands on the same string.
 */
export const ALIASES: Record<string, string> = {
    /* Tamil Nadu — the five the two sources romanise differently. */
    kancheepuram: 'kanchipuram',
    thoothukkudi: 'thoothukudi',
    tuticorin: 'thoothukudi',
    virudunagar: 'virudhunagar',
    nagappattinam: 'nagapattinam',
    kallakurichi: 'kallakkurichi',
    tirupattur: 'tirupathur',
    thiruvallur: 'tiruvallur',
    thiruvarur: 'tiruvarur',
    tiruchirappalli: 'trichy',
    kanniyakumari: 'kanyakumari',

    /*
     * ----------------------------------------------------------------------
     * DISTRICTS THAT WERE RENAMED, AND ARE STILL CALLED THE OLD THING
     * ----------------------------------------------------------------------
     *
     * A boundary file carries the current name and an editor types the one
     * everybody uses. Allahabad was renamed Prayagraj in 2018 and is still
     * Allahabad to most of the people who write it down; Gurgaon, Bangalore,
     * Aurangabad and Baleshwar are the same.
     *
     * This is a SPELLING table and not a history: each line says "these two
     * names are the same place", which is exactly what the matcher needs and
     * is true in both directions. It is not a claim about which name is
     * correct — the map prints whatever the dataset calls it, and the CMS
     * accepts whatever the editor typed.
     */
    bangalore: 'bengaluruurban',
    bengaluru: 'bengaluruurban',
    bangalorerural: 'bengalururural',
    bangaloreurban: 'bengaluruurban',
    mysore: 'mysuru',
    belgaum: 'belagavi',
    gulbarga: 'kalaburagi',
    tumkur: 'tumakuru',
    shimoga: 'shivamogga',
    bellary: 'ballari',
    bijapur: 'vijayapura',
    bagalkot: 'bagalkote',

    /* Renamed since the boundary file was drawn, or spelled differently. */
    allahabad: 'prayagraj',
    gurgaon: 'gurugram',
    ahmadnagar: 'ahmednagar',
    aurangabad: 'chhatrapatisambhajinagar',
    osmanabad: 'dharashiv',
    baleshwar: 'balasore',
    bauda: 'boudh',
    boudh: 'boudh',
    anantapur: 'ananthapuramu',
    mahbubnagar: 'mahabubnagar',
    bandipore: 'bandipura',
    lawangtlai: 'lawngtlai',
    nicobar: 'nicobars',
    southandaman: 'southandamans',
    northmiddleandaman: 'northandmiddleandaman',
    dadranagarhaveli: 'dadraandnagarhaveli',
    lehladakh: 'leh',
};

/**
 * One district name, reduced to the form the two sides are compared in.
 *
 * Case, punctuation, a trailing "District" and a leading "The" all go, and a
 * known alias resolves to one spelling. What is left is a run of letters, and
 * two districts match when those runs are IDENTICAL.
 *
 * Exact on purpose. A fuzzy match here would quietly pin Tirunelveli's
 * chapter on Tiruvallur, and a marker in the wrong half of the state is worse
 * than no marker — a reader has no way to tell it is wrong. Fuzziness belongs
 * in the CMS, where it can SUGGEST a spelling to a person who can judge it.
 */
export const normaliseDistrict = (value: string) => {
    const base = String(value || '')
        .toLowerCase()
        .replace(/\bdistrict\b/g, '')
        .replace(/^the\s+/, '')
        .replace(/[^a-z]/g, '');
    return ALIASES[base] || base;
};
