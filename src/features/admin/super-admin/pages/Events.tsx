import { useState } from 'react';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import EventsManager from '@/pages/cms/EventsManager';
import { AdminPageHeader, ADMIN_PAGE } from '@/features/admin/components/AdminUI';

/**
 * Events, inside the platform admin area.
 *
 * The super-admin nav used to link straight at `/cms/events`, which dropped the
 * administrator into the CMS shell — different sidebar, different theme, and no
 * obvious way back. On mobile, Events is a TAB of the super-admin section; you
 * never leave it.
 *
 * The editor itself is not duplicated. `EventsManager` is the same component the
 * CMS renders, mounted here in the admin shell instead — one list, one set of
 * controls, reachable from both places. Two copies would be two things to keep
 * in step, and events are the one collection the public site, the member app and
 * this screen all read.
 *
 * WHO SEES AN EVENT IS DECIDED BY ITS REGION, not by whether the member has
 * paid. An event aimed at a block reaches every member standing in that block —
 * paid and unpaid alike — because the association's reason for posting it is
 * that those people are there, not that they have a receipt. `defaultAudience`
 * is therefore `all`, and the members-only switch stays on the form for the
 * events that genuinely are a membership benefit.
 *
 * WHETHER IT ALSO REACHES THE PUBLIC SITE IS ASKED, NOT ASSUMED. The form
 * carries an "Onboarding website" choice — keep it inside the association, or
 * post it in the onboarding events section as well. It used to be neither: a
 * targeted event was withheld from the public pages outright, on the grounds
 * that those pages have no viewer to compare a region against. That reasoning
 * described the page, and the page can now say where an event is for and let a
 * visitor filter to their own region, so the decision belongs to whoever is
 * posting rather than to a rule.
 *
 * NO SECTION COPY HERE. The eyebrow, heading, chips and empty-state wording
 * around the public events grid are the onboarding page's furniture and stay in
 * the CMS — `showSectionCopy` follows `channel`, so this screen opens on the
 * programme itself rather than on five cards of copy for a page it does not own.
 */
export default function SuperAdminEvents() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-white flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                {/* The one admin header — menu button, way back and the mobile
                    stacking, shared with Membership and Updates. */}
                <AdminPageHeader
                    title="Events"
                    subtitle={<>
                        Aim an event at a state, district or block and every member there sees it —
                        paid or unpaid. Every event also goes on the onboarding site and into the CMS,
                        unless you untick that on the form.
                    </>}
                    onMenu={() => setSidebarOpen(true)}
                />

                <main className={ADMIN_PAGE}>
                    <EventsManager defaultAudience="all" channel="members" />
                </main>
            </div>
        </div>
    );
}
