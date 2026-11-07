import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { ACTIV_ANDROID_STORE_URL, ANDROID_ENTRY_DISMISSED, androidAppIntent, isAndroidBrowser } from '@/lib/androidAppEntry';
import './androidAppEntry.css';

const AppEntryContext = createContext(false);
export const useHideFloatingAppPromotion = () => useContext(AppEntryContext);
const wasDismissed = () => { try { return sessionStorage.getItem(ANDROID_ENTRY_DISMISSED) === 'true'; } catch { return false; } };

/** User-initiated app entry; never redirects or probes whether an app is installed. */
export default function AndroidAppEntry({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const native = typeof window !== 'undefined' && (
    !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView
    || new URLSearchParams(window.location.search).has('activApp')
  );
  const android = typeof navigator !== 'undefined' && isAndroidBrowser(navigator.userAgent);
  const intent = android && !native ? androidAppIntent(location.pathname + location.search + location.hash) : null;
  const show = !!intent && !dismissed;
  const continueOnWebsite = () => {
    setDismissed(true);
    try { sessionStorage.setItem(ANDROID_ENTRY_DISMISSED, 'true'); } catch { /* Keep the choice for this page lifetime. */ }
  };
  // Android entry is owned by this allowlisted banner, including its dismissal
  // and excluded flows. Other browsers keep their existing download/QR experience.
  return <AppEntryContext.Provider value={android}>
    {show && <aside className="activ-android-entry" aria-label="ACTIV Android app">
      <div className="activ-android-entry__inner">
        <div className="activ-android-entry__copy">
          <span className="activ-android-entry__icon"><Smartphone size={23} aria-hidden="true" /></span>
          <div><strong>ACTIV, wherever you go</strong><p>Events, membership and updates in the app.</p></div>
        </div>
        <div className="activ-android-entry__actions">
          <a className="activ-android-entry__primary" href={intent}>Open or install ACTIV</a>
          <button type="button" className="activ-android-entry__secondary" onClick={continueOnWebsite}>Continue on website</button>
          <a className="activ-android-entry__store" href={ACTIV_ANDROID_STORE_URL} target="_blank" rel="noopener noreferrer">Get it on Google Play</a>
        </div>
      </div>
    </aside>}
    {children}
  </AppEntryContext.Provider>;
}
