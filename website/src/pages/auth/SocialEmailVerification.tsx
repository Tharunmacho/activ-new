import { useEffect, useRef, useState } from 'react';
import { completeSocialLogin, requestSocialEmailCode, errorMessage, type LoginResult } from '@/services/activApi';

export default function SocialEmailVerification({ code, initialEmail, onComplete }: {
    code: string; initialEmail: string; onComplete: (session: LoginResult) => Promise<void>;
}) {
    const [email, setEmail] = useState(initialEmail), [otp, setOtp] = useState('');
    const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [wait, setWait] = useState(0);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { if (!wait) return; const timer = window.setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000); return () => window.clearTimeout(timer); }, [wait]);
    const send = async () => {
        setBusy(true); setError('');
        try {
            const result = await requestSocialEmailCode(code, email.trim());
            if (!mounted.current) return;
            if (!result.sent) throw new Error('We could not send the verification email.');
            setEmail(result.email); setSent(true); setWait(60);
        } catch (cause) { if (mounted.current) setError(errorMessage(cause, 'Could not send the code. Please try again.')); }
        finally { if (mounted.current) setBusy(false); }
    };
    const verify = async () => {
        setBusy(true); setError('');
        try {
            const result = await completeSocialLogin(code, otp, () => mounted.current);
            if (!mounted.current) return;
            if ('requiresEmailVerification' in result) throw new Error('Request and enter your email verification code.');
            await onComplete(result);
        } catch (cause) { if (mounted.current) setError(errorMessage(cause, 'Could not verify that code. Please try again.')); }
        finally { if (mounted.current) setBusy(false); }
    };
    const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
    return <form className="space-y-5" onSubmit={event => { event.preventDefault(); void (sent ? verify() : send()); }}>
        <p className="text-base leading-relaxed text-slate-600">Confirm your email once to connect this social account securely. If you already have an ACTIV account, use its email to open the same dashboard.</p>
        <label className="block text-base font-medium text-slate-900" htmlFor="social-email">ACTIV account email
            <input id="social-email" className={inputClass} type="email" autoComplete="email" required value={email} disabled={busy}
                onChange={event => { setEmail(event.target.value); setSent(false); setOtp(''); setError(''); }} />
        </label>
        {sent && <>
            <p role="status" className="break-words text-base text-emerald-700">Verification code sent to {email}.</p>
            <label className="block text-base font-medium text-slate-900" htmlFor="social-code">Verification code
                <input id="social-code" className={inputClass} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp}
                    onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            </label>
        </>}
        {!!error && <p role="alert" className="text-base text-red-700">{error}</p>}
        <button type="submit" disabled={busy || (sent && otp.length !== 6)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50">
            {busy ? 'Please wait…' : sent ? 'Verify and open dashboard' : 'Send verification code'}
        </button>
        {sent && <button type="button" onClick={() => void send()} disabled={busy || wait > 0} className="w-full rounded-xl border border-blue-200 px-4 py-3 text-base font-semibold text-blue-700 disabled:opacity-50">
            {wait ? `Resend code in ${wait}s` : 'Resend code'}
        </button>}
    </form>;
}
