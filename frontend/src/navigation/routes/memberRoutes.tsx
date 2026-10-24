import React from 'react';
import MemberMenuScreen from '../../screens/member/MemberMenuScreen';
import NotificationScreen from '../../screens/member/NotificationScreen';
import MemberDirectoryScreen from '../../screens/member/directory/MemberDirectoryScreen';
import DirectoryProfileScreen from '../../screens/member/directory/DirectoryProfileScreen';
import MemberMessagesScreen from '../../screens/member/messages/MemberMessagesScreen';
import MessageThreadScreen from '../../screens/member/messages/MessageThreadScreen';
import MemberEventsScreen from '../../screens/member/events/MemberEventsScreen';
import MemberEventDetailScreen from '../../screens/member/events/MemberEventDetailScreen';
import EventBookingScreen from '../../screens/member/events/EventBookingScreen';
import AssociationUpdatesScreen from '../../screens/member/updates/AssociationUpdatesScreen';
import UpdateDetailScreen from '../../screens/member/updates/UpdateDetailScreen';
import MemberCertificateScreen from '../../screens/member/certificates/MemberCertificateScreen';
import CertificateZoomScreen from '../../screens/member/certificates/CertificateZoomScreen';
import MemberDocumentsScreen from '../../screens/member/documents/MemberDocumentsScreen';
import MembershipPlanDetailsScreen from '../../screens/member/plan/MembershipPlanDetailsScreen';
import MemberHelpScreen from '../../screens/member/help/MemberHelpScreen';
import AccountSettingsScreen from '../../screens/member/settings/AccountSettingsScreen';
import PlatinumRequestScreen from '../../screens/member/platinum/PlatinumRequestScreen';
import MemberDonationsScreen from '../../screens/payment/MemberDonationsScreen';
import WebsiteViewerScreen from '../../screens/member/website/WebsiteViewerScreen';
import PublicContentScreen from '../../screens/public/PublicContentScreen';
import PublicInfoScreen from '../../screens/public/PublicInfoScreen';

/**
 * The member area's NEW stack screens (types in types/routes/member.ts).
 * Registered once in App.tsx inside the ROOT <Stack.Navigator>, so a
 * `navigation.navigate('X')` from any screen — including the member tab
 * screens (Dashboard / Explore / Notifications / Profile), whose navigate
 * bubbles up to this stack — reaches them. Add screens here, never in App.tsx.
 *
 *   MemberMenu            everything a member can open (website MemberSidebar)
 *   MemberNotifications   the bell: /notifications + /events + /announcements, 24 h
 *   MemberDirectory …     paid only: /members/directory(/sectors|/:id)
 *   MemberMessages …      paid only: /messages
 *   MemberEvents …        /events, /event-bookings
 *   AssociationUpdates    /announcements(/:id)
 *   MemberCertificate     /members/certificate/{membership|tax-exemption}
 *   CertificateZoom       the 80G A4 page full screen (no fetch — params carry it)
 *   MemberDocuments       certificates + application record
 *   MembershipPlanDetails /membership/plans/mine + my-profile + my-applications
 *   MemberHelp            /cms/contact-info → POST /cms/contact-messages
 *   AccountSettings       /auth/change-password, /members/profile-photo
 *   PlatinumRequest       /membership/platinum/request
 *   MemberDonations       the member's way into /donations and their 80G papers
 *   WebsiteViewer         one page of the public website (Explore ACTIV), in-app
 */
const noHeader = { headerShown: false };

export const memberScreens = (Stack: any) => (
  <>
    <Stack.Screen name="MemberMenu" component={MemberMenuScreen} options={noHeader} />
    <Stack.Screen name="MemberNotifications" component={NotificationScreen} options={noHeader} />
    <Stack.Screen name="MemberDirectory" component={MemberDirectoryScreen} options={noHeader} />
    <Stack.Screen name="DirectoryProfile" component={DirectoryProfileScreen} options={noHeader} />
    <Stack.Screen name="MemberMessages" component={MemberMessagesScreen} options={noHeader} />
    <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={noHeader} />
    <Stack.Screen name="MemberEvents" component={MemberEventsScreen} options={noHeader} />
    <Stack.Screen name="MemberEventDetail" component={MemberEventDetailScreen} options={noHeader} />
    <Stack.Screen name="EventBooking" component={EventBookingScreen} options={noHeader} />
    <Stack.Screen name="AssociationUpdates" component={AssociationUpdatesScreen} options={noHeader} />
    <Stack.Screen name="UpdateDetail" component={UpdateDetailScreen} options={noHeader} />
    <Stack.Screen name="MemberCertificate" component={MemberCertificateScreen} options={noHeader} />
    <Stack.Screen name="CertificateZoom" component={CertificateZoomScreen} options={noHeader} />
    <Stack.Screen name="MemberDocuments" component={MemberDocumentsScreen} options={noHeader} />
    <Stack.Screen name="MembershipPlanDetails" component={MembershipPlanDetailsScreen} options={noHeader} />
    <Stack.Screen name="MemberHelp" component={MemberHelpScreen} options={noHeader} />
    <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} options={noHeader} />
    <Stack.Screen name="PlatinumRequest" component={PlatinumRequestScreen} options={noHeader} />
    <Stack.Screen name="MemberDonations" component={MemberDonationsScreen} options={noHeader} />
    <Stack.Screen name="WebsiteViewer" component={WebsiteViewerScreen} options={noHeader} />
    <Stack.Screen name="PublicContent" component={PublicContentScreen} options={noHeader} />
    <Stack.Screen name="PublicInfo" component={PublicInfoScreen} options={noHeader} />
  </>
);
