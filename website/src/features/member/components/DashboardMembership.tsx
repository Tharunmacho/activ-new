import { ArrowRight, BadgeCheck, CalendarDays, Crown, ShieldCheck, Sparkles, User } from 'lucide-react';
import cardBackdrop from '@/assets/membership-card-bg.svg';
import './dashboardMembership.css';

type Props = {
    name: string; plan: string; memberId: string; since: string; validUntil: string;
    active: boolean; status: string; lifetime: boolean; membershipLabel?: string;
    details: { label: string; value: string }[];
    onPlan: () => void;
};

export default function DashboardMembership(props: Props) {
    return <article className={`dashboard-membership__identity ${props.lifetime ? 'is-lifetime' : ''}`} aria-label={`${props.name}'s membership card`}>
        <img className="dashboard-member-card__backdrop" src={cardBackdrop} alt="" aria-hidden="true" />
        <div className="dashboard-member-card">
            <div className="dashboard-member-card__top">
                <div className="dashboard-member-card__plan">
                    <span className="dashboard-member-card__icon">{props.lifetime ? <Crown size={23} /> : <User size={23} />}</span>
                    <div><h3>{props.plan}</h3><p>{props.lifetime ? 'Lifetime · never renews' : props.membershipLabel || 'Membership'}</p></div>
                </div>
                <span className={`dashboard-member-card__status ${props.active ? 'is-active' : ''}`}><BadgeCheck size={15} />{props.status}</span>
            </div>
            <div className="dashboard-member-card__id"><span>MEMBER ID</span><strong>{props.memberId || 'Awaiting assignment'}</strong></div>
            <div className="dashboard-member-card__dates"><div><span>MEMBER SINCE</span><strong>{props.since || '—'}</strong></div><div><span>{props.lifetime ? 'VALIDITY' : 'VALID UNTIL'}</span><strong>{props.lifetime ? 'Lifetime' : props.validUntil || '—'}</strong></div></div>
        </div>
        <dl className="dashboard-membership__facts">{props.details.filter(item => item.value).map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        <button type="button" className="dashboard-membership__details" onClick={props.onPlan}>View plan details <ArrowRight size={17} /></button>
    </article>;
}

export function DashboardMembershipReview(props: { lifetime: boolean; onPlan: () => void; onUpgrade: () => void }) {
    return <section className="dashboard-membership__review" aria-label="Review your membership">
        <div className="dashboard-membership__next">
            <div className="dashboard-membership__review-copy">
                <div className="dashboard-membership__icon">{props.lifetime ? <Crown size={25} /> : <Sparkles size={25} />}</div>
                <span className="dashboard-membership__eyebrow">GROW WITH ACTIV</span>
                <h3>{props.lifetime ? 'Connected for a lifetime' : 'Your next chapter starts here'}</h3>
                <p>{props.lifetime ? 'Your lifetime membership brings your community, opportunities and membership records together. No annual renewal is needed.' : 'Starting a business or ready for your next membership stage? Review the options available to your profile.'}</p>
            </div>
            <div className="dashboard-membership__review-actions">
                <div className="dashboard-membership__assurance"><ShieldCheck size={18} /><span>Your account and membership history stay together.</span></div>
                <div className="dashboard-membership__assurance"><CalendarDays size={18} /><span>{props.lifetime ? 'Lifetime access, with no renewal date.' : 'Your business plan grows with your business experience.'}</span></div>
                <button type="button" onClick={props.lifetime ? props.onPlan : props.onUpgrade}>{props.lifetime ? 'Explore your plan' : 'Review membership upgrade'}<ArrowRight size={18} /></button>
            </div>
        </div>
    </section>;
}
