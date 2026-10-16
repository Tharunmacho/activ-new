import { useEffect } from 'react';
import { SESSION_EVENT } from '@/services/api';
import { syncBrowserPush } from '@/services/browserPush';

export default function BrowserPushLifecycle() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const sync = () => {
      clearTimeout(timer);
      // Login writes the token before the remaining account fields.
      timer = setTimeout(() => { void syncBrowserPush().catch(() => undefined); }, 150);
    };
    sync();
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    const interval = setInterval(sync, 60 * 60 * 1000);
    return () => {
      clearTimeout(timer); clearInterval(interval);
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return null;
}
