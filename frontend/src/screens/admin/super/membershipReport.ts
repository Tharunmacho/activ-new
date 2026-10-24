/** Membership reports use the same fields and collected-amount rules as the website. */
export function membershipReport(tab: 'members' | 'payments' | 'archived', rows: any[]): string {
  const date = (value: unknown) => {
    if (!value) return '';
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/am|pm/g, value => value.toUpperCase());
  };
  const values = tab === 'members'
    ? [
      ['Name', 'Email', 'Mobile', 'Registered (IST)', 'Application', 'Membership', 'Plan', 'Member number', 'Collected', 'Valid until', 'Confirmation'],
      ...rows.map(r => [r.name, r.email, r.phone, date(r.registeredAt), r.applicationStatus, r.status, r.planName, r.memberNumber, r.collected, r.lifetime ? 'Lifetime' : date(r.expiresAt), r.confirmation]),
    ]
    : [
      ['Name', 'Email', 'Order', 'Payment ID', 'Plan', 'Status', 'Mode', 'Order amount', 'Amount received', 'Date and time (IST)', 'Confirmed by', 'Note'],
      ...rows.map(r => [r.name, r.email, r.orderId, r.paymentId, r.planName, r.status, r.mode, r.amount, r.status === 'paid' ? r.amount : 0, date(r.paidAt || r.createdAt), r.manual?.byName, r.manual?.note]),
    ];
  return values.map(row => row.map((value, column) => {
    let text = String(value ?? '');
    if ((tab === 'members' && column === 2 && text) || /^\s*[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
