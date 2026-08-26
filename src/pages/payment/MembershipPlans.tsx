import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft, Lock, Shield, CreditCard, Zap, FileText, Mail, Star, Building2, Loader2, Crown, Sparkles, Award } from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import { initiatePayment } from '@/services/paymentApi';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  popular?: boolean;
  experience: string;
  icon: any;
  accentColor: string;
  bgGradient: string;
}

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'Starter',
    description: 'For companies less than 5 years',
    price: 5000,
    experience: '< 5 years',
    icon: Sparkles,
    accentColor: '#0ea5e9',
    bgGradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    features: [
      'Compliance and documentation guidance',
      'Access to networking forums',
      'Standard email support'
    ]
  },
  {
    id: 'intermediate',
    name: 'Professional',
    description: 'For companies 5 – 10 years',
    price: 10000,
    experience: '5 - 10 years',
    popular: true,
    icon: Crown,
    accentColor: '#8b5cf6',
    bgGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    features: [
      'All Starter benefits',
      'Priority event invitations',
      'Growth and scaling advisory sessions'
    ]
  },
  {
    id: 'ideal',
    name: 'Enterprise',
    description: 'For companies 10+ years',
    price: 20000,
    experience: '10+ years',
    icon: Award,
    accentColor: '#f59e0b',
    bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    features: [
      'All Professional benefits',
      'Premium advisory and consulting',
      'Featured listing and special recognition'
    ]
  }
];

export default function MembershipPlans() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<Plan>(plans[1]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const app = await getUserApplication();
      setUserData({
        memberType: 'Company',
        experience: app.businessExperience || '5 - 10 years',
        applicationId: app.applicationId,
        memberName: app.fullName,
        memberEmail: app.email
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      setUserData({
        memberType: 'Company',
        experience: '5 - 10 years',
        applicationId: 'APP-TEST',
        memberName: 'Member',
        memberEmail: 'member@activ.org'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const handlePayment = async () => {
    setProcessing(true);
    try {
      const paymentData = {
        planType: selectedPlan.name,
        planAmount: selectedPlan.price,
        supportAmount: 0,
        totalAmount: selectedPlan.price
      };

      const result = await initiatePayment(paymentData);

      if (result.success) {
        window.location.href = result.paymentUrl;
      } else {
        toast.error('Failed to initiate payment');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      toast.error('Payment initiation failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
        }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              boxShadow: '0 8px 24px -4px rgba(139, 92, 246, 0.4)'
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Loading Plans</h2>
          <p className="text-gray-500 text-sm">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
      }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-xl hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Choose Plan</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Select the best option for your business</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Secure Checkout</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Title */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(139, 92, 246, 0.1)' }}
          >
            <Star className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs font-medium text-violet-600">Membership Plans</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Choose a plan that fits your business needs
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isSelected = selectedPlan.id === plan.id;

            return (
              <div
                key={plan.id}
                className="relative cursor-pointer transition-all duration-300"
                style={{
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                }}
                onClick={() => handlePlanSelect(plan)}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10"
                  >
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: plan.bgGradient }}
                    >
                      POPULAR
                    </span>
                  </div>
                )}

                <Card
                  className="h-full overflow-hidden border-0 transition-all duration-300"
                  style={{
                    borderRadius: '20px',
                    boxShadow: isSelected
                      ? `0 20px 40px -12px ${plan.accentColor}40, 0 0 0 2px ${plan.accentColor}`
                      : '0 4px 16px -4px rgba(0, 0, 0, 0.08)',
                    background: '#ffffff'
                  }}
                >
                  <CardContent className="p-6">
                    {/* Plan Icon & Name */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: plan.bgGradient }}
                      >
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{plan.name}</h3>
                        <p className="text-xs text-gray-500">{plan.description}</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div
                      className="py-4 px-3 rounded-xl mb-5 text-center"
                      style={{ background: '#f8fafc' }}
                    >
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span className="text-lg text-gray-500">₹</span>
                        <span
                          className="text-3xl font-bold"
                          style={{ color: plan.accentColor }}
                        >
                          {plan.price.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">per year</p>
                    </div>

                    {/* Features */}
                    <div className="space-y-2.5 mb-5">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2.5">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: plan.bgGradient }}
                          >
                            <CheckCircle className="w-2.5 h-2.5 text-white" />
                          </div>
                          <span className="text-xs text-gray-600 leading-relaxed">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Select Button */}
                    <Button
                      className="w-full py-4 text-sm font-semibold rounded-xl transition-all duration-200"
                      style={{
                        background: isSelected ? plan.bgGradient : '#f1f5f9',
                        color: isSelected ? '#ffffff' : '#475569',
                        boxShadow: isSelected ? `0 8px 20px -4px ${plan.accentColor}40` : 'none'
                      }}
                    >
                      {isSelected ? (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Selected
                        </span>
                      ) : (
                        'Select Plan'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Secure Payment */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)'
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255, 255, 255, 0.15)' }}
                >
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Secure Payment</h3>
                  <p className="text-teal-100 text-xs leading-relaxed mb-3">
                    Powered by Instamojo with SSL encryption and PCI compliance.
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-1 rounded-full text-xs"
                      style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}
                    >
                      SSL
                    </span>
                    <span
                      className="px-2 py-1 rounded-full text-xs"
                      style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}
                    >
                      PCI Compliant
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* What's Next */}
            <Card
              className="border-0"
              style={{ borderRadius: '20px', boxShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.08)' }}
            >
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-gray-900 mb-4">What's Next?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Zap, text: 'Instant activation', color: '#f59e0b' },
                    { icon: FileText, text: 'Digital certificate', color: '#8b5cf6' },
                    { icon: Mail, text: 'Email confirmation', color: '#0ea5e9' },
                    { icon: Building2, text: 'Dashboard access', color: '#10b981' }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-3 rounded-xl"
                      style={{ background: '#f8fafc' }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${item.color}15` }}
                      >
                        <item.icon className="w-4 h-4" style={{ color: item.color }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{item.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right - Summary */}
          <div className="lg:col-span-1">
            <Card
              className="border-0 sticky top-24 overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.12)'
              }}
            >
              {/* Header */}
              <div
                className="p-5"
                style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-white" />
                  <h2 className="text-base font-bold text-white">Summary</h2>
                </div>
              </div>

              <CardContent className="p-5">
                {/* Details */}
                <div className="space-y-3 mb-5">
                  <div
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: '#f8fafc' }}
                  >
                    <span className="text-xs text-gray-500">Type</span>
                    <span className="text-sm font-semibold text-gray-900">{userData.memberType}</span>
                  </div>
                  <div
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{ background: '#f8fafc' }}
                  >
                    <span className="text-xs text-gray-500">Experience</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedPlan.experience}</span>
                  </div>
                  <div
                    className="flex justify-between items-center p-3 rounded-xl"
                    style={{
                      background: `${selectedPlan.accentColor}10`,
                      border: `1px solid ${selectedPlan.accentColor}30`
                    }}
                  >
                    <span className="text-xs" style={{ color: selectedPlan.accentColor }}>Plan</span>
                    <span className="text-sm font-bold" style={{ color: selectedPlan.accentColor }}>{selectedPlan.name}</span>
                  </div>
                </div>

                {/* Total */}
                <div
                  className="p-4 rounded-xl mb-5"
                  style={{ background: '#f8fafc' }}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-500">Subtotal</span>
                    <span className="text-sm text-gray-900">₹{selectedPlan.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-500">Tax</span>
                    <span className="text-sm text-emerald-600">₹0</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">Total</span>
                    <span
                      className="text-2xl font-bold"
                      style={{ color: selectedPlan.accentColor }}
                    >
                      ₹{selectedPlan.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Pay Button */}
                <Button
                  className="w-full py-5 text-sm font-semibold rounded-xl transition-all duration-200"
                  style={{
                    background: processing ? '#d1d5db' : selectedPlan.bgGradient,
                    boxShadow: processing ? 'none' : `0 8px 24px -4px ${selectedPlan.accentColor}40`
                  }}
                  onClick={handlePayment}
                  disabled={processing}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Pay ₹{selectedPlan.price.toLocaleString()}
                    </span>
                  )}
                </Button>

                {/* Trust */}
                <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                  <div className="flex items-center justify-center gap-4 text-gray-400">
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span className="text-xs">Secure</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span className="text-xs">Encrypted</span>
                    </div>
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
