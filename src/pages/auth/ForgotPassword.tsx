import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import api from '@/services/api';
import { errorMessage } from '@/services/activApi';
import { ENDPOINTS } from '@/config/api.config';

/**
 * Ask for a password reset link.
 *
 * The login page has linked to `/forgot-password` all along, and no such route
 * existed — the link fell through to the 404 page. The backend endpoints have
 * been there the whole time; this is the screen that was missing.
 *
 * The server answers identically whether or not the address is registered, and
 * so does this page. Saying "no account with that email" would turn the form
 * into a way of discovering which addresses have accounts, which is worth more
 * to someone guessing than the small convenience is to a member who mistyped.
 */
export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const address = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
            setError('Enter the email address you registered with.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email: address });
            setSent(true);
        } catch (err) {
            setError(errorMessage(err, 'Could not reach the server. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
                {sent ? (
                    <div className="text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center
                                        justify-center mx-auto mb-5">
                            <MailCheck className="w-8 h-8 text-blue-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
                        <p className="text-gray-600 leading-relaxed mb-8">
                            If <span className="font-medium">{email.trim().toLowerCase()}</span> is
                            registered, a reset link is on its way. The link expires in one hour.
                        </p>

                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to sign in
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset your password</h1>
                        <p className="text-gray-600 mb-8">
                            Enter the email address you registered with and we will send you a link
                            to set a new password.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Email address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        disabled={loading}
                                        className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none
                                                    focus:ring-2 focus:ring-blue-600 focus:border-transparent
                                                    ${error ? 'border-red-400' : 'border-gray-200'}`}
                                    />
                                </div>
                                {error && <p className="text-sm text-red-600 mt-1.5">{error}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-[#1c2e68]
                                           hover:bg-blue-900 text-white py-3 rounded-xl font-semibold
                                           transition-colors disabled:opacity-60"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>

                        <Link
                            to="/login"
                            className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to sign in
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
