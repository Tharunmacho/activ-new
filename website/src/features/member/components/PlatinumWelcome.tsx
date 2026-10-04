import { ArrowUpRight, BadgeCheck, Briefcase, Crown, FileText, MapPin, ReceiptText } from 'lucide-react';
import { MemberAvatar } from '@/features/member/memberPhoto';

type Props = {
    name: string; greeting: string; memberId: string; memberSince: string; region: string; active: boolean;
    onPlan: () => void; onBusiness: () => void; onDocuments: () => void; onReceipt: () => void;
};

/** A compact lifetime membership credential, with the member's real account links. */
export default function PlatinumWelcome({ name, greeting, memberId, memberSince, region, active, onPlan, onBusiness, onDocuments, onReceipt }: Props) {
    const actions = [
        { label: 'Business account', Icon: Briefcase, onClick: onBusiness },
        { label: 'Certificates & documents', Icon: FileText, onClick: onDocuments },
        { label: 'Payment receipt', Icon: ReceiptText, onClick: onReceipt },
    ];
    return <section aria-label="Platinum membership dashboard" className="relative overflow-hidden rounded-3xl border border-[#c3ad73]/40 bg-[#111d33] text-white shadow-lg">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full border-[60px] border-[#d6c190]/10" />
        <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:items-center">
            <div className="min-w-0">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#d6c190]/40 bg-[#d6c190]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#ead6a5]"><Crown size={16} /> ACTIV Platinum</div>
                <div className="flex items-center gap-4">
                    <MemberAvatar name={name} className="h-14 w-14 shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/25" initialsClassName="text-xl font-semibold text-[#ead6a5]" />
                    <div className="min-w-0"><p className="text-sm text-slate-300">{greeting},</p><h2 className="mt-1 break-words text-2xl font-semibold leading-tight sm:text-3xl">{name}</h2></div>
                </div>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-300">Your lifetime membership, business connections and member documents, together in one place.</p>
                {region && <p className="mt-4 flex items-start gap-2 text-sm text-slate-300"><MapPin size={16} className="mt-0.5 shrink-0 text-[#ead6a5]" /><span className="break-words">{region}</span></p>}
            </div>
            <div className="min-w-0 rounded-2xl border border-[#c3ad73]/30 bg-[#faf8f2] p-5 text-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-semibold"><Crown size={20} className="text-[#8b6f30]" />Platinum Lifetime</div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><BadgeCheck size={13} />{active ? 'Active' : 'Pending'}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[#c3ad73]/25 pt-4">
                    <div className="col-span-2 min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member ID</dt><dd className="mt-1 break-words text-lg font-semibold">{memberId || '—'}</dd></div>
                    <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</dt><dd className="mt-1 text-sm font-semibold">{memberSince || '—'}</dd></div>
                    <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Validity</dt><dd className="mt-1 text-sm font-semibold">Lifetime</dd></div>
                </dl>
                <button onClick={onPlan} className="mt-4 inline-flex w-full items-center justify-between gap-3 rounded-xl bg-[#17253e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243856]">View membership details<ArrowUpRight size={17} /></button>
            </div>
        </div>
        <div className="relative grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">{actions.map(({ label, Icon, onClick }) => <button key={label} onClick={onClick} className="flex min-w-0 items-center gap-3 bg-[#111d33] px-5 py-4 text-left text-sm font-medium hover:bg-[#1c2c47]"><Icon size={18} className="shrink-0 text-[#ead6a5]" /><span className="flex-1">{label}</span><ArrowUpRight size={16} className="shrink-0 text-slate-400" /></button>)}</div>
    </section>;
}
