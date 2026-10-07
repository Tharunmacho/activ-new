import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, UserRound, BadgeCheck, Building2, FileSignature, History } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import { errorMessage } from '@/services/activApi';
import { getPlatinumRequestDetail, type PlatinumRequestDetail } from '@/services/platinumApi';

/**
 * EVERYTHING THE MEMBER FILLED IN — opened from a Platinum request.
 *
 * The request carries only the Platinum form; the office asked to see the
 * whole record before calling: registration, application, business and
 * declaration. Read-only. Loaded when opened, not for every row in the queue.
 */

const day = (v?: string | null) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const words = (v: string) => (v || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className="min-w-0 rounded-xl bg-white p-3 sm:p-4 ring-1 ring-slate-200">
            <h4 className="mb-2 flex items-center gap-2 text-[1.0625rem] font-bold text-slate-900">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-700">{icon}</span>{title}
            </h4>
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">{children}</dl>
        </section>
    );
}

/** One label/value pair; absent values are left out rather than printed as dashes. */
function Row({ label, value, wide = false }: { label: string; value?: ReactNode; wide?: boolean }) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return null;
    return (
        <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
            <dt className="text-[0.875rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="text-[1rem] text-slate-800 [overflow-wrap:anywhere]">{value}</dd>
        </div>
    );
}

export default function PlatinumRequestDetails({ requestId }: { requestId: string }) {
    const [data, setData] = useState<PlatinumRequestDetail | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        getPlatinumRequestDetail(requestId)
            .then((d) => { if (!cancelled) setData(d); })
            .catch((err) => { if (!cancelled) setError(errorMessage(err, 'Could not load the member’s details')); });
        return () => { cancelled = true; };
    }, [requestId]);

    if (error) return <p className="mt-3 rounded-xl bg-rose-50 p-3 text-[1rem] text-rose-700">{error}</p>;
    if (!data) {
        return <p className="mt-3 flex items-center gap-2 text-[1rem] text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading the member’s details…</p>;
    }

    const p = data.personal;
    const ms = data.membership;
    const photo = p.profilePhoto ? resolveMediaUrl(p.profilePhoto) : '';
    const region = p.isInternational
        ? [p.place, p.country].filter(Boolean).join(', ')
        : [p.block, p.district, p.state].filter(Boolean).join(', ');
    const earlier = (data.history || []).filter((h) => h.id !== data.request.id);
    /** Sister concerns and company names are business answers only. */
    const trading = !!data.business?.doingBusiness
        && !['aspirant', 'student'].includes(String(data.business?.registrationType || ms.memberType || '').toLowerCase());

    return (
        <div className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-3 sm:p-4 lg:grid-cols-2">
            <Section icon={<UserRound className="h-4 w-4" />} title="Personal">
                {photo ? (
                    <div className="sm:col-span-2">
                        <img src={photo} alt="" className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200" />
                    </div>
                ) : null}
                <Row label="Full name" value={p.fullName} />
                <Row label="Email" value={p.email ? <a className="text-blue-700 hover:underline" href={`mailto:${p.email}`}>{p.email}</a> : ''} />
                <Row label="Mobile" value={p.phoneNumber ? <a className="text-blue-700 hover:underline" href={`tel:${p.phoneNumber}`}>{p.phoneNumber}</a> : ''} />
                <Row label="WhatsApp" value={p.whatsappNumber} />
                <Row label="Gender" value={words(p.gender)} />
                <Row label="Social category" value={p.socialCategory} />
                <Row label="Religion" value={p.religion} />
                <Row label="Education" value={p.educationalQualification} />
                <Row label={p.isInternational ? 'Place' : 'Block · District · State'} value={region} wide />
                <Row label="City" value={p.city} />
                <Row label="Registered on" value={day(p.registeredOn)} />
            </Section>

            <Section icon={<BadgeCheck className="h-4 w-4" />} title="Membership & application">
                <Row label="Member ID" value={ms.memberNumber} />
                <Row label="Member type" value={words(ms.memberType)} />
                <Row label="Membership" value={`${words(ms.status)}${ms.type && ms.type !== 'none' ? ` · ${words(ms.type)}` : ''}${ms.tier === 'platinum' ? ' · Lifetime' : ''}`} />
                <Row label="Member since" value={day(ms.activatedAt)} />
                <Row label="Valid until" value={ms.tier === 'platinum' || ms.type === 'lifetime' ? 'Lifetime' : day(ms.expiresAt)} />
                <Row label="Last payment" value={ms.lastPaymentAmount ? `₹${Number(ms.lastPaymentAmount).toLocaleString('en-IN')}${ms.lastPaymentDate ? ` · ${day(ms.lastPaymentDate)}` : ''}` : ''} />
                {data.application ? (
                    <>
                        <Row label="Application" value={data.application.reference} />
                        <Row label="Application status" value={data.application.status} />
                        <Row label="Applied as" value={words(data.application.memberType)} />
                        <Row label="Submitted" value={day(data.application.submittedAt)} />
                    </>
                ) : <Row label="Application" value="Not submitted yet" wide />}
            </Section>

            <Section icon={<Building2 className="h-4 w-4" />} title="Business">
                {data.business ? (
                    <>
                        <Row label="Doing business" value={yesNo(data.business.doingBusiness)} />
                        <Row label="Registered as" value={words(data.business.registrationType)} />
                        <Row label="Company" value={data.business.organizationName || data.request.companyName} />
                        <Row label="Constitution" value={data.business.constitutionType} />
                        <Row label="Commencement year" value={data.business.commencementYear} />
                        <Row label="Employees" value={data.business.numberOfEmployees ? String(data.business.numberOfEmployees) : ''} />
                        <Row label="Type of business" value={data.business.businessTypes.join(', ')} wide />
                        <Row label="Activities" value={data.business.businessActivities.join(', ')} wide />
                        <Row label="Other chamber" value={data.business.memberOfOtherChamber ? (data.business.otherChamber || 'Yes') : ''} />
                        <Row label="Government registrations" value={data.business.govtOrganizations.join(', ')} wide />
                    </>
                ) : <Row label="Business details" value="Not filled in yet" wide />}
            </Section>

            <Section icon={<FileSignature className="h-4 w-4" />} title="Declaration">
                {data.declaration ? (
                    <>
                        {/* Business-only: hidden for an aspirant or a student. */}
                        {trading ? <Row label="Sister concerns" value={String(data.declaration.sisterConcerns ?? '')} /> : null}
                        <Row label="Declaration accepted" value={yesNo(data.declaration.agreed)} />
                        {trading ? <Row label="Company names" value={data.declaration.companyNames.join(', ')} wide /> : null}
                    </>
                ) : <Row label="Declaration" value="Not filled in yet" wide />}
            </Section>

            {earlier.length ? (
                <div className="lg:col-span-2">
                    <Section icon={<History className="h-4 w-4" />} title="Earlier Lifetime requests">
                        {earlier.map((h) => (
                            <Row key={h.id} label={day(h.createdAt)} value={`${words(h.status)}${h.notes ? ` — ${h.notes}` : ''}`} wide />
                        ))}
                    </Section>
                </div>
            ) : null}
        </div>
    );
}
