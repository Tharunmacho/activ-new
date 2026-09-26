import { useState, type ReactNode } from 'react';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import { AdminPageHeader, ADMIN_PAGE } from '@/features/admin/components/AdminUI';

/**
 * The admin shell around a CMS editor — sidebar, the one admin header, and
 * the page padding — exactly as `SuperEvents` wraps `EventsManager`.
 *
 * The editors themselves are NOT copied. Gallery, News and Schemes here are
 * the CMS's own components, so a photograph, an article or a scheme saved from
 * this portal goes through the same form, the same rules and the same endpoint
 * as one saved from the CMS. Two copies would be two things to keep in step.
 */
export default function ContentShell({ title, subtitle, children }: {
    title: string;
    subtitle: ReactNode;
    children: ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-white flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                <AdminPageHeader title={title} subtitle={subtitle} onMenu={() => setSidebarOpen(true)} />
                <main className={ADMIN_PAGE}>{children}</main>
            </div>
        </div>
    );
}
