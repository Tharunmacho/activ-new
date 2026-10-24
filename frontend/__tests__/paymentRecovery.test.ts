import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData } from '../src/services/api';
import { clearPendingPayment, findPendingCheckout, getPaymentStorageOwner, getPendingPayment, setPendingPayment } from '../src/services/paymentRecovery';

jest.mock('../src/services/api', () => ({ getUserData: jest.fn() }));
const context = { orderType: 'membership' as const, planId: 'business-plan', renew: true, applicationId: 'application-one' };

beforeEach(async () => {
  await AsyncStorage.clear();
  (getUserData as jest.Mock).mockResolvedValue({ _id: 'member-one' });
});

test('pending payments survive reopening, remain account scoped and contain no donor or banking data', async () => {
  await setPendingPayment({ ...context, orderId: 'order-one', paymentUrl: 'https://gateway.test/order-one', amount: 5000, cardNumber: 'not-retained', donorName: 'not-retained' } as any);
  expect(await findPendingCheckout(context)).toMatchObject({ orderId: 'order-one', amount: 5000 });
  const stored = (await AsyncStorage.multiGet(await AsyncStorage.getAllKeys())).map(([, value]) => value).join('');
  expect(stored).not.toContain('not-retained');
  (getUserData as jest.Mock).mockResolvedValue({ _id: 'member-two' });
  expect(await getPendingPayment()).toBeNull();
  (getUserData as jest.Mock).mockResolvedValue(null);
  expect(await getPendingPayment()).toBeNull();
  (getUserData as jest.Mock).mockResolvedValue({ _id: 'member-one' });
  expect(await getPendingPayment('payment', 'order-one')).toMatchObject({ orderId: 'order-one' });
});

test('clearing an old result preserves newer checkout and donations, including concurrent updates', async () => {
  await setPendingPayment({ ...context, orderId: 'old' });
  await Promise.all([
    setPendingPayment({ orderType: 'company_listing', companyId: 'company-two', orderId: 'new' }),
    clearPendingPayment('old'),
    setPendingPayment({ orderType: 'donation', orderId: 'gift' }),
  ]);
  expect(await getPendingPayment()).toMatchObject({ orderId: 'new' });
  expect(await getPendingPayment('payment', 'old')).toBeNull();
  expect(await getPendingPayment('donation')).toMatchObject({ orderId: 'gift' });
});

test('a request completing after account switch is retained only for its original owner', async () => {
  const owner = await getPaymentStorageOwner();
  (getUserData as jest.Mock).mockResolvedValue({ _id: 'member-two' });
  await setPendingPayment({ ...context, orderId: 'late-order' }, owner);
  expect(await getPendingPayment()).toBeNull();
  (getUserData as jest.Mock).mockResolvedValue({ _id: 'member-one' });
  expect(await getPendingPayment()).toMatchObject({ orderId: 'late-order' });
});

test('recovery matches exact purchase context, including renewals, upgrades and companies', async () => {
  await setPendingPayment({ ...context, orderId: 'renewal' });
  await setPendingPayment({ orderType: 'company_listing', companyId: 'company-one', orderId: 'listing' });
  expect(await findPendingCheckout({ ...context, renew: false })).toBeNull();
  expect(await findPendingCheckout({ ...context, upgrade: true })).toBeNull();
  expect(await findPendingCheckout({ ...context, applicationId: 'application-two' })).toBeNull();
  expect(await findPendingCheckout({ orderType: 'company_listing', companyId: 'company-two' })).toBeNull();
  expect(await findPendingCheckout(context)).toMatchObject({ orderId: 'renewal' });
});

test('unavailable or corrupt storage cannot crash result handling', async () => {
  await AsyncStorage.setItem('@activ_pending_payments_v1:user:member-one:payment', 'invalid');
  expect(await getPendingPayment()).toBeNull();
  await expect(clearPendingPayment('missing')).resolves.toBeUndefined();
});
