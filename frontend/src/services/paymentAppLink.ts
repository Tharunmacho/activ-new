import { Linking, NativeModules, Platform } from 'react-native';

// WebView's default whitelist bypasses our callback for custom schemes. All
// navigations reach this classifier; only web pages remain inside checkout.
const blocked = /^(?:javascript|data|file|content|blob|about|android-app|market|activ):/i;
export function checkoutLinkKind(value: string): 'web' | 'app' | 'blocked' {
  if (!value || value.length > 16384 || /[\u0000-\u0020\\]/.test(value)) return 'blocked';
  if (/^https:\/\//i.test(value) || value === 'about:blank') return 'web';
  if (blocked.test(value) || /^http:/i.test(value)) return 'blocked';
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? 'app' : 'blocked';
}

/** Preserve the gateway's URI/amount/reference and the selected Android app. */
export async function openPaymentApp(value: string): Promise<void> {
  if (checkoutLinkKind(value) !== 'app') throw new Error('Unsupported payment link');
  if (Platform.OS === 'android' && NativeModules.PaymentApp?.open) {
    await NativeModules.PaymentApp.open(value);
    return;
  }
  // iOS uses custom URL schemes; Android intent URIs need the native parser.
  if (/^intent:/i.test(value)) throw new Error('Update the app or use browser checkout');
  await Linking.openURL(value);
}
