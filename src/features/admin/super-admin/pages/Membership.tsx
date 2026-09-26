import { useCardTable } from '@/lib/useCardTable';
import { useEffect, useMemo, useState } from 'react';
import {
    Menu, Plus, Pencil, X, Loader2, IndianRupee, Users, Building2,
    GraduationCap, EyeOff, Check, AlertTriangle, Sparkles, CalendarRange, Wand2, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import AdminSidebar from './AdminSidebar';
import { CARD_TITLE } from '@/components/layout/appTypography';
import { ADMIN_PAGE, ADMIN_PRIMARY_BTN, AdminPageHeader, rupees,
} from '@/features/admin/components/AdminUI';
import {
    listMembershipPlans, createMembershipPlan, updateMembershipPlan,
    retireMembershipPlan, deleteMembershipPlan, updateMembershipSettings, alignMembershipBands, errorMessage,
    type MembershipPlanRow,
} from '@/services/activApi';

/**
 * Membership pricing — what it costs, and who is offered which plan.
 *
 * THIS SCREEN DECIDES WHAT IS CHARGED, not what is advertised. The rows it
 * edits are the rows `paymentOrder.createOrder` reads, so changing ₹2,000 to
 * ₹5,000 here changes the amount taken from the card. Before this existed the
 * prices were a frozen table in the server bundle and raising a fee meant a
 * deploy.
 *
 * TWO THINGS ARE BEING SET, and they are separate questions:
 *
 *   1. THE AMOUNT on each plan.
 *   2. THE BAND — how many years a company must have traded to be offered it.
 *      An applicant is shown the ONE plan their commencement year earns them,
 *      not a menu of three. A company trading two years is a Starter member;
 *      offering them the ₹20,000 tier invites a payment that has to be refunded.
 *
 * The "show every plan" switch restores the old behaviour for an association
 * that would rather members chose freely. It is one switch rather than a
 * different screen, because the two arrangements differ by exactly one rule.
 *
 * BANDS ARE HALF-OPEN — `[from, to)`. "0 to 5" and "5 to 10" read as touching
 * to a person and as overlapping to a computer; with the top exclusive, a
 * company at exactly five years lands in the second band and in only one band,
 * and nobody has to think about it. The preview at the bottom of the page is
 * there so that is demonstrable rather than a claim.
 */

const BLANK: Partial<MembershipPlanRow> = {
    key: '',
    name: '',
    description: '',
    price: 0,
    audience: 'business',
    minYears: 0,
    maxYears: null,
    features: [],
    popular: false,
    active: true,
    order: 0,
};

/**
 * ₹10,000 — the admin area's one formatter, aliased to the name this file
 * already calls it by. The definition moved to `AdminUI` so the three money
 * screens cannot drift apart again; see its note there.
 */
const money = rupees;

/**
 * The band, as a person reads it. Derived from the numbers on every render, so
 * a moved boundary cannot leave a stale label behind.
 *
 * Mirrors `bandLabel` on the server. The two must agree: this screen says what
 * the rule is, and the server applies it.
 */
const bandLabel = (plan: Partial<MembershipPlanRow>) => {
    if (plan.audience === 'aspirant') return 'No business — aspirant';
    const min = Number(plan.minYears || 0);
    const max = plan.maxYears === null || plan.maxYears === undefined ? null : Number(plan.maxYears);
    if (max === null) return `${min}+ years trading`;
    if (min === 0) return `Under ${max} years trading`;
    return `${min} – ${max} years trading`;
};

/**
 * THE BAND AS CALENDAR YEARS — which is what an applicant actually types.
 *
 * A plan stores a DURATION ("5 to 10 years trading"), and the form asks for a
 * YEAR ("2018"). Everything on this screen was expressed in the first and
 * nothing in the second, so the Super Admin setting the rule and the applicant
 * obeying it were looking at two different units, with the conversion done in
 * nobody's head.
 *
 * DURATION IS STILL WHAT IS STORED, and that is not an implementation detail —
 * it is the behaviour the association wants. A band held as calendar years
 * would freeze: a company that started in 2020 would sit in the same tier in
 * 2040, because 2020 would still be inside "2020–2025". Held as a duration, it
 * moves up a tier as it matures, which is the entire point of pricing by
 * commencement year. So the years below are a VIEW, recomputed every January,
 * and the screen says so rather than letting an editor assume they are fixed.
 *
 * The arithmetic, for `[minYears, maxYears)` and the current year Y:
 *
 *     years traded = Y - startYear
 *     minYears <= Y - startYear < maxYears
 *     Y - maxYears < startYear <= Y - minYears
 *
 * so the newest company in the band started in `Y - minYears`, and the oldest
 * in `Y - maxYears + 1`. An open-ended band has no oldest.
 */
const yearWindow = (plan: Partial<MembershipPlanRow>, thisYear: number) => {
    const min = Number(plan.minYears || 0);
    const max = plan.maxYears === null || plan.maxYears === undefined ? null : Number(plan.maxYears);

    const newest = thisYear - min;
    const oldest = max === null ? null : thisYear - max + 1;

    return { newest, oldest };
};

/** "started 2022–2026", or "started 2016 or earlier". */
const yearWindowLabel = (plan: Partial<MembershipPlanRow>, thisYear: number) => {
    if (plan.audience === 'aspirant') return '';

    const { newest, oldest } = yearWindow(plan, thisYear);
    if (oldest === null) return `started ${newest} or earlier`;
    if (oldest === newest) return `started ${newest}`;
    return `started ${oldest}–${newest}`;
};

/** The reverse, for the editor's year inputs: a start year back to a duration. */
const yearsFromStart = (startYear: number, thisYear: number) =>
    Math.max(0, thisYear - startYear);

/** The same half-open rule the server uses, for the preview below. */
const inBand = (plan: MembershipPlanRow, years: number) => {
    if (years < Number(plan.minYears || 0)) return false;
    const max = plan.maxYears === null || plan.maxYears === undefined ? null : Number(plan.maxYears);
    return max === null || years < max;
};

export default function SuperAdminMembership() {
    const cardTableRef = useCardTable();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [plans, setPlans] = useState<MembershipPlanRow[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [aligning, setAligning] = useState(false);

    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<Partial<MembershipPlanRow>>({ ...BLANK });

    /** The year an admin types into the preview, to see what an applicant gets. */
    const [previewYear, setPreviewYear] = useState('');

    /*
     * Read once per render, not per row.
     *
     * Every year label on this screen is derived from it, and reading
     * `new Date()` inside each of them would let a page open at 23:59:59 on 31
     * December print two different years in two places.
     */
    const thisYear = new Date().getFullYear();

    const load = async () => {
        setLoading(true);
        try {
            const data = await listMembershipPlans();
            setPlans(data.plans || []);
            setShowAll(!!data.settings?.showAllPlans);
        } catch (err) {
            toast.error(errorMessage(err, 'Could not load the membership plans'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openNew = () => {
        setForm({ ...BLANK });
        setCreating(true);
        setEditingKey(null);
    };

    const openEdit = (plan: MembershipPlanRow) => {
        setForm({ ...plan });
        setEditingKey(plan.key);
        setCreating(false);
    };

    const closeForm = () => {
        setEditingKey(null);
        setCreating(false);
        setForm({ ...BLANK });
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                // The textarea is one feature per line, which is how an editor
                // thinks about a bullet list. Split here rather than on the
                // server so an empty line cannot become an empty bullet.
                features: Array.isArray(form.features)
                    ? form.features
                    : String(form.features || '').split('\n').map(s => s.trim()).filter(Boolean),
            };

            if (creating) await createMembershipPlan(payload);
            else if (editingKey) await updateMembershipPlan(editingKey, payload);

            toast.success(creating ? 'Plan created' : 'Plan updated — applicants see the new price now');
            closeForm();
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save this plan'));
        } finally {
            setSaving(false);
        }
    };


    const alignBands = async () => {
        setAligning(true);
        try {
            const result = await alignMembershipBands();
            toast.success(result.changed
                ? `Adjusted ${result.changed} ${result.changed === 1 ? 'plan' : 'plans'} — every year is covered now`
                : 'The bands were already continuous');
            await load();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not align the bands'));
        } finally {
            setAligning(false);
        }
    };

    /**
     * Delete, with retire offered only when deletion is actually blocked.
     *
     * The server decides which of the two is possible — it is the only side that
     * can count the payments referencing a plan — so this asks for the delete
     * and reacts to the answer, rather than presenting the editor with two
     * buttons and expecting them to know.
     */
    const removePlan = async (plan: MembershipPlanRow) => {
        if (!window.confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;

        try {
            await deleteMembershipPlan(plan.key);
            toast.success(`"${plan.name}" deleted`);
            await load();
            return;
        } catch (err) {
            const message = errorMessage(err, 'Could not delete this plan');

            // Blocked because payments point at it. Offer the thing that IS
            // possible, with the server's own count in the question.
            if (/cannot be deleted/i.test(message)) {
                if (window.confirm(`${message}\n\nRetire it instead?`)) {
                    try {
                        await retireMembershipPlan(plan.key);
                        toast.success(`"${plan.name}" retired — existing records are untouched`);
                        await load();
                    } catch (retireErr) {
                        toast.error(errorMessage(retireErr, 'Could not retire this plan'));
                    }
                }
                return;
            }

            toast.error(message);
        }
    };

    const toggleShowAll = async (next: boolean) => {
        setShowAll(next);   // optimistic: the switch must feel immediate
        try {
            await updateMembershipSettings({ showAllPlans: next });
            toast.success(next
                ? 'Applicants now see every plan'
                : 'Applicants now see only the plan their commencement year earns');
        } catch (err) {
            setShowAll(!next);
            toast.error(errorMessage(err, 'Could not save that setting'));
        }
    };

    const business = useMemo(
        () => plans.filter(p => p.audience === 'business').sort((a, b) => a.minYears - b.minYears),
        [plans],
    );
    const aspirant = useMemo(() => plans.filter(p => p.audience === 'aspirant'), [plans]);

    /**
     * GAPS AND OVERLAPS IN THE BANDS, found rather than assumed.
     *
     * A band that starts after the previous one ends leaves years that match no
     * plan, and an applicant in that gap is shown a choice of everything —
     * which looks like the feature not working. Two bands covering the same year
     * mean the first one wins silently. Neither is visible by reading four rows
     * in a table, so they are computed and named.
     */
    const bandProblems = useMemo(() => {
        const active = business.filter(p => p.active);
        const problems: string[] = [];

        if (active.length && Number(active[0].minYears) > 0) {
            problems.push(`Nothing covers companies under ${active[0].minYears} years old.`);
        }

        active.forEach((plan, i) => {
            const next = active[i + 1];
            if (!next) {
                if (plan.maxYears !== null) {
                    problems.push(`Nothing covers companies over ${plan.maxYears} years old.`);
                }
                return;
            }
            if (plan.maxYears === null) {
                problems.push(`"${plan.name}" is open-ended, so "${next.name}" can never match.`);
                return;
            }
            if (Number(plan.maxYears) < Number(next.minYears)) {
                problems.push(`Nothing covers ${plan.maxYears} to ${next.minYears} years.`);
            }
            if (Number(plan.maxYears) > Number(next.minYears)) {
                problems.push(`"${plan.name}" and "${next.name}" overlap between ${next.minYears} and ${plan.maxYears} years.`);
            }
        });

        return problems;
    }, [business]);

    /**
     * The commencement years, collapsed into contiguous runs.
     *
     * WHY RUNS AND NOT YEARS. Forty individual rows are forty renderings of four
     * facts, and thirty of them said ₹20,000. Walking the years newest-first and
     * closing a run whenever the plan changes gives one row per plan — plus one
     * row per gap, which is the case worth seeing and the only one that gets a
     * row it did not earn.
     *
     * Walked rather than read off the plans directly, because a gap has no plan
     * to read it off: the runs come from the same `inBand` the applicant is
     * resolved with, so a year missing here is a year missing in production.
     *
     * The last run is open-ended — everything older lands in the top band — so
     * it is labelled "and earlier" rather than given a boundary the rule does
     * not have.
     */
    const SPAN = 40;

    const yearRanges = useMemo(() => {
        const active = business.filter((plan) => plan.active);
        if (!active.length) return [];

        const planFor = (year: number) =>
            active.find((plan) => inBand(plan, thisYear - year)) || null;

        const runs: {
            key: string; years: string; duration: string; plan: MembershipPlanRow | null;
        }[] = [];

        let runPlan = planFor(thisYear);
        let runNewest = thisYear;

        const close = (oldest: number, openEnded: boolean) => {
            const years = openEnded
                ? `${oldest} and earlier`
                : oldest === runNewest ? `${oldest}` : `${oldest} – ${runNewest}`;

            runs.push({
                key: `${runNewest}-${oldest}`,
                years,
                duration: runPlan ? bandLabel(runPlan) : '—',
                plan: runPlan,
            });
        };

        for (let year = thisYear - 1; year >= thisYear - SPAN; year--) {
            const plan = planFor(year);
            if (plan?.key === runPlan?.key) continue;

            close(year + 1, false);
            runPlan = plan;
            runNewest = year;
        }

        // Everything at or below the end of the walk shares the last run's plan,
        // because the oldest band is open-ended by construction.
        close(thisYear - SPAN, true);

        return runs;
    }, [business, thisYear]);

    /** What an applicant with this commencement year would be shown. */
    const preview = useMemo(() => {
        const year = parseInt(previewYear, 10);
        if (!Number.isFinite(year) || year <= 0) return null;

        const years = Math.max(0, new Date().getFullYear() - year);
        const active = business.filter(p => p.active);
        const matched = active.find(p => inBand(p, years)) || null;

        return { years, matched, showAll };
    }, [previewYear, business, showAll]);

    const editingPlan = editingKey ? plans.find(p => p.key === editingKey) : null;

    return (
        <div className="min-h-screen bg-white flex">
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0">
                {/* The one admin header — see `AdminPageHeader`. It carries the
                    menu button, the way back and the mobile stacking, so the
                    three super-admin screens cannot drift apart again. */}
                <AdminPageHeader
                    title="Membership Plans"
                    subtitle={<>
                        What a membership costs, and which commencement year earns which plan.
                        An edit here changes what applicants are charged.
                    </>}
                    onMenu={() => setSidebarOpen(true)}
                    actions={
                        <button onClick={openNew} className={ADMIN_PRIMARY_BTN + ' justify-center'}>
                            <Plus className="w-4 h-4" /> Add plan
                        </button>
                    }
                />

                <main className={ADMIN_PAGE}>
                    {/* ------------------------------------------------ the rule */}
                    <section className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6">
                        <div
                            role="checkbox"
                            aria-checked={showAll}
                            tabIndex={0}
                            onClick={() => toggleShowAll(!showAll)}
                            onKeyDown={(e) => {
                                if (e.key !== ' ' && e.key !== 'Enter') return;
                                e.preventDefault();
                                toggleShowAll(!showAll);
                            }}
                            className={`cursor-pointer flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                                showAll
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`mt-0.5 w-4 h-4 shrink-0 rounded border-2 flex items-center
                                            justify-center transition-colors ${
                                    showAll ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
                                }`}
                            >
                                {showAll && <Check className="w-3 h-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0">
                                <span className={`block text-[1.25rem] font-semibold ${
                                    showAll ? 'text-blue-700' : 'text-slate-800'
                                }`}>
                                    Show every plan to every applicant
                                </span>
                                {/* The copy names the OTHER state as well as this
                                    one. A switch that only describes where it
                                    currently stands leaves the reader guessing what
                                    pressing it does — which is the question they
                                    have. */}
                                <span className="block text-[1.1875rem] text-slate-500 mt-1 leading-snug">
                                    {showAll
                                        ? 'On — every applicant picks from all three company plans, whatever '
                                          + 'their commencement year. Turn this off to show each applicant only '
                                          + 'the one plan their year earns, the way the aspirant plan works.'
                                        : 'Off — each applicant sees only the one plan their commencement year '
                                          + 'earns them, at the price set below, exactly as an aspirant sees only '
                                          + 'the aspirant plan. Turn this on to let them choose from all three.'}
                                </span>
                            </span>
                        </div>
                    </section>

                    {/* --------------------------------------------- band health */}
                    {bandProblems.length > 0 && (
                        /*
                          Shown only when something is actually wrong. A permanent
                          "bands look fine" panel is a panel nobody reads, and the
                          one time it matters it looks the same as always.
                        */
                        <section className="rounded-xl border border-amber-300 bg-amber-50 shadow-sm p-6">
                            <p className="flex items-center gap-2 text-[1.25rem] font-bold text-amber-900">
                                <AlertTriangle className="w-5 h-5" />
                                These bands leave applicants without a plan
                            </p>
                            <ul className="mt-2 space-y-1 text-[1.1875rem] text-amber-700 list-disc list-inside">
                                {bandProblems.map((problem, i) => <li key={i}>{problem}</li>)}
                            </ul>
                            <p className="mt-2 text-[1.1875rem] text-amber-700">
                                An applicant no band covers is shown every plan instead, and where two
                                bands overlap the cheaper one silently wins — which reads as the rule not
                                working.
                            </p>

                            {/*
                              One press, rather than a repair by hand.
                              
                              Fixing this manually means editing three plans in an
                              order that never passes through an overlap — because
                              the server rejects those — which is a puzzle, not a
                              task. The button applies the obvious rule: start at
                              zero, each band ends where the next begins, the last
                              runs on for ever. Names, prices and order are
                              untouched; only the boundaries move.
                            */}
                            <button
                                type="button"
                                onClick={alignBands}
                                disabled={aligning}
                                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3.5
                                           py-2 text-[1.1875rem] font-semibold text-white transition-colors
                                           hover:bg-amber-700 disabled:opacity-60"
                            >
                                {aligning
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Wand2 className="w-3.5 h-3.5" />}
                                Make the bands continuous
                            </button>
                        </section>
                    )}

                    {/* -------------------------------------------------- editor */}
                    {(creating || editingKey) && (
                        /*
                          An inline card, not a dialog. The bands only make sense
                          read against each other, and a modal covers the rows the
                          editor is comparing this one to.
                        */
                        <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className={`${CARD_TITLE} text-slate-900`}>
                                    {creating ? 'New plan' : `Editing ${editingPlan?.name || editingKey}`}
                                </h2>
                                <button type="button" onClick={closeForm} aria-label="Close"
                                    className="text-slate-400 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="Plan name">
                                    <input
                                        required
                                        value={form.name || ''}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Starter"
                                        className={INPUT}
                                    />
                                </Field>

                                <Field
                                    label="Key"
                                    hint={creating
                                        ? 'Used by the payment call. Lowercase, no spaces, and permanent.'
                                        : 'Permanent — a paid membership points at it.'}
                                >
                                    <input
                                        required
                                        disabled={!creating}
                                        value={form.key || ''}
                                        onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                                        placeholder="starter"
                                        className={`${INPUT} disabled:bg-slate-50 disabled:text-slate-500`}
                                    />
                                </Field>

                                <Field label="Price" hint="What the applicant is actually charged.">
                                    <MoneyInput
                                        value={form.price}
                                        onChange={(price) => setForm({ ...form, price })}
                                    />
                                </Field>

                                <Field label="Who it is for">
                                    <select
                                        value={form.audience || 'business'}
                                        onChange={(e) => setForm({
                                            ...form,
                                            audience: e.target.value as 'business' | 'aspirant',
                                        })}
                                        className={INPUT}
                                    >
                                        <option value="business">A company — priced by years trading</option>
                                        <option value="aspirant">An aspirant — no company</option>
                                    </select>
                                </Field>

                                {/* Bands are meaningless for an aspirant: there is
                                    no company, so there is no commencement year to
                                    band. Hidden rather than disabled — a disabled
                                    pair of boxes invites the question this removes. */}
                                {form.audience !== 'aspirant' && (
                                    <>
                                        <Field label="From (years trading)" hint="Inclusive.">
                                            <input
                                                type="number"
                                                min={0}
                                                value={form.minYears ?? 0}
                                                onChange={(e) => setForm({ ...form, minYears: Number(e.target.value) })}
                                                className={INPUT}
                                            />
                                        </Field>

                                        <Field
                                            label="To (years trading)"
                                            hint="Exclusive, and blank means open-ended."
                                        >
                                            <input
                                                type="number"
                                                min={1}
                                                value={form.maxYears ?? ''}
                                                placeholder="No upper limit"
                                                onChange={(e) => setForm({
                                                    ...form,
                                                    maxYears: e.target.value === '' ? null : Number(e.target.value),
                                                })}
                                                className={INPUT}
                                            />
                                        </Field>

                                        {/*
                                          THE SAME BAND, TYPED AS COMMENCEMENT YEARS.

                                          Two ways in, one value stored. An editor who
                                          thinks "companies that started in 2017 or
                                          later" should not have to work out that this
                                          is nine years, and get it wrong by one in
                                          the process.

                                          These write straight through to the duration
                                          fields above, so the pairs cannot disagree —
                                          there is only ever one band, and this is a
                                          second dial on it rather than a second
                                          setting.
                                        */}
                                        <div className="sm:col-span-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                                            <p className="text-[1.1875rem] font-semibold text-blue-800">
                                                Or set it by commencement year
                                            </p>
                                            <p className="text-[1.0625rem] text-blue-700/80 mt-0.5 mb-2.5">
                                                Which years a company can have started in to earn this plan.
                                                Stored as a duration, so this window moves forward every
                                                January and a company rises to the next plan as it matures.
                                            </p>

                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <Field label="Started in or after" hint="The oldest company in this band.">
                                                    <input
                                                        type="number"
                                                        value={form.maxYears === null || form.maxYears === undefined
                                                            ? ''
                                                            : thisYear - Number(form.maxYears) + 1}
                                                        placeholder="No limit"
                                                        onChange={(e) => setForm({
                                                            ...form,
                                                            // Inverse of `yearWindow`. Blank means the band
                                                            // reaches back for ever, which is `maxYears: null`.
                                                            maxYears: e.target.value === ''
                                                                ? null
                                                                : yearsFromStart(Number(e.target.value), thisYear) + 1,
                                                        })}
                                                        className={INPUT}
                                                    />
                                                </Field>

                                                <Field label="Started in or before" hint="The newest company in this band.">
                                                    <input
                                                        type="number"
                                                        value={thisYear - Number(form.minYears || 0)}
                                                        onChange={(e) => setForm({
                                                            ...form,
                                                            minYears: yearsFromStart(Number(e.target.value), thisYear),
                                                        })}
                                                        className={INPUT}
                                                    />
                                                </Field>
                                            </div>

                                            <p className="mt-2 text-[1.0625rem] text-blue-800">
                                                Right now: <strong>{yearWindowLabel(form, thisYear)}</strong>
                                                {' · '}{bandLabel(form)}
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div className="sm:col-span-2">
                                    <Field label="One-line description">
                                        <input
                                            value={form.description || ''}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="For companies trading under five years"
                                            className={INPUT}
                                        />
                                    </Field>
                                </div>

                                <div className="sm:col-span-2">
                                    <Field label="What it includes" hint="One line each, shown as bullets.">
                                        <textarea
                                            rows={4}
                                            value={Array.isArray(form.features)
                                                ? form.features.join('\n')
                                                : String(form.features || '')}
                                            onChange={(e) => setForm({
                                                ...form,
                                                features: e.target.value.split('\n'),
                                            })}
                                            className={INPUT}
                                        />
                                    </Field>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 pt-1">
                                <Toggle
                                    checked={!!form.popular}
                                    onChange={(v) => setForm({ ...form, popular: v })}
                                    label="Mark as most popular"
                                />
                                <Toggle
                                    checked={form.active !== false}
                                    onChange={(v) => setForm({ ...form, active: v })}
                                    label="Offered to applicants"
                                />
                            </div>

                            <div className="flex gap-3 pt-2 border-t">
                                <button type="button" onClick={closeForm}
                                    className="h-11 px-5 rounded-xl border border-slate-200 text-[1.25rem] font-semibold text-slate-700 transition-colors hover:border-slate-300">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5
                                               rounded-lg bg-blue-600 text-white text-[1.25rem] font-medium
                                               disabled:opacity-60"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {creating ? 'Create plan' : 'Save — applicants see it immediately'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* --------------------------------------------------- plans */}
                    {loading ? (
                        <p className="flex items-center gap-2 text-[1.25rem] text-slate-500 py-10">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading plans…
                        </p>
                    ) : (
                        <>
                            <PlanGroup
                                title="Company plans"
                                hint="Ordered by band. An applicant is offered the one their commencement year falls in."
                                icon={<Building2 className="w-4 h-4 text-blue-600" />}
                                plans={business}
                                thisYear={thisYear}
                                onEdit={openEdit}
                                onDelete={removePlan}
                            />
                            <PlanGroup
                                title="Aspirant plan"
                                hint="For an applicant who declared no business. No band applies."
                                icon={<GraduationCap className="w-4 h-4 text-emerald-600" />}
                                plans={aspirant}
                                thisYear={thisYear}
                                onEdit={openEdit}
                                onDelete={removePlan}
                            />
                        </>
                    )}

                    {/* --------------------------------------- year → plan map */}
                    {/*
                      EVERY COMMENCEMENT YEAR, AS RANGES RATHER THAN AS FORTY TILES.

                      The first version of this printed one tile per year — three
                      wrapped rows of near-identical boxes, thirty of them saying
                      ₹20,000, and the page no longer fitted a screen. The
                      information in it was four facts; the presentation was forty.

                      One row per plan says the same thing and fits: the years it
                      covers, the rule behind them, and the price. A year that no
                      plan covers is the exception, so it gets its own row and is
                      the only thing on this panel drawn in amber.
                    */}
                    {business.some(p => p.active) && (
                        <section className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6">
                            <div className="flex items-start gap-3 mb-5">
                                <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center
                                                 justify-center shrink-0">
                                    <CalendarRange className="w-5 h-5 text-blue-600" />
                                </span>
                                <div className="min-w-0">
                                    <h2 className={`${CARD_TITLE} text-slate-900`}>
                                        Commencement year → plan
                                    </h2>
                                    <p className="text-[1.25rem] text-slate-500 mt-0.5">
                                        What a company that started in each year is offered today. Every row
                                        shifts by one year each January, because the bands are durations.
                                    </p>
                                </div>
                            </div>

                            <div ref={cardTableRef} className="overflow-x-auto card-table">
                                <table className="w-full text-[1.25rem]">
                                    <thead>
                                        <tr className="text-left text-slate-500 border-b border-slate-200">
                                            <th className="pb-3 pr-4 text-[1.0625rem] font-semibold uppercase tracking-wider">Started in</th>
                                            <th className="pb-3 pr-4 text-[1.0625rem] font-semibold uppercase tracking-wider">Years trading</th>
                                            <th className="pb-3 pr-4 text-[1.0625rem] font-semibold uppercase tracking-wider">Plan</th>
                                            <th className="pb-3 text-[1.0625rem] font-semibold uppercase tracking-wider text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {yearRanges.map((row) => (
                                            <tr
                                                key={row.key}
                                                onClick={() => row.plan && openEdit(row.plan)}
                                                className={`border-b border-slate-100 last:border-0 ${
                                                    row.plan
                                                        ? 'cursor-pointer hover:bg-blue-50/60'
                                                        : 'bg-amber-50'
                                                }`}
                                            >
                                                <td className="py-2.5 pr-4 font-semibold text-slate-800
                                                               whitespace-nowrap">
                                                    {row.years}
                                                </td>
                                                <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">
                                                    {row.duration}
                                                </td>
                                                <td className="py-2.5 pr-4">
                                                    {row.plan ? (
                                                        <span className="font-semibold text-slate-800">
                                                            {row.plan.name}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5
                                                                         font-semibold text-amber-700">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            No plan covers these years
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 text-right font-bold whitespace-nowrap">
                                                    {row.plan
                                                        ? <span className="text-slate-900">{money(row.plan.price)}</span>
                                                        : <span className="text-amber-700">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* ------------------------------------------------- preview */}
                    {/*
                      SEE WHAT AN APPLICANT WOULD SEE, without creating one.

                      Bands are the kind of rule that is easy to state and easy to
                      get wrong by one year, and the only way to check it was to
                      register a test applicant with the right commencement year.
                      Typing the year here answers the same question in a second,
                      using the same half-open rule the server applies.
                    */}
                    <section className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] p-6">
                        <div className="flex items-start gap-3 mb-5">
                            <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5 text-blue-600" />
                            </span>
                            <div className="min-w-0">
                                <h2 className={`${CARD_TITLE} text-slate-900`}>Check a commencement year</h2>
                                <p className="text-[1.25rem] text-slate-500 mt-0.5">
                                    What an applicant whose company started in this year would be shown.
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            <input
                                type="number"
                                value={previewYear}
                                onChange={(e) => setPreviewYear(e.target.value)}
                                placeholder="e.g. 2021"
                                className={`${INPUT} max-w-[11rem]`}
                            />

                            {preview && (
                                <p className="text-[1.25rem] text-slate-700">
                                    {preview.showAll ? (
                                        <>
                                            <strong>{preview.years} years trading</strong> — and every plan is
                                            shown, because the switch at the top of this page is on.
                                        </>
                                    ) : preview.matched ? (
                                        <>
                                            <strong>{preview.years} years trading</strong> → they see{' '}
                                            <strong className="text-blue-700">{preview.matched.name}</strong>{' '}
                                            at{' '}
                                            <strong className="text-blue-700">{money(preview.matched.price)}</strong>,
                                            and nothing else.
                                        </>
                                    ) : (
                                        <span className="text-amber-700">
                                            <strong>{preview.years} years trading</strong> — no band covers this,
                                            so they would be shown every plan. Fix the bands above.
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- small parts

/*
 * The registration forms' input, to the pixel.
 *
 * This screen had its own lighter treatment — thinner labels, shorter boxes —
 * and next to the four registration steps it read as a different, less
 * finished product. There is one form language in this application; an admin
 * screen is not a reason to invent a second.
 */
const INPUT =
    'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[1.25rem] text-slate-900 '
    + 'outline-none transition-colors placeholder:text-slate-400 '
    + 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

/** `FormField` from `RegistrationFormShell`: bold label, hint underneath. */
function Field({ label, hint, full, children }: {
    label: string; hint?: string; full?: boolean; children: React.ReactNode;
}) {
    return (
        <div className={`min-w-0 ${full ? 'sm:col-span-2' : ''}`}>
            <label className="block text-[1.25rem] font-semibold text-slate-700 mb-2">{label}</label>
            {children}
            {hint && <p className="text-[1.1875rem] text-slate-500 mt-1.5">{hint}</p>}
        </div>
    );
}

/**
 * An amount, typed.
 *
 * `<input type="number">` was wrong here in two ways an editor meets at once:
 * it renders spinner arrows nobody wants on a price, and it showed a literal
 * `0` on a new plan — which is a value, so it had to be selected and deleted
 * before a real figure could be typed, and left as-is it saves a free plan.
 *
 * Text with a numeric keypad instead. Empty means empty, the ₹ sits in the box
 * rather than in the label, and everything but digits is dropped on the way in
 * so a pasted "₹10,000" becomes 10000 rather than being rejected.
 */
function MoneyInput({ value, onChange }: {
    value: number | undefined;
    onChange: (value: number) => void;
}) {
    return (
        <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2
                             text-[1.25rem] font-semibold text-slate-400">
                ₹
            </span>
            <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                // Zero is a real price — a free plan — but it is never what a
                // blank new form means, so it shows as blank until typed.
                value={value ? String(value) : ''}
                placeholder="0"
                onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, '');
                    onChange(digits ? parseInt(digits, 10) : 0);
                }}
                className={`${INPUT} pl-7 font-semibold`}
            />
        </div>
    );
}

function Toggle({ checked, onChange, label }: {
    checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="inline-flex items-center gap-2 text-[1.25rem] text-slate-700"
        >
            <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                checked ? 'bg-blue-600' : 'bg-slate-300'
            }`}>
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    checked ? 'translate-x-4' : ''
                }`} />
            </span>
            {label}
        </button>
    );
}

function PlanGroup({ title, hint, icon, plans, thisYear, onEdit, onDelete }: {
    title: string;
    hint: string;
    icon: React.ReactNode;
    plans: MembershipPlanRow[];
    thisYear: number;
    onEdit: (plan: MembershipPlanRow) => void;
    onDelete: (plan: MembershipPlanRow) => void;
}) {
    return (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200 flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    {icon}
                </span>
                <div className="min-w-0">
                    <h2 className={`${CARD_TITLE} text-slate-900`}>{title}</h2>
                    <p className="text-[1.25rem] text-slate-500 mt-0.5">{hint}</p>
                </div>
            </header>

            {plans.length === 0 ? (
                <p className="px-5 py-8 text-[1.25rem] text-slate-500">No plans here yet.</p>
            ) : (
                <ul className="divide-y">
                    {plans.map((plan) => (
                        <li
                            key={plan.key}
                            className={`px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 ${
                                plan.active ? '' : 'bg-slate-50'
                            }`}
                        >
                            <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[1.25rem] font-semibold ${
                                        plan.active ? 'text-slate-900' : 'text-slate-500'
                                    }`}>
                                        {plan.name}
                                    </span>

                                    {plan.popular && (
                                        <span className="inline-flex items-center gap-1 text-[1.0625rem] font-bold
                                                         uppercase tracking-wide px-1.5 py-0.5 rounded-full
                                                         bg-blue-100 text-blue-700">
                                            <Users className="w-2.5 h-2.5" /> Popular
                                        </span>
                                    )}

                                    {/* Retired is the state worth marking. Every
                                        other row is offered, so a badge saying so
                                        would be on every line. */}
                                    {!plan.active && (
                                        <span className="inline-flex items-center gap-1 text-[1.0625rem] font-bold
                                                         uppercase tracking-wide px-1.5 py-0.5 rounded-full
                                                         bg-slate-200 text-slate-500">
                                            <EyeOff className="w-2.5 h-2.5" /> Retired
                                        </span>
                                    )}
                                </p>
                                <p className="text-[1.1875rem] text-slate-500 mt-0.5">
                                    {bandLabel(plan)}
                                    {/* The same band in the unit the APPLICANT types.
                                        The form asks for a year; this row said
                                        "5 – 10 years trading", and nobody was doing
                                        that conversion reliably in their head. */}
                                    {plan.audience !== 'aspirant' && (
                                        <span className="text-slate-400">
                                            {' · '}{yearWindowLabel(plan, thisYear)}
                                        </span>
                                    )}
                                    {plan.description ? ` · ${plan.description}` : ''}
                                </p>
                            </div>

                            <p className="inline-flex items-center text-[1.375rem] font-bold tracking-tight text-slate-900">
                                <IndianRupee className="w-4 h-4" />
                                {Number(plan.price || 0).toLocaleString('en-IN')}
                            </p>

                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => onEdit(plan)}
                                    aria-label={`Edit ${plan.name}`}
                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                {/*
                                  DELETE, and it deletes.

                                  This was a Retire button, which is a word an
                                  editor has to be taught and which does not do
                                  what pressing Delete elsewhere in the product
                                  does. The server refuses a delete that would
                                  orphan a receipt and says how many payments
                                  reference the plan; only then is Retire offered,
                                  as the answer to a specific problem rather than
                                  as the only verb on the screen.
                                */}
                                <button
                                    onClick={() => onDelete(plan)}
                                    aria-label={`Delete ${plan.name}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg
                                               text-[1.1875rem] font-semibold text-red-600 border border-red-200
                                               transition-colors hover:bg-red-50 hover:border-red-300"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
