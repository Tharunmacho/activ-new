import { useEffect } from 'react';
import { Linking } from 'react-native';
import { navigationRef } from './navigationRef';
import { RootStackParamList } from '../types';
import { resolvePaymentLink, type PaymentLinkTarget } from './paymentLinks';

/**
 * ============================================================================
 * DEEP LINKS — the app's `activ://` scheme
 * ============================================================================
 *
 *   activ://auth/social?code=…&provider=…      social sign-in hand-off (the
 *   activ://auth/social?error=…[&email&name]   server's /auth/oauth/:p/callback
 *                                               when started with ?client=app)
 *   activ://reset-password?token=…              member password reset
 *   activ://admin/reset-password?token=…        admin password reset
 *
 * The emailed reset link stays the website's https URL — unchanged. The app
 * does not claim that domain (that needs a file hosted on the website), so the
 * member can still paste the link or code into the Reset Password screen.
 *
 * Links that arrive before the navigator is ready are held and delivered from
 * `flushPendingDeepLink()`, which App.tsx calls in NavigationContainer.onReady.
 */

type Target =
  | PaymentLinkTarget
  | { name: 'SocialSignIn'; params: RootStackParamList['SocialSignIn'] }
  | { name: 'ResetPassword'; params: RootStackParamList['ResetPassword'] };

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent((value || '').replace(/\+/g, ' '));
  } catch {
    return value || '';
  }
};

/** `a=1&b=2` (query and fragment both) → a plain object. */
const readParams = (url: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const text = String(url || '');
  const q = text.indexOf('?');
  const h = text.indexOf('#');
  const parts: string[] = [];
  if (q >= 0) parts.push(text.slice(q + 1, h > q ? h : undefined));
  if (h >= 0) parts.push(text.slice(h + 1));
  parts.join('&').split('&').forEach((pair) => {
    if (!pair) return;
    const eq = pair.indexOf('=');
    const key = safeDecode(eq >= 0 ? pair.slice(0, eq) : pair);
    const value = safeDecode(eq >= 0 ? pair.slice(eq + 1) : '');
    if (key) out[key] = value;
  });
  return out;
};

/** The path of an activ:// or https:// URL, without query/fragment, no slashes at the ends. */
const readPath = (url: string): string => {
  const text = String(url || '');
  const noQuery = text.split(/[?#]/)[0] || '';
  const afterScheme = noQuery.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutHost = /^https?:\/\//i.test(noQuery) ? afterScheme.replace(/^[^/]*/, '') : afterScheme;
  return withoutHost.replace(/^\/+|\/+$/g, '').toLowerCase();
};

export const parseDeepLink = (url?: string | null): Target | null => {
  const text = String(url || '').trim();
  if (!text) return null;
  const path = readPath(text);
  const params = readParams(text);

  if (path === 'auth/social') {
    return {
      name: 'SocialSignIn',
      params: {
        code: params.code || '',
        error: params.error || '',
        provider: params.provider || '',
        email: params.email || '',
        name: params.name || '',
      },
    };
  }
  if (path === 'reset-password' || path === 'admin/reset-password') {
    return {
      name: 'ResetPassword',
      params: { token: params.token || '', portal: path.startsWith('admin') ? 'admin' : 'member' },
    };
  }
  return null;
};

let pending: Target | null = null;

const deliver = (target: Target | null) => {
  if (!target) return;
  try {
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate(target.name, target.params);
      pending = null;
    } else {
      pending = target;
    }
  } catch (err) {
    console.warn('Deep link safely caught:', err);
  }
};

/** Deliver a link that arrived before the navigator was ready. */
export const flushPendingDeepLink = () => {
  if (pending) deliver(pending);
};

let linkGeneration = 0;
/** Resolve account-scoped payment returns before delivering them to navigation. */
export const handleDeepLink = async (url?: string | null) => {
  const generation = ++linkGeneration;
  const target = parseDeepLink(url) || await resolvePaymentLink(url);
  if (generation === linkGeneration) deliver(target);
};

/** Listen for links while the app runs, and read the one that launched it. */
export const useDeepLinks = () => {
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      if (typeof Linking?.getInitialURL === 'function') {
        Linking.getInitialURL()
          .then(handleDeepLink)
          .catch((err) => console.warn('Initial URL safely caught:', err));
      }
      if (typeof Linking?.addEventListener === 'function') {
        sub = Linking.addEventListener('url', (event) => {
          void handleDeepLink(event?.url).catch(() => {});
        });
      }
    } catch (err) {
      console.warn('Deep link setup safely caught:', err);
    }
    return () => {
      try {
        sub?.remove();
      } catch {
        /* nothing to clean up */
      }
    };
  }, []);
};
