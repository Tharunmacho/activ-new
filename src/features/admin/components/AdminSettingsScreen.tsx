import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Mail, MapPin, Shield, Camera, Pencil, Check, LogOut, Loader2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAdminProfile, logout, errorMessage } from "@/services/activApi";

/**
 * The admin Settings screen, matching the mobile app's.
 *
 * Mobile's `{Block,District,State}SettingsScreen` is one surface: a profile
 * card, a "Profile Information" form whose inputs are read-only until an
 * Edit/Save button in the header unlocks them, an optional password section
 * that appears only while editing, and a Log Out button. One Save performs both
 * the profile update and the password change.
 *
 * The website had drifted a long way from that:
 *
 *   - Editing lived in a `ProfileEditModal` — a second surface with two
 *     separate submit buttons — that mobile has no equivalent of at all.
 *   - The page showed the admin's **phone number nowhere**, and the region only
 *     as static text, so two of the four editable fields were invisible until
 *     the modal was opened.
 *   - Four rows — Notifications, Security & Privacy, Help Center, Contact
 *     Support — rendered as tappable list items with **no onClick**. None of
 *     them exists on mobile.
 *   - An "Admin Statistics" grid duplicated the Dashboard's figures, and a
 *     "Status: Active" badge with a toggle was backed by `useState(true)`: it
 *     persisted nowhere and always read Active on load.
 *
 * The API contract is mobile's, unchanged: `PUT /admin/profile` with
 * `{ fullName, email, phoneNumber, <region> }` — sent only when something
 * actually changed — and `POST /auth/change-password` with
 * `{ oldPassword, newPassword }`, sent only when a new password was typed.
 */

type Tier = "block" | "district" | "state";

const TIER_LABEL: Record<Tier, string> = {
    block: "Block",
    district: "District",
    state: "State",
};

/** A field that is plain text until the screen is put into edit mode. */
function EditableField({
    label, value, onChange, editing, type = "text", placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    editing: boolean;
    type?: string;
    placeholder?: string;
}) {
    return (
        <div>
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            {editing ? (
                <Input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="mt-1.5 h-11 border-slate-200 focus-visible:ring-blue-500"
                />
            ) : (
                <p className="mt-1.5 h-11 flex items-center px-3 rounded-md bg-slate-50 border border-slate-200 text-slate-800">
                    {value || <span className="text-slate-400">Not set</span>}
                </p>
            )}
        </div>
    );
}

/** Password fields reveal independently, as they do on mobile. */
function PasswordField({
    label, value, onChange, placeholder,
}: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    const [shown, setShown] = useState(false);
    return (
        <div>
            <Label className="text-sm font-semibold text-slate-700">{label}</Label>
            <div className="relative mt-1.5">
                <Input
                    type={shown ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="h-11 pr-10 border-slate-200 focus-visible:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => setShown((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={shown ? "Hide password" : "Show password"}
                >
                    {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </div>
    );
}

export default function AdminSettingsScreen({
    tier,
    sidebar,
}: {
    tier: Tier;
    /** The tier's own AdminSidebar, passed in so this stays tier-agnostic. */
    sidebar: ReactNode;
}) {
    const navigate = useNavigate();
    const regionLabel = TIER_LABEL[tier];

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    /** What the server last told us — the baseline "did anything change" compares against. */
    const [saved, setSaved] = useState({ fullName: "", email: "", phoneNumber: "", region: "" });

    const [nameInput, setNameInput] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const [regionInput, setRegionInput] = useState("");
    const [oldPassword, setOldPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const profile: any = await getAdminProfile();
                if (cancelled) return;
                const next = {
                    fullName: profile?.fullName || profile?.name || "",
                    email: profile?.email || "",
                    phoneNumber: profile?.phoneNumber || profile?.phone || "",
                    region: profile?.[tier] || "",
                };
                setSaved(next);
                setNameInput(next.fullName);
                setEmailInput(next.email);
                setPhoneInput(next.phoneNumber);
                setRegionInput(next.region);
            } catch (error) {
                if (!cancelled) toast.error(errorMessage(error, "Could not load your profile"));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [tier]);

    /**
     * One Save, doing both jobs — mobile's `handleSave`.
     *
     * The profile call fires only when a field actually changed, and the
     * password call only when a new password was typed. A new password without
     * the current one aborts the whole save, exactly as on mobile.
     */
    const handleSave = async () => {
        const phone = (phoneInput || "").trim();

        if (newPassword && !oldPassword) {
            toast.error("You must provide your current password to set a new password.");
            return;
        }

        setSaving(true);
        let changes = 0;

        try {
            const profileChanged =
                nameInput !== saved.fullName ||
                emailInput !== saved.email ||
                phone !== saved.phoneNumber ||
                regionInput !== saved.region;

            if (profileChanged) {
                const res = await apiFetch("/admin/profile", {
                    method: "PUT",
                    body: JSON.stringify({
                        fullName: nameInput,
                        email: emailInput,
                        phoneNumber: phone,
                        [tier]: regionInput,
                    }),
                });
                const body = await res.json();
                if (!body?.success) throw new Error(body?.message || "Failed to update profile");

                setSaved({ fullName: nameInput, email: emailInput, phoneNumber: phone, region: regionInput });
                // The sidebar and header read these.
                try {
                    localStorage.setItem("userName", nameInput);
                    localStorage.setItem("userEmail", emailInput);
                } catch { /* storage unavailable */ }
                changes++;
            }

            if (newPassword) {
                const res = await apiFetch("/auth/change-password", {
                    method: "POST",
                    body: JSON.stringify({ oldPassword, newPassword }),
                });
                const body = await res.json();
                if (!body?.success) throw new Error(body?.message || "Failed to change password");
                setOldPassword("");
                setNewPassword("");
                changes++;
            }

            if (changes > 0) toast.success("Profile updated successfully!");
            setEditing(false);
        } catch (error) {
            toast.error(errorMessage(error, "Failed to update profile"));
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.warn("Logout safely caught:", err);
        }
        navigate("/login");
    };

    const initials =
        (saved.fullName || "A").split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    return (
        <div className="min-h-screen flex bg-slate-100">
            {sidebar}

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="h-[4.5rem] shrink-0 bg-white border-b border-slate-200 flex items-center px-5 lg:px-8">
                    <h1 className="text-[1.3125rem] font-bold tracking-tight text-slate-900">Settings</h1>

                    {/* Mobile's header Edit/Save toggle. */}
                    <div className="ml-auto">
                        {editing ? (
                            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                                {saving
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                                    : <><Check className="w-4 h-4 mr-2" />Save</>}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                className="border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => setEditing(true)}
                                disabled={loading}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-5 lg:p-8">
                    <div className="max-w-3xl mx-auto space-y-6">

                        {/* Profile card — avatar, name, role, email, region. */}
                        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                                <button
                                    type="button"
                                    onClick={() => toast.info("Photo upload is not available yet")}
                                    className="relative w-20 h-20 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center shrink-0 group"
                                >
                                    {initials}
                                    <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                                        <Camera className="w-3.5 h-3.5 text-slate-600" />
                                    </span>
                                </button>

                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-slate-900 truncate">
                                        {saved.fullName || "Admin"}
                                    </h2>
                                    <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
                                        <Shield className="w-4 h-4 text-blue-600" />
                                        {saved.region ? `${saved.region} ${regionLabel} Admin` : `${regionLabel} Admin`}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                                        <span className="flex items-center gap-1.5 min-w-0">
                                            <Mail className="w-4 h-4 shrink-0" />
                                            {/*
                                                No `|| 'admin@example.com'` fallback. A
                                                placeholder address here is
                                                indistinguishable from a real one on
                                                screen, and both platforms had one.
                                            */}
                                            <span className="truncate">{saved.email || "No email on record"}</span>
                                        </span>
                                        {saved.region ? (
                                            <span className="flex items-center gap-1.5">
                                                <MapPin className="w-4 h-4" />
                                                {saved.region}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Profile Information — inline, read-only until Edit. */}
                        <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-5">Profile Information</h3>

                            {loading ? (
                                <div className="flex items-center gap-2 text-slate-500 py-6">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <EditableField
                                        label="Full Name" value={nameInput} onChange={setNameInput}
                                        editing={editing} placeholder="Enter your name"
                                    />
                                    <EditableField
                                        label="Email Address" value={emailInput} onChange={setEmailInput}
                                        editing={editing} type="email" placeholder="Enter your email"
                                    />
                                    <EditableField
                                        label="Mobile Number" value={phoneInput} onChange={setPhoneInput}
                                        editing={editing} type="tel" placeholder="Enter your mobile number"
                                    />
                                    <EditableField
                                        label={`${regionLabel} Name`} value={regionInput} onChange={setRegionInput}
                                        editing={editing} placeholder={`Enter ${regionLabel.toLowerCase()} name`}
                                    />
                                </div>
                            )}

                            {/* Password, only while editing — as on mobile. */}
                            {editing && (
                                <div className="mt-6 pt-6 border-t border-slate-200">
                                    <h4 className="text-base font-bold text-slate-900 mb-4">
                                        Change Password (Optional)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <PasswordField
                                            label="Current Password" value={oldPassword} onChange={setOldPassword}
                                            placeholder="Enter current password"
                                        />
                                        <PasswordField
                                            label="New Password" value={newPassword} onChange={setNewPassword}
                                            placeholder="Enter new password (min 6 chars)"
                                        />
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Log Out — shown when not editing, as on mobile. */}
                        {!editing && (
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Log Out
                            </Button>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
