import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function PaymentPage() {
  const query = useQuery();
  const appId = query.get('id');
  const navigate = useNavigate();

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'lifetime'>('annual');
  const [supportAmount, setSupportAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  const plans = {
    annual: { price: 500, duration: '1 Year', title: 'Annual Membership' },
    lifetime: { price: 2500, duration: 'Lifetime', title: 'Lifetime Membership' },
  };

  const currentPlan = plans[selectedPlan];
  const support = Number(supportAmount) || 0;
  const total = currentPlan.price + support;

  const handlePayment = async () => {
    if (!appId) {
      toast.error('No application id found');
      return;
    }

    setProcessingPayment(true);
    try {
      await new Promise(r => setTimeout(r, 1000));

      const appsJson = localStorage.getItem('applications') || '[]';
      const apps = JSON.parse(appsJson);
      const app = apps.find((a: any) => a.id === appId);

      if (app) {
        app.payment = {
          plan: selectedPlan,
          planPrice: currentPlan.price,
          support: support,
          totalAmount: total,
          paidAt: new Date().toISOString(),
          status: 'Completed',
        };

        if (app.stages && app.stages.length > 0) {
          const paymentStage = app.stages.find((s: any) => s.key === 'payment');
          if (paymentStage) {
            paymentStage.status = 'Approved';
            paymentStage.reviewDate = new Date().toISOString();
            paymentStage.notes = `Payment received: ₹${total}`;
          }
        }

        localStorage.setItem('applications', JSON.stringify(apps));
        toast.success('Payment successful! Your membership is now active.');
        navigate(`/member/payment-success?id=${encodeURIComponent(appId)}`);
      } else {
        toast.error('Application not found');
      }
    } catch (e) {
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-100 to-blue-200">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Complete your membership</h1>
          <p className="text-muted-foreground">Choose your membership plan and secure payment</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Membership Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(plans).map(([key, plan]) => (
              <div
                key={key}
                onClick={() => setSelectedPlan(key as 'annual' | 'lifetime')}
                className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                  selectedPlan === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{plan.title}</h3>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>✓ All annual benefits access</li>
                      <li>✓ Event invitation</li>
                      <li>✓ Access to networking</li>
                      <li>✓ Digital certificate</li>
                      <li>✓ Mail support</li>
                    </ul>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">₹{plan.price}</div>
                    <div className="text-xs text-muted-foreground">{plan.duration}</div>
                    {key === 'annual' && <span className="text-xs bg-yellow-200 px-2 py-1 rounded mt-1 inline-block">Most Popular</span>}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Support ACTIV</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Enter the amount you'd like to give</p>
            <Input
              type="number"
              placeholder="Enter Donation Amount"
              value={supportAmount}
              onChange={(e) => setSupportAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">Amount will be used to support our mission</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Secure Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span>Secure Payment - Powered by Razorpay</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Your payment information is encrypted and secure</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>{currentPlan.title}</span>
              <span>₹{currentPlan.price}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Duration</span>
              <span>{currentPlan.duration}</span>
            </div>
            {support > 0 && (
              <div className="flex justify-between text-sm">
                <span>Support Donation</span>
                <span>₹{support}</span>
              </div>
            )}
            <div className="border-t pt-3 flex justify-between font-semibold text-lg">
              <span>Total Amount</span>
              <span className="text-blue-600">₹{total}</span>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handlePayment}
          disabled={processingPayment}
          className="w-full bg-blue-600 text-white py-6 text-lg font-semibold mb-4"
        >
          {processingPayment ? 'Processing...' : `Pay ₹${total}`}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>After Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✓ Instant membership activation</li>
              <li>✓ Digital certificate download</li>
              <li>✓ Email & WhatsApp confirmation</li>
              <li>✓ Access to member dashboard</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
