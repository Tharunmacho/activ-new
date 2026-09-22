import { lazy, Suspense } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ScrollToTop from "@/components/layout/ScrollToTop";
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
 * The five public routes and the login stay eager on purpose: they are the
 * entry points, and a Suspense fallback flashing on the first paint of the
 * landing page is worse than the few kilobytes it would save.
 */
import Hero from "./pages/onboarding/Hero";
import AboutPage from "./pages/onboarding/AboutPage";
import EventsPage from "./pages/onboarding/EventsPage";
import GalleryPage from "./pages/onboarding/GalleryPage";
import RegionPage from "./pages/onboarding/RegionPage";
import StatePage from "./pages/onboarding/StatePage";
/* "View All" — one list in full, on its own screen. Replaces the old feed page,
   which 404'd on the two types that are not feeds (About and Leadership). */
import StateDetailPage from "./pages/onboarding/StateDetailPage";
/* One item's own page. Lazy: it is reached by a click from the landing page or
   the gallery, never as a first paint, so it does not belong in the entry
   bundle the landing page waits on. */
const GalleryDetailPage = lazy(() => import("./pages/onboarding/GalleryDetailPage"));
/* The newsroom and one article. Lazy, like the gallery detail: most visits to
   the site never open either, and the schemes band brings its own icons. */
const NewsPage = lazy(() => import("./pages/onboarding/NewsPage"));
const NewsDetailPage = lazy(() => import("./pages/onboarding/NewsDetailPage"));
/* One event's own page. Lazy for the same reason: reached by a click, never
   as a first paint. */
const EventDetailPage = lazy(() => import("./pages/onboarding/EventDetailPage"));
import ContactPage from "./pages/onboarding/ContactPage";
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
/* The public Book Now flow. Lazy for the same reason the detail page is. */
const EventBookingPage = lazy(() => import("./pages/onboarding/EventBookingPage"));
import EnhancedLoginPage from "./shared/components/EnhancedLoginPage";

const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Member Feature Imports
import MemberRegister from "./pages/member/Register";

import MemberProfile from "./pages/member/Profile";
import ProfileView from "./features/member/pages/ProfileView";
const PersonalForm = lazy(() => import("./pages/member/PersonalForm"));
const BusinessForm = lazy(() => import("./pages/member/BusinessForm"));
const DeclarationForm = lazy(() => import("./pages/member/DeclarationForm"));
const ApplicationSubmitted = lazy(() => import("./pages/member/ApplicationSubmitted"));
import ApplicationStatus from "./pages/member/ApplicationStatus";
const PaymentPage = lazy(() => import("./pages/member/Payment"));
const PaymentSuccess = lazy(() => import("./pages/member/PaymentSuccess"));
import UnpaidDashboard from "./features/member/pages/UnpaidDashboard";
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
import MemberSettings from "./pages/member/Settings";

// Payment Feature Imports
const PaymentRegistration = lazy(() => import("./pages/payment/PaymentRegistration"));
const PaymentConfirmation = lazy(() => import("./pages/payment/PaymentConfirmation"));
const MockPayment = lazy(() => import("./pages/payment/MockPayment"));
const PaymentGateway = lazy(() => import("./pages/payment/PaymentGateway"));
import PaymentMemberDashboard from "./features/member/pages/PaidDashboard";
const MembershipPlans = lazy(() => import("./pages/payment/MembershipPlans"));

// Business Feature Imports
import BusinessProfile from "./pages/business/BusinessProfile";
import BusinessDashboard from "./pages/business/Dashboard";
import Products from "./pages/business/Products";
const AddProduct = lazy(() => import("./pages/business/AddProduct"));
const EditProduct = lazy(() => import("./pages/business/EditProduct"));
import Discover from "./pages/business/Discover";
import Analytics from "./pages/business/Analytics";
import BusinessSettings from "./pages/business/Settings";
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

// CMS (public-site content management, super admin only)
const CmsLayout = lazy(() => import("./pages/cms/CmsLayout"));
const CmsDashboard = lazy(() => import("./pages/cms/CmsDashboard"));
const SiteSettingsManager = lazy(() => import("./pages/cms/SiteSettingsManager"));
const HomeManager = lazy(() => import("./pages/cms/HomeManager"));
const AboutManager = lazy(() => import("./pages/cms/AboutManager"));
const EventsManager = lazy(() => import("./pages/cms/EventsManager"));
const GalleryManager = lazy(() => import("./pages/cms/GalleryManager"));
const NewsManager = lazy(() => import("./pages/cms/NewsManager"));
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

              <Route path="/gallery" element={<GalleryPage />} />
              {/* Where a poster goes when it is clicked, on the landing page or
                  in the gallery grid. Below /gallery, so the list keeps the
                  bare path. */}
              <Route path="/gallery/:id" element={<GalleryDetailPage />} />
              <Route path="/contact" element={<ContactPage />} />

              {/*
                The four legal documents, at the literal paths the footer links
                to and a search engine expects. One component renders all four
                from the slug — see the note in LegalPage.

                `/legal/:slug` last, as a catch-all for a link written the other
                way round. It is not the canonical form: nothing links to it.
              */}
              <Route path="/privacy-policy" element={<LegalPage />} />
              <Route path="/terms-and-conditions" element={<LegalPage />} />
              <Route path="/refund-policy" element={<LegalPage />} />
              <Route path="/cancellation-policy" element={<LegalPage />} />
              <Route path="/legal/:slug" element={<LegalPage />} />

              <Route path="/login" element={<EnhancedLoginPage />} />
              {/* The login page has linked to /forgot-password all along;
                  neither route existed, so it fell through to the 404 page. */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register" element={<MemberRegister />} />

              {/* Member Routes */}

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

              {/* Block Admin Routes */}
              <Route path="/block-admin/dashboard" element={<BlockDashboard />} />
              <Route path="/block-admin/approvals" element={<BlockApprovals />} />
              <Route path="/block-admin/applications" element={<BlockApprovals />} />
              <Route path="/block-admin/members" element={<BlockMembers />} />
              <Route path="/block-admin/settings" element={<BlockSettings />} />

              {/* District Admin Routes */}
              <Route path="/district-admin/dashboard" element={<DistrictDashboard />} />
              <Route path="/district-admin/approvals" element={<DistrictApprovals />} />
              <Route path="/district-admin/applications" element={<DistrictApprovals />} />
              <Route path="/district-admin/members" element={<DistrictMembers />} />
              <Route path="/district-admin/settings" element={<DistrictSettings />} />
              {/* The blocks of this district, with their queues — the super
                  admin Hub, narrowed by the server to this patch. */}
              <Route path="/district-admin/hub" element={<DistrictHub />} />

              {/* State Admin Routes */}
              <Route path="/state-admin/dashboard" element={<StateDashboard />} />
              <Route path="/state-admin/approvals" element={<StateApprovals />} />
              <Route path="/state-admin/applications" element={<StateApprovals />} />
              <Route path="/state-admin/members" element={<StateMembers />} />
              <Route path="/state-admin/settings" element={<StateSettings />} />
              {/* The districts and blocks of this state, with their queues. */}
              <Route path="/state-admin/hub" element={<StateHub />} />

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
              <Route path="/super-admin/membership" element={<SuperMembership />} />
              {/* Association Updates (MEM-001) — authored here, delivered to the
                  dashboard of every member whose region matches. */}
              <Route path="/super-admin/updates" element={<SuperUpdates />} />
              {/* Delivery oversight for the email and WhatsApp channels. */}
              <Route path="/super-admin/notifications" element={<SuperNotifications />} />

              {/* Legacy Admin Routes - Redirect to Block Admin */}
              <Route path="/admin/dashboard" element={<BlockDashboard />} />
              <Route path="/admin/block/dashboard" element={<BlockDashboard />} />
              <Route path="/admin/applications" element={<BlockApprovals />} />
              <Route path="/admin/approvals" element={<BlockApprovals />} />
              <Route path="/admin/members" element={<BlockMembers />} />
              <Route path="/admin/settings" element={<BlockSettings />} />

              

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              {/* CMS — nested so the dark layout renders once and the guard
                  lives in one place rather than on seven screens. */}
              <Route path="/cms" element={<CmsLayout />}>
                <Route index element={<CmsDashboard />} />
                <Route path="site" element={<SiteSettingsManager />} />
                <Route path="home" element={<HomeManager />} />
                <Route path="about" element={<AboutManager />} />
                <Route path="events" element={<EventsManager />} />
                <Route path="gallery" element={<GalleryManager />} />
                <Route path="news" element={<NewsManager />} />
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
          </BrowserRouter>
        </TooltipProvider>
        </ActiveCompanyProvider>
      </ProfileProvider>
    </CartProvider>
  </QueryClientProvider>
);

export default App;