import React from 'react';

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
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info.componentStack);
    }

    private reset = () => this.setState({ error: null });

    private reload = () => window.location.reload();

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback) return <>{this.props.fallback}</>;

        return (
            <div className="min-h-screen flex items-center justify-center bg-white px-6">
                <div className="max-w-lg w-full text-center">
                    <h1 className="text-2xl font-bold text-[#1c2e68] mb-3">
                        Something went wrong on this page
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        The rest of the site is fine. Reload to try again, or go back to the
                        home page.
                    </p>

                    {/*
                     * The actual message, in development only. On the public site a
                     * stack trace is noise to a visitor and detail to everyone else;
                     * in dev it is the whole point of showing a panel rather than a
                     * blank page.
                     */}
                    {import.meta.env.DEV && (
                        <pre className="text-left text-xs bg-gray-50 border border-gray-200 rounded-lg
                                        p-4 mb-8 overflow-auto max-h-48 text-red-700 whitespace-pre-wrap">
                            {error.message}
                        </pre>
                    )}

                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={this.reload}
                            className="px-6 py-2.5 rounded-full bg-[#1c2e68] text-white font-semibold
                                       hover:opacity-90 transition-opacity"
                        >
                            Reload
                        </button>
                        <a
                            href="/"
                            onClick={this.reset}
                            className="px-6 py-2.5 rounded-full border border-gray-200 text-[#1c2e68]
                                       font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Go home
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
