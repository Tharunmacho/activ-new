import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Check, ArrowLeft, ArrowRight, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import MemberSidebar from "./MemberSidebar";

/**
 * The shell the four registration forms render inside.
 *
 * Mobile groups each form into titled cards — "Location Information",
 * "Contact Information", "Demographic Information" — each with its own icon and
 * one-line explanation, and moves between steps with a single primary button
 * (plus Previous from step 2 onward). The website rendered one flat card per
 * form with `<h3>` rules between sections, and ended every form with a
 * `Cancel` / `Save & Submit` pair that returned to the dashboard.
 *
 * That pairing is what made step 1 confusing: neither button advanced the
 * applicant. "Cancel" abandoned the form and "Save & Submit" also left, so a
 * four-step application never actually walked from one step to the next. This
 * shell carries mobile's model instead — the primary button saves and advances,
 * and there is exactly one of it.
 */

export type StepIndex = 1 | 2 | 3 | 4;

/** The four steps, in the order mobile visits them. */
const TOTAL_STEPS = 4;

export function FormCard({
    icon: Icon,
    title,
    subtitle,
    children,
}: {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    return (
        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-blue-600" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">{title}</h2>
                    {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
                </div>
            </div>
            <div className="space-y-5">{children}</div>
        </section>
    );
}

/** A labelled field. Mirrors mobile's `fieldGroup` + `fieldLabel`. */
export function FormField({
    label,
    required,
    error,
    hint,
    full,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    full?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={full ? "md:col-span-2" : undefined}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label}
                {required ? <span className="text-red-500 ml-0.5">*</span> : null}
            </label>
            {children}
            {error ? <p className="text-xs text-red-600 mt-1.5">{error}</p> : null}
            {!error && hint ? <p className="text-xs text-slate-500 mt-1.5">{hint}</p> : null}
        </div>
    );
}

/** Two columns from md up, so a phone number stops being a 700px input. */
export function FormGrid({ children }: { children: ReactNode }) {
    return <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>;
}

function Stepper({ current }: { current: StepIndex }) {
    return (
        <div className="flex items-center justify-center mb-6">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const step = i + 1;
                const done = step < current;
                const active = step === current;
                return (
                    <div key={step} className="flex items-center">
                        <span
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${done
                                ? "bg-blue-600 text-white"
                                : active
                                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                    : "bg-white text-slate-400 border-2 border-slate-200"
                                }`}
                        >
                            {done ? <Check className="w-4 h-4" /> : step}
                        </span>
                        {step < TOTAL_STEPS && (
                            <span className={`w-10 sm:w-16 h-0.5 ${done ? "bg-blue-600" : "bg-slate-200"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function RegistrationFormShell({
    step,
    title,
    description,
    /** Where "Previous" goes. Omitted on step 1, exactly as on mobile. */
    previousTo,
    /** Label for the primary button — "Next", "Submit", "Submit Application". */
    submitLabel = "Next",
    submitting = false,
    disabled = false,
    onSubmit,
    children,
}: {
    step: StepIndex;
    title: string;
    description: string;
    previousTo?: string;
    submitLabel?: string;
    submitting?: boolean;
    disabled?: boolean;
    onSubmit: (e: React.FormEvent) => void;
    children: ReactNode;
}) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen flex bg-slate-100">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-[72px] shrink-0 bg-white border-b border-slate-200 flex items-center gap-3 px-5 lg:px-8">
                    <button
                        type="button"
                        className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-[21px] font-bold tracking-tight text-slate-900 truncate">{title}</h1>
                        <p className="text-[13px] text-slate-500 truncate hidden sm:block">{description}</p>
                    </div>
                    <span className="ml-auto text-sm font-medium text-slate-500 shrink-0">
                        Step {step} of {TOTAL_STEPS}
                    </span>
                </header>

                <main className="flex-1 overflow-y-auto p-5 lg:p-8">
                    <div className="max-w-4xl mx-auto">
                        <Stepper current={step} />

                        <form onSubmit={onSubmit} className="space-y-6">
                            {children}

                            {/*
                                One primary action. On step 1 it stands alone —
                                mobile's Personal Details screen has no Previous
                                either, because there is nothing before it.
                            */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                {previousTo ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                                        onClick={() => navigate(previousTo)}
                                        disabled={submitting}
                                    >
                                        <ArrowLeft className="h-4 w-4 mr-2" />
                                        Previous
                                    </Button>
                                ) : null}

                                <Button
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-700 min-w-[9rem]"
                                    disabled={submitting || disabled}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Saving…
                                        </>
                                    ) : (
                                        <>
                                            {submitLabel}
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </main>
            </div>
        </div>
    );
}
