import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminSettingsScreen from "@/features/admin/components/AdminSettingsScreen";

/**
 * District admin settings.
 *
 * The screen itself lives in `features/admin/components/AdminSettingsScreen`,
 * which mirrors mobile's `DistrictSettingsScreen` — a profile card, an inline
 * "Profile Information" form that unlocks on Edit, an optional password section,
 * and Log Out. All three tiers used to carry their own ~380-line copy of a
 * different design, and the three copies had drifted apart from each other as
 * well as from mobile.
 */
const Settings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    return (
        <AdminSettingsScreen
            tier="district"
            sidebar={<AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        />
    );
};

export default Settings;
