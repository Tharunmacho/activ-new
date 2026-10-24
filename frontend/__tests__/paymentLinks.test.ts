jest.mock('../src/services/paymentRecovery', () => ({ getPendingPayment: jest.fn() }));
jest.mock('../src/navigation/navigationRef', () => ({ navigationRef: { isReady: jest.fn(), navigate: jest.fn() } }));
import { getPendingPayment } from '../src/services/paymentRecovery';
import { parsePaymentLink, resolvePaymentLink } from '../src/navigation/paymentLinks';
import { flushPendingDeepLink, handleDeepLink } from '../src/navigation/deepLinks';
import { navigationRef } from '../src/navigation/navigationRef';

beforeEach(() => {
  jest.clearAllMocks();
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
});

test('recognises only ACTIV payment returns and rejects ambiguous callback data', () => {
  expect(parsePaymentLink('activ://payment-success?orderId=ord_one&payment_id=MOJO-1&payment_status=Credit')).toMatchObject({ kind: 'payment', orderId: 'ord_one' });
  expect(parsePaymentLink('https://activ.org.in/donate/thank-you?orderId=ord_gift')).toMatchObject({ kind: 'donation' });
  for (const url of [
    'https://evil.test/payment-success?orderId=ord_one',
    'https://activ.org.in.evil.test/payment-success?orderId=ord_one',
    'https://activ.org.in@evil.test/payment-success?orderId=ord_one',
    'http://activ.org.in/payment-success?orderId=ord_one',
    'activ://payment-success?orderId=ord_one&orderId=ord_two',
    'activ://payment-success?orderId=%ZZ',
    'activ://payment-success?orderId=ord_one%00',
    'activ://payment-success?orderId=ord_one&payment_id=%00',
    'activ://payment-success/extra?orderId=ord_one',
    'activ://auth/social?code=example',
  ]) expect(parsePaymentLink(url)).toBeNull();
});

test('matches the retained order and preserves booking/retry context without claiming success', async () => {
  (getPendingPayment as jest.Mock).mockResolvedValue({ orderId: 'ord_one', orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-1' });
  const target = await resolvePaymentLink('activ://payment-success?orderId=ord_one&payment_status=Credit');
  expect(getPendingPayment).toHaveBeenCalledWith('payment', 'ord_one');
  expect(target).toMatchObject({ name: 'PaymentResult', params: { orderId: 'ord_one', orderType: 'event_booking', bookingRef: 'BOOK-1', eventId: 'event-1', paymentStatus: 'Credit' } });
  expect(target?.name).not.toBe('PaymentSuccess');
  (getPendingPayment as jest.Mock).mockResolvedValue(null);
  expect(await resolvePaymentLink('activ://payment-success?orderId=ord_other')).toBeNull();
});

test('donations use their own saved order and cannot consume membership returns', async () => {
  (getPendingPayment as jest.Mock).mockResolvedValue({ orderId: 'ord_gift', orderType: 'donation' });
  expect(await resolvePaymentLink('activ://donate/thank-you?orderId=ord_gift')).toEqual({
    name: 'DonationResult', params: { orderId: 'ord_gift', paymentId: '', paymentStatus: '' },
  });
  expect(getPendingPayment).toHaveBeenCalledWith('donation', 'ord_gift');
  expect(await resolvePaymentLink('activ://payment-success?orderId=ord_gift')).toBeNull();
});

test('warm returns navigate once and cold returns wait for the root navigator', async () => {
  (getPendingPayment as jest.Mock).mockResolvedValue({ orderId: 'ord_one', orderType: 'company_listing', companyId: 'company-one' });
  await handleDeepLink('activ://payment-success?orderId=ord_one');
  expect(navigationRef.navigate).toHaveBeenCalledWith('PaymentResult', expect.objectContaining({ companyId: 'company-one' }));
  (navigationRef.navigate as jest.Mock).mockClear();
  (navigationRef.isReady as jest.Mock).mockReturnValue(false);
  await handleDeepLink('activ://payment-success?orderId=ord_one');
  expect(navigationRef.navigate).not.toHaveBeenCalled();
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
  flushPendingDeepLink(); flushPendingDeepLink();
  expect(navigationRef.navigate).toHaveBeenCalledTimes(1);
});
