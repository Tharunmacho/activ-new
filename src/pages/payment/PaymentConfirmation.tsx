import React, { useEffect, useState } from 'react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Home, FileText, Loader2, Calendar, User, CreditCard, Info } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getUserApplication } from '@/services/applicationApi';
import { apiFetch } from "@/services/activApi";

/**
 * An amount, or a dash when none was recorded.
 *
 * A receipt must not print a figure nobody was charged, and it must not print
 * "₹null" either. Both became possible once the invented defaults came out —
 * the first is a lie in writing on the page members screenshot, the second is a
 * bug report.
 */
const money = (value?: number | null) =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? '—'
    : '₹' + Number(value).toLocaleString('en-IN');

export default function PaymentConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);

  useEffect(() => {
    loadPaymentDetails();
  }, []);

  const loadPaymentDetails = async () => {
    try {
      // Check if we have details from navigation state
      const stateDetails = location.state;

      // Or get from URL parameters (from Instamojo redirect)
      const status = searchParams.get('status');
      const paymentId = searchParams.get('payment_id');
      const transactionId = searchParams.get('transaction_id');

      /**
       * Only act on a payment that actually happened.
       *
       * The condition was `status === 'success' || stateDetails || true`. The
       * trailing `|| true` made it unconditional, so simply visiting
       * `/payment/confirmation` — a URL anyone can type — ran the activation
       * below and turned the account into a paid membership. The gateway now
       * passes `paid: true` in its navigation state, and Instamojo returns
       * `?status=success`; nothing else counts.
       */
      const paidHere = !!(stateDetails && (stateDetails as any).paid);
      if (status === 'success' || paidHere) {
        // Fetch latest application data
        // Null when the member has no application, and when the request
        // fails. Every `app.…` read below would throw on it.
        const app = (await getUserApplication()) || ({} as any);

        /**
         * This page confirms a payment; it no longer performs one.
         *
         * It used to POST `/payment/complete` itself, with identifiers it made
         * up when the URL carried none — `'PAYMENT_' + Date.now()`. That worked
         * because the endpoint verified nothing, which is exactly the hole that
         * has now been closed: completion requires a server-created order and a
         * signature the server issued, and this page has neither.
         *
         * The gateway completes the payment before navigating here, so by the
         * time this renders the membership is already active. Re-posting would
         * be refused as a replay of an order that is already paid — correctly.
         */
        localStorage.setItem('paymentStatus', 'completed');
        window.dispatchEvent(new CustomEvent('paymentCompleted'));
        window.dispatchEvent(new Event('profileUpdated'));

        /*
         * WHAT WAS ACTUALLY PAID — NEVER A DEFAULT.
         *
         * This used to fall back to ₹2,000, and to ₹5,000 for a business
         * member, whenever the recorded amount was missing. On a RECEIPT that
         * is not a harmless placeholder: it tells a member who paid ₹10,000
         * that they paid ₹2,000, in writing, on the page they screenshot. And
         * since the Super Admin can change the prices, the defaults were
         * guaranteed to be wrong eventually.
         *
         * Only recorded values now, in order of how close they are to the
         * transaction: what the gateway screen carried across, then what the
         * application stored. `null` when none of them holds a figure, and the
         * receipt renders a dash rather than a number nobody was charged.
         */
        const recordedAmount =
          stateDetails?.planAmount
          ?? app.paymentDetails?.planAmount
          ?? app.paymentAmount
          ?? null;

        const planType =
          stateDetails?.planType
          || app.paymentDetails?.planType
          || (app.memberType === 'aspirant' ? 'Aspirant Plan' : 'Membership');

        const planAmount = recordedAmount;

        const details = {
          membershipId: `ACTIV-2024-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
          memberName: app.fullName || 'Member',
          transactionId: transactionId || stateDetails?.transactionId || app.paymentDetails?.instamojoPaymentId || 'TEST_' + Date.now(),
          paymentDate: stateDetails?.paymentDate || app.paymentDate || new Date().toISOString(),
          planType: stateDetails?.planType || planType,
          planAmount: stateDetails?.planAmount || planAmount,
          supportAmount: stateDetails?.supportAmount || app.paymentDetails?.supportAmount || 0,
          totalAmount: stateDetails?.totalAmount || app.paymentAmount || planAmount,
          applicationId: app.applicationId,
          validFor: '1 Year'
        };

        setPaymentDetails(details);

        // Fire confetti animation
        fireConfetti();
      } else {
        // Redirect to dashboard if no valid payment details
        navigate('/member/unpaid-dashboard');
      }
    } catch (error) {
      console.error('Error loading payment details:', error);
      // Don't redirect on error during testing
      /*
       * A FAILED LOAD IS NOT A RECEIPT.
       *
       * This used to invent one — "Test Member", application "TEST-APP", ₹2,000
       * — and render it as though it described a real payment. Nothing here is
       * known, so nothing is claimed: the amounts are null and the screen prints
       * a dash where a figure would go.
       */
      setPaymentDetails({
        membershipId: '',
        memberName: '',
        transactionId: '',
        paymentDate: new Date().toISOString(),
        planType: 'Membership',
        planAmount: null,
        supportAmount: 0,
        totalAmount: null,
        applicationId: '',
        validFor: '1 Year'
      });
    } finally {
      setLoading(false);
    }
  };

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#3B82F6', '#10B981', '#8B5CF6']
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#3B82F6', '#10B981', '#8B5CF6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    frame();
  };

  if (loading) {
    return (
      <MemberPageShell
          title="Payment Confirmation"
          subtitle="Your membership payment"
          width="wide"
            sidebar={false}
      >
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-700">Loading payment details...</p>
        </div>
      </MemberPageShell>
    );
  }

  if (!paymentDetails) {
    return null;
  }

  const handleDownloadReceipt = () => {
    // In a real application, this would generate and download a PDF receipt
    const receiptData = `
ACTIV MEMBERSHIP - PAYMENT RECEIPT
======================================

Transaction ID: ${paymentDetails.transactionId}
Payment Date: ${new Date(paymentDetails.paymentDate).toLocaleString()}
Application ID: ${paymentDetails.applicationId || 'N/A'}

Membership Type: ${paymentDetails.planType === 'annual' ? 'Annual Membership' : 'Lifetime Membership'}
Membership Fee: ${money(paymentDetails.planAmount)}
Support Amount: ₹${paymentDetails.supportAmount || 0}
--------------------------------------
Total Amount Paid: ${money(paymentDetails.totalAmount)}

Status: COMPLETED
Payment Method: ${paymentDetails.paymentMethod?.toUpperCase() || 'CARD'}

Thank you for joining ACTIV!
======================================
    `.trim();

    const blob = new Blob([receiptData], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACTIV_Payment_Receipt_${paymentDetails.transactionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <MemberPageShell
        title="Payment Confirmation"
        subtitle="Your membership payment"
        width="wide"
            sidebar={false}
    >
      {/* Header */}
      <div className="bg-white border-b border-slate-300 shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-900">Payment Confirmation</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Success Section */}
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-xl mx-auto">
              <CheckCircle className="w-16 h-16 text-white" strokeWidth={3} />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-4">
            Payment Successful!
          </h1>
          <p className="text-xl text-slate-600">
            Welcome to ACTIV – Your membership is now active
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Left Column - Membership Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Membership Details Card */}
            <Card className="border-2 border-slate-300 shadow-xl">
              <div className="bg-slate-100 p-6 border-b-2 border-slate-300 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Membership Details</h2>
                <span className="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-bold shadow-md">
                  ✓ Active
                </span>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Membership ID</p>
                    <p className="text-lg font-bold text-slate-900">{paymentDetails.membershipId}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Member Name</p>
                    <p className="text-lg font-bold text-slate-900">{paymentDetails.fullName}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Plan</p>
                    <p className="text-lg font-bold text-slate-900">{paymentDetails.planType}</p>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
                    <p className="text-xs text-blue-700 mb-1 font-semibold uppercase tracking-wide">Amount Paid</p>
                    <p className="text-2xl font-bold text-blue-600">{money(paymentDetails.totalAmount)}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Valid For</p>
                    <p className="text-lg font-bold text-slate-900">{paymentDetails.validFor}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wide">Payment Reference</p>
                    <p className="break-all text-[1.0625rem] font-semibold tracking-wide tabular-nums text-slate-900">
                        {paymentDetails.transactionId}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Download Documents Card */}
            <Card className="border-2 border-slate-300 shadow-xl">
              <div className="bg-slate-100 p-6 border-b-2 border-slate-300">
                <h2 className="text-xl font-bold text-slate-900">Download Documents</h2>
              </div>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <Button
                    variant="outline"
                    className="py-6 h-auto flex-col gap-3 hover:bg-green-50 hover:border-green-400 border-2"
                    onClick={handleDownloadReceipt}
                  >
                    <Download className="w-8 h-8 text-green-600" />
                    <span className="font-bold text-sm">Download Receipt</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Confirmation Info */}
            <Card className="bg-blue-50 border-2 border-blue-300">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 mb-1">Confirmation Sent</p>
                  <p className="text-sm text-blue-800">
                    Confirmation has been sent to your registered email and WhatsApp number. Keep these for your records.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - What's Next */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-slate-300 shadow-xl sticky top-24">
              <div className="bg-slate-100 p-6 border-b-2 border-slate-300">
                <h2 className="text-xl font-bold text-slate-900">What's Next?</h2>
              </div>
              <CardContent className="p-8">
                <div className="space-y-6">
                  {[
                    { icon: User, color: 'blue', text: 'Access your member dashboard to update profile and browse other members' },
                    { icon: Calendar, color: 'purple', text: 'Join area-specific events and networking opportunities' },
                    { icon: CheckCircle, color: 'green', text: 'Connect with fellow ACTIV members in your region' }
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div key={idx} className="flex items-start gap-4">
                        <div className={`w-12 h-12 bg-${item.color}-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-6 h-6 text-${item.color}-600`} />
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed pt-2">{item.text}</p>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 text-lg font-bold shadow-lg mt-8"
                  onClick={() => navigate('/payment/member-dashboard')}
                >
                  <Home className="w-5 h-5 mr-2" />
                  Go to Dashboard
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MemberPageShell>
  );
}
