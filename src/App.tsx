import { lazy, Suspense } from "react";
import { Toaster } from "@/shared/components/ui/toaster";
import { Toaster as Sonner } from "@/shared/components/ui/sonner";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import ContactPage from "./pages/onboarding/ContactPage";
import EnhancedLoginPage from "./shared/components/EnhancedLoginPage";

const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));

// Member Feature Imports
const MemberRegister = lazy(() => import("./pages/member/Register"));
const MemberDashboard = lazy(() => import("./pages/member/Dashboard"));
const MemberProfile = lazy(() => import("./pages/member/Profile"));
const ProfileView = lazy(() => import("./features/member/pages/ProfileView"));
const PersonalForm = lazy(() => import("./pages/member/PersonalForm"));
const BusinessForm = lazy(() => import("./pages/member/BusinessForm"));
const FinancialForm = lazy(() => import("./pages/member/FinancialForm"));
const DeclarationForm = lazy(() => import("./pages/member/DeclarationForm"));
const ApplicationSubmitted = lazy(() => import("./pages/member/ApplicationSubmitted"));
const ApplicationStatus = lazy(() => import("./pages/member/ApplicationStatus"));
const PaymentPage = lazy(() => import("./pages/member/Payment"));
const PaymentSuccess = lazy(() => import("./pages/member/PaymentSuccess"));
const UnpaidDashboard = lazy(() => import("./features/member/pages/UnpaidDashboard"));
const Explore = lazy(() => import("./features/member/pages/Explore"));
const CertificatePage = lazy(() => import("./features/member/pages/CertificatePage"));
const MemberSettings = lazy(() => import("./pages/member/Settings"));

// Payment Feature Imports
const PaymentRegistration = lazy(() => import("./pages/payment/PaymentRegistration"));
const PaymentConfirmation = lazy(() => import("./pages/payment/PaymentConfirmation"));
const MockPayment = lazy(() => import("./pages/payment/MockPayment"));
const PaymentGateway = lazy(() => import("./pages/payment/PaymentGateway"));
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

// State Admin Imports
const StateDashboard = lazy(() => import("./features/admin/state-admin/pages/Dashboard"));
const StateApprovals = lazy(() => import("./features/admin/state-admin/pages/Approvals"));
const StateMembers = lazy(() => import("./features/admin/state-admin/pages/Members"));
const StateSettings = lazy(() => import("./features/admin/state-admin/pages/Settings"));

// Super Admin Imports
// The Hub replaces the old flat dashboard: mobile drills tiers -> regions
// -> applications, which is what makes 405 blocks navigable.
const SuperHub = lazy(() => import("./features/admin/super-admin/pages/Hub"));
const SuperApprovals = lazy(() => import("./features/admin/super-admin/pages/Approvals"));
const SuperMembers = lazy(() => import("./features/admin/super-admin/pages/Members"));
const SuperSettings = lazy(() => import("./features/admin/super-admin/pages/Settings"));
const SuperManageAdmins = lazy(() => import("./features/admin/super-admin/pages/ManageAdmins"));
const SuperEvents = lazy(() => import("./features/admin/super-admin/pages/Events"));

// CMS (public-site content management, super admin only)
const CmsLayout = lazy(() => import("./pages/cms/CmsLayout"));
const CmsDashboard = lazy(() => import("./pages/cms/CmsDashboard"));
const SiteSettingsManager = lazy(() => import("./pages/cms/SiteSettingsManager"));
const HomeManager = lazy(() => import("./pages/cms/HomeManager"));
const AboutManager = lazy(() => import("./pages/cms/AboutManager"));
const EventsManager = lazy(() => import("./pages/cms/EventsManager"));
const GalleryManager = lazy(() => import("./pages/cms/GalleryManager"));
const ContactManager = lazy(() => import("./pages/cms/ContactManager"));
const MessagesInbox = lazy(() => import("./pages/cms/MessagesInbox"));

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
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/" element={<Hero />} />
              <Route path="/onboarding" element={<Hero />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<EnhancedLoginPage />} />
              {/* The login page has linked to /forgot-password all along;
                  neither route existed, so it fell through to the 404 page. */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/register" element={<MemberRegister />} />

              {/* Member Routes */}
              <Route path="/member/dashboard" element={<MemberDashboard />} />
              <Route path="/member/unpaid-dashboard" element={<UnpaidDashboard />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/member/profile-view" element={<ProfileView />} />
              <Route path="/member/profile" element={<MemberProfile />} />
              <Route path="/member/settings" element={<MemberSettings />} />
              <Route path="/member/certificate/:kind" element={<CertificatePage />} />
              <Route path="/member/forms/personal" element={<PersonalForm />} />
              <Route path="/member/forms/business" element={<BusinessForm />} />
              <Route path="/member/forms/financial" element={<FinancialForm />} />
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

              {/* State Admin Routes */}
              <Route path="/state-admin/dashboard" element={<StateDashboard />} />
              <Route path="/state-admin/approvals" element={<StateApprovals />} />
              <Route path="/state-admin/applications" element={<StateApprovals />} />
              <Route path="/state-admin/members" element={<StateMembers />} />
              <Route path="/state-admin/settings" element={<StateSettings />} />

              {/* Super Admin Routes */}
              <Route path="/super-admin/dashboard" element={<SuperHub />} />
              <Route path="/super-admin/approvals" element={<SuperApprovals />} />
              <Route path="/super-admin/applications" element={<SuperApprovals />} />
              <Route path="/super-admin/members" element={<SuperMembers />} />
              <Route path="/super-admin/settings" element={<SuperSettings />} />
              {/* Mobile has ManageAdminsScreen; the website declared every
                  endpoint for it and never had a page. */}
              <Route path="/super-admin/admins" element={<SuperManageAdmins />} />
              {/* Events is a TAB of the super-admin section on mobile. Linking
                  at /cms/events dropped the administrator into the CMS shell. */}
              <Route path="/super-admin/events" element={<SuperEvents />} />

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
                <Route path="contact" element={<ContactManager />} />
                <Route path="messages" element={<MessagesInbox />} />
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