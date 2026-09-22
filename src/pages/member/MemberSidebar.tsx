/**
 * The member sidebar.
 *
 * This file used to hold a SECOND, forked copy of the sidebar — 543 lines with
 * its own navigation list, drifting from the one in `features/member/pages`.
 * Ten pages imported this one and three imported the other, so the same member
 * saw a different set of links depending on which page they happened to be on:
 * Explore and ProfileView disagreed about whether "Upcoming Events" existed.
 *
 * There is now one sidebar. This re-export exists so the ten import paths
 * pointing here keep working, rather than being rewritten across ten files for
 * no behavioural gain.
 */
export { default } from '@/features/member/pages/MemberSidebar';
