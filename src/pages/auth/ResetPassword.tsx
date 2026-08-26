import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { errorMessage } from '@/services/activApi';
import { ENDPOINTS } from '@/config/api.config';

/**
 * Set a new password from the link in the reset email.
 *
 * The token arrives in the query string — `buildResetUrl` on the server builds
 * `/reset-password?token=…`, so this page must read it from there and nowhere
 * else.
 *
 * It is checked against the server BEFORE the form is shown. Letting someone
 * type a new password twice and only then learn the link expired is a waste of
 * their time, and the check is one cheap request.
 */
export default function ResetPassword() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token') || '';

    const [checking, setChecking] = useState(true);
    const [valid, setValid] = useState(false);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setChecking(false);
            setValid(false);
            return;
        }

        let cancelled = false;
        api.get(ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, { params: { token } })
            .then((res) => {
                if (cancelled) return;
                const payload = res.data?.data ?? res.data ?? {};
                setValid(!!payload.valid);
            })
            .catch(() => { if (!cancelled) setValid(false); })
            .finally(() => { if (!cancelled) setChecking(false); });

        return () => { cancelled = true; };
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mirrors the server's own minimum, so a password it will refuse never
        // costs a round trip.
        if (password.length < 6) {
            setError('Your new password must be at least 6 characters.');
            return;
        }
        if (password !== confirm) {
            setError('The two passwords do not match.');
            return;
        }

        setError('');
        setSaving(true);
        try {
            await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, password });
            setDone(true);
        } catch (err) {
            setError(errorMessage(err, 'That link is no longer valid. Request a new one.'));
        } finally {
            setSaving(false);
        }
    };

    const Shell = ({ children }: { children: React.ReactNode }) => (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">{children}</div>
        </div>
    );

    if (checking) {
        return (
            <Shell>
                <div className="flex items-center justify-center gap-3 text-gray-500 py-8">
                    <Loader2 className="w-5 h-5 animate-spin" /> Checking your link…
                </div>
            </Shell>
        );
    }

    if (!valid) {
        return (
            <Shell>
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">This link has expired</h1>
                    <p className="text-gray-600 mb-8">
                        Reset links last one hour and can be used once. Request a new one and it will
                        work straight away.
                    </p>
                    <Link
                        to="/forgot-password"
                        className="inline-block bg-[#1c2e68] hover:bg-blue-900 text-white px-6 py-3
                                   rounded-xl font-semibold transition-colors"
                    >
                        Send a new link
                    </Link>
                </div>
            </Shell>
        );
    }

    if (done) {
        return (
            <Shell>
                <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Password changed</h1>
                    <p className="text-gray-600 mb-8">You can now sign in with your new password.</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="bg-[#1c2e68] hover:bg-blue-900 text-white px-8 py-3 rounded-xl
                                   font-semibold transition-colors"
                    >
                        Sign in
                    </button>
                </div>
            </Shell>
        );
    }

    const field = (
        id: string, label: string, value: string, set: (v: string) => void, autoComplete: string,
    ) => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    id={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => { set(e.target.value); setError(''); }}
                    autoComplete={autoComplete}
                    disabled={saving}
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );

    return (
        <Shell>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Set a new password</h1>
            <p className="text-gray-600 mb-8">Choose a password you have not used here before.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                {field('password', 'New password', password, setPassword, 'new-password')}
                {field('confirm', 'Confirm new password', confirm, setConfirm, 'new-password')}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-[#1c2e68]
                               hover:bg-blue-900 text-white py-3 rounded-xl font-semibold
                               transition-colors disabled:opacity-60"
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Saving…' : 'Change password'}
                </button>
            </form>

            <Link
                to="/login"
                className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
        </Shell>
    );
}
