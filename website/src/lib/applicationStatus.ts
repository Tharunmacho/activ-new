export type ApplicationStatus = 'Pending' | 'Approved' | 'Rejected';
export type ApplicationSubmissionMode = 'save' | 'update' | 'resubmit' | 'submit';

export const normaliseApplicationStatus = (value: unknown): ApplicationStatus => {
  const key = String(value || '').trim().toLowerCase().replace(/[\s_\-.]/g, '');
  if (key === 'rejected' || key === 'declined') return 'Rejected';
  if (['approved', 'stateapproved', 'complete', 'completed'].includes(key)) return 'Approved';
  return 'Pending';
};

/** Match the API's current file: existing approval, otherwise latest pending/rejection. */
export const pickCurrentApplication = (list: any[]): any | null => {
  if (!Array.isArray(list)) return null;
  const rank = { Approved: 3, Pending: 2, Rejected: 1 };
  const date = (row: any) => new Date(row?.createdAt || 0).getTime() || 0;
  return list.filter(Boolean).reduce((current, row) => {
    if (!current) return row;
    const status = normaliseApplicationStatus(row.status);
    const difference = rank[status] - rank[normaliseApplicationStatus(current.status)];
    if (difference) return difference > 0 ? row : current;
    const order = date(row) - date(current)
      || String(row._id || row.id || '').localeCompare(String(current._id || current.id || ''));
    return (status === 'Approved' ? order < 0 : order > 0) ? row : current;
  }, null);
};

export const applicationSubmissionMode = (profile: any, application: any): ApplicationSubmissionMode => {
  const paid = ['active', 'completed'].includes(String(profile?.membershipStatus || '').trim().toLowerCase());
  if (paid || application && normaliseApplicationStatus(application.status) === 'Approved') return 'save';
  if (!application) return 'submit';
  return normaliseApplicationStatus(application.status) === 'Rejected' ? 'resubmit' : 'update';
};

export const applicationSubmissionLabel = (mode: ApplicationSubmissionMode): string => ({
  save: 'Save changes', update: 'Update application', resubmit: 'Resubmit application', submit: 'Submit Application',
}[mode]);
