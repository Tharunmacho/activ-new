/**
 * Stack routes owned by the SUPER ADMIN area — full parity with the website
 * Super Admin except the CMS content pages (see
 * navigation/routes/superRoutes.tsx). Reached from the "More" menu tab and
 * the "Events" tab.
 */
export type SuperRoutes = {
  SuperApprovals: undefined;
  SuperMembers: undefined;
  SuperMembershipRegistrations: undefined;
  SuperMembershipIds: undefined;
  SuperOfficeAccount: undefined;
  SuperEventAttendance: undefined;
  /** No `event` = a new event. */
  SuperEventEditor: { event?: any } | undefined;
  SuperEventQr: { event: any; justCreated?: boolean };
  SuperEventCategories: undefined;
  SuperBookings: undefined;
  SuperEventBookings: { eventId: string; title?: string; capacity?: number; filters?: import('../../services/bookingFilters').BookingFiltersValue };
  SuperBookingPeople: undefined;
  SuperBookingDetail: { eventId: string; booking: any; event?: { title?: string; capacity?: number; startAt?: string | null } };
  SuperBookingMessages: { bookingRef: string; title?: string };
  SuperDonors: undefined;
  SuperDonorDetail: { id: string; name?: string };
  SuperMembership: { tab?: 'plans' | 'platinum' | 'requests' } | undefined;
  /** No `planKey` = a new plan. */
  SuperPlanEditor: { planKey?: string; plan?: any } | undefined;
  SuperPlatinumGrant: { member: any; price?: number };
  SuperPlatinumRequest: { id: string; blockedReason?: string };
  SuperUpdates: undefined;
  /** No `announcement` = a new update. */
  SuperUpdateEditor: { announcement?: any } | undefined;
  SuperNotifications: { view?: 'automation' | 'log' | 'delivery' | 'routing' } | undefined;
};
