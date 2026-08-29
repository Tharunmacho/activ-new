import { useState } from 'react';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import EventsManager from '@/pages/cms/EventsManager';

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
 * What differs is the audience an event opens with. Everything posted HERE is
 * for paying members: `defaultAudience="paid"` means a new event is members-only
 * unless the administrator deliberately changes it, and the public listing
 * (`cms.service.listEvents`) filters `audience: 'paid'` out, so nothing posted
 * here reaches the onboarding pages. An event meant for the public site is
 * posted from the CMS instead, where the default is `all`.
 */
export default function SuperAdminEvents() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                <header className="bg-white border-b px-6 py-4 flex items-center gap-3">
                    <button
                        className="lg:hidden text-gray-600"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                        <p className="text-sm text-gray-600 mt-0.5">
                            For paying members. Events posted here do not appear on the public
                            site — post those from the CMS.
                        </p>
                    </div>
                </header>

                <main className="p-6">
                    <EventsManager defaultAudience="paid" />
                </main>
            </div>
        </div>
    );
}
