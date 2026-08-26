import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, Building2, Phone, MapPin, Mail, Package,
  CheckCircle, Clock, Ban, Compass, Star, CheckCircle2, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import BusinessPageShell from './BusinessPageShell';
import { Card, SectionHeading, StatTile, Loading, Chip } from './BusinessUI';
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

interface Company {
  _id: string;
  businessName: string;
  description: string;
  businessType: string;
  mobileNumber: string;
  email?: string;
  area: string;
  location: string;
  logo: string;
  /**
   * `pending | active | inactive` — the enum on `company.model.js`. This was
   * typed `'pending' | 'approved' | 'rejected'`, which are *application*
   * statuses; no company document has ever carried them.
   */
  status: 'pending' | 'active' | 'inactive';
  /** Listed in the Discover directory. NOT "is the active company". */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const STATUS_TONES: Record<string, { tone: 'green' | 'red' | 'amber'; Icon: LucideIcon }> = {
  active: { tone: 'green', Icon: CheckCircle },
  inactive: { tone: 'red', Icon: Ban },
  pending: { tone: 'amber', Icon: Clock },
};

const CompanyDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const { activeCompanyId, setActiveCompany, loadCompanies } = useActiveCompanyStore();

  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, featured: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCompany = async () => {
    try {
      const response = await apiFetch(`/business-profiles/${id}`);
      const result = await response.json();

      if (result.success) {
        setCompany(result.data);
      } else {
        toast.error('Failed to fetch company details');
        navigate('/business/companies');
        return;
      }
    } catch (error) {
      console.error('Error fetching company:', error);
      toast.error('Failed to fetch company details');
      navigate('/business/companies');
      return;
    } finally {
      setLoading(false);
    }

    // Real catalog figures, from the endpoint that serves them. Three hardcoded
    // zeros labelled "Products / Views / Connections" used to sit on this page;
    // none of them was ever fetched from anything.
    try {
      const res = await apiFetch(`/products/stats?companyId=${encodeURIComponent(String(id))}`);
      const body = await res.json();
      const data = body?.data || {};
      setStats({
        total: Number(data.total || 0),
        active: Number(data.active || 0),
        featured: Number(data.featured || 0),
      });
    } catch (err) {
      console.warn('Catalog stats safely caught:', err);
    }
  };

  /**
   * Switch which company every business screen is acting as.
   *
   * What stood here was a no-op that faked its own success response:
   *
   *     const response = { ok: true, json: async () => ({ success: true }) };
   *
   * It made no network call, reported "Company set as active", and changed
   * nothing — the same bug that was found and fixed in My Companies, and missed
   * here. There is no server call to make: which company a member is working on
   * is a client-side preference, exactly as it is on mobile, and it lives in the
   * shared `ActiveCompanyContext`.
   *
   * The button was also gated on `company.isActive`, which is the Discover
   * directory-listing flag — an unrelated field that happens to share the word.
   */
  const handleSetActive = () => {
    if (!company?._id) return;
    setActiveCompany(company._id);
    toast.success(`Now working on ${company.businessName}`);
    window.dispatchEvent(new Event('companyUpdated'));
  };

  const handleDelete = async () => {
    try {
      const response = await apiFetch(`/business-profiles/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast.success('Company deleted successfully');
        // The deleted company must not stay selected anywhere.
        if (activeCompanyId === id) setActiveCompany(null);
        await loadCompanies({ force: true });
        navigate('/business/companies');
      } else {
        toast.error('Failed to delete company');
      }
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Failed to delete company');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <BusinessPageShell title="Company Profile" width="standard">
        <Loading label="Loading company…" />
      </BusinessPageShell>
    );
  }

  if (!company) {
    return (
      <BusinessPageShell title="Company Profile" width="standard">
        <Card>
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-800">Company not found</p>
            <p className="text-sm text-slate-500 mt-1">
              The company you are looking for does not exist.
            </p>
          </div>
        </Card>
      </BusinessPageShell>
    );
  }

  const status = (company.status || 'pending').toLowerCase();
  const tone = STATUS_TONES[status] || STATUS_TONES.pending;
  const isSelected = activeCompanyId === company._id;

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <BusinessPageShell
      title="Company Profile"
      subtitle={company.businessName}
      width="standard"
      actions={
        <>
          <Button
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => navigate('/business/companies')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">All Companies</span>
          </Button>
          <Button
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(`/business/companies/edit/${company._id}`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          <Button
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Identity */}
        <Card className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
            {/* Re-anchored to the API origin — see resolveMediaUrl. */}
            {company.logo ? (
              <img
                src={resolveMediaUrl(company.logo)}
                alt={company.businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="h-10 w-10 text-slate-400" />
            )}
          </span>

          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 truncate">{company.businessName}</h2>
            <p className="text-sm text-slate-500">{company.businessType}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Chip tone={tone.tone} icon={tone.Icon}>
                <span className="capitalize">{status}</span>
              </Chip>
              <Chip tone={company.isActive ? 'blue' : 'slate'} icon={Compass}>
                {company.isActive ? 'Listed in Discover' : 'Hidden from Discover'}
              </Chip>
              {isSelected && (
                <Chip tone="green" icon={CheckCircle}>Active company</Chip>
              )}
            </div>
          </div>

          {!isSelected && (
            <Button className="bg-blue-600 hover:bg-blue-700 shrink-0" onClick={handleSetActive}>
              Switch to this company
            </Button>
          )}
        </Card>

        {/* Catalog figures */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatTile label="Catalog Products" value={stats.total} unit="Total listed" icon={Package} />
          <StatTile label="Live Products" value={stats.active} unit="Visible in Discover" icon={CheckCircle2} />
          <StatTile label="Featured" value={stats.featured} unit="Promoted items" icon={Star} />
        </div>

        {/*
            Two columns from lg up. These four panels used to be a single
            `space-y-6` stack of full-width cards; Contact and Timeline between
            them hold about five short key/value pairs and took two full-width
            cards and ~400px of vertical space to say it.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <SectionHeading title="About" icon={Building2} />
            <p className="text-sm text-slate-600 leading-relaxed">
              {company.description || 'No description provided.'}
            </p>
          </Card>

          <Card>
            <SectionHeading title="Contact Information" icon={Phone} />
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Mobile</dt>
                  <dd className="text-slate-800 font-medium">{company.mobileNumber || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Email</dt>
                  <dd className="text-slate-800 font-medium truncate">{company.email || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Location</dt>
                  <dd className="text-slate-800 font-medium">
                    {[company.area, company.location].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
              </div>
            </dl>
          </Card>

          <Card className="lg:col-span-2">
            <SectionHeading title="Timeline" icon={Clock} />
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <dt className="text-slate-500">Registered</dt>
                <dd className="text-slate-800 font-medium">{formatDate(company.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-800 font-medium">{formatDate(company.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete "{company.businessName}"? Its products and listing are
              removed with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BusinessPageShell>
  );
};

export default CompanyDetails;
