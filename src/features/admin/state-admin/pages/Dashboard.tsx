/**
 * State admin — Dashboard.
 *
 * The screen lives in `features/admin/components/AdminDashboardScreen`, shared by
 * every tier. Each tier used to keep its own copy; the copies drifted, and the
 * drift produced real defects rather than cosmetic ones — see the note at the
 * top of `tierConfig.ts`.
 */
import AdminDashboardScreen from '@/features/admin/components/AdminDashboardScreen';

const Dashboard = () => <AdminDashboardScreen tier="state" />;

export default Dashboard;
