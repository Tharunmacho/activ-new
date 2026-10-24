import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Share, Text } from 'react-native';
import PaymentSuccessScreen from '../src/screens/payment/PaymentSuccessScreen';
import { getMyProfile, getOrder } from '../src/services/paymentFlow';
import { GradientButton, ReceiptLine, PremiumPage } from '../src/ui';
import { membershipReport } from '../src/screens/admin/super/membershipReport';

jest.mock('../src/services/paymentFlow', () => ({ getMyProfile: jest.fn(), getOrder: jest.fn() }));
jest.mock('../src/services/memberApi', () => ({ getMyApplications: jest.fn(async () => []), formatApplicationRef: () => '' }));

const profile = {
  fullName: 'Test Member', membershipNumber: 'ACTIV-2026-001', membershipStatus: 'active',
  membershipTier: 'platinum', membershipType: 'lifetime', memberType: 'business',
  membershipExpiresAt: '2099-01-01T00:00:00Z', paymentMethod: 'bank_transfer', paymentId: 'current-reference',
  lastPaymentAmount: 200000, paidMembership: { orderId: 'latest-order', planName: 'Platinum Lifetime' },
};
const annualReceipt = {
  orderId: 'student-order', orderType: 'membership', status: 'paid', amount: 10,
  planAudience: 'student', membershipType: 'annual', planName: 'Student',
  paymentMethod: 'cash', gatewayPaymentId: 'cash-receipt-001', paidAt: '2026-10-03T10:00:00Z',
};
const nav = { canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() };
let tree: any;
const mount = async (orderId?: string) => {
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<PaymentSuccessScreen navigation={nav} route={{ params: { orderId, planType: 'Untrusted navigation label' } }} />);
  });
};
const plainText = (value: any): string => typeof value === 'string' || typeof value === 'number' ? String(value) : Array.isArray(value) ? value.map(plainText).join('') : '';
const contents = () => tree.root.findAllByType(Text).map((node: any) => plainText(node.props.children)).join(' | ');
const line = (label: string) => tree.root.findAllByType(ReceiptLine).find((item: any) => item.props.label === label)?.props.value;
beforeEach(() => {
  jest.clearAllMocks();
  (getMyProfile as jest.Mock).mockResolvedValue(profile);
  (getOrder as jest.Mock).mockResolvedValue(annualReceipt);
});
afterEach(async () => { if (tree) await ReactTestRenderer.act(async () => { tree.unmount(); }); tree = null; jest.restoreAllMocks(); });

test('an old annual cash receipt keeps its own plan, payment method and amount after a Platinum upgrade', async () => {
  await mount('student-order');
  expect(line('Paid for')).toBe('Student · Annual');
  expect(line('Payment method')).toBe('Cash');
  expect(line('Valid until')).toBeUndefined();
  expect(contents()).not.toContain('2099');
  expect(contents()).not.toContain('Untrusted navigation label');
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await ReactTestRenderer.act(async () => { await tree.root.findAllByType(GradientButton).find((n: any) => n.props.label === 'Share receipt').props.onPress(); });
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Amount: ₹10') }));
  expect(share.mock.calls[0][0].message).toContain('Transaction: cash-receipt-001');
});

test('opening documents loads the latest paid order and preserves a zero-amount fee waiver', async () => {
  (getOrder as jest.Mock).mockResolvedValue({ ...annualReceipt, orderId: 'latest-order', amount: 0, paymentMethod: 'waived' });
  await mount();
  expect(getOrder).toHaveBeenCalledWith('latest-order');
  expect(line('Order')).toBe('latest-order');
  expect(line('Payment method')).toBe('Waived');
  expect(contents()).toContain('₹0');
  expect(contents()).not.toContain('₹2,00,000');
});

test.each(['denied', 'unpaid', 'event'])('an unavailable or unrelated order (%s) cannot become a receipt for the current membership', async kind => {
  if (kind === 'denied') (getOrder as jest.Mock).mockRejectedValue(new Error('Forbidden'));
  else (getOrder as jest.Mock).mockResolvedValue({ ...annualReceipt, ...(kind === 'unpaid' ? { status: 'created' } : { orderType: 'event_booking' }) });
  await mount('requested-order');
  expect(contents()).toContain('This receipt could not be loaded');
  expect(tree.root.findAllByType(ReceiptLine)).toHaveLength(0);
  expect(tree.root.findAllByType(GradientButton).some((b: any) => b.props.label === 'Share receipt')).toBe(false);
});

test('refreshing after a receipt becomes unavailable clears the previously shown paid receipt', async () => {
  await mount('student-order');
  expect(line('Order')).toBe('student-order');
  (getOrder as jest.Mock).mockRejectedValue(new Error('No longer available'));
  await ReactTestRenderer.act(async () => { await tree.root.findByType(PremiumPage).props.onRefresh(); });
  expect(contents()).toContain('This receipt could not be loaded');
  expect(tree.root.findAllByType(ReceiptLine)).toHaveLength(0);
});

test('payment reports separate order amount from money received and retain office confirmation details', () => {
  const csv = membershipReport('payments', [{ name: '=example', orderId: 'order', paymentId: 'receipt', amount: 500, status: 'created', manual: { byName: 'Super Admin', note: 'Awaiting cash' } }]);
  expect(csv).toContain('"Order amount","Amount received"');
  expect(csv).toContain('"500","0"');
  expect(csv).toContain('"Super Admin","Awaiting cash"');
  expect(csv).toContain('"\'=example"');
});

test('member reports include membership number, validity and confirmation as on the website', () => {
  const csv = membershipReport('members', [{ memberNumber: 'ACTIV-2026-001', lifetime: true, collected: 0, confirmation: 'Fee waived' }]);
  expect(csv).toContain('"Member number","Collected","Valid until","Confirmation"');
  expect(csv).toContain('"ACTIV-2026-001","0","Lifetime","Fee waived"');
});
