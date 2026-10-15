export type UpdateAudience = 'all' | 'paid' | 'unpaid' | 'student' | 'lifetime';
export const UPDATE_AUDIENCES: { value: UpdateAudience; title: string; detail: string; icon: string }[] = [
  { value: 'all', title: 'All members', detail: 'Every member, including paid and unpaid accounts.', icon: 'groups' },
  { value: 'paid', title: 'Paid members', detail: 'All active memberships, including students and lifetime members.', icon: 'verified' },
  { value: 'unpaid', title: 'Unpaid members', detail: 'Members without an active membership, including expired memberships.', icon: 'schedule' },
  { value: 'student', title: 'Student members', detail: 'Student memberships only. Other members cannot see this update.', icon: 'school' },
  { value: 'lifetime', title: 'Lifetime members', detail: 'Active lifetime memberships only.', icon: 'workspace-premium' },
];
export const updateAudienceLabel = (value: string) => UPDATE_AUDIENCES.find(a => a.value === value)?.title || 'All members';
export const isStudentMembership = (profile: any) => profile?.capabilities?.isStudent ?? (
  profile?.membershipType !== 'lifetime' && profile?.membershipTier !== 'platinum'
  && String(profile?.paidMembership?.kind || profile?.memberType || profile?.registrationType || '').toLowerCase() === 'student');
export const STUDENT_UPGRADE_MESSAGE = 'Dear member, your Student membership includes events and learning opportunities. Please upgrade your membership to connect and chat with business members.';
