import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CreditCard, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  payForMembership, getPaymentConfig, startHostedMembershipPayment,
  type PaymentConfig,
} from '@/services/paymentApi';
import MemberPageShell from '../member/MemberPageShell';

export default function PaymentGateway() {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentDetails = location.state;

  /*
   * ======================================================================
   * WHICH CHECKOUT, ASKED OF THE SERVER
   * ======================================================================
   *
   * `null` until the answer arrives, and the Pay button waits for it. A
   * default of "mock" would have this screen run the simulated flow for the
   * fraction of a second before the real answer lands — and a member who
   * clicked in that window would get a 403 from `/mock-authorize` with no
   * payment and no explanation.
   *
   * With a hosted gateway the card, UPI and net-banking fields below are not
   * drawn at all. They belong to Instamojo's page, and collecting a card
   * number on a site that does not process one is both useless and the exact
   * shape of a phishing form.
   */
  const [payConfig, setPayConfig] = useState<PaymentConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPaymentConfig()
      .then((cfg) => { if (!cancelled) setPayConfig(cfg); })
      /* A failed read leaves it null, which keeps the button disabled rather
         than guessing a flow and failing after the member has committed. */
      .catch(() => { if (!cancelled) setPayConfig(null); });
    return () => { cancelled = true; };
  }, []);

  const hosted = payConfig?.mode === 'gateway';

  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  
  // Card details state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  
  // UPI state
  const [upiId, setUpiId] = useState('');
  
  // Net Banking state
  const [selectedBank, setSelectedBank] = useState('');

  useEffect(() => {
    // `/payment/register` is not a route on this site. Reaching the gateway
    // with no plan sent the member to a 404 instead of back to the picker.
    if (!paymentDetails) {
      toast.error('Choose a plan first');
      navigate('/payment/membership-plans', { replace: true });
    }
  }, [paymentDetails, navigate]);

  const handlePayment = async () => {
    if (!paymentDetails?.planId) {
      toast.error('Choose a plan first');
      navigate('/payment/membership-plans', { replace: true });
      return;
    }

    /*
     * ==================================================================
     * HOSTED GATEWAY: LEAVE THE SITE. Nothing is validated here.
     * ==================================================================
     *
     * The card, UPI and bank fields below are not drawn in this mode, so
     * there is nothing of the member's to check — Instamojo collects and
     * validates all of it on its own page, which is the only place on this
     * flow that is allowed to see a card number.
     *
     * `processing` is never cleared on the success path, deliberately: the
     * browser is navigating away, and re-enabling the button would offer a
     * second click that starts a SECOND payment request while the first is
     * still loading.
     */
    if (hosted) {
      setProcessing(true);
      try {
        const start = await startHostedMembershipPayment(
          paymentDetails.planId,
          paymentDetails.applicationId,
        );
        if (!start?.payment_url) throw new Error('The payment could not be started');
        /* A fallback for the return page. The order id is also carried in
           `redirect_url` by the server, which is the reliable copy; this
           covers a redirect that arrives without the query string. */
        try { sessionStorage.setItem('activ:lastOrderId', start.orderId || ''); } catch { /* private mode */ }
        /* `replace`, not `assign`: Back from Instamojo's page should return
           to the plans, not to a checkout that immediately redirects out
           again and traps the member in a loop. */
        window.location.replace(start.payment_url);
        return;
      } catch (error: unknown) {
        console.error('Payment error:', error);
        /* The server names the field Instamojo rejected — "phone: Enter a
           valid phone number" — so that sentence is worth showing. */
        const message = error instanceof Error ? error.message : '';
        toast.error(message || 'Payment failed. Please try again.');
        setProcessing(false);
        return;
      }
    }

    // Validation
    if (paymentMethod === 'card') {
      if (!cardNumber || !cardName || !expiryDate || !cvv) {
        toast.error('Please fill all card details');
        return;
      }
      if (cardNumber.replace(/\s/g, '').length !== 16) {
        toast.error('Invalid card number');
        return;
      }
    } else if (paymentMethod === 'upi') {
      if (!upiId) {
        toast.error('Please enter UPI ID');
        return;
      }
    } else if (paymentMethod === 'netbanking') {
      if (!selectedBank) {
        toast.error('Please select a bank');
        return;
      }
    }

    setProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      /**
       * Order, authorise, verify — the server checks all three.
       *
       * This used to post `{ paymentId, paymentMethod, transactionId, status }`
       * to a route that checked none of them. The client generated its own
       * identifiers, so the "payment" was a string this page invented; an
       * authenticated request with an empty body worked just as well, and any
       * member who could sign in could grant themselves a membership.
       *
       * The plan is now sent instead of an amount, and the server decides what
       * it costs, issues the order, signs it and verifies the signature before
       * activating anything. `payForMembership` is where a real gateway's
       * checkout will replace the interim authorisation step.
       */
      if (!paymentDetails?.planId) {
        toast.error('Choose a plan first');
        navigate('/payment/membership-plans', { replace: true });
        return;
      }

      const order = await payForMembership(paymentDetails.planId, {
        applicationId: paymentDetails.applicationId,
        paymentMethod,
      });

      toast.success('Payment successful!');
      navigate('/payment/confirmation', {
        state: {
          ...paymentDetails,
          paid: true,
          orderId: order.orderId,
          // The amount the SERVER charged, not the one this page displayed.
          totalAmount: order.amount,
          paymentDate: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + (v.length > 2 ? '/' + v.slice(2, 4) : '');
    }
    return v;
  };

  if (!paymentDetails) {
    return null;
  }

  const banks = [
    'State Bank of India',
    'HDFC Bank',
    'ICICI Bank',
    'Axis Bank',
    'Punjab National Bank',
    'Bank of Baroda',
    'Canara Bank',
    'Union Bank of India'
  ];

  return (
    <MemberPageShell
      title="Secure Checkout"
      subtitle="Complete your payment safely and securely"
      width="standard"
            sidebar={false}
    >
      <div className="max-w-3xl mx-auto py-2">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-[2.1875rem] font-bold mb-2">Payment Gateway</h1>
          <p className="text-slate-500">Choose your preferred payment method</p>
        </div>

        {/* Payment Amount Summary */}
        <Card className="mb-6 bg-blue-50 border-blue-300">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-slate-600 mb-1">Total Amount to Pay</p>
                <p className="text-[2.1875rem] font-bold text-blue-600">₹{paymentDetails.totalAmount}</p>
              </div>
              <div className="text-right">
                <p className="text-[1.0625rem] text-slate-600">{paymentDetails.planType === 'annual' ? 'Annual' : 'Lifetime'} Membership</p>
                <p className="text-[1.0625rem] text-slate-600">₹{paymentDetails.planAmount}</p>
                {paymentDetails.supportAmount > 0 && (
                  <p className="text-[1.0625rem] text-slate-600">+ Support: ₹{paymentDetails.supportAmount}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/*
          * ================================================================
          * THE CARD FORM IS NOT DRAWN WHEN A HOSTED GATEWAY IS LIVE
          * ================================================================
          *
          * Instamojo collects the card, the UPI id and the bank on its own
          * page. Asking for a card number here would be asking for one this
          * site never sends anywhere — useless at best, and at worst a form
          * that looks exactly like the thing members are told to watch for.
          *
          * While the config is still loading (`payConfig === null`) nothing
          * is drawn either, because drawing the form and then removing it is
          * how a member ends up half-way through typing a card number.
          */}
        {payConfig?.mode === 'mock' && (
        <>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <Button
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard className="w-6 h-6 mb-1" />
                <span className="text-[1.0625rem]">Card</span>
              </Button>
              <Button
                variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => setPaymentMethod('upi')}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
                <span className="text-[1.0625rem]">UPI</span>
              </Button>
              <Button
                variant={paymentMethod === 'netbanking' ? 'default' : 'outline'}
                className="h-20 flex flex-col items-center justify-center"
                onClick={() => setPaymentMethod('netbanking')}
              >
                <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                </svg>
                <span className="text-[1.0625rem]">Net Banking</span>
              </Button>
            </div>

            {/* Card Payment Form */}
            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                    Card Number
                  </label>
                  <Input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className="text-[1.1875rem]"
                  />
                </div>
                <div>
                  <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                    Cardholder Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Name on card"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                      Expiry Date
                    </label>
                    <Input
                      type="text"
                      placeholder="MM/YY"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(formatExpiry(e.target.value))}
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                      CVV
                    </label>
                    <Input
                      type="password"
                      placeholder="123"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      maxLength={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* UPI Payment Form */}
            {paymentMethod === 'upi' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                    UPI ID
                  </label>
                  <Input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                  />
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[1.0625rem] text-blue-900">
                      You will receive a payment request on your UPI app. 
                      Please approve it to complete the payment.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Net Banking Form */}
            {paymentMethod === 'netbanking' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[1.0625rem] font-medium text-slate-700 mb-2">
                    Select Your Bank
                  </label>
                  <select
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                  >
                    <option value="">Choose a bank</option>
                    {banks.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[1.0625rem] text-blue-900">
                      You will be redirected to your bank's secure login page to complete the payment.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Secure Payment</p>
                <p className="text-[1.0625rem] text-green-700">
                  Your payment information is encrypted and secure. We never store your card details.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {/* Where the money actually goes, said before they commit. */}
        {hosted && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>How you will pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div className="text-[1.0625rem] leading-relaxed text-blue-900">
                  <p className="font-semibold">
                    You will be taken to Instamojo to pay.
                  </p>
                  <p className="mt-1">
                    Card, UPI and net banking are all offered there. ACTIV never
                    sees or stores your card details. Your membership is
                    activated once Instamojo confirms the payment to us — come
                    back to this site and it will be waiting.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            variant="outline"
            className="flex-1 py-6 text-[1.1875rem]"
            onClick={() => navigate('/payment/membership-plans')}
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-6 text-[1.1875rem]"
            onClick={handlePayment}
            /* Disabled until the server has said which checkout is live —
               see `payConfig`. A click before then has no flow to run. */
            disabled={processing || !payConfig}
          >
            {!payConfig ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Preparing…
              </>
            ) : processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {hosted ? 'Taking you to Instamojo…' : 'Processing Payment…'}
              </>
            ) : (
              <>
                <Lock className="w-5 h-5 mr-2" />
                Pay ₹{paymentDetails.totalAmount}
              </>
            )}
          </Button>
        </div>
      </div>
    </MemberPageShell>
  );
}
