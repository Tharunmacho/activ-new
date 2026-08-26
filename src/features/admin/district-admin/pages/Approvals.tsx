/**
 * District admin — Approvals.
 *
 * The screen lives in `features/admin/components/AdminApprovalsScreen`, shared by
 * every tier. Each tier used to keep its own copy; the copies drifted, and the
 * drift produced real defects rather than cosmetic ones — see the note at the
 * top of `tierConfig.ts`.
 */
import AdminApprovalsScreen from '@/features/admin/components/AdminApprovalsScreen';

const Approvals = () => <AdminApprovalsScreen tier="district" />;

export default Approvals;
