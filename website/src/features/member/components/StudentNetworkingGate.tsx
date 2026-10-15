import { Link } from 'react-router-dom';
import { STUDENT_UPGRADE_MESSAGE } from '@/lib/memberAudience';
export default function StudentNetworkingGate() {
  return <div className="mx-auto my-6 max-w-xl rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
    <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-700">Your next membership level</p>
    <h2 className="text-2xl font-bold text-slate-900">Upgrade to connect</h2>
    <p className="mt-4 leading-7 text-slate-600">{STUDENT_UPGRADE_MESSAGE}</p>
    <Link to="/payment/membership-plans?upgrade=1" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Explore membership upgrades</Link>
  </div>;
}
