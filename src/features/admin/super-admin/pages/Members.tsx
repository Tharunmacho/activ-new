/**
 * Super admin — Members.
 *
 * =========================================================================
 * THIS WAS A 270-LINE COPY SHOWING INVENTED PEOPLE
 * =========================================================================
 *
 * Block, district and state have all re-exported the shared
 * `AdminMembersScreen` since the four copies were consolidated — see the note
 * at the top of `tierConfig.ts` for why, and what the drift had already cost.
 * The super admin's copy was missed, and it had drifted further than any of the
 * others ever did:
 *
 *   - it rendered FIVE HARDCODED MEMBERS — John Doe, Jane Smith, Robert Brown,
 *     M001 to M005, all at example.com — so the one screen that is supposed to
 *     answer "who is in the association" answered with a fixture, on a platform
 *     with real members in it. Approvals and Dashboard both carry a note about
 *     having had exactly these three names removed; this is the third;
 *   - it painted solid blue cards and its own blue banner instead of the admin
 *     area's white card and `AdminPageHeader`, so the screen a super admin
 *     opens most looked like it belonged to a different product;
 *   - none of it was searchable, filterable or paged against real data,
 *     because there was no real data to page.
 *
 * One line now, like the other three. The shared screen reads the real roster
 * from `getAdminDashboard`, and every tier's Members page moves together.
 */
import AdminMembersScreen from '@/features/admin/components/AdminMembersScreen';

const Members = () => <AdminMembersScreen tier="super" />;

export default Members;
