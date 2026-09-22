import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Eye, Pencil, Trash2, CheckCircle, Package, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, EmptyState, Loading, Chip, companyName } from "./BusinessUI";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

import { CARD_TITLE } from '@/components/layout/appTypography';
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
      company ? `Now working on ${companyName(company)}` : "Active company switched",
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
                  <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 bg-blue-600 text-white text-[1rem] font-semibold px-2.5 py-1 rounded-full">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </span>
                )}

                {/*
                    ONE OVERFLOW MENU, where four buttons used to be.

                    The card carried a three-up strip of unlabelled icon buttons
                    — an eye, a pencil, a box — over a full-width red Delete. The
                    icons said nothing on their own (only a screen reader got
                    "View", "Edit", "Products"), and Delete, the one irreversible
                    action on the card, was the largest and most reachable
                    control on it, directly under the button most likely to be
                    aimed at.

                    A single ⋮ in the corner puts every action behind one
                    deliberate press, gives each one a WORD, and drops Delete to
                    the bottom of the list behind a separator where a
                    destructive action belongs. "Switch to this company" stays a
                    real button: it is the card's actual purpose and the only
                    action anyone repeats.
                */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${companyName(company)}`}
                      className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center
                                 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {/*
                        "View as member" first, and it opens the member-facing
                        page rather than the owner's detail screen — it is the
                        one view of a company that answers a question the owner
                        cannot answer any other way.
                    */}
                    <DropdownMenuItem
                      onClick={() => navigate(`/business/company/${company._id}?preview=1`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View as member
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate(`/business/companies/edit/${company._id}`)}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit company
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/business/products')}>
                      <Package className="h-4 w-4 mr-2" />
                      Products
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteId(company._id)}
                      className="text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete company
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-start gap-4">
                  <span className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {/* Stored as a relative `/uploads/...` path, which belongs to
                        the API origin rather than to this site. */}
                    {company.logo ? (
                      <img
                        src={resolveMediaUrl(company.logo)}
                        alt={companyName(company)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-7 w-7 text-slate-400" />
                    )}
                  </span>
                  {/* `pr-8` so a long name stops short of the ⋮ rather than
                      sliding under it. */}
                  <div className="flex-1 min-w-0 pr-8">
                    <h3 className={`${CARD_TITLE} text-slate-900 truncate`}>
                      {companyName(company)}
                    </h3>
                    <p className="text-[1.25rem] text-slate-500 truncate">{company.businessType}</p>
                    <p className="text-[1.25rem] text-slate-500 truncate">{company.mobileNumber}</p>
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

                <div className="mt-5 pt-4 border-t border-slate-100">
                  {isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={() => navigate(`/business/company/${company._id}?preview=1`)}
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      View as member
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleSetActive(company._id)}
                    >
                      Switch to this company
                    </Button>
                  )}
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
