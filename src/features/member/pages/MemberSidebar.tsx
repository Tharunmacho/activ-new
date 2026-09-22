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
    type MemberAccess,
} from '@/features/member/memberAccess';
import { FaFileAlt, FaEnvelope, FaBullhorn, FaArrowRight, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

/**
 * How the rail groups its entries.
 *
 * PRESENTATION ONLY. Every entry, link, badge and unlock rule is exactly as
 * `unlockedNav` returns it — this decides which heading an entry is printed
 * under and nothing else. An entry whose key is in no group would simply not
 * render, so the last group is a catch-all rather than a list.
 *
 * Three groups because eight entries in one run is the length at which a list
 * stops being scannable, which is the problem the reference rail solves with
 * WORKSPACE / GENERAL / TOOLS.
 */
const NAV_GROUPS: { label: string; keys: string[] }[] = [
    { label: 'Overview', keys: ['dashboard'] },
    { label: 'My account', keys: ['profile', 'business', 'application'] },
    /* `messages` last, matching its place in `MEMBER_NAV`. A key missing from
       this list is an entry the sidebar simply does not draw — so adding one
       to the table without adding it here is how a new rail entry goes
       missing with nothing reporting it. */
    { label: 'Association', keys: ['explore', 'events', 'updates', 'messages'] },
    { label: 'Support', keys: ['help', 'settings'] },
];

export default function MemberSidebar({ isOpen, onClose }: Props) {
    const location = useLocation();
    // Initialize state with localStorage values immediately to avoid showing default "Member"
    /**
     * Whether the rail is collapsed to icons.
     *
     * Remembered, because it is a preference about how someone likes to work
     * and not a per-page choice — collapsing it on one screen and finding it
     * expanded again on the next is the behaviour that makes people stop using
     * a collapse control at all. Read defensively: a private window throws on
     * , and the rail must still render.
     */
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem('activ:railCollapsed') === '1'; } catch { return false; }
    });

    useEffect(() => {
        try { localStorage.setItem('activ:railCollapsed', collapsed ? '1' : '0'); } catch { /* storage unavailable */ }
    }, [collapsed]);

    /**
     * The page behind the open drawer does not scroll.
     *
     * Without it a finger drag scrolls the dashboard underneath a rail that
     * stays put, which reads as the menu having come loose from the page. The
     * previous value is restored rather than assumed to be `''`.
     */
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
    const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "");
    const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem("userProfilePhoto") || "");
    const [organizationName, setOrganizationName] = useState(() => localStorage.getItem("userOrganization") || "");
    const [paymentStatus, setPaymentStatus] = useState(() => localStorage.getItem("paymentStatus") || "pending");
    const [hasBusinessAccount, setHasBusinessAccount] = useState(false);
    const navigate = useNavigate();
    const { profileCompletion, unreadHelpMessages } = useProfile();

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

        /*
         * THE SAME RULE, AND THIS LINE WAS THE ONE BREAKING IT.
         *
         * It read `localStorage.getItem('paymentStatus') || 'pending'` and
         * assigned it — so on every navigation a paid member whose mirror was
         * absent or stale was reset to `pending`. `access.membershipActive` is
         * `paymentStatus === 'completed'`, so the rail collapsed to the unpaid
         * set on every click and came back when the fetch caught up. That is
         * the flicker: entries locked on the membership — Member Directory and
         * Messages — disappearing and returning as the member walked around
         * their own dashboard.
         *
         * Fill, never blank, exactly as the comment above this block says: a
         * stored `completed` is adopted, anything else leaves whatever the API
         * resolved in place.
         */
        if (localStorage.getItem('paymentStatus') === 'completed') {
            setPaymentStatus('completed');
        }
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

        /*
         * ONCE, and again when a company actually changes.
         *
         * This was keyed on `location.pathname`, so `/business-profiles/me`
         * was re-requested on every navigation — and `setHasBusinessAccount`
         * is only called inside `if (response.ok)`, so a slow or failed reply
         * left the Business Account entry drawn from whatever the previous
         * page had decided.
         *
         * A business account does not appear or vanish because somebody
         * clicked Events. `companyUpdated` is the event that changes the
         * answer, and this component already listens to it elsewhere.
         */
        window.addEventListener('companyUpdated', checkBusinessAccount);
        return () => window.removeEventListener('companyUpdated', checkBusinessAccount);
    }, []);

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

    /*
     * No Messages badge here any more.
     *
     * Messages is not a rail entry — it lives in the icon strip at the top of
     * the member area, which carries its own unread count. See `MemberTopBar`.
     */
    /**
     * The one badge worth carrying: how far the profile is from done.
     *
     * The events count came off. A number beside Events reads as "5 things need
     * you", the way an unread count does everywhere else — but it was the count
     * of forthcoming events, which is a fact about the calendar and not a task.
     * It never went down as a result of anything the member did, so it sat there
     * permanently asking for attention it did not need.
     *
     * The profile percentage stays because it IS a task, and it does go down.
     */
    const badgeFor = (key: string): string | number | null => {
        if (key === 'profile') return profileCompletion < 100 ? `${profileCompletion}%` : null;
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
        [access, hasBusinessAccount, profileCompletion, unreadHelpMessages],
    );



    /**
     * The entries, bucketed under their headings — AND NOTHING DROPPED.
     *
     * The grouping is a lookup by key, so an entry whose key is in no group
     * would simply never render: a navigation item silently disappearing
     * because somebody added it to the nav data and not to the groups here.
     * Anything unclaimed falls into the last group instead, which makes the
     * failure visible in the wrong place rather than invisible everywhere.
     */
    const navGroups = useMemo(() => {
        const claimed = new Set(NAV_GROUPS.flatMap(g => g.keys));
        const orphans = filteredNav.filter(item => !claimed.has(item.key));

        return NAV_GROUPS.map((group, i) => ({
            label: group.label,
            entries: [
                ...filteredNav.filter(item => group.keys.includes(item.key)),
                ...(i === NAV_GROUPS.length - 1 ? orphans : []),
            ],
        })).filter(group => group.entries.length > 0);
    }, [filteredNav]);

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
            {/*
              THE BRAND AND THE ACCOUNT ARE TWO BLOCKS, as on the admin rail.

              They were one padded box with the mark centred and the account
              tucked under it at a smaller size, so the two sat at different
              optical weights and the rule between the rail's header and its nav
              fell in a different place from the admin rail's. One product, two
              rails, one arrangement:

                  p-4 md:p-6 · centred mark      · border-b
                  p-4 md:p-6 · avatar + identity · border-b

              The avatar grows to 48px to match, and the account gains a second
              line — the admin rail says "Block Admin" under the name, and the
              member rail said nothing, which left the block looking unfinished
              rather than deliberately sparse.
            */}
            {/*
              THE MARK, CENTRED — as in the reference rail.

              The close button is taken out of the row and positioned instead, so
              the mark centres on the RAIL rather than on the space left over
              beside a button: with both in the flow, an invisible 40px button on
              one side pushes the logo 20px off centre on desktop, which is the
              kind of thing that reads as carelessness without being nameable.
            */}
            <div className={`relative h-[5.5rem] bg-white border-b border-slate-200 flex-shrink-0
                            flex items-center justify-center ${collapsed ? 'px-2' : 'px-6'}`}>
                <Link
                    to={paymentStatus === 'completed' ? '/payment/member-dashboard' : '/member/unpaid-dashboard'}
                    onClick={onClose}
                    className="flex items-center justify-center"
                >
                    <img
                        src="/logo_ACTIVian-removebg-preview.png"
                        alt="ACTIV"
                        className={`w-auto object-contain ${collapsed ? 'h-8' : 'h-12'}`}
                    />
                </Link>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                    <FaTimes className="h-5 w-5" />
                </Button>
            </div>




            {/*
              THE RAIL, ON THE REFERENCE'S TERMS.

              Three things separated ours from it, and all three were about
              weight rather than layout:

                GROUPS. The reference breaks eight entries into named sections —
                  WORKSPACE, GENERAL, TOOLS — so the list is read as three short
                  lists instead of one long one. Ours was a flat run of eight,
                  which is the length at which a list stops being scannable.

                TYPE. Ours was 16px semibold; the reference is 14px medium. At
                  16px every entry competes with the page title beside it, and
                  the rail reads as the loudest thing on screen rather than as
                  the quiet index it is.

                THE ACTIVE STATE. Ours was a solid blue bar the full width of the
                  rail — the heaviest element in the whole window, for a label
                  saying where you already are. The reference tints it instead
                  and marks it with a rule on the leading edge: unmistakable, and
                  it does not shout.

              The groups are declared here rather than on the nav data because
              they are a property of this rail's presentation; the same entries
              are ordered differently on mobile.
            */}
            <nav className="p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain member-rail-scroll">
                {navGroups.map((group) => {
                    const entries = group.entries;
                    // A group whose entries are all still locked prints nothing —
                    // a heading over an empty list is worse than no heading.
                    if (!entries.length) return null;

                    return (
                        /* No card around a group: the rail is one white surface,
                           and the headings do the separating. */
                        <div key={group.label} className="mb-5 last:mb-0">
                            {/*
                              The headings in the product accent.
                              
                              Grey made these four labels the quietest thing in the rail,
                              which is wrong: they are the only wayfinding it has.
                              The accent blue is what every other emphasis in the
                              product uses, so the rail stays on one palette.
                            */}
                            <div className={`mb-2 flex items-center gap-2 ${collapsed ? 'px-0 justify-center' : 'px-3.5'}`}>
                                {!collapsed && (
                                    <p className="flex-1 min-w-0 text-[1rem] font-bold uppercase
                                                  tracking-[0.06em] text-slate-900 truncate">
                                        {group.label}
                                    </p>
                                )}

                                {/*
                                  THE COLLAPSE CONTROL, on the first heading only —
                                  where the reference puts it.

                                  It is a real toggle rather than the decorative
                                  chevron it would have been easier to draw: the
                                  rail is 288px of a 1440px window, and a member
                                  reading a directory or a long form wants that
                                  back. Collapsed, the entries keep their icons and
                                  their titles, so nothing becomes unreachable —
                                  only unlabelled.

                                  Desktop only. Below `lg` the rail is a slide-over
                                  and the close button in the brand row already
                                  dismisses it; a second control that shrinks a
                                  panel which is about to be dismissed is two
                                  answers to one question.
                                */}
                                {group === navGroups[0] && (
                                    <button
                                        type="button"
                                        onClick={() => setCollapsed(c => !c)}
                                        aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
                                        title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
                                        className="hidden lg:flex w-6 h-6 shrink-0 items-center justify-center
                                                   rounded-md text-slate-400 transition-colors
                                                   hover:bg-slate-100 hover:text-slate-700"
                                    >
                                        {collapsed ? <FaChevronRight className="w-3 h-3" /> : <FaChevronLeft className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-0.5">
                                {entries.map((item) => {
                                    const active = location.pathname === item.to;
                                    return (
                                        <Link
                                            key={item.key}
                                            to={item.to}
                                            title={item.label}
                                            className={`relative flex items-center gap-3.5 py-3.5 rounded-xl
                                                        text-[1.375rem] transition-colors
                                                        ${collapsed ? 'px-0 justify-center' : 'px-3.5'} ${
                                                active
                                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                                    : 'text-slate-600 font-normal hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                            onClick={onClose}
                                        >
                                            {/* The rule on the leading edge. Inset
                                                so it reads as marking the row, not
                                                as a border on it. */}
                                            {active && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2
                                                                 h-6 w-1 rounded-r-full bg-blue-600" />
                                            )}

                                            <span className={`w-5 h-5 flex items-center
                                                              justify-center shrink-0 ${
                                                active ? 'text-blue-600' : 'text-slate-400'
                                            }`}>
                                                {item.icon}
                                            </span>

                                            {!collapsed && <span className="flex-1 min-w-0 truncate">{item.label}</span>}

                                            {!collapsed && item.badge !== undefined && item.badge !== null && (
                                                <Badge
                                                    className={`h-5 min-w-5 flex items-center justify-center px-1.5
                                                                text-[1.0625rem] font-bold shrink-0 ${
                                                        active
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-blue-50 text-blue-700'
                                                    }`}
                                                >
                                                    {item.badge}
                                                </Badge>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/*
                  THE LOCKED-FEATURES LIST IS GONE FROM THE RAIL.

                  It was a dashed box under Settings listing what a member
                  cannot reach yet — the same ground the dashboard's
                  Application Status card covers, in more detail and with the
                  progress attached. Two answers to one question, and the rail's
                  was the worse of them: a navigation list is for places you can
                  go, and half of this one was places you cannot.
                */}


</nav>

            {/*
              THE ACCOUNT AND THE WAY OUT, TOGETHER AT THE FOOT — the CRM's
              arrangement.

              It sat directly under the mark before, which pushed the navigation
              a hundred pixels down the rail and put the one thing a member reads
              least often at the top of the one thing they read most. The
              reference puts identity at the bottom, in a bordered card, with
              the account action beside it — so the rail opens on the
              destinations and closes on "who am I, and how do I leave".
            */}
            <div className={`pt-3 pb-8 bg-white border-t border-slate-200 flex-shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
              <div className="relative">
                <Link
                    to="/member/profile-view"
                    onClick={onClose}
                    /* Tinted, like the reference's — a filled card under a white
                       rail reads as a distinct object, where a white one on white
                       needs its border to do all the work. */
                    className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 transition-colors
                               hover:border-slate-300 hover:bg-slate-100 ${collapsed ? 'p-2 justify-center' : 'p-3.5 pr-14'}`}
                >
                    {profilePhoto ? (
                        <img
                            src={profilePhoto}
                            alt=""
                            className="w-11 h-11 rounded-xl object-cover shrink-0"
                        />
                    ) : (
                        <span className="w-11 h-11 rounded-xl shrink-0 bg-blue-600 text-white
                                         flex items-center justify-center text-[1.1875rem] font-bold">
                            {(userName || 'M').split(' ').filter(Boolean).slice(0, 2)
                                .map(n => n[0]).join('').toUpperCase()}
                        </span>
                    )}
                    {!collapsed && (
                    <span className="min-w-0 flex-1">
                        <span className="block text-[1.125rem] font-semibold text-slate-900 truncate">
                            {userName || 'Member'}
                        </span>
                        {/*
                          THE EMAIL, as the reference card carries it.

                          "Applicant" said what kind of account this is, which the
                          rail's contents already imply — every entry a member
                          cannot reach yet is simply absent. The address says WHICH
                          account, which is the question a shared machine actually
                          raises, and it is the line the reference puts here.
                          Falls back to the role when no address is stored, so the
                          second line is never empty.
                        */}
                        <span className="block text-[1rem] text-slate-500 truncate">
                            {userEmail || (paymentStatus === 'completed' ? 'Member' : 'Applicant')}
                        </span>
                    </span>
                    )}
                </Link>

                {/*
                  SIGNING OUT MOVED INTO THE CARD, rather than out of the rail.

                  The standalone Log out button is gone, as asked — the reference
                  has no such button, and a red bar across the foot of the rail
                  was the last loud thing left in it.

                  It could not simply be deleted: this was the ONLY way a member
                  could sign out anywhere in the product, so removing it would
                  have stranded anyone on a shared machine. The reference tucks
                  the same action behind its account card; here it is the icon at
                  the card's right edge, where the chevron was. The card still
                  opens the profile — only the last 40px belong to signing out.
                */}
                <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Log out"
                    title="Log out"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-slate-400
                               transition-colors hover:bg-red-50 hover:text-red-600 ${
                        collapsed ? 'mx-auto mt-2' : 'absolute right-5 top-1/2 -translate-y-1/2'}`}
                >
                    <FaSignOutAlt className="w-4 h-4" />
                </button>
              </div>
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop/Tablet: Permanent Sidebar - Always visible on md screens and above */}
            <div className={`hidden lg:flex lg:flex-col bg-white border-r border-slate-200 h-screen sticky top-0
                            transition-[width] duration-200 ${collapsed ? 'lg:w-[5rem]' : 'lg:w-72 xl:w-80'}`}>
                <SidebarContent />
            </div>

            {/* Mobile: Slide-out Menu - Only on small screens */}
            {isOpen && (
                /*
                 * `h-[100dvh]`, not `inset-0` alone — on a phone browser the
                 * address bar collapses as the page scrolls and `100vh` is the
                 * taller of the two states, so a `vh`-sized panel overhangs the
                 * screen while the bar is showing. `dvh` is the height actually
                 * on screen, so the rail reaches the bottom edge in both.
                 */
                <div className="fixed inset-0 z-50 h-[100dvh] lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
                    <div className="absolute left-0 top-0 h-full w-[85%] max-w-[22rem] bg-white flex flex-col shadow-2xl">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    );
}
