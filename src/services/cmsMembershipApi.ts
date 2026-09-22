import api, { unwrap } from './api';
import { cached, invalidateCmsCache, type CmsSectionOverride } from './cmsApi';

/**
 * ============================================================================
 * THE MEMBERSHIP PROSPECTUS
 * ============================================================================
 *
 * "ACTIV Membership Advantage" — fifteen numbered advantages, a seven-step
 * journey and a closing call. It lived in the bundle as a typed table; it is a
 * CMS document now, shaped field for field like that table so the page renders
 * from the database exactly as it rendered from the file.
 */

/** One of the fifteen numbered advantages. */
export interface MembershipAdvantage {
    /** The anchor a `#link` and the contents list point at. */
    slug: string;
    /** "01" … "15", printed as typed. */
    number: string;
    /** A name from the CMS icon set — not a component, unlike the old table. */
    icon: string;
    title: string;
    subtitle: string;
    /** Paragraphs above the list. */
    body: string[];
    listLead: string;
    bullets: string[];
    /** The emphasised one-liner, drawn before `after`. */
    closing: string;
    /** Paragraphs below the list. */
    after: string[];
}

/** A journey step, and an entry in "why it matters". */
export interface MembershipStep {
    /** "01" — on the journey only. */
    step: string;
    icon: string;
    title: string;
    text: string;
}

/** A heading, a sub-heading, a lead-in and a list. */
export interface MembershipBlurb {
    heading: string;
    subtitle: string;
    lead: string;
    bullets: string[];
}

export interface MembershipContent {
    eyebrow: string;
    title: string;
    tagline: string;
    /** The opening heading in two halves — see the note on the schema. */
    subtitleLead: string;
    subtitleRest: string;
    body: string[];

    whyJoin: MembershipBlurb;
    whoShouldJoin: MembershipBlurb;

    advantages: MembershipAdvantage[];

    journeyEyebrow: string;
    journeyHeading: string;
    journeySubtitle: string;
    journey: MembershipStep[];

    mattersHeading: string;
    mattersSubtitle: string;
    whyItMatters: MembershipStep[];

    /* The closing block — eleven fields, every one of them on the page. */
    closingHeading: string;
    closingHeadingHighlight: string;
    closingBody: string[];
    closingNote: string;
    callHeading: string;
    callLines: string[];
    statement: string;
    invitation: string;
    enquiriesHeading: string;
    website: string;
    email: string;
    ctaLabel: string;
    ctaHref: string;

    extraFields: { label: string; value: string }[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

export const EMPTY_MEMBERSHIP: MembershipContent = {
    eyebrow: '', title: '', tagline: '', subtitleLead: '', subtitleRest: '', body: [],
    whyJoin: { heading: '', subtitle: '', lead: '', bullets: [] },
    whoShouldJoin: { heading: '', subtitle: '', lead: '', bullets: [] },
    advantages: [],
    journeyEyebrow: '', journeyHeading: '', journeySubtitle: '', journey: [],
    mattersHeading: '', mattersSubtitle: '', whyItMatters: [],
    closingHeading: '', closingHeadingHighlight: '', closingBody: [], closingNote: '',
    callHeading: '', callLines: [], statement: '', invitation: '',
    enquiriesHeading: '', website: '', email: '', ctaLabel: '', ctaHref: '',
    extraFields: [],
    sections: [],
};

/**
 * Cached like every other public read — stale while revalidating, with
 * in-flight de-duplication.
 */
export const getMembership = async (): Promise<MembershipContent | null> => cached(
    'membership',
    async () => {
        const res = await api.get('/cms/membership');
        return unwrap<MembershipContent | null>(res, null);
    },
);

/**
 * Saves the prospectus. ONLY THE KEYS PASSED ARE WRITTEN.
 *
 * The server treats an absent key as untouched, so a save from the journey
 * card cannot blank the fifteen advantages it does not render.
 *
 * The cache is cleared here rather than at each call site: the CMS and the
 * public site are one bundle sharing one cache, and an editor who saves and
 * then opens `/membership` would otherwise be handed the copy from before the
 * save — the bug the region pages had.
 */
export const saveMembership = async (payload: Partial<MembershipContent>) => {
    const res = await api.put('/cms/membership', payload);
    invalidateCmsCache('membership');
    return unwrap<MembershipContent>(res, null as unknown as MembershipContent);
};
