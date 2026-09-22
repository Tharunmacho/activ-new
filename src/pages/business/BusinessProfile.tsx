import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/services/activApi";
import { dashboardPathFor } from "@/features/member/memberAccess";
import useMembershipGate from "@/features/member/useMembershipGate";
import CompanyForm from "./CompanyForm";

/**
 * A member's FIRST company — the screen the dashboard's Business card opens.
 *
 * This used to be a second, thinner copy of the company form: the same
 * identity and contact questions, a `businessType` list of its own, an email
 * address it required where the other screen did not, and a save path that
 * always posted multipart where the other only did so with a logo. Adding the
 * constitution, turnover and government-registration sections to both would
 * have meant maintaining twenty fields twice — which is exactly how the five
 * disagreeing `businessType` lists documented in `businessTypes.js` came about.
 *
 * What is left here is the part that is genuinely this route's own: the guard
 * that sends a member who already has a company to their dashboard, and the
 * rail gating that goes with having none. The form is `CompanyForm`.
 */
const BusinessProfile = () => {
    const navigate = useNavigate();
    const { isPaid } = useMembershipGate();

    /**
     * Whether the member already has a company.
     *
     * `null` means "not established yet" — the lookup has not returned, or it
     * failed. This used to be a boolean initialised `false` that was only ever
     * re-set to `false`; it was never once set true, so `disableNavigation`
     * (`!hasExistingProfile`) was a constant `true` and every sidebar link on
     * this page was dead for everyone, in every state, including when the
     * lookup errored and we knew nothing at all.
     *
     * Navigation is now disabled only when we have *confirmed* there is no
     * company to act on — the case the gate was written for. An unknown answer
     * fails open: the company-scoped screens all render their own empty state.
     */
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);

    useEffect(() => {
        const loadActiveCompany = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token) return;

                const response = await apiFetch("/business-profiles/me");

                if (response.ok) {
                    const result = await response.json();

                    if (result.data) {
                        // A profile already exists — this screen has nothing to do.
                        setHasProfile(true);
                        navigate("/business/dashboard");
                        return;
                    }
                    setHasProfile(false);
                }
            } catch (error) {
                console.error("Error loading active company:", error);
                // Leave `hasProfile` null — unknown, so navigation stays open.
            }
        };

        loadActiveCompany();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <CompanyForm
            title="Create Business Profile"
            subtitle="Register your company to start listing products and reaching buyers"
            /*
              Straight to the dashboard, not to the company list.

              This is the member's first company, so a list of one is a stop on
              the way to the screen they were actually heading for.
            */
            returnTo="/business/dashboard"
            /*
              CANCEL GOES BACK TO THE MEMBER DASHBOARD, not to the business one.

              Both were `/business/dashboard`. For a member who has no company
              — which is everyone who reaches this screen — that page holds one
              empty state and a button reading "Create Business Profile", so
              Cancel returned them to a screen whose only offer was the form
              they had just left. Abandoning a form has to lead somewhere with
              something on it, and the member dashboard is where they came from.

              `dashboardPathFor` rather than a literal: an unpaid member cannot
              open the paid dashboard, and sending them to it would swap this
              dead end for a redirect.
            */
            cancelTo={dashboardPathFor(isPaid === true)}
            createLabel="Create Profile"
            /*
              NO RAIL ON THIS SCREEN.

              Every link in the business rail — Products, Stock, Discover,
              Analytics — describes a company that does not exist yet, which is
              why they were being greyed out. Eight inert controls framing the
              one form that matters is worse than no rail: it reads as a broken
              page rather than as a focused one. The form gets a back arrow, the
              way the member registration forms already do.
            */
            sidebar={false}
            disableNavigation={hasProfile === false}
        />
    );
};

export default BusinessProfile;
