import { useEffect, useMemo, useState } from 'react';
import { Loader2, IndianRupee } from 'lucide-react';
import { getMembershipPlanCatalogue, type MembershipPlanRow } from '@/services/activApi';

/**
 * "12 years trading → Enterprise, ₹20,000" — under the commencement-year field.
 *
 * WHY IT IS HERE. The year an applicant types decides which membership plan
 * they are offered and what it costs, and that connection used to be invisible:
 * a year on one screen, a figure on another, and nothing joining them. Someone
 * who mistyped 2018 as 2081 found out at the payment step, if at all.
 *
 * EVERYTHING IT SHOWS IS FETCHED. The bands and the prices belong to the Super
 * Admin, so this holds neither: it reads the published plans and applies the
 * same half-open `[from, to)` rule the server does. A copy of either here would
 * be wrong the first time an amount was edited, and wrong on the one screen
 * where being wrong costs the applicant money.
 *
 * IT IS AN INDICATION, NOT A QUOTE. The server resolves the band again at the
 * payment step from the saved record, so nothing here is what gets charged.
 * Said plainly in the copy, because a figure on a form reads as a promise.
 */
export default function PlanHint({ year }: { year: string }) {
    const [plans, setPlans] = useState<MembershipPlanRow[] | null>(null);

    useEffect(() => {
        let cancelled = false;

        // Failure is silent, and deliberately: this is a helpful aside on a form
        // about something else. An error banner here would interrupt the task
        // the applicant is actually doing.
        getMembershipPlanCatalogue()
            .then((rows) => { if (!cancelled) setPlans(rows); })
            .catch(() => { if (!cancelled) setPlans([]); });

        return () => { cancelled = true; };
    }, []);

    const result = useMemo(() => {
        const parsed = parseInt(String(year || '').trim(), 10);
        if (!Number.isFinite(parsed) || String(year || '').trim().length !== 4) return null;

        const thisYear = new Date().getFullYear();
        if (parsed < 1800 || parsed > thisYear) {
            return { error: `That is not a year a business could have started in.` };
        }

        if (plans === null) return { loading: true };

        const years = thisYear - parsed;
        const business = plans
            .filter((plan) => plan.audience === 'business' && plan.active)
            .sort((a, b) => a.minYears - b.minYears);

        if (!business.length) return null;

        // The server's rule, applied here: `max` is exclusive, so the bands
        // cannot overlap and a company at exactly the boundary falls in one.
        const matched = business.find((plan) => {
            if (years < Number(plan.minYears || 0)) return false;
            const max = plan.maxYears === null || plan.maxYears === undefined
                ? null
                : Number(plan.maxYears);
            return max === null || years < max;
        });

        return { years, matched: matched || null };
    }, [year, plans]);

    if (!result) return null;

    if ('error' in result) {
        return <p className="mt-1.5 text-[1.0625rem] text-amber-600">{result.error}</p>;
    }

    if ('loading' in result) {
        return (
            <p className="mt-1.5 flex items-center gap-1.5 text-[1.0625rem] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking your membership plan…
            </p>
        );
    }

    if (!result.matched) {
        return (
            <p className="mt-1.5 text-[1.0625rem] text-slate-500">
                {result.years} {result.years === 1 ? 'year' : 'years'} trading. Your membership
                plan will be confirmed at the payment step.
            </p>
        );
    }

    return (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[1.0625rem] text-slate-600">
            <span className="font-medium text-slate-700">
                {result.years} {result.years === 1 ? 'year' : 'years'} trading
            </span>
            <span className="text-slate-400">→</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                {result.matched.name}
                <span className="inline-flex items-center">
                    <IndianRupee className="w-3 h-3" />
                    {Number(result.matched.price || 0).toLocaleString('en-IN')}
                </span>
            </span>
            {/* The hedge matters: the server resolves this again at payment from
                the saved record, and a number on a form otherwise reads as a
                price that has been agreed. */}
            <span className="text-slate-400">· confirmed at the payment step</span>
        </p>
    );
}
