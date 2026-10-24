export type UpdateAudience = 'all' | 'paid' | 'paid_non_student' | 'unpaid' | 'business' | 'aspirant' | 'student' | 'lifetime' | 'plans';
export const UPDATE_AUDIENCES: { value: UpdateAudience; title: string; detail: string; icon: string }[] = [
  { value: 'all', title: 'All members', detail: 'Every member, including paid and unpaid accounts.', icon: 'groups' },
  { value: 'paid', title: 'Paid members', detail: 'All active memberships, including students and lifetime members.', icon: 'verified' },
  { value: 'paid_non_student', title: 'Paid members excluding students', detail: 'Active paid memberships except Student plans.', icon: 'business-center' },
  { value: 'unpaid', title: 'Unpaid members', detail: 'Members without an active membership, including expired memberships.', icon: 'schedule' },
  { value: 'business', title: 'Business members', detail: 'Active memberships under a Business plan.', icon: 'business' },
  { value: 'aspirant', title: 'Aspirant members', detail: 'Active memberships under an Aspirant plan.', icon: 'trending-up' },
  { value: 'student', title: 'Student members', detail: 'Active Student memberships only. Other members cannot see this update.', icon: 'school' },
  { value: 'lifetime', title: 'Lifetime members', detail: 'Active lifetime memberships only.', icon: 'workspace-premium' },
  { value: 'plans', title: 'Specific membership plans', detail: 'Choose one or more plans. Only active holders of those plans can see this update.', icon: 'checklist' },
];
export const updateAudienceLabel = (value: string) => UPDATE_AUDIENCES.find(a => a.value === value)?.title || 'All members';
export const isStudentMembership = (profile: any) => profile?.capabilities?.isStudent ?? (
  profile?.membershipType !== 'lifetime' && profile?.membershipTier !== 'platinum'
  && String(profile?.paidMembership?.kind || profile?.memberType || profile?.registrationType || '').toLowerCase() === 'student');
export const STUDENT_UPGRADE_MESSAGE = 'Dear member, your Student membership includes events and learning opportunities. Please upgrade your membership to connect and chat with business members.';
