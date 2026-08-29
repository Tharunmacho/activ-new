import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Eye, Pencil, Trash2, CheckCircle, Package } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, EmptyState, Loading, Chip } from "./BusinessUI";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

interface Company {
  _id: string;
  businessName: string;
  description: string;
  businessType: string;
  mobileNumber: string;
  area: string;
  location: string;
  logo: string;
  status: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * The company `status` vocabulary is `pending | active | inactive` — the enum on
 * `company.model.js`. This screen switched on 'approved' and 'rejected', which
 * are *application* statuses and never appear on a company, so every company
 * fell through to the amber default however long it had been active.
 */
const STATUS_TONES: Record<string, 'green' | 'red' | 'amber'> = {
  active: 'green',
  inactive: 'red',
  pending: 'amber',
};

const MyCompanies = () => {
  const navigate = useNavigate();
  /**
   * This screen is the one place a company switch is made, matching
   * `ManageCompaniesScreen` on mobile. `activeCompanyId` is the selection;
   * `company.isActive` is something else entirely — whether the company is
   * listed in the Discover directory — and this screen used to read that field
   * to decide which card showed the "Active" badge and which showed the
   * "Set as Active" button. Two unrelated flags, one label.
   */
  const { activeCompanyId, setActiveCompany, loadCompanies: reloadStore } = useActiveCompanyStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await apiFetch("/business-profiles/all");

      if (response.ok) {
        const result = await response.json();
        setCompanies(result.data || []);
      }

      // Keep the shared selection in step: a company deleted elsewhere must not
      // stay selected, and a member arriving here with none chosen gets one.
      reloadStore({ force: true });
    } catch (error) {
      console.error("Error loading companies:", error);
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const response = await apiFetch(`/business-profiles/${deleteId}`, { method: "DELETE" });

      if (response.ok) {
        toast.success("Company deleted successfully");
        // Deleting the company being acted as leaves a dangling selection; the
        // store falls back to the first remaining company on reload.
        loadCompanies();
      } else {
        toast.error("Failed to delete company");
      }
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company");
    } finally {
      setDeleteId(null);
    }
  };

  /**
   * Switch which company every business screen is acting as.
   *
   * There is no server call to make and there never was: which company a
   * member is working on is a client-side preference, exactly as it is on
   * mobile. What stood here built a fake `{ ok: true }` response, reported
   * "Company set as active", and changed nothing at all — the reason switching
   * company appeared to do nothing.
   */
  const handleSetActive = (companyId: string) => {
    const company = companies.find((c) => c._id === companyId);
    setActiveCompany(companyId);
    toast.success(
      company ? `Now working on ${company.businessName}` : "Active company switched",
    );
    // The sidebar and any open screen re-read the store; this event is kept for
    // the screens that still listen for it.
    window.dispatchEvent(new Event('companyUpdated'));
  };

  return (
    <BusinessPageShell
      title="My Companies"
      subtitle={`${companies.length} ${companies.length === 1 ? 'company' : 'companies'} under your membership`}
      width="wide"
      actions={
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => navigate("/business/companies/add")}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      }
    >
      {loading ? (
        <Loading label="Loading companies…" />
      ) : companies.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No companies registered"
            hint="Add your business profile to showcase products and services."
            action={
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/business/companies/add")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 items-start">
          {companies.map((company) => {
            const status = (company.status || 'pending').toLowerCase();
            const isActive = activeCompanyId === company._id;

            return (
              <Card
                key={company._id}
                className={`relative flex flex-col ${isActive ? 'ring-2 ring-blue-500' : ''}`}
              >
                {isActive && (
                  <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 bg-blue-600 text-white text-[0.6875rem] font-semibold px-2.5 py-1 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                )}

                <div className="flex items-start gap-4">
                  <span className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {/* Stored as a relative `/uploads/...` path, which belongs to
                        the API origin rather than to this site. */}
                    {company.logo ? (
                      <img
                        src={resolveMediaUrl(company.logo)}
                        alt={company.businessName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-7 w-7 text-slate-400" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-slate-900 truncate">
                      {company.businessName}
                    </h3>
                    <p className="text-sm text-slate-500 truncate">{company.businessType}</p>
                    <p className="text-sm text-slate-500 truncate">{company.mobileNumber}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <Chip tone={STATUS_TONES[status] || 'amber'}>
                    <span className="capitalize">{status}</span>
                  </Chip>
                </div>

                {/*
                    A three-up strip of hardcoded zeros — "Products", "Views",
                    "Connections" — used to sit here. None of the three was ever
                    fetched from anything, and mobile's Manage Companies screen
                    shows no such figures. Space that reports nothing is worse
                    than space left out.
                */}

                <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/business/companies/${company._id}`)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/business/companies/edit/${company._id}`)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/business/products`)}
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4" />
                      <span className="sr-only">Products</span>
                    </Button>
                  </div>

                  {!isActive && (
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleSetActive(company._id)}
                    >
                      Switch to this company
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteId(company._id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the company and its catalog. This cannot be undone.
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

export default MyCompanies;
