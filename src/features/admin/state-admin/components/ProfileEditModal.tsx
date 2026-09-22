/**
 * The admin profile editor.
 *
 * This was a byte-identical copy of the block-admin modal — four files, one
 * behaviour, and four places to forget when the form changes. There is now one,
 * and it picks its region field from the signed-in admin's role rather than
 * from which folder it was imported out of.
 */
export { default } from "@/features/admin/block-admin/components/ProfileEditModal";
