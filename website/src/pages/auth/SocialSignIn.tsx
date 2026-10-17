import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { completeSocialLogin, errorMessage, getMyProfile, getPaymentStatus, socialStartUrl, type LoginResult } from '@/services/activApi';
import AuthSplitLayout from '@/shared/components/AuthSplitLayout';
import SocialEmailVerification from './SocialEmailVerification';

/**
 * Where Google / Facebook / LinkedIn send a member back to.
 *
 * The server authenticates the provider subject and returns a 10-minute,
 * single-use handoff in the URL fragment. A first association may require an
 * email code; linked identities directly reopen their existing member session.
 * New accounts open the dashboard with application completion still required.
 */

const REASONS: Record<string, string> = {
    configuration: '{provider} rejected the sign-in configuration. Please contact ACTIV support to check the client credentials.',
    callback: 'The {provider} callback address does not match the address configured for this environment. Please contact ACTIV support.',
    permissions: '{provider} has not enabled the email and profile permissions needed for sign-in. Please use your email and password or contact ACTIV support.',
    cancelled: 'Sign-in was cancelled.',
    expired: 'That sign-in took too long or was started in another window. Please try again.',
    failed: 'We could not complete the sign-in with that provider. Please try again.',
    no_email: 'That account did not share a verified email address with us, so we cannot match it to an ACTIV account.',
    email_permission: 'Facebook did not give ACTIV permission to read your email. Try again and allow email access. Use the same email as your ACTIV account.',
    facebook_no_email: 'Facebook allowed email access but did not return an email address. Confirm your ACTIV login email in Facebook, then try again. You can also sign in with your ACTIV email and password.',
    admin: 'Administrators sign in with their email and password on the admin login page.',
    not_configured: 'That sign-in option is not available yet. Please use your email and password.',
    unavailable: 'That sign-in option is not available yet. Please use your email and password.',
};

const PROVIDER_NAME: Record<string, string> = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn' };

export default function SocialSignIn() {
    const navigate = useNavigate();
    const started = useRef(false);
    const mounted = useRef(true);
    const [error, setError] = useState('');
    const [facebookRecovery, setFacebookRecovery] = useState(false);
    const [noAccount, setNoAccount] = useState<{ email: string; name: string; provider: string } | null>(null);
    const [verification, setVerification] = useState<{ code: string; email: string } | null>(null);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const openDashboard = useCallback(async (result: LoginResult) => {
        if (!mounted.current) return;
        toast.success(`Welcome ${result.user?.fullName || 'back'}!`);
        const profile = await getMyProfile().catch(() => result.memberDetails);
        const status = String(profile?.membershipStatus || result.memberDetails?.membershipStatus || '').toLowerCase();
        const paid = profile?.renewal?.state !== 'expired' && (status === 'active' || status === 'completed'
            || (!status && (await getPaymentStatus().catch(() => 'pending')) === 'completed'));
        if (!mounted.current) return;
        navigate(paid ? '/payment/member-dashboard' : '/member/unpaid-dashboard', { replace: true });
    }, [navigate]);

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
            setFacebookRecovery(provider === 'facebook' && ['no_email', 'email_permission', 'facebook_no_email', 'cancelled', 'expired'].includes(reason));
            const message = provider === 'facebook' && reason === 'no_email'
                ? 'Facebook did not share your email. Try again and allow email access. If your Facebook account uses only a phone number, confirm your ACTIV email there or sign in with your ACTIV email and password.'
                : REASONS[reason] || REASONS.failed;
            setError(message.replace('{provider}', PROVIDER_NAME[provider] || 'Sign-in provider'));
            return;
        }

        (async () => {
            try {
                const result = await completeSocialLogin(code, undefined, () => mounted.current);
                if (!mounted.current) return;
                if ('requiresEmailVerification' in result) { setVerification({ code, email: result.email || '' }); return; }
                await openDashboard(result);
            } catch (err) {
                if (mounted.current) setError(errorMessage(err, REASONS.failed));
            }
        })();
    }, [navigate, openDashboard]);

    const registerHref = noAccount
        ? `/register?${new URLSearchParams({ email: noAccount.email, name: noAccount.name }).toString()}`
        : '/register';

    return (
        <AuthSplitLayout
            eyebrow="ACTIV member portal"
            headline={<>Welcome to<br />ACTIVian Platform!</>}
            quote='"Empowering Communities, Simplifying Lives"'
            lede="Use Google, Facebook or LinkedIn to open your ACTIV dashboard. New members complete their application after signing in."
            formEyebrow="Sign in"
            title={verification ? 'Confirm your email' : noAccount ? 'No account yet' : error ? 'Could not sign in' : 'Signing you in'}
            subtitle=""
            surface="card"
            assurance=""
        >
            {verification ? <>
                <SocialEmailVerification code={verification.code} initialEmail={verification.email} onComplete={openDashboard} />
                <Link to="/login" className="mt-5 block text-center text-base font-semibold text-slate-600">Back to sign in</Link>
            </> : noAccount ? (
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <UserPlus className="h-8 w-8" />
                    </div>
                    <p className="text-ui-caption leading-relaxed text-slate-600">
                        No ACTIV member account uses{' '}
                        <span className="break-all font-semibold text-slate-900">{noAccount.email || 'that email'}</span>
                        {PROVIDER_NAME[noAccount.provider] ? ` (from ${PROVIDER_NAME[noAccount.provider]})` : ''}.
                        Create one and it will be linked automatically next time.
                    </p>
                    <Link to={registerHref}
                        className="mt-7 flex h-[3.25rem] w-full items-center justify-center rounded-xl bg-blue-600 text-ui-caption
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
                    <p className="text-ui-caption leading-relaxed text-slate-600">{error}</p>
                    {facebookRecovery && <a href={socialStartUrl('facebook')}
                        className="mt-7 flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-ui-caption font-semibold text-white hover:bg-blue-700">
                        Try Facebook again
                    </a>}
                    <Link to="/login"
                        className={facebookRecovery
                            ? 'mt-4 flex min-h-[3.25rem] w-full items-center justify-center rounded-xl border border-blue-200 px-4 py-3 text-ui-caption font-semibold text-blue-700 hover:bg-blue-50'
                            : 'mt-7 flex h-[3.25rem] w-full items-center justify-center rounded-xl bg-blue-600 text-ui-caption font-semibold text-white transition-colors hover:bg-blue-700'}>
                        {facebookRecovery ? 'Use email and password' : 'Back to sign in'}
                    </Link>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-3 py-8 text-ui-caption text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Signing you in…
                </div>
            )}
        </AuthSplitLayout>
    );
}
