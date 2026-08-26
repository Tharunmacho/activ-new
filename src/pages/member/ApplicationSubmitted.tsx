import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Download, Eye, Home, Calendar, FileText, Clock, ArrowRight, Shield, Bell, Mail } from 'lucide-react';

export default function ApplicationSubmitted() {
  const navigate = useNavigate();

  // Get application ID from localStorage (set after profile completion)
  const id = localStorage.getItem('applicationId') || 'ACTV2024001';

  if (!id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
        }}
      >
        <Card
          className="max-w-md w-full border-0"
          style={{
            borderRadius: '20px',
            boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.12)'
          }}
        >
          <CardContent className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: '#fef3c7' }}
            >
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Application Found</h3>
            <p className="text-sm text-gray-500 mb-6">Please submit your application first.</p>
            <Button
              className="w-full py-5 rounded-xl font-semibold"
              style={{
                background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                boxShadow: '0 8px 24px -4px rgba(15, 118, 110, 0.4)'
              }}
              onClick={() => navigate('/member/dashboard')}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const steps = [
    {
      id: 1,
      title: 'Application Received',
      description: 'Your application has been received and assigned for review.',
      status: 'completed',
      icon: CheckCircle
    },
    {
      id: 2,
      title: 'Block Admin Review',
      description: 'Pending review by block administrator.',
      status: 'in-progress',
      icon: Clock
    },
    {
      id: 3,
      title: 'District Admin Review',
      description: 'Pending review by district administrator.',
      status: 'pending',
      icon: Clock
    },
    {
      id: 4,
      title: 'State Admin Review',
      description: 'Pending review by state administrator.',
      status: 'pending',
      icon: Clock
    },
    {
      id: 5,
      title: 'Final Approval',
      description: 'Final approval and membership activation.',
      status: 'pending',
      icon: FileText
    }
  ];

  return (
    <div
      className="min-h-screen py-8 px-4 md:px-6"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif"
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Success Header */}
        <div
          className="rounded-3xl overflow-hidden mb-6"
          style={{
            boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.15)'
          }}
        >
          {/* Success Banner */}
          <div
            className="p-8 md:p-12 text-center"
            style={{ background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'rgba(255, 255, 255, 0.15)' }}
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-3">
              Application Submitted!
            </h1>
            <p className="text-teal-100 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Your membership application has been successfully submitted and is now under review.
            </p>
          </div>

          {/* Application Summary */}
          <div className="bg-white p-5 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: '#f8fafc' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' }}
                >
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Application ID</p>
                  <p className="font-bold text-gray-900">{id}</p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: '#f8fafc' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}
                >
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Submitted On</p>
                  <p className="font-semibold text-gray-900 text-sm">{today}</p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: '#f8fafc' }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                >
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current Status</p>
                  <span
                    className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: '#fef3c7', color: '#b45309' }}
                  >
                    Under Review
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Progress Steps */}
          <div className="lg:col-span-2">
            <Card
              className="border-0"
              style={{
                borderRadius: '20px',
                boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.08)'
              }}
            >
              <CardContent className="p-6 md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-6">Review Progress</h2>

                <div className="space-y-0">
                  {steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isInProgress = step.status === 'in-progress';
                    const Icon = step.icon;

                    return (
                      <div key={step.id} className="flex gap-4">
                        {/* Step Indicator */}
                        <div className="flex flex-col items-center">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                            style={{
                              background: isCompleted
                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                : isInProgress
                                  ? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
                                  : '#e2e8f0',
                              boxShadow: isCompleted || isInProgress
                                ? '0 4px 12px -2px rgba(0, 0, 0, 0.15)'
                                : 'none'
                            }}
                          >
                            <Icon className={`w-5 h-5 ${isCompleted || isInProgress ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          {index < steps.length - 1 && (
                            <div
                              className="w-0.5 h-12 my-1 rounded-full"
                              style={{
                                background: isCompleted ? '#10b981' : '#e2e8f0'
                              }}
                            />
                          )}
                        </div>

                        {/* Step Content */}
                        <div className="flex-1 pb-6">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900">{step.title}</h4>
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                              style={{
                                background: isCompleted ? '#dcfce7' : isInProgress ? '#dbeafe' : '#f1f5f9',
                                color: isCompleted ? '#166534' : isInProgress ? '#1e40af' : '#64748b'
                              }}
                            >
                              {isCompleted ? 'Done' : isInProgress ? 'In Progress' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{step.description}</p>

                          {isInProgress && (
                            <div
                              className="mt-3 p-3 rounded-xl flex items-center gap-2"
                              style={{ background: '#eff6ff' }}
                            >
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-xs text-blue-700">Expected: 2-3 business days</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right - Actions & Info */}
          <div className="lg:col-span-1 space-y-5">
            {/* Important Notice */}
            <Card
              className="border-0 overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.08)'
              }}
            >
              <div
                className="p-5"
                style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: '#f59e0b' }}
                  >
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-bold text-amber-900">Important</h3>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs text-amber-800">
                    <span className="w-1 h-1 rounded-full bg-amber-600 mt-1.5 flex-shrink-0"></span>
                    <span>Keep your Application ID <strong>{id}</strong> safe</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-amber-800">
                    <span className="w-1 h-1 rounded-full bg-amber-600 mt-1.5 flex-shrink-0"></span>
                    <span>Review takes 5-7 business days</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-amber-800">
                    <span className="w-1 h-1 rounded-full bg-amber-600 mt-1.5 flex-shrink-0"></span>
                    <span>Updates via email & SMS</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Notifications Info */}
            <Card
              className="border-0"
              style={{
                borderRadius: '20px',
                boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.08)'
              }}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: '#eff6ff' }}
                  >
                    <Bell className="w-4 h-4 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">Stay Updated</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span>Email notifications enabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    <span>SMS alerts active</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                className="w-full py-5 rounded-xl font-semibold text-sm transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
                  boxShadow: '0 8px 24px -4px rgba(15, 118, 110, 0.4)'
                }}
                onClick={() => navigate(`/member/application-status?id=${id}`)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View Full Status
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                variant="outline"
                className="w-full py-5 rounded-xl font-semibold text-sm border-2"
                style={{ borderColor: '#e2e8f0', color: '#475569' }}
                onClick={() => {
                  const applicationData = {
                    id: id,
                    submittedDate: `${today}, ${time}`,
                    status: 'Under Review'
                  };
                  const blob = new Blob([JSON.stringify(applicationData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Application_${id}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Copy
              </Button>

              <Button
                variant="ghost"
                className="w-full py-5 rounded-xl font-semibold text-sm"
                style={{ color: '#64748b' }}
                onClick={() => navigate('/member/dashboard')}
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
