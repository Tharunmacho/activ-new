import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

export function RouteLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-10 text-[20px]">
      <div className="max-w-lg w-full text-center">
        <div role="status" aria-live="polite">
          <div aria-hidden="true" className="mx-auto mb-4 w-8 h-8 border-2 border-gray-200 border-t-[#1c2e68] rounded-full animate-spin" />
          <p className="font-semibold text-[#1c2e68]">Loading your page…</p>
          {slow && <p className="mt-3 text-slate-600">This is taking longer than usual. Check your connection, then reload to try again.</p>}
        </div>
        {slow && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()}
              className="min-h-[44px] rounded-full bg-[#1c2e68] px-6 py-2.5 font-semibold text-white">Reload page</button>
            <a href="/" className="min-h-[44px] rounded-full border border-gray-200 px-6 py-2.5 font-semibold text-[#1c2e68]">Go home</a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Navigation gets a fresh boundary; a failed lazy import can be retried by reloading. */
export default function RouteRecovery({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname} resetKey={location.search} label="Page">
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}
