import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Shield,
  User,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const AdminProfile = () => {
  const fileInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState({ notifications: true, autoSync: true });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    schoolName: "",
    avatarUrl: "",
  });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const { data } = await api.get("/admin/profile");
        if (!active) return;
        setProfile(data?.user || null);
        setSettings(data?.settings || { notifications: true, autoSync: true });
        setForm({
          firstName: data?.user?.firstName || "",
          lastName: data?.user?.lastName || "",
          schoolName: data?.user?.schoolName || "",
          avatarUrl: data?.user?.avatarUrl ? resolveMediaUrl(data.user.avatarUrl) : "",
        });
      } catch (err) {
        console.error("Failed to load admin profile", err);
        toast.error("Failed to load profile.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleUploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const { data } = await api.post("/uploads", uploadData);
      const url = data?.file?.url;
      if (!url) throw new Error("Upload failed.");

      const { data: saved } = await api.patch("/admin/profile", { avatarUrl: url });
      const nextUrl = saved?.user?.avatarUrl ? resolveMediaUrl(saved.user.avatarUrl) : "";

      setProfile(saved?.user || profile);
      setForm((prev) => ({ ...prev, avatarUrl: nextUrl }));
      toast.success("Profile image updated.");
    } catch (err) {
      console.error("Failed to upload avatar", err);
      toast.error(err?.response?.data?.error || "Failed to upload image.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const toggleSetting = async (field) => {
    const nextValue = !Boolean(settings[field]);
    setSettings((prev) => ({ ...prev, [field]: nextValue }));
    try {
      await api.patch("/admin/profile", {
        settings: {
          notifications: field === "notifications" ? nextValue : undefined,
          autoSync: field === "autoSync" ? nextValue : undefined,
        },
      });
    } catch (err) {
      console.error("Failed to update settings", err);
      toast.error("Failed to update settings.");
      setSettings((prev) => ({ ...prev, [field]: !nextValue }));
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const payload = {
        firstName: String(form.firstName || "").trim() || undefined,
        lastName: String(form.lastName || "").trim() || undefined,
        schoolName: String(form.schoolName || "").trim() || undefined,
      };
      const { data } = await api.patch("/admin/profile", payload);
      setProfile(data?.user || profile);
      toast.success("Profile updated.");
    } catch (err) {
      console.error("Failed to update profile", err);
      toast.error(err?.response?.data?.error || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!profile) {
    return <EmptyState />;
  }

  const displayName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.email ||
    "Administrator";

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Profile
            </h1>
            <p className="text-sm font-bold text-slate-400">
              Manage your account details and preferences.
            </p>
          </div>
          <button
            onClick={saveProfile}
            disabled={isSaving}
            className="px-6 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all active:scale-95 disabled:opacity-60"
          >
            <Save size={16} className="inline -mt-0.5 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative h-20 w-20 rounded-[1.7rem] bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    <User size={26} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute bottom-2 right-2 p-2 rounded-xl bg-white/90 border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-[#2D70FD] transition-colors disabled:opacity-60"
                  aria-label="Upload avatar"
                >
                  <Camera size={16} />
                </button>
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-slate-900 truncate">
                  {displayName}
                </h2>
                <p className="text-sm font-bold text-slate-500 flex items-center gap-2 truncate">
                  <Mail size={14} className="text-slate-400" />
                  {profile.email}
                </p>
                <p className="text-xs font-bold text-slate-400 flex items-center gap-2 mt-1 truncate">
                  <Shield size={14} className="text-slate-400" />
                  {String(profile.role || "admin").toUpperCase()}
                </p>
              </div>
            </div>

            <div className="md:ml-auto grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
              <ToggleCard
                label="Notifications"
                enabled={Boolean(settings.notifications)}
                onToggle={() => toggleSetting("notifications")}
              />
              <ToggleCard
                label="Auto Sync"
                enabled={Boolean(settings.autoSync)}
                onToggle={() => toggleSetting("autoSync")}
              />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadAvatar}
          />

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="First Name"
              value={form.firstName}
              onChange={(v) => setForm((prev) => ({ ...prev, firstName: v }))}
              placeholder="First name"
            />
            <Field
              label="Last Name"
              value={form.lastName}
              onChange={(v) => setForm((prev) => ({ ...prev, lastName: v }))}
              placeholder="Last name"
            />
            <Field
              label="School Name"
              value={form.schoolName}
              onChange={(v) => setForm((prev) => ({ ...prev, schoolName: v }))}
              placeholder="School"
            />
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Email Verification
              </p>
              <div
                className={`w-full px-4 py-3 rounded-2xl border font-black ${
                  profile.emailVerified
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <CheckCircle2 size={16} className="inline -mt-0.5 mr-2" />
                {profile.emailVerified ? "Verified" : "Unverified"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
    />
  </div>
);

const ToggleCard = ({ label, enabled, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`w-full px-4 py-3 rounded-2xl border text-left transition-all ${
      enabled
        ? "border-blue-100 bg-blue-50/60"
        : "border-slate-200 bg-white hover:bg-slate-50"
    }`}
  >
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
    </p>
    <p className={`mt-1 text-sm font-black ${enabled ? "text-[#2D70FD]" : "text-slate-700"}`}>
      {enabled ? "Enabled" : "Disabled"}
    </p>
  </button>
);

export default AdminProfile;
