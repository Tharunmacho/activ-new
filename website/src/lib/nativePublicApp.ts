export const nativePublicActionPath = (value: string): string | null => {
  let path: string;
  try {
    const url = new URL(value, 'https://activ.org.in');
    if (!['https://activ.org.in', 'https://www.activ.org.in'].includes(url.origin)) return null;
    path = decodeURIComponent(url.pathname);
  } catch { return null; }
  if (/[\u0000-\u001f\\]/.test(path)) return null;
  if (/^\/events\/[a-z0-9_-]+\/book\/?$/i.test(path) ||
      /^\/(?:login|register|admin|cms|super-admin|state-admin|district-admin|block-admin|events-admin|member|member-dashboard|business|payment|checkout|auth|donate|donations|complete-membership)(?:\/|$)/i.test(path) ||
      /^\/membership\/(?:apply|join|checkout)(?:\/|$)/i.test(path)) return path;
  return null;
};
export const isNativePublicApp = () => {
  const nativeWindow = window as typeof window & { ReactNativeWebView?: { postMessage: (message: string) => void }; __ACTIV_PUBLIC_APP__?: boolean };
  return !!nativeWindow.ReactNativeWebView?.postMessage && (nativeWindow.__ACTIV_PUBLIC_APP__ === true || new URLSearchParams(window.location.search).get('activApp') === 'public');
};
export const requestNativeMemberAction = (path: string) => {
  const safePath = nativePublicActionPath(path);
  const nativeWindow = window as typeof window & { ReactNativeWebView?: { postMessage: (message: string) => void } };
  if (safePath) nativeWindow.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ACTIV_MEMBER_ACTION', path: safePath }));
};
