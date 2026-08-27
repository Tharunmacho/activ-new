import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, ArrowLeft, Shield, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { getUserApplication } from '@/services/applicationApi';
import { ASPIRANT_PLAN } from '@/features/member/membershipPlans';
import { getPaymentStatus } from "@/services/activApi";

export default function PaymentRegistration() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadApplication();
  }, []);

  const loadApplication = async () => {
    try {
      const app = await getUserApplication();

      /**
       * `getUserApplication()` resolves to **null** when the member has no
       * application — and also when the request fails, which it does whenever
       * the API is unreachable.
       *
       * The guard below was `app.status?.toLowerCase()`. The optional chain is
       * on `status`, not on `app`, so a null application threw
       * `Cannot read properties of null (reading 'status')` before the check
       * ran at all: the page died in `loadApplication`, its catch reported
       * "Failed to load application details", and the member was left on a
       * payment screen with a Pay button and no application behind it.
       */
      if (!app) {
        toast.error('We could not find your application. Please submit it before paying.');
        navigate('/member/application-status');
        return;
      }

      // Check if application is approved
      if (String(app.status || '').toLowerCase() !== 'approved') {
        toast.error('Your application must be approved before payment');
        navigate('/member/application-status');
        return;
      }

      // Check if already paid
      if (await getPaymentStatus() === 'completed') {
        toast.info('Payment already completed');
        navigate('/member/unpaid-dashboard');
        return;
      }

      setApplication(app);
    } catch (error) {
      console.error('Error loading application:', error);
      toast.error('Failed to load application details');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!application) {
      toast.error('Application not found');
      return;
    }

    setProcessing(true);
    try {
      /**
       * On to the gateway, the same step mobile takes.
       *
       * This called `initiatePayment()` -> `POST /payment/initiate`, a route
       * the backend does not declare, and then redirected to
       * `result.paymentUrl` from a response that never arrived. Mobile makes no
       * request when a plan is chosen; the gateway records the payment.
       *
       * The aspirant price is read from the shared plan definition rather than
       * repeated here, so it cannot drift from what the plan picker charges.
       */
      navigate('/payment/gateway', {
        state: {
          planType: ASPIRANT_PLAN.name,
          planId: ASPIRANT_PLAN.id,
          planAmount: ASPIRANT_PLAN.price,
          totalAmount: ASPIRANT_PLAN.price,
          applicationId: application?.applicationId || application?._id || '',
        },
      });
    } catch (error: any) {
      console.error('❌ Payment error:', error);
      toast.error(error.message || 'Payment failed. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-700">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-300 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate('/member/application-status')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Payment Registration</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <span className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-md">
              Complete Your Registration
            </span>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Aspirant Membership
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
            Join our community of aspiring professionals and unlock exclusive student benefits
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Plan Details & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Aspirant Plan Card */}
            <Card className="border-2 border-blue-600 shadow-xl bg-blue-50">
              <div className="absolute top-0 left-0 right-0 h-2 bg-blue-600"></div>
              <CardContent className="p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Aspirant Plan</h3>
                    <p className="text-gray-600 text-sm">For students without company experience</p>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-bold text-blue-600">₹2,000</div>
                    <div className="text-gray-600 mt-1 font-medium">per year</div>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    'Access to learning resources and webinars',
                    'Student-only events and competitions',
                    'Mentorship and career guidance',
                    'Networking with professionals'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700 text-sm leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Secure Payment Info */}
            <Card className="bg-green-50 border-2 border-green-300 shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-8">
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-green-500 flex items-center justify-center shadow-md">
                    <Lock className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-green-900 text-xl mb-2">
                      🔒 Secure Payment Gateway
                    </p>
                    <p className="text-sm text-green-800 leading-relaxed mb-3">
                      Powered by Instamojo - Your payment information is encrypted with industry-standard SSL encryption. We never store your card details.
                    </p>
                    <div className="flex items-center gap-3 text-xs text-green-700">
                      <span className="px-3 py-1.5 bg-white border border-green-300 rounded-full font-medium">SSL Encrypted</span>
                      <span className="px-3 py-1.5 bg-white border border-green-300 rounded-full font-medium">PCI Compliant</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* After Payment Info */}
            <Card className="bg-blue-50 border-2 border-blue-300 shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-xl">What Happens Next?</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { icon: '⚡', text: 'Instant membership activation' },
                    { icon: '📜', text: 'Digital certificate download' },
                    { icon: '📧', text: 'Email & WhatsApp confirmation' },
                    { icon: '🎯', text: 'Access to member dashboard' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-blue-200">
                      <span className="text-xl">{item.icon}</span>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm font-medium">{item.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Payment Summary */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl border-2 border-gray-300 sticky top-24 bg-white">
              {/* Header */}
              <div className="bg-gray-100 p-6 border-b-2 border-gray-300">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span>💳</span> Payment Summary
                </h2>
              </div>

              <CardContent className="p-8">
                <div className="space-y-5 mb-8">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-gray-600 text-sm font-medium">Member Type</span>
                    <span className="font-bold text-gray-900">Aspirant (Student)</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-50 border-2 border-blue-400">
                    <span className="text-blue-700 text-sm font-medium">Selected Plan</span>
                    <span className="font-bold text-blue-900">Aspirant Plan</span>
                  </div>

                  <div className="border-t-2 border-gray-300 pt-5 mt-5">
                    <div className="flex justify-between items-center mb-3 text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold text-gray-900">₹2,000</span>
                    </div>
                    <div className="flex justify-between items-center mb-5 text-sm">
                      <span className="text-gray-600">Tax & Fees</span>
                      <span className="font-semibold text-green-600">₹0 (Included)</span>
                    </div>
                    <div className="flex justify-between items-center pt-5 border-t-2 border-gray-300 bg-blue-50 -mx-8 px-8 py-5 rounded-b-lg">
                      <span className="text-lg font-bold text-gray-900">Total Amount</span>
                      <div className="text-right">
                        <span className="text-4xl font-bold text-blue-600 block">
                          ₹2,000
                        </span>
                        <span className="text-xs text-gray-600">One-time payment</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 text-lg font-bold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <div className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Processing Payment...</span>
                    </div>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      🚀 Proceed to Pay ₹2,000
                    </span>
                  )}
                </Button>

                {/* Trust Badges */}
                <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500 mb-2">Trusted by 1000+ students</p>
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span>Money-back guarantee</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
