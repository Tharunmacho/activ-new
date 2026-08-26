import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, CreditCard, Shield, Lock, XCircle, Building2, Calendar, Hash, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function MockPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(false);

  const paymentRequestId = searchParams.get('payment_request_id');
  const amount = searchParams.get('amount');

  const handlePayment = async (success: boolean) => {
    setProcessing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const transactionId = `TEST_${Date.now()}`;

      if (success) {
        toast.success('Payment successful!');
        navigate(`/payment/confirmation?status=success&payment_id=${paymentRequestId}&transaction_id=${transactionId}`);
      } else {
        toast.error('Payment failed');
        navigate('/member/application-status');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
      }}
    >
      <div className="w-full max-w-5xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 text-gray-600 hover:text-gray-900 hover:bg-white/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Main Card Container */}
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden"
          style={{
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)'
          }}
        >
          {/* Left Panel - Payment Info */}
          <div
            className="p-8 lg:p-10"
            style={{
              background: 'linear-gradient(145deg, #0f766e 0%, #134e4a 100%)'
            }}
          >
            <div className="h-full flex flex-col">
              {/* Logo/Brand */}
              <div className="flex items-center gap-3 mb-10">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255, 255, 255, 0.15)' }}
                >
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg">ACTIV Platform</h2>
                  <p className="text-teal-200 text-xs">Secure Payment</p>
                </div>
              </div>

              {/* Amount Display */}
              <div className="mb-10">
                <p className="text-teal-200 text-xs uppercase tracking-widest mb-2">Amount to Pay</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl lg:text-6xl font-bold text-white">₹{amount || '0'}</span>
                  <span className="text-teal-300 text-xl">.00</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="space-y-3 flex-1">
                <div
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                >
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-teal-300" />
                    <div>
                      <p className="text-teal-300 text-xs">Payment Request ID</p>
                      <p className="text-white font-mono text-sm mt-0.5">{paymentRequestId || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-teal-300" />
                    <div>
                      <p className="text-teal-300 text-xs">Date</p>
                      <p className="text-white text-sm mt-0.5">{new Date().toLocaleDateString('en-IN', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="mt-8 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-300" />
                <p className="text-teal-200 text-xs">256-bit SSL Encrypted</p>
              </div>
            </div>
          </div>

          {/* Right Panel - Actions */}
          <div className="bg-white p-8 lg:p-10 flex flex-col">
            {/* Header */}
            <div className="text-center mb-8">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                  boxShadow: '0 8px 24px -4px rgba(20, 184, 166, 0.4)'
                }}
              >
                <CreditCard className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Test Payment</h1>
              <p className="text-gray-500 text-sm">Simulate payment for testing</p>
            </div>

            {/* Test Mode Badge */}
            <div
              className="p-4 rounded-2xl mb-8 flex items-start gap-3"
              style={{ background: '#fef3c7' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#f59e0b' }}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-amber-800 font-semibold text-sm">Test Environment</p>
                <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                  No real transactions will occur.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 flex-1">
              <Button
                className="w-full py-6 text-sm font-semibold rounded-xl transition-all duration-200"
                style={{
                  background: processing ? '#d1d5db' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  boxShadow: processing ? 'none' : '0 8px 24px -4px rgba(5, 150, 105, 0.4)'
                }}
                onClick={() => handlePayment(true)}
                disabled={processing}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Complete Payment
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                className="w-full py-6 text-sm font-semibold rounded-xl transition-all duration-200 border-2"
                style={{
                  borderColor: '#fca5a5',
                  color: '#dc2626',
                  background: 'transparent'
                }}
                onClick={() => handlePayment(false)}
                disabled={processing}
              >
                <span className="flex items-center justify-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Simulate Failure
                </span>
              </Button>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-6 text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="text-xs">Secure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-xs">Encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-xs">PCI Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
