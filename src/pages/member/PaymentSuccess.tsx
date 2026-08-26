import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from "@/services/activApi";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function PaymentSuccess() {
  const q = useQuery();
  const id = q.get('id');
  const navigate = useNavigate();

  // pull application from localStorage for display
  let app: any | null = null;
  try {
    const apps = JSON.parse(localStorage.getItem('applications') || '[]');
    app = id ? apps.find((a: any) => a.id === id) : null;
  } catch (_) {
    app = null;
  }

  const memberName = ((): string => {
    try {
      const reg = JSON.parse(localStorage.getItem('registrationData') || '{}');
      const main = JSON.parse(localStorage.getItem('userProfile') || '{}');
      return [main.firstName || reg.firstName, main.lastName || reg.lastName].filter(Boolean).join(' ') || 'Member';
    } catch (_) {
      return 'Member';
    }
  })();

  const handleDownload = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const planTitle = app?.payment?.plan === 'lifetime' ? 'Lifetime Membership' : 'Annual Membership';
  const paidAmount = app?.payment?.totalAmount ?? app?.payment?.planPrice ?? 0;

  // Mark membership active so menus/features can unlock
  useEffect(() => {
    const completePayment = async () => {
      try {
        if (app?.payment?.paidAt || app?.payment) {
          localStorage.setItem('membershipActive', 'true');
          
          // Update payment status in database
          const token = localStorage.getItem('token');
          if (token && app?.id) {
            const response = await apiFetch('/payment/complete', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                paymentId: app.payment?.paymentId || `PAY_${app.id}`,
                paymentMethod: app.payment?.method || 'online',
                transactionId: app.payment?.reference || app.payment?.transactionId || `TXN_${Date.now()}`,
                status: 'completed'
              })
            });

            if (response.ok) {
            } else {
              console.error('Failed to verify payment in database');
            }
          }
        }
      } catch (error) {
        console.error('Error completing payment:', error);
      }
    };

    completePayment();
  }, [app]);

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-blue-100 to-blue-200">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl md:text-3xl font-bold">Payment Successful!</h1>
          <p className="text-muted-foreground">Welcome to ACTIV — Your membership is now active</p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Membership Details</CardTitle>
              <Badge variant="secondary" className="bg-blue-600 text-white">Active</Badge>
            </div>
            <CardDescription>Summary of your membership purchase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-muted-foreground">Membership ID</div>
              <div className="font-medium">{app?.id || '-'}</div>
              <div className="text-muted-foreground">Member Name</div>
              <div className="font-medium">{memberName}</div>
              <div className="text-muted-foreground">Plan</div>
              <div className="font-medium">{planTitle}</div>
              <div className="text-muted-foreground">Amount Paid</div>
              <div className="font-medium">₹{paidAmount}</div>
              <div className="text-muted-foreground">Valid From</div>
              <div className="font-medium">{app?.payment?.paidAt ? new Date(app.payment.paidAt).toLocaleDateString() : '-'}</div>
              <div className="text-muted-foreground">Valid Until</div>
              <div className="font-medium">{app?.payment?.plan === 'lifetime' ? 'Lifetime' : (() => {
                const paid = app?.payment?.paidAt ? new Date(app.payment.paidAt) : null;
                if (!paid) return '-';
                const next = new Date(paid);
                next.setFullYear(paid.getFullYear() + 1);
                return next.toLocaleDateString();
              })()}</div>
              <div className="text-muted-foreground">Payment Reference</div>
              <div className="font-medium">{app?.payment?.reference || (app?.payment?.paidAt ? `INST_${app.id}` : '-')}</div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 mb-6">
          <Button
            className="justify-between"
            variant="secondary"
            onClick={() => handleDownload(`Membership-Certificate-${app?.id || 'member'}.txt`, `Membership Certificate\nMember: ${memberName}\nPlan: ${planTitle}\nMember ID: ${app?.id || ''}`)}
          >
            Download Membership Certificate
          </Button>
          <Button
            className="justify-between bg-green-100 text-green-900 hover:bg-green-100"
            variant="secondary"
            onClick={() => handleDownload(`Tax-Exemption-${app?.id || 'member'}.txt`, `Tax Exemption Certificate\nMember: ${memberName}\nMember ID: ${app?.id || ''}`)}
          >
            Download Tax Exemption Certificate
          </Button>
          <Button
            className="justify-between bg-pink-100 text-pink-900 hover:bg-pink-100"
            variant="secondary"
            onClick={() => handleDownload(`Payment-Receipt-${app?.id || 'member'}.txt`, `Receipt\nMember: ${memberName}\nAmount: ₹${paidAmount}\nReference: ${app?.payment?.reference || `INST_${app?.id || ''}`}`)}
          >
            Download Payment Receipt
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-sm">
              <span className="mt-1">🔔</span>
              <p>Confirmation has been sent to your registered email and WhatsApp number. Keep these for your records.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>Access your member dashboard to update profile and explore benefits.</CardDescription>
          </CardHeader>
        </Card>

        <Button className="w-full bg-blue-600 text-white" onClick={() => navigate('/member/dashboard')}>
          Go to Member Dashboard
        </Button>
      </div>
    </div>
  );
}
