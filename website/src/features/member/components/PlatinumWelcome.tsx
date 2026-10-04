import { type PointerEvent } from 'react';
import { ArrowUpRight, BadgeCheck, Briefcase, Crown, FileText, Infinity, MapPin, ReceiptText } from 'lucide-react';
import './platinum-dashboard.css';

type Props = {
    name: string; greeting: string; memberId: string; memberSince: string; region: string; active: boolean;
    onPlan: () => void; onBusiness: () => void; onDocuments: () => void; onReceipt: () => void;
};
const resetTilt = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
    event.currentTarget.style.setProperty('--light-x', '50%');
};
const tiltCard = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    event.currentTarget.style.setProperty('--tilt-x', `${(0.5 - y) * 7}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(x - 0.5) * 9}deg`);
    event.currentTarget.style.setProperty('--light-x', `${x * 100}%`);
};

export default function PlatinumWelcome({ name, greeting, memberId, memberSince, region, active, onPlan, onBusiness, onDocuments, onReceipt }: Props) {
    const actions = [
        { label: 'Business account', detail: 'Your business, beautifully connected.', Icon: Briefcase, onClick: onBusiness },
        { label: 'Your documents', detail: 'Certificates and membership records.', Icon: FileText, onClick: onDocuments },
        { label: 'Payment receipt', detail: 'Your contribution, on record.', Icon: ReceiptText, onClick: onReceipt },
    ];
    return <section aria-label="Platinum membership dashboard" className="platinum-welcome">
        <div className="platinum-welcome__main">
            <div className="platinum-welcome__intro">
                <span className="platinum-overline"><span className="platinum-overline__mark"><Crown size={15} /></span> THE PLATINUM MEMBERSHIP</span>
                <p className="platinum-greeting">{greeting},</p>
                <h2 className="platinum-name">{name}</h2>
                <p className="platinum-welcome__copy">A lifetime of connection. <br />A world of possibility.</p>
                <div className="platinum-welcome__meta"><span><Infinity size={16} /> Lifetime membership</span>{region && <span><MapPin size={15} /><span>{region}</span></span>}</div>
                <button className="platinum-text-link" onClick={onPlan}>Explore your membership <ArrowUpRight size={17} /></button>
            </div>
            <div className="platinum-card-stage">
                <div className="platinum-card-stage__halo" aria-hidden="true" />
                <button type="button" className="platinum-metal-card" onClick={onPlan} onPointerMove={tiltCard} onPointerLeave={resetTilt} onPointerCancel={resetTilt} aria-label={`View Platinum membership details for ${name}. Member ID ${memberId || 'not assigned'}. ${active ? 'Active' : 'Pending'}. Lifetime membership.`}>
                    <span className="platinum-card__grain" aria-hidden="true" />
                    <span className="platinum-card__contours" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} style={{ inset: `${i * 11}px` }} />)}</span>
                    <span className="platinum-card__top"><span className="platinum-wordmark">ACTIV<span>MEMBERSHIP</span></span><span className="platinum-card__seal"><Crown size={21} strokeWidth={1.4} /></span></span>
                    <span className="platinum-card__tier">Platinum<span>LIFETIME EDITION</span></span>
                    <span className="platinum-card__identity"><span className="platinum-card__label">MEMBER ID</span><span className="platinum-card__id">{memberId || 'Awaiting assignment'}</span></span>
                    <span className="platinum-card__bottom"><span className="platinum-card__holder">{name}<span>{memberSince ? `Member since ${memberSince}` : 'Lifetime member'}</span></span><span className={`platinum-card__status ${active ? 'is-active' : ''}`}><BadgeCheck size={13} />{active ? 'Active' : 'Pending'}</span></span>
                </button>
                <p className="platinum-card-caption"><span /> Your membership. For a lifetime. <ArrowUpRight size={13} /></p>
            </div>
        </div>
        <div className="platinum-workspace"><div className="platinum-workspace__heading"><span>YOUR MEMBER SPACE</span><span>Everything that matters, within reach.</span></div>
            <div className="platinum-actions">{actions.map(({ label, detail, Icon, onClick }, i) => <button type="button" key={label} onClick={onClick} className="platinum-action"><span className="platinum-action__top"><span className="platinum-action__icon"><Icon size={21} strokeWidth={1.5} /></span><span className="platinum-action__index">0{i + 1}</span></span><span className="platinum-action__label">{label}<ArrowUpRight size={18} /></span><span className="platinum-action__detail">{detail}</span></button>)}</div>
        </div>
    </section>;
}
