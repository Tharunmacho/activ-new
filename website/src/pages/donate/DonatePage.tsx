import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HeartHandshake, ShieldCheck, FileCheck2, CalendarRange, Loader2, User, Building2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import { errorMessage } from '@/services/api';
import { createDonation, mockCompleteDonation, type DonorType } from '@/services/donationsApi';

/**
 * ============================================================================
 * /donate — GIVE TO ACTIV, AND GET AN 80G RECEIPT FOR IT
 * ============================================================================
 *
 * No account is needed: a donor is a person with an email address. The same
 * email is the same donor, so every gift they make lands on one record and the
 * financial year's gifts add up into ONE consolidated certificate — the
 * document they file against their tax. Each gift also gets its own receipt.
 *
 * The amount is only what the donor CHOSE; the server decides what is charged
 * (it validates the range) and hands back the gateway URL.
 *
 * Every sub-part below is a MODULE-LEVEL component. A component declared inside
 * another is a new type on every keystroke; React remounts its input and the
 * phone keyboard closes after each letter.
 */

const PRESETS = [500, 1000, 2500, 5000, 10000];
const MIN = 100;
const MAX = 1000000;

const INPUT =
    'h-[3.25rem] w-full min-w-0 rounded-xl border bg-white px-4 text-ui-caption text-slate-900 ' +
    'placeholder:text-slate-400 transition-colors focus:outline-none focus:border-blue-600 ' +
    'focus:ring-4 focus:ring-blue-600/15 disabled:bg-slate-50';
const LABEL = 'mb-1.5 block text-[1rem] font-semibold text-slate-800';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

type Form = {
    fullName: string;
    email: string;
    phone: string;
    pan: string;
    line1: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    message: string;
};
type Errors = Partial<Record<keyof Form | 'amount', string>>;

const EMPTY: Form = {
    fullName: '', email: '', phone: '', pan: '', line1: '', city: '', district: '', state: '', pincode: '', message: '',
};

/*
 * A RETURNING DONOR'S DETAILS ARE FILLED IN AGAIN.
 *
 * Saved in this browser only (localStorage) as they are typed, and read back
 * on the next visit — so giving again is: pick an amount, press Donate. The
 * amount and the message are NOT kept: they belong to one gift. The server
 * still matches the donor by email, so the year certificate adds up either way.
 */
const SAVED_KEY = 'activ-donor-details';
const SAVED_FIELDS: Array<keyof Form> = ['fullName', 'email', 'phone', 'pan', 'line1', 'city', 'district', 'state', 'pincode'];

const readSaved = (): { form: Form; donorType: DonorType; restored: boolean } => {
    try {
        const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null');
        if (raw && typeof raw === 'object') {
            const form = { ...EMPTY };
            SAVED_FIELDS.forEach((k) => { form[k] = String(raw[k] || ''); });
            const donorType: DonorType = raw.donorType === 'organisation' ? 'organisation' : 'individual';
            return { form, donorType, restored: SAVED_FIELDS.some((k) => !!form[k]) };
        }
    } catch { /* storage unavailable */ }
    return { form: EMPTY, donorType: 'individual', restored: false };
};

const writeSaved = (form: Form, donorType: DonorType) => {
    try {
        const out: Record<string, string> = { donorType };
        SAVED_FIELDS.forEach((k) => { out[k] = String(form[k] || ''); });
        localStorage.setItem(SAVED_KEY, JSON.stringify(out));
    } catch { /* storage unavailable */ }
};

function TextField({ id, label, value, onChange, error, hint, optional, ...rest }: {
    id: keyof Form; label: string; value: string; onChange: (id: keyof Form, v: string) => void;
    error?: string; hint?: string; optional?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
    return (
        <div className="min-w-0">
            <label htmlFor={`d-${id}`} className={LABEL}>
                {label}{optional ? <span className="ml-1.5 font-normal text-slate-400">(optional)</span> : null}
            </label>
            <input
                id={`d-${id}`}
                value={value}
                onChange={(e) => onChange(id, e.target.value)}
                aria-invalid={!!error}
                className={`${INPUT} ${error ? 'border-red-400' : 'border-slate-200'}`}
                {...rest}
            />
            {error ? <p className="mt-1.5 text-[0.9375rem] font-medium text-red-600">{error}</p>
                : hint ? <p className="mt-1.5 text-[0.9375rem] text-slate-500">{hint}</p> : null}
        </div>
    );
}

function AmountPicker({ preset, custom, onPreset, onCustom, error }: {
    preset: number | null; custom: string; onPreset: (n: number) => void; onCustom: (v: string) => void; error?: string;
}) {
    return (
        <fieldset>
            <legend className={LABEL}>Choose an amount</legend>
            <div role="radiogroup" aria-label="Amount" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PRESETS.map((n) => {
                    const on = preset === n;
                    return (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onPreset(n)}
                            className={`h-12 rounded-xl border text-ui-caption font-bold transition-all ${on
                                ? 'border-blue-600 bg-blue-600 text-white shadow-[0_8px_20px_-10px_rgb(37_99_235/0.9)]'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50'}`}
                        >
                            {inr(n)}
                        </button>
                    );
                })}
            </div>
            <div className="relative mt-3">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ui-caption font-bold text-slate-500">₹</span>
                <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Other amount"
                    placeholder="Other amount"
                    value={custom}
                    onChange={(e) => onCustom(e.target.value.replace(/\D/g, '').slice(0, 7))}
                    className={`${INPUT} pl-9 ${error ? 'border-red-400' : 'border-slate-200'}`}
                />
            </div>
            {error ? <p className="mt-1.5 text-[0.9375rem] font-medium text-red-600">{error}</p> : null}
        </fieldset>
    );
}

function DonorTypeChoice({ value, onChange }: { value: DonorType; onChange: (v: DonorType) => void }) {
    const options: Array<[DonorType, string, typeof User]> = [
        ['individual', 'An individual', User],
        ['organisation', 'An organisation', Building2],
    ];
    return (
        <fieldset>
            <legend className={LABEL}>I am donating as</legend>
            <div role="radiogroup" aria-label="Donating as" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map(([key, label, Icon]) => {
                    const on = value === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onChange(key)}
                            className={`flex min-h-[3.25rem] items-center gap-3 rounded-xl border px-4 text-left transition-colors ${on
                                ? 'border-blue-600 bg-blue-50 text-blue-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                        >
                            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-blue-600' : 'border-slate-300'}`}>
                                {on ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
                            </span>
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-ui-caption font-semibold">{label}</span>
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

function Promise_({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
    return (
        <li className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 text-amber-300">
                <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
                <span className="block text-ui-caption font-bold text-white">{title}</span>
                <span className="block text-[0.9375rem] leading-snug text-blue-100">{body}</span>
            </span>
        </li>
    );
}

const validate = (form: Form, amount: number): Errors => {
    const e: Errors = {};
    if (!amount || amount < MIN) e.amount = `The smallest donation is ${inr(MIN)}.`;
    else if (amount > MAX) e.amount = `For more than ${inr(MAX)}, please contact the ACTIV office.`;
    if ((form.fullName || '').trim().length < 2) e.fullName = 'Enter the name to print on the receipt.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((form.email || '').trim())) e.email = 'Enter a valid email — your receipts are sent here.';
    const digits = (form.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!/^[6-9]\d{9}$/.test(digits)) e.phone = 'Enter a 10-digit mobile number.';
    const pan = (form.pan || '').trim().toUpperCase();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) e.pan = 'A PAN looks like ABCDE1234F.';
    if ((form.line1 || '').trim().length < 3) e.line1 = 'Enter your address.';
    if (!(form.city || '').trim()) e.city = 'Enter your city or town.';
    if (!(form.state || '').trim()) e.state = 'Enter your state.';
    if (!/^\d{6}$/.test((form.pincode || '').trim())) e.pincode = 'Enter the 6-digit PIN code.';
    return e;
};

export default function DonatePage() {
    const navigate = useNavigate();
    const [preset, setPreset] = useState<number | null>(1000);
    const [custom, setCustom] = useState('');
    const [saved] = useState(readSaved);
    const [donorType, setDonorType] = useState<DonorType>(saved.donorType);
    const [form, setForm] = useState<Form>(saved.form);
    const [restored, setRestored] = useState(saved.restored);

    // Keep the saved copy current as they type.
    useEffect(() => { writeSaved(form, donorType); }, [form, donorType]);

    const forgetMe = () => {
        try { localStorage.removeItem(SAVED_KEY); } catch { /* storage unavailable */ }
        setForm(EMPTY);
        setDonorType('individual');
        setRestored(false);
    };
    const [errors, setErrors] = useState<Errors>({});
    const [busy, setBusy] = useState(false);

    const amount = useMemo(() => (custom ? Number(custom) : Number(preset || 0)), [custom, preset]);

    const set = (id: keyof Form, v: string) => {
        setForm((f) => ({ ...f, [id]: id === 'pan' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : v }));
        setErrors((e) => (e[id] ? { ...e, [id]: undefined } : e));
    };

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        const found = validate(form, amount);
        setErrors(found);
        if (Object.values(found).some(Boolean)) {
            toast.error('Please check the highlighted fields.');
            return;
        }
        setBusy(true);
        try {
            const res = await createDonation({
                amount,
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.replace(/\D/g, '').slice(-10),
                pan: form.pan.trim() || undefined,
                donorType,
                address: {
                    line1: form.line1.trim(),
                    city: form.city.trim(),
                    district: form.district.trim(),
                    state: form.state.trim(),
                    pincode: form.pincode.trim(),
                },
                message: form.message.trim() || undefined,
            });
            if (res?.paymentUrl) {
                window.location.assign(res.paymentUrl);
                return;
            }
            if (res?.mock && res?.orderId) {
                await mockCompleteDonation(res.orderId);
                navigate(`/donate/thank-you?orderId=${encodeURIComponent(res.orderId)}`);
                return;
            }
            toast.error('The payment could not be started. Please try again.');
        } catch (err) {
            toast.error(errorMessage(err, 'The donation could not be started. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-[#f3f6fb] font-sans">
            <HeaderSection />

            <main className="flex-1">
                {/* ------------------------------------------------ hero */}
                <section className="relative overflow-hidden bg-gradient-to-br from-[#0e1f4d] via-[#1c2e68] to-[#2563eb] text-white">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
                    <div className="relative mx-auto w-full max-w-[120rem] px-4 pb-24 pt-10 sm:px-6 sm:pb-28 sm:pt-14 lg:px-12">
                        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[0.875rem] font-semibold uppercase tracking-[0.12em] text-amber-200 ring-1 ring-white/15">
                            <HeartHandshake className="h-4 w-4" /> Support ACTIV
                        </p>
                        <h1 className="mt-4 max-w-4xl text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-[3rem] xl:text-[3.5rem]">
                            Support ACTIV — with an 80G tax benefit
                        </h1>
                        <p className="mt-4 max-w-3xl text-[1.125rem] leading-relaxed text-blue-100 sm:text-ui-body">
                            Your gift helps SC/ST entrepreneurs start, grow and be heard. You get an 80G receipt for
                            every donation, and a consolidated certificate for the whole financial year.
                        </p>
                    </div>
                </section>

                {/* ------------------------------------------------ form + promises */}
                <section className="relative mx-auto -mt-16 grid w-full max-w-[120rem] grid-cols-1 gap-5 px-4 pb-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-7 lg:px-12 xl:grid-cols-[minmax(0,1fr)_30rem]">
                    <form
                        onSubmit={submit}
                        noValidate
                        className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-20px_rgba(14,31,77,0.35)] sm:p-7"
                    >
                        <div className="space-y-6">
                            <AmountPicker
                                preset={custom ? null : preset}
                                custom={custom}
                                onPreset={(n) => { setPreset(n); setCustom(''); setErrors((e) => ({ ...e, amount: undefined })); }}
                                onCustom={(v) => { setCustom(v); setErrors((e) => ({ ...e, amount: undefined })); }}
                                error={errors.amount}
                            />

                            {restored ? (
                                <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50 px-4 py-3 text-[0.9375rem] text-blue-900 ring-1 ring-blue-100">
                                    <span className="min-w-0">
                                        Welcome back{form.fullName ? <>, <strong className="break-words">{form.fullName}</strong></> : null} — your details are filled in from last time.
                                    </span>
                                    <button type="button" onClick={forgetMe} className="min-h-10 font-semibold text-blue-700 underline-offset-2 hover:underline">
                                        Not you? Clear my details
                                    </button>
                                </p>
                            ) : null}

                            <DonorTypeChoice value={donorType} onChange={setDonorType} />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="sm:col-span-2 xl:col-span-3">
                                    <TextField id="fullName" label={donorType === 'organisation' ? 'Organisation name' : 'Full name'}
                                        value={form.fullName} onChange={set} error={errors.fullName} autoComplete="name"
                                        hint="Printed on your receipt and certificate exactly as typed." />
                                </div>
                                <TextField id="email" label="Email" value={form.email} onChange={set} error={errors.email}
                                    type="email" inputMode="email" autoComplete="email" autoCapitalize="none" />
                                <TextField id="phone" label="Mobile number" value={form.phone} onChange={set} error={errors.phone}
                                    type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={14} />
                                <div className="sm:col-span-2 xl:col-span-1">
                                    <TextField id="pan" label="PAN" optional value={form.pan} onChange={set} error={errors.pan}
                                        autoCapitalize="characters" placeholder="ABCDE1234F"
                                        hint="Needed to claim the 80G deduction." />
                                </div>
                            </div>

                            <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <legend className="mb-3 text-[1.125rem] font-bold text-slate-900">Address</legend>
                                <div className="sm:col-span-2 xl:col-span-4">
                                    <TextField id="line1" label="Address line" value={form.line1} onChange={set} error={errors.line1}
                                        autoComplete="street-address" placeholder="Door no., street, area" />
                                </div>
                                <TextField id="city" label="City / town" value={form.city} onChange={set} error={errors.city} autoComplete="address-level2" />
                                <TextField id="district" label="District" optional value={form.district} onChange={set} />
                                <TextField id="state" label="State" value={form.state} onChange={set} error={errors.state} autoComplete="address-level1" />
                                <TextField id="pincode" label="PIN code" value={form.pincode} onChange={set} error={errors.pincode}
                                    inputMode="numeric" maxLength={6} autoComplete="postal-code" />
                            </fieldset>

                            <div>
                                <label htmlFor="d-message" className={LABEL}>
                                    Message<span className="ml-1.5 font-normal text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    id="d-message"
                                    rows={3}
                                    maxLength={500}
                                    value={form.message}
                                    onChange={(e) => set('message', e.target.value)}
                                    placeholder="A note to the association, or what you would like your gift to support"
                                    className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-ui-caption text-slate-900
                                               placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={busy}
                                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500
                                           text-[1.125rem] font-bold text-white shadow-[0_14px_30px_-14px_rgb(217_119_6/0.9)] transition
                                           hover:from-amber-700 hover:to-amber-600 disabled:opacity-60"
                            >
                                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <HeartHandshake className="h-5 w-5" />}
                                {busy ? 'Starting secure payment…' : `Donate ${amount >= MIN ? inr(amount) : ''}`.trim()}
                            </button>
                            <p className="flex items-center justify-center gap-2 text-center text-[0.9375rem] text-slate-500">
                                <ShieldCheck className="h-4 w-4 shrink-0" /> Paid securely through our payment gateway.
                            </p>
                        </div>
                    </form>

                    <aside className="min-w-0 space-y-4 lg:pt-0">
                        <div className="rounded-2xl bg-gradient-to-br from-[#0e1f4d] to-[#1c2e68] p-5 shadow-lg sm:p-6">
                            <h2 className="text-ui-body font-bold text-white">What you receive</h2>
                            <ul className="mt-4 space-y-4">
                                <Promise_ icon={FileCheck2} title="A receipt for every gift"
                                    body="An 80G receipt by email the moment each payment goes through." />
                                <Promise_ icon={CalendarRange} title="One certificate for the year"
                                    body="All your gifts from April to March, added up into one consolidated 80G certificate." />
                                <Promise_ icon={ShieldCheck} title="Registered under 80G"
                                    body="ACTIV's PAN and 80G registration are printed on every document." />
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-[0.9375rem] leading-relaxed text-slate-600">
                            <p className="flex items-start gap-2">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                Give again any time with the same email — every gift is added to your year's certificate.
                            </p>
                        </div>
                    </aside>
                </section>
            </main>

            <FooterSection />
        </div>
    );
}
