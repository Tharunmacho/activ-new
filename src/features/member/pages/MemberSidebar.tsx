import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { FaHome, FaSearch, FaUser, FaClipboardList, FaQuestionCircle, FaCalendarAlt, FaSignOutAlt, FaTimes, FaBriefcase, FaCog } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/contexts/ProfileContext';
import { apiFetch, getPaymentStatus, getMyApplication } from "@/services/activApi";
import {
    NO_ACCESS,
    deriveMemberAccess,
    unlockedNav,
    upcomingFeatures,
    type MemberAccess,
} from '@/features/member/memberAccess';
import { FaFileAlt, FaEnvelope, FaBullhorn, FaLock, FaArrowRight } from 'react-icons/fa';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export default function MemberSidebar({ isOpen, onClose }: Props) {
    const location = useLocation();
    // Initialize state with localStorage values immediately to avoid showing default "Member"
    const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
    const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "");
    const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("userProfilePhoto") || "");
    const [organizationName, setOrganizationName] = useState(() => localStorage.getItem("userOrganization") || "");
    const [paymentStatus, setPaymentStatus] = useState(() => localStorage.getItem("paymentStatus") || "pending");
    const [hasBusinessAccount, setHasBusinessAccount] = useState(false);
    const navigate = useNavigate();
    const { profileCompletion, upcomingEventsCount, unreadHelpMessages } = useProfile();

    // Refresh data from localStorage whenever location changes (no API calls)
    useEffect(() => {
        /*
         * Only fill from storage, never blank from it.
         *
         * This runs on every navigation and used to assign whatever localStorage
         * held - including the empty string, straight over a name the profile
         * fetch had just put in state. On a fresh account, where storage is
         * empty by definition, that is a race the API always loses.
         */
        const fill = (value: string, set: (v: string) => void) => {
            if (value) set(value);
        };

        fill(localStorage.getItem('userName') || '', setUserName);
        fill(localStorage.getItem('userEmail') || '', setUserEmail);
        fill(localStorage.getItem('userProfilePhoto') || '', setProfilePhoto);
        fill(localStorage.getItem('userOrganization') || '', setOrganizationName);
        setPaymentStatus(localStorage.getItem('paymentStatus') || 'pending');
    }, [location.pathname]);

    useEffect(() => {
        // Fetch user data from backend with caching
        const fetchUserData = async () => {
            const token = localStorage.getItem("token");
            if (!token) {
                // Fallback to localStorage if no token
                const storedUserName = localStorage.getItem("userName");
                if (storedUserName) {
                    setUserName(storedUserName);
                }
                return;
            }

            /*
             * No hand-rolled cache stamp here any more.
             *
             * It existed to stop this fetch running on every navigation, which
             * `apiFetch` now does properly: identical GETs share one request and
             * a completed one is reusable for a few seconds, keyed on the token
             * so it can never be served to a different account. The stamp could,
             * because it was a bare timestamp in localStorage that outlived the
             * session it described - so registering a second account within two
             * minutes made the new session skip its own profile fetch.
             */
            try {
                const response = await apiFetch("/members/my-profile", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        setUserName(result.data.fullName || "");
                        setUserEmail(result.data.email || "");
                        // Only update photo if API has one, otherwise keep localStorage value
                        // No photo on the profile leaves the localStorage copy
                        // in place; blanking it would drop the avatar on every
                        // load for an account whose photo simply is not synced.
                        if (result.data.profilePhoto) {
                            setProfilePhoto(result.data.profilePhoto);
                            localStorage.setItem("userProfilePhoto", result.data.profilePhoto);
                        }
                        // Update localStorage
                        localStorage.setItem("userName", result.data.fullName || "");
                        localStorage.setItem("userEmail", result.data.email || "");
                    }
                }

                // Fetch active company to get company name
                const companyResponse = await apiFetch("/business-profiles/me", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (companyResponse.ok) {
                    const companyResult = await companyResponse.json();
                    if (companyResult.success && companyResult.data && companyResult.data.businessName) {
                        setOrganizationName(companyResult.data.businessName);
                        localStorage.setItem("userOrganization", companyResult.data.businessName);
                    }
                }

                // Fetch application to get payment status
                const appResponse = await apiFetch("/applications/my-applications", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (appResponse.ok) {
                    const appResult = await appResponse.json();
                    if (appResult.success && appResult.data) {
                        setPaymentStatus(await getPaymentStatus() || "pending");
                        localStorage.setItem("paymentStatus", await getPaymentStatus() || "pending");
                    }
                } else {
                    // Check localStorage fallback
                    const storedStatus = localStorage.getItem("paymentStatus");
                    if (storedStatus) {
                        setPaymentStatus(storedStatus);
                    }
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                // Fallback to localStorage
                const storedUserName = localStorage.getItem("userName");
                const storedUserEmail = localStorage.getItem("userEmail");
                const storedOrg = localStorage.getItem("userOrganization");
                const storedStatus = localStorage.getItem("paymentStatus");
                if (storedUserName) {
                    setUserName(storedUserName);
                }
                if (storedUserEmail) {
                    setUserEmail(storedUserEmail);
                }
                if (storedOrg) {
                    setOrganizationName(storedOrg);
                }
                if (storedStatus) {
                    setPaymentStatus(storedStatus);
                }
            }
        };

        fetchUserData();

        // Listen for profile updates
        const handleProfilePhotoUpdate = () => {
            const photo = localStorage.getItem('userProfilePhoto') || '';
            setProfilePhoto(photo);
        };

        const handleUserDataUpdate = () => {
            // Update from localStorage immediately
            const name = localStorage.getItem('userName') || '';
            const email = localStorage.getItem('userEmail') || '';
            const photo = localStorage.getItem('userProfilePhoto') || '';
            const org = localStorage.getItem('userOrganization') || '';
            
            
            setUserName(name);
            setUserEmail(email);
            setProfilePhoto(photo);
            setOrganizationName(org);
            // Also refetch from API
            fetchUserData();
        };

        const handleCompanyUpdate = () => {
            const org = localStorage.getItem('userOrganization') || '';
            setOrganizationName(org);
            // Also refetch from API
            fetchUserData();
        };

        window.addEventListener('profilePhotoUpdated', handleProfilePhotoUpdate);
        window.addEventListener('userDataUpdated', handleUserDataUpdate);
        window.addEventListener('companyUpdated', handleCompanyUpdate);

        return () => {
            window.removeEventListener('profilePhotoUpdated', handleProfilePhotoUpdate);
            window.removeEventListener('userDataUpdated', handleUserDataUpdate);
            window.removeEventListener('companyUpdated', handleCompanyUpdate);
        };
    }, []);

    useEffect(() => {
        const checkBusinessAccount = async () => {
            const token = localStorage.getItem("token");
            if (!token) return;

            try {
                const response = await apiFetch("/business-profiles/me", {
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        setHasBusinessAccount(true);
                    } else {
                        setHasBusinessAccount(false);
                    }
                }
            } catch (error) {
                console.error("Error checking business account in sidebar:", error);
            }
        };
        
        checkBusinessAccount();
    }, [location.pathname]);

    /**
     * The sidebar, built from the progressive-unlock table.
     *
     * The entries an unpaid member sees are the ones `memberAccess.MEMBER_NAV`
     * marks as always-available; the rest appear as each is earned. That table
     * is the only place the rule lives, so the sidebar and the dashboards can
     * no longer disagree about what this account may reach — which is exactly
     * what a `requirePayment` boolean maintained here used to allow.
     */
    const [application, setApplication] = useState<any>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const app = await getMyApplication().catch(() => null);
            if (!cancelled) setApplication(app);
        };

        load();

        // The same three events the membership gate listens to: submitting a
        // form or completing a payment changes what should be on screen, and a
        // sidebar that only refreshed on navigation would keep the old set.
        window.addEventListener('formSubmitted', load);
        window.addEventListener('profileUpdated', load);
        window.addEventListener('paymentCompleted', load);
        return () => {
            cancelled = true;
            window.removeEventListener('formSubmitted', load);
            window.removeEventListener('profileUpdated', load);
            window.removeEventListener('paymentCompleted', load);
        };
    }, []);

    const access: MemberAccess = useMemo(
        () => deriveMemberAccess(profileCompletion, application, paymentStatus === 'completed'),
        [profileCompletion, application, paymentStatus],
    );

    const ICONS: Record<string, JSX.Element> = {
        home: <FaHome />, user: <FaUser />, briefcase: <FaBriefcase />,
        clipboard: <FaClipboardList />, file: <FaFileAlt />, search: <FaSearch />,
        message: <FaEnvelope />, calendar: <FaCalendarAlt />, megaphone: <FaBullhorn />,
        help: <FaQuestionCircle />, settings: <FaCog />,
    };

    const badgeFor = (key: string): string | number | null => {
        if (key === 'profile') return profileCompletion < 100 ? `${profileCompletion}%` : null;
        if (key === 'messages') return unreadHelpMessages > 0 ? unreadHelpMessages : null;
        if (key === 'events') return upcomingEventsCount > 0 ? upcomingEventsCount : null;
        return null;
    };

    const filteredNav = useMemo(
        () => unlockedNav(access).map(item => ({
            key: item.key,
            label: item.label,
            to: typeof item.to === 'function'
                ? item.to({ hasBusinessAccount, membershipActive: access.membershipActive })
                : String(item.to),
            icon: ICONS[item.icon] || <FaHome />,
            badge: badgeFor(item.key),
        })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [access, hasBusinessAccount, profileCompletion, unreadHelpMessages, upcomingEventsCount],
    );

    const upcoming = useMemo(() => upcomingFeatures(access), [access]);


    const handleLogout = () => {
        // Clear all user-related localStorage data
        localStorage.removeItem("token");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userProfilePhoto");
        localStorage.removeItem("userOrganization");
        localStorage.removeItem("paymentStatus");
        localStorage.removeItem("memberId");
        localStorage.removeItem("userFirstName");
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("cart");
        
        // Clear state
        setUserName("");
        setUserEmail("");
        setProfilePhoto("");
        setOrganizationName("");
        setPaymentStatus("pending");
        
        navigate("/login");
        onClose();
    };

    // Sidebar content component (reused for both mobile and desktop)
    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            {/*
              * The mark, centred, and nothing else.
              *
              * The mark, centred, with the signed-in account under it.
              */}
            <div className="px-4 py-6 border-b flex-shrink-0 relative">
                <Link
                    to={paymentStatus === 'completed' ? '/payment/member-dashboard' : '/member/unpaid-dashboard'}
                    onClick={onClose}
                    className="flex items-center justify-center"
                >
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt="ACTIV"
                        className="h-9 w-auto object-contain"
                    />
                </Link>

                {/*
                  * Who is signed in, directly under the mark.
                  *
                  * The page header that used to carry this is gone, so without
                  * it the member area never says whose account is open. It is a
                  * link because "that is me" and "let me look at me" are the
                  * same instinct.
                  */}
                <Link
                    to="/member/profile-view"
                    onClick={onClose}
                    className="mt-4 flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors"
                >
                    {profilePhoto ? (
                        <img
                            src={profilePhoto}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-100 shrink-0"
                        />
                    ) : (
                        <span className="w-9 h-9 rounded-full shrink-0 bg-blue-600 text-white
                                         flex items-center justify-center text-xs font-bold">
                            {(userName || 'M').split(' ').filter(Boolean).slice(0, 2)
                                .map(n => n[0]).join('').toUpperCase()}
                        </span>
                    )}
                    <span className="min-w-0 flex items-center">
                        <span className="block text-sm font-bold text-gray-900 truncate leading-tight">
                            {userName || 'Member'}
                        </span>

                    </span>
                </Link>

                {/* Close button only visible on mobile */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="lg:hidden absolute right-2 top-1/2 -translate-y-1/2"
                >
                    <FaTimes className="h-5 w-5" />
                </Button>
            </div>

            <nav className="p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain member-rail-scroll">
                {filteredNav.map((item) => {
                    const active = location.pathname === item.to;
                    return (
                        <Link
                            key={item.key}
                            to={item.to}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                                active
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-700 hover:bg-gray-100'
                            }`}
                            onClick={onClose}
                        >
                            <span className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-500'}`}>
                                {item.icon}
                            </span>
                            <span className="font-medium flex-1">{item.label}</span>
                            {item.badge !== undefined && item.badge !== null && (
                                <Badge
                                    className={`${active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'} h-5 min-w-5 flex items-center justify-center px-1.5 text-xs font-bold`}
                                >
                                    {item.badge}
                                </Badge>
                            )}
                        </Link>
                    );
                })}

                {/*
                  * What is still ahead, as readable text rather than dead links.
                  *
                  * Two kinds of entry land here: the ones this member has not
                  * earned yet, and the ones whose screen does not exist yet.
                  * Both are things they cannot open, and both are worth seeing -
                  * the same argument as the read-only benefits panel on the
                  * dashboard. A greyed-out row that does nothing when clicked
                  * reads as a broken link; a named upcoming feature reads as a
                  * reason to carry on.
                  *
                  * It sits directly under Help & Support because that is the
                  * one entry a member always has, and the list answers the
                  * question support would otherwise be asked: what else is
                  * there, and how do I get it?
                  */}
                {upcoming.length > 0 && (
                    <div className="mt-4 mx-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-gray-500 mb-2.5">
                            <FaLock className="h-3 w-3" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide">
                                Upcoming Features
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {upcoming.map(item => (
                                <li key={item.key} className="flex items-start gap-2.5">
                                    <span className="w-4 h-4 text-gray-400 mt-0.5 shrink-0">
                                        {ICONS[item.icon]}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-xs font-medium text-gray-600 leading-tight">
                                            {item.label}
                                        </span>
                                        <span className="block text-[10px] text-gray-400 leading-tight mt-0.5">
                                            {item.requirement}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

</nav>

            <div className="p-2 border-t flex-shrink-0">
                <Button variant="ghost" onClick={handleLogout} className="w-full flex items-center gap-2 text-red-600 hover:bg-red-50 p-3">
                    <FaSignOutAlt className="w-5 h-5" />
                    <span>Log out</span>
                </Button>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop/Tablet: Permanent Sidebar - Always visible on md screens and above */}
            <div className="hidden lg:flex lg:flex-col lg:w-[288px] xl:w-[304px] bg-white border-r h-screen sticky top-0">
                <SidebarContent />
            </div>

            {/* Mobile: Slide-out Menu - Only on small screens */}
            {isOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black opacity-50" onClick={onClose}></div>
                    <div className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[304px] bg-white flex flex-col shadow-2xl">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    );
}
