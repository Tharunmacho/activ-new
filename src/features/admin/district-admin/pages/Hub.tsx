/**
 * District admin — Hub.
 *
 * The blocks of this district, each with its pending, approved and rejected
 * counts, drilling into the applications themselves. The screen is shared with
 * the state tier; the server decides how far it reaches.
 */
import AdminHubScreen from '@/features/admin/components/AdminHubScreen';

const Hub = () => <AdminHubScreen tier="district" />;

export default Hub;
