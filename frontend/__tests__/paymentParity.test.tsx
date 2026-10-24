import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import api from '../src/services/api';
import { checkPaymentOrder, resolveReturn, startHostedPayment } from '../src/services/paymentFlow';
import { getPendingPayment, setPendingPayment } from '../src/services/paymentRecovery';
import { GradientButton, PremiumInput, ReceiptLine } from '../src/ui';
import { ResultHeader, WebCheckout } from '../src/screens/payment/paymentUi';
import PaymentCheckoutScreen from '../src/screens/payment/PaymentCheckoutScreen';
import PaymentResultScreen from '../src/screens/payment/PaymentResultScreen';
import DonateScreen from '../src/screens/payment/DonateScreen';
import DonationResultScreen from '../src/screens/payment/DonationResultScreen';
import { readDonationDocs } from '../src/screens/payment/donationStore';

let mockSignedIn = true;
let mockStoredRole: string | null = 'member';
let mockPaymentMode = 'gateway';
let mockPublicFailure = false;
let mockPrivateFailure = false;
let mockStatus: any;
let mockPrivate: any;
let mockGift: any;
let mockOrderReply: any;
let mockDeferred: null | ((url: string) => Promise<any>) = null;
const mockSelectCompany = jest.fn();
jest.mock('../src/stores/exampleStore', () => ({ useAuthStore: (select: any) => select({ isAuthenticated: mockSignedIn }) }));
jest.mock('../src/stores/activeCompanyStore', () => ({
  useActiveCompanyStore: { getState: () => ({ loadCompanies: async () => [{ _id: 'company-one' }], setActiveCompany: mockSelectCompany }) },
}));
jest.mock('../src/services/api', () => ({
  __esModule: true,
  getUserData: jest.fn(async () => mockSignedIn ? { _id: 'member-one', email: 'member@example.test' } : null),
  getAuthToken: jest.fn(async () => mockSignedIn ? 'test-only-token' : null),
  getUserRole: jest.fn(async () => mockSignedIn ? mockStoredRole : null),
  default: {
    get: jest.fn(async (url: string) => {
      const id = url.split('/').pop();
      if (url.includes('/payment/return/')) {
        if (mockPublicFailure) throw Error('offline');
        if (mockDeferred) return mockDeferred(url);
        return { data: { data: { ...mockStatus, orderId: id } } };
      }
      if (url.includes('/payment/order/')) {
        if (mockPrivateFailure) throw Error('offline');
        return { data: { data: { ...mockPrivate, orderId: id } } };
      }
      const data = url.includes('/payment/config') ? { mode: mockPaymentMode, provider: 'instamojo', configured: true, hosted: true }
        : url.includes('/membership/plans/mine') || url.includes('/upgrade/plans') ? { plans: [{ key: 'annual', name: 'Business Annual', audience: 'business', price: 5000 }] }
        : url.includes('/publishing') ? { paymentRequired: true, amount: 5000, companyName: 'Test Company' }
        : url.includes('/donations/return/') ? { ...mockGift, orderId: id }
        : url.includes('/my-profile') ? { membershipNumber: 'ACTIV-TEST-001' } : {};
      return { data: { data } };
    }),
    post: jest.fn(async (url: string) => ({ data: { data: url === '/donations'
      ? { orderId: 'gift-one', amount: 1000, paymentUrl: 'https://gateway.test/gift' }
      : mockOrderReply } })),
  },
}));

const nav = () => ({ navigate: jest.fn(), replace: jest.fn(), reset: jest.fn(), goBack: jest.fn(), canGoBack: () => true });
let navigation = nav();
let tree: renderer.ReactTestRenderer | null = null;
const flush = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };
const mount = async (Screen: React.ComponentType<any>, params: any = {}) => {
  await act(async () => { tree = renderer.create(<Screen navigation={navigation} route={{ params }} />); await flush(); });
};
const button = (label: string) => tree!.root.findAllByType(GradientButton).find(item => item.props.label === label)!;
const line = (label: string) => tree!.root.findAllByType(ReceiptLine).find(item => item.props.label === label)?.props.value;
const header = () => tree!.root.findByType(ResultHeader).props;
const polls = async (count: number) => {
  for (let i = 0; i < count; i += 1) await act(async () => { jest.advanceTimersByTime(3000); await flush(); });
};
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks(); await AsyncStorage.clear();
  navigation = nav(); mockSignedIn = true; mockPublicFailure = false; mockPrivateFailure = false; mockDeferred = null;
  mockStoredRole = 'member'; mockPaymentMode = 'gateway';
  mockStatus = { orderType: 'membership', status: 'paid', amount: 5000, planName: 'Business Annual', paidAt: '2026-10-01T09:00:00Z', paymentId: 'BANK-REFERENCE' };
  mockPrivate = { ...mockStatus };
  mockGift = { status: 'paid', amount: 1000, receiptToken: 'receipt-token', receiptNumber: 'ACTIV-TEST-GIFT', statementToken: 'year-token', financialYear: '2026-27' };
  mockOrderReply = { orderId: 'order-one', payment_url: 'https://gateway.test/pay', amount: 5000 };
});
afterEach(async () => {
  if (tree) await act(async () => { tree!.unmount(); });
  tree = null; jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks();
});

test('return mapper retains real plan, paid date, bank reference and company identity', async () => {
  mockStatus.companyId = 'company-one';
  expect(await resolveReturn('order-one')).toMatchObject({
    planName: 'Business Annual', paidAt: '2026-10-01T09:00:00Z', paymentId: 'BANK-REFERENCE', companyId: 'company-one',
  });
});

test('public status outage uses authenticated order fallback; guests never call private order APIs', async () => {
  mockPublicFailure = true;
  expect(await checkPaymentOrder('order-one')).toMatchObject({ status: 'paid', amount: 5000 });
  (api.get as jest.Mock).mockClear(); mockSignedIn = false;
  await expect(checkPaymentOrder('order-one')).rejects.toThrow('offline');
  expect(api.get).not.toHaveBeenCalledWith('/payment/order/order-one');
});

test('hosted order requests use server prices, identify app returns and reject missing order/unsafe URL', async () => {
  await startHostedPayment({ orderType: 'membership', planId: 'annual', upgrade: true, commencementYear: '2020' });
  expect(api.post).toHaveBeenCalledWith('/payment/create-request', { orderType: 'membership', membershipType: 'annual', upgrade: true, commencementYear: '2020', client: 'app' });
  mockOrderReply = { payment_url: 'https://gateway.test/pay' };
  await expect(startHostedPayment({ orderType: 'company_listing', companyId: 'company-one' })).rejects.toThrow('secure payment');
  mockOrderReply = { orderId: 'invalid', payment_url: 'javascript:bad' };
  await expect(startHostedPayment({ orderType: 'event_booking', bookingRef: 'BOOK-1' })).rejects.toThrow('secure payment');
});

test('membership checkout persists retry context and only accepts the current order callback', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount(PaymentCheckoutScreen, { orderType: 'membership', planId: 'annual', applicationId: 'application-one', renew: true });
  expect(await getPendingPayment()).toMatchObject({ orderId: 'order-one', planId: 'annual', applicationId: 'application-one', renew: true });
  await act(async () => tree!.root.findByType(WebCheckout).props.onReturn({ orderId: 'different', paymentStatus: 'Credit' }));
  expect(navigation.replace).not.toHaveBeenCalled(); expect(alert).toHaveBeenCalled();
  await act(async () => tree!.root.findByType(WebCheckout).props.onReturn({ orderId: 'order-one', paymentStatus: 'Credit' }));
  expect(navigation.replace).toHaveBeenCalledWith('PaymentResult', expect.objectContaining({ orderId: 'order-one', planId: 'annual', applicationId: 'application-one', renew: true }));
});

test('reopening a pending checkout restores the same gateway page without creating another order', async () => {
  mockStatus.status = 'created'; mockPrivate.status = 'created';
  await setPendingPayment({ orderType: 'membership', planId: 'annual', orderId: 'saved-order', amount: 5000, paymentUrl: 'https://gateway.test/saved' });
  await mount(PaymentCheckoutScreen, { orderType: 'membership', planId: 'annual' });
  expect(tree!.root.findByType(WebCheckout).props.url).toBe('https://gateway.test/saved');
  expect(api.post).not.toHaveBeenCalled();
});

test('company checkout uses its publishing quote and browser fallback retains status action', async () => {
  await mount(PaymentCheckoutScreen, { orderType: 'company_listing', companyId: 'company-one' });
  expect(api.post).toHaveBeenCalledWith('/payment/create-request', { orderType: 'company_listing', companyId: 'company-one', client: 'app' });
  await act(async () => tree!.root.findByType(WebCheckout).props.onError());
  const check = tree!.root.findAllByType(GradientButton).find(item => String(item.props.label).includes('check status'))!;
  await act(async () => check.props.onPress());
  expect(navigation.replace).toHaveBeenCalledWith('PaymentResult', expect.objectContaining({ orderType: 'company_listing', companyId: 'company-one' }));
});

test('browser Dashboard action returns to the paid app dashboard only after server verification', async () => {
  await mount(PaymentResultScreen, { orderId: 'order-one', returnToDashboard: true });
  expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PaidDashboard' }] });
  await act(async () => tree!.unmount()); tree = null; navigation.reset.mockClear();
  mockStatus.status = 'created'; mockPrivate.status = 'created';
  await mount(PaymentResultScreen, { orderId: 'order-two', returnToDashboard: true, paymentStatus: 'Credit' });
  expect(navigation.reset).not.toHaveBeenCalled();
});

test('paid receipt uses server fields and renewal context, without inventing a date when missing', async () => {
  await mount(PaymentResultScreen, { orderId: 'order-one', renew: true, paymentId: 'UNTRUSTED-QUERY' });
  expect(header().title).toBe('Membership renewed');
  expect(line('Plan')).toBe('Business Annual'); expect(line('Payment reference')).toBe('BANK-REFERENCE');
  expect(line('Paid on')).toBeTruthy();
  await act(async () => tree!.unmount()); tree = null;
  mockStatus.paidAt = null;
  await mount(PaymentResultScreen, { orderId: 'order-two' });
  expect(line('Paid on')).toBeUndefined();
});

test.each(['paid', 'failed'])('company %s result keeps company context and never fetches membership profile', async status => {
  mockStatus = { ...mockStatus, status, orderType: 'company_listing', companyId: 'company-one' };
  await mount(PaymentResultScreen, { orderId: 'order-one', orderType: 'company_listing', companyId: 'company-one' });
  expect((api.get as jest.Mock).mock.calls.some(([url]) => String(url).includes('my-profile'))).toBe(false);
  if (status === 'failed') {
    await act(async () => button('Try again').props.onPress());
    expect(navigation.replace).toHaveBeenCalledWith('PaymentCheckout', expect.objectContaining({ orderType: 'company_listing', companyId: 'company-one' }));
  }
  await act(async () => { await button('Company settings').props.onPress(); });
  expect(mockSelectCompany).toHaveBeenCalledWith('company-one');
  expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'MemberMain' }, { name: 'Settings' }] });
});

test('a failed URL with a pending server order stays pending, preserves recovery and offers no new charge', async () => {
  mockStatus.status = 'created'; mockPrivate.status = 'created';
  await setPendingPayment({ orderType: 'company_listing', companyId: 'company-one', orderId: 'order-one', paymentUrl: 'https://gateway.test/pay' });
  await mount(PaymentResultScreen, { orderId: 'order-one', orderType: 'company_listing', paymentStatus: 'failed' });
  await polls(24);
  expect(header().outcome).toBe('pending');
  expect(await getPendingPayment()).toMatchObject({ orderId: 'order-one' });
  expect(button('Try again')).toBeUndefined();
  await act(async () => button('Return to payment page').props.onPress());
  expect(navigation.replace).toHaveBeenCalledWith('PaymentCheckout', expect.objectContaining({ resumeOrderId: 'order-one', companyId: 'company-one' }));
});

test('pending event payment returns through the booking hold check instead of reopening checkout directly', async () => {
  mockStatus = { ...mockStatus, status: 'created', orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-one' };
  mockPrivate = { ...mockStatus };
  await setPendingPayment({ orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-one', orderId: 'order-one', paymentUrl: 'https://gateway.test/pay' });
  await mount(PaymentResultScreen, { orderId: 'order-one', orderType: 'event_booking' });
  await polls(24);
  expect(header().outcome).toBe('pending');
  expect(button('Return to payment page')).toBeUndefined();
  expect(button('Try again')).toBeUndefined();
  await act(async () => button('View booking').props.onPress());
  expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'MemberMain' }, { name: 'EventBooking', params: { eventId: 'event-one', ref: 'BOOK-1' } }] });
  expect(api.post).not.toHaveBeenCalled();
});

test('failed membership retry retains application, upgrade and business year instead of navigating back to lost checkout', async () => {
  mockStatus.status = 'failed';
  await setPendingPayment({ orderType: 'membership', orderId: 'order-one', planId: 'annual', applicationId: 'application-one', upgrade: true, commencementYear: '2020' });
  await mount(PaymentResultScreen, { orderId: 'order-one' });
  expect(await getPendingPayment()).toBeNull();
  await act(async () => button('Try again').props.onPress());
  expect(navigation.replace).toHaveBeenCalledWith('PaymentCheckout', expect.objectContaining({ planId: 'annual', applicationId: 'application-one', upgrade: true, commencementYear: '2020' }));
});

test('late response for an older order cannot replace the new order receipt', async () => {
  let resolveOld!: (value: any) => void;
  mockDeferred = url => url.endsWith('old') ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ data: { data: { ...mockStatus, orderId: 'new' } } });
  await mount(PaymentResultScreen, { orderId: 'old' });
  await act(async () => { tree!.update(<PaymentResultScreen navigation={navigation} route={{ params: { orderId: 'new' } }} />); await flush(); });
  await act(async () => { resolveOld({ data: { data: { ...mockStatus, status: 'failed', orderId: 'old' } } }); await flush(); });
  expect(header().outcome).toBe('success'); expect(line('Order')).toBe('new');
});

test('guest event success opens its verified booking above the public home', async () => {
  mockSignedIn = false; mockStatus = { ...mockStatus, orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-one' };
  await mount(PaymentResultScreen, { orderId: 'order-one', orderType: 'event_booking' });
  await act(async () => button('View your ticket').props.onPress());
  expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'PublicExplore' }, { name: 'EventBooking', params: { eventId: 'event-one', ref: 'BOOK-1' } }] });
});

test.each(['member', 'super_admin', 'attendance_admin', null])('event payment returns use the stored account role: %s', async role => {
  mockStoredRole = role;
  mockStatus = { ...mockStatus, status: 'failed', orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-one' };
  await mount(PaymentResultScreen, { orderId: 'order-one', orderType: 'event_booking' });
  await act(async () => button('Back to events').props.onPress());
  expect(navigation.reset).toHaveBeenLastCalledWith(role === 'member'
    ? { index: 1, routes: [{ name: 'MemberMain' }, { name: 'MemberEvents' }] }
    : { index: 0, routes: [{ name: 'PublicExplore', params: { section: 'events' } }] });
  await act(async () => { button('View booking').props.onPress(); await flush(); });
  expect(navigation.reset).toHaveBeenLastCalledWith({ index: 1, routes: [{ name: role === 'member' ? 'MemberMain' : 'PublicExplore' }, { name: 'EventBooking', params: { eventId: 'event-one', ref: 'BOOK-1' } }] });
});

test.each(['member', 'super_admin', null])('mock booking checkout returns use the stored account role: %s', async role => {
  mockStoredRole = role; mockPaymentMode = 'mock';
  mockOrderReply = { gatewayPaymentId: 'test-payment', signature: 'test-signature' };
  await mount(PaymentCheckoutScreen, { orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-one' });
  const pay = tree!.root.findAllByType(GradientButton).find(item => String(item.props.label).startsWith('Pay'))!;
  await act(async () => pay.props.onPress());
  await act(async () => button('View your ticket').props.onPress());
  expect(navigation.reset).toHaveBeenLastCalledWith({ index: 1, routes: [{ name: role === 'member' ? 'MemberMain' : 'PublicExplore' }, { name: 'EventBooking', params: { eventId: 'event-one', ref: 'BOOK-1' } }] });
});

test('guest donor can pay without member API, double taps create only one gift and a WebView error has browser recovery', async () => {
  mockSignedIn = false; await mount(DonateScreen);
  const fields: Record<string, string> = { 'Full name': 'Test Donor', Email: 'donor@example.test', 'Mobile number': '9876543210', Address: 'Test street', 'City / town': 'Chennai', State: 'Tamil Nadu', 'PIN code': '600001' };
  await act(async () => tree!.root.findAllByType(PremiumInput).forEach(input => { if (fields[input.props.label]) input.props.onChangeText(fields[input.props.label]); }));
  const donate = tree!.root.findAllByType(GradientButton).find(item => String(item.props.label).startsWith('Donate '))!;
  await act(async () => { await Promise.all([donate.props.onPress(), donate.props.onPress()]); await flush(); });
  expect((api.post as jest.Mock).mock.calls.filter(([url]) => url === '/donations')).toHaveLength(1);
  expect(api.post).toHaveBeenCalledWith('/donations', expect.objectContaining({ client: 'app', amount: 1000 }));
  expect((api.get as jest.Mock).mock.calls.some(([url]) => String(url).includes('my-profile'))).toBe(false);
  expect(await getPendingPayment('donation')).toMatchObject({ orderId: 'gift-one', amount: 1000 });
  await act(async () => tree!.root.findByType(WebCheckout).props.onError());
  expect(button('Open payment page')).toBeDefined();
});

test('a reopened donation checks retained order before another submission', async () => {
  await setPendingPayment({ orderType: 'donation', orderId: 'gift-one', paymentUrl: 'https://gateway.test/gift' });
  await mount(DonateScreen);
  await act(async () => button('Check previous donation').props.onPress());
  expect(api.post).not.toHaveBeenCalled();
  expect(navigation.replace).toHaveBeenCalledWith('DonationResult', expect.objectContaining({ orderId: 'gift-one' }));
});

test('confirmed donation saves receipt and year certificate tokens, clears only that pending gift and opens its document', async () => {
  await setPendingPayment({ orderType: 'donation', orderId: 'gift-one' });
  await mount(DonationResultScreen, { orderId: 'gift-one', paymentStatus: 'failed' });
  expect(header().outcome).toBe('success');
  expect(await getPendingPayment('donation')).toBeNull();
  expect(await readDonationDocs()).toEqual([expect.objectContaining({ orderId: 'gift-one', receiptToken: 'receipt-token', statementToken: 'year-token' })]);
  await act(async () => button('80G receipt').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('DonationDocument', { kind: 'receipt', token: 'receipt-token' });
});

test('donation pending result never promises no debit or creates another gift', async () => {
  mockGift.status = 'pending';
  await setPendingPayment({ orderType: 'donation', orderId: 'gift-one', paymentUrl: 'https://gateway.test/gift' });
  await mount(DonationResultScreen, { orderId: 'gift-one', paymentStatus: 'failed' }); await polls(5);
  expect(header().outcome).toBe('pending'); expect(button('Try again')).toBeUndefined();
  expect(await getPendingPayment('donation')).toMatchObject({ orderId: 'gift-one' });
});

test('unavailable UPI app offers browser fallback while keeping checkout intact', async () => {
  const alert = jest.spyOn(Alert, 'alert'); jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No app'));
  await mount(PaymentCheckoutScreen, { orderType: 'membership', planId: 'annual' });
  const web = tree!.root.findAll(node => typeof node.props.onShouldStartLoadWithRequest === 'function')[0];
  await act(async () => { expect(web.props.onShouldStartLoadWithRequest({ url: 'upi://pay?pa=test' })).toBe(false); await flush(); });
  expect(alert).toHaveBeenCalledWith('Payment app unavailable', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open browser' })]));
  expect(await getPendingPayment()).toMatchObject({ orderId: 'order-one' });
});
