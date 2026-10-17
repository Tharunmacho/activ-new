import api, { unwrap } from './api';
import { downloadSpreadsheet } from './spreadsheetDownload';

export interface MembershipRegistration {
    id: string; name: string; email: string; phone: string; kind: string; region: string;
    registeredAt: string; memberNumber: string; assignedMemberNumber?: string; applicationId: string; applicationStatus: string;
    submittedAt: string | null; status: string; membershipType: string; planName: string;
    activatedAt: string | null; expiresAt: string | null; lifetime: boolean; collected: number;
    confirmation: string; canConfirm: boolean; requiresManualAdmission?: boolean; blockedReason: string;
}
export interface MembershipPayment {
    id: string; memberId: string; registrationDeleted?: boolean; name: string; email: string; orderId: string;
    planId: string; planName: string; amount: number; status: string; provider: string;
    mode: string; paymentId: string; createdAt: string; paidAt: string | null; expiresAt: string;
    manual: { by: string; byName: string; at: string; note: string; expectedAmount: number; waivedAmount: number; receiptNumber: string } | null;
}
export interface MembershipDashboard {
    rows: MembershipRegistration[]; payments: MembershipPayment[];
    plans: { id: string; name: string; price: number; membershipType: string }[];
    summary: { registered: number; submitted: number; active: number; awaiting: number; pendingReview: number; expired: number; collected: number; waived: number; openOrders: number };
}
export interface ConfirmationPlan { id: string; key: string; name: string; price: number; audience: string; commencementYears: string[]; commencementYearLabel: string }
export interface MembershipDetail { member: MembershipRegistration; payments: MembershipPayment[]; confirmation?: { kind: string; commencementYear: string; plans: ConfirmationPlan[]; requiresCommencementYear: boolean } }
export interface MembershipConfirmation { planId: string; mode: string; amount: number; note: string; receiptNumber: string; membershipNumber?: string; commencementYear?: string }
const base = '/admin/super/membership/registrations';
export const exportMembershipReport = (tab: 'members' | 'payments' | 'archived', filter: string) =>
    downloadSpreadsheet(base + '/export', 'membership-' + tab + '.xlsx', { tab, filter });
export const loadMembershipDashboard = async () => unwrap<MembershipDashboard>(await api.get(base), null as unknown as MembershipDashboard);
export const loadMembershipDetail = async (id: string) => unwrap<MembershipDetail>(await api.get(`${base}/${encodeURIComponent(id)}`), null as unknown as MembershipDetail);
export const confirmMembership = async (id: string, body: MembershipConfirmation) => unwrap<MembershipDetail>(await api.post(`${base}/${encodeURIComponent(id)}/confirm`, body), null as unknown as MembershipDetail);

export const deleteMembershipRegistration = async (id: string) => unwrap(await api.delete(`${base}/${encodeURIComponent(id)}`), null);
export const deleteArchivedMembershipPayment = async (id: string) => unwrap(await api.delete(`/admin/super/membership/payments/${encodeURIComponent(id)}/archived`, { data: { recordId: id, confirmation: 'DELETE' } }), null);
