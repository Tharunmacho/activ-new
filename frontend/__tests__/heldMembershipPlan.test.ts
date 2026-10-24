import { selectHeldMembershipPlan } from '../src/utils/heldMembershipPlan';

const business = { key: 'ideal', audience: 'business', membershipType: 'annual', price: 10000, popular: true };
const held = { key: 'basic', audience: 'business', membershipType: 'annual', price: 5000 };
const lifetime = { key: 'platinum', audience: 'platinum', membershipType: 'lifetime', price: 200000 };

test('the lifetime tier wins over business eligibility and an older paid plan', () => {
  const profile = { membershipTier: ' Platinum ', membershipType: 'lifetime', paidMembership: { planId: 'basic' } };
  expect(selectHeldMembershipPlan(profile, [business, held, lifetime], business)).toBe(lifetime);
  expect(selectHeldMembershipPlan(profile, [business], business)).toBeNull();
  expect(selectHeldMembershipPlan(profile, [business, { ...lifetime, active: false }], business)).toBeNull();
});

test('recorded annual plan remains authoritative when the business now qualifies for a different band', () => {
  expect(selectHeldMembershipPlan({ paidMembership: { planId: 'basic' } }, [business, held], business)).toBe(held);
  expect(selectHeldMembershipPlan({ paidMembership: { planId: 'retired' } }, [business, held], business)).toBeNull();
});

test('the server-confirmed automatic progression selects the new plan and retains the receipt', () => {
  const profile = { paidMembership: { planId: 'basic' }, currentMembership: { planId: 'ideal' } };
  expect(selectHeldMembershipPlan(profile, [business, held], business)).toBe(business);
  expect(profile.paidMembership.planId).toBe('basic');
});

test('legacy matches require the recorded term; lifetime type or payment amount alone cannot grant the tier', () => {
  expect(selectHeldMembershipPlan({ membershipType: 'annual' }, [business, held], business)).toBe(business);
  expect(selectHeldMembershipPlan({ membershipType: 'lifetime' }, [business, lifetime], business)).toBeNull();
  expect(selectHeldMembershipPlan({ lastPaymentAmount: 200000 }, [business, lifetime])).toBeNull();
  expect(selectHeldMembershipPlan(null, [business, lifetime], business)).toBeNull();
  expect(selectHeldMembershipPlan({ paidMembership: { kind: 'platinum' } }, [business, lifetime], business)).toBe(lifetime);
});
