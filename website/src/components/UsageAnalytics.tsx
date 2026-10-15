import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsConfigured, analyticsConsent, analyticsPage, setAnalyticsConsent } from '@/lib/analytics';
export default function UsageAnalytics() {
  const location = useLocation();
  const [consent, setConsent] = useState(analyticsConsent);
  const [open, setOpen] = useState(!consent);
  useEffect(() => { analyticsPage(location.pathname); }, [location.pathname, consent]);
  if (!analyticsConfigured()) return null;
  const choose = (value: boolean) => { setAnalyticsConsent(value); setConsent(value ? 'granted' : 'denied'); setOpen(false); };
  return open ? <aside aria-label="Usage analytics preferences" className="fixed bottom-4 left-4 right-4 z-[90] max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:right-auto">
    <p className="font-bold text-slate-900">Help us improve ACTIV</p><p className="mt-2 text-sm leading-6 text-slate-600">Allow usage analytics to understand which pages are useful? Names, contact details, and message contents are excluded.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button className="min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white" onClick={() => choose(true)}>Allow analytics</button><button className="min-h-11 rounded-xl border px-4 py-2 font-semibold" onClick={() => choose(false)}>No thanks</button></div>
  </aside> : <button className="fixed bottom-1 left-1 z-40 rounded bg-white/95 px-2 py-1 text-xs text-slate-600 shadow-sm print:hidden" onClick={() => setOpen(true)}>Privacy preferences</button>;
}
