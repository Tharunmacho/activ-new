import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "@/components/layout/ScrollToTop";
import PublicSharePreview from "@/components/shared/PublicSharePreview";
import RoleGate from "@/components/layout/RoleGate";
import FloatingLaunchers from "@/components/layout/FloatingLaunchers";
import { CartProvider } from "@/contexts/CartContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ActiveCompanyProvider } from "@/contexts/ActiveCompanyContext";
/**
 * The public site is eager; everything behind a login is lazy.
 *
 * Every page used to be a static import, so one bundle held the onboarding
 * site, four admin panels, the CMS, payments and the business area — 1.25 MB
 * a visitor had to download before the landing page could paint, and in dev
 * every one of those modules had to be transformed before the first render.
 * Splitting at the route boundary means someone reading the About or Contact
 * page fetches those two pages and nothing else.
 *
 * ONLY THE LANDING PAGE IS IN THE ENTRY BUNDLE NOW. The other public pages,
 * the login and a dozen member and business screens were eager too, which made
 * the one file every first visit waits on 1.15 MB — seconds on a phone before
 * the banner could draw. They are lazy, and `PreloadPublicPages` below fetches
 * the public ones as soon as the landing page is up and the browser is idle, so
 * a visitor moving from Home to About still gets it instantly, without having
 * paid for it before the first paint.
 */
import Hero from "./pages/onboarding/Hero";

/**
 * Warm the public pages' chunks once the landing page is on screen. Idle-time,
 * low priority, and it only downloads code — nothing renders.
 */
const PRELOAD_PUBLIC = [
  () => import("./pages/onboarding/AboutPage"),
  () => import("./pages/onboarding/EventsPage"),
  () => import("./pages/onboarding/GalleryPage"),
  () => import("./pages/onboarding/ContactPage"),
  () => import("./pages/onboarding/MembershipPage"),
  () => import("./pages/onboarding/NewsPage"),
  () => import("./pages/onboarding/SchemesPage"),
  () => import("./pages/onboarding/EventDetailPage"),
  () => import("./pages/onboarding/GalleryDetailPage"),
  () => import("./pages/onboarding/RegionPage"),
  () => import("./pages/onboarding/StatePage"),
  () => import("./shared/components/EnhancedLoginPage"),
  () => import("./pages/member/Register"),
];
const PreloadPublicPages = () => {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      // One after another, so the preload never competes with itself.
      PRELOAD_PUBLIC.reduce<Promise<unknown>>(
        (chain, load) => chain.then(() => (cancelled ? null : load().catch(() => null))),
        Promise.resolve(),
      );
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const start = () => (w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 5000 }) : window.setTimeout(run, 2000));
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => { cancelled = true; };
  }, []);
  return null;
};
const AboutPage = lazy(() => import("./pages/onboarding/AboutPage"));
const EventsPage = lazy(() => import("./pages/onboarding/EventsPage"));
const GalleryPage = lazy(() => import("./pages/onboarding/GalleryPage"));
const RegionPage = lazy(() => import("./pages/onboarding/RegionPage"));
const StatePage = lazy(() => import("./pages/onboarding/StatePage"));
/* "View All" — one list in full, on its own screen. Replaces the old feed page,
   which 404'd on the two types that are not feeds (About and Leadership). */
const StateDetailPage = lazy(() => import("./pages/onboarding/StateDetailPage"));
/* One item's own page. Lazy: it is reached by a click from the landing page or
   the gallery, never as a first paint, so it does not belong in the entry
   bundle the landing page waits on. */
const GalleryDetailPage = lazy(() => import("./pages/onboarding/GalleryDetailPage"));
/* One photograph out of an album, on a page of its own — see the note at the
   head of the file. Lazy for the same reason the album page is: most visits to
   the site never reach it. */
const GalleryPhotoPage = lazy(() => import("./pages/onboarding/GalleryPhotoPage"));
/* The newsroom and one article. Lazy, like the gallery detail: most visits to
   the site never open either, and the schemes band brings its own icons. */
const NewsPage = lazy(() => import("./pages/onboarding/NewsPage"));
const NewsDetailPage = lazy(() => import("./pages/onboarding/NewsDetailPage"));
/* Government schemes — their own section now, out of the newsroom. */
const SchemesPage = lazy(() => import("./pages/onboarding/SchemesPage"));
const SchemeDetailPage = lazy(() => import("./pages/onboarding/SchemeDetailPage"));
/* One event's own page. Lazy for the same reason: reached by a click, never
   as a first paint. */
const EventDetailPage = lazy(() => import("./pages/onboarding/EventDetailPage"));
const ContactPage = lazy(() => import("./pages/onboarding/ContactPage"));
/* Public giving — donors have no account, so none of these sit inside a gate. */
const DonatePage = lazy(() => import("./pages/donate/DonatePage"));
const DonateThankYou = lazy(() => import("./pages/donate/DonateThankYou"));
const DonationReceiptPage = lazy(() => import("./pages/donate/DonationDocumentPage").then((m) => ({ default: m.DonationReceiptPage })));
const DonationStatementPage = lazy(() => import("./pages/donate/DonationDocumentPage").then((m) => ({ default: m.DonationStatementPage })));
/*
 * The membership prospectus. Lazy, like the other leaf pages: it is reached
 * from a nav link, never as a first paint, and it carries the whole of the
 * association's twelve-page "Membership Advantage" document as a typed table —
 * which has no business sitting in the bundle the landing page waits on.
 */
const MembershipPage = lazy(() => import("./pages/onboarding/MembershipPage"));
/*
 * Lazy, like the other leaf pages. The legal documents are long strings that
 * nobody reads on the way to booking an event, and bundling them into the
 * landing chunk would make every first visit carry four policies.
 */
const LegalPage = lazy(() => import("./pages/onboarding/LegalPage"));
const DeleteAccountPage = lazy(() => import("./pages/onboarding/DeleteAccountPage"));
/* The public Book Now flow. Lazy for the same reason the detail page is. */
const EventBookingPage = lazy(() => import("./pages/onboarding/EventBookingPage"));
// The harmless page an entry-pass QR opens in an ordinary phone camera.
const EventPassPage = lazy(() => import("./pages/onboarding/EventPassPage"));
const SuperAttendance = lazy(() => import("./features/admin/super-admin/pages/Attendance"));
const EnhancedLoginPage = lazy(() => import("./shared/components/EnhancedLoginPage"));

const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const SocialSignIn = lazy(() => import("./pages/auth/SocialSignIn"));

// Member Feature Imports
const MemberRegister = lazy(() => import("./pages/member/Register"));

const MemberProfile = lazy(() => import("./pages/member/Profile"));
const ProfileView = lazy(() => import("./features/member/pages/ProfileView"));
const PersonalForm = lazy(() => import("./pages/member/PersonalForm"));
const BusinessForm = lazy(() => import("./pages/member/BusinessForm"));
const DeclarationForm = lazy(() => import("./pages/member/DeclarationForm"));
const ApplicationSubmitted = lazy(() => import("./pages/member/ApplicationSubmitted"));
const ApplicationStatus = lazy(() => import("./pages/member/ApplicationStatus"));
const PaymentPage = lazy(() => import("./pages/member/Payment"));
const PaymentSuccess = lazy(() => import("./pages/member/PaymentSuccess"));
const UnpaidDashboard = lazy(() => import("./features/member/pages/UnpaidDashboard"));
/*
 * The paid member area's four screens.
 *
 * Lazy, like everything else behind a login: an aspirant never opens the event
 * page and an unpaid visitor never opens any of them, so none of this belongs
 * in the bundle the landing page waits on.
 */
const AssociationUpdates = lazy(() => import("./features/member/pages/AssociationUpdates"));
const AnnouncementDetail = lazy(() => import("./features/member/pages/AnnouncementDetail"));
const MemberEvents = lazy(() => import("./features/member/pages/MemberEvents"));
const MemberEventDetail = lazy(() => import("./features/member/pages/MemberEventDetail"));
const MemberDirectory = lazy(() => import("./features/member/pages/MemberDirectory"));
const DirectoryProfile = lazy(() => import("./features/member/pages/DirectoryProfile"));
/*
 * The three screens that used to be "upcoming features" with nothing behind
 * them. Messages is the one member-only feature and still opens — it explains
 * what an active membership adds and carries the button that gets there.
 */
const EventRegistration = lazy(() => import("./features/member/pages/EventRegistration"));
const MemberMessages = lazy(() => import("./features/member/pages/MemberMessages"));
const MemberDocuments = lazy(() => import("./features/member/pages/MemberDocuments"));
const MemberHelp = lazy(() => import("./features/member/pages/MemberHelp"));
const CertificatePage = lazy(() => import("./features/member/pages/CertificatePage"));
const DonationCertificatePage = lazy(
  () => import("./features/member/pages/DonationCertificatePage"));
/* What "View plan details" opens — see the note at the head of the file. */
const MembershipPlanDetails = lazy(() => import("./features/member/pages/MembershipPlanDetails"));
// Account settings — photo, password, contact, sign out. The application itself is edited in My Profile.
const MemberSettings = lazy(() => import("./features/member/pages/AccountSettings"));

// Payment Feature Imports
const PaymentRegistration = lazy(() => import("./pages/payment/PaymentRegistration"));
const PaymentConfirmation = lazy(() => import("./pages/payment/PaymentConfirmation"));
const MockPayment = lazy(() => import("./pages/payment/MockPayment"));
const PaymentGateway = lazy(() => import("./pages/payment/PaymentGateway"));
/* Where Instamojo returns the member to — `redirect_url` on every payment
   request the server creates is `${FRONTEND_URL}/payment-success`. */
const PaymentReturn = lazy(() => import("./pages/payment/PaymentReturn"));
const PaymentMemberDashboard = lazy(() => import("./features/member/pages/PaidDashboard"));
const MembershipPlans = lazy(() => import("./pages/payment/MembershipPlans"));

// Business Feature Imports
const BusinessProfile = lazy(() => import("./pages/business/BusinessProfile"));
const BusinessDashboard = lazy(() => import("./pages/business/Dashboard"));
const Products = lazy(() => import("./pages/business/Products"));
const AddProduct = lazy(() => import("./pages/business/AddProduct"));
const EditProduct = lazy(() => import("./pages/business/EditProduct"));
const Discover = lazy(() => import("./pages/business/Discover"));
const Analytics = lazy(() => import("./pages/business/Analytics"));
const BusinessSettings = lazy(() => import("./pages/business/Settings"));
const MyCompanies = lazy(() => import("./pages/business/MyCompanies"));
const AddEditCompany = lazy(() => import("./pages/business/AddEditCompany"));
const CompanyDetails = lazy(() => import("./pages/business/CompanyDetails"));
const CompanyPublicView = lazy(() => import("./pages/business/CompanyPublicView"));
const TrustList = lazy(() => import("./pages/business/TrustList"));

// Block Admin Imports
const BlockDashboard = lazy(() => import("./features/admin/block-admin/pages/Dashboard"));
const BlockApprovals = lazy(() => import("./features/admin/block-admin/pages/Approvals"));
const BlockMembers = lazy(() => import("./features/admin/block-admin/pages/Members"));
const BlockSettings = lazy(() => import("./features/admin/block-admin/pages/Settings"));

// District Admin Imports
const DistrictDashboard = lazy(() => import("./features/admin/district-admin/pages/Dashboard"));
const DistrictApprovals = lazy(() => import("./features/admin/district-admin/pages/Approvals"));
const DistrictMembers = lazy(() => import("./features/admin/district-admin/pages/Members"));
const DistrictSettings = lazy(() => import("./features/admin/district-admin/pages/Settings"));
const DistrictHub = lazy(() => import("./features/admin/district-admin/pages/Hub"));

// State Admin Imports
const StateDashboard = lazy(() => import("./features/admin/state-admin/pages/Dashboard"));
const StateApprovals = lazy(() => import("./features/admin/state-admin/pages/Approvals"));
const StateMembers = lazy(() => import("./features/admin/state-admin/pages/Members"));
const StateSettings = lazy(() => import("./features/admin/state-admin/pages/Settings"));
const StateHub = lazy(() => import("./features/admin/state-admin/pages/Hub"));

// Super Admin Imports
// The Hub replaces the old flat dashboard: mobile drills tiers -> regions
// -> applications, which is what makes 405 blocks navigable.
const SuperHub = lazy(() => import("./features/admin/super-admin/pages/Hub"));
const SuperApprovals = lazy(() => import("./features/admin/super-admin/pages/Approvals"));
const SuperMembers = lazy(() => import("./features/admin/super-admin/pages/Members"));
const SuperSettings = lazy(() => import("./features/admin/super-admin/pages/Settings"));
const SuperManageAdmins = lazy(() => import("./features/admin/super-admin/pages/ManageAdmins"));
const SuperEvents = lazy(() => import("./features/admin/super-admin/pages/Events"));
const SuperMembership = lazy(() => import("./features/admin/super-admin/pages/Membership"));
const SuperMembershipRegistrations = lazy(() => import("./features/admin/super-admin/pages/MembershipRegistrations"));
const SuperDonations = lazy(() => import("./features/admin/super-admin/pages/Donations"));
const SuperDonorDetail = lazy(() => import("./features/admin/super-admin/pages/DonorDetail"));
/* Who is coming to which event, and who has paid. The organiser end of the
   public Book Now flow. */
const SuperBookings = lazy(() => import("./features/admin/super-admin/pages/Bookings"));
// The Bookings landing table — every event with its seat figures. The screen
// above is now the DETAIL of one event, reached from a row here.
const SuperBookingEvents = lazy(() => import("./features/admin/super-admin/pages/BookingEvents"));
// The chips an event is filed under — the same rows the public events grid
// filters by. See `eventcategory.service.js`.
const SuperEventCategories = lazy(() => import("./features/admin/super-admin/pages/EventCategories"));
const SuperUpdates = lazy(() => import("./features/admin/super-admin/pages/Updates"));
const SuperNotifications = lazy(() => import("./features/admin/super-admin/pages/Notifications"));
/* The Events Admin portal: its own dashboard, and the super admin's own event
   screens (All events, Categories, Bookings) mounted under /events-admin. */
const EventsAdminDashboard = lazy(() => import("./features/admin/events-admin/pages/Dashboard"));
const EventsAdminSettings = lazy(() => import("./features/admin/events-admin/pages/Settings"));
const EventsAdminGallery = lazy(() => import("./features/admin/events-admin/pages/Gallery"));
const EventsAdminNews = lazy(() => import("./features/admin/events-admin/pages/News"));
const EventsAdminSchemes = lazy(() => import("./features/admin/events-admin/pages/Schemes"));

// CMS (public-site content management, super admin only)
const CmsLayout = lazy(() => import("./pages/cms/CmsLayout"));
const CmsDashboard = lazy(() => import("./pages/cms/CmsDashboard"));
const SiteSettingsManager = lazy(() => import("./pages/cms/SiteSettingsManager"));
const SharePreviewsManager = lazy(() => import("./pages/cms/SharePreviewsManager"));
const HomeManager = lazy(() => import("./pages/cms/HomeManager"));
const AboutManager = lazy(() => import("./pages/cms/AboutManager"));
const EventsManager = lazy(() => import("./pages/cms/EventsManager"));
const GalleryManager = lazy(() => import("./pages/cms/GalleryManager"));
const NewsManager = lazy(() => import("./pages/cms/NewsManager"));
const SchemesManager = lazy(() => import("./pages/cms/SchemesManager"));
const MembershipManager = lazy(() => import("./pages/cms/MembershipManager"));
const ContactManager = lazy(() => import("./pages/cms/ContactManager"));
const MessagesInbox = lazy(() => import("./pages/cms/MessagesInbox"));
const LeaderMessagesInbox = lazy(() => import("./pages/cms/LeaderMessagesInbox"));
/* The legal notices, with their version history. See LegalManager. */
const LegalManager = lazy(() => import("./pages/cms/LegalManager"));
/* The regional and state pages — leadership, photographs, updates and contact.
   Lazy like the rest of the CMS: an editor who never opens it never downloads
   it. */
const RegionsManager = lazy(() => import("./pages/cms/RegionsManager"));

/**
 * Shown while a lazy route's chunk is in flight.
 *
 * Deliberately quiet — a full-page spinner on a chunk that usually arrives in
 * under 100ms reads as a slower app, not a faster one.
 */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div
      className="w-8 h-8 border-2 border-gray-200 border-t-[#1c2e68] rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CartProvider>
      <ProfileProvider>
        <ActiveCompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {/* Opting in to the v7 behaviour now, while both are supported.
              `startTransition` wraps route state updates so a slow render does
              not block the click that caused it; `relativeSplatPath` fixes how
              a relative link resolves inside a `*` route. Adopting them here
              silences the upgrade warnings and means the eventual move to v7
              changes nothing about how this app routes. */}
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {/* A routed page opens at its top. Without this the window keeps
                the offset it had, so pressing a link from the foot of one page
                lands on the footer of the next — see the component. */}
            <ScrollToTop />
            <PublicSharePreview>
            <PreloadPublicPages />
            <FloatingLaunchers />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/" element={<Hero />} />
              <Route path="/onboarding" element={<Hero />} />
              <Route path="/about" element={<AboutPage />} />
              {/* The membership prospectus, beside About: both answer "what is
                  this association", one about the body and one about joining it. */}
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/events" element={<EventsPage />} />
              {/* Where an event card goes when it is clicked. Below /events,
                  so the list keeps the bare path. */}
              <Route path="/events/:id" element={<EventDetailPage />} />
              {/* Book Now. Declared AFTER /events/:id so the detail page keeps the
                  bare path — React Router ranks static segments above dynamic
                  ones, but declaring it in reading order keeps that obvious. */}
              <Route path="/events/:id/book" element={<EventBookingPage />} />
              {/*
                The Regions & States section.

                The FEED path is declared above the page path on purpose. React
                Router ranks a static segment above a dynamic one so the order
                does not strictly matter here, but `/regions/:slug/:type` and
                `/regions/:slug` differ by one segment and reading them in this
                order is what makes it obvious that "south" is a page and
                "south/sectorUpdates" is a list — the same reason the events
                routes are written detail-then-book.
              */}
              <Route path="/regions/:slug/:type" element={<StateDetailPage scope="region" />} />
              <Route path="/regions/:slug" element={<RegionPage />} />
              <Route path="/states/:slug/:type" element={<StateDetailPage scope="state" />} />
              <Route path="/states/:slug" element={<StatePage />} />

              {/* The newsroom, then one article. `/news/:slug` below `/news`,
                  so the list keeps the bare path — the same order the gallery
                  and the events routes are written in. */}
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/:slug" element={<NewsDetailPage />} />

              {/* Schemes, chosen from the header's Schemes dropdown: Central,
                  or a state. `/schemes` opens the central list; the old
                  states-grid address goes there too, for any saved link.
                  `/schemes/view/:slug` has its own literal segment so a
                  scheme's slug can never collide with `central` or `state`. */}
              <Route path="/schemes" element={<SchemesPage view="central" />} />
              <Route path="/schemes/central" element={<SchemesPage view="central" />} />
              <Route path="/schemes/state" element={<SchemesPage view="states" />} />
              <Route path="/schemes/state/:slug" element={<SchemesPage view="state" />} />
              <Route path="/schemes/view/:slug" element={<SchemeDetailPage />} />

              <Route path="/gallery" element={<GalleryPage />} />
              {/* Where a poster goes when it is clicked, on the landing page or
                  in the gallery grid. Below /gallery, so the list keeps the
                  bare path. */}
              <Route path="/gallery/:id" element={<GalleryDetailPage />} />
              {/*
                ONE PHOTOGRAPH OUT OF THAT ALBUM.

                Below `/gallery/:id` and nested under it, so the address says
                what it is — this photograph, of this album — and the album
                stays the parent a reader goes back to. `:n` indexes the album
                with the COVER AS 0, which is the same numbering the album page
                links with; see the note in `GalleryPhotoPage`.
              */}
              <Route path="/gallery/:id/photo/:n" element={<GalleryPhotoPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/donate/thank-you" element={<DonateThankYou />} />
              <Route path="/donate/receipt/:token" element={<DonationReceiptPage />} />
              <Route path="/donate/statement/:token" element={<DonationStatementPage />} />
              {/* An event entry pass (QR in the booking email). Public and harmless:
                  event name and date only, never marks attendance — the staff's
                  ACTIV app does that. See EventPassPage. */}
              <Route path="/checkin/:token" element={<EventPassPage />} />

              {/*
                The four legal documents, at the literal paths the footer links
                to and a search engine expects. One component renders all four
                from the slug — see the note in LegalPage.

                `/legal/:slug` last, as a catch-all for a link written the other
                way round. It is not the canonical form: nothing links to it.
              */}
              <Route path="/privacy-policy" element={<LegalPage />} />
              <Route path="/delete-account" element={<DeleteAccountPage />} />
              <Route path="/terms-and-conditions" element={<LegalPage />} />
              <Route path="/refund-policy" element={<LegalPage />} />
              <Route path="/cancellation-policy" element={<LegalPage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />

              <Route path="/login" element={<EnhancedLoginPage />} />
              {/* Admins sign in on their own screen: no social sign-in, no
                  "Create an account", and members are sent back to /login. */}
              <Route path="/admin/login" element={<EnhancedLoginPage audience="admin" />} />
              {/* The login page has linked to /forgot-password all along;
                  neither route existed, so it fell through to the 404 page. */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* The admin screens reach ONLY admin accounts the Super Admin
                  created; the member ones only member accounts (`portal`). */}
              <Route path="/admin/forgot-password" element={<ForgotPassword audience="admin" />} />
              <Route path="/admin/reset-password" element={<ResetPassword audience="admin" />} />
              {/* Google / Facebook / LinkedIn send the member back here. */}
              <Route path="/auth/social" element={<SocialSignIn />} />
              <Route path="/register" element={<MemberRegister />} />

              {/* Member Routes

                  EVERYTHING FROM HERE TO THE BUSINESS ROUTES IS A MEMBER'S. The
                  gate sends a guest to /login and tells a signed-in ADMIN which
                  account they are in, instead of drawing a member dashboard under
                  the admin's name. A new member page goes INSIDE a gate. */}
              <Route element={<RoleGate area="member" />}>

              {/* A link that used to be printed on the payment page; the dashboard lives at /payment/member-dashboard. */}
              <Route path="/member/dashboard" element={<Navigate to="/payment/member-dashboard" replace />} />
              <Route path="/member/unpaid-dashboard" element={<UnpaidDashboard />} />

              {/* The paid member area (MEM-001, EVT-001/2, DIR-001). */}
              <Route path="/member/updates" element={<AssociationUpdates />} />
              <Route path="/member/updates/:id" element={<AnnouncementDetail />} />
              <Route path="/member/events" element={<MemberEvents />} />
              <Route path="/member/events/:id" element={<MemberEventDetail />} />
              {/*
                * Registration is its own screen, not a form in the event's
                * sidebar. It is a transaction — it has steps, it takes money,
                * and it carries whatever questions the organiser added — and it
                * is drawn without the member rail so there is one way forward
                * and one way back. Declared AFTER `/:id` is fine: the paths
                * differ in length, so there is no ambiguity for the router.
                */}
              {/* BOOKING, INSIDE THE MEMBER AREA.

                  The same page the public site books through — one booking
                  system, one attendee list — rendered in the dashboard's own
                  shell so a member is not thrown out to the marketing site
                  halfway through paying. See `EventBookingPage`. */}
              <Route path="/member/events/:id/book" element={<EventBookingPage chrome="member" />} />
              <Route path="/member/events/:id/register" element={<EventRegistration />} />
              <Route path="/member/directory" element={<MemberDirectory />} />
              <Route path="/member/directory/:id" element={<DirectoryProfile />} />
              <Route path="/member/messages" element={<MemberMessages />} />
              <Route path="/member/documents" element={<MemberDocuments />} />
              <Route path="/member/help" element={<MemberHelp />} />
              {/*
                * `/explore` was the old client-side-filtered member list. It
                * resolves to the directory rather than 404ing, because it is
                * the path in every bookmark and in the sidebar of any tab left
                * open across the deploy.
                */}
              <Route path="/explore" element={<Navigate to="/member/directory" replace />} />
              <Route path="/member/profile-view" element={<ProfileView />} />
              <Route path="/member/profile" element={<MemberProfile />} />
              <Route path="/member/settings" element={<MemberSettings />} />
              <Route path="/member/certificate/:kind" element={<CertificatePage />} />
              {/* The 80G donation receipt. Its own route rather than another
                  `:kind` on the one above: that page renders a MEMBERSHIP
                  certificate and this one is a tax document with a payment
                  table, which is not the same sheet with different words. */}
              <Route path="/member/donation-certificate" element={<DonationCertificatePage />} />
              <Route path="/member/plan" element={<MembershipPlanDetails />} />
              <Route path="/member/forms/personal" element={<PersonalForm />} />
              <Route path="/member/forms/business" element={<BusinessForm />} />
              {/*
                  The Financial & Compliance step has moved to the Business
                  Creation Account, which is where the company it describes
                  lives. The path redirects rather than 404ing: it is in the
                  browser history of every applicant part-way through the old
                  four-step flow, and in any tab left open across the deploy.
                */}
              <Route
                path="/member/forms/financial"
                element={<Navigate to="/member/forms/declaration" replace />}
              />
              <Route path="/member/forms/declaration" element={<DeclarationForm />} />
              <Route path="/business/create-profile" element={<BusinessProfile />} />
              <Route path="/member/application-submitted" element={<ApplicationSubmitted />} />
              <Route path="/member/application-status" element={<ApplicationStatus />} />
              <Route path="/member/payment" element={<PaymentPage />} />
              <Route path="/member/payment-success" element={<PaymentSuccess />} />

              {/* Feature Pages Routes (New UI) */}

              {/* E-commerce Routes */}

              {/* New Payment Routes */}
              <Route path="/payment/membership-plan" element={<PaymentRegistration />} />
              <Route path="/payment/confirmation" element={<PaymentConfirmation />} />
              <Route path="/payment/mock" element={<MockPayment />} />
              {/* PaymentGateway existed but was never routed, so nothing could
                  reach it — and it is the step that records the payment. */}
              <Route path="/payment/gateway" element={<PaymentGateway />} />
              </Route>
              {/*
                * TOP LEVEL, not under /member, and not negotiable: this exact
                * path is what the server sends to Instamojo as `redirect_url`,
                * and Instamojo sends the member back to it after paying. A
                * route that does not exist here is a paying member landing on
                * a 404 with money gone.
                */}
              <Route path="/payment-success" element={<PaymentReturn />} />
              {/* Outside the gate, above: guests pay for event bookings too. */}
              <Route element={<RoleGate area="member" />}>
              <Route path="/payment/member-dashboard" element={<PaymentMemberDashboard />} />
              <Route path="/payment/membership-plans" element={<MembershipPlans />} />

              {/* Business Routes */}
              <Route path="/business/dashboard" element={<BusinessDashboard />} />
              <Route path="/business/products" element={<Products />} />
              <Route path="/business/add-product" element={<AddProduct />} />
              <Route path="/business/edit-product/:id" element={<EditProduct />} />
              <Route path="/business/discover" element={<Discover />} />
              <Route path="/business/analytics" element={<Analytics />} />
              <Route path="/business/settings" element={<BusinessSettings />} />
              <Route path="/business/companies" element={<MyCompanies />} />
              <Route path="/business/companies/add" element={<AddEditCompany />} />
              <Route path="/business/companies/edit/:id" element={<AddEditCompany />} />
              <Route path="/business/trust-list" element={<TrustList />} />
              {/*
                  The member-facing company page, under `/company/` rather than
                  `/companies/`.

                  A separate path on purpose: `/business/companies/*` is the
                  OWNER's area — a list of what you have, and the forms that
                  edit them — and this is the page any member may open, about
                  any company. Hanging it off `/companies/:id/view` would put a
                  route anyone can reach inside a branch whose every other entry
                  is owner-only, which is the kind of neighbourhood where an
                  ownership check gets forgotten.
              */}
              <Route path="/business/company/:id" element={<CompanyPublicView />} />
              <Route path="/business/companies/:id" element={<CompanyDetails />} />
              </Route>

              {/* EVERY ADMIN PORTAL, to the legacy routes below: a guest goes to
                  /admin/login and a member to their own dashboard. The server
                  still decides what each admin role may do. */}
              {/* ONE GATE PER PORTAL: a wrong-tier admin is sent to their own
                  portal (super_admin may open any). See RoleGate `roles`. */}
              <Route element={<RoleGate area="admin" roles={['block_admin']} />}>
              {/* Block Admin Routes */}
              <Route path="/block-admin/dashboard" element={<BlockDashboard />} />
              <Route path="/block-admin/approvals" element={<BlockApprovals />} />
              <Route path="/block-admin/applications" element={<BlockApprovals />} />
              <Route path="/block-admin/members" element={<BlockMembers />} />
              <Route path="/block-admin/settings" element={<BlockSettings />} />

              </Route>

              <Route element={<RoleGate area="admin" roles={['district_admin']} />}>
              {/* District Admin Routes */}
              <Route path="/district-admin/dashboard" element={<DistrictDashboard />} />
              <Route path="/district-admin/approvals" element={<DistrictApprovals />} />
              <Route path="/district-admin/applications" element={<DistrictApprovals />} />
              <Route path="/district-admin/members" element={<DistrictMembers />} />
              <Route path="/district-admin/settings" element={<DistrictSettings />} />
              {/* The blocks of this district, with their queues — the super
                  admin Hub, narrowed by the server to this patch. */}
              <Route path="/district-admin/hub" element={<DistrictHub />} />

              </Route>

              <Route element={<RoleGate area="admin" roles={['state_admin']} />}>
              {/* State Admin Routes */}
              <Route path="/state-admin/dashboard" element={<StateDashboard />} />
              <Route path="/state-admin/approvals" element={<StateApprovals />} />
              <Route path="/state-admin/applications" element={<StateApprovals />} />
              <Route path="/state-admin/members" element={<StateMembers />} />
              <Route path="/state-admin/settings" element={<StateSettings />} />
              {/* The districts and blocks of this state, with their queues. */}
              <Route path="/state-admin/hub" element={<StateHub />} />

              </Route>

              <Route element={<RoleGate area="admin" roles={['super_admin']} />}>
              {/* Super Admin Routes */}
              <Route path="/super-admin/dashboard" element={<SuperHub />} />
              <Route path="/super-admin/approvals" element={<SuperApprovals />} />
              <Route path="/super-admin/applications" element={<SuperApprovals />} />
              <Route path="/super-admin/members" element={<SuperMembers />} />
              <Route path="/super-admin/settings" element={<SuperSettings />} />
              {/* The one place admin accounts are created, edited and removed.
                  The district and state tiers had a narrowed copy of this at
                  `/district-admin/admins` and `/state-admin/admins`; both are
                  gone — see `TIER_NAV` in `tierConfig.ts`. */}
              <Route path="/super-admin/admins" element={<SuperManageAdmins />} />
              {/* Events is a TAB of the super-admin section on mobile. Linking
                  at /cms/events dropped the administrator into the CMS shell. */}
              <Route path="/super-admin/events" element={<SuperEvents />} />
              {/* Declared AFTER `/super-admin/events` and it does not matter —
                  React Router ranks by specificity, not by declaration order,
                  unlike the Express routers this codebase warns about twice.
                  Kept adjacent anyway so the section reads as one block. */}
              <Route path="/super-admin/events/categories" element={<SuperEventCategories />} />
              {/* The overview, and one event's own bookings. Two routes rather
                  than a dropdown: the detail screen is then linkable, Back
                  returns to the table, and a reload lands on the same event. */}
              <Route path="/super-admin/bookings" element={<SuperBookingEvents />} />
              <Route path="/super-admin/bookings/:eventId" element={<SuperBookings />} />
              {/* Who came through the door (QR check-in), per event. */}
              <Route path="/super-admin/attendance" element={<SuperAttendance />} />
              <Route path="/super-admin/attendance/:eventId" element={<SuperAttendance />} />
              <Route path="/super-admin/membership" element={<SuperMembership />} />
              <Route path="/super-admin/membership-registrations" element={<SuperMembershipRegistrations />} />
              <Route path="/super-admin/donations" element={<SuperDonations />} />
              <Route path="/super-admin/donations/:id" element={<SuperDonorDetail />} />
              {/* Association Updates (MEM-001) — authored here, delivered to the
                  dashboard of every member whose region matches. */}
              <Route path="/super-admin/updates" element={<SuperUpdates />} />
              {/* Delivery oversight for the email and WhatsApp channels. */}
              <Route path="/super-admin/notifications" element={<SuperNotifications />} />

              </Route>

              <Route element={<RoleGate area="admin" roles={['events_admin']} />}>
              {/* Events Admin — a separate account whose whole portal is the
                  programme. Same components as the super admin's Events
                  section, so the editor, the categories and the bookings are
                  one implementation; `adminBasePath` keeps every link inside
                  /events-admin. The server refuses this role everywhere else. */}
              <Route path="/events-admin" element={<Navigate to="/events-admin/dashboard" replace />} />
              <Route path="/events-admin/dashboard" element={<EventsAdminDashboard />} />
              <Route path="/events-admin/events" element={<SuperEvents />} />
              <Route path="/events-admin/events/categories" element={<SuperEventCategories />} />
              {/* No bookings in this portal — the super admin's alone. An old
                  link lands on the dashboard rather than a 403 screen. */}
              <Route path="/events-admin/bookings" element={<Navigate to="/events-admin/dashboard" replace />} />
              <Route path="/events-admin/bookings/:eventId" element={<Navigate to="/events-admin/dashboard" replace />} />
              {/* Attendance IS this portal's: the events admin runs the door.
                  Names only — contact details stay with the super admin. */}
              <Route path="/events-admin/attendance" element={<SuperAttendance />} />
              <Route path="/events-admin/attendance/:eventId" element={<SuperAttendance />} />
              {/* The CMS's own Gallery, News and Schemes editors, in this
                  portal's shell — one write path per collection. */}
              <Route path="/events-admin/gallery" element={<EventsAdminGallery />} />
              <Route path="/events-admin/news" element={<EventsAdminNews />} />
              <Route path="/events-admin/schemes" element={<EventsAdminSchemes />} />
              <Route path="/events-admin/settings" element={<EventsAdminSettings />} />

              </Route>

              {/* The legacy /admin/* paths render the BLOCK screens. */}
              <Route element={<RoleGate area="admin" roles={['block_admin']} />}>
              {/* Legacy Admin Routes - Redirect to Block Admin */}
              <Route path="/admin/dashboard" element={<BlockDashboard />} />
              <Route path="/admin/block/dashboard" element={<BlockDashboard />} />
              <Route path="/admin/applications" element={<BlockApprovals />} />
              <Route path="/admin/approvals" element={<BlockApprovals />} />
              <Route path="/admin/members" element={<BlockMembers />} />
              <Route path="/admin/settings" element={<BlockSettings />} />
              </Route>

              

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              {/* CMS — nested so the dark layout renders once and the guard
                  lives in one place rather than on seven screens. */}
              <Route path="/cms" element={<CmsLayout />}>
                <Route index element={<CmsDashboard />} />
                <Route path="site" element={<SiteSettingsManager />} />
                <Route path="social-previews" element={<SharePreviewsManager />} />
                <Route path="home" element={<HomeManager />} />
                <Route path="about" element={<AboutManager />} />
                <Route path="events" element={<EventsManager />} />
                <Route path="gallery" element={<GalleryManager />} />
                <Route path="news" element={<NewsManager />} />
                <Route path="schemes" element={<SchemesManager />} />
                <Route path="membership" element={<MembershipManager />} />
                <Route path="contact" element={<ContactManager />} />
                <Route path="regions" element={<RegionsManager />} />
                <Route path="legal" element={<LegalManager />} />
                <Route path="messages" element={<MessagesInbox />} />
                <Route path="leader-messages" element={<LeaderMessagesInbox />} />
              </Route>

              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </PublicSharePreview>
          </BrowserRouter>
        </TooltipProvider>
        </ActiveCompanyProvider>
      </ProfileProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;
