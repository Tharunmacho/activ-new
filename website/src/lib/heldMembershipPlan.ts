const normalized = (value: unknown) => String(value || '').trim().toLowerCase();

export const isLifetimeTier = (profile: any): boolean =>
  [profile?.membershipTier, profile?.paidMembership?.kind, profile?.paidMembership?.planId].some(value => normalized(value) === 'platinum');

/** A paid plan is not the applicant's current business-band offer. Never guess by price or popularity. */
export function selectHeldMembershipPlan<T extends { key?: string; id?: string; audience?: string; membershipType?: string; active?: boolean; isActive?: boolean }>(
  profile: any, catalogue: T[], matched?: T | null,
): T | null {
  if (!profile) return null;
  const rows = catalogue.filter(row => row.active !== false && row.isActive !== false);
  const keyOf = (row: T) => normalized(row.key || row.id);
  if (isLifetimeTier(profile)) {
    return rows.find(row => keyOf(row) === 'platinum' || normalized(row.audience) === 'platinum') || null;
  }
  const key = normalized(profile.paidMembership?.planId);
  if (key) return rows.find(row => keyOf(row) === key) || null;
  // Older records have no order key. Use only the server's explicit match and
  // only if its term agrees; a generic lifetime flag is not proof of this tier.
  if (!matched || normalized(matched.audience) === 'platinum') return null;
  const term = normalized(profile.membershipType);
  if (term && normalized(matched.membershipType) !== term) return null;
  return rows.find(row => keyOf(row) === keyOf(matched)) || null;
}
