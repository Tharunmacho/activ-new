/**
 * The CMS service layer.
 *
 * Public reads for the onboarding site, admin writes for the panel. Everything
 * goes through the same axios instance the rest of the site uses, so the token
 * header, the timeout and the 401 handling are identical.
 *
 * Each read returns a usable empty shape on failure rather than throwing. The
 * landing page must render even when nothing has been authored yet, or when the
 * API is briefly unreachable — a marketing page that shows a stack trace is
 * worse than one showing nothing.
 *
 * Note what an empty shape is NOT: it is not a set of default copy. The public
 * pages render exactly what the database holds, so deleting a stat or a nav link
 * in the CMS removes it from the site. Copy baked into the markup as a fallback
 * would make deletion appear to do nothing.
 */
import api, { unwrap, errorMessage, registerCacheClearer } from './api';
import { resolveMediaUrl } from '@/config/api.config';

// ============================================================ types

/**
 * A picture or a video, with how it should sit in its frame.
 *
 * `fit` and `position` exist because uploaded media is rarely the shape of the
 * slot it lands in. `cover` fills and crops, `contain` shows the whole thing
 * and pads. Without the choice, an admin uploading a portrait photo into a wide
 * banner gets it cropped to a sliver with no way to say otherwise.
 */
export interface CmsMedia {
    url: string;
    type: 'image' | 'video';
    alt: string;
    fit: 'cover' | 'contain';
    position: string;
}

/**
 * A photograph inside a gallery album.
 *
 * It has a page of its own at `/gallery/:id/photo/:n`, so it carries what a
 * page carries: a name, a description, and whatever else the association
 * wants recorded about THAT picture. `customFields` is the same pair list
 * the album itself uses — the editor names the field, and the page prints
 * the name they typed.
 */
export interface GalleryPhotoMedia extends CmsMedia {
    /** The heading on its page. Falls back to `caption`, then to "Untitled". */
    title?: string;
    /** The one line under the heading. Predates `title`; see the schema. */
    caption?: string;
    /** The write-up, printed as "About this photograph". */
    description?: string;
    /** "Photographer", "Chief Guest" — whatever the editor named. */
    customFields?: GalleryField[];
}

/**
 * A field the editor named, on a gallery album or on one of its photographs.
 *
 * The same shape as every other named field on the site now — the icon and
 * the placement moved onto `CmsExtraField` when they were rolled out. Kept as
 * a name because a dozen call sites read well with it.
 */
export type GalleryField = CmsExtraField;

/**
 * A field the editor named themselves.
 *
 * Every page carries a list of these. The fields a page declares are the ones
 * its layout depends on; this is everything else an association wants to say,
 * rendered as a labelled line in the order it was entered.
 */
export interface CmsExtraField {
    label: string;
    value: string;
    /**
     * The mark drawn beside it where the surface draws one.
     *
     * A name from the CMS icon set, chosen by the editor. It is asked for
     * rather than guessed: a glyph cannot be inferred from a label somebody
     * typed a moment ago, and a card that rings every row left an empty
     * circle next to any field that had none.
     */
    icon?: string;
    /**
     * WHERE it appears, and this is the one that was missing everywhere.
     *
     *   `card`    a labelled fact in the page's details card.
     *   `content` a section of its own in the body, the label as the heading
     *             and the value as the prose under it.
     *
     * Every named field on every screen used to be a card field, so an editor
     * with a paragraph to write had only a box built for one-line facts to
     * put it in. Defaulted to `card` because that is where every existing row
     * already appears, and a default that moved them would rearrange live
     * pages nobody had edited.
     */
    placement?: 'card' | 'content';
}

/**
 * ==========================================================================
 * WHAT THE EDITOR DID TO ONE CARD ON A CMS SCREEN
 * ==========================================================================
 *
 * `extraFields` above is what the PAGE wants to add. This is the same
 * question one level down, per section, plus the answer to a question the
 * CMS could not previously be asked: do you want this section at all.
 *
 * `key` is a slug this repo owns — `carousel.buttons`, `about.points` —
 * never editor input, so it survives a rewording of the card's title and
 * cannot collide. A key nothing renders any more is an inert row, not an
 * error: bringing the card back under the same key brings its rows with it.
 *
 * Only `hidden` takes a section off the public page. Removing a card keeps
 * the fields inside it, because an editor who removes one and restores it
 * the next morning should find their work where they left it.
 */
export interface CmsSectionOverride {
    key: string;
    hidden: boolean;
    /**
     * The editor's own heading for this card, where they set one.
     *
     * Optional because every row written before this existed has none, and
     * blank means "use the heading the code ships" — which is what the CMS
     * and the public page both fall back to. It never affects `key`.
     */
    title?: string;
    fields: CmsExtraField[];
}

export const EMPTY_MEDIA: CmsMedia = { url: '', type: 'image', alt: '', fit: 'cover', position: 'center' };

/** A label and where it goes. Nav entries, footer links and buttons all use it. */
export interface CmsLink { label: string; href: string }

/** A figure, its caption, and the icon drawn beside it. */
export interface CmsStat { icon: string; value: string; label: string }

/** A point in a list, each with its own icon. */
export interface CmsBullet { icon: string; text: string }

// ---------------------------------------------------------------- site chrome

export interface SiteSettings {
    /** Shared by the header and the footer — one logo, edited once. */
    brand: { logo: CmsMedia; fullName: string; tagline: string };
    header: {
        navLinks: CmsLink[];
        ctaLabel: string;
        ctaHref: string;
        /** Hex. The bar itself; was hardcoded white. */
        background: string;
        /** Hex. The lockup, nav, button and menu icon; was hardcoded #1c2e68. */
        textColor: string;
    };
    footer: {
        addressLines: string[];
        linkColumns: { heading: string; links: CmsLink[] }[];
        contactHeading: string;
        phones: string[];
        email: string;
        socials: { icon: string; href: string }[];
        /** May contain `{year}`, substituted at render time. */
        copyright: string;
        legalLinks: CmsLink[];
        note: string;
    };
    /** Fields the editor named themselves. Rendered as a labelled list. */
    extraFields: CmsExtraField[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
    /**
     * The band above the footer, on every page.
     *
     * "Across India / Find ACTIV where you are", over the region tiles. The
     * tiles are built from the published region pages and are not authored;
     * only the wording over them is. It lives on the site settings because
     * seven pages draw it — it is furniture, like the footer.
     */
    acrossIndia: {
        enabled: boolean;
        eyebrow: string;
        heading: string;
        subtitle: string;
        /**
         * Region keys the band does NOT draw.
         *
         * A deny list, not an allow list: the tiles are derived from the
         * published region pages, so an allow list would make every new
         * region invisible until somebody remembered to tick it.
         */
        hidden: string[];
    };
}

// ---------------------------------------------------------------- home

/** Which side of the banner a slide's words sit on. */
export type BannerAlign = 'left' | 'right';

export interface HeroSlide {
    media: CmsMedia;
    caption: string;
    /**
     * This slide's OWN heading, highlighted words and subheading. Blank falls
     * back to the banner's shared headline, so older slides look as they did.
     */
    headline: string;
    headlineHighlight: string;
    subheadline: string;
    /** Left or right — moved off whichever side the photograph's subject is on. */
    align: BannerAlign;
}

export interface HomeCarousel {
    slides: HeroSlide[];
    headline: string;
    headlineHighlight: string;
    subheadline: string;
    ctaLabel: string;
    ctaHref: string;
    ctaIcon: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    secondaryCtaIcon: string;
    /**
     * Recent gallery posters carried by the banner itself.
     *
     * The slides are NOT stored here — they are the gallery's own items, read
     * at render time, each linking to its own page.
     */
    galleryPosters: {
        enabled: boolean;
        /** Before or after the authored slides above. */
        position: 'after' | 'before';
    };
    highlightCard: {
        enabled: boolean;
        icon: string;
        eyebrow: string;
        value: string;
        caption: string;
        stats: CmsStat[];
    };
}

export interface HomeAbout {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    eyebrow: string;
    body: string;
    bullets: CmsBullet[];
    media: CmsMedia;
    logoOverlay: CmsMedia;
    linkLabel: string;
    linkHref: string;
    statsBar: CmsStat[];
    /** Fields the editor named themselves. Rendered as a labelled list. */
    extraFields: CmsExtraField[];
}

/**
 * The home page as the two blocks it is built from.
 *
 * A `stats` array and a `features` array used to be here. No public page
 * rendered them — the figures the home page shows are `about.statsBar` — so
 * editing them changed nothing, which is the worst thing a CMS field can do.
 */
export interface HomeContent {
    carousel: HomeCarousel;
    about: HomeAbout;
    /**
     * Cards the editor removed, and the rows they added to each.
     *
     * On the DOCUMENT, not in either block: the screen's cards run across
     * both, so a per-block list would make `carousel.slides` and
     * `about.points` two different kinds of key. It rides along with
     * whichever block is saved.
     */
    sections: CmsSectionOverride[];
    /**
     * The READ did not succeed — not the same as nothing being authored.
     *
     * Every reader here catches and returns the empty shape, which is right
     * for a page with no content and wrong for a page that could not be
     * asked: the two look identical to a caller, so the home page rendered
     * as a blank sheet whenever the API was unreachable.
     *
     * Optional, so nothing that ignores it changes behaviour.
     */
    failed?: boolean;
}

// ---------------------------------------------------------------- about page

export interface AboutContent {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    body: string;
    bullets: CmsBullet[];
    /** Kept in step with `bullets` by the server; the pages read `bullets`. */
    bulletPoints: string[];
    media: CmsMedia;
    logoOverlay: CmsMedia;
    statsBar: CmsStat[];
    /**
     * The chairman’s words — the one thing on the page written by a person.
     *
     * Four fields and not one: the page sets the words large and the
     * attribution small, and it cannot tell them apart if they arrive as a
     * single string. All optional; with no `text` the block is not drawn.
     */
    quote: {
        /** HTML — an editor pasting from a letter brings emphasis with them. */
        text: string;
        author: string;
        role: string;
        photo: CmsMedia;
    };
    /** Fields the editor named themselves. Rendered as a labelled list. */
    extraFields: CmsExtraField[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

// ---------------------------------------------------------------- events page

export interface EventsSettings {
    badgeText: string;
    heading: string;
    /**
     * The tail of the heading, carrying the accent colour on the hero band.
     * Stored separately rather than split out of `heading` at render time —
     * guessing where to cut a sentence works for one heading and produces
     * nonsense for the next one an editor types.
     */
    headingHighlight: string;
    /** The paragraph under the heading, on the Events page's hero band. */
    lede: string;
    /** The small centred caption between rules, on the HOME page's grid. */
    subtitle: string;

    /** The photograph in the hero. No url renders no frame. */
    heroMedia: CmsMedia;
    /** The badge pinned to the hero photograph. */
    heroBadge: { enabled: boolean; icon: string; title: string; subtitle: string };
    /** The figures across the hero band. */
    stats: CmsStat[];

    searchPlaceholder: string;
    /** Filter chips. `All` is prepended by the page. Matched on `event.category`. */
    categories: { label: string; icon: string }[];

    viewAllLabel: string;
    viewAllHref: string;
    emptyText: string;
    /** Shown when a filter matches nothing. `{query}` is substituted. */
    emptyFilterText: string;

    /** The call-to-action strip under the grid. */
    banner: {
        enabled: boolean; icon: string; title: string;
        subtitle: string; ctaLabel: string; ctaHref: string;
    };
    /**
     * Where a visitor is sent for events that have already happened.
     *
     * `/events` is upcoming only. Without this the page answers a visitor's
     * question by showing them nothing, which reads as a page that lost its
     * content rather than one that never held it.
     */
    pastLink: {
        enabled: boolean; icon: string; title: string;
        subtitle: string; label: string; href: string;
    };
    /** Fields the editor named themselves. Rendered as a labelled list. */
    extraFields: CmsExtraField[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

// ---------------------------------------------------------------- gallery

export interface GallerySettings {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    description: string;
    noteLines: string[];
    categories: { label: string; icon: string }[];
    viewMoreLabel: string;
    pageSize: number;
    /**
     * The band saying what this page IS: the record of every past event.
     *
     * The other half of `EventsSettings.pastLink` — one sends a visitor here,
     * this one confirms they arrived at the right place.
     */
    pastEvents: { enabled: boolean; icon: string; title: string; subtitle: string };
    emptyText: string;
    /** `{category}` is replaced with the chip the visitor picked. */
    emptyFilterText: string;
    /** The copy on one poster's own page. */
    detail: GalleryDetailCopy;
    /** Fields the editor named themselves. Rendered as a labelled list. */
    extraFields: CmsExtraField[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

export interface GalleryDetailCopy {
    backLabel: string;
    aboutHeading: string;
    highlightsHeading: string;
    photosHeading: string;
    relatedHeading: string;
    ctaLabel: string;
    ctaHref: string;
    /** Shown when a link points at an item that is gone or hidden. */
    missingText: string;
}

export interface GalleryItem {
    _id: string;
    media: CmsMedia;
    title: string;
    caption: string;
    category: string;
    /** The industry — the gallery's second dropdown is built from these. */
    sector?: string;
    eventDate: string;
    location: string;
    /**
     * The write-up on the item's own page. Absent from the landing strip's
     * payload — that request projects the long fields away.
     */
    description?: string;
    /** Bullet points beside the write-up. */
    highlights?: string[];
    /** Further photographs from the same event, under the poster. */
    /** The album's photographs, each with its own description. */
    photos?: GalleryPhotoMedia[];
    /**
     * Fields the editor named themselves — chief guest, host chapter, sponsor,
     * anything this schema does not know about. Rendered as a labelled list on
     * the item's own page, in the order they were entered.
     */
    customFields?: GalleryField[];
    featured: boolean;
    /**
     * Leads both the banner and the gallery grid.
     *
     * Ordering is the server's job — this is here so the CMS can show which
     * items are pinned, not so a page can re-sort them.
     */
    pinned?: boolean;
    /** Rides in the landing page banner. Undefined on rows predating the field. */
    showOnHome?: boolean;
    /**
     * What the home banner says over THIS image, and on which side. Blank
     * falls back to the banner's shared headline.
     */
    bannerHeadline?: string;
    bannerHighlight?: string;
    bannerSubheadline?: string;
    bannerAlign?: BannerAlign;
    sortOrder: number;
    visible: boolean;
}

// ---------------------------------------------------------------- contact

export interface ContactInfo {
    badgeIcon: string;
    badgeText: string;
    heading: string;
    headingHighlight: string;
    description: string;
    heroMedia: CmsMedia[];
    formCard: {
        icon: string; title: string; subtitle: string;
        submitLabel: string; successMessage: string;
        /** What each field is called. The fields themselves are fixed. */
        namePlaceholder: string; emailPlaceholder: string; phonePlaceholder: string;
        subjectPlaceholder: string; messagePlaceholder: string;
        validationMessage: string; failureMessage: string;
    };
    infoCard: {
        icon: string; title: string; subtitle: string;
        addressLabel: string; phoneLabel: string; emailLabel: string; hoursLabel: string;
    };
    addressLines: string[];
    phone: string;
    alternatePhone: string;
    email: string;
    workingHours: string[];
    mapEmbedUrl: string;
    social: { facebook: string; instagram: string; linkedin: string; youtube: string };
    banner: { enabled: boolean; icon: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string };
    /**
     * The regions band as the Contact page draws it: its own wording, and
     * tiles that open each region's or state's contact section. Blank fields
     * fall back to the shipped wording in `AcrossIndia`.
     */
    regionsBand: { enabled: boolean; eyebrow: string; heading: string; subtitle: string };
    /** Fields the editor named themselves — extra rows in the details card. */
    extraFields: CmsExtraField[];
    /** Cards the editor removed, and the rows they added to each. */
    sections: CmsSectionOverride[];
}

export interface CmsEvent {
    id: string;
    /** The readable public address (`/events/<slug>`); see lib/eventPath. */
    slug?: string;
    title: string;
    description: string;
    startAt: string | null;
    endAt: string | null;
    location: string;
    /** The hall or building, where the API distinguishes it from . */
    venue?: string;
    /** Region targeting: empty means everyone. */
    state?: string;
    district?: string;
    block?: string;
    /*
     * Every region this event is aimed at. The three fields above are the
     * legacy single-region form, mirrored by the server from the first entry so
     * the mobile app keeps working; this is the real audience.
     */
    targets?: { state: string; district: string; block: string }[];
    /**
     * Whether this event was posted to the onboarding site's events section.
     *
     * Optional, and `false` does NOT mean "not on the public site" on its own:
     * the field postdates every event in the collection, so read it together
     * with `channel` the way the server's `isOnboardingContent` does.
     */
    showOnOnboarding?: boolean;
    /**
     * On the home page's upcoming strip.
     *
     * A THIRD question, not a restatement of the two above: `status` is
     * "written yet", `showOnOnboarding` is "may the public read it", and
     * this is "is it one of the few on the landing page". True unless
     * somebody turned it off, so a new event needs no second step.
     */
    showOnHome?: boolean;
    /**
     * In the home page BANNER (the slideshow at the top), with its own words —
     * the gallery item's banner fields, on an event. On unless switched off,
     * like a gallery item's `showOnHome` — posting an event puts it there.
     * A different surface from `showOnHome`, which is the events strip.
     */
    showInBanner?: boolean;
    /** What the event is about, and its language — see the event model. */
    topic?: string;
    language?: string;
    bannerHeadline?: string;
    bannerHighlight?: string;
    bannerSubheadline?: string;
    bannerAlign?: BannerAlign;
    /**
     * Which site the event was authored for — `public` is the CMS's onboarding
     * programme, `members` the association's own. Optional for the same reason.
     */
    channel?: 'public' | 'members';
    /**
     * "Everyone in the association", stored beside `targets` rather than as a
     * shorthand for an empty one. Optional: a row written before the field
     * existed says the same thing with an empty target list.
     */
    reachEveryone?: boolean;
    /** Rupees. 0 is free. A fee adds a payment step before the seat confirms. */
    registrationFee?: number;
    /**
     * The member rate. `null` means NO member rate — one price for everybody.
     *
     * Nullable and not merely optional, because `0` is a real answer (members
     * attend free) and `undefined` would be indistinguishable from it in any
     * check written with `||`. The form reads it with `== null`.
     */
    memberFee?: number | null;
    /** Resolved by the server: the lower of the two. Read-only. */
    memberPrice?: number;
    hasMemberRate?: boolean;
    /** The questions this event asks, designed per event by the super admin. */
    registrationFields?: {
        key: string;
        label: string;
        type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'checkbox';
        required: boolean;
        placeholder: string;
        helpText: string;
        options: string[];
    }[];
    /** "Tamil Nadu › Sivaganga", or empty for everyone. Derived by the server. */
    targetLabel?: string;
    /** The raw banner path. Kept because the mobile app reads only this. */
    imageUrl: string;
    /** The same media shape as every other section, so the frame can honour fit. */
    media: CmsMedia;
    status: 'draft' | 'published';

    /*
     * The advanced-display half (EVT-001, EVT-002).
     *
     * Every field is optional because this listing is read by the PUBLIC site
     * and by the mobile app as well as by the editor, and both of those were
     * written against the shape above. A row created before these existed comes
     * back without them, so anything reading one must cope with `undefined`
     * rather than assume an empty array.
     *
     * The server's `pickEventDetail` is the authority on their shape — it lifts
     * them off the one event mapper so this listing and `/events` cannot
     * describe the same row differently.
     */
    /**
     * What kind of event this is — matched against a chip in
     * `eventsSettings.categories`, the same arrangement `GalleryItem.category`
     * uses. Optional: a row created before the field existed has none, which
     * the page reads as "no badge, matches the All chip only".
     */
    category?: string;
    /** `paid` restricts the event to members with an active membership. */
    audience?: 'all' | 'paid';
    agenda?: CmsAgendaItem[];
    /** The per-day programme — see `CmsEventDay`. Empty for a one-day event. */
    days?: CmsEventDay[];
    speakers?: CmsSpeaker[];
    /**
     * HOW the event is attended: in a room, or on a link.
     *
     * A different question from `category`, which says what KIND of event it
     * is. Absent on every row written before the field existed, which the
     * readers treat as `offline` — what those events actually were.
     */
    mode?: 'offline' | 'online';
    /** "Zoom", "Google Meet". Public: it says what people need open. */
    onlinePlatform?: string;
    /**
     * The join link. Present ONLY for a signed-in content admin — the server
     * withholds it from every public read, because a link on a public page is
     * a seat given away. Whoever books gets it on their confirmation instead.
     */
    onlineUrl?: string;
    venueAddress?: string;
    venueMapUrl?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    registrationEnabled?: boolean;
    registrationDeadline?: string | null;
    capacity?: number;
    registrationNote?: string;
    reminderOffsetsHours?: number[];
}

/** One line of the hourly agenda. Times are `HH:MM` OF the event day. */
export interface CmsAgendaItem {
    id?: string;
    startTime: string;
    endTime: string;
    title: string;
    description: string;
    speaker: string;
    location: string;
}

/**
 * ONE DAY OF A MULTI-DAY EVENT — its own hours and its own sessions.
 *
 * A three-day conclave does not run the same hours three times: day one opens
 * late after registration, day three closes at lunch. The event carried one
 * start/end pair and one flat agenda, so the page could print a single span
 * for all three days and a list of sessions with nothing saying which day
 * each fell on.
 *
 * Empty on a single-day event and on everything written before this existed —
 * readers fall back to the event's own `startAt`/`endAt` and flat `agenda`.
 */
export interface CmsEventDay {
    id?: string;
    /** ISO date, the day itself. */
    date: string;
    /** "HH:MM" on a 24-hour clock, as the whole site stores times. */
    startTime: string;
    endTime: string;
    agenda: CmsAgendaItem[];
}

export interface CmsSpeaker {
    id?: string;
    name: string;
    role: string;
    organization: string;
    bio: string;
    photoUrl: string;
}

export interface ContactMessage {
    _id: string;
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    status: 'new' | 'read' | 'archived';
    createdAt: string;
}

/**
 * Every icon an editor may pick, grouped so the picker is navigable.
 *
 * Must stay in step with `ICON_NAMES` in `backend/src/modules/cms/cms.models.js`
 * — the server rejects anything else, and the renderer falls back on anything
 * it does not recognise, so a mismatch degrades rather than breaks.
 */
/**
 * EVERY MARK THE SITE CAN DRAW, grouped for the picker.
 *
 * This list and `ICONS` in `CmsIcon` and `ICON_NAMES` on the server are three
 * copies of one set, and they had drifted: ten names the renderer draws and
 * the server accepts — `factory`, `leaf`, `graduation-cap`, `ship`, `info`,
 * `camera`, `tag`, `users-2`, `quote` — were simply not in the picker, so the
 * only way to use one was to already know it existed. (`landmark` was worse:
 * drawable here and REJECTED by the server, which swapped it for `star`
 * without a word.) All three lists carry the same names now.
 */
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
    { label: 'People', icons: ['users', 'users-2', 'user', 'handshake', 'heart-handshake', 'building', 'briefcase'] },
    { label: 'Growth', icons: ['trending-up', 'award', 'target', 'lightbulb', 'star', 'heart', 'rocket'] },
    { label: 'Industry & learning', icons: ['factory', 'leaf', 'graduation-cap', 'ship', 'hard-hat'] },
    { label: 'Trust', icons: ['shield', 'shield-check', 'scale', 'landmark'] },
    { label: 'Place & time', icons: ['globe', 'map-pin', 'calendar', 'calendar-days', 'clock'] },
    { label: 'Events & media', icons: ['image', 'images', 'camera', 'monitor-play', 'play', 'tent', 'book-open', 'grid', 'party-popper', 'mic'] },
    { label: 'Notes & labels', icons: ['info', 'tag', 'quote', 'file-text'] },
    { label: 'Contact', icons: ['phone', 'mail', 'message-square', 'send'] },
    { label: 'Navigation', icons: ['arrow-right', 'external-link', 'home'] },
    { label: 'Social', icons: ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'] },
];

export const ICON_NAMES: string[] = ICON_GROUPS.flatMap(g => g.icons);

/** Kept as its own export: the feature cards were shipped against this name. */
export const FEATURE_ICONS = ICON_NAMES;

// ============================================================ empty shapes

export const EMPTY_SITE: SiteSettings = {
    brand: { logo: { ...EMPTY_MEDIA }, fullName: '', tagline: '' },
    header: { navLinks: [], ctaLabel: '', ctaHref: '', background: '#ffffff', textColor: '#1c2e68' },
    footer: {
        addressLines: [], linkColumns: [], contactHeading: '', phones: [], email: '',
        socials: [], copyright: '', legalLinks: [], note: '',
    },
    extraFields: [],
    sections: [],
    acrossIndia: {
        enabled: true,
        eyebrow: 'Across India',
        heading: 'Find ACTIV where you are',
        subtitle: '',
        hidden: [],
    },
};

export const EMPTY_HOME: HomeContent = {
    carousel: {
        slides: [], headline: '', headlineHighlight: '', subheadline: '',
        ctaLabel: '', ctaHref: '', ctaIcon: 'heart',
        secondaryCtaLabel: '', secondaryCtaHref: '', secondaryCtaIcon: 'play',
        galleryPosters: { enabled: true, position: 'after' },
        highlightCard: { enabled: true, icon: 'users', eyebrow: '', value: '', caption: '', stats: [] },
    },
    about: {
        badgeIcon: 'users', badgeText: '', heading: '', headingHighlight: '', eyebrow: '',
        body: '', bullets: [], media: { ...EMPTY_MEDIA }, logoOverlay: { ...EMPTY_MEDIA },
        linkLabel: '', linkHref: '', statsBar: [], extraFields: [],
    },
    sections: [],
};

export const EMPTY_ABOUT: AboutContent = {
    badgeIcon: 'users', badgeText: '', heading: '', headingHighlight: '',
    body: '', bullets: [], bulletPoints: [],
    media: { ...EMPTY_MEDIA }, logoOverlay: { ...EMPTY_MEDIA }, statsBar: [],
    quote: { text: '', author: '', role: '', photo: { ...EMPTY_MEDIA } },
    extraFields: [],
    sections: [],
};

export const EMPTY_EVENTS_SETTINGS: EventsSettings = {
    badgeText: '', heading: '', headingHighlight: '', lede: '', subtitle: '',
    heroMedia: { ...EMPTY_MEDIA },
    heroBadge: { enabled: true, icon: 'calendar-days', title: '', subtitle: '' },
    stats: [],
    searchPlaceholder: 'Search events...',
    categories: [],
    viewAllLabel: '', viewAllHref: '/events',
    emptyText: '', emptyFilterText: '',
    banner: {
        enabled: true, icon: 'calendar-days', title: '',
        subtitle: '', ctaLabel: '', ctaHref: '',
    },
    pastLink: {
        enabled: true,
        icon: 'image',
        title: 'Looking for an event that has already happened?',
        subtitle: 'Every conclave, seminar and meeting we have held is in the gallery, with its photographs.',
        label: 'Open the gallery',
        href: '/gallery',
    },
    extraFields: [],
    sections: [],
};

export const EMPTY_GALLERY_SETTINGS: GallerySettings = {
    badgeIcon: 'image', badgeText: '', heading: '', headingHighlight: '', description: '',
    noteLines: [], categories: [], viewMoreLabel: '', pageSize: 8,
    pastEvents: {
        enabled: true,
        icon: 'calendar-days',
        title: 'Our past events',
        subtitle: 'Every conclave, seminar and meeting we have held — open one for its photographs, the write-up and where it was.',
    },
    emptyText: '', emptyFilterText: '',
    detail: {
        backLabel: 'Back to Gallery',
        aboutHeading: 'About this event',
        highlightsHeading: 'Highlights',
        photosHeading: 'More photographs',
        relatedHeading: 'More from the gallery',
        ctaLabel: '', ctaHref: '',
        missingText: 'This item is no longer available.',
    },
    extraFields: [],
    sections: [],
};

export const EMPTY_CONTACT: ContactInfo = {
    badgeIcon: 'users', badgeText: '', heading: '', headingHighlight: '', description: '',
    heroMedia: [],
    formCard: {
        icon: 'send', title: '', subtitle: '', submitLabel: '', successMessage: '',
        namePlaceholder: '', emailPlaceholder: '', phonePlaceholder: '',
        subjectPlaceholder: '', messagePlaceholder: '',
        validationMessage: '', failureMessage: '',
    },
    infoCard: {
        icon: 'users', title: '', subtitle: '',
        addressLabel: '', phoneLabel: '', emailLabel: '', hoursLabel: '',
    },
    addressLines: [], phone: '', alternatePhone: '', email: '', workingHours: [], mapEmbedUrl: '',
    social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
    banner: { enabled: true, icon: 'users', title: '', subtitle: '', ctaLabel: '', ctaHref: '' },
    regionsBand: { enabled: true, eyebrow: '', heading: '', subtitle: '' },
    extraFields: [],
    sections: [],
};

/** Anchor a stored `/uploads/...` path to the API origin we are talking to. */
export const withResolvedUrl = (m?: Partial<CmsMedia> | null): CmsMedia => ({
    ...EMPTY_MEDIA,
    ...(m || {}),
    url: resolveMediaUrl((m || {}).url),
});

// ============================================================ read cache

/**
 * Short-lived cache with in-flight de-duplication, shared by every public read.
 *
 * Two components legitimately want the same document on one page load: the
 * header and the footer both render branding from `/cms/site`, and the banner
 * and the About block both come from `/cms/home`. Without this each mounts and
 * fires its own request, so a visitor loading the landing page fetches the same
 * two documents twice.
 *
 * Deduplicating in the service rather than lifting the data into a provider
 * keeps each component able to say what it needs. A provider would couple every
 * public page to a context that exists for two of them.
 *
 * The TTL is short on purpose. This is a CMS: an admin saves a change and
 * immediately reloads the public page to check it. Sixty seconds of staleness
 * would read as "my edit did not save". Five seconds collapses the duplicate
 * mounts of a single page load and little else — and `invalidateCmsCache()`
 * clears it outright the moment anything is written.
 *
 * Past the TTL an entry goes *stale*, not absent: it is still served, and a
 * refresh is started behind it. That distinction is what the header and footer
 * need. They remount on every navigation, and re-fetching from nothing meant
 * the nav bar and the footer emptied and re-populated each time a visitor moved
 * between the public pages — a visible flash on a document that had not changed
 * and was already in memory. Serving stale means the chrome holds still and the
 * new copy lands a moment later if there is one.
 */
const CACHE_TTL_MS = 5_000;

const cache = new Map<string, { at: number; value: any }>();
const inFlight = new Map<string, Promise<any>>();

/** Fetch, store, and clear the in-flight marker whichever way it ends. */
const refresh = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const pending = inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const request = (async () => {
        try {
            const value = await load();
            cache.set(key, { at: Date.now(), value });
            return value;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, request);
    return request;
};

/**
 * Fresh from cache, stale from cache while revalidating, or fetched.
 *
 * A rejected request is never cached — the next caller retries rather than
 * inheriting a failure for the rest of the TTL. A background revalidation that
 * fails is swallowed for the same reason: the caller already has a usable
 * answer, and an unhandled rejection would surface in the console as an error
 * on a page that rendered perfectly well.
 *
 * EXPORTED so `cmsRegionsApi` can use it too. The region and state pages were
 * the only public reads outside this module and the only ones NOT going through
 * here, which is why moving between them showed a full skeleton every time — the
 * header's region menu and the page's own document were re-fetched from nothing
 * on each navigation, including a return to a page the reader had just left.
 */
/*
 * ONLY THE CHROME IS SERVED STALE.
 *
 * Serving a stale copy while refreshing behind it is right for the header,
 * footer and menus: they remount on every navigation, rarely change, and a
 * re-fetch from nothing made them flash. It is WRONG for content. A section
 * reads once, on mount, so a stale copy is the copy it keeps — the refresh
 * lands in the cache and nothing re-reads it. That is how an event switched
 * OFF in the CMS stayed in the home banner: the page was handed the list from
 * before the switch and never asked again.
 *
 * So content waits for the network once its five seconds are up, and the
 * header, footer and menus keep the no-flash behaviour.
 */
const SERVE_STALE = new Set(['site', 'legal:links', 'regions:map', 'schemes:states']);

export const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);

    if (hit) {
        if (Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
        if (SERVE_STALE.has(key)) {
            // Stale chrome: hand back what we have and bring it up to date behind the render.
            refresh(key, load).catch(() => { /* keep serving the stale copy */ });
            return hit.value as T;
        }
    }

    return refresh(key, load);
};

/**
 * Drop cached content.
 *
 * Called after every write below, so the editor reloading a page sees what it
 * just saved rather than the copy from a moment earlier. Pass a key to clear
 * one document; pass nothing to clear all of them — a home-page save changes
 * what `/cms/home` returns and nothing else, but a site save changes the header
 * and footer on every page.
 */
export const invalidateCmsCache = (key?: string) => {
    if (key) cache.delete(key);
    else cache.clear();
    // Every other open tab of the site drops its copy too — see below.
    try { cmsChannel?.postMessage({ key: key || '' }); } catch { /* channel closed */ }
};

/*
 * ACROSS TABS. The CMS and the public site are usually open side by side, and
 * each tab has its own memory: a save in the CMS tab cleared the CMS tab's
 * cache and left the public tab holding the old copy. A BroadcastChannel tells
 * every tab of this origin to drop it as well. Absent in very old browsers,
 * where the five-second TTL is the fallback.
 */
const cmsChannel: BroadcastChannel | null = (() => {
    try {
        if (typeof BroadcastChannel === 'undefined') return null;
        const channel = new BroadcastChannel('activ-cms-cache');
        channel.onmessage = (e: MessageEvent) => {
            const key = String((e?.data && e.data.key) || '');
            if (key) cache.delete(key);
            else cache.clear();
        };
        return channel;
    } catch {
        return null;
    }
})();

/*
 * DROPPED ON EVERY SESSION CHANGE, like the request cache it sits beside.
 *
 * Left out, a list fetched before signing in was still served after it: the
 * super admin logged out and back in and their Events screen showed the
 * public copy from before, missing every event the public cannot see — which
 * read as the event they had just created having been deleted.
 */
registerCacheClearer(() => {
    cache.clear();
    inFlight.clear();
});

// ============================================================ public reads

const getSiteSettingsUncached = async (): Promise<SiteSettings> => {
    try {
        const data = unwrap<any>(await api.get('/cms/site'), EMPTY_SITE);
        return {
            brand: {
                ...EMPTY_SITE.brand,
                ...(data.brand || {}),
                logo: withResolvedUrl((data.brand || {}).logo),
            },
            header: { ...EMPTY_SITE.header, ...(data.header || {}) },
            footer: { ...EMPTY_SITE.footer, ...(data.footer || {}) },
            extraFields: data.extraFields || [],
            sections: data.sections || [],
            acrossIndia: {
                ...EMPTY_SITE.acrossIndia,
                ...(data.acrossIndia || {}),
                hidden: (data.acrossIndia || {}).hidden || [],
            },
        };
    } catch {
        return EMPTY_SITE;
    }
};

/** Cached; see `cached()` above. */
export const getSiteSettings = () => cached('site', getSiteSettingsUncached);

const getHomeUncached = async (): Promise<HomeContent> => {
    try {
        const data = unwrap<any>(await api.get('/cms/home'), EMPTY_HOME);
        const carousel = data.carousel || {};
        const about = data.about || {};

        return {
            carousel: {
                ...EMPTY_HOME.carousel,
                ...carousel,
                slides: (carousel.slides || []).map((slide: any) => ({
                    media: withResolvedUrl(slide.media),
                    caption: slide.caption || '',
                    headline: slide.headline || '',
                    headlineHighlight: slide.headlineHighlight || '',
                    subheadline: slide.subheadline || '',
                    align: slide.align === 'right' ? 'right' : 'left',
                })),
                galleryPosters: {
                    ...EMPTY_HOME.carousel.galleryPosters,
                    ...(carousel.galleryPosters || {}),
                },
                highlightCard: {
                    ...EMPTY_HOME.carousel.highlightCard,
                    ...(carousel.highlightCard || {}),
                    stats: (carousel.highlightCard || {}).stats || [],
                },
            },
            about: {
                ...EMPTY_HOME.about,
                ...about,
                media: withResolvedUrl(about.media),
                logoOverlay: withResolvedUrl(about.logoOverlay),
                bullets: about.bullets || [],
                statsBar: about.statsBar || [],
            },
            sections: data.sections || [],
        };
    } catch {
        // Marked, so a caller can tell “could not ask” from “nothing to say”.
        return { ...EMPTY_HOME, failed: true };
    }
};

/** Cached; see `cached()` above. */
export const getHome = () => cached('home', getHomeUncached);

const getAboutUncached = async (): Promise<AboutContent> => {
    try {
        const data = unwrap<any>(await api.get('/cms/about'), EMPTY_ABOUT);
        return {
            ...EMPTY_ABOUT,
            ...data,
            media: withResolvedUrl(data.media),
            logoOverlay: withResolvedUrl(data.logoOverlay),
            bullets: data.bullets || [],
            statsBar: data.statsBar || [],
        };
    } catch {
        return EMPTY_ABOUT;
    }
};

/** Cached; see `cached()` above. */
export const getAbout = () => cached('about', getAboutUncached);

const getEventsSettingsUncached = async (): Promise<EventsSettings> => {
    try {
        const data = unwrap<any>(await api.get('/cms/events-settings'), EMPTY_EVENTS_SETTINGS);
        return {
            ...EMPTY_EVENTS_SETTINGS,
            ...data,
            // A level deeper than the spread reaches: a document saved
            // before this block existed carries none of it.
            pastLink: { ...EMPTY_EVENTS_SETTINGS.pastLink, ...(data.pastLink || {}) },
        };
    } catch {
        return EMPTY_EVENTS_SETTINGS;
    }
};

/** Cached; see `cached()` above. */
export const getEventsSettings = () => cached('events-settings', getEventsSettingsUncached);

const getGallerySettingsUncached = async (): Promise<GallerySettings> => {
    try {
        const data = unwrap<any>(await api.get('/cms/gallery-settings'), EMPTY_GALLERY_SETTINGS);
        return {
            ...EMPTY_GALLERY_SETTINGS,
            ...data,
            categories: data.categories || [],
            // Merged a level deeper than the spread above reaches: a document
            // saved before this block existed carries none of it, and the poster
            // page would otherwise get `undefined`.
            detail: { ...EMPTY_GALLERY_SETTINGS.detail, ...(data.detail || {}) },
            pastEvents: { ...EMPTY_GALLERY_SETTINGS.pastEvents, ...(data.pastEvents || {}) },
        };
    } catch {
        return EMPTY_GALLERY_SETTINGS;
    }
};

/** Cached; see `cached()` above. */
export const getGallerySettings = () => cached('gallery-settings', getGallerySettingsUncached);

/** Every stored URL on an item — the poster and each extra photograph. */
const resolveItemMedia = (g: GalleryItem): GalleryItem => ({
    ...g,
    media: withResolvedUrl(g.media),
    // Absent on the landing strip's payload, which projects them away — and an
    // empty `photos: []` written over a list is not the same as leaving it out.
    ...(g.photos ? { photos: g.photos.map(withResolvedUrl) } : {}),
});

const getGalleryUncached = async (includeHidden = false): Promise<GalleryItem[]> => {
    try {
        const data = unwrap<GalleryItem[]>(
            await api.get('/cms/gallery', { params: includeHidden ? { includeHidden: 'true' } : {} }),
            [],
        );
        return (data || []).map(resolveItemMedia);
    } catch {
        return [];
    }
};

/**
 * Cached per visibility scope.
 *
 * The admin grid asks for hidden images and the public grid must not get
 * them, so the two answers cannot share a cache entry.
 */
export const getGallery = (includeHidden = false) =>
    cached(includeHidden ? 'gallery:all' : 'gallery', () => getGalleryUncached(includeHidden));

const getHomeGalleryUncached = async (): Promise<GalleryItem[]> => {
    try {
        /*
         * NO `limit`. The switch on the image is the whole control.
         *
         * This asked for twelve. `CarouselSection` had its OWN cap of six and
         * that one was removed — "the per-image switch says which images
         * belong in the banner, and a number on another card quietly
         * overruling it meant an editor who turned nine on got six" — but the
         * cap in the REQUEST survived the same argument, one layer down, where
         * nothing on any screen mentions it.
         *
         * So the Home Page card counted the rows it had switched on and told
         * the editor "18 of 75 images are switched on. All 18 ride the
         * banner", and thirteen through eighteen never left the server. The
         * card was not lying about its own field; it could not see that
         * something else had trimmed the answer.
         *
         * The payload is still defended, by the SERVER, and better: `homeOnly`
         * projects away the write-up, the bullets and the extra photographs,
         * so a banner row is a title, a date and one image URL. Weight was the
         * reason for the cap and the projection is the answer to it.
         */
        const data = unwrap<GalleryItem[]>(
            await api.get('/cms/gallery', { params: { home: 'true' } }),
            [],
        );
        return (data || []).map(resolveItemMedia);
    } catch {
        return [];
    }
};

/**
 * The landing page's strip: what an editor flagged for the home page, newest
 * first, and nothing else.
 *
 * Its own request rather than a slice of `getGallery()`. The landing page is
 * the one page on the site whose payload is worth defending, and this answer
 * is the switched-on rows WITHOUT their write-ups or extra photographs — see
 * `listGallery`'s projection, which is what defends the weight now that the
 * count is the editor's to decide.
 */
export const getHomeGallery = () => cached('gallery:home', getHomeGalleryUncached);

/**
 * One item, for its own page.
 *
 * Throws where the list readers swallow: a poster page that cannot load its
 * poster has nothing to render, and telling the visitor the link is dead is
 * better than an empty page that looks broken.
 */
export const getGalleryItem = async (id: string): Promise<GalleryItem> => {
    const data = unwrap<GalleryItem | null>(await api.get(`/cms/gallery/${id}`), null);
    if (!data || !data._id) throw new Error('Gallery item not found');
    return resolveItemMedia(data);
};

const getContactInfoUncached = async (): Promise<ContactInfo> => {
    try {
        const data = unwrap<any>(await api.get('/cms/contact-info'), EMPTY_CONTACT);
        return {
            ...EMPTY_CONTACT,
            ...data,
            heroMedia: (data.heroMedia || []).map(withResolvedUrl),
            formCard: { ...EMPTY_CONTACT.formCard, ...(data.formCard || {}) },
            infoCard: { ...EMPTY_CONTACT.infoCard, ...(data.infoCard || {}) },
            social: { ...EMPTY_CONTACT.social, ...(data.social || {}) },
            banner: { ...EMPTY_CONTACT.banner, ...(data.banner || {}) },
            regionsBand: { ...EMPTY_CONTACT.regionsBand, ...(data.regionsBand || {}) },
        };
    } catch {
        return EMPTY_CONTACT;
    }
};

/** Cached; see `cached()` above. */
export const getContactInfo = () => cached('contact-info', getContactInfoUncached);

const resolveEvents = (data: CmsEvent[] | null): CmsEvent[] =>
    (data || []).map((e) => ({
        ...e,
        imageUrl: resolveMediaUrl(e.imageUrl),
        media: withResolvedUrl(e.media),
    }));

/*
 * `scope=public` — WHAT A VISITOR SEES, even when an admin is signed in.
 *
 * Without it the server answered a signed-in super admin with the editor's
 * list, so the home page showed them drafts and members-only events, and the
 * one cached copy was then whichever list happened to be fetched first.
 */
const getCmsEventsUncached = async (): Promise<CmsEvent[]> => {
    try {
        return resolveEvents(unwrap<CmsEvent[]>(
            await api.get('/cms/events', { params: { scope: 'public' } }), [],
        ));
    } catch {
        return [];
    }
};

/** The public list. Cached; see `cached()` above. */
export const getCmsEvents = () => cached('events', getCmsEventsUncached);

/**
 * EVERY event, for the editor screens: drafts, members-only, targeted.
 *
 * NOT cached, and it THROWS. The editor has just written something and must
 * see the server's answer, and a failed load has to say so — the public
 * reader's swallow-to-`[]` here would present a network blip as "you have no
 * events", which is exactly how a real event reads as deleted.
 */
export const getCmsEventsForEditor = async (): Promise<CmsEvent[]> =>
    resolveEvents(unwrap<CmsEvent[]>(await api.get('/cms/events'), []));

/**
 * One event, for its own page.
 *
 * Throws where the list readers swallow: an event page that cannot load its
 * event has nothing to render, and telling the visitor the link is dead beats
 * an empty page that looks broken.
 */
export const getCmsEvent = async (id: string): Promise<CmsEvent> => {
    const data = unwrap<CmsEvent | null>(await api.get(`/cms/events/${id}`), null);
    if (!data || !data.id) throw new Error('Event not found');
    return { ...data, imageUrl: resolveMediaUrl(data.imageUrl), media: withResolvedUrl(data.media) };
};

/**
 * Submit the public contact form.
 *
 * This one DOES throw: the visitor is waiting on it, and silently swallowing a
 * failure would tell them their message was sent when it was not.
 */
export const sendContactMessage = async (payload: {
    name: string; email: string; phone?: string; subject?: string; message: string;
}): Promise<{ id: string; receivedAt: string }> => {
    const res = await api.post('/cms/contact-messages', payload);
    return unwrap(res, { id: '', receivedAt: '' });
};

// ============================================================ admin writes

export const getCmsOverview = async () => unwrap<any>(await api.get('/cms/overview'), {});

/**
 * Save one or more blocks.
 *
 * Partial by design throughout: the editor saves the block being worked on and
 * the server leaves the others alone. Sending the whole page on every save would
 * let a stale copy of the carousel overwrite an edit made seconds earlier.
 */
export const updateSiteSettings = async (payload: Partial<SiteSettings>) => {
    const saved = unwrap<SiteSettings>(await api.put('/cms/site', payload), EMPTY_SITE);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache();
    return saved;
};

export const updateHome = async (payload: Partial<HomeContent>) => {
    const saved = unwrap<HomeContent>(await api.put('/cms/home', payload), EMPTY_HOME);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache('home');
    return saved;
};

export const updateAbout = async (payload: Partial<AboutContent>) => {
    const saved = unwrap<AboutContent>(await api.put('/cms/about', payload), EMPTY_ABOUT);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache('about');
    return saved;
};

export const updateEventsSettings = async (payload: Partial<EventsSettings>) => {
    const saved = unwrap<EventsSettings>(await api.put('/cms/events-settings', payload), EMPTY_EVENTS_SETTINGS);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache('events-settings');
    return saved;
};

export const updateGallerySettings = async (payload: Partial<GallerySettings>) => {
    const saved = unwrap<GallerySettings>(await api.put('/cms/gallery-settings', payload), EMPTY_GALLERY_SETTINGS);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache('gallery-settings');
    return saved;
};

export const updateContactInfo = async (payload: Partial<ContactInfo>) => {
    const saved = unwrap<ContactInfo>(await api.put('/cms/contact-info', payload), EMPTY_CONTACT);
    // The editor reloads the public page to check the change; a stale
    // read here would look like the save silently failed.
    invalidateCmsCache('contact-info');
    return saved;
};

/**
 * Upload one image or video, returning its stored URL.
 *
 * Separate from saving content so the editor can preview the real file before
 * committing — otherwise a wrong image is only discovered once it is live.
 */
export const uploadMedia = async (file: File): Promise<{ url: string; type: 'image' | 'video' }> => {
    const form = new FormData();
    form.append('file', file);
    const data = unwrap<any>(await api.post('/cms/media', form), { url: '', type: 'image' });
    return { url: data.url || '', type: data.type === 'video' ? 'video' : 'image' };
};

/**
 * Drop every cached view of the gallery.
 *
 * Three of them now: the public grid, the admin grid including hidden images,
 * and the landing page's strip. They are separate entries because they are
 * separate answers, which means a save that cleared only the first left an
 * edited poster showing its old title on the home page.
 */
const invalidateGallery = () => {
    invalidateCmsCache('gallery');
    invalidateCmsCache('gallery:all');
    invalidateCmsCache('gallery:home');
};

/** `image` is a file upload; the server prefers it over a pasted `imageUrl`. */
const withImage = (fields: Record<string, any>, image?: File | null) => {
    if (!image) return fields;
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    form.append('image', image);
    return form;
};

export const addGalleryItem = async (fields: Record<string, any>, image?: File | null) => {
    const result = unwrap<GalleryItem>(await api.post('/cms/gallery', withImage(fields, image)), null as any);
    invalidateGallery();
    return result;
};

export const updateGalleryItem = async (id: string, fields: Record<string, any>, image?: File | null) => {
    const result = unwrap<GalleryItem>(await api.put(`/cms/gallery/${id}`, withImage(fields, image)), null as any);
    invalidateGallery();
    return result;
};

export const deleteGalleryItem = async (id: string) => {
    const result = unwrap<any>(await api.delete(`/cms/gallery/${id}`), null);
    invalidateGallery();
    return result;
};

export const createCmsEvent = async (fields: Record<string, any>, image?: File | null) => {
    const result = unwrap<any>(await api.post('/cms/events', withImage(fields, image)), null);
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('events');
    return result;
};

export const updateCmsEvent = async (id: string, fields: Record<string, any>, image?: File | null) => {
    const result = unwrap<any>(await api.put(`/cms/events/${id}`, withImage(fields, image)), null);
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('events');
    return result;
};

export const deleteCmsEvent = async (id: string) => {
    const result = unwrap<any>(await api.delete(`/cms/events/${id}`), null);
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('events');
    return result;
};

export const listContactMessages = async (params: { status?: string; page?: number; limit?: number } = {}) =>
    unwrap<{ messages: ContactMessage[]; unread: number; pagination: any }>(
        await api.get('/cms/contact-messages', { params }),
        { messages: [], unread: 0, pagination: {} },
    );

export const setMessageStatus = async (id: string, status: 'new' | 'read' | 'archived') =>
    unwrap<ContactMessage>(await api.patch(`/cms/contact-messages/${id}/status`, { status }), null as any);

export const deleteContactMessage = async (id: string) =>
    unwrap<any>(await api.delete(`/cms/contact-messages/${id}`), null);

export { errorMessage };

/**
 * How many members a piece of targeting would actually reach.
 *
 * Super admin only. Called by `RegionTargetPicker` on every change to the
 * region list or the members-only switch, because what an editor is choosing is
 * the INTERSECTION of those two and neither control shows it — an event aimed
 * at one block and marked members-only, in a block whose only member had not
 * paid, reached nobody while every screen called it published.
 *
 * `targets` goes over the wire as JSON in a query parameter: it is a read, and
 * a GET keeps it cacheable and de-duplicated like every other read here.
 */
export const getEventReach = async (
    targets: { state: string; district: string; block: string }[],
    audience: 'all' | 'paid' = 'all',
) =>
    unwrap<{ members: number; excludedByAudience: number }>(
        await api.get('/events/reach', {
            params: { targets: JSON.stringify(targets || []), audience },
        }),
        { members: 0, excludedByAudience: 0 },
    );

// ============================================================ legal documents

/**
 * The association's legal notices — Privacy, Terms, Return, Cancellation.
 *
 * =========================================================================
 * THE TEXT LIVES IN THE DATABASE. THIS FILE HAS NO COPY OF IT.
 * =========================================================================
 *
 * It used to be compiled into the bundle, which made every wording change a
 * deploy and left the browser holding a policy that could disagree with the one
 * the server believed was live. Everything below reads `/cms/legal`, so a Super
 * Admin's edit is on the public site at the next page load.
 *
 * There is deliberately NO fallback table here. Every other CMS read in this
 * file falls back to an empty shape, which renders an unfinished page — right
 * for a hero with no headline yet. A legal notice is different: a Privacy
 * Policy page showing invented or stale wording is worse than one that says it
 * could not be loaded, because a visitor cannot tell the difference and may act
 * on it. `getLegalDocument` throws and the page renders its own error state.
 */

export interface LegalSection {
    /** Absent for an opening run of paragraphs that belongs under no heading. */
    heading: string;
    /** Paragraphs, in order. */
    body: string[];
    bullets: string[];
    links: { label: string; href: string }[];
}

export interface LegalDocument {
    /** The URL, and the identity: `privacy-policy` serves `/privacy-policy`. */
    slug: string;
    title: string;
    lede: string;
    /** What the footer calls it. The server already falls back to the title. */
    footerLabel: string;
    sections: LegalSection[];
    /**
     * Fields the editor named themselves, printed as labelled rows.
     *
     * Optional because rows written before the field existed do not carry
     * it, and every reader has to cope with that rather than assume an
     * array is there.
     */
    extraFields?: CmsExtraField[];
    status: 'published' | 'draft';
    order: number;
    /**
     * When this WORDING took effect — the editor's answer, not `updatedAt`.
     * `null` when they have not given one, which renders as nothing rather than
     * as a date the page invented.
     */
    effectiveFrom: string | null;
    /** Counts up on every save. `1` is the text as first supplied. */
    version: number;
    updatedAt: string | null;
    editedBy?: { email: string; at: string } | null;
}

/** One row of a document's history. Headings and sizes, not the whole text. */
export interface LegalRevision {
    slug: string;
    version: number;
    title: string;
    status: string;
    effectiveFrom: string | null;
    savedBy: string;
    savedAt: string | null;
    note: string;
    sectionCount: number;
    wordCount: number;
}

/**
 * Every published document, in footer order.
 *
 * A signed-in editor also gets their own drafts — the server decides that from
 * the token, so there is no flag here to get wrong.
 */
export const getLegalDocuments = async (): Promise<LegalDocument[]> =>
    cached('legal', async () => unwrap<LegalDocument[]>(await api.get('/cms/legal'), []));

/**
 * Label and href only — what the footer draws on every page.
 *
 * Its own endpoint rather than mapping `getLegalDocuments`, because the footer
 * is on every page and does not need several thousand words of Terms to draw
 * four links. Falls back to an empty list: a footer missing its legal row is a
 * smaller failure than a footer that fails to render.
 */
export const getLegalLinks = async (): Promise<{ label: string; href: string }[]> =>
    cached('legal:links', async () =>
        unwrap<{ label: string; href: string }[]>(await api.get('/cms/legal/links'), []));

/**
 * One document, in full.
 *
 * NOT cached through `cached()`: that helper serves a stale copy while it
 * refreshes, which is right for a hero image and wrong for the text of an
 * agreement. It is also the one read here that must be allowed to THROW — see
 * the note at the top of this section.
 */
export const getLegalDocument = async (slug: string): Promise<LegalDocument> => {
    const res = await api.get(`/cms/legal/${encodeURIComponent(slug)}`);
    const doc = unwrap<LegalDocument | null>(res, null);
    if (!doc || !doc.slug) throw new Error('Policy not found');
    return doc;
};

/** Create or replace a policy. Archives the previous wording server-side. */
export const saveLegalDocument = async (slug: string, payload: Partial<LegalDocument> & {
    /** The editor's note about what changed. Stored on the archived revision. */
    changeNote?: string;
}): Promise<LegalDocument> => {
    const saved = unwrap<LegalDocument>(
        await api.put(`/cms/legal/${encodeURIComponent(slug)}`, payload),
        {} as LegalDocument,
    );
    // Both keys: the document list AND the footer's link list, which carries
    // the label and would otherwise keep showing the old one for five seconds
    // on every page of the site.
    invalidateCmsCache('legal');
    invalidateCmsCache('legal:links');
    return saved;
};

/** A document's history, newest first. */
export const getLegalRevisions = async (slug: string): Promise<LegalRevision[]> =>
    unwrap<LegalRevision[]>(await api.get(`/cms/legal/${encodeURIComponent(slug)}/revisions`), []);

/** One revision in full, for reading before restoring it. */
export const getLegalRevision = async (slug: string, version: number): Promise<LegalDocument> =>
    unwrap<LegalDocument>(
        await api.get(`/cms/legal/${encodeURIComponent(slug)}/revisions/${version}`),
        {} as LegalDocument,
    );

/**
 * Put an earlier wording back.
 *
 * A save, not a rewind: the version number goes UP and the text being replaced
 * is archived in its turn, so the history stays a sequence.
 */
export const restoreLegalRevision = async (slug: string, version: number): Promise<LegalDocument> => {
    const saved = unwrap<LegalDocument>(
        await api.post(`/cms/legal/${encodeURIComponent(slug)}/revisions/${version}/restore`),
        {} as LegalDocument,
    );
    invalidateCmsCache('legal');
    invalidateCmsCache('legal:links');
    return saved;
};

/** Take a policy off the site. Unpublishes; never deletes. */
export const retireLegalDocument = async (slug: string): Promise<LegalDocument> => {
    const saved = unwrap<LegalDocument>(
        await api.delete(`/cms/legal/${encodeURIComponent(slug)}`),
        {} as LegalDocument,
    );
    invalidateCmsCache('legal');
    invalidateCmsCache('legal:links');
    return saved;
};
