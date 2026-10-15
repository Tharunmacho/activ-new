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
    /** Reset a failed page after navigation without remounting healthy content. */
    resetKey?: string;
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

    componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey) this.reset();
    }

    private reset = () => this.setState({ error: null });

    private reload = () => window.location.reload();

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback) return <>{this.props.fallback}</>;

        return (
            <div className="min-h-screen flex items-center justify-center bg-white px-4 py-10">
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
                            className="min-h-11 px-6 py-2.5 rounded-full bg-[#1c2e68] text-white font-semibold hover:opacity-90"
                        >
                            Try again
                        </button>
                        <button
                            type="button"
                            onClick={this.reload}
                            className="min-h-11 px-6 py-2.5 rounded-full bg-[#1c2e68] text-white font-semibold
                                       hover:opacity-90 transition-opacity"
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            onClick={this.reset}
                            className="min-h-11 px-6 py-2.5 rounded-full border border-gray-200 text-[#1c2e68]
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
