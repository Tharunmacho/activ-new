import api, { unwrap } from './api';

export interface MembershipIdRecord {
    id: string; membershipNumber: string; previousIds: string[]; fullName: string; email: string;
    phoneNumber: string; whatsappNumber: string; state: string; district: string; block: string;
    city: string; place: string; educationalQualification: string; memberSince: string; validUntil: string;
    planName: string; categoryCode: string; lifetime: boolean; status: string; updatedAt: string | null; editable: boolean;
    history: { at: string; by: string; note: string; changes: Record<string, { before: unknown; after: unknown }> }[];
}
export interface MembershipIdPage { rows: MembershipIdRecord[]; total: number; page: number; limit: number }
// Also handle older API responses during a rolling deployment.
export function visibleMembershipIds(data: MembershipIdPage): MembershipIdPage {
    const rows = data.rows.filter(row => !['archived', 'deleted'].includes(String(row.status).toLowerCase()));
    return { ...data, rows, total: Math.max(0, data.total - (data.rows.length - rows.length)) };
}
export type MembershipIdCorrection = Pick<MembershipIdRecord, 'membershipNumber' | 'fullName' | 'email' | 'phoneNumber' | 'whatsappNumber' | 'state' | 'district' | 'block' | 'city' | 'place' | 'educationalQualification' | 'memberSince' | 'validUntil' | 'updatedAt'> & { note: string; generateId: boolean };
const base = '/admin/super/membership/ids';
export const deleteMembershipId = async (id: string) => api.delete(`${base}/${encodeURIComponent(id)}`);
export const listMembershipIds = async (search: string, page: number) => unwrap<MembershipIdPage>(await api.get(base, { params: { search, page } }), { rows: [], total: 0, page, limit: 20 });
export const getMembershipId = async (id: string) => unwrap<MembershipIdRecord>(await api.get(`${base}/${encodeURIComponent(id)}`), null as unknown as MembershipIdRecord);
export const updateMembershipId = async (id: string, body: MembershipIdCorrection) => unwrap<MembershipIdRecord>(await api.patch(`${base}/${encodeURIComponent(id)}`, body), null as unknown as MembershipIdRecord);
export function correctionForm(row: MembershipIdRecord): MembershipIdCorrection {
    return { membershipNumber: row.membershipNumber, fullName: row.fullName, email: row.email, phoneNumber: row.phoneNumber,
        whatsappNumber: row.whatsappNumber, state: row.state, district: row.district, block: row.block, city: row.city,
        place: row.place, educationalQualification: row.educationalQualification, memberSince: row.memberSince,
        validUntil: row.validUntil, updatedAt: row.updatedAt, note: '', generateId: false };
}
