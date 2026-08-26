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
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Whether the signed-in user is a member with a profile to load.
 *
 * The four member-profile endpoints are scoped to the caller's own record, so
 * for an admin there is nothing to return and the API answers 404. Checking the
 * role here keeps those requests from being made at all, rather than firing
 * them on every page and discarding the failures.
 */
const isMemberSession = () => isAuthenticated() && getStoredRole() === 'member';

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

      if (isDoingBusiness && financial?.panNumber) completed.push('Financial Details');
      if (declaration?.agreeToDeclaration) completed.push('Declaration');

      // Once the application is in, or the membership is paid, the profile is
      // done by definition — the forms are locked and cannot be added to.
      const hasSubmitted = !!(application && (application._id || application.id || application.status));
      const isPaid = ['approved', 'active'].includes(String(profile?.membershipStatus || '').toLowerCase());

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

  useEffect(() => {
    loadProfileCompletion();
    loadUpcomingEvents();
    loadHelpMessages();

    // Listen for updates
    const handleProfileUpdate = () => loadProfileCompletion();
    const handleEventsUpdate = () => loadUpcomingEvents();
    const handleHelpUpdate = () => loadHelpMessages();

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('formSubmitted', handleProfileUpdate);
    window.addEventListener('eventsUpdated', handleEventsUpdate);
    window.addEventListener('helpUpdated', handleHelpUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('formSubmitted', handleProfileUpdate);
      window.removeEventListener('eventsUpdated', handleEventsUpdate);
      window.removeEventListener('helpUpdated', handleHelpUpdate);
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
