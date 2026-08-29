import { useState, type ReactNode } from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import MemberSidebar from './MemberSidebar';
import { useNavigate } from 'react-router-dom';

export type ShellWidth = 'wide' | 'standard' | 'narrow';

const WIDTHS: Record<ShellWidth, string> = {
    wide: 'w-full',
    standard: 'max-w-6xl mx-auto',
    narrow: 'max-w-4xl mx-auto',
};

/**
 * The member page shell.
 *
 * `sidebar` decides whether this screen is a place a member navigates TO or a
 * step they are working THROUGH. The four screens the sidebar itself links to —
 * Dashboard, My Profile, Business Account, Explore Members — plus Settings keep
 * it, so its own links always lead somewhere that has it. The registration
 * forms, the submission screens and the whole payment flow do not: offering a
 * member four ways to leave halfway through paying is how a half-finished
 * application happens. Those get a back arrow instead.
 */
export default function MemberPageShell({
    title,
    subtitle,
    actions,
    width = 'standard',
    sidebar = true,
    backTo = '/member/unpaid-dashboard',
    children,
}: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    width?: ShellWidth;
    /** False for a linear flow — see the note above. */
    sidebar?: boolean;
    /** Where the back arrow goes when there is no sidebar. */
    backTo?: string;
    children: ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex bg-slate-100 font-sans">
            {sidebar ? (
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            ) : null}

            <div className="flex-1 min-w-0 flex flex-col relative">
                <header className="h-[4.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-5 lg:px-8 sticky top-0 z-10">
                    {sidebar ? (
                        <button
                            type="button"
                            className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    ) : (
                        /* Without a rail there has to be a way out, at every width. */
                        <button
                            type="button"
                            className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 flex items-center
                                       justify-center text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={() => navigate(backTo)}
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}

                    <div className="min-w-0">
                        <h1 className="text-[1.3125rem] font-bold tracking-tight text-slate-900 truncate">
                            {title}
                        </h1>
                        {subtitle ? (
                            <p className="text-[0.8125rem] text-slate-500 truncate hidden sm:block">{subtitle}</p>
                        ) : null}
                    </div>

                    {actions ? (
                        <div className="ml-auto flex items-center gap-2 shrink-0">{actions}</div>
                    ) : null}
                </header>

                <main className="flex-1 overflow-y-auto p-5 lg:p-8">
                    <div className={WIDTHS[width]}>{children}</div>
                </main>
            </div>
        </div>
    );
}
