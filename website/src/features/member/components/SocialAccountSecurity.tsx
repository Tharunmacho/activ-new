import { Link } from 'react-router-dom';
import { accountPasswordStatus, linkedProviderNames } from '@/lib/authCapabilities';

export default function SocialAccountSecurity({ account, onUsePassword }: { account: any; onUsePassword?: () => void }) {
  const providers = linkedProviderNames(account).join(', ') || 'your linked provider';
  const unset = accountPasswordStatus(account) === 'not_set';
  return <div className="space-y-3 text-[1.125rem] leading-relaxed text-slate-700">
    <p>You sign in with <strong>{providers}</strong>. No ACTIV password is needed to continue using that sign-in option.</p>
    <p>{unset ? 'This account does not have an ACTIV password.' : 'If you want to use email and password, you can set or reset your ACTIV password securely by email.'}</p>
    <Link to="/forgot-password" className="inline-flex min-h-[44px] items-center rounded-xl border border-blue-200 px-4 py-2 font-semibold text-blue-700">{unset ? 'Set an ACTIV password (optional)' : 'Set or reset an ACTIV password (optional)'}</Link>
    {onUsePassword && <button type="button" onClick={onUsePassword} className="block min-h-[44px] text-left font-semibold text-blue-700">I know my ACTIV password</button>}
  </div>;
}
