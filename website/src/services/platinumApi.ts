import api, { unwrap } from './api';

/**
 * PLATINUM — the lifetime membership the Super Admin grants by hand, after
 * the fee is paid at the office. Never bought online. Server rules:
 * `backend/src/modules/members/platinum.service.js`.
 */

export type PlatinumPaymentMode = 'cash' | 'cheque' | 'bank_transfer' | 'upi_offline' | 'other';

export const PAYMENT_MODE_LABEL: Record<PlatinumPaymentMode, string> = {
    cash: 'Cash',
    cheque: 'Cheque / DD',
    bank_transfer: 'Bank transfer (NEFT / RTGS)',
    upi_offline: 'UPI to the office account',
    other: 'Other',
};

export interface PlatinumCandidate {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    whatsappNumber?: string;
    block: string;
    district: string;
    state: string;
    membershipNumber: string;
    membershipStatus: string;
    membershipType: string;
    membershipTier: 'standard' | 'platinum';
    applicationOutcome: string;
    canAdmitManually?: boolean; existingAccount?: boolean;
    /** Why a grant would be refused; '' when it can go ahead. */
    blockedReason: string;
    platinumGrant: null | {
        grantedAt: string;
        grantedByName: string;
        amount: number;
        paymentMode: PlatinumPaymentMode | '';
        receiptNumber: string;
        receivedOn: string | null;
        note: string;
    };
}

export interface PlatinumOverview {
    plan: { name: string; price: number; active: boolean };
    members: PlatinumCandidate[];
}

const BASE = '/admin/super/membership/platinum';

/* ---------------------------------------------------- the apply flow */

export type PlatinumContact = 'call' | 'whatsapp' | 'email';
export type PlatinumRequestStatus = 'new' | 'contacted' | 'converted' | 'declined';

export interface PlatinumRequest {
    id: string;
    memberId: string;
    name: string;
    email: string;
    phone: string;
    block: string;
    district: string;
    state: string;
    companyName: string;
    preferredContact: PlatinumContact;
    preferredTime: string;
    message: string;
    status: PlatinumRequestStatus;
    notes: string;
    handledBy: string;
    handledAt: string | null;
    createdAt: string | null;
    /** Super admin list only: why a grant would be refused ('' = can grant). */
    blockedReason?: string; canAdmitManually?: boolean;
    membershipTier?: string;
}

/** The signed-in member's own request (member token). */
export const getMyPlatinumRequest = async (): Promise<{ request: PlatinumRequest | null; isPlatinum: boolean }> =>
    unwrap(await api.get('/membership/platinum/request'), { request: null, isPlatinum: false });

export const applyForPlatinum = async (body: {
    preferredContact: PlatinumContact; preferredTime?: string; message?: string;
}): Promise<{ request: PlatinumRequest; existing: boolean }> =>
    unwrap(await api.post('/membership/platinum/request', body), null as unknown as { request: PlatinumRequest; existing: boolean });

export const listPlatinumRequests = async (status?: string): Promise<{
    requests: PlatinumRequest[]; counts: Record<PlatinumRequestStatus | 'all', number>;
}> => unwrap(await api.get(`${BASE}/requests`, { params: status ? { status } : {} }),
    { requests: [], counts: { new: 0, contacted: 0, converted: 0, declined: 0, all: 0 } });

/** Everything the member has filled in, for the office calling them back. Super Admin only. */
export interface PlatinumRequestDetail {
    request: PlatinumRequest;
    personal: {
        fullName: string; email: string; phoneNumber: string; whatsappNumber: string;
        gender: string; socialCategory: string; religion: string; educationalQualification: string;
        block: string; district: string; state: string; city: string;
        isInternational: boolean; place: string; country: string;
        profilePhoto: string; registeredOn: string | null;
    };
    membership: {
        memberNumber: string; status: string; type: string; tier: string; memberType: string;
        activatedAt: string | null; expiresAt: string | null; lastPaymentAmount: number; lastPaymentDate: string | null;
    };
    application: null | { reference: string; status: string; memberType: string; submittedAt: string | null; decidedAt: string | null };
    business: null | {
        doingBusiness: boolean; registrationType: string; organizationName: string; constitutionType: string;
        businessTypes: string[]; businessActivities: string[]; commencementYear: string; numberOfEmployees: string | number;
        memberOfOtherChamber: boolean; otherChamber: string; govtOrganizations: string[];
    };
    declaration: null | { sisterConcerns: string | number; companyNames: string[]; agreed: boolean };
    history: PlatinumRequest[];
}

export const getPlatinumRequestDetail = async (id: string): Promise<PlatinumRequestDetail> =>
    unwrap<PlatinumRequestDetail>(await api.get(`${BASE}/requests/${encodeURIComponent(id)}`), null as unknown as PlatinumRequestDetail);

export const updatePlatinumRequest = async (id: string, body: { status?: PlatinumRequestStatus; notes?: string }) =>
    unwrap<PlatinumRequest>(await api.patch(`${BASE}/requests/${encodeURIComponent(id)}`, body), null as unknown as PlatinumRequest);

export const getPlatinumOverview = async (): Promise<PlatinumOverview> =>
    unwrap<PlatinumOverview>(await api.get(BASE), { plan: { name: 'Lifetime membership', price: 200000, active: true }, members: [] });

export const searchPlatinumCandidates = async (q: string): Promise<PlatinumCandidate[]> =>
    unwrap<PlatinumCandidate[]>(await api.get(`${BASE}/search`, { params: { q } }), []);

export const grantPlatinum = async (memberId: string, body: {
    amount: number; paymentMode: PlatinumPaymentMode; receiptNumber?: string; receivedOn?: string; note?: string; manualAdmission?: boolean;
}): Promise<PlatinumCandidate> =>
    unwrap<PlatinumCandidate>(await api.post(`${BASE}/${encodeURIComponent(memberId)}`, body), null as unknown as PlatinumCandidate);

export const revokePlatinum = async (memberId: string): Promise<PlatinumCandidate> =>
    unwrap<PlatinumCandidate>(await api.delete(`${BASE}/${encodeURIComponent(memberId)}`), null as unknown as PlatinumCandidate);
export const createPlatinumAccount = async (body: { fullName: string; email: string; password: string; phoneNumber: string; whatsappNumber: string; state: string; district: string; block: string }) =>
    unwrap<PlatinumCandidate>(await api.post(`${BASE}/accounts`, body), null as unknown as PlatinumCandidate);

export const updatePlatinumAccount = async (id: string, body: { email: string; phoneNumber: string; whatsappNumber: string; password?: string }) =>
    unwrap<PlatinumCandidate>(await api.patch(`${BASE}/${encodeURIComponent(id)}/account`, body), null as unknown as PlatinumCandidate);
