import api, { unwrap } from './api';
import { cached, invalidateCmsCache, type CmsExtraField } from './cmsApi';

/**
 * The Regions & States section of the public site.
 *
 * =========================================================================
 * THE SHAPE OF A REGION IS NOT A CLIENT'S OPINION
 * =========================================================================
 *
 * Which states belong to which region is served by `GET /cms/regions/map` and
 * read from there by the header menu, the region page's Focus States rail and
 * the CMS's state picker. A copy of that list in a component is a second answer
 * to the same question, and the first time somebody edits one and not the other
 * the menu offers a page the API will not serve.
 *
 * So there is no `const REGIONS = [...]` anywhere in this codebase's browser
 * half. Everything that needs to know asks.
 */

/* ------------------------------------------------------------------- types */

export interface CmsMediaShape {
    url: string;
    type: 'image' | 'video';
    alt: string;
    fit: 'cover' | 'contain';
    position: string;
}

export interface RegionSlide {
    id: string;
    media: CmsMediaShape;
    /** Printed UNDER the photograph — the most-read line on the page. */
    caption: string;
    href: string;
    displayOrder: number;
    isHidden: boolean;
}

export interface RegionLeader {
    id: string;
    name: string;
    /** The short badge — "Chairman". Separate from the full designation line. */
    role: string;
    /**
     * Two fields, not one. The panel prints them as stacked lines joined by
     * "and", and a single field would carry that "and" into every other screen
     * that shows the person.
     */
    designation: string;
    organisation: string;
    photoUrl: string;
    bio: string;
    /**
     * THIS PERSON's contact, not the office's.
     *
     * All optional. The contact directory draws an entry for anyone who has one
     * of them, and nobody who has none — so a council with one shared address is
     * unchanged and one that publishes a line per office-bearer gets a
     * directory. See the note on the schema.
     */
    email: string;
    phone: string;
    address: string;
    displayOrder: number;
    isHidden: boolean;
}

/**
 * ONE SHAPE FOR EVERY LIST on these pages.
 *
 * Sector updates, news, media releases, events, projects, policy advocacy and
 * publications are the same object under eight labels; the differences are
 * entirely in how they are drawn. Eight interfaces would be eight places to
 * change when a field is added.
 *
 * Every field is optional in practice — a CMS page is written over several
 * sittings, so an item with a title and nothing else is normal and every
 * renderer must cope with it.
 */
export interface RegionFeedItem {
    id: string;
    title: string;
    summary: string;
    body: string;
    /** Free text ("Nov 12, 2026 to Nov 13, 2026"), printed, never sorted on. */
    date: string;
    location: string;
    href: string;
    imageUrl: string;
    fileUrl: string;
    category: string;
    sector: string;
    /**
     * A name from the CMS icon set, for the lists drawn as icons — key
     * achievements and consulting services. A name rather than a URL: it can be
     * re-skinned with the site, and it cannot 404.
     */
    icon: string;
    displayOrder: number;
    isFeatured: boolean;
    isHidden: boolean;
}

/**
 * A NAMED CONTACT ON A TIER — not the office, and not an office-bearer.
 *
 * The third source `contactEntries` reads. A person a visitor should be able
 * to write to who is not on the leadership bench: a membership registrar, an
 * events coordinator, whoever answers the skills programme. Before this, the
 * only way to list one was to make them a leader, which also put their
 * portrait in the leadership grid.
 *
 * No `role` and no `bio`, deliberately — both belong to a portrait, and a
 * contact is never drawn as one. See `contactPersonSchema` on the server.
 */
export interface RegionContactPerson {
    id: string;
    name: string;
    /** The line under the name — "Membership Registrar". */
    designation: string;
    organisation: string;
    photoUrl: string;
    email: string;
    phone: string;
    /** Free text, line breaks kept. */
    address: string;
    displayOrder: number;
    isHidden: boolean;
}

/**
 * A GROUP IN GET IN TOUCH — a heading and the people under it.
 *
 * Its own list, NOT a leadership tier. The headings used to be read off
 * `stateRegions` / `districts`, so adding a contact group created a bench on
 * the leadership board as a side effect. They are separate things: a tier is
 * portraits, a member count and a shape on the map; a group is a heading and
 * some people to write to.
 */
export interface RegionContactGroup {
    id: string;
    name: string;
    contacts: RegionContactPerson[];
    displayOrder: number;
    isHidden: boolean;
}

export interface RegionOffice {
    personName: string;
    /** The director's photograph on the contact card. */
    photoUrl: string;
    designation: string;
    /** An array, exactly as the editor typed it — joining loses the shape. */
    addressLines: string[];
    city: string;
    state: string;
    country: string;
    pincode: string;
    email: string;
    phone: string;
    mapUrl: string;
}

/** A short label with a glyph — the hero's features, the vision's pillars. */
export interface RegionBadge {
    icon: string;
    label: string;
}

export interface RegionHero {
    eyebrow: string;
    headline: string;
    tagline: string;
    blurb: string;
    backgroundUrl: string;
    sideImageUrl: string;
    features: RegionBadge[];
    /** Capital / Chennai — a label AND a value, set at two different weights. */
    facts: { icon: string; label: string; value: string }[];
    /** "State at a Glance": a bold claim and its quieter qualifier. */
    glance: { icon: string; title: string; subtitle: string }[];
}

/** A picture card — the rail's explore block and its promo banners. */
export interface RegionCard {
    imageUrl: string;
    title: string;
    subtitle: string;
    href: string;
}

export interface RegionVision {
    title: string;
    text: string;
    pillars: RegionBadge[];
}

export interface RegionSeo {
    metaTitle: string;
    metaDescription: string;
    ogImageUrl: string;
}

export interface FocusState {
    name: string;
    slug: string;
    /** Whether a published page exists. A link to a 404 is worse than no link. */
    hasPage: boolean;
}

/**
 * A section the association added itself.
 *
 * `layout` decides which of the page's existing cards draws it — see
 * `CustomSectionCard`. It is a fixed set and not free text, because the site
 * can only draw what it has a card for.
 */
export interface CustomSection {
    /** The URL segment its "View All" screen lives at. */
    key: string;
    title: string;
    icon: string;
    layout: 'list' | 'tiles' | 'dated' | 'figures' | 'text';
    intro: string;
    /** The body, for a text section. */
    text: string;
    items: RegionFeedItem[];
    displayOrder: number;
}

/**
 * ==========================================================================
 * THE DASHBOARD'S OWN HEADINGS
 * ==========================================================================
 *
 * "Photo Gallery", "Contact Us", "Write to Us", "Reach Us", "Find us on the
 * map" — the words the dashboard itself says, as opposed to the content it
 * lists. Every one was a literal in `StateDashboard`, on every zone page and
 * every state page, and editable from nowhere.
 *
 * Blank means the shipped wording, which `DASHBOARD_LABELS` below holds. That
 * has to be the rule rather than "blank means blank": every page in the
 * collection predates these fields, so an absent value must keep drawing what
 * it drew yesterday.
 */
export interface DashboardLabels {
    /** Over the page's own bench. The title carries the region's name. */
    ownTierEyebrow: string;
    /** Over the tier below — a zone's states, a state's regions. */
    tierBelowEyebrow: string;
    tierBelowHeading: string;
    /** The state page's third band. Unused on a zone page. */
    districtsEyebrow: string;
    districtsHeading: string;
    contactEyebrow: string;
    contactHeading: string;
}

/**
 * What a page says when a label has not been set.
 *
 * THE ZONE PAGE AND THE STATE PAGE DISAGREE ON FOUR OF THESE, which is why
 * there are two tables. A zone's own bench is its "Zone" bench and the tier
 * below it is "States"; a state's own bench is "State" and the tier below is
 * its "Regions". One shared table would have to pick one of those and be
 * wrong on the other page.
 *
 * ONE COPY OF EACH, exported, and `scripts/seed-shown-defaults.js` writes
 * these same strings into the stored fields — so the CMS box says what the
 * page says instead of sitting empty beside live words.
 */
export const STATE_LABELS: DashboardLabels = {
    ownTierEyebrow: 'State',
    tierBelowEyebrow: 'Regions',
    tierBelowHeading: 'Region-wise Leadership',
    districtsEyebrow: 'Districts',
    districtsHeading: 'District-wise Leadership',
    contactEyebrow: 'Contact',
    contactHeading: 'Get in Touch',
};

export const ZONE_LABELS: DashboardLabels = {
    ownTierEyebrow: 'Zone',
    tierBelowEyebrow: 'States',
    tierBelowHeading: 'State-wise Leadership',
    /* A zone page has no districts band; the two fields ride along so one
       shape covers both pages, and the CMS simply does not offer them. */
    districtsEyebrow: '',
    districtsHeading: '',
    contactEyebrow: 'Contact',
    contactHeading: 'Get in Touch',
};

/** The national page, which is a zone page that is not a zone. */
export const NATIONAL_LABELS: DashboardLabels = {
    ...ZONE_LABELS,
    ownTierEyebrow: 'National',
    tierBelowEyebrow: 'Zones',
    tierBelowHeading: 'Zone-wise Leadership',
};

/**
 * A page's labels, with the shipped wording under anything left blank.
 *
 * The caller passes the right default table because only the caller knows
 * which page it is: `RegionPage` picks between the zone and national tables
 * on the same `national` flag it uses for everything else.
 */
export const dashboardLabels = (
    labels: Partial<DashboardLabels> | null | undefined,
    shipped: DashboardLabels,
): DashboardLabels => {
    const out = { ...shipped };
    (Object.keys(shipped) as (keyof DashboardLabels)[]).forEach((key) => {
        const value = String(labels?.[key] ?? '').trim();
        if (value) out[key] = value;
    });
    return out;
};

export interface RegionPage {
    id: string;
    regionKey: string;
    regionName: string;
    /** See `DashboardLabels`. Blank fields fall back to the shipped wording. */
    labels: DashboardLabels;
    slug: string;
    shortDescription: string;
    fullDescription: string;
    hero: RegionHero;
    vision: RegionVision;
    heroCarousel: RegionSlide[];
    leaders: RegionLeader[];
    /**
     * What the region has done, read as a band of figures.
     *
     * `title` carries the number and `summary` says what it counts — both text,
     * because "First council to publish a skills charter" is an achievement
     * with no number in it and a numeric field would have nowhere to put it.
     */
    achievements: RegionFeedItem[];
    /*
     * The same lists a state page carries.
     *
     * A region runs events, projects, consulting and advocacy across its
     * states, and is drawn with the same components — see `RegionPage.tsx`.
     */
    events: RegionFeedItem[];
    projects: RegionFeedItem[];
    policyAdvocacy: RegionFeedItem[];
    consultingServices: RegionFeedItem[];
    publications: RegionFeedItem[];
    mediaCoverages: RegionFeedItem[];
    /** The region's own, which no single state owns. */
    sectorUpdates: RegionFeedItem[];
    newsUpdates: RegionFeedItem[];
    mediaReleases: RegionFeedItem[];
    speakInMedia: RegionFeedItem[];
    relatedLinks: { label: string; href: string }[];
    /** Whatever the association has added itself. */
    customSections: CustomSection[];
    contact: RegionOffice;
    /** Named contacts on this tier, beyond the office and the bench. */
    contacts: RegionContactPerson[];
    /** The other Get in Touch groups. Independent of the leadership tiers. */
    regionContactGroups: RegionContactGroup[];
    districtContactGroups: RegionContactGroup[];
    /**
     * Active members here, as the council publishes it. Drawn on the map
     * marker; `0` means no figure has been given and the plain ring is drawn.
     */
    activeMembers: number;
    /** The rail's picture card — the same field the state page has. */
    explore: RegionCard;
    /** The ticked list in the rail. Figures live in `achievements`. */
    keyAchievements: RegionFeedItem[];
    promoCards: RegionCard[];
    socialLinks: { icon: string; href: string }[];
    consultingIntro: string;
    consultingCta: { label: string; href: string };
    feedbackEnabled: boolean;
    seo: RegionSeo;
    /**
     * Fields the editor named themselves.
     *
     * On the record and served by the API since the schema was written;
     * nothing in the CMS could set one until now.
     */
    extraFields: CmsExtraField[];
    status: 'draft' | 'published';
    updatedAt: string | null;
    focusStates: FocusState[];
    /** The tier below this one — one entry per state with a bench. */
    /**
     * THIS PAGE’S OWN boards for the tier below — the states of a region,
     * the regions of the country. Stored on this record and edited in its
     * own CMS section, so editing the South here cannot rewrite the South’s
     * own page.
     */
    stateRegions: RegionDistrict[];
    /**
     * The tier below as DERIVED from the pages under this one.
     *
     * ADDED to `stateRegions`, never chosen between — see the note in
     * `RegionPage.tsx`. It was read as a fallback for an empty
     * `stateRegions`, which meant the first board typed onto a zone page
     * took every real state page out of that zone.
     */
    statePanels: StatePanel[];
    /**
     * WHICH ORDER the tier below is drawn in, as an editor arranged it.
     *
     * Slugs on a zone page, region keys on the national one. A HINT over the
     * list rather than the list: `statePanels` already comes back sorted by
     * it, and this is served so the CMS can show the arrangement and change
     * it. See the field's note on the schema for what happens to a name that
     * no longer matches a page, and to a page the order has never heard of.
     */
    tierOrder: string[];
    /**
     * What the MAP is drawn from, when that is a different list.
     *
     * On a region page the two are the same — the map draws the states and
     * the boards are those states — so this is absent and the caller falls
     * back to `statePanels`. On the national page the boards are the five
     * regions and the map is still state by state, because that is what a
     * map of India is.
     */
    mapPanels?: StatePanel[];
}

/**
 * ONE DISTRICT of a state — the third tier of the leadership board.
 *
 * `leaders` is the SAME `RegionLeader` the state and the region use, so one
 * board component draws all three tiers. A district shape of its own would be
 * three boards that drift apart the first time a field is added.
 */
export interface RegionDistrict {
    id: string;
    name: string;
    /** One line under the name — what the district's members make. */
    description: string;
    slug: string;
    leaders: RegionLeader[];
    contact: RegionOffice;
    /** Named contacts on this tier, beyond the office and the bench. */
    contacts: RegionContactPerson[];
    /**
     * Active members here, as the council publishes it. Drawn on the map
     * marker; `0` means no figure has been given and the plain ring is drawn.
     */
    activeMembers: number;
    /**
     * Which of the state's regions this district sits in, by name.
     *
     * The map colours the district from it. Empty means unassigned, and the
     * map falls back to the geographic zone baked into the boundary file —
     * which is what every page shows until somebody starts assigning them.
     *
     * A NAME, not an id: these rows are subdocuments rewritten wholesale on
     * every save, so their ids do not survive a reorder.
     */
    regionName: string;
    displayOrder: number;
    isHidden: boolean;
}

/**
 * One state, as the region page's second tier.
 *
 * The mirror of `RegionPanel`: that is the tier ABOVE a state page, this is the
 * tier BELOW a region page. Both are read from the other page's record rather
 * than copied, so a chairman is one row wherever they appear.
 */
export interface StatePanel {
    name: string;
    slug: string;
    /** The line under the heading, from the state's own description. */
    blurb: string;
    leaders: RegionLeader[];
    contact: RegionOffice;
    /** Named contacts on this tier, beyond the office and the bench. */
    contacts: RegionContactPerson[];
    /**
     * Active members here, as the council publishes it. Drawn on the map
     * marker; `0` means no figure has been given and the plain ring is drawn.
     */
    activeMembers: number;
}

/**
 * The REGION tier of a state page, read from the region's own page.
 *
 * Never stored on the state: the regional chairman is one person, and a copy of
 * them on every state page beneath the region is a copy that goes stale
 * silently. `contacts` is the region's states with their telephone numbers —
 * the "Region Contacts" column of the contact strip.
 */
export interface RegionPanel {
    key: string;
    slug: string;
    label: string;
    /** The line under the heading, from the region's own description. */
    blurb: string;
    leaders: RegionLeader[];
    contact: RegionOffice;
    /* NOT the tier list. `RegionPanel` is the national region's summary card,
       and its `contacts` is a row of links — a different shape that predates
       `RegionContactPerson` and is read by the panel alone. */
    contacts: { label: string; href: string; phone: string; email: string }[];
}

export interface StatePage {
    id: string;
    stateName: string;
    /** See `DashboardLabels`. Blank fields fall back to the shipped wording. */
    labels: DashboardLabels;
    slug: string;
    regionKey: string;
    regionName: string;
    shortDescription: string;
    fullDescription: string;
    hero: RegionHero;
    vision: RegionVision;
    heroCarousel: RegionSlide[];
    leaders: RegionLeader[];
    /**
     * The state's OWN regions — its second tier.
     *
     * NOT the national region this state belongs to, which is `regionPanel`.
     * "South Region" on the Tamil Nadu page means the southern districts of
     * Tamil Nadu; "South Region" in the menu means eight states. Same shape as
     * a district, because a zone and a chapter are the same object at two
     * scales.
     */
    stateRegions: RegionDistrict[];
    /** The third tier of the leadership board — see `RegionDistrict`. */
    districts: RegionDistrict[];
    /** The state's own — see the note on the region's. */
    achievements: RegionFeedItem[];
    /**
     * The ticked list in the rail. FIGURES live in `achievements`; these are
     * sentences. See the note on the schema for why they are two fields.
     */
    keyAchievements: RegionFeedItem[];
    events: RegionFeedItem[];
    projects: RegionFeedItem[];
    policyAdvocacy: RegionFeedItem[];
    consultingServices: RegionFeedItem[];
    publications: RegionFeedItem[];
    mediaReleases: RegionFeedItem[];
    mediaCoverages: RegionFeedItem[];
    relatedLinks: { label: string; href: string }[];
    /** Whatever the association has added itself. */
    customSections: CustomSection[];
    contact: RegionOffice;
    /** Named contacts on this tier, beyond the office and the bench. */
    contacts: RegionContactPerson[];
    /** The other Get in Touch groups. Independent of the leadership tiers. */
    regionContactGroups: RegionContactGroup[];
    districtContactGroups: RegionContactGroup[];
    /**
     * Active members here, as the council publishes it. Drawn on the map
     * marker; `0` means no figure has been given and the plain ring is drawn.
     */
    activeMembers: number;
    explore: RegionCard;
    promoCards: RegionCard[];
    socialLinks: { icon: string; href: string }[];
    consultingIntro: string;
    consultingCta: { label: string; href: string };
    feedbackEnabled: boolean;
    seo: RegionSeo;
    /**
     * Fields the editor named themselves.
     *
     * On the record and served by the API since the schema was written;
     * nothing in the CMS could set one until now.
     */
    extraFields: CmsExtraField[];
    status: 'draft' | 'published';
    updatedAt: string | null;
    region: { key: string; slug: string; label: string } | null;
    /**
     * The middle tier of the board, and the middle column of the contact
     * strip. `null` when the state sits in no region the map knows.
     */
    regionPanel: RegionPanel | null;
    siblingStates: FocusState[];
}

export interface RegionMapEntry {
    key: string;
    slug: string;
    label: string;
    order: number;
    /**
     * The whole country, not one of the five regions.
     *
     * It comes down in the same list and is reached the same way, but it is
     * not a sixth region: no state page hangs under it, so `states` is
     * empty and a caller that treats an empty list as "nothing published
     * here yet" would be wrong about this one row.
     */
    national?: boolean;
    hasPage: boolean;
    status: string;
    states: { name: string; slug: string; hasPage: boolean; status: string }[];
}

export interface GalleryPhoto {
    id: string;
    /** The readable public address; see lib/eventPath `galleryPath`. */
    slug?: string;
    title: string;
    caption: string;
    category: string;
    sector: string;
    state: string;
    region: string;
    eventDate: string;
    location: string;
    media: CmsMediaShape;
}

/* ------------------------------------------------------------------ calls */

/*
 * ============================================================================
 * THESE THREE ARE CACHED, AND THAT IS A PERFORMANCE FIX, NOT A NICETY
 * ============================================================================
 *
 * Every public read on the site goes through `cached()` in `cmsApi` — stale
 * while revalidating, with in-flight de-duplication — except these, which were
 * written later and missed it. The cost showed on every navigation:
 *
 *   `getRegionMap` feeds the REGIONS MENU in the header, which remounts on
 *   every page. Moving from one page to another re-fetched the whole region
 *   tree even though it had just been fetched and had not changed.
 *
 *   `getRegionPage` / `getStatePage` are the pages themselves. Going back to a
 *   state a reader had just left showed the full skeleton again while the same
 *   document was fetched a second time.
 *
 * With the shared helper a repeat view renders from memory immediately and
 * refreshes behind the render, so the skeleton is now only what it should be:
 * the first sight of a page nobody has opened yet.
 *
 * WHICH MAKES CLEARING THEM PART OF SAVING, and it was missed.
 *
 * `invalidateCmsCache()` runs after every write in `cmsApi`, and this file
 * is not `cmsApi`: the three keys below were added here and no write cleared
 * them. The CMS and the public site are ONE bundle sharing ONE cache, so an
 * editor who reordered the districts, saved, and opened the state page was
 * handed the copy from before the save — rendered, then quietly refreshed
 * behind it, so a SECOND visit showed the new order and the first showed the
 * old. The reorder was on the server the whole time.
 *
 * `cacheKeysFor` is the one list of what a page write invalidates, so a new
 * read here cannot be given a key that nothing clears.
 */
/**
 * A zone's name as the site prints it: "South" -> "South Zone".
 *
 * The five divisions of the country are ZONES. "Region" is kept for divisions
 * inside a state ("North Region — Tamil Nadu"), and the header menu that lists
 * the zones is still called Regions. The map stores the short key-like label,
 * so the word is added here, once. "National" is not a zone and is left alone,
 * as is a label an editor already wrote with "Zone" or "Region" in it.
 */
export const zoneName = (label?: string | null, national = false) => {
    const name = String(label || '').trim();
    if (!name || national || /\b(zone|region)\b/i.test(name)) return name;
    return `${name} Zone`;
};

export const getRegionMap = async (): Promise<RegionMapEntry[]> => cached(
    'regions:map',
    async () => {
        const res = await api.get('/cms/regions/map');
        return unwrap<{ regions: RegionMapEntry[] }>(res, { regions: [] }).regions || [];
    },
);

export const getRegionPage = async (slug: string): Promise<RegionPage> => cached(
    `regions:page:${slug}`,
    async () => {
        const res = await api.get(`/cms/regions/${encodeURIComponent(slug)}`);
        return unwrap<RegionPage>(res, null as unknown as RegionPage);
    },
);

export const getStatePage = async (slug: string): Promise<StatePage> => cached(
    `states:page:${slug}`,
    async () => {
        const res = await api.get(`/cms/states/${encodeURIComponent(slug)}`);
        return unwrap<StatePage>(res, null as unknown as StatePage);
    },
);

export interface FeedPage {
    title: string;
    slug: string;
    type: string;
    items: RegionFeedItem[];
    total: number;
    offset: number;
    limit: number;
}

export const getRegionFeed = async (
    slug: string, type: string, params: { offset?: number; limit?: number } = {},
): Promise<FeedPage> => {
    const res = await api.get(`/cms/regions/${encodeURIComponent(slug)}/feed/${encodeURIComponent(type)}`, { params });
    return unwrap<FeedPage>(res, { title: '', slug, type, items: [], total: 0, offset: 0, limit: 20 });
};

export const getStateFeed = async (
    slug: string, type: string, params: { offset?: number; limit?: number } = {},
): Promise<FeedPage> => {
    const res = await api.get(`/cms/states/${encodeURIComponent(slug)}/feed/${encodeURIComponent(type)}`, { params });
    return unwrap<FeedPage>(res, { title: '', slug, type, items: [], total: 0, offset: 0, limit: 20 });
};

export interface GalleryQuery {
    state?: string;
    region?: string;
    category?: string;
    sector?: string;
    q?: string;
    offset?: number;
    limit?: number;
}

export const listRegionGallery = async (params: GalleryQuery = {}) => {
    const res = await api.get('/cms/regions/gallery', { params });
    return unwrap(res, { items: [] as GalleryPhoto[], total: 0, offset: 0, limit: 24 });
};

export const getGalleryFilters = async (params: { state?: string; region?: string } = {}) => {
    const res = await api.get('/cms/regions/gallery/filters', { params });
    return unwrap(res, { categories: [] as string[], sectors: [] as string[], states: [] as string[] });
};

/* ------------------------------------------------------------------ admin */

/**
 * A ROW ON THE LIST SCREEN, not a page.
 *
 * `page` used to be the whole document, so that opening the editor needed
 * no second call. Forty-two whole documents is 1.4MB and took over a
 * minute off a remote cluster, and the CMS timed out drawing forty rows of
 * name and status. It is a summary; the editor fetches its own page.
 */
export interface AdminPageSummary {
    status: string;
    updatedAt?: string | null;
    regionKey?: string;
    regionName?: string;
}

export interface AdminRegionRow {
    key: string;
    label: string;
    /** The whole country, not one of the five regions. See `RegionMapEntry`. */
    national?: boolean;
    stateCount: number;
    /** `null` means no page has been created for this region yet. */
    page: AdminPageSummary | null;
}

/** A state row on the list screen. The editor fetches the page itself. */
export interface AdminStateRow {
    stateName: string;
    slug: string;
    regionKey: string;
    status: string;
    updatedAt?: string | null;
}

export const listRegionPagesAdmin = async () => {
    const res = await api.get('/cms/region-pages');
    return unwrap(res, {
        regions: [] as AdminRegionRow[],
        states: [] as AdminStateRow[],
        allStates: [] as { name: string; slug: string; regionKey: string; regionLabel: string }[],
    });
};

/**
 * Saves a page. ONLY THE KEYS PASSED ARE WRITTEN.
 *
 * The server treats an absent key as untouched, so a save from the Leadership
 * panel cannot blank the Sector Updates that another panel owns. Send the whole
 * page only when the whole page is what the editor changed.
 */
/**
 * Everything a write to one page can have changed.
 *
 * The page itself, obviously. `regions:map` as well, because the menu in the
 * header is built from the same documents — renaming a state in its own
 * editor renames it in the navigation, and a stale map would go on offering
 * the old name until the tab was reloaded.
 */
const cacheKeysFor = (kind: 'regions' | 'states', slug: string) => [
    `${kind}:page:${slug}`,
    'regions:map',
];

const invalidatePage = (kind: 'regions' | 'states', slug: string) => {
    cacheKeysFor(kind, slug).forEach((key) => invalidateCmsCache(key));
};

/**
 * The one page the editor is about to open, drafts included.
 *
 * `null` is a valid answer and means nobody has written this page yet — the
 * editor opens empty on it, which is how a new region or state is created.
 */
export const getRegionPageAdmin = async (slug: string): Promise<RegionPage | null> => {
    const res = await api.get(`/cms/region-pages/${encodeURIComponent(slug)}`);
    return unwrap<RegionPage | null>(res, null);
};

export const getStatePageAdmin = async (slug: string): Promise<StatePage | null> => {
    const res = await api.get(`/cms/state-pages/${encodeURIComponent(slug)}`);
    return unwrap<StatePage | null>(res, null);
};

export const saveRegionPage = async (slug: string, payload: Partial<RegionPage>) => {
    const res = await api.put(`/cms/region-pages/${encodeURIComponent(slug)}`, payload);
    invalidatePage('regions', slug);
    return unwrap<RegionPage>(res, null as unknown as RegionPage);
};

export const saveStatePage = async (slug: string, payload: Partial<StatePage>) => {
    const res = await api.put(`/cms/state-pages/${encodeURIComponent(slug)}`, payload);
    invalidatePage('states', slug);
    return unwrap<StatePage>(res, null as unknown as StatePage);
};

export const deleteStatePage = async (slug: string) => {
    const res = await api.delete(`/cms/state-pages/${encodeURIComponent(slug)}`);
    invalidatePage('states', slug);
    return unwrap(res, { deleted: false });
};
