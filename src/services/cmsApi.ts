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
import api, { unwrap, errorMessage } from './api';
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
}

// ---------------------------------------------------------------- home

export interface HeroSlide {
    media: CmsMedia;
    caption: string;
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
}

// ---------------------------------------------------------------- events page

export interface EventsSettings {
    badgeText: string;
    heading: string;
    subtitle: string;
    viewAllLabel: string;
    viewAllHref: string;
    emptyText: string;
    homeLimit: number;
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
    emptyText: string;
    /** `{category}` is replaced with the chip the visitor picked. */
    emptyFilterText: string;
}

export interface GalleryItem {
    _id: string;
    media: CmsMedia;
    title: string;
    caption: string;
    category: string;
    eventDate: string;
    location: string;
    featured: boolean;
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
}

export interface CmsEvent {
    id: string;
    title: string;
    description: string;
    startAt: string | null;
    endAt: string | null;
    location: string;
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
    /** `paid` restricts the event to members with an active membership. */
    audience?: 'all' | 'paid';
    agenda?: CmsAgendaItem[];
    speakers?: CmsSpeaker[];
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
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
    { label: 'People', icons: ['users', 'user', 'handshake', 'heart-handshake', 'building', 'briefcase'] },
    { label: 'Growth', icons: ['trending-up', 'award', 'target', 'lightbulb', 'star', 'heart', 'rocket'] },
    { label: 'Trust', icons: ['shield', 'shield-check', 'scale'] },
    { label: 'Place & time', icons: ['globe', 'map-pin', 'calendar', 'calendar-days', 'clock'] },
    { label: 'Events & media', icons: ['image', 'images', 'monitor-play', 'play', 'tent', 'book-open', 'hard-hat', 'grid', 'party-popper', 'mic'] },
    { label: 'Contact', icons: ['phone', 'mail', 'message-square', 'send', 'file-text'] },
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
};

export const EMPTY_HOME: HomeContent = {
    carousel: {
        slides: [], headline: '', headlineHighlight: '', subheadline: '',
        ctaLabel: '', ctaHref: '', ctaIcon: 'heart',
        secondaryCtaLabel: '', secondaryCtaHref: '', secondaryCtaIcon: 'play',
        highlightCard: { enabled: true, icon: 'users', eyebrow: '', value: '', caption: '', stats: [] },
    },
    about: {
        badgeIcon: 'users', badgeText: '', heading: '', headingHighlight: '', eyebrow: '',
        body: '', bullets: [], media: { ...EMPTY_MEDIA }, logoOverlay: { ...EMPTY_MEDIA },
        linkLabel: '', linkHref: '', statsBar: [],
    },
};

export const EMPTY_ABOUT: AboutContent = {
    badgeIcon: 'users', badgeText: '', heading: '', headingHighlight: '',
    body: '', bullets: [], bulletPoints: [],
    media: { ...EMPTY_MEDIA }, logoOverlay: { ...EMPTY_MEDIA }, statsBar: [],
};

export const EMPTY_EVENTS_SETTINGS: EventsSettings = {
    badgeText: '', heading: '', subtitle: '',
    viewAllLabel: '', viewAllHref: '/events', emptyText: '', homeLimit: 3,
};

export const EMPTY_GALLERY_SETTINGS: GallerySettings = {
    badgeIcon: 'image', badgeText: '', heading: '', headingHighlight: '', description: '',
    noteLines: [], categories: [], viewMoreLabel: '', pageSize: 8,
    emptyText: '', emptyFilterText: '',
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
 */
const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);

    if (hit) {
        if (Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;
        // Stale: hand back what we have and bring it up to date behind the render.
        refresh(key, load).catch(() => { /* keep serving the stale copy */ });
        return hit.value as T;
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
};

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
                })),
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
        };
    } catch {
        return EMPTY_HOME;
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
        return { ...EMPTY_EVENTS_SETTINGS, ...data };
    } catch {
        return EMPTY_EVENTS_SETTINGS;
    }
};

/** Cached; see `cached()` above. */
export const getEventsSettings = () => cached('events-settings', getEventsSettingsUncached);

const getGallerySettingsUncached = async (): Promise<GallerySettings> => {
    try {
        const data = unwrap<any>(await api.get('/cms/gallery-settings'), EMPTY_GALLERY_SETTINGS);
        return { ...EMPTY_GALLERY_SETTINGS, ...data, categories: data.categories || [] };
    } catch {
        return EMPTY_GALLERY_SETTINGS;
    }
};

/** Cached; see `cached()` above. */
export const getGallerySettings = () => cached('gallery-settings', getGallerySettingsUncached);

const getGalleryUncached = async (includeHidden = false): Promise<GalleryItem[]> => {
    try {
        const data = unwrap<GalleryItem[]>(
            await api.get('/cms/gallery', { params: includeHidden ? { includeHidden: 'true' } : {} }),
            [],
        );
        return (data || []).map((g: any) => ({ ...g, media: withResolvedUrl(g.media) }));
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
        };
    } catch {
        return EMPTY_CONTACT;
    }
};

/** Cached; see `cached()` above. */
export const getContactInfo = () => cached('contact-info', getContactInfoUncached);

const getCmsEventsUncached = async (): Promise<CmsEvent[]> => {
    try {
        const data = unwrap<CmsEvent[]>(await api.get('/cms/events'), []);
        return (data || []).map((e) => ({
            ...e,
            imageUrl: resolveMediaUrl(e.imageUrl),
            media: withResolvedUrl(e.media),
        }));
    } catch {
        return [];
    }
};

/** Cached; see `cached()` above. */
export const getCmsEvents = () => cached('events', getCmsEventsUncached);

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
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('gallery'); invalidateCmsCache('gallery:all');
    return result;
};

export const updateGalleryItem = async (id: string, fields: Record<string, any>, image?: File | null) => {
    const result = unwrap<GalleryItem>(await api.put(`/cms/gallery/${id}`, withImage(fields, image)), null as any);
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('gallery'); invalidateCmsCache('gallery:all');
    return result;
};

export const deleteGalleryItem = async (id: string) => {
    const result = unwrap<any>(await api.delete(`/cms/gallery/${id}`), null);
    // Both gallery scopes, or the events list, now answer differently.
    invalidateCmsCache('gallery'); invalidateCmsCache('gallery:all');
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
