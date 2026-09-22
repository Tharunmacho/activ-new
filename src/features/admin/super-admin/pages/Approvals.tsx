/**
 * Super admin — Approvals.
 *
 * =========================================================================
 * THE FOURTH COPY, AND THE LAST ONE
 * =========================================================================
 *
 * Block, district and state have re-exported the shared `AdminApprovalsScreen`
 * since the tier screens were consolidated — see the note at the top of
 * `tierConfig.ts`. The super admin's 319-line copy was missed, exactly as its
 * Members copy was, and had drifted in three visible ways:
 *
 *   - it opened with a SOLID BLUE BANNER carrying "Application Approvals",
 *     while every other admin screen opens with the white `AdminPageHeader`
 *     and a back button. The shared screen's own comment records that banner
 *     being removed from the other three tiers; this was the one it did not
 *     reach;
 *   - its four count cards printed their labels in near-white text on white —
 *     "Pending", "Approved" and "Rejected" were legible only as pale ghosts,
 *     which is what the shared `AdminStat` exists to prevent;
 *   - it offered NO REGION FILTERS. `tierConfig` gives the super admin
 *     `approvalFilters: ['state', 'district', 'block']` — the three levels
 *     they look down at — and the shared screen renders them. The copy never
 *     did, so the one role that can see every application in the country had
 *     no way to narrow the list to a state.
 *
 * The API calls were identical (`getAdminDashboard`, `approveApplication`,
 * `rejectApplication`, `getApplicationProfile`), so nothing behavioural is lost
 * and the filters are gained.
 */
import AdminApprovalsScreen from '@/features/admin/components/AdminApprovalsScreen';

const Approvals = () => <AdminApprovalsScreen tier="super" />;

export default Approvals;
