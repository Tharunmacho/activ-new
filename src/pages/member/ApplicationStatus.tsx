import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Info, CheckCircle, Clock, FileText, Loader2, RefreshCw, CreditCard, User, Mail, Phone, MapPin, Briefcase, ArrowLeft, XCircle, Calendar, Building2, Shield } from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

interface ApprovalStatus {
  adminId?: string;
  adminName?: string;
  status: string;
  remarks?: string;
  actionDate?: string;
}

/**
 * The page-local shape, kept loose on purpose.
 *
 * The authoritative type lives in `services/applicationApi` and is derived from
 * the backend schema. Re-declaring a stricter copy here is how the two drifted:
 * this one still named `memberName`, a field the server has never returned.
 */
type Application = Awaited<ReturnType<typeof getUserApplication>>;

export default function ApplicationStatus() {
  const q = useQuery();
  const id = q.get('id');
  const navigate = useNavigate();
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  useEffect(() => {
    loadApplicationData();
  }, []);

  const loadApplicationData = async () => {
    setLoading(true);
    try {

      const app = await getUserApplication();

      if (app) {
        setApplication(app);
      } else {
        const data = localStorage.getItem("applicationSubmission");
        if (data) {
          setSubmissionData(JSON.parse(data));
        }
      }
    } catch (error) {
      console.error('❌ Error loading application:', error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: '#ffffff',
          fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"
        }}
      >
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4)'
            }}
          >
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Application</h2>
          <p className="text-gray-500">Please wait while we fetch your application status...</p>
        </div>
      </div>
    );
  }

  // Build stages from real application data
  const getStagesFromApplication = () => {
    if (!application) {
      return [
        { id: 1, name: 'Block Admin', admin: 'Pending Assignment', status: 'pending', remarks: '', icon: FileText },
        { id: 2, name: 'District Admin', admin: 'Pending Assignment', status: 'pending', remarks: '', icon: FileText },
        { id: 3, name: 'State Admin', admin: 'Pending Assignment', status: 'pending', remarks: '', icon: FileText },
        { id: 4, name: 'Ready for Payment', admin: 'ACTIV Super Admin', status: 'pending', remarks: '', icon: CheckCircle }
      ];
    }

    const stages = [];

    // Block Admin Stage
    const blockAdmin = application.approvals.block;
    const isBlockInProgress = application.status === 'Pending-Block' && blockAdmin.status === 'pending';
    const isBlockCompleted = blockAdmin.status === 'approved';
    const isBlockRejected = blockAdmin.status === 'rejected';

    stages.push({
      id: 1,
      name: 'Block Admin',
      admin: blockAdmin.adminName || `${application.block} Block Admin`,
      status: isBlockRejected ? 'rejected' :
        isBlockCompleted ? 'completed' :
          isBlockInProgress ? 'in-progress' : 'pending',
      remarks: blockAdmin.remarks || '',
      actionDate: blockAdmin.actionDate,
      icon: FileText
    });

    // District Admin Stage
    const districtAdmin = application.approvals.district;
    const isDistrictInProgress = application.status === 'Pending-District' && districtAdmin.status === 'pending';
    const isDistrictCompleted = districtAdmin.status === 'approved';
    const isDistrictRejected = districtAdmin.status === 'rejected';

    stages.push({
      id: 2,
      name: 'District Admin',
      admin: districtAdmin.adminName || `${application.district} District Admin`,
      status: isDistrictRejected ? 'rejected' :
        isDistrictCompleted ? 'completed' :
          isDistrictInProgress ? 'in-progress' : 'pending',
      remarks: districtAdmin.remarks || '',
      actionDate: districtAdmin.actionDate,
      icon: FileText
    });

    // State Admin Stage
    const stateAdmin = application.approvals.state;
    const isStateInProgress = application.status === 'Pending-State' && stateAdmin.status === 'pending';
    const isStateCompleted = stateAdmin.status === 'approved';
    const isStateRejected = stateAdmin.status === 'rejected';

    stages.push({
      id: 3,
      name: 'State Admin',
      admin: stateAdmin.adminName || `${application.state} State Admin`,
      status: isStateRejected ? 'rejected' :
        isStateCompleted ? 'completed' :
          isStateInProgress ? 'in-progress' : 'pending',
      remarks: stateAdmin.remarks || '',
      actionDate: stateAdmin.actionDate,
      icon: FileText
    });

    // Payment Stage
    stages.push({
      id: 4,
      name: 'Ready for Payment',
      admin: 'ACTIV Super Admin',
      status: application.status === 'Approved' ? 'completed' : 'pending',
      remarks: '',
      actionDate: undefined,
      icon: CheckCircle
    });

    return stages;
  };

  const stages = getStagesFromApplication();
  const completedStages = stages.filter(s => s.status === 'completed').length;
  const totalStages = stages.length;
  const progressPercentage = (completedStages / totalStages) * 100;

  // Check if application was rejected
  const isRejected = stages.some(s => s.status === 'rejected');

  // If coming from query parameter (old flow), show approval stages
  if (id || application) {
    return (
      <div
        className="min-h-screen p-6 lg:p-8"
        style={{
          background: '#ffffff',
          fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"
        }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/member/dashboard')}
                style={{
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB'
                }}
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Button>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Application Status</h1>
                <p className="text-gray-500 text-sm lg:text-base">Track your membership approval progress</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={loadApplicationData}
                style={{
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '10px 16px'
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-gray-700">Refresh</span>
              </Button>
              {application && (
                <div
                  className="px-4 py-2 rounded-xl"
                  style={{
                    background: '#F3F4F6',
                    border: '1px solid #E5E7EB'
                  }}
                >
                  <span className="text-sm text-gray-500">ID: </span>
                  <span className="font-mono font-semibold text-gray-900">{application.applicationId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left Column - Progress Overview */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <Card
                className="border-0"
                style={{
                  boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                  borderRadius: '16px'
                }}
              >
                <CardContent className="p-6 lg:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">Overall Progress</h2>
                      <p className="text-gray-500">{completedStages} of {totalStages} stages completed</p>
                    </div>
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: progressPercentage === 100
                          ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        boxShadow: progressPercentage === 100
                          ? '0 10px 30px -5px rgba(16, 185, 129, 0.4)'
                          : '0 10px 30px -5px rgba(59, 130, 246, 0.4)'
                      }}
                    >
                      <span className="text-xl font-bold text-white">{Math.round(progressPercentage)}%</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className="w-full h-3 rounded-full overflow-hidden mb-8"
                    style={{ background: '#E5E7EB' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${progressPercentage}%`,
                        background: progressPercentage === 100
                          ? 'linear-gradient(90deg, #10B981 0%, #059669 100%)'
                          : 'linear-gradient(90deg, #3b82f6 0%, #8B5CF6 100%)'
                      }}
                    />
                  </div>

                  {/* Stage Indicators */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stages.map((stage, index) => {
                      const isCompleted = stage.status === 'completed';
                      const isInProgress = stage.status === 'in-progress';
                      const isStageRejected = stage.status === 'rejected';

                      return (
                        <div
                          key={stage.id}
                          className="flex flex-col items-center p-4 rounded-xl transition-all duration-200"
                          style={{
                            background: isCompleted ? '#F0FDF4' : isInProgress ? '#EFF6FF' : isStageRejected ? '#FEF2F2' : '#F9FAFB',
                            border: `1px solid ${isCompleted ? '#BBF7D0' : isInProgress ? '#BFDBFE' : isStageRejected ? '#FECACA' : '#E5E7EB'}`
                          }}
                        >
                          <div
                            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                            style={{
                              background: isCompleted
                                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                : isInProgress
                                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                                  : isStageRejected
                                    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                                    : '#D1D5DB',
                              boxShadow: isCompleted || isInProgress
                                ? '0 4px 12px -2px rgba(0, 0, 0, 0.15)'
                                : 'none'
                            }}
                          >
                            {isCompleted && <CheckCircle className="w-7 h-7 text-white" />}
                            {isInProgress && <Clock className="w-7 h-7 text-white animate-pulse" />}
                            {isStageRejected && <XCircle className="w-7 h-7 text-white" />}
                            {!isCompleted && !isInProgress && !isStageRejected && <div className="w-3 h-3 bg-white rounded-full" />}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 text-center mb-1">{stage.name}</p>
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              background: isCompleted ? '#DCFCE7' : isInProgress ? '#DBEAFE' : isStageRejected ? '#FEE2E2' : '#F3F4F6',
                              color: isCompleted ? '#166534' : isInProgress ? '#1E40AF' : isStageRejected ? '#991B1B' : '#6B7280'
                            }}
                          >
                            {isCompleted ? 'Approved' : isInProgress ? 'In Review' : isStageRejected ? 'Rejected' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Stage Cards */}
              <div className="space-y-4">
                {stages.map((stage, index) => {
                  const isCompleted = stage.status === 'completed';
                  const isInProgress = stage.status === 'in-progress';
                  const isStageRejected = stage.status === 'rejected';

                  return (
                    <Card
                      key={stage.id}
                      className="border-0"
                      style={{
                        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                        borderRadius: '16px'
                      }}
                    >
                      <CardContent className="p-5 lg:p-6">
                        <div className="flex items-start gap-4">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isCompleted
                                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                                : isInProgress
                                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                                  : isStageRejected
                                    ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                                    : '#D1D5DB'
                            }}
                          >
                            {isCompleted && <CheckCircle className="w-6 h-6 text-white" />}
                            {isInProgress && <Clock className="w-6 h-6 text-white" />}
                            {isStageRejected && <XCircle className="w-6 h-6 text-white" />}
                            {!isCompleted && !isInProgress && !isStageRejected && <div className="w-3 h-3 bg-white rounded-full" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-lg font-bold text-gray-900">{stage.name}</h3>
                              <span
                                className="px-3 py-1 rounded-full text-xs font-semibold"
                                style={{
                                  background: isCompleted ? '#DCFCE7' : isInProgress ? '#DBEAFE' : isStageRejected ? '#FEE2E2' : '#F3F4F6',
                                  color: isCompleted ? '#166534' : isInProgress ? '#1E40AF' : isStageRejected ? '#991B1B' : '#6B7280'
                                }}
                              >
                                {isCompleted ? 'Approved' : isInProgress ? 'In Review' : isStageRejected ? 'Rejected' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-2">{stage.admin}</p>
                            {stage.remarks && (
                              <div
                                className="mt-3 p-3 rounded-lg"
                                style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                              >
                                <p className="text-sm text-gray-700">{stage.remarks}</p>
                              </div>
                            )}
                            {stage.actionDate && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(stage.actionDate).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Actions & Info */}
            <div className="space-y-6">
              {/* Payment Action Section */}
              {application?.status === 'Approved' && application?.paymentStatus !== 'completed' && (
                <Card
                  className="border-0 overflow-hidden"
                  style={{
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                    borderRadius: '16px'
                  }}
                >
                  <div
                    className="p-6"
                    style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    <div className="text-center">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                      >
                        <CheckCircle className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Application Approved!</h3>
                      <p className="text-green-100 text-sm mb-4">
                        Proceed to payment to complete your membership
                      </p>
                      <Button
                        className="w-full py-5 text-base font-semibold"
                        style={{
                          background: '#ffffff',
                          color: '#059669',
                          borderRadius: '12px'
                        }}
                        onClick={() => setShowPaymentDialog(true)}
                      >
                        <CreditCard className="w-5 h-5 mr-2" />
                        Register for Payment
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Payment Completed Section */}
              {application?.paymentStatus === 'completed' && (
                <Card
                  className="border-0 overflow-hidden"
                  style={{
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                    borderRadius: '16px'
                  }}
                >
                  <div
                    className="p-6"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}
                  >
                    <div className="text-center">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                      >
                        <Shield className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Membership Active</h3>
                      <p className="text-purple-100 text-sm mb-4">
                        Your membership is now active!
                      </p>
                      {/* A certificate and a payment-receipt view were offered
                          here. Neither exists: the backend has no endpoint for
                          either and the mobile app has no such screen, so both
                          buttons opened pages that rendered placeholder data. */}
                      <div className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full py-4"
                          style={{
                            background: 'transparent',
                            color: '#ffffff',
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderRadius: '12px'
                          }}
                          onClick={() => navigate('/member/profile-view')}
                        >
                          <FileText className="w-5 h-5 mr-2" />
                          View My Profile
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Info Card */}
              <Card
                className="border-0"
                style={{
                  boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                  borderRadius: '16px'
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: '#EFF6FF' }}
                    >
                      <Info className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Need Help?</h3>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    If you have any questions about your application status, please contact our support team.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    style={{
                      borderRadius: '10px',
                      border: '1px solid #E5E7EB'
                    }}
                  >
                    Contact Support
                  </Button>
                </CardContent>
              </Card>

              {/* Back to Dashboard */}
              <Button
                className="w-full py-5 text-base font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4)'
                }}
                onClick={() => navigate('/member/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </div>

          {/* Payment Registration Dialog */}
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent
              className="sm:max-w-md"
              style={{ borderRadius: '20px' }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                  >
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <DialogTitle className="text-2xl">Payment Registration</DialogTitle>
                </div>
                <DialogDescription className="text-base text-gray-600 mt-2">
                  You are about to proceed with the payment registration process.
                </DialogDescription>
              </DialogHeader>

              <div
                className="rounded-xl p-4 my-4"
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB' }}
              >
                <h4 className="font-semibold text-gray-900 mb-3">Next Steps:</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Complete payment process</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Receive membership confirmation</span>
                  </li>
                  <li className="flex items-center gap-2 text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Access member benefits</span>
                  </li>
                </ul>
              </div>

              <DialogFooter className="flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentDialog(false)}
                  className="flex-1"
                  style={{ borderRadius: '10px' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowPaymentDialog(false);

                    const isAspirant = application?.memberType === 'aspirant';

                    if (isAspirant) {
                      navigate('/payment/membership-plan');
                    } else {
                      navigate('/payment/membership-plans');
                    }
                  }}
                  className="flex-1"
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    borderRadius: '10px'
                  }}
                >
                  Proceed
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // No application found - show the detailed form view with mock data
  const applicationData = {
    applicationId: application?.applicationId || 'ACTV2024001',
    submittedDate: application?.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : '15 Dec 2024, 10:30 AM',
    personalInfo: {
      name: localStorage.getItem('userName') || 'John Doe',
      email: 'john.doe@example.com',
      phone: '+91 98765 43210',
      address: 'Mumbai, Maharashtra',
      occupation: 'Business Owner'
    }
  };

  return (
    <div
      className="min-h-screen p-6 lg:p-8"
      style={{
        background: '#ffffff',
        fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/member/dashboard')}
            style={{
              borderRadius: '12px',
              border: '1px solid #E5E7EB'
            }}
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Membership Application</h1>
            <p className="text-gray-500">Application Status & Review Progress</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Application Info Card */}
            <Card
              className="border-0 overflow-hidden"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                borderRadius: '16px'
              }}
            >
              <div
                className="p-6"
                style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)' }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                    >
                      <FileText className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Application ID</p>
                      <p className="text-xl font-bold text-white font-mono">{applicationData.applicationId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(59, 130, 246, 0.2)' }}
                    >
                      <span className="text-blue-300 font-semibold">Under Review</span>
                    </div>
                  </div>
                </div>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Submitted on {applicationData.submittedDate}</span>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card
              className="border-0"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                borderRadius: '16px'
              }}
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-900">Applicant Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                    >
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="font-semibold text-gray-900">{applicationData.personalInfo.name}</p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)' }}
                    >
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email Address</p>
                      <p className="font-semibold text-gray-900">{applicationData.personalInfo.email}</p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                    >
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone Number</p>
                      <p className="font-semibold text-gray-900">{applicationData.personalInfo.phone}</p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
                    >
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-semibold text-gray-900">{applicationData.personalInfo.address}</p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-4 p-4 rounded-xl md:col-span-2"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
                    >
                      <Briefcase className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Occupation</p>
                      <p className="font-semibold text-gray-900">{applicationData.personalInfo.occupation}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Section */}
            <Card
              className="border-0"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                borderRadius: '16px'
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-gray-900">Review Progress</CardTitle>
                  <span
                    className="px-3 py-1 rounded-full text-sm font-semibold"
                    style={{ background: '#DBEAFE', color: '#1E40AF' }}
                  >
                    {Math.round(progressPercentage)}% Complete
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Progress Bar */}
                <div
                  className="w-full h-3 rounded-full overflow-hidden mb-6"
                  style={{ background: '#E5E7EB' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPercentage || 5}%`,
                      background: 'linear-gradient(90deg, #3b82f6 0%, #8B5CF6 100%)'
                    }}
                  />
                </div>

                {/* Stage Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {stages.map((stage, index) => {
                    const isCompleted = stage.status === 'completed';
                    const isInProgress = stage.status === 'in-progress';
                    const Icon = stage.icon;

                    return (
                      <div
                        key={stage.id}
                        className="flex flex-col items-center p-4 rounded-xl"
                        style={{
                          background: isCompleted ? '#F0FDF4' : isInProgress ? '#EFF6FF' : '#F9FAFB',
                          border: `1px solid ${isCompleted ? '#BBF7D0' : isInProgress ? '#BFDBFE' : '#E5E7EB'}`
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                          style={{
                            background: isCompleted
                              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                              : isInProgress
                                ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                                : '#D1D5DB'
                          }}
                        >
                          <Icon className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 text-center mb-1">{stage.name}</p>
                        <p className="text-xs text-gray-500 text-center mb-2">{stage.admin}</p>
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: isCompleted ? '#DCFCE7' : isInProgress ? '#DBEAFE' : '#F3F4F6',
                            color: isCompleted ? '#166534' : isInProgress ? '#1E40AF' : '#6B7280'
                          }}
                        >
                          {isCompleted ? 'Approved' : isInProgress ? 'In Review' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Current Status Card */}
            <Card
              className="border-0 overflow-hidden"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                borderRadius: '16px'
              }}
            >
              <div
                className="p-6"
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-6 h-6 text-white" />
                  <h3 className="text-lg font-bold text-white">Currently Under Review</h3>
                </div>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Your application is being reviewed by the Block Admin. This process typically takes 2-3 business days.
                </p>
              </div>
            </Card>

            {/* Next Steps */}
            <Card
              className="border-0"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.08)',
                borderRadius: '16px'
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: '#F0FDF4' }}
                  >
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Next Steps</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Once all approval stages are complete, you will be notified via email and SMS to proceed with payment.
                </p>
              </CardContent>
            </Card>

            {/* Back to Dashboard */}
            <Button
              className="w-full py-5 text-base font-semibold"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '12px',
                boxShadow: '0 10px 30px -5px rgba(59, 130, 246, 0.4)'
              }}
              onClick={() => navigate('/member/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
