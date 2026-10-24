import api from '../src/services/api';
import { getHeldMembershipPlan } from '../src/services/paymentFlow';
jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../src/ui', () => ({ unwrap: (r: any, fallback: any) => r?.data?.data ?? fallback, asArray: (value: any) => Array.isArray(value) ? value : [] }));
const get = api.get as jest.Mock;
const profile = { membershipTier: 'platinum', membershipType: 'lifetime' };
test('reads the production public catalogue amount, term and entitlements', async () => {
  get.mockResolvedValue({ data: { data: { plans: [{ key: 'platinum', audience: 'platinum', name: 'Lifetime Membership', amount: 200000, amountPaise: 20000000, memberType: 'lifetime', entitlements: ['No renewal'] }] } } });
  const plan = await getHeldMembershipPlan(profile);
  expect(plan).toMatchObject({ price: 200000, membershipType: 'lifetime', features: ['No renewal'] });
});
test.each([{}, { price: 0 }, { amount: null }, { price: 'invalid' }])('does not turn an absent or invalid rate into zero: %j', async rate => {
  get.mockResolvedValue({ data: { data: { plans: [{ key: 'platinum', audience: 'platinum', ...rate }] } } });
  await expect(getHeldMembershipPlan(profile)).rejects.toThrow('price is unavailable');
});
test('a CMS price edit changes the rate without changing the paid amount', async () => {
  get.mockResolvedValue({ data: { data: { plans: [{ key: 'platinum', audience: 'platinum', price: 225000 }] } } });
  const member = { ...profile, paymentAmount: 200000 };
  expect((await getHeldMembershipPlan(member))?.price).toBe(225000);
  expect(member.paymentAmount).toBe(200000);
});
