import { useCallback, useEffect, useState } from 'react';
import { getPaymentStatus } from '@/services/activApi';
import { SESSION_EVENT } from '@/services/api';

/**
 * Has this member paid?
 *
 * `null` means the answer is not in yet — deliberately distinct from `false`.
 * A caller must render its loading state while it is `null` and never the
 * unpaid screen, because showing "you have not paid" to someone who has is a
 * claim, not an absence.
 */
export type MembershipState = boolean | null;

/**
 * The one paid/unpaid decision, shared by both member dashboards.
 *
 * The website had no single answer to this. `Dashboard.tsx` asked and then
 * `navigate()`d, and its error branch sent the member to the unpaid dashboard
 * on *any* failure — a network blip was enough to demote a paid member.
 * `UnpaidDashboard.tsx` never asked at all, so anyone who arrived there, by
 * bookmark or by that very redirect, stayed on the unpaid screen for good.
 *
 * Mobile does not redirect between two screens. `DashboardScreen.tsx:202`
 * swaps the component:
 *
 *     if (membershipStatus === 'approved' || membershipStatus === 'active')
 *         return <PaidDashboardScreen />;
 *
 * There is no route change, so there is no loop and no way to land on the wrong
 * one. Both website dashboards now render through this hook and do the same.
 *
 * The status itself comes from `getPaymentStatus()`, which reads
 * `membershipStatus` off the member record — the field `POST /payment/complete`
 * writes, and the same field mobile reads.
 */
export const useMembershipGate = () => {
    const [isPaid, setIsPaid] = useState<MembershipState>(null);

    const refresh = useCallback(async () => {
        try {
            setIsPaid((await getPaymentStatus()) === 'completed');
        } catch {
            // `getPaymentStatus` already resolves rather than throwing, and
            // treats the unknown as unpaid. This is the last resort behind it.
            setIsPaid(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const paid = (await getPaymentStatus().catch(() => 'pending')) === 'completed';
            if (!cancelled) setIsPaid(paid);
        };

        load();

        /**
         * Re-read on the three things that can change the answer.
         *
         * `paymentCompleted` fires the moment a payment is recorded, so the
         * dashboard swaps without a reload. `SESSION_EVENT` covers signing in:
         * this hook's effect runs when its screen mounts, but a provider-level
         * cache of the old member's status would otherwise survive the switch.
         */
        window.addEventListener('paymentCompleted', load);
        window.addEventListener('profileUpdated', load);
        window.addEventListener(SESSION_EVENT, load);

        return () => {
            cancelled = true;
            window.removeEventListener('paymentCompleted', load);
            window.removeEventListener('profileUpdated', load);
            window.removeEventListener(SESSION_EVENT, load);
        };
    }, []);

    return { isPaid, isResolved: isPaid !== null, refresh };
};

export default useMembershipGate;
