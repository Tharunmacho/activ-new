import {
  apiFetch,
  listEvents,
  getMyProfile,
  getBusinessInfo,
  getFinancialInfo,
  getDeclarationInfo,
  getMyApplication,
  getStoredRole,
  isAuthenticated,
} from "@/services/activApi";
import { SESSION_EVENT } from "@/services/api";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/** The roles that have an admin dashboard instead of a member profile. */
const ADMIN_ROLES = ['block_admin', 'district_admin', 'state_admin', 'super_admin', 'cms_admin', 'admin'];

/**
 * Whether the signed-in user is a member with a profile to load.
 *
 * The four member-profile endpoints are scoped to the caller's own record, so
 * for an admin there is nothing to return and the API answers 404. Checking the
 * role here keeps those requests from being made at all, rather than firing
 * them on every page and discarding the failures.
 *
 * Asked as "not an admin" rather than `=== 'member'`, because that exact match
 * is what broke. The backend used to overwrite a member's role with their
 * declared member type, so accounts that had submitted an application signed
 * back in as role 'business' — not an admin, but not the literal string either.
 * This provider then returned early for a perfectly ordinary member and the
 * completion bar sat at 0% for the whole session. The backend no longer writes
 * that, but a stored session from before the fix still carries it, and any role
 * this list does not name belongs to someone with a member profile.
 */
const isMemberSession = () =>
  isAuthenticated() && !ADMIN_ROLES.includes(String(getStoredRole() || '').toLowerCase());

interface ProfileContextType {
  profileCompletion: number;
  formsCompleted: string[];
  totalFormsRequired: number;
  memberType: string;
  isFullyCompleted: boolean;
  upcomingEventsCount: number;
  unreadHelpMessages: number;
  refreshProfile: () => void;
  refreshEvents: () => void;
  refreshHelp: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider: React.FC<ProfileProviderProps> = ({ children }) => {
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [formsCompleted, setFormsCompleted] = useState<string[]>([]);
  const [totalFormsRequired, setTotalFormsRequired] = useState(4);
  const [memberType, setMemberType] = useState('Standard');
  const [isFullyCompleted, setIsFullyCompleted] = useState(false);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [unreadHelpMessages, setUnreadHelpMessages] = useState(0);

  /**
   * How much of the four-form profile is done.
   *
   * Every field test here was wrong before: it looked for `name`, `pan`,
   * `declarationAccepted` and `doingBusiness === 'yes'`, while the backend
   * returns `fullName`, `panNumber`, `agreeToDeclaration` and a BOOLEAN
   * `doingBusiness`. Nothing errored — the checks simply never matched, so the
   * bar sat at the same figure no matter how much the member filled in.
   */
  const loadProfileCompletion = async () => {
    // A token alone is not enough. This provider wraps the whole app, public
    // pages included, so it also runs for a signed-in admin — and an admin has
    // no member profile, so all four requests below answer 404 "Profile not
    // found". That is the backend behaving correctly; asking at all is the bug.
    if (!isMemberSession()) return;

    try {
      const [profile, business, financial, declaration, application] = await Promise.all([
        getMyProfile().catch(() => ({} as any)),
        getBusinessInfo().catch(() => ({} as any)),
        getFinancialInfo().catch(() => ({} as any)),
        getDeclarationInfo().catch(() => ({} as any)),
        getMyApplication().catch(() => null),
      ]);

      const completed: string[] = [];

      if (profile?.fullName) completed.push('Personal Details');

      // A boolean, not the string 'yes'. An aspirant declares no business and
      // is not asked for financial details, so their profile is three forms.
      const isDoingBusiness = business?.doingBusiness === true;
      if (business && business.doingBusiness !== null && business.doingBusiness !== undefined) {
        completed.push('Business Details');
      }
      const totalForms = isDoingBusiness ? 4 : 3;

      /**
       * "Has the financial form been submitted", not "is the PAN filled in".
       *
       * This tested `financial?.panNumber`. PAN is optional on both financial
       * forms — mobile only validates it `if (formData.panNumber)`, and neither
       * website form marks it required — so a member could complete the whole
       * step with GST, turnover, ITR and schemes and still never have it count.
       * Their profile would sit at 75% permanently with nothing left to fill in
       * and no way to reach 100%.
       *
       * `updateMember` sets `status: 'submitted'` on the financial record every
       * time that step saves, so it is the signal that actually means what this
       * check is asking.
       */
      /**
       * Submitted **or beyond**, not the literal string 'submitted'.
       *
       * `updateMember` writes 'submitted' when the step saves, but an admin
       * review moves it on to 'verified' and then 'approved'. Testing one exact
       * value meant a member whose financial details had been verified stopped
       * counting as having filled them in, so their profile fell back a quarter
       * after an admin acted on it — the opposite direction to the one the bar
       * is supposed to move.
       */
      const SUBMITTED_OR_BEYOND = ['submitted', 'verified', 'approved', 'completed'];
      const isSubmitted = (value: unknown) =>
        SUBMITTED_OR_BEYOND.includes(String(value || '').toLowerCase());

      if (isDoingBusiness && isSubmitted(financial?.status)) completed.push('Financial Details');
      if (declaration?.agreeToDeclaration || isSubmitted(declaration?.status)) completed.push('Declaration');

      // Once the application is in, or the membership is paid, the profile is
      // done by definition — the forms are locked and cannot be added to.
      const hasSubmitted = !!(application && (application._id || application.id || application.status));
      // Paid means paid. `approved` is the application's approval, not the
      // payment — see `getPaymentStatus()`. It is irrelevant to the figure
      // anyway, since `hasSubmitted` already covers an approved application.
      const isPaid = ['active', 'completed'].includes(String(profile?.membershipStatus || '').toLowerCase());

      const percentage = hasSubmitted || isPaid
        ? 100
        : Math.min(100, Math.round((completed.length / totalForms) * 100));

      setProfileCompletion(percentage);
      setFormsCompleted(completed);
      setTotalFormsRequired(totalForms);
      setMemberType(isDoingBusiness ? 'Business' : 'Standard');
      setIsFullyCompleted(percentage === 100);

      localStorage.setItem('profileCompletion', String(percentage));
    } catch (error) {
      console.error('Error loading profile completion:', error);
    }
  };

  const loadUpcomingEvents = async () => {
    // `GET /events` requires a token, and the count it feeds is only ever drawn
    // in member navigation. On a public page it is a guaranteed 401 for a
    // number nothing renders.
    if (!isMemberSession()) return;

    // Real events from the backend. Three hardcoded dates stood here, so the
    // badge counted fiction and never changed when an event was published.
    try {
      const events = await listEvents();
      const list = Array.isArray(events) ? events : (events as any)?.events || [];
      const today = new Date();
      const upcoming = list.filter((e: any) => e?.startAt && new Date(e.startAt) > today);

      setUpcomingEventsCount(upcoming.length);
      localStorage.setItem('upcomingEventsCount', String(upcoming.length));
    } catch (error) {
      // A failure must not blank a count the user is already looking at.
      console.warn('Could not load events:', error);
    }
  };

  const loadHelpMessages = () => {
    // Count unread help messages (mock - can be replaced with API call)
    const unread = parseInt(localStorage.getItem('unreadHelpMessages') || '0');
    setUnreadHelpMessages(unread);
  };

  /** Back to nothing, so one member's figures never show under another name. */
  const resetProfile = () => {
    setProfileCompletion(0);
    setFormsCompleted([]);
    setTotalFormsRequired(4);
    setMemberType('Standard');
    setIsFullyCompleted(false);
    setUpcomingEventsCount(0);
    try { localStorage.removeItem('profileCompletion'); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadProfileCompletion();
    loadUpcomingEvents();
    loadHelpMessages();

    // Listen for updates
    const handleProfileUpdate = () => loadProfileCompletion();
    const handleEventsUpdate = () => loadUpcomingEvents();
    const handleHelpUpdate = () => loadHelpMessages();

    /**
     * The signed-in identity changed.
     *
     * This provider wraps the router, so it mounts once for the life of the
     * tab. Signing in is a `navigate()` with no page reload, so by then the
     * effect above had already run — on the login page, with no token. It
     * returned early, and nothing re-ran it: the member saw 0% and "Complete
     * Your Profile" for the whole session however much was actually stored for
     * them, and only a hard refresh put the real figure on screen.
     */
    const handleSessionChange = () => {
      if (isMemberSession()) {
        loadProfileCompletion();
        loadUpcomingEvents();
      } else {
        resetProfile();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('formSubmitted', handleProfileUpdate);
    window.addEventListener('eventsUpdated', handleEventsUpdate);
    window.addEventListener('helpUpdated', handleHelpUpdate);
    window.addEventListener(SESSION_EVENT, handleSessionChange);
    // Another tab signed in or out against the same storage.
    window.addEventListener('storage', handleSessionChange);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('formSubmitted', handleProfileUpdate);
      window.removeEventListener('eventsUpdated', handleEventsUpdate);
      window.removeEventListener('helpUpdated', handleHelpUpdate);
      window.removeEventListener(SESSION_EVENT, handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  const value: ProfileContextType = {
    profileCompletion,
    formsCompleted,
    totalFormsRequired,
    memberType,
    isFullyCompleted,
    upcomingEventsCount,
    unreadHelpMessages,
    refreshProfile: loadProfileCompletion,
    refreshEvents: loadUpcomingEvents,
    refreshHelp: loadHelpMessages,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
