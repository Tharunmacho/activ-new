import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GradientButton, StateView, PremiumSelect } from '../src/ui';
import api from '../src/services/api';
import MembershipPlansScreen from '../src/screens/payment/MembershipPlansScreen';
import PaymentCheckoutScreen from '../src/screens/payment/PaymentCheckoutScreen';
import { startHostedPayment, payMembershipMock } from '../src/services/paymentFlow';
import { getUpgradePlans } from '../src/services/paymentFlow';

jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return { useFocusEffect: (cb: () => any) => ReactLib.useEffect(() => cb(), [cb]) };
});
let mockAvailable = true;
let mockAutomatic = false;
let mockExpired = false;
let mockOffline = false;
jest.mock('../src/services/api', () => ({
  __esModule: true,
  getUserData: jest.fn(async () => ({ _id: 'upgrade-member' })),
  getAuthToken: jest.fn(async () => 'test-only-token'),
  default: {
    get: jest.fn(async (url: string) => {
      if (mockOffline && url.includes('/upgrade/plans')) throw Error('offline');
      const data = url.includes('/upgrade/plans')
        ? { canPurchase: !mockAutomatic, commencementYear: String(new Date().getFullYear() - 2), plans: mockAvailable ? [{ key: 'basic', name: 'Business Starter', audience: 'business', price: 5000, membershipType: 'annual', features: [], minYears: 0, maxYears: 5, commencementYears: Array.from({length:5}, (_,i)=>String(new Date().getFullYear()-i)) }] : [], reason: mockAvailable ? '' : 'Update your profile category to qualify for a different plan.' }
        : url.includes('/payment/config') ? { mode: 'gateway', provider: 'instamojo', hosted: true, configured: true }
        : url.includes('/my-profile') ? { membershipStatus: mockExpired ? 'expired' : 'active', paidMembership: { planId: 'current' }, renewal: { state: mockExpired ? 'expired' : 'active', canRenew: false } }
          : url === '/membership/plans' ? [{ key: 'current', name: 'Current Business Plan', price: 1200, audience: 'business', membershipType: 'annual', features: ['Trade networking', 'Business workshops'] }] : [];
      return { data: { data } };
    }),
    post: jest.fn(async (url: string) => ({ data: { data: url.includes('create-request')
      ? { payment_url: 'https://example.test/pay', orderId: 'ord-upgrade', amount: 5000 }
      : url.endsWith('/order') ? { orderId: 'ord-upgrade' }
        : url.includes('mock-authorize') ? { gatewayPaymentId: 'test-payment', signature: 'test-signature' } : {} } })),
  },
}));

const visibleText = (node: any): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(visibleText).join(' ') : node?.children ? visibleText(node.children) : '';
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const mount = async () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
  let tree: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<MembershipPlansScreen navigation={navigation} route={{ params: { upgrade: true } }} />); await flush(); await flush(); });
  return { tree: tree!, navigation };
};
beforeEach(async () => { mockAvailable = true; mockAutomatic = false; mockExpired = false; mockOffline = false; jest.clearAllMocks(); await AsyncStorage.clear(); });

test.each([false, true])('existing member can upgrade without a new application or renewal window (expired=%s)', async expired => {
  mockExpired = expired;
  const { tree, navigation } = await mount();
  const pay = tree.root.findAllByType(GradientButton).find(button => String(button.props.label).startsWith('Pay'));
  expect(pay).toBeDefined();
  expect(pay?.props.disabled).toBe(false);
  await act(async () => { pay?.props.onPress(); });
  expect(navigation.navigate).toHaveBeenCalledWith('PaymentCheckout', expect.objectContaining({ planId: 'basic', upgrade: true, renew: false }));
  expect(tree.root.findAllByType(PremiumSelect).some(input => input.props.label === 'Business commencement year')).toBe(true);
  await act(async () => tree.unmount());
});

test('no published alternative plans means no payment action', async () => {
  mockAvailable = false;
  const { tree } = await mount();
  const buttons = tree.root.findAllByType(GradientButton);
  expect(visibleText(tree.toJSON())).toContain('Current Business Plan');
  expect(visibleText(tree.toJSON())).toContain('Trade networking');
  expect(buttons.some(button => String(button.props.label).startsWith('Pay'))).toBe(false);
  await act(async () => tree.unmount());
});

test('automatic progression offers no immediate payment or editable commencement year', async () => {
  mockAutomatic = true;
  const { tree } = await mount();
  expect(visibleText(tree.toJSON())).toContain('Current Business Plan');
  expect(visibleText(tree.toJSON())).toContain('Business workshops');
  expect(visibleText(tree.toJSON())).not.toContain('Order summary');
  expect(visibleText(tree.toJSON())).not.toContain('No different plan');
  expect(tree.root.findAllByType(GradientButton).some(button => String(button.props.label).startsWith('Pay'))).toBe(false);
  expect(tree.root.findAllByType(PremiumSelect).some(input => input.props.label === 'Business commencement year')).toBe(false);
  await act(async () => tree.unmount());
});

test('a checkout link cannot charge an automatically advanced business tier', async () => {
  mockAutomatic = true;
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PaymentCheckoutScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }} route={{ params: { orderType: 'membership', planId: 'basic', upgrade: true } }} />);
    await flush(); await flush();
  });
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => tree!.unmount());
});

test('failed eligibility load cannot offer a guessed or stale payment', async () => {
  mockOffline = true;
  const { tree } = await mount();
  expect(tree.root.findAllByType(GradientButton).some(button => String(button.props.label).startsWith('Pay'))).toBe(false);
  expect(tree.root.findByType(StateView).props.title).toBe('Could not load the prices');
  await act(async () => tree.unmount());
});

test('an old unfiltered catalogue cannot authorize an upgrade payment', async () => {
  (api.get as jest.Mock).mockResolvedValueOnce({ data: { data: { plans: [{ key: 'ideal', audience: 'business' }] } } });
  await expect(getUpgradePlans()).rejects.toThrow('temporarily unavailable');
});

test('hosted and mock checkout carry the upgrade flag while the server chooses the price', async () => {
  await startHostedPayment({ orderType: 'membership', planId: 'basic', upgrade: true, commencementYear: undefined });
  expect(api.post).toHaveBeenCalledWith('/payment/create-request', { orderType: 'membership', membershipType: 'basic', upgrade: true, commencementYear: undefined, client: 'app' });
  await payMembershipMock('basic', undefined, true);
  expect(api.post).toHaveBeenCalledWith('/payment/order', { planId: 'basic', upgrade: true, commencementYear: undefined });
  await startHostedPayment({ orderType: 'event_booking', bookingRef: 'BOOK-1', upgrade: true, commencementYear: undefined });
  expect(api.post).toHaveBeenCalledWith('/payment/create-request', { orderType: 'event_booking', bookingRef: 'BOOK-1', client: 'app' });
});

test.each([true, false])('native checkout rechecks eligibility before opening an upgrade payment (eligible=%s)', async available => {
  mockAvailable = available;
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<PaymentCheckoutScreen navigation={{ replace: jest.fn(), goBack: jest.fn() }}
      route={{ params: { orderType: 'membership', planId: 'basic', upgrade: true } }} />);
    await flush(); await flush();
  });
  if (available) expect(api.post).toHaveBeenCalledWith('/payment/create-request', { orderType: 'membership', membershipType: 'basic', upgrade: true, commencementYear: undefined, client: 'app' });
  else expect(api.post).not.toHaveBeenCalled();
  await act(async () => tree!.unmount());
});
