import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMemberList from "./AdminMemberList";
import ProfileViewModal from "@/components/ui/profile-view-modal";
import { getAdminDashboard, getApplicationProfile, memberAction, errorMessage } from "@/services/activApi";
import { TIERS, type AdminTier } from "./tierConfig";
import { AdminPageHeader, ADMIN_BG, ADMIN_PAGE } from './AdminUI';

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
/**
 * One tab, selected or not.
 *
 * The blue fill is what the shared primitive does not give us: its
 * `data-[state=active]` styling is a white background, which is invisible on a
 * white card — pressing Active filtered the list underneath and left the tabs
 * looking identical, so a working control read as broken. Declared once here so
 * the three triggers cannot drift apart.
 */
const TAB_TRIGGER =
    'flex items-center justify-center gap-2 py-2.5 rounded-lg text-[1.25rem] font-semibold '
    + 'text-slate-600 transition-colors hover:text-slate-900 '
    + 'data-[state=active]:bg-blue-600 data-[state=active]:text-white '
    + 'data-[state=active]:shadow-sm';

export default function AdminMembersScreen({ tier }: { tier: AdminTier }) {
    const config = TIERS[tier];

    /**
     * WHO MAY BLOCK OR DELETE A MEMBER.
     *
     * The State Admin and the Super Admin. Every tier had both, and the
     * association asked for them to sit higher up — delete cascades through the
     * application, the login, the member record and the three additional forms,
     * and cannot be undone, so it went with block rather than being left behind
     * as the more dangerous half of a pair.
     *
     * A block or district admin keeps everything reading: the directory, the
     * search, the Active / Inactive tabs and the full application behind each
     * row. This only decides whether the two action icons are drawn.
     *
     * NOT A PERMISSION BOUNDARY. `POST /admin/users/:id/:action` is restricted
     * to the same two roles, and `adminService.memberAction` re-checks it —
     * this is the screen not offering what the server would refuse.
     */
    const mayManageMembers = tier === 'state' || tier === 'super';

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const navigate = useNavigate();
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
     * Block or unblock a member.
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
            toast.success(nextActive
                ? 'Member unblocked — they can sign in again'
                : 'Member blocked — they can no longer sign in');
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
        <div className={`min-h-screen flex ${ADMIN_BG}`}>
            <AdminSidebar tier={tier} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                {/*
                  * `AdminPageHeader`, not two hand-built bars.
                  *
                  * This screen carried its own mobile bar AND its own desktop
                  * header — the menu button, the back button and the title,
                  * written twice and kept in step by hand. The shared header is
                  * what Approvals, Manage Admins, Membership, Events, Bookings
                  * and Settings all open with, and it is the thing that decides
                  * where the title sits relative to the cards beneath it. Two
                  * implementations meant this screen's heading was a different
                  * size and a different distance from its content than every
                  * other screen in the product.
                  */}
                <AdminPageHeader
                    title="Members"
                    subtitle={
                        /*
                         * "in your region" is a lie for the SUPER admin, who is
                         * not geofenced at all — `tierConfig` gives them
                         * `regionKey: null` for exactly that reason. The three
                         * geofenced tiers see their own patch; the super admin
                         * sees the association.
                         */
                        tier === 'super'
                            ? 'Every approved and rejected applicant, across the association'
                            : `${config.label} members — approved and rejected applicants in your region`
                    }
                    onMenu={() => setSidebarOpen(true)}
                />

                {/* `ADMIN_PAGE` — the shared padding and the centred 90rem
                    column. This was `p-6` with a `max-w-[90rem]` that had no
                    `mx-auto`, so on a wide display the content hugged the left
                    and left a band of empty page on the right. */}
                <div className={`flex-1 overflow-y-auto ${ADMIN_PAGE}`}>
                        <Card className="border border-slate-200 rounded-2xl overflow-hidden
                                         shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
                            <CardContent className="pt-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
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

                        {/*
                          THE SELECTED TAB HAS TO BE VISIBLE.

                          The shared `TabsTrigger` marks the active tab with
                          `data-[state=active]:bg-background` — white — and this
                          list sits on a near-white card. White on white: pressing
                          Active changed the list underneath and left the tabs
                          looking identical, so the control read as broken when it
                          was working perfectly.

                          Solid blue instead, the same treatment the segmented
                          control in `AdminUI` uses, on an inset slate track. Now
                          the chosen tab is the loudest thing in the row.
                        */}
                        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1 bg-slate-100 rounded-xl ring-1 ring-slate-200/60">
                                <TabsTrigger
                                    value="all"
                                    className={TAB_TRIGGER}
                                >
                                    <Users className="w-4 h-4" /> All ({counts.total})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="active"
                                    className={TAB_TRIGGER}
                                >
                                    <CheckCircle className="w-4 h-4" /> Active ({counts.active})
                                </TabsTrigger>
                                <TabsTrigger
                                    value="inactive"
                                    className={TAB_TRIGGER}
                                >
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
                            onToggleActive={mayManageMembers ? handleToggleActive : undefined}
                            onDelete={mayManageMembers ? handleDelete : undefined}
                        />
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
