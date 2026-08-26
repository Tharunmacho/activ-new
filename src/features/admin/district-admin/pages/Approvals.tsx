import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import ApprovalCard from "@/components/ui/approval-card";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiFetch, dashboardPathForRole, toApplicationRecord, getAdminDashboard, approveApplication, rejectApplication, errorMessage, type Applicant } from "@/services/activApi";
import ApprovalQueue, { type ApplicantBuckets, type BucketKey } from "@/components/ApprovalQueue";

// Backend application types
type StageKey = 'block' | 'district' | 'state' | 'payment';
interface Stage { id: number; key: StageKey; title: string; reviewer: string; status: string; reviewDate: string | null; notes: string; }
interface MemberData {
  name: string;
  email: string;
  phone: string;
  gender?: string;
  block?: string;
  district?: string;
  state?: string;
  memberType?: string;
  registrationDate?: string;
}
interface ApplicationRec {
  id: string;
  userId: string;
  submittedAt: string;
  status: string; // 'Under Review' | 'Rejected' | 'Ready for Payment'
  stage: number; // 1-based index
  stages: Stage[];
  memberData?: MemberData;
  profile?: any;
}

const Approvals = () => {
  const [applications, setApplications] = useState<ApplicationRec[]>([]);
  /**
   * The buckets exactly as the server computed them.
   *
   * `classifyForLevel` decides what this tier may act on, including the two
   * stages it can see but not touch: `upstream` (still with an earlier tier)
   * and `closed` (rejected by a different tier). Deriving buckets on the client
   * loses both, and mis-files anything whose status spelling it cannot match.
   */
  const [serverBuckets, setServerBuckets] = useState<ApplicantBuckets>({
    pending: [], approved: [], rejected: [], all: [],
  });

  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('all');
  const role = (localStorage.getItem('role') || 'block_admin') as string;

  const stageByRole: Record<string, StageKey> = {
    super_admin: 'payment',
    state_admin: 'state',
    district_admin: 'district',
    block_admin: 'block',
    member: 'block',
  };

  // Helpers to compute current stage and bucket by status
  const desiredStage: StageKey = stageByRole[role] ?? 'block';
  const getCurrentStage = (a: ApplicationRec): Stage | null => {
    const idx = Math.max(1, Math.min(Number(a.stage) || 1, (a.stages || []).length)) - 1;
    return a.stages?.[idx] ?? null;
  };

  const buckets = useMemo(() => {
    const pending: ApplicationRec[] = [];
    const approved: ApplicationRec[] = [];
    const rejected: ApplicationRec[] = [];
    const all: ApplicationRec[] = [...applications];
    
    for (const a of applications) {
      // Find THIS admin's stage (district)
      const myStage = a.stages.find(s => s.key === desiredStage);
      
      if (!myStage) continue;
      
      // Pending: Currently at this admin's stage waiting for review
      if (myStage.status === 'Under Review' || myStage.status === 'Pending') {
        pending.push(a);
      }
      // Approved: THIS admin has approved it
      else if (myStage.status === 'Approved') {
        approved.push(a);
      }
      // Rejected: THIS admin rejected it
      else if (myStage.status === 'Rejected') {
        rejected.push(a);
      }
    }
    
    return { pending, approved, rejected, all };
  }, [applications, desiredStage]);

  const stats = useMemo(() => ({
    total: applications.length,
    pending: buckets.pending.length,
    approved: buckets.approved.length,
    rejected: buckets.rejected.length,
  }), [applications.length, buckets.pending.length, buckets.approved.length, buckets.rejected.length]);

  const load = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('❌ No admin token found');
        toast.error('Please login again');
        return;
      }

      const response = await apiFetch(dashboardPathForRole(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }

      // The dashboard already carries the per-tier bucket and every
      // approval timestamp; `toApplicationRecord` maps that directly.
      // The block this replaces read `app.approvals.block.status`,
      // `app.memberName` and `app.status === 'pending_block_approval'` —
      // none of which this backend returns, so every row rendered as
      // "Under Review" at stage 1 with an "Unknown" applicant.
      const data = await response.json();
      const buckets = data.data?.applicants || {};
      setServerBuckets({
        pending: buckets.pending || [],
        approved: buckets.approved || [],
        rejected: buckets.rejected || [],
        all: buckets.all || [],
      });
      const mappedApplications = (buckets.all || []).map(toApplicationRecord);

      setApplications(mappedApplications);

    } catch (error) {
      console.error('❌ Error loading district applications:', error);
      toast.error('Failed to load applications');
    }
  };

  useEffect(() => { load(); }, []);

  /**
   * Approve or reject, then refetch.
   *
   * The reason is whatever the admin typed. It used to be the constant string
   * "Application rejected", sent as `remarks` -- a field the schema does not
   * have -- so every applicant received the same non-explanation, and even that
   * was dropped by Mongoose before it reached the database.
   */
  const handleReview = async (
    applicant: Applicant,
    action: 'approve' | 'reject',
    reason?: string,
  ) => {
    try {
      if (action === 'approve') {
        await approveApplication(applicant.id);
        toast.success('Application approved');
      } else {
        await rejectApplication(applicant.id, (reason || '').trim() || 'No reason given');
        toast.success('Application rejected');
      }
      await load();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not ' + action + ' the application'));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login again');
        return;
      }

      const response = await apiFetch(`/applications/${id}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to approve application');
      }

      const data = await response.json();
      
      toast.success('Application approved successfully');
      await load(); // Reload applications
      
    } catch (error) {
      console.error('❌ Error approving application:', error);
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login again');
        return;
      }

      const response = await apiFetch(`/applications/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rejectionReason: 'Rejected by district admin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject application');
      }

      const data = await response.json();
      
      toast.success('Application rejected successfully');
      await load(); // Reload applications
      
    } catch (error) {
      console.error('❌ Error rejecting application:', error);
      toast.error('Failed to reject application');
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar - Responsive */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile Header - Only visible on mobile */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Approvals</h1>
          <Avatar className="w-10 h-10 ring-2 ring-blue-100">
            <AvatarImage src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=face" className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-bold">
              {(localStorage.getItem('userName') || 'A').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="w-full max-w-7xl mx-auto space-y-5 md:space-y-6 pt-12 lg:pt-0">
            {/* Header */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl p-6 rounded-2xl border border-blue-500">
              <h1 className="text-3xl font-bold text-white">Application Approvals</h1>
              <p className="text-blue-100 mt-1">Review and manage member applications</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 border border-blue-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                <p className="text-blue-100 text-sm mb-2 font-medium">Total</p>
                <p className="text-4xl font-bold text-white">{stats.total}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 border border-purple-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                <p className="text-purple-100 text-sm mb-2 font-medium">Pending</p>
                <p className="text-4xl font-bold text-white">{stats.pending}</p>
              </div>

              <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-2xl p-6 border border-cyan-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                <p className="text-cyan-100 text-sm mb-2 font-medium">Approved</p>
                <p className="text-4xl font-bold text-white">{stats.approved}</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 border border-indigo-500 shadow-xl hover:shadow-2xl transition-all duration-300">
                <p className="text-indigo-100 text-sm mb-2 font-medium">Rejected</p>
                <p className="text-4xl font-bold text-white">{stats.rejected}</p>
              </div>
            </div>

            {/* Tabs */}
            {/* One queue, same rules as the mobile app: server buckets,
                only a `pending` file is actionable, a rejection carries a
                typed reason, and an escalated file says why it is here. */}
            <ApprovalQueue
              buckets={serverBuckets}
              level="district"
              activeFilter={tab as BucketKey}
              onFilterChange={(f) => setTab(f as typeof tab)}
              onReview={handleReview}
            />
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
};

export default Approvals;
