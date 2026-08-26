import { toast } from 'sonner';
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
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-6">
            <header className="px-6 pt-6 pb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">{title}</h2>
                    {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
                </div>
                {actions}
            </header>
            <div className="px-6 pb-6 pt-2">{children}</div>
        </section>
    );
}

/**
 * The page shell every manager sits in.
 *
 * One place decides how wide a manager is. `SiteSettingsManager` was capped at
 * `max-w-4xl` while `HomeManager` used the full column, so the two screens
 * ended at different points and the settings card left a wide band of empty
 * space beside it. The cap is gone: the CMS column is already padded by the
 * layout, and a form of labelled fields does not need a second margin inside
 * it.
 */
/**
 * Say that a save landed, where the editor is looking.
 *
 * Every manager used to report a save by swapping its own button's label to
 * "Saved" for two and a half seconds. On a long form that button is usually
 * scrolled off the bottom of the screen — an editor who pressed Ctrl+S, or who
 * clicked and then scrolled up to check their work, saw nothing at all and had
 * no way to tell whether the save had happened.
 *
 * A toast appears wherever the page is scrolled to. The inline label stays as
 * well: the two answer different questions — "did that work" and "which block
 * am I looking at".
 */
/**
 * Styled to the CMS panel, not to the page underneath it.
 *
 * `CmsLayout` scopes its `dark` class to its own subtree so the panel's theme
 * cannot leak into the public site. Sonner's Toaster renders at the app root —
 * outside that subtree — so it reads the *root* theme and would always appear
 * light while the CMS is dark. Reading the same `cms_theme` key the layout
 * writes keeps the two in step, and a failure to read it falls back to dark,
 * which is the panel's default.
 */
const cmsToastStyle = (accent: string) => {
    let dark = true;
    try { dark = localStorage.getItem('cms_theme') !== 'light'; } catch { /* private mode */ }

    return {
        background: dark ? '#0f172a' : '#ffffff',
        color: dark ? '#f8fafc' : '#0f172a',
        border: '1px solid ' + (dark ? '#1e293b' : '#e2e8f0'),
        borderLeft: '4px solid ' + accent,
    };
};

export const cmsSaved = (what: string) =>
    toast.success(what + ' saved', {
        description: 'The live site has been updated.',
        style: cmsToastStyle('#16a34a'),
    });

export const cmsFailed = (what: string, detail?: string) =>
    toast.error('Could not save ' + what.toLowerCase(), {
        description: detail,
        style: cmsToastStyle('#dc2626'),
        // Long enough to read a server message, since nothing else reports it.
        duration: 6000,
    });

export const cmsDeleted = (what: string) =>
    toast.success(what + ' deleted', { style: cmsToastStyle('#dc2626') });

export function CmsPage({ children }: { children: ReactNode }) {
    return <div className="w-full space-y-6 pb-12">{children}</div>;
}

/**
 * A titled division inside a card.
 *
 * Both managers grew their own version of this — an inline `<p>` with a
 * `border-t pt-6` wrapper, repeated at every division and drifting in weight,
 * spacing and wording between the two files. One component means a card reads
 * as sections everywhere rather than as one unbroken column of fields.
 *
 * The rule and the top padding are suppressed on the first section, so a card
 * does not open with a line immediately under its own heading.
 */
export function CmsSection({ title, hint, actions, children }: {
    title: string;
    hint?: string;
    /** Right-aligned control for this section, e.g. a Show toggle. */
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="pt-7 first:pt-0 border-t first:border-t-0 border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                    {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
                </div>
                {actions}
            </div>
            {children}
        </section>
    );
}

export function CmsField({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
    return (
        <label className="block">
            {/* Skipped when empty: a blank span still carries its bottom margin,
                which reads as a stray gap above the control. */}
            {label ? (
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</span>
            ) : null}
            {children}
            {hint && <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{hint}</span>}
        </label>
    );
}

const inputBase =
    'w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 ' +
    'placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all';

export function CmsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={`${inputBase} ${props.className || ''}`} />;
}

/**
 * A colour, as a swatch and as text.
 *
 * Two controls over one value: the native picker for choosing, the text field
 * for pasting an exact brand hex. The picker alone cannot be given a value from
 * a brand guide; the text field alone makes an editor guess what #1c2e68 looks
 * like.
 *
 * Only `#rgb` / `#rrggbb` reaches the swatch, because a native colour input
 * silently resets to black on anything it cannot parse — which would look like
 * the field clearing itself while the value was being typed.
 */
export function CmsColorInput({ value, onChange, fallback = '#ffffff' }: {
    value: string;
    onChange: (next: string) => void;
    fallback?: string;
}) {
    const raw = (value || '').trim();
    const valid = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw);

    return (
        <div className="flex items-center gap-3">
            <input
                type="color"
                aria-label="Pick a colour"
                value={valid ? raw : fallback}
                onChange={e => onChange(e.target.value)}
                className="h-11 w-14 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700
                           bg-transparent p-1 cursor-pointer"
            />
            <CmsInput
                value={raw}
                onChange={e => onChange(e.target.value)}
                placeholder={fallback}
                spellCheck={false}
                className="font-mono uppercase"
            />
        </div>
    );
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
            {hint && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{hint}</p>}
        </div>
    );
}
