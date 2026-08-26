import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, CheckCircle, XCircle, Menu } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMemberList from "./AdminMemberList";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import { getAdminDashboard, getApplicationProfile, memberAction, errorMessage } from "@/services/activApi";
import { TIERS, type AdminTier } from "./tierConfig";

/**
 * The admin Members directory, shared by every tier.
 *
 * Block, district and state each carried a ~275-line copy of this. The copies
 * had already drifted: district and state kept a fabricated
 * `index % 4 === 3` "Inactive" rule for two rounds of fixes after block had
 * been corrected to read the real `isActive` field.
 *
 * Members are the approved applicants plus the rejected ones, which the server
 * marks Inactive — the same directory mobile renders, from the same payload.
 */
export default function AdminMembersScreen({ tier }: { tier: AdminTier }) {
    const config = TIERS[tier];

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState<"all" | "active" | "inactive">("all");
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedProfile, setSelectedProfile] = useState<any>(null);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
            try {
                setLoading(true);
                const dashboard = await getAdminDashboard();
                if (dashboard.scopeUnresolved) {
                    throw new Error(dashboard.message || "Scope unresolved");
                }

                /**
                 * The directory comes from the server already split.
                 *
                 * This used to be built from `applicants.approved` with
                 * `isActive === false` deciding the status. Every approved
                 * applicant defaults to active, so the Inactive tab could never
                 * hold anyone and looked broken. The server now returns
                 * `members`, which is the approved list plus the rejected one —
                 * a rejected applicant is Inactive — with the status resolved
                 * there so mobile and the website cannot disagree.
                 */
                const directory = dashboard.members || [];

                setMembers(directory.map((app: any) => ({
                    id: app.id || app.applicationId,
                    applicationId: app.applicationId || app.id,
                    name: app.fullName || "Unknown",
                    email: app.email || "N/A",
                    status: app.memberStatus || (app.isActive === false ? "Inactive" : "Active"),
                    inactiveReason: app.inactiveReason || "",
                })));
            } catch (error: any) {
                console.error("Error loading members:", error);
                toast.error(errorMessage(error, "Failed to load members"));
                setMembers([]);
            } finally {
                setLoading(false);
            }
    }, []);

    useEffect(() => { load(); }, [load, tier]);

    /**
     * Suspend or reactivate a member.
     *
     * The id sent is the application id the row carries. The endpoint used to be
     * handed `memberId`, which is the auth id on any applicant who has a login —
     * a different collection from the one the lookup searched — so the call came
     * back "User not found" for a member visible on screen.
     */
    const handleToggleActive = useCallback(async (member: any, nextActive: boolean) => {
        const id = member.applicationId || member.id;
        if (!id) return;
        try {
            setBusyId(member.id || id);
            await memberAction(id, nextActive ? "activate" : "suspend");
            toast.success(nextActive ? "Member reactivated" : "Member suspended");
            await load();
        } catch (error) {
            toast.error(errorMessage(error, "Could not update this member"));
        } finally {
            setBusyId(null);
        }
    }, [load]);

    /**
     * Delete a member outright.
     *
     * Confirmed first because it cannot be undone: the server removes the
     * application, the login credential, the member record and all four
     * additional forms in one pass. Deleting only the member record — which is
     * what the endpoint used to do — left an account that could still sign in.
     */
    const handleDelete = useCallback(async (member: any) => {
        const id = member.applicationId || member.id;
        if (!id) return;

        const name = member.name || "this member";
        const ok = window.confirm(
            `Permanently delete ${name}?

This removes their application, login, member record, business, financial and declaration forms. It cannot be undone.`,
        );
        if (!ok) return;

        try {
            setBusyId(member.id || id);
            await memberAction(id, "delete");
            toast.success(`${name} deleted`);
            await load();
        } catch (error) {
            toast.error(errorMessage(error, "Could not delete this member"));
        } finally {
            setBusyId(null);
        }
    }, [load]);

    const buckets = useMemo(() => ({
        all: members,
        active: members.filter((m) => m.status !== "Inactive"),
        inactive: members.filter((m) => m.status === "Inactive"),
    }), [members]);

    const counts = useMemo(() => ({
        total: buckets.all.length,
        active: buckets.active.length,
        inactive: buckets.inactive.length,
    }), [buckets]);

    const filteredMembers = useMemo(() => {
        const q = (searchQuery || "").toLowerCase();
        return (buckets[tab] || []).filter(
            (m: any) =>
                (m.name || "").toLowerCase().includes(q) ||
                (m.email || "").toLowerCase().includes(q),
        );
    }, [buckets, tab, searchQuery]);

    const handleViewProfile = async (applicationId?: string) => {
        if (!applicationId) {
            toast.error("This member has no application on record");
            return;
        }
        try {
            setProfileLoading(true);
            setProfileModalOpen(true);
            const profile = await getApplicationProfile(applicationId);
            if (!profile) {
                toast.error("Application not found");
                setProfileModalOpen(false);
                return;
            }
            setSelectedProfile(profile);
        } catch (error) {
            toast.error(errorMessage(error, "Failed to load application data"));
            setProfileModalOpen(false);
        } finally {
            setProfileLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-white">
            <AdminSidebar tier={tier} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/* Mobile header — the only way to reach the drawer below md. */}
                <div className="md:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Members</h1>
                    <span className="w-10" />
                </div>

                <div className="flex-1 p-4 md:p-6 overflow-auto">
                    <div className="w-full max-w-6xl mx-auto space-y-6">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 shadow-xl p-6 rounded-2xl border border-blue-500">
                            <h1 className="text-3xl font-bold text-white">Members</h1>
                            <p className="text-blue-100 mt-1">
                                {config.label} members — approved and rejected applicants in your region
                            </p>
                        </div>

                        <Card className="shadow-lg border-0">
                            <CardContent className="pt-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    {/*
                                        A decorative "Filter" button used to sit beside
                                        this with no onClick. The tabs below are the
                                        filter, and mobile offers no other.
                                    */}
                                    <Input
                                        placeholder="Search members by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                                <TabsTrigger value="all" className="flex items-center gap-2 py-3">
                                    <Users className="w-4 h-4" /> All ({counts.total})
                                </TabsTrigger>
                                <TabsTrigger value="active" className="flex items-center gap-2 py-3">
                                    <CheckCircle className="w-4 h-4" /> Active ({counts.active})
                                </TabsTrigger>
                                <TabsTrigger value="inactive" className="flex items-center gap-2 py-3">
                                    <XCircle className="w-4 h-4" /> Inactive ({counts.inactive})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <AdminMemberList
                            members={filteredMembers}
                            loading={loading}
                            busyId={busyId}
                            emptyHint={
                                searchQuery
                                    ? "Try adjusting your search"
                                    : "There are no members to display yet."
                            }
                            onOpen={(m) => handleViewProfile(m.applicationId)}
                            onToggleActive={handleToggleActive}
                            onDelete={handleDelete}
                        />
                    </div>
                </div>
            </div>

            {/* Read-only here: these members are already approved, so there is
                no decision to make. The Approvals queue passes `onReview`. */}
            <ProfileViewModal
                open={profileModalOpen}
                onClose={() => { setProfileModalOpen(false); setSelectedProfile(null); }}
                profile={selectedProfile}
                loading={profileLoading}
            />
        </div>
    );
}
