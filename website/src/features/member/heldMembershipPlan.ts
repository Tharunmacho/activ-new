import api, { unwrap } from '@/services/api';
import { getMyMembershipPlans, toPlanAudience } from '@/services/activApi';
import { isLifetimeTier, selectHeldMembershipPlan } from '@/lib/heldMembershipPlan';
import type { MembershipPlan } from './membershipPlans';

/** The catalogue entry for the paid membership, not a new applicant's offer. */
export async function getHeldMembershipPlan(profile: any): Promise<MembershipPlan | null> {
  if (!profile) throw new Error('The membership record could not be loaded.');
  const [response, legacy] = await Promise.all([
    api.get('/membership/plans', { params: { include: 'platinum' } }),
    isLifetimeTier(profile) || profile.paidMembership?.planId ? Promise.resolve(null) : getMyMembershipPlans(),
  ]);
  const body = unwrap<any>(response, {});
  const rows = Array.isArray(body) ? body : Array.isArray(body?.plans) ? body.plans : [];
  const row: any = selectHeldMembershipPlan(profile, rows, legacy?.matched);
  if (!row) return null;
  const price = Number(row.price ?? row.amount ?? (row.amountPaise != null ? row.amountPaise / 100 : NaN));
  if (!Number.isFinite(price) || price <= 0) throw new Error('The current membership price is unavailable. Please retry.');
  return {
    id: String(row.key || row.id), name: isLifetimeTier(profile) ? 'Lifetime Membership' : String(row.name || ''),
    description: String(row.description || row.tagline || ''), price, experience: String(row.experience || ''),
    features: Array.isArray(row.features ?? row.entitlements) ? (row.features ?? row.entitlements).map(String) : [],
    audience: toPlanAudience(row.audience), membershipType: String(row.membershipType || row.memberType || ''),
  };
}
