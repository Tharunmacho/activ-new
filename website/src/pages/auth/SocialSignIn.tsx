import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { completeSocialLogin, errorMessage, getMyProfile, getPaymentStatus } from '@/services/activApi';
import AuthSplitLayout from '@/shared/components/AuthSplitLayout';

/**
 * Where Google / Facebook / LinkedIn send a member back to.
 *
 * The server has already verified the email with the provider; it hands over a
 * 60-second, single-use code in the URL FRAGMENT (never sent to any server log),
 * which this page trades for a normal member session. No email or password is
 * typed. Admins cannot sign in this way — the server refuses them.
 */

const REASONS: Record<string, string> = {
    configuration: '{provider} rejected the sign-in configuration. Please contact ACTIV support to check the client credentials.',
    callback: 'The {provider} callback address does not match the address configured for this environment. Please contact ACTIV support.',
    permissions: '{provider} has not enabled the email and profile permissions needed for sign-in. Please use your email and password or contact ACTIV support.',
    cancelled: 'Sign-in was cancelled.',
    expired: 'That sign-in took too long or was started in another window. Please try again.',
    failed: 'We could not complete the sign-in with that provider. Please try again.',
    no_email: 'That account did not share a verified email address with us, so we cannot match it to an ACTIV account.',
    admin: 'Administrators sign in with their email and password on the admin login page.',
    not_configured: 'That sign-in option is not available yet. Please use your email and password.',
    unavailable: 'That sign-in option is not available yet. Please use your email and password.',
};

const PROVIDER_NAME: Record<string, string> = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn' };

export default function SocialSignIn() {
    const navigate = useNavigate();
    const started = useRef(false);
    const [error, setError] = useState('');
    const [noAccount, setNoAccount] = useState<{ email: string; name: string; provider: string } | null>(null);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        // Take the code out of the address bar at once, so it is not left in history.
        try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }

        const code = hash.get('code') || '';
        const reason = hash.get('error') || '';
        const provider = hash.get('provider') || '';

        if (reason === 'no_account') {
            setNoAccount({ email: hash.get('email') || '', name: hash.get('name') || '', provider });
            return;
        }
        if (!code) {
            setError((REASONS[reason] || REASONS.failed).replace('{provider}', PROVIDER_NAME[provider] || 'Sign-in provider'));
            return;
        }

        (async () => {
            try {
                const result = await completeSocialLogin(code);
                toast.success(`Welcome ${result.user?.fullName || 'back'}!`);
                const profile = await getMyProfile().catch(() => result.memberDetails);
                const status = String(profile?.membershipStatus || result.memberDetails?.membershipStatus || '').toLowerCase();
                const paid = profile?.renewal?.state !== 'expired' && (status === 'active' || status === 'completed'
                    || (!status && (await getPaymentStatus().catch(() => 'pending')) === 'completed'));
                navigate(paid ? '/payment/member-dashboard' : '/member/unpaid-dashboard', { replace: true });
            } catch (err) {
                setError(errorMessage(err, REASONS.failed));
            }
        })();
    }, [navigate]);

    const registerHref = noAccount
        ? `/register?${new URLSearchParams({ email: noAccount.email, name: noAccount.name }).toString()}`
        : '/register';

    return (
        <AuthSplitLayout
            eyebrow="ACTIV member portal"
            headline={<>Welcome to<br />ACTIVian Platform!</>}
            quote='"Empowering Communities, Simplifying Lives"'
            lede="Signing in with Google, Facebook or LinkedIn opens the ACTIV member account registered with the same email address — no password to type."
            formEyebrow="Sign in"
            title={noAccount ? 'No account yet' : error ? 'Could not sign in' : 'Signing you in'}
            subtitle=""
            surface="card"
            assurance=""
        >
            {noAccount ? (
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserPlus className="h-8 w-8" />
                    </div>
                    <p className="text-[1.0625rem] leading-relaxed text-slate-600">
                        No ACTIV member account uses{' '}
                        <span className="break-all font-semibold text-slate-900">{noAccount.email || 'that email'}</span>
                        {PROVIDER_NAME[noAccount.provider] ? ` (from ${PROVIDER_NAME[noAccount.provider]})` : ''}.
                        Create one and it will be linked automatically next time.
                    </p>
                    <Link to={registerHref}
                        className="mt-7 flex h-[3.25rem] w-full items-center justify-center rounded-xl bg-blue-600 text-[1.0625rem]
                                   font-semibold text-white transition-colors hover:bg-blue-700">
                        Create an account
                    </Link>
                    <Link to="/login" className="mt-5 inline-block text-[1rem] font-semibold text-slate-500 hover:text-slate-900">
                        Back to sign in
                    </Link>
                </div>
            ) : error ? (
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <p className="text-[1.0625rem] leading-relaxed text-slate-600">{error}</p>
                    <Link to="/login"
                        className="mt-7 flex h-[3.25rem] w-full items-center justify-center rounded-xl bg-blue-600 text-[1.0625rem]
                                   font-semibold text-white transition-colors hover:bg-blue-700">
                        Back to sign in
                    </Link>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-3 py-8 text-[1.0625rem] text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Signing you in…
                </div>
            )}
        </AuthSplitLayout>
    );
}
