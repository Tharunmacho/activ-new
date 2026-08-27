/**
 * The paid member area's own API surface.
 *
 * Association Updates (MEM-001), event detail and registration (EVT-001/002),
 * the member directory (DIR-001) and the business suite's catalogue, stock and
 * analytics (BUS-001…004).
 *
 * A module of its own rather than another six hundred lines on the end of
 * `activApi.ts`, which is already the registration, application, admin and CMS
 * client in one file. Everything here shares one audience — a signed-in member
 * looking at the association — and one rule: what comes back is what the member
 * is allowed to see, decided on the server. Nothing in this file filters for
 * permission, because a filter written on the client is a suggestion.
 *
 * All HTTP goes through the shared axios instance in `./api`, which carries the
 * token, the timeout and the GET de-duplication.
 */
import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';

// ============================================================ shared shapes

/** Who a piece of content is for. `paid` needs an active membership. */
export type Audience = 'all' | 'paid';

export type PublishStatus = 'draft' | 'published';

// ============================================================ MEM-001 updates

export type AnnouncementCategory =
    | 'general' | 'notice' | 'policy' | 'scheme' | 'achievement' | 'urgent';

export interface Announcement {
    id: string;
    title: string;
    summary: string;
    body: string;
    category: AnnouncementCategory;
    state: string;
    district: string;
    block: string;
    /** "Tamil Nadu › Ariyalur", or empty when it went to every member. */
    targetLabel: string;
    audience: Audience;
    bannerUrl: string;
    bannerAlt: string;
    attachmentUrl: string;
    attachmentLabel: string;
    pinned: boolean;
    status: PublishStatus;
    publishedAt: string | null;
    expiresAt: string | null;
    createdBy: string;
}

const EMPTY_FEED = { announcements: [] as Announcement[], total: 0 };

/**
 * This member's update feed.
 *
 * Already filtered to their state, district and block, and to the audiences
 * they belong to — the server does the targeting, because the client does not
 * know the member's region any more reliably than the token does (it often is
 * not in the token at all: see `memberContext.js`).
 */
export const listAnnouncements = async (params: Record<string, any> = {}) =>
    unwrap<typeof EMPTY_FEED>(await api.get(ENDPOINTS.ANNOUNCEMENTS.LIST, { params }), EMPTY_FEED);

export const getAnnouncement = async (id: string) =>
    unwrap<Announcement | null>(await api.get(ENDPOINTS.ANNOUNCEMENTS.BY_ID(id)), null);

// --- super admin

export const listAllAnnouncements = async (params: Record<string, any> = {}) =>
    unwrap<typeof EMPTY_FEED>(await api.get(ENDPOINTS.ANNOUNCEMENTS.ADMIN_LIST, { params }), EMPTY_FEED);

/**
 * Create or update an update.
 *
 * Sent as `multipart/form-data` whenever there is a banner, which means every
 * field arrives at the server as a string — `pinned` included. The server's
 * `sanitize` accepts `'true'` as well as `true` for exactly this reason.
 */
const announcementForm = (fields: Record<string, any>, banner?: File | null) => {
    if (!banner) return fields;

    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) form.append(key, String(value));
    });
    form.append('banner', banner);
    return form;
};

export const createAnnouncement = async (fields: Record<string, any>, banner?: File | null) =>
    unwrap<Announcement | null>(
        await api.post(ENDPOINTS.ANNOUNCEMENTS.LIST, announcementForm(fields, banner)), null);

export const updateAnnouncement = async (id: string, fields: Record<string, any>, banner?: File | null) =>
    unwrap<Announcement | null>(
        await api.put(ENDPOINTS.ANNOUNCEMENTS.BY_ID(id), announcementForm(fields, banner)), null);

export const setAnnouncementStatus = async (id: string, status: PublishStatus) =>
    unwrap<Announcement | null>(await api.patch(ENDPOINTS.ANNOUNCEMENTS.STATUS(id), { status }), null);

export const deleteAnnouncement = async (id: string) =>
    unwrap<any>(await api.delete(ENDPOINTS.ANNOUNCEMENTS.BY_ID(id)), null);

// ============================================================ EVT-001 events

export interface AgendaItem {
    id: string;
    startTime: string;
    endTime: string;
    title: string;
    description: string;
    speaker: string;
    location: string;
}

export interface EventSpeaker {
    id: string;
    name: string;
    role: string;
    organization: string;
    bio: string;
    photoUrl: string;
}

export type RegistrationStatus = 'registered' | 'waitlist' | 'cancelled';

export interface EventRegistration {
    id: string;
    eventId: string;
    userId: string;
    memberName: string;
    email: string;
    phone: string;
    organization: string;
    state: string;
    district: string;
    block: string;
    status: RegistrationStatus;
    note: string;
    registeredAt: string | null;
    cancelledAt: string | null;
}

export interface MemberEvent {
    id: string;
    title: string;
    description: string;
    startAt: string | null;
    endAt: string | null;
    venue: string;
    venueAddress: string;
    venueMapUrl: string;
    state: string;
    district: string;
    block: string;
    bannerUrl: string;
    bannerAlt: string;
    bannerFit: 'cover' | 'contain';
    bannerPosition: string;
    status: PublishStatus;
    audience: Audience;
    agenda: AgendaItem[];
    speakers: EventSpeaker[];
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    registrationEnabled: boolean;
    registrationDeadline: string | null;
    /** The deadline, or the start — derived, so moving the event moves it. */
    registrationClosesAt: string | null;
    capacity: number;
    registrationNote: string;
    reminderOffsetsHours: number[];
    /**
     * `null` means "not counted", not "nobody". The two are different answers
     * and a card that renders `0 registered` for the first is simply wrong.
     */
    registeredCount: number | null;
    myRegistration: EventRegistration | null;
}

const EMPTY_EVENTS = { events: [] as MemberEvent[], total: 0 };

export const listMemberEvents = async (params: Record<string, any> = {}) =>
    unwrap<typeof EMPTY_EVENTS>(await api.get(ENDPOINTS.EVENTS.LIST, { params }), EMPTY_EVENTS);

export const getMemberEvent = async (id: string) =>
    unwrap<MemberEvent | null>(await api.get(ENDPOINTS.EVENTS.BY_ID(id)), null);

export const registerForEvent = async (id: string, details: Record<string, any> = {}) =>
    unwrap<EventRegistration & { alreadyRegistered?: boolean }>(
        await api.post(ENDPOINTS.EVENTS.REGISTER(id), details), {} as any);

export const cancelEventRegistration = async (id: string) =>
    unwrap<EventRegistration | null>(await api.delete(ENDPOINTS.EVENTS.REGISTER(id)), null);

export const listMyEventRegistrations = async () =>
    unwrap<{ registrations: (EventRegistration & { event: MemberEvent | null })[]; total: number }>(
        await api.get(ENDPOINTS.EVENTS.MY_REGISTRATIONS), { registrations: [], total: 0 });

/** The organiser's attendee list. Super admin only — the server enforces it. */
export const listEventRegistrations = async (id: string, params: Record<string, any> = {}) =>
    unwrap<{ registrations: EventRegistration[]; total: number; counts: Record<string, number> }>(
        await api.get(ENDPOINTS.EVENTS.REGISTRATIONS(id), { params }),
        { registrations: [], total: 0, counts: {} });

// ============================================================ DIR-001 directory

export interface DirectoryCompany {
    id: string;
    businessName: string;
    businessType: string;
    location: string;
    area: string;
    logo: string;
}

export interface DirectoryEntry {
    id: string;
    fullName: string;
    profilePhoto: string;
    city: string;
    state: string;
    district: string;
    block: string;
    memberType: string;
    membershipType: string;
    memberSince: string | null;
    companies: DirectoryCompany[];
    sectors: string[];
    productCount: number;
}

export interface DirectoryProduct {
    id: string;
    name: string;
    category: string;
    price: number;
    imageUrl: string;
}

export interface DirectoryFilters {
    q?: string;
    state?: string;
    district?: string;
    block?: string;
    sector?: string;
    memberType?: string;
    page?: number;
    limit?: number;
}

const EMPTY_DIRECTORY = {
    members: [] as DirectoryEntry[],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
};

/**
 * Search the directory.
 *
 * Blank filters are stripped rather than sent as empty strings: the server
 * treats an empty region as "no filter", but sending `state=` on every request
 * makes the de-duplication key differ from the same search typed without it,
 * and two identical searches would each cost a round trip.
 */
export const searchDirectory = async (filters: DirectoryFilters = {}) => {
    const params = Object.entries(filters).reduce<Record<string, any>>((acc, [key, value]) => {
        if (value !== undefined && value !== null && String(value).trim() !== '') acc[key] = value;
        return acc;
    }, {});

    return unwrap<typeof EMPTY_DIRECTORY>(
        await api.get(ENDPOINTS.MEMBERS.DIRECTORY, { params }), EMPTY_DIRECTORY);
};

export const getDirectoryEntry = async (id: string) =>
    unwrap<(DirectoryEntry & { products: DirectoryProduct[] }) | null>(
        await api.get(ENDPOINTS.MEMBERS.DIRECTORY_ENTRY(id)), null);

export const listDirectorySectors = async () =>
    unwrap<{ sectors: string[] }>(await api.get(ENDPOINTS.MEMBERS.DIRECTORY_SECTORS), { sectors: [] });

// ============================================================ BUS-001/2 catalogue

export type StockState = 'ok' | 'low' | 'out';

export type StockReason = 'restock' | 'sale' | 'damage' | 'return' | 'correction' | 'other';

export interface LowStockLine {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    stock: number;
    minStock: number;
    stockState: StockState;
}

export interface StockMovement {
    id: string;
    productId: string;
    productName: string;
    delta: number;
    resultingStock: number;
    reason: StockReason;
    note: string;
    at: string | null;
}

export const listLowStock = async () =>
    unwrap<LowStockLine[]>(await api.get(ENDPOINTS.PRODUCTS.LOW_STOCK), []);

export const listStockMovements = async (params: Record<string, any> = {}) =>
    unwrap<StockMovement[]>(await api.get(ENDPOINTS.PRODUCTS.STOCK_MOVEMENTS, { params }), []);

/**
 * Adjust a stock level.
 *
 * `delta` is "twelve arrived"; `setTo` is "I have just counted and there are
 * forty". Exactly one is needed and the server records a signed delta either
 * way, so a stock take and a delivery read the same in the history.
 */
export const adjustStock = async (
    id: string,
    change: { delta?: number; setTo?: number; reason?: StockReason; note?: string },
) =>
    unwrap<{
        id: string; name: string; stock: number; minStock: number;
        stockState: StockState; movement: StockMovement | null;
    }>(await api.post(ENDPOINTS.PRODUCTS.ADJUST_STOCK(id), change), {} as any);

export const setProductPublished = async (id: string, published: boolean) =>
    unwrap<{ id: string; name: string; isActive: boolean }>(
        await api.patch(ENDPOINTS.PRODUCTS.PUBLISH(id), { published }), {} as any);

/**
 * Tell the server that this member opened someone else's catalogue entry.
 *
 * Fire-and-forget by design: it feeds the seller's analytics and has nothing to
 * say to the viewer, so a failure is swallowed rather than surfaced. `GET
 * /products/:id` cannot do this — it is owner-scoped, so it is the one request
 * that can never be a view by someone else.
 */
export const recordProductView = async (id: string): Promise<void> => {
    try {
        await api.post(ENDPOINTS.PRODUCTS.VIEW(id), {});
    } catch {
        /* a missed view is not worth a message */
    }
};

// ============================================================ BUS-003 analytics

export interface CatalogueCounts {
    total: number;
    published: number;
    unpublished: number;
    featured: number;
    lowStock: number;
    outOfStock: number;
    /** Stock on hand at list price, rounded to whole rupees. */
    stockValue: number;
}

export interface EngagementDay {
    day: string;
    profile: number;
    product: number;
}

export interface TopProduct {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    price: number;
    stock: number;
    stockState: StockState;
    published: boolean;
    views: number;
}

export interface MemberAnalytics {
    windowDays: number;
    catalogue: CatalogueCounts;
    engagement: { profileViews: number; productViews: number; series: EngagementDay[] };
    topProducts: TopProduct[];
    stockMovements: number;
    companies: number;
}

export const EMPTY_ANALYTICS: MemberAnalytics = {
    windowDays: 30,
    catalogue: { total: 0, published: 0, unpublished: 0, featured: 0, lowStock: 0, outOfStock: 0, stockValue: 0 },
    engagement: { profileViews: 0, productViews: 0, series: [] },
    topProducts: [],
    stockMovements: 0,
    companies: 0,
};

export const getMyAnalytics = async (days = 30) =>
    unwrap<MemberAnalytics>(await api.get(ENDPOINTS.ANALYTICS.ME, { params: { days } }), EMPTY_ANALYTICS);
