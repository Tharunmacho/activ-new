import React from 'react';
import SuperApprovalsScreen from '../../screens/admin/super/SuperApprovalsScreen';
import SuperMembersScreen from '../../screens/admin/super/SuperMembersScreen';
import SuperEventAttendanceScreen from '../../screens/admin/super/SuperEventAttendanceScreen';
import SuperEventEditorScreen from '../../screens/admin/super/SuperEventEditorScreen';
import SuperEventQrScreen from '../../screens/admin/super/SuperEventQrScreen';
import SuperEventCategoriesScreen from '../../screens/admin/super/SuperEventCategoriesScreen';
import SuperBookingsScreen from '../../screens/admin/super/SuperBookingsScreen';
import SuperEventBookingsScreen from '../../screens/admin/super/SuperEventBookingsScreen';
import SuperBookingPeopleScreen from '../../screens/admin/super/SuperBookingPeopleScreen';
import SuperBookingDetailScreen from '../../screens/admin/super/SuperBookingDetailScreen';
import SuperBookingMessagesScreen from '../../screens/admin/super/SuperBookingMessagesScreen';
import SuperDonorsScreen from '../../screens/admin/super/SuperDonorsScreen';
import SuperDonorDetailScreen from '../../screens/admin/super/SuperDonorDetailScreen';
import SuperMembershipScreen from '../../screens/admin/super/SuperMembershipScreen';
import SuperMembershipRegistrationsScreen from '../../screens/admin/super/SuperMembershipRegistrationsScreen';
import SuperMembershipIdsScreen from '../../screens/admin/super/SuperMembershipIdsScreen';
import SuperOfficeAccountScreen from '../../screens/admin/super/SuperOfficeAccountScreen';
import SuperPlanEditorScreen from '../../screens/admin/super/SuperPlanEditorScreen';
import SuperPlatinumGrantScreen from '../../screens/admin/super/SuperPlatinumGrantScreen';
import SuperPlatinumRequestScreen from '../../screens/admin/super/SuperPlatinumRequestScreen';
import SuperUpdatesScreen from '../../screens/admin/super/SuperUpdatesScreen';
import SuperUpdateEditorScreen from '../../screens/admin/super/SuperUpdateEditorScreen';
import SuperNotificationsScreen from '../../screens/admin/super/SuperNotificationsScreen';

/**
 * The Super Admin area's stack screens (reached from the "More" tab,
 * SuperMenuScreen, and the "Events" tab). Registered once in App.tsx — add
 * screens here only; their params live in types/routes/super.ts.
 *
 * FULL PARITY WITH THE WEBSITE SUPER ADMIN (decided 2026-09-30), except the
 * CMS content pages: approvals and members; events (editor, QR, categories);
 * bookings and revenue (overview, per-event bookings, people, booking detail
 * with record payment / cancel, CSV, and each booking's message delivery);
 * donations and donors; membership plans and Platinum; member updates; and
 * notifications (Automation delivery log, the raw log, configuration, routing).
 *
 * SuperEventAttendance is read-only: its per-event list opens the events
 * admin's `EventAttendance` screen (routes/eventsAdminRoutes.tsx) with
 * `readOnly: true`. The events_admin role never reaches any of the money
 * screens here — its console is EventsAdminBottomTabs, and the server's
 * BOOKING_VIEWERS is super_admin only.
 */
const NO_HEADER = { headerShown: false };

export const superScreens = (Stack: any) => (
  <>
    <Stack.Screen name="SuperApprovals" component={SuperApprovalsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperMembers" component={SuperMembersScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperEventAttendance" component={SuperEventAttendanceScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperEventEditor" component={SuperEventEditorScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperEventQr" component={SuperEventQrScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperEventCategories" component={SuperEventCategoriesScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperBookings" component={SuperBookingsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperEventBookings" component={SuperEventBookingsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperBookingPeople" component={SuperBookingPeopleScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperBookingDetail" component={SuperBookingDetailScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperBookingMessages" component={SuperBookingMessagesScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperDonors" component={SuperDonorsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperDonorDetail" component={SuperDonorDetailScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperMembership" component={SuperMembershipScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperMembershipRegistrations" component={SuperMembershipRegistrationsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperMembershipIds" component={SuperMembershipIdsScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperOfficeAccount" component={SuperOfficeAccountScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperPlanEditor" component={SuperPlanEditorScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperPlatinumGrant" component={SuperPlatinumGrantScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperPlatinumRequest" component={SuperPlatinumRequestScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperUpdates" component={SuperUpdatesScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperUpdateEditor" component={SuperUpdateEditorScreen} options={NO_HEADER} />
    <Stack.Screen name="SuperNotifications" component={SuperNotificationsScreen} options={NO_HEADER} />
  </>
);
