import { useEffect, useState } from 'react';
import { getMyProfile } from '@/services/activApi';
import { SESSION_EVENT } from '@/services/api';
import { isStudentMembership } from '@/lib/memberAudience';
export function useNetworkingAccess() {
  const [student, setStudent] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => { void getMyProfile().then(p => { if (live) setStudent(isStudentMembership(p)); }).catch(() => { if (live) setStudent(false); }); };
    read();
    window.addEventListener('paymentCompleted', read);
    window.addEventListener('profileUpdated', read);
    window.addEventListener(SESSION_EVENT, read);
    return () => { live = false; window.removeEventListener('paymentCompleted', read); window.removeEventListener('profileUpdated', read); window.removeEventListener(SESSION_EVENT, read); };
  }, []);
  return { student, resolved: student !== null };
}
