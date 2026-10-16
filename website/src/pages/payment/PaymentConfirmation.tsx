import { useEffect, useState } from 'react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  CheckCircle, Printer, LayoutDashboard, Loader2, CalendarDays, Users, Award, Mail, ShieldCheck, ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getUserApplication } from '@/services/applicationApi';
import { getMyProfile } from '@/services/activApi';

/**
 * An amount, or a dash when none was recorded.
 *
 * A receipt must not print a figure nobody was charged, and it must not print
 * "₹null" either.
 */
const money = (value?: number | null) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '—'
    : '₹' + Number(value).toLocaleString('en-IN');

const longDate = (value?: string | null) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
};

interface Receipt {
  membershipId: string;
  memberName: string;
  transactionId: string;
  paymentDate: string;
  planType: string;
  totalAmount: number | null;
  validUntil: string;
  applicationId: string;
}

export default function PaymentConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    loadPaymentDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPaymentDetails = async () => {
    try {
      const stateDetails: any = location.state || {};
      const status = searchParams.get('status');
      const transactionId = searchParams.get('transaction_id') || searchParams.get('payment_id');

      /**
       * Only act on a payment that actually happened: the gateway passes
       * `paid: true` in its navigation state, and Instamojo returns
       * `?status=success`. Visiting this URL by hand shows nothing.
       */
      const paidHere = !!stateDetails.paid;
      if (!(status === 'success' || paidHere)) {
        navigate('/member/unpaid-dashboard');
        return;
      }

      /* This page confirms a payment; the gateway has already completed it. */
      localStorage.setItem('paymentStatus', 'completed');
      window.dispatchEvent(new CustomEvent('paymentCompleted'));
      window.dispatchEvent(new Event('profileUpdated'));

      const [appResult, profileResult] = await Promise.allSettled([getUserApplication(), getMyProfile()]);
      const app: any = (appResult.status === 'fulfilled' && appResult.value) || {};
      const profile: any = (profileResult.status === 'fulfilled' && profileResult.value) || {};

      /*
       * WHAT WAS ACTUALLY PAID — NEVER A DEFAULT, and the REAL member ID —
       * never an invented one. Both used to be made up here (a random
       * "ACTIV-2024-…" number and a ₹2,000 fallback) on the page members keep.
       */
      const totalAmount =
        stateDetails.totalAmount ?? stateDetails.planAmount
        ?? app.paymentDetails?.planAmount ?? app.paymentAmount ?? null;

      setReceipt({
        membershipId: String(profile.membershipNumber || ''),
        memberName: String(profile.fullName || profile.name || app.fullName || ''),
        transactionId: String(transactionId || stateDetails.transactionId || app.paymentDetails?.instamojoPaymentId || ''),
        paymentDate: stateDetails.paymentDate || app.paymentDate || new Date().toISOString(),
        planType: String(stateDetails.planType || app.paymentDetails?.planType
          || (app.memberType === 'aspirant' ? 'Aspirant membership'
            : app.memberType === 'student' ? 'Student membership' : 'Membership')),
        totalAmount: totalAmount === null ? null : Number(totalAmount),
        validUntil: longDate(profile.membershipExpiresAt || profile.validUntil),
        applicationId: String(app.applicationId || ''),
      });
      celebrate();
    } catch (error) {
      console.error('Error loading payment details:', error);
      // A failed load is not a receipt: nothing is claimed that is not known.
      setReceipt({
        membershipId: '', memberName: '', transactionId: '', paymentDate: new Date().toISOString(),
        planType: 'Membership', totalAmount: null, validUntil: '', applicationId: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const celebrate = () => {
    try {
      const colors = ['#1c2e68', '#2563eb', '#38bdf8', '#fbbf24'];
      confetti({ particleCount: 110, spread: 75, origin: { y: 0.35 }, colors, scalar: 0.9 });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.3 }, colors, scalar: 0.8 }), 350);
    } catch { /* decoration only */ }
  };

  /** A real receipt page, printable or saved as PDF from the browser's dialog. */
  const printReceipt = () => {
    if (!receipt) return;
    const rows: [string, string][] = [
      ['Member', receipt.memberName || '—'],
      ['Member ID', receipt.membershipId || 'Shown on your dashboard'],
      ['Plan', receipt.planType],
      ['Amount paid', money(receipt.totalAmount)],
      ['Paid on', longDate(receipt.paymentDate) || '—'],
      ['Valid until', receipt.validUntil || '—'],
      ['Payment reference', receipt.transactionId || '—'],
    ];
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ACTIV payment receipt</title>
      <style>body{font-family:Poppins,Segoe UI,Arial,sans-serif;color:#0f172a;margin:40px}
      .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1c2e68;padding-bottom:16px}
      h1{font-size:22px;margin:24px 0 4px}p{color:#475569;margin:0 0 24px}
      table{width:100%;border-collapse:collapse}td{padding:12px 0;border-bottom:1px solid #e2e8f0;font-size:15px}
      td:first-child{color:#64748b;width:40%}td:last-child{font-weight:600}
      .paid{display:inline-block;background:#dcfce7;color:#166534;font-weight:700;padding:4px 12px;border-radius:999px;font-size:13px}
      .foot{margin-top:32px;font-size:12px;color:#64748b}</style></head><body>
      <div class="top"><img src="${window.location.origin}/logo_ACTIVian-removebg-preview.png" height="56" alt="ACTIV"><span class="paid">PAID</span></div>
      <h1>Membership payment receipt</h1><p>Adidravidar Confederation of Trade &amp; Industrial Vision</p>
      <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <div class="foot">This is a computer-generated receipt. enquiry@activ.org.in · +91 82201 12188 · activ.org.in</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  if (loading || !receipt) {
    return (
      <MemberPageShell title="Payment confirmation" width="wide" sidebar={false}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#2563eb]" />
          <p className="text-slate-600">Confirming your payment…</p>
        </div>
      </MemberPageShell>
    );
  }

  const facts: [string, string][] = [
    ['Member', receipt.memberName || '—'],
    ['Plan', receipt.planType],
    ['Paid on', longDate(receipt.paymentDate) || '—'],
    ['Valid until', receipt.validUntil || 'See your dashboard'],
  ];

  return (
    <MemberPageShell title="Payment confirmation" subtitle="Your membership is active" width="wide" sidebar={false}>
      <div className="mx-auto max-w-5xl pb-10">
        {/* ============================================================ hero */}
        <section className="relative overflow-hidden rounded-3xl px-5 py-10 text-center text-white sm:px-10 sm:py-14"
                 style={{ backgroundImage: 'linear-gradient(135deg, #0f1c47 0%, #1c2e68 45%, #2563eb 100%)' }}>
          <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative">
            <span className="relative mx-auto grid h-20 w-20 place-items-center sm:h-24 sm:w-24">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
              <span className="relative grid h-full w-full place-items-center rounded-full bg-emerald-500 shadow-[0_12px_40px_-8px_rgb(16_185_129/0.8)] ring-8 ring-white/15">
                <CheckCircle className="h-10 w-10 text-white sm:h-12 sm:w-12" strokeWidth={2.5} />
              </span>
            </span>
            <h1 className="mt-6 text-[1.9rem] font-black tracking-tight sm:text-[2.75rem]">Payment successful</h1>
            <p className="mx-auto mt-2 max-w-lg text-[1rem] text-blue-100 sm:text-[1.125rem]">
              Welcome to ACTIV{receipt.memberName ? `, ${receipt.memberName.split(' ')[0]}` : ''} — your membership is now active.
            </p>
            <div className="mt-6 inline-flex items-baseline gap-2 rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20">
              <span className="text-[0.85rem] font-semibold uppercase tracking-widest text-blue-100">Amount paid</span>
              <span className="text-[1.75rem] font-black">{money(receipt.totalAmount)}</span>
            </div>
          </div>
        </section>

        <div className="-mt-6 grid gap-6 px-1 sm:px-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* =================================================== the receipt */}
          <div className="relative rounded-3xl bg-white shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)] ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 sm:px-8">
              <div>
                <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-slate-400">Your member ID</p>
                <p className="mt-1 font-mono text-[1.6rem] font-bold tracking-[0.12em] text-[#1c2e68] break-all">
                  {receipt.membershipId || '—'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[0.85rem] font-bold text-emerald-700 ring-1 ring-emerald-200">
                <ShieldCheck className="h-4 w-4" /> Active member
              </span>
            </div>

            {/* ticket tear */}
            <div className="relative my-6 flex items-center">
              <span className="absolute -left-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
              <span className="mx-6 h-px flex-1 border-t-2 border-dashed border-slate-200" />
              <span className="absolute -right-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
            </div>

            <dl className="grid gap-x-8 gap-y-5 px-5 sm:grid-cols-2 sm:px-8">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[0.8rem] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
                  <dd className="mt-1 text-[1.05rem] font-semibold text-slate-900 break-words">{v}</dd>
                </div>
              ))}
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[0.8rem] font-semibold uppercase tracking-wider text-slate-400">Payment reference</dt>
                <dd className="mt-1 font-mono text-[0.95rem] font-semibold text-slate-700 break-all">{receipt.transactionId || '—'}</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 px-5 py-5 sm:flex-row sm:px-8">
              <button type="button" onClick={printReceipt}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-[0.95rem] font-bold text-slate-700 transition hover:border-[#2563eb] hover:text-[#2563eb]">
                <Printer className="h-5 w-5" /> Print / save receipt
              </button>
              <button type="button" onClick={() => navigate('/member/certificate/membership')}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-[0.95rem] font-bold text-slate-700 transition hover:border-[#2563eb] hover:text-[#2563eb]">
                <Award className="h-5 w-5" /> Membership certificate
              </button>
            </div>

            <p className="flex items-start gap-2 rounded-b-3xl bg-blue-50/70 px-5 py-4 text-[0.9rem] text-blue-900 sm:px-8">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              A confirmation with these details has been sent to your registered email and WhatsApp.
            </p>
          </div>

          {/* ================================================= what's next */}
          <aside className="rounded-3xl bg-white p-5 shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)] ring-1 ring-slate-200 sm:p-6 lg:self-start">
            <h2 className="text-[1.1rem] font-extrabold text-slate-900">What you can do now</h2>
            <ul className="mt-4 space-y-2">
              {[
                { icon: LayoutDashboard, text: 'Your member dashboard', to: '/payment/member-dashboard' },
                { icon: Users, text: 'Find and message members', to: '/member/directory' },
                { icon: CalendarDays, text: 'Members-only events', to: '/member/events' },
                { icon: Award, text: 'Download your certificate', to: '/member/certificate/membership' },
              ].map(({ icon: I, text, to }) => (
                <li key={to}>
                  <button type="button" onClick={() => navigate(to)}
                          className="group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-slate-50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><I className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1 text-[0.95rem] font-semibold text-slate-800">{text}</span>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2563eb]" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => navigate('/payment/member-dashboard')}
                    className="btn-shine relative mt-5 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-[1rem] font-bold text-white shadow-[0_12px_28px_-12px_rgb(37_99_235/0.7)]"
                    style={{ backgroundImage: 'linear-gradient(135deg, #1c2e68 0%, #2563eb 100%)' }}>
              <LayoutDashboard className="h-5 w-5" /> Go to dashboard
            </button>
          </aside>
        </div>
      </div>
    </MemberPageShell>
  );
}
