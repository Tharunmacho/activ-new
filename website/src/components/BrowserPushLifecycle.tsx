import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SESSION_EVENT, getAuthToken } from '@/services/api';
import { recordNotificationOpen } from '@/services/deliveryReportApi';
import { syncBrowserPush } from '@/services/browserPush';
import { recordVisitorOpen } from '@/services/visitorBrowserPush';

export default function BrowserPushLifecycle() {
  const location = useLocation();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let acknowledging = false;
    const acknowledge = async () => {
      const url = new URL(window.location.href);
      const visitorNotice = url.pathname === '/notifications' || url.searchParams.get('notifications') === 'open'
        ? url.searchParams.get('notice') : null;
      if (!acknowledging && url.searchParams.get('notificationSource') === 'push' && /^[a-f\d]{24}$/i.test(visitorNotice || '')) {
        acknowledging = true;
        try {
          await recordVisitorOpen(visitorNotice!, 'push');
          const current = new URL(window.location.href);
          if (current.searchParams.get('notice') === visitorNotice) { current.searchParams.delete('notificationSource'); window.history.replaceState(window.history.state, '', current); }
        } catch { /* Retry on the next focus if the device is offline. */ }
        finally { acknowledging = false; }
        return;
      }
      const id = url.searchParams.get('notificationId');
      if (acknowledging || !getAuthToken() || url.searchParams.get('notificationSource') !== 'push' || !/^[a-f\d]{24}$/i.test(id || '')) return;
      acknowledging = true;
      try {
        await recordNotificationOpen(id!, 'push');
        const current = new URL(window.location.href);
        if (current.searchParams.get('notificationId') === id) {
          current.searchParams.delete('notificationId'); current.searchParams.delete('notificationSource');
          window.history.replaceState(window.history.state, '', current);
        }
      } catch { /* A later focus may retry; a report must never prevent navigation. */ }
      finally { acknowledging = false; }
    };
    const sync = () => {
      clearTimeout(timer);
      // Login writes the token before the remaining account fields.
      timer = setTimeout(() => { void syncBrowserPush().catch(() => undefined); void acknowledge(); }, 150);
    };
    sync();
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);
    const interval = setInterval(sync, 60 * 60 * 1000);
    return () => {
      clearTimeout(timer); clearInterval(interval);
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
    };
  }, [location.pathname, location.search]);
  return null;
}
