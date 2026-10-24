import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert, AppState, NativeModules, Platform, View } from 'react-native';
import { checkoutLinkKind, openPaymentApp } from '../src/services/paymentAppLink';
import { WebCheckout } from '../src/screens/payment/paymentUi';
import { usePaymentResumeCheck } from '../src/screens/payment/usePaymentResumeCheck';

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); delete NativeModules.PaymentApp; });
test('custom payment links reach the native launcher with the exact gateway URI', async () => {
  Platform.OS = 'android';
  const open = jest.fn(async () => true); NativeModules.PaymentApp = { open };
  for (const uri of ['upi://pay?pa=test%40bank&tr=fixture&am=10',
    'intent://pay?pa=test%40bank#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end',
    'phonepe://pay?fixture=1', 'paytmmp://pay?fixture=1', 'bankapp://checkout?fixture=1']) {
    expect(checkoutLinkKind(uri)).toBe('app'); await openPaymentApp(uri); expect(open).toHaveBeenLastCalledWith(uri);
  }
  for (const uri of ['file:///data/private', 'javascript:alert(1)', 'content://private', 'data:text/html,x', 'activ://auth/social', 'http://bank.test', 'upi://pay\n']) {
    expect(checkoutLinkKind(uri)).toBe('blocked'); await expect(openPaymentApp(uri)).rejects.toThrow();
  }
  expect(open).toHaveBeenCalledTimes(5);
});

test('WebView hands payment links to our handler and keeps card/bank HTTPS pages in checkout', async () => {
  const open = jest.fn(async () => true); NativeModules.PaymentApp = { open };
  const browser = jest.fn(); const returned = jest.fn(); const alert = jest.spyOn(Alert, 'alert');
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<WebCheckout WebViewComp={View} url="https://gateway.test/pay"
    isReturn={u => u.includes('/payment-success') ? { orderId: 'ord-one' } : null}
    onReturn={returned} onClose={() => {}} onOpenBrowser={browser} />); });
  const web = () => tree.root.findAllByType(View).find(node => node.props.source?.uri)!;
  expect(web().props.originWhitelist).toEqual(['*']);
  expect(web().props.setSupportMultipleWindows).toBe(false);
  expect(web().props.onShouldStartLoadWithRequest({ url: 'https://bank.test/3ds' })).toBe(true);
  await act(async () => { expect(web().props.onShouldStartLoadWithRequest({ url: 'upi://pay?fixture=1' })).toBe(false); });
  expect(open).toHaveBeenCalledWith('upi://pay?fixture=1');
  open.mockRejectedValueOnce(new Error('Not installed'));
  await act(async () => { web().props.onShouldStartLoadWithRequest({ url: 'phonepe://pay?fixture=1' }); });
  expect(alert).toHaveBeenCalledWith('Payment app unavailable', expect.any(String), expect.any(Array));
  expect(browser).not.toHaveBeenCalled();
  web().props.onShouldStartLoadWithRequest({ url: 'https://activ.org.in/payment-success?orderId=ord-one' });
  expect(returned).toHaveBeenCalledWith({ orderId: 'ord-one' });
  await act(async () => tree.unmount());
});

test('return from a payment app polls delayed confirmation and stops on unmount', async () => {
  jest.useFakeTimers();
  let changed!: (state: string) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, cb: any) => { changed = cb; return { remove: jest.fn() }; });
  const check = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const confirmed = jest.fn();
  const Probe = () => { usePaymentResumeCheck(true, check, confirmed); return null; };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => { tree = renderer.create(<Probe />); });
  expect(check).not.toHaveBeenCalled();
  await act(async () => { changed('background'); changed('active'); });
  expect(confirmed).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(confirmed).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  jest.advanceTimersByTime(60000); expect(check).toHaveBeenCalledTimes(2);
});
