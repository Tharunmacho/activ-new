/** Keep new website Super Admin pages from being missed by the mobile app. */
export {};
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const workspaceFile = (name: string): string => fs.readFileSync(path.resolve(__dirname, '../..', name), 'utf8');

const counterparts: Record<string, string> = {
  '/super-admin/dashboard': 'Hub',
  '/super-admin/approvals': 'SuperApprovals',
  '/super-admin/applications': 'SuperApprovals',
  '/super-admin/members': 'SuperMembers',
  '/super-admin/settings': 'Settings',
  '/super-admin/admins': 'Admins',
  '/super-admin/events': 'Events',
  '/super-admin/events/categories': 'SuperEventCategories',
  '/super-admin/bookings': 'SuperBookings',
  '/super-admin/bookings/:eventId': 'SuperEventBookings',
  '/super-admin/attendance': 'SuperEventAttendance',
  '/super-admin/attendance/:eventId': 'EventAttendance',
  '/super-admin/membership': 'SuperMembership',
  '/super-admin/membership-registrations': 'SuperMembershipRegistrations',
  '/super-admin/membership-ids': 'SuperMembershipIds',
  '/super-admin/donations': 'SuperDonors',
  '/super-admin/donations/:id': 'SuperDonorDetail',
  '/super-admin/updates': 'SuperUpdates',
  '/super-admin/notifications': 'SuperNotifications',
};

test('every website Super Admin page has a registered native counterpart', () => {
  const website = workspaceFile('website/src/App.tsx');
  const paths = [...website.matchAll(/<Route\s+path="(\/super-admin\/[^"\s]+)"/g)].map(match => match[1]);
  expect(paths.sort()).toEqual(Object.keys(counterparts).sort());
  const mobile = ['frontend/src/navigation/routes/superRoutes.tsx', 'frontend/src/navigation/routes/eventsAdminRoutes.tsx', 'frontend/src/navigation/SuperAdminBottomTabs.tsx'].map(workspaceFile).join('\n');
  const screens = [...mobile.matchAll(/<(?:Stack|Tab)\.Screen\s+name="([^"]+)"\s+component=\{/g)].map(match => match[1]);
  for (const destination of Object.values(counterparts)) expect(screens).toContain(destination);
});
