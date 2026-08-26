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
import { getAdminApplications, approveApplication, rejectApplication, errorMessage, getAdminDashboard, toApplicationRecord, getApplicationProfile, type Applicant } from "@/services/activApi";
import ApprovalQueue, { type ApplicantBuckets, type BucketKey } from "@/components/ApprovalQueue";
import ProfileViewModal from "@/components/ui/profile-view-modal";

// Backend application types
type StageKey = 'block' | 'district' | 'state' | 'payment';
interface Stage { id: number; key: StageKey; title: string; reviewer: string; status: string; reviewDate: string | null; notes: string; }
interface ApplicationRec {
  id: string;
  userId: string;
  submittedAt: string;
  status: string; // 'Under Review' | 'Rejected' | 'Ready for Payment'
  stage: number; // 1-based index
  stages: Stage[];
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

  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
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
      const st = getCurrentStage(a);
      if (a.status === 'Rejected') {
        rejected.push(a);
        continue;
      }
      if (a.status === 'Ready for Payment') {
        // treat as approved for listing purposes
        approved.push(a);
        continue;
      }
      if (st?.key === desiredStage) {
        if (st.status === 'Under Review') pending.push(a);
        else if (st.status === 'Approved') approved.push(a);
        else if (st.status === 'Rejected') rejected.push(a);
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

  /**
   * Load the real application queue.
   *
   * What stood here was three invented applicants — "John Doe", "Jane Smith",
   * "Robert Brown" — rendered as if they were live data. A Super Admin reading
   * this screen had no way to tell it was fiction.
   */
  const load = async () => {
    try {
      const dashboard = await getAdminDashboard();
      setServerBuckets({
        pending: dashboard.applicants?.pending || [],
        approved: dashboard.applicants?.approved || [],
        rejected: dashboard.applicants?.rejected || [],
        all: dashboard.applicants?.all || [],
      });
      setApplications((dashboard.applicants?.all || []).map(toApplicationRecord) as unknown as ApplicationRec[]);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load applications'));
      setApplications([]);
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
  /**
   * The applicant detail view, opened from the queue.
   *
   * The three tier queues gained this; super admin was the one that still had
   * no way to open an application from its own queue. A super admin acts on
   * whichever tier the file currently sits at, so the decision buttons are
   * handed through here too.
   */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailProfile, setDetailProfile] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailApplicant, setDetailApplicant] = useState<Applicant | null>(null);

  const openDetail = async (applicant: Applicant) => {
    setDetailApplicant(applicant);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const profile = await getApplicationProfile(applicant.id);
      setDetailProfile({
        ...(profile || {}),
        stage: applicant.stage,
        statusLabel: applicant.statusLabel,
        rejectionReason: applicant.rejectionReason || (profile as any)?.rejectionReason || '',
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load application data'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

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
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        toast.error('Please login again');
        return;
      }

      // The caller's role decides which tier's review runs, so one button
      // works from any admin dashboard.
      await approveApplication(id);

      toast.success('Application approved successfully');
      await load(); // Reload applications
      
    } catch (error) {
      console.error('❌ Error approving application:', error);
      toast.error('Failed to approve application');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      
      if (!token) {
        toast.error('Please login again');
        return;
      }

      // `rejectionReason` is the field the schema stores; `remarks` was dropped
      // silently by Mongoose strict mode, so every reason was lost.
      await rejectApplication(id, 'Application rejected');

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
              level="super"
              activeFilter={tab as BucketKey}
              onFilterChange={(f) => setTab(f as typeof tab)}
              onReview={handleReview}
              onPressApplicant={openDetail}
            />
          </div>
        </div>
      </div>
      <ProfileViewModal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailProfile(null); setDetailApplicant(null); }}
        profile={detailProfile}
        loading={detailLoading}
        onReview={async (action, reason) => {
          if (detailApplicant) await handleReview(detailApplicant, action, reason);
        }}
      />
      <Toaster />
    </div>
  );
};

export default Approvals;
