/**
 * District admin — Members.
 *
 * The screen lives in `features/admin/components/AdminMembersScreen`, shared by
 * every tier. Each tier used to keep its own copy; the copies drifted, and the
 * drift produced real defects rather than cosmetic ones — see the note at the
 * top of `tierConfig.ts`.
 */
import AdminMembersScreen from '@/features/admin/components/AdminMembersScreen';

const Members = () => <AdminMembersScreen tier="district" />;

export default Members;
