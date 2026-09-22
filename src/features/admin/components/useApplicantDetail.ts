import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { getApplicationProfile, errorMessage } from '@/services/activApi';

/**
 * Open one applicant's four submitted forms, from anywhere an admin meets them.
 *
 * =========================================================================
 * ONE FETCH, ONE PIECE OF STATE, THREE SCREENS
 * =========================================================================
 *
 * The Approvals queue had this written inline; the two Hubs — the super admin's
 * and the tier admins' — had nothing at all, so a district admin who had
 * drilled into a block could approve a membership without ever being offered
 * the answers it was based on. The decision was made from a name, a phone
 * number and a role.
 *
 * Extracted rather than copied into the two Hubs, because the next thing this
 * needs (a cache, a deep link, an error state that offers a retry) has to
 * arrive in one place or the three screens start disagreeing about what
 * "viewing an applicant" means.
 *
 * WHAT THE QUEUE ROW CARRIES AND THE FETCH DOES NOT: `stage`, `statusLabel` and
 * the rejection reason are computed server-side for the tier that asked, and
 * `getApplicationProfile` returns the raw application. Both are merged, the row
 * winning, so the modal's badge agrees with the card it was opened from.
 */

/** The subset of an applicant row this needs — every admin list has these. */
export interface DetailTarget {
    id?: string;
    _id?: string;
    applicationId?: string;
    stage?: string;
    statusLabel?: string;
    rejectionReason?: string;
}

export function useApplicantDetail() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    /** Kept so a decision made inside the modal knows which file it is about. */
    const [target, setTarget] = useState<DetailTarget | null>(null);

    const openDetail = useCallback(async (applicant: DetailTarget) => {
        const id = String(applicant?.id || applicant?._id || applicant?.applicationId || '');
        if (!id) return;

        setTarget(applicant);
        setOpen(true);
        setLoading(true);
        try {
            const fetched = await getApplicationProfile(id);
            setProfile({
                ...(fetched || {}),
                stage: applicant.stage,
                statusLabel: applicant.statusLabel,
                rejectionReason: applicant.rejectionReason || (fetched as any)?.rejectionReason || '',
            });
        } catch (error) {
            toast.error(errorMessage(error, 'Failed to load application data'));
            // Closed rather than left open on a spinner: a modal that never
            // resolves is indistinguishable from one that is still loading.
            setOpen(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        setProfile(null);
        setTarget(null);
    }, []);

    return {
        /** Call with the row that was pressed. */
        openDetail,
        /** The file the modal is showing, for the caller's own review handler. */
        target,
        /** Spread straight onto `<ProfileViewModal />`. */
        detailProps: { open, loading, profile, onClose: close },
    };
}

export default useApplicantDetail;
