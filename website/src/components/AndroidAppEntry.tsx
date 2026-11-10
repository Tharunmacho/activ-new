import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Smartphone, X } from 'lucide-react';
import { ACTIV_ANDROID_STORE_URL, ANDROID_ENTRY_DISMISSED, androidAppTarget, isAndroidBrowser } from '@/lib/androidAppEntry';
import './androidAppEntry.css';

const AppEntryContext = createContext(false);
export const useHideFloatingAppPromotion = () => useContext(AppEntryContext);
const wasDismissed = () => { try { return sessionStorage.getItem(ANDROID_ENTRY_DISMISSED) === 'true'; } catch { return false; } };

/** Dismissible install notice; never redirects or probes whether an app is installed. */
export default function AndroidAppEntry({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const native = typeof window !== 'undefined' && (
    !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView
    || new URLSearchParams(window.location.search).has('activApp')
  );
  const android = typeof navigator !== 'undefined' && isAndroidBrowser(navigator.userAgent);
  const eligibleRoute = android && !native ? androidAppTarget(location.pathname + location.search + location.hash) : null;
  const show = !!eligibleRoute && !dismissed;
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(ANDROID_ENTRY_DISMISSED, 'true'); } catch { /* Keep the choice for this page lifetime. */ }
  };
  // Android promotion is owned by this allowlisted notice, including its dismissal
  // and excluded flows. Other browsers keep their existing download/QR experience.
  return <AppEntryContext.Provider value={android}>
    {show && <aside className="activ-android-entry" aria-label="ACTIV Android app">
      <div className="activ-android-entry__inner">
        <div className="activ-android-entry__copy">
          <span className="activ-android-entry__icon"><Smartphone size={20} aria-hidden="true" /></span>
          <div><strong>ACTIV</strong><p>Android app</p></div>
        </div>
        <div className="activ-android-entry__actions">
          <a className="activ-android-entry__primary" href={ACTIV_ANDROID_STORE_URL} target="_blank" rel="noopener noreferrer">Install ACTIV</a>
          <button type="button" className="activ-android-entry__dismiss" onClick={dismiss} aria-label="Dismiss app install notice"><X size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </aside>}
    {children}
  </AppEntryContext.Provider>;
}
