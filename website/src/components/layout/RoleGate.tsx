import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, LogOut } from 'lucide-react';
import { clearSession, SESSION_EVENT } from '@/services/api';
import { homeForSession, roleLabel, sessionKind, storedRole, type SessionKind } from '@/lib/session';

/**
 * WHOSE AREA IS THIS — a guard for a whole group of routes.
 *
 * The website had none. Every member and admin page rendered for whoever held
 * the browser's one session, so an admin who opened a member page saw a
 * member dashboard captioned with the ADMIN's name, and a member could open an
 * admin portal and watch it fail call by call. Wrapping the route groups in
 * App.tsx here settles it in one place, including for pages not written yet.
 *
 *   area="member"  guest -> /login;   admin -> "you are signed in as an admin"
 *   area="admin"   guest -> /admin/login;   member -> the member dashboard
 *
 * An admin on a member page is TOLD rather than silently bounced: they came
 * there for a reason (a link, a booking, "see application"), and the honest
 * answer is which account is signed in and the two ways forward.
 *
 * Re-reads on every session change — this tab's (`SESSION_EVENT`) and other
 * tabs' (`storage`) — so signing in elsewhere cannot leave a page standing
 * under the wrong account.
 */
type Area = 'member' | 'admin';

const useSessionKind = (): SessionKind => {
    const [kind, setKind] = useState<SessionKind>(sessionKind);
    useEffect(() => {
        const update = () => setKind(sessionKind());
        window.addEventListener(SESSION_EVENT, update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener(SESSION_EVENT, update);
            window.removeEventListener('storage', update);
        };
    }, []);
    return kind;
};

export default function RoleGate({ area, roles }: {
    area: Area;
    /**
     * For an admin portal: the roles that belong to it. A different admin role is
     * sent to their OWN portal — a State Admin who opened `/district-admin/…` saw
     * their statewide queue under a "District Admin" label, which read as one
     * district's admin seeing other districts. `super_admin` may open any portal.
     */
    roles?: string[];
}) {
    const kind = useSessionKind();
    const location = useLocation();
    const here = `${location.pathname}${location.search}`;

    if (kind === 'guest') {
        return <Navigate to={area === 'admin' ? '/admin/login' : '/login'} replace state={{ from: here }} />;
    }
    if (area === 'admin' && kind === 'member') {
        return <Navigate to={homeForSession()} replace />;
    }
    if (area === 'admin' && roles && roles.length) {
        const role = storedRole();
        if (role !== 'super_admin' && !roles.includes(role)) {
            return <Navigate to={homeForSession()} replace />;
        }
    }
    if (area === 'member' && kind === 'admin') {
        return <SignedInAsAdmin from={here} />;
    }
    return <Outlet />;
}

function SignedInAsAdmin({ from }: { from: string }) {
    const navigate = useNavigate();
    const who = roleLabel();

    return (
        <div className="min-h-screen bg-[#eef1f8] flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-[0_10px_28px_-6px_rgba(16,24,40,0.18)]">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <h1 className="font-display text-[1.5rem] sm:text-[1.75rem] font-bold text-slate-900">
                    You are signed in as {who}
                </h1>
                <p className="mt-2 text-ui-caption leading-relaxed text-slate-600">
                    This page belongs to a member account. To see a member&apos;s dashboard, sign out and
                    sign in with that member&apos;s own email.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(homeForSession(), { replace: true })}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5
                                   text-ui-caption font-semibold text-white"
                    >
                        <LayoutDashboard className="h-4 w-4" /> Go to my {who} dashboard
                    </button>
                    <button
                        type="button"
                        onClick={() => { clearSession(); navigate('/login', { replace: true, state: { from } }); }}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200
                                   px-5 text-ui-caption font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <LogOut className="h-4 w-4" /> Sign out and sign in as a member
                    </button>
                </div>
            </div>
        </div>
    );
}
