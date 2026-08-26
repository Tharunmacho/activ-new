/**
 * Super admin sidebar.
 *
 * The rail itself is `features/admin/components/AdminSidebar`, shared by all
 * four tiers. Each tier used to keep its own ~205-line copy differing only in
 * the route prefix and the avatar initials; the shared one reads the tier from
 * the signed-in role, so it cannot disagree with the session.
 */
export { default } from '@/features/admin/components/AdminSidebar';
