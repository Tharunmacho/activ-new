import { ArrowRight, BadgeCheck, CalendarDays, Crown, ShieldCheck, Sparkles } from 'lucide-react';
import './dashboardMembership.css';

type Props = {
    name: string; plan: string; memberId: string; since: string; validUntil: string;
    active: boolean; status: string; lifetime: boolean; membershipLabel?: string;
    details: { label: string; value: string }[];
    onPlan: () => void; onUpgrade: () => void;
};

export default function DashboardMembership(props: Props) {
    return <section className="dashboard-membership" aria-label="Your membership">
        <div className="dashboard-membership__heading"><ShieldCheck size={22} /><div><h2>Your membership</h2><p>Your card, details and next steps, together.</p></div></div>
        <div className="dashboard-membership__grid">
            <div className="dashboard-membership__identity">
                <div className={`dashboard-member-card ${props.lifetime ? 'is-lifetime' : ''}`}>
                    <div className="dashboard-member-card__top"><img src="/logo_ACTIVian-removebg-preview.png" alt="ACTIV" /><span className={props.active ? 'is-active' : ''}><BadgeCheck size={15} />{props.status}</span></div>
                    <p className="dashboard-member-card__name">{props.name}</p>
                    <p className="dashboard-member-card__plan">{props.lifetime && <Crown size={16} />}{props.plan}<span>{props.lifetime ? 'Lifetime membership' : props.membershipLabel || 'Membership'}</span></p>
                    <div className="dashboard-member-card__id"><span>MEMBER ID</span><strong>{props.memberId || 'Awaiting assignment'}</strong></div>
                    <div className="dashboard-member-card__dates"><div><span>MEMBER SINCE</span><strong>{props.since || '—'}</strong></div><div><span>{props.lifetime ? 'VALIDITY' : 'VALID UNTIL'}</span><strong>{props.lifetime ? 'Lifetime' : props.validUntil || '—'}</strong></div></div>
                </div>
                <dl className="dashboard-membership__facts">{props.details.filter(item => item.value).map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
                <button type="button" className="dashboard-membership__details" onClick={props.onPlan}>View plan details <ArrowRight size={17} /></button>
            </div>
            <div className="dashboard-membership__next">
                <div className="dashboard-membership__icon">{props.lifetime ? <Crown size={25} /> : <Sparkles size={25} />}</div>
                <span className="dashboard-membership__eyebrow">GROW WITH ACTIV</span>
                <h3>{props.lifetime ? 'Connected for a lifetime' : 'Your next chapter starts here'}</h3>
                <p>{props.lifetime ? 'Your lifetime membership brings your community, opportunities and membership records together. No annual renewal is needed.' : 'Starting a business or ready for your next membership stage? Review the options available to your profile.'}</p>
                <div className="dashboard-membership__assurance"><ShieldCheck size={18} /><span>Your account and membership history stay together.</span></div>
                <div className="dashboard-membership__assurance"><CalendarDays size={18} /><span>{props.lifetime ? 'Lifetime access, with no renewal date.' : 'Your business plan grows with your business experience.'}</span></div>
                <button type="button" onClick={props.lifetime ? props.onPlan : props.onUpgrade}>{props.lifetime ? 'Explore your plan' : 'Review membership upgrade'}<ArrowRight size={18} /></button>
            </div>
        </div>
    </section>;
}
