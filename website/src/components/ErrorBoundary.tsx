import React from 'react';

const CHUNK_RELOAD_KEY = 'activ:page-module-reload';
const CHUNK_RELOAD_WINDOW_MS = 10 * 60 * 1000;

/** A rejected lazy import stays rejected until a new document loads. */
function recoverPageModule(error: Error): boolean {
    const isModuleFailure = error.name === 'ChunkLoadError'
        || /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(error.message);
    if (!isModuleFailure) return false;
    try {
        const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
        const now = Date.now();
        if (last && now - last < CHUNK_RELOAD_WINDOW_MS) return false;
        // Write before reloading; persistent failures cannot form a reload loop.
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
        window.location.reload();
        return true;
    } catch { return false; }
}

/**
 * The last line of defence between a render-time throw and a white screen.
 *
 * The web app had no boundary at all, which is why any exception anywhere in
 * the tree — one unguarded `.map` on a CMS field that came back `null`, one
 * component resolving to `undefined` — unmounted every route and left the
 * visitor looking at an empty document with nothing to click and nothing in the
 * UI saying what had happened. This is the same protection
 * `frontend/src/components/ErrorBoundary.tsx` gives the mobile app (RULE 5),
 * which the website was simply missing.
 *
 * What it deliberately does NOT do is swallow the error. A boundary that shows
 * a friendly message and logs nothing turns a reproducible crash into a support
 * ticket that says "it went blank". The message is rendered, the stack goes to
 * the console, and in development the text of the error is on screen so it is
 * fixed rather than reported.
 */

interface Props {
    children: React.ReactNode;
    /** Shown instead of the default panel — used where a whole-page card would be wrong. */
    fallback?: React.ReactNode;
    /** Named in the console line, so a crash points at the subtree that threw. */
    label?: string;
    /** Reset a failed page after navigation without remounting healthy content. */
    resetKey?: string;
}

interface State {
    error: Error | null;
    details?: string;
    copied?: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
        recoverPageModule(error);
    }

    componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) this.reset();
    }

    private reset = () => this.setState({ error: null, details: '', copied: false });

    private reload = () => window.location.reload();

    private copyDetails = async () => {
        const error = this.state.error;
        if (!error) return;
        const message = String(error.message || 'Unknown error')
            .replace(/https?:\/\/[^\s"'<>]+/gi, value => {
                try { const url = new URL(value); return url.origin + url.pathname; } catch { return '[URL]'; }
            })
            .replace(/(\/[^\s?#"'<>]*)\?[^\s"'<>]*/g, '$1')
            .replace(/\bBearer\s+\S+/gi, 'Bearer [removed]')
            .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
            .slice(0, 600);
        const details = `${String(error.name || 'Error').slice(0, 60)}: ${message}\nPage: ${window.location.pathname}`;
        try {
            await navigator.clipboard.writeText(details);
            this.setState({ copied: true, details: '' });
        } catch { this.setState({ copied: false, details }); }
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback) return <>{this.props.fallback}</>;

        return (
            <div className="min-h-screen flex items-center justify-center bg-white px-4 py-10 text-[20px]">
                <div role="alert" className="max-w-lg w-full text-center">
                    <h1 className="text-[1.5625rem] font-bold text-[#1c2e68] mb-3">
                        Something went wrong on this page
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Please try again. If this page still cannot open, reload it or return home.
                        These recovery buttons do not sign you out.
                    </p>

                    {/*
                     * The actual message, in development only. On the public site a
                     * stack trace is noise to a visitor and detail to everyone else;
                     * in dev it is the whole point of showing a panel rather than a
                     * blank page.
                     */}
                    {import.meta.env.DEV && (
                        <pre className="text-left text-ui-caption bg-gray-50 border border-gray-200 rounded-lg
                                        p-4 mb-8 overflow-auto max-h-48 text-red-700 whitespace-pre-wrap">
                            {error.message}
                        </pre>
                    )}

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={this.reset}
                            className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#1c2e68] text-white font-semibold hover:opacity-90"
                        >
                            Try again
                        </button>
                        <button
                            type="button"
                            onClick={this.reload}
                            className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#1c2e68] text-white font-semibold
                                       hover:opacity-90 transition-opacity"
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            onClick={this.reset}
                            className="min-h-[44px] px-6 py-2.5 rounded-full border border-gray-200 text-[#1c2e68]
                                       font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Go home
                        </a>
                        <button type="button" onClick={() => void this.copyDetails()}
                            className="min-h-[44px] px-6 py-2.5 rounded-full border border-gray-200 text-[#1c2e68] font-semibold hover:bg-gray-50">
                            Copy error details
                        </button>
                    </div>
                    {this.state.copied && <p role="status" className="mt-4 text-sm text-gray-600">Error details copied. Share them with ACTIV support.</p>}
                    {this.state.details && <div className="mt-4 text-left">
                        <p className="text-sm text-gray-600">Copy this text and share it with ACTIV support.</p>
                        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-3 text-sm">{this.state.details}</pre>
                    </div>}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
