import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, Loader2, FileCheck2, CalendarRange, RotateCw } from 'lucide-react';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import NativePaymentReturnLink from '@/components/NativePaymentReturnLink';
import {
    getDonationReturn, inr, fyLabel, receiptPath, statementPath, type DonationReturn,
} from '@/services/donationsApi';

/**
 * Where a donor lands after the gateway: `/donate/thank-you?orderId=…`.
 *
 * The page asks the server about THIS order (the server verifies it with the
 * gateway itself) rather than trusting `payment_status` in the address bar.
 * Payments can take a few seconds to settle, so a pending answer is re-asked a
 * handful of times before the page says "still confirming" and offers a retry.
 */

const POLLS = 6;
const EVERY_MS = 3000;

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-[#f3f6fb] font-sans">
            <HeaderSection />
            <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
                <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-[0_18px_40px_-20px_rgba(14,31,77,0.35)] sm:p-9">
                    {children}
                    <NativePaymentReturnLink kind="donation" />
                </div>
            </main>
            <FooterSection />
        </div>
    );
}

export default function DonateThankYou() {
    const [params] = useSearchParams();
    const orderId = params.get('orderId') || '';
    const paymentId = params.get('payment_id') || '';
    const gatewayStatus = params.get('payment_status') || '';

    const [result, setResult] = useState<DonationReturn | null>(null);
    const [phase, setPhase] = useState<'checking' | 'done' | 'stuck' | 'error'>('checking');
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        let active = true;
        let tries = 0;
        let timer: number | undefined;
        setResult(null);
        setPhase('checking');
        const check = async () => {
            if (!active) return;
            if (!orderId) { setPhase('error'); return; }
            try {
                const r = await getDonationReturn(orderId, { payment_id: paymentId, payment_status: gatewayStatus });
                if (!active) return;
                setResult(r);
                const status = String(r?.status || '').toLowerCase();
                if (status === 'paid' || status === 'failed') { setPhase('done'); return; }
            } catch { /* A failed read is not a failed payment. */ }
            if (!active) return;
            tries += 1;
            if (tries >= POLLS) { setPhase('stuck'); return; }
            timer = window.setTimeout(() => { void check(); }, EVERY_MS);
        };
        void check();
        return () => { active = false; if (timer !== undefined) window.clearTimeout(timer); };
    }, [orderId, paymentId, gatewayStatus, revision]);

    const retry = () => setRevision(value => value + 1);

    if (!orderId || phase === 'error') {
        return (
            <Shell>
                <XCircle className="mx-auto h-14 w-14 text-amber-500" />
                <h1 className="mt-4 text-[1.625rem] font-bold text-slate-900">We could not find that donation</h1>
                <p className="mt-2 text-ui-caption text-slate-600">If you were charged, your receipt will reach your email shortly.</p>
                <Link to="/donate" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700">
                    Back to donations
                </Link>
            </Shell>
        );
    }

    const status = String(result?.status || '').toLowerCase();

    if (phase === 'checking') {
        return (
            <Shell>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
                <h1 className="mt-4 text-[1.5rem] font-bold text-slate-900">Confirming your donation…</h1>
                <p className="mt-2 text-ui-caption text-slate-600">This usually takes a few seconds. Please keep this page open.</p>
            </Shell>
        );
    }

    if (status === 'paid') {
        return (
            <Shell>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50">
                    <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                </div>
                <h1 className="mt-4 text-[1.75rem] font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">
                    Thank you{result?.donorName ? `, ${result.donorName}` : ''}!
                </h1>
                <p className="mt-2 text-ui-caption leading-relaxed text-slate-600">
                    Your donation of <strong className="text-slate-900">{inr(result?.amount)}</strong> to ACTIV has been received.
                    Your 80G receipt is on its way to your email.
                </p>

                <dl className="mx-auto mt-6 grid max-w-sm grid-cols-1 gap-2 rounded-xl bg-slate-50 p-4 text-left sm:grid-cols-2">
                    <div className="min-w-0">
                        <dt className="text-sm text-slate-500">Receipt number</dt>
                        <dd className="break-all text-base font-bold text-slate-900">{result?.receiptNumber || '—'}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-sm text-slate-500">Financial year</dt>
                        <dd className="text-base font-bold text-slate-900">{fyLabel(result?.financialYear) || '—'}</dd>
                    </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {result?.receiptToken ? (
                        <Link to={receiptPath(result.receiptToken)}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white hover:bg-blue-700">
                            <FileCheck2 className="h-5 w-5" /> View / print 80G receipt
                        </Link>
                    ) : null}
                    {result?.statementToken ? (
                        <Link to={statementPath(result.statementToken, result.financialYear)}
                            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-bold text-slate-700 hover:bg-slate-50">
                            <CalendarRange className="h-5 w-5" /> Your year certificate
                        </Link>
                    ) : null}
                </div>
                <p className="mt-5 text-sm text-slate-500">
                    Every gift this financial year is added to your year certificate automatically.
                </p>
            </Shell>
        );
    }

    if (status === 'failed') {
        return (
            <Shell>
                <XCircle className="mx-auto h-14 w-14 text-red-500" />
                <h1 className="mt-4 text-[1.625rem] font-bold text-slate-900">The payment did not go through</h1>
                <p className="mt-2 text-ui-caption text-slate-600">The gateway reported an unsuccessful payment. If money was deducted, check with your bank or contact ACTIV before trying again.</p>
                <Link to="/donate" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700">
                    Try again
                </Link>
            </Shell>
        );
    }

    return (
        <Shell>
            <Clock className="mx-auto h-14 w-14 text-amber-500" />
            <h1 className="mt-4 text-[1.625rem] font-bold text-slate-900">Still confirming your payment</h1>
            <p className="mt-2 text-ui-caption text-slate-600">
                The gateway has not confirmed it yet. If you were charged, your receipt will be emailed to you as soon as it does.
            </p>
            <button type="button" onClick={retry}
                className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-bold text-white hover:bg-blue-700">
                <RotateCw className="h-5 w-5" /> Check again
            </button>
        </Shell>
    );
}
