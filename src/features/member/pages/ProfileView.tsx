import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Menu, User, Briefcase, FileText, Building2, Edit, Camera,
    CheckCircle2, Circle, ArrowRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
    getMyProfile, getBusinessInfo, getFinancialInfo, getDeclarationInfo,
    getMyApplication, uploadProfilePhoto, errorMessage,
} from "@/services/activApi";
import MemberSidebar from "./MemberSidebar";
import MemberTopBar from "@/features/member/components/MemberTopBar";
import { resolveMediaUrl } from "@/config/api.config";

import {
    ACTION_TEXT, CARD_BODY, CARD_TITLE, PAGE_SUBTITLE, PAGE_TITLE, SECTION_TITLE,
} from '@/components/layout/appTypography';
/**
 * My Profile — everything this member has filled in, whatever they have paid.
 *
 * Two things were wrong here, and both had the same shape: the member could not
 * see their own answers.
 *
 * 1. THE PAYWALL ON A READ. Business, financial and declaration were rendered
 *    only when `paymentStatus === 'completed'`, and — worse — were not even
 *    FETCHED otherwise. So an applicant who had just spent twenty minutes
 *    filling in four forms opened My Profile and saw the first one back. There
 *    is no argument for it: this is the member's own data, read-only, and
 *    hiding it does not protect anything. The genuine gate is on Settings,
 *    where those forms are locked WHILE UNDER REVIEW so a file cannot change
 *    underneath the admin reviewing it — that is about editing, not about
 *    looking, and it stays exactly as it was.
 *
 * 2. FIELDS THAT VANISHED WHEN BLANK. `InfoItem` returned `null` for a falsy
 *    value, so a section the member had completed showed only the rows that
 *    happened to be filled in. A profile that silently drops its own labels
 *    cannot be checked against the form that produced it. Every field of a
 *    completed section is now printed, with "Not provided" where the member
 *    left it empty, which is a fact rather than an absence.
 *
 * A section the member has NOT started is not padded out with fifteen empty
 * rows — it gets one card naming the form and a link into it.
 *
 * The page also refreshes on `formSubmitted` and `profileUpdated`, not only on
 * Settings' own `profileDataUpdated`. The four registration forms dispatch the
 * first of those, so submitting one and coming back here used to show the
 * previous answer until a full page reload.
 */

interface SectionState {
    /** The member has answered this form at all. */
    filled: boolean;
    label: string;
    to: string;
}

const ProfileView = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [profileImage, setProfileImage] = useState<string>("");
    const [personalData, setPersonalData] = useState<any>(null);
    const [businessData, setBusinessData] = useState<any>(null);
    /*
     * WHETHER THE SECTIONS STILL TO FILL ARE SHOWN.
     *
     * Off by default: this page is a record of what has been submitted, and a
     * dashed box for every unanswered section turns it into a list of chores.
     * The header's button turns them on when a member actually wants to add
     * something — and they are on from the start for somebody who has filled
     * nothing, since an empty page would tell them less than the prompts do.
     */
    const [financialData, setFinancialData] = useState<any>(null);
    const [declarationData, setDeclarationData] = useState<any>(null);
    /*
     * Has an application actually been LODGED?
     *
     * Not the same question as "are the forms filled in", and this page
     * used to ask only the second one. A member could have all three
     * sections saved — this page saying "3 of 3 submitted" — with no
     * Application document behind them, because saving the forms and
     * submitting the application are two different acts and only the
     * wizard's last step performs the second.
     */
    const [application, setApplication] = useState<any>(null);

    const loadProfileData = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        /*
         * All four, always, and none of them all-or-nothing.
         *
         * `allSettled` because three of these 404 or answer an empty default
         * for a member who has not reached that form yet, and neither is an
         * error. A rejected `Promise.all` would blank the page over a form the
         * member was never going to fill in.
         */
        /*
         * ==================================================================
         * THE PAGE OPENS ON THE PROFILE, NOT ON THE SLOWEST OF FIVE
         * ==================================================================
         *
         * All five still go out together — that part was right. What was wrong
         * is that the spinner stayed up until the LAST of them settled, so a
         * member waited on `getMyApplication` (which reads every application
         * they have ever filed) and on three endpoints that 404 for anybody who
         * has not reached those forms, before seeing their own name.
         *
         * The personal details are most of this page and come from the first
         * call, so it renders as soon as THAT resolves. The other four cards
         * fill in behind it; each already renders nothing until its own data
         * arrives, which is what they do for a member who has not filled them
         * in.
         */
        const started = [
            getMyProfile(),
            getBusinessInfo(),
            getFinancialInfo(),
            getDeclarationInfo(),
            // 404s until one exists, which `allSettled` treats as the answer
            // it is rather than as a failure that blanks the page.
            getMyApplication(),
        ];

        const [profile] = await Promise.allSettled([started[0]]);

        if (profile.status === 'fulfilled' && profile.value) {
            const me: any = profile.value;
            setPersonalData(me);

            /*
             * `profilePhoto` is the field this backend returns.
             *
             * This read `profileImage`, which no endpoint has ever sent, so the
             * avatar was blank for every member who had one. Both are accepted
             * now; the stored copy is the last resort so the picture does not
             * disappear while the profile call is in flight.
             */
            const photo = me.profilePhoto || me.profileImage || localStorage.getItem('userProfilePhoto') || '';
            if (photo) setProfileImage(resolveMediaUrl(photo) || photo);
        }

        /* The name and the membership are on screen from here; everything below
           fills in as it lands. */
        setLoading(false);

        const [business, financial, declaration, app] =
            await Promise.allSettled(started.slice(1));

        if (business.status === 'fulfilled') setBusinessData(business.value);
        if (financial.status === 'fulfilled') setFinancialData(financial.value);
        if (declaration.status === 'fulfilled') setDeclarationData(declaration.value);
        setApplication(app.status === 'fulfilled' ? app.value : null);
    }, [navigate]);

    useEffect(() => {
        loadProfileData();

        /*
         * Every event that can change what belongs on this page.
         *
         * `formSubmitted` is the one the four registration forms dispatch and
         * the one this page used to ignore — which is why finishing a form and
         * navigating here showed the previous answer.
         */
        const refresh = () => { loadProfileData(); };

        window.addEventListener('profileDataUpdated', refresh);
        window.addEventListener('formSubmitted', refresh);
        window.addEventListener('profileUpdated', refresh);
        window.addEventListener('paymentCompleted', refresh);

        return () => {
            window.removeEventListener('profileDataUpdated', refresh);
            window.removeEventListener('formSubmitted', refresh);
            window.removeEventListener('profileUpdated', refresh);
            window.removeEventListener('paymentCompleted', refresh);
        };
    }, [loadProfileData]);

    // ------------------------------------------------------------ completeness

    /**
     * Has this form been answered? Asked of the DATA, not of a stored flag.
     *
     * Each endpoint answers with a filled-in default object rather than 404ing,
     * so "did they fill it in" cannot be `!!businessData` — that is true for
     * everyone. It has to be a question about the values themselves.
     */
    const hasBusiness = useMemo(() => {
        if (!businessData) return false;
        return businessData.doingBusiness === true
            || businessData.doingBusiness === false
            || !!String(businessData.organizationName || '').trim();
    }, [businessData]);

    const hasFinancial = useMemo(() => {
        if (!financialData) return false;
        const filled = ['panNumber', 'gstNumber', 'udyamNumber', 'turnoverRange']
            .some((key) => !!String(financialData[key] || '').trim());
        return filled
            || financialData.filedITR === true
            || financialData.govtSchemeBenefit === true
            || (financialData.status && financialData.status !== 'draft');
    }, [financialData]);

    const hasDeclaration = useMemo(() => {
        if (!declarationData) return false;
        return declarationData.agreeToDeclaration === true
            || Number(declarationData.sisterConcerns || 0) > 0
            || (declarationData.companyNames || []).length > 0;
    }, [declarationData]);

    /* Nothing submitted yet? Then the prompts ARE the page — showing an empty
       screen and a button they have to discover is the worse answer. */
    const nothingFilled = !personalData && !hasBusiness && !hasFinancial && !hasDeclaration;
    const showEmptySections = nothingFilled;

    /** An aspirant is never asked for a PAN, so that form is not "missing". */
    const isAspirant = businessData?.doingBusiness === false;

    /*
     * THREE sections, the same three for everybody.
     *
     * `Financial Details` used to be a fourth, dropped for an aspirant. It is
     * asked per company in the Business Creation Account now, so it is not part
     * of the application — and pointing at `?step=3` would have opened the
     * declaration, which is what step 3 is today. The financial CARD below
     * still renders whatever is stored; it just is not a box left to tick here.
     */
    const sections: SectionState[] = useMemo(() => ([
        { filled: !!personalData, label: 'Personal Details', to: '/member/profile?step=1' },
        { filled: hasBusiness, label: 'Business Details', to: '/member/profile?step=2' },
        { filled: hasDeclaration, label: 'Declaration', to: '/member/profile?step=3' },
    ]), [personalData, hasBusiness, hasDeclaration]);

    const doneCount = sections.filter((section) => section.filled).length;

    // ------------------------------------------------------------ photo

    /**
     * The photo goes through the upload endpoint, not the profile writer.
     *
     * This used to `PUT /members/profile` with `{ profileImage: <base64> }`.
     * That key is not one `updateMember` reads — it writes `profilePhoto` — so
     * Mongoose dropped it, the request answered 200, the toast said "updated",
     * and nothing had been saved. `uploadProfilePhoto` posts the file to the
     * endpoint built for it and returns the stored path.
     */
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error("Please upload an image file");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Image size should be less than 2MB");
            return;
        }

        setUploading(true);
        try {
            const saved = await uploadProfilePhoto(file);
            const url = resolveMediaUrl(saved?.profilePhoto || '') || '';

            if (url) {
                setProfileImage(url);
                try { localStorage.setItem('userProfilePhoto', url); } catch { /* storage unavailable */ }
                // The sidebar avatar reads that key and listens for this.
                window.dispatchEvent(new CustomEvent('profilePhotoUpdated'));
            }

            toast.success("Profile photo updated");
        } catch (err) {
            toast.error(errorMessage(err, "Failed to upload photo"));
        } finally {
            setUploading(false);
            // Let the same file be chosen again after a failure.
            e.target.value = '';
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen bg-slate-50">
                <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500">Loading profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <MemberSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 z-10">
                    {/*
                      * THE HEADING FITS THE BAR, AT EVERY WIDTH.
                      *
                      * `h-[5.5rem]` is a fixed height and the heading carried no
                      * `truncate`, so on a 360px screen — where the Edit button
                      * and the two icons leave the title about 80px — "My
                      * Profile" wrapped onto two lines and pushed itself and its
                      * subtitle straight out of the bar and over the card below.
                      * One line, a smaller step on a phone, and the subtitle
                      * hidden at the width where there is no room for it —
                      * exactly what `MemberPageShell` does on every other member
                      * screen. This one hand-rolls its header and so missed it.
                      */}
                    <div className="h-[5.5rem] px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                            <button
                                className="lg:hidden shrink-0 p-2 rounded-xl hover:bg-slate-100"
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open menu"
                            >
                                <Menu className="h-6 w-6" />
                            </button>
                            <div className="min-w-0">
                                <h1 className={`${PAGE_TITLE} text-slate-900 truncate`}>My Profile</h1>
                                <p className={`${PAGE_SUBTITLE} text-slate-500 mt-0.5 truncate hidden sm:block`}>
                                    Everything you have submitted, in one place
                                </p>
                            </div>
                        </div>

                        {/*
                          * NO "EDIT PROFILE" BUTTON HERE.
                          *
                          * It toggled `showPending`, which revealed prompts for the
                          * sections not yet filled — and turned itself into a
                          * "Done" that painted VIOLET, because `variant="default"`
                          * resolves to `bg-primary` and this project maps that to a
                          * violet (the note is on `MembershipCard`). So pressing
                          * "Edit profile" on a blue screen produced a purple button
                          * that edited nothing.
                          *
                          * It was also redundant. Every section that HAS content
                          * already carries its own Edit link, which goes straight to
                          * the step that owns it; and a section with NOTHING in it
                          * shows its prompt unasked, because `nothingFilled` covers
                          * the one case the toggle was for.
                          */}
                        <div className="flex items-center gap-2 shrink-0">
                            <MemberTopBar />
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="w-full max-w-[110rem] mx-auto space-y-6">
                        {/* ---------------------------------------------- header card */}
                        <Card className="p-6">
                            <div className="flex flex-col md:flex-row items-center gap-6">
                                <div className="relative">
                                    <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg">
                                        {profileImage ? (
                                            <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="h-16 w-16 text-slate-400" />
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 shadow-lg">
                                        {uploading
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Camera className="h-4 w-4" />}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                <div className="flex-1 text-center md:text-left min-w-0">
                                    {/* `name` is not a field this backend returns — it stores `fullName`,
                                        so this always fell through to the literal "User" while the
                                        card below showed the real name two inches lower. */}
                                    <h2 className={`${CARD_TITLE} text-slate-800`}>
                                        {personalData?.fullName || personalData?.name || "Member"}
                                    </h2>
                                    {/* These two carried NO size class at all, so they
                                        rendered at the browser's 16px default — the
                                        smallest text anywhere on a signed-in screen, and
                                        it was the member's own email address. */}
                                    <p className={`${CARD_BODY} text-slate-500 mt-1.5`}>
                                        {personalData?.email || ""}
                                    </p>
                                    <p className={`${CARD_BODY} text-slate-500 tabular-nums`}>
                                        {personalData?.phoneNumber || ""}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                                        {personalData?.district && (
                                            <span className="px-3.5 py-1.5 bg-blue-100 text-blue-700 rounded-full
                                                             text-[1.25rem] font-semibold">
                                                {personalData.district}
                                            </span>
                                        )}
                                        {personalData?.state && (
                                            <span className="px-3.5 py-1.5 bg-green-100 text-green-700 rounded-full
                                                             text-[1.25rem] font-semibold">
                                                {personalData.state}
                                            </span>
                                        )}
                                        {personalData?.membershipNumber && (
                                            <span className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-full
                                                             text-[1.25rem] font-semibold tracking-wider">
                                                ID {personalData.membershipNumber}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/*
                              * Which forms are in, and a way into the ones that are not.
                              *
                              * The member's own answer to "have I finished?", derived from
                              * the data rather than from a stored flag — a flag goes stale
                              * the moment a form is submitted and nothing rewrites it.
                              */}
                            <div className="mt-6 pt-5 border-t border-slate-100">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                    {/* It names the block beneath it, so it is a
                                        SECTION_TITLE — it was set smaller than the
                                        pills it introduces. */}
                                    <p className={`${SECTION_TITLE} text-slate-800`}>
                                        Application forms
                                        <span className={`ml-2.5 ${CARD_BODY} text-slate-400 tabular-nums`}>
                                            {doneCount} of {sections.length} submitted
                                        </span>
                                    </p>

                                    {/*
                                      * THE WAY OUT OF A FINISHED PROFILE.
                                      *
                                      * Every form filled in and no application
                                      * lodged was a dead end on this page. It is a
                                      * record of what has been submitted and it
                                      * carried an "Edit profile" toggle and three
                                      * section edit links — no submit control of any
                                      * kind — while the dashboard card that sent
                                      * members here read "Submit to start the
                                      * review". The only "Submit Application" button
                                      * in the product is at the foot of step 3 of
                                      * the wizard, so that is where this goes.
                                      *
                                      * Rendered on BOTH conditions, never on one.
                                      * `doneCount === sections.length` alone would
                                      * offer it to a member who has already applied,
                                      * and lodging a second application puts a
                                      * duplicate row in every tier's queue.
                                      */}
                                    {!application && doneCount === sections.length ? (
                                        <Button
                                            onClick={() => navigate('/member/profile?step=3')}
                                            className={`bg-blue-600 hover:bg-blue-700 text-white ${ACTION_TEXT}`}
                                        >
                                            Submit Application
                                            <ArrowRight className="ml-1.5 h-4 w-4" />
                                        </Button>
                                    ) : null}
                                </div>

                                {/* Said once, plainly. The green pills directly below
                                    read as a finished job, and until this is pressed
                                    the application does not exist and no admin can
                                    see it. */}
                                {!application && doneCount === sections.length ? (
                                    <p className={`${CARD_BODY} text-slate-500 mb-3`}>
                                        Your forms are saved. Submit them to start the review —
                                        nothing reaches the admins until you do.
                                    </p>
                                ) : null}

                                <div className="flex flex-wrap gap-2">
                                    {sections.map((section) => (
                                        section.filled ? (
                                            <span
                                                key={section.label}
                                                className={`inline-flex items-center gap-2 ${ACTION_TEXT}
                                                            text-emerald-700 bg-emerald-50 rounded-full px-4 py-2`}
                                            >
                                                <CheckCircle2 className="h-4 w-4" /> {section.label}
                                            </span>
                                        ) : (
                                            <button
                                                key={section.label}
                                                type="button"
                                                onClick={() => navigate(section.to)}
                                                className={`inline-flex items-center gap-2 ${ACTION_TEXT}
                                                            text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full
                                                            px-4 py-2 transition-colors`}
                                            >
                                                <Circle className="h-4 w-4" /> {section.label}
                                                <ArrowRight className="h-4 w-4" />
                                            </button>
                                        )
                                    ))}
                                </div>
                            </div>
                        </Card>

                        {/*
                          * ONE CARD, FOUR SECTIONS — not four cards.
                          *
                          * Personal, Business, Financial and Declaration were four
                          * separate `<Card>`s stacked down the page, so a profile
                          * read as four unrelated documents that happened to be
                          * about the same person. It is one record with four parts,
                          * and every part has the same owner, the same edit route
                          * pattern and the same two-column grid inside it.
                          *
                          * `divide-y` rather than a border on each section: the
                          * sections are conditional — an aspirant has no Financial
                          * part, a member mid-application has no Declaration — and
                          * `first:border-t-0` picks the first ELEMENT, which is not
                          * the first RENDERED one once a condition removes it. A
                          * divider would then float above nothing. `divide-y` only
                          * ever draws between siblings that actually rendered.
                          */}
                        <Card className="p-0 overflow-hidden divide-y divide-slate-100">

                        {/* ---------------------------------------------- personal */}
                        {personalData ? (
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <SectionHeading icon={<User className="h-5 w-5 text-blue-600" />}>
                                        Personal Information
                                    </SectionHeading>
                                    <EditLink to="/member/profile?step=1" onGo={navigate} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* `fullName` is the field the backend stores; `name`
                                        was read here and is never returned. */}
                                    <InfoItem label="Full Name" value={personalData.fullName || personalData.name} />
                                    <InfoItem label="Email" value={personalData.email} />
                                    <InfoItem label="Phone Number" value={personalData.phoneNumber} />
                                    <InfoItem label="Membership Status" value={titleCase(personalData.membershipStatus) || 'Pending'} />
                                    {/*
                                      * `memberType`, not `membershipType`.
                                      *
                                      * They are two different questions and this row
                                      * was answering the wrong one. `membershipType` is
                                      * the PLAN — 'annual' once paid, the literal string
                                      * 'none' until then — so a business applicant was
                                      * shown "Membership Type: none", which is not their
                                      * type at all. `memberType` is what kind of member
                                      * they are, true from the day they registered.
                                      *
                                      * It falls back to the plan so a paid member whose
                                      * record predates `memberType` still reads as
                                      * something rather than as blank.
                                      */}
                                    <InfoItem
                                        label="Membership Type"
                                        value={titleCase(personalData.memberType)
                                            || titleCase(personalData.registrationType)
                                            || titleCase(personalData.membershipType)}
                                    />
                                    <InfoItem label="Member ID" value={personalData.membershipNumber} />
                                    <InfoItem label="State" value={personalData.state} />
                                    <InfoItem label="District" value={personalData.district} />
                                    <InfoItem label="Block" value={personalData.block} />
                                    <InfoItem label="City" value={personalData.city} />
                                    {/*
                                      * The three demographic answers, in the order the form
                                      * asks them: category, then the religion it narrows,
                                      * then gender.
                                      *
                                      * None of them are paid-only. The applicant was asked
                                      * for them on the personal step during registration;
                                      * hiding their own answer back from them until they
                                      * paid served nothing.
                                      */}
                                    <InfoItem label="Social Category" value={personalData.socialCategory} />
                                    <InfoItem label="Religion" value={personalData.religion} />
                                    <InfoItem label="Gender" value={personalData.gender} />
                                </div>
                            </div>
                        ) : null}

                        {/* ---------------------------------------------- business */}
                        {hasBusiness ? (
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <SectionHeading icon={<Briefcase className="h-5 w-5 text-blue-600" />}>
                                        Business Information
                                    </SectionHeading>
                                    <EditLink to="/member/profile?step=2" onGo={navigate} />
                                </div>

                                {/*
                                  * An aspirant gets one line, not ten blank ones.
                                  *
                                  * `doingBusiness === false` means the member declared they
                                  * run no business, so organisation, constitution and the
                                  * rest were never asked for. Printing them as "Not
                                  * provided" would imply they had skipped something.
                                  */}
                                {isAspirant ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        <InfoItem
                                            label="Business Status"
                                            value="Aspirant (not currently doing business)"
                                        />
                                        <InfoItem label="Registration Type" value={businessData.registrationType} />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <InfoItem label="Business Status" value={yesNo(businessData.doingBusiness)} />
                                        <InfoItem label="Registration Type" value={businessData.registrationType} />
                                        <InfoItem label="Organization Name" value={businessData.organizationName} />
                                        <InfoItem label="Constitution Type" value={businessData.constitutionType} />
                                        <InfoItem label="Commencement Year" value={businessData.businessCommencementYear} />
                                        <InfoItem label="Number of Employees" value={businessData.numberOfEmployees} />
                                        <InfoItem label="Business Activities" value={asText(businessData.businessActivities)} />
                                        <InfoItem label="Business Types" value={asText(businessData.businessTypes)} />
                                        <InfoItem label="Govt Organizations" value={asText(businessData.govtOrganizations)} />
                                        <InfoItem label="Other Chamber Member?" value={yesNo(businessData.memberOfOtherChamber)} />
                                        <InfoItem label="Other Chamber Name" value={businessData.otherChamber} />
                                    </div>
                                )}
                            </div>
                        ) : showEmptySections ? (
                            <NotYetCard
                                icon={<Briefcase className="h-5 w-5 text-blue-600" />}
                                title="Business Information"
                                detail="Tell us whether you run a business, and its details, to complete this section."
                                to="/member/profile?step=2"
                                onGo={navigate}
                            />
                        ) : null}

                        {/* ---------------------------------------------- financial */}
                        {/* Never shown for an aspirant: they were not asked for a PAN or
                            a turnover, so the card would carry two "No" answers and
                            nothing else. Mobile omits it on the same condition. */}
                        {isAspirant ? null : hasFinancial ? (
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <SectionHeading icon={<Building2 className="h-5 w-5 text-blue-600" />}>
                                        Financial &amp; Compliance
                                    </SectionHeading>
                                    <EditLink to="/business/companies" onGo={navigate} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem label="PAN Number" value={financialData.panNumber} />
                                    <InfoItem label="GST Number" value={financialData.gstNumber} />
                                    <InfoItem label="UDYAM Number" value={financialData.udyamNumber} />
                                    <InfoItem label="Filed ITR?" value={yesNo(financialData.filedITR)} />
                                    <InfoItem label="Turnover Range" value={financialData.turnoverRange} />
                                    <InfoItem label="Govt Scheme Benefit?" value={yesNo(financialData.govtSchemeBenefit)} />
                                    {/* Two fields the server has always returned and this
                                        page has never printed. */}
                                    <InfoItem label="Government Schemes" value={asText(financialData.govtSchemes)} />
                                    <InfoItem label="Scheme Details" value={financialData.schemeDetails} />
                                </div>
                            </div>
                        ) : showEmptySections ? (
                            <NotYetCard
                                icon={<Building2 className="h-5 w-5 text-blue-600" />}
                                title="Financial &amp; Compliance"
                                detail="PAN, GSTIN, turnover and government registrations are asked in your Business Account, on the company they belong to."
                                to="/business/companies"
                                onGo={navigate}
                            />
                        ) : null}

                        {/* ---------------------------------------------- declaration */}
                        {hasDeclaration ? (
                            <div className="p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <SectionHeading icon={<FileText className="h-5 w-5 text-blue-600" />}>
                                        Declaration
                                    </SectionHeading>
                                    <EditLink to="/member/profile?step=3" onGo={navigate} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoItem
                                        label="Number of Sister Concerns"
                                        value={declarationData.sisterConcerns}
                                    />
                                    <InfoItem
                                        label="Company Names"
                                        value={asText(declarationData.companyNames)}
                                    />
                                    <InfoItem
                                        label="Declaration Agreed?"
                                        value={yesNo(declarationData.agreeToDeclaration)}
                                    />
                                </div>
                            </div>
                        ) : showEmptySections ? (
                            <NotYetCard
                                icon={<FileText className="h-5 w-5 text-blue-600" />}
                                title="Declaration"
                                detail="Declare any sister concerns and accept the association's declaration."
                                to="/member/profile?step=3"
                                onGo={navigate}
                            />
                        ) : null}

                        </Card>
                    </div>
                </main>
            </div>
        </div>
    );
};

/**
 * A stored word, as a human reads it.
 *
 * The server stores these lower case — 'business', 'aspirant', 'pending' —
 * because that is what every comparison in the codebase tests against, and
 * changing the stored casing to suit one screen would break all of them. So
 * the capital goes on HERE, at the point of display, and nowhere else.
 *
 * Returns undefined for an empty value rather than an empty string, because
 * `InfoItem` prints its own placeholder for a missing answer and an empty
 * string is not missing — it is a blank where a word should be.
 */
const titleCase = (value: unknown): string | undefined => {
    const text = String(value ?? '').trim();
    if (!text) return undefined;
    return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Render a boolean as words.
 *
 * `false` is a real answer — "no, I do not run a business" — and it must reach
 * the row as "No" rather than as an absence.
 */
const yesNo = (value: unknown): string | undefined => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

/** Lists are stored as arrays; joined so they read as a sentence. */
const asText = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return value.filter(Boolean).join(', ') || undefined;
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

const SectionHeading = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className={`${CARD_TITLE} text-slate-800`}>{children}</h3>
    </div>
);

/**
 * One field — and nothing at all when it was not answered.
 *
 * This has been both ways. It began by returning null, was changed to print
 * "Not provided" so a member could check their profile against the form that
 * produced it, and is back to null on request: a card of grey italics is not a
 * record of what somebody submitted, it is a list of what they did not.
 *
 * The reason the middle version existed still stands — a field the backend
 * silently dropped now looks exactly like one left blank — but that is a
 * question for the form, which shows every field with its value, not for this
 * page, which is a summary.
 */
const InfoItem = ({ label, value }: { label: string; value?: string | number | null }) => {
    const empty = value === undefined || value === null || String(value).trim() === '';
    if (empty) return null;

    return (
        <div>
            {/*
              THE VALUE IS THE ANSWER; THE LABEL IS THE QUESTION.

              The value carried no size at all, so it inherited whatever the
              card set — and came out at or below the label above it. A member
              reading their own record was looking for the value and finding
              the quieter of the two. 22px semibold for the answer, and the
              label up a step with it so the pair stay legible together.
            */}
            <p className="mb-1 text-[1.25rem] font-semibold text-slate-500">{label}</p>
            <p className="text-[1.375rem] font-semibold text-slate-900 break-words">
                {String(value)}
            </p>
        </div>
    );
};

/**
 * A form the member has not started.
 *
 * One card and one link, rather than fifteen rows of "Not provided". The
 * distinction matters: an unanswered FIELD inside a submitted form is worth
 * showing, because the member chose to leave it out; an entire form they have
 * not reached yet is not a gap in their profile, it is the next thing to do.
 */
/**
 * The Edit for one section.
 *
 * Beside the heading it belongs to, and pointing at the form that owns that
 * section — not at Settings, which is where the single header button used to
 * go and is not where a GST number is kept.
 */
const EditLink = ({ to, onGo, label = 'Edit' }: {
    to: string;
    onGo: (to: string) => void;
    label?: string;
}) => (
    <button
        type="button"
        onClick={() => onGo(to)}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 ${ACTION_TEXT}
                    text-blue-700 transition-colors hover:bg-blue-50`}
    >
        <Edit className="h-4 w-4" /> {label}
    </button>
);

const NotYetCard = ({
    icon,
    title,
    detail,
    to,
    onGo,
}: {
    icon: React.ReactNode;
    title: string;
    detail: string;
    to: string;
    onGo: (to: string) => void;
}) => (
    /* A section inside the shared card, not a card of its own — see the note
       on the wrapper. The dashed rule is kept as an inset outline so an
       unfinished part still reads as unfinished. */
    <div className="p-6">
      <div className="rounded-xl border border-dashed border-slate-300 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
                <span className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    {icon}
                </span>
                <div className="min-w-0">
                    <h3 className={`${CARD_TITLE} text-slate-800`}>{title}</h3>
                    <p className={`${CARD_BODY} text-slate-500 mt-1.5`}>{detail}</p>
                </div>
            </div>

            <Button
                onClick={() => onGo(to)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0"
            >
                Complete now
                <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
        </div>
      </div>
    </div>
);

export default ProfileView;
