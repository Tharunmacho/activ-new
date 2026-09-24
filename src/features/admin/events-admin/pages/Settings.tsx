import { useState } from "react";
import AdminSidebar from "@/features/admin/components/AdminSidebar";
import AdminSettingsScreen from "@/features/admin/components/AdminSettingsScreen";

/**
 * Events admin settings — the tier admins' shared screen: profile, and the
 * password change the account needs (it is created with a temporary one).
 */
const Settings = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    return (
        <AdminSettingsScreen
            tier="events"
            sidebar={<AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
            onMenu={() => setSidebarOpen(true)}
        />
    );
};

export default Settings;
