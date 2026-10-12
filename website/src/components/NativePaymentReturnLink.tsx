import { useSearchParams } from 'react-router-dom';

/** The app verifies this order again; neither a URL nor this link grants access. */
export function nativePaymentReturnHref(params: URLSearchParams, kind: 'payment' | 'donation', dashboard = false): string | null {
    if (params.get('client') !== 'app') return null;
    const orderId = params.get('orderId') || '';
    if (!/^[a-z0-9_-]{1,160}$/i.test(orderId)) return null;
    const query = new URLSearchParams({ orderId });
    if (kind === 'payment' && dashboard) query.set('next', 'dashboard');
    for (const key of ['payment_id', 'payment_status']) {
        const value = params.get(key);
        if (value && value.length <= 256 && !/[\u0000-\u001f]/.test(value)) query.set(key, value);
    }
    return 'activ://' + (kind === 'donation' ? 'donate/thank-you' : 'payment-success') + '?' + query.toString();
}

export default function NativePaymentReturnLink({ kind = 'payment' }: { kind?: 'payment' | 'donation' }) {
    const [params] = useSearchParams();
    const href = nativePaymentReturnHref(params, kind);
    if (!href) return null;
    return (
        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <a href={href} style={{ minHeight: 48 }} className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-6 py-3 text-base font-bold text-white hover:bg-blue-800">
                Return to ACTIV app
            </a>
            <p className="mt-2 text-sm text-slate-600">Continue in the app to check this payment and view your receipt.</p>
        </div>
    );
}
