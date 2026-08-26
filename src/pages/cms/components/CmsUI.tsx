import { ReactNode } from 'react';
import { Loader2, AlertCircle, Save } from 'lucide-react';

/**
 * Shared pieces for the CMS screens.
 *
 * Extracted because all seven screens have the same three states — loading,
 * failed, saving — and a screen that forgets one of them is a screen that
 * silently does nothing when the API is down. Defining them once means no
 * screen can omit them by accident.
 */

export function CmsCard({ title, description, children, actions }: {
    title: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <section className="bg-white dark:bg-[#172033] border border-slate-200 dark:border-[#1e293b] rounded-xl overflow-hidden mb-6">
            <header className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
                    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
                </div>
                {actions}
            </header>
            <div className="px-6 pb-6 pt-2">{children}</div>
        </section>
    );
}

export function CmsField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
        </label>
    );
}

const inputBase =
    'w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-[#1e293b] rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 ' +
    'placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all';

export function CmsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={`${inputBase} ${props.className || ''}`} />;
}

export function CmsTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <textarea {...props} className={`${inputBase} resize-y ${props.className || ''}`} />;
}

export function CmsButton({
    children, loading, variant = 'primary', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    variant?: 'primary' | 'ghost' | 'danger';
}) {
    const styles = {
        primary: 'bg-blue-600 hover:bg-blue-500 text-white',
        ghost: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200',
        danger: 'bg-red-600 hover:bg-red-500 text-white',
    }[variant];

    return (
        <button
            {...rest}
            // Disabled while saving: a second click would fire a second write,
            // and for the singletons that is a race over the same document.
            disabled={rest.disabled || loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                        transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${rest.className || ''}`}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {children}
        </button>
    );
}

export function SaveButton({ loading, label = 'Save changes' }: { loading?: boolean; label?: string }) {
    return (
        <CmsButton type="submit" loading={loading}>
            {!loading && <Save className="w-4 h-4" />}
            {loading ? 'Saving…' : label}
        </CmsButton>
    );
}

export function CmsLoading({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 py-10 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{label}</span>
        </div>
    );
}

/**
 * A failure the admin can act on.
 *
 * Shows the server's own message where there is one — the API answers with
 * things like "An image is required", which is more use than a generic
 * "something went wrong".
 */
export function CmsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
    if (!message) return null;
    return (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
                {onRetry && (
                    <button onClick={onRetry} className="text-xs text-red-700 dark:text-red-300 underline mt-1">
                        Try again
                    </button>
                )}
            </div>
        </div>
    );
}

export function CmsEmpty({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="text-center py-12">
            <p className="text-slate-700 dark:text-slate-300 font-medium">{title}</p>
            {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
        </div>
    );
}
