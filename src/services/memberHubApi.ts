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

/** One question on an event's own registration form (EVT-004). */
export interface RegistrationFieldDef {
    /** Stable identifier the answer is stored against. Survives a rename. */
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'checkbox';
    required: boolean;
    placeholder: string;
    helpText: string;
    /** For `select` only; empty for every other type. */
    options: string[];
}

/**
 * One answer, carrying the label it was given under.
 *
 * The label is stored with the answer rather than looked up from the event when
 * the attendee list is read: the form is editable after people register, so a
 * label read at render time would relabel answers somebody already gave — and a
 * deleted field would leave its answers with no heading at all.
 */
export interface RegistrationResponse {
    key: string;
    label: string;
    value: string;
}

/** What a seat cost and whether it has been settled. See the model's note. */
export interface RegistrationPayment {
    /** `not_required` free · `pending` held, unpaid · `paid` confirmed. */
    status: 'not_required' | 'pending' | 'paid';
    amount: number;
    reference: string;
    method: string;
    paidAt: string | null;
}

export interface EventRegistration {
    id: string;
    eventId: string;
    userId: string;
    payment: RegistrationPayment;
    /** The answers this member gave to the event's own form, in its order. */
    responses: RegistrationResponse[];
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
    /** Rupees. 0 is free; anything above it adds a payment step. */
    registrationFee: number;
    /**
     * The member rate, and what it saves — resolved by the server.
     *
     * `null` when the event carries no member rate. A card that showed only
     * `registrationFee` told a member the full price they are not being asked
     * to pay, which is the one number on an event card that must not be wrong.
     */
    memberFee?: number | null;
    memberPrice?: number;
    hasMemberRate?: boolean;
    /**
     * WHAT THIS MEMBER PAYS, resolved server-side against their live
     * membership. The one number to print beside a Register button.
     */
    yourPrice?: number;
    memberRateApplies?: boolean;
    yourSaving?: number;
    /** The chip the event is filed under — "Awareness", "Coffee Meet". */
    category?: string;
    /*
     * The questions THIS event asks, designed per event by the super admin.
     *
     * The member screen renders whatever is in here and holds no list of its
     * own — a client that knows the fields is a client that has to ship before
     * the association can ask a new question.
     */
    registrationFields: RegistrationFieldDef[];
    /** Every region this event was aimed at. Empty means everyone. */
    targets: { state: string; district: string; block: string }[];
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

/**
 * Sessions written with the DAY editor live on `days[].agenda`, and the member
 * screen only draws the flat `agenda`. With the flat list empty they were
 * saved and never shown. Flattened here, each labelled with its day when the
 * event runs over more than one.
 */
const withDayAgenda = (event: MemberEvent | null): MemberEvent | null => {
    if (!event) return event;
    const flat = (event.agenda || []).filter((r) => r && (r.title || r.startTime));
    const days = ((event as any).days || []) as Array<{ date?: string; agenda?: AgendaItem[] }>;
    if (flat.length || !days.length) return event;

    const multi = days.filter((d) => d && d.date).length > 1;
    const merged: AgendaItem[] = [];
    days.forEach((day, index) => {
        (day?.agenda || []).filter((r) => r && (r.title || r.startTime)).forEach((row) => {
            let label = '';
            if (multi && day?.date) {
                const d = new Date(`${String(day.date).slice(0, 10)}T00:00:00`);
                label = Number.isNaN(d.getTime())
                    ? `Day ${index + 1}`
                    : `Day ${index + 1} · ${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;
            }
            merged.push({ ...row, title: label ? `${label} — ${row.title || 'Session'}` : row.title });
        });
    });
    return merged.length ? { ...event, agenda: merged } : event;
};

export const getMemberEvent = async (id: string) =>
    withDayAgenda(unwrap<MemberEvent | null>(await api.get(ENDPOINTS.EVENTS.BY_ID(id)), null));

export const registerForEvent = async (id: string, details: Record<string, any> = {}) =>
    unwrap<EventRegistration & { alreadyRegistered?: boolean }>(
        await api.post(ENDPOINTS.EVENTS.REGISTER(id), details), {} as any);

/**
 * Settle the fee on a held seat.
 *
 * A separate call from `registerForEvent` because holding a seat and paying for
 * it are two things: a member can hold one and pay later, a payment can fail
 * and be retried, and a real gateway will one day call the server back from
 * outside the browser. Idempotent — a refreshed receipt page is not a second
 * purchase.
 */
export const payForEvent = async (id: string, details: Record<string, any> = {}) =>
    unwrap<EventRegistration & { alreadyPaid?: boolean }>(
        await api.post(ENDPOINTS.EVENTS.PAY_REGISTRATION(id), details), {} as any);

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
    logo: string;
}

/** A product as it appears on a search row: picture and name, nothing else. */
export interface DirectoryProductPreview {
    id: string;
    name: string;
    imageUrl: string;
}

export interface DirectoryEntry {
    id: string;
    fullName: string;
    profilePhoto: string;
    /*
     * No `city`, and no `location`/`area` on the companies above.
     *
     * The server stopped sending them: a directory that prints where a member's
     * premises are is a mailing list, which is the one thing DIR-001 says it is
     * not. State, district and block stay — they are the region tree every
     * screen filters on, not an address.
     */
    state: string;
    district: string;
    block: string;
    memberType: string;
    membershipType: string;
    memberSince: string | null;
    companies: DirectoryCompany[];
    sectors: string[];
    productCount: number;
    /** Up to four, for the tiles on the row. See `PRODUCT_PREVIEW` server-side. */
    products: DirectoryProductPreview[];
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

/** Where the viewer is registered — what the screen defaults its filters to. */
export interface ViewerRegion {
    state: string;
    district: string;
    block: string;
}

const EMPTY_DIRECTORY = {
    members: [] as DirectoryEntry[],
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    viewerRegion: { state: '', district: '', block: '' } as ViewerRegion,
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

/**
 * One member's card — the same shape, with the FULL catalogue lines.
 *
 * `DirectoryEntry.products` is the four-tile preview (picture and name). The
 * card replaces it with `DirectoryProduct`, which carries category and price
 * too: a price belongs where a buyer is looking at one supplier deliberately,
 * not on a row of search results where it reads as a quotation.
 */
export const getDirectoryEntry = async (id: string) =>
    unwrap<(Omit<DirectoryEntry, 'products'> & { products: DirectoryProduct[] }) | null>(
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
