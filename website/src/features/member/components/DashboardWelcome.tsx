import { type ReactNode, useId } from 'react';
import { BadgeCheck, CalendarDays, Crown, FileText, MapPin, Sun } from 'lucide-react';
import greetingBubbles from '@/assets/greeting-bubbles.svg';
import './dashboardWelcome.css';

type Props = {
    name: string; greeting: string; date: string; day: string; plan: string;
    applicationRef?: string; memberSince?: string; region?: string; lifetime: boolean;
    avatar: ReactNode;
};

export default function DashboardWelcome(props: Props) {
    const sunId = useId();
    return <section className={`dashboard-welcome ${props.lifetime ? 'is-lifetime' : ''}`} aria-label="Member welcome">
        <div className="dashboard-welcome__art" aria-hidden="true">
            <svg viewBox="0 0 1200 380" preserveAspectRatio="none">
                <defs><radialGradient id={sunId} cx="1" cy="0" r="0.75">
                    <stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".3" stopColor="#fde68a" stopOpacity=".18" />
                    <stop offset=".65" stopColor="#7dd3fc" stopOpacity=".12" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
                </radialGradient></defs>
                <rect width="1200" height="380" fill={`url(#${sunId})`} />
                <g fill="none" stroke="#fff">{[150, 240, 350, 480].map((radius, i) => <circle key={radius} cx="1200" cy="0" r={radius} strokeWidth="1.5" opacity={.2 - i * .04} />)}
                    {[130, 225, 340, 470].map((radius, i) => <circle key={radius} cx="0" cy="380" r={radius} strokeWidth="1.5" opacity={.12 - i * .025} />)}</g>
            </svg>
            <img src={greetingBubbles} alt="" />
        </div>
        <div className="dashboard-welcome__content">
            <div className="dashboard-welcome__date"><Sun size={18} /><span>{props.date}</span><span>· {props.day}</span></div>
            <div className="dashboard-welcome__intro">
                {props.avatar}
                <div className="dashboard-welcome__words"><p className="dashboard-welcome__greeting">{props.greeting},</p>
                    <h2>{props.name} <span aria-hidden="true">👋</span></h2>
                    <p className="dashboard-welcome__message">Your journey with ACTIV is making a difference.<br />Together we build a stronger community.</p>
                </div>
            </div>
            <div className="dashboard-welcome__facts">
                <span>{props.lifetime ? <Crown size={16} /> : <BadgeCheck size={16} />}{props.plan}</span>
                {props.applicationRef && <span><FileText size={16} />{props.applicationRef}</span>}
                {props.memberSince && <span><CalendarDays size={16} />Member since {props.memberSince}</span>}
                {props.region && <span><MapPin size={16} />{props.region}</span>}
            </div>
        </div>
    </section>;
}
