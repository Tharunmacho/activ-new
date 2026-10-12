import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isNativePublicApp, nativePublicActionPath, requestNativeMemberAction } from '../lib/nativePublicApp';

/** Public native browsing shares CMS pages, but account actions belong to the
 * native sign-in/member flow. Blocking before mounting also prevents private
 * screens or the guest checkout form making requests during an SPA transition. */
export default function NativePublicAppGate({ children }: { children: ReactNode }) {
  const enabled = useRef(isNativePublicApp()).current;
  const location = useLocation();
  const navigate = useNavigate();
  const action = enabled ? nativePublicActionPath(location.pathname) : null;
  useEffect(() => { if (action) requestNativeMemberAction(action); }, [action]);
  if (!action) return <>{children}</>;
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="max-w-md w-full rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
      <p className="font-bold tracking-widest text-blue-700">ACTIV</p>
      <h1 className="mt-5 text-2xl font-bold text-slate-900">Continue in the ACTIV app</h1>
      <p className="mt-3 leading-relaxed text-slate-600">Sign in or create your member account to take part. You can keep exploring without signing in.</p>
      <button onClick={() => requestNativeMemberAction(action)} className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white">Continue to sign in</button>
      <button onClick={() => navigate(-1)} className="mt-3 w-full rounded-xl px-5 py-3 font-bold text-blue-700">Back to browsing</button>
    </div>
  </main>;
}
