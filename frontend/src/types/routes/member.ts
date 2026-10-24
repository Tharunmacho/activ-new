/**
 * Stack routes owned by the MEMBER area. Add this area's NEW screens here only —
 * `RootStackParamList` (types/index.ts) merges every area's file.
 */
export type MemberRoutes = {
  PublicContent: { path: string; title?: string };
  PublicInfo: { path: string; title?: string };
  /** Everything a member can open, grouped like the website's member sidebar. */
  MemberMenu: undefined;
  /** The notifications list as a stack screen (paid members are not inside the tabs). */
  MemberNotifications: undefined;
  /** Paid members only (GET /members/directory). */
  MemberDirectory: undefined;
  DirectoryProfile: { id: string; name?: string };
  /** Paid members only — both ends must be paid (server re-checks on send). */
  MemberMessages: undefined;
  MessageThread: { conversationId: string; name?: string };
  MemberEvents: undefined;
  MemberEventDetail: { id: string };
  /** Book seats: free → confirmed; priced → PaymentCheckout. `ref` shows an existing ticket. */
  EventBooking: { eventId: string; ref?: string; forOthers?: boolean };
  AssociationUpdates: undefined;
  UpdateDetail: { id: string };
  MemberCertificate: { kind: 'membership' | 'tax-exemption' };
  /** The 80G A4 page full screen, zoomable — the same props the caller drew it with. */
  CertificateZoom: { cert: any; kind?: 'membership' | 'tax-exemption'; stamp?: string; receiptColumn?: boolean; amountInWords?: string };
  MemberDocuments: undefined;
  MembershipPlanDetails: undefined;
  MemberHelp: undefined;
  AccountSettings: undefined;
  PlatinumRequest: undefined;
  /** Donate CTA + the 80G receipts of gifts made from this phone. */
  MemberDonations: undefined;
  /** A page of the public website (https://activ.org.in) in the in-app viewer — Explore ACTIV. */
  WebsiteViewer: { url?: string; path?: string; title?: string; publicAccess?: boolean };
};
