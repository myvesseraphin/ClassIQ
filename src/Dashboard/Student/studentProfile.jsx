import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Shield,
  Settings,
  Camera,
  LogOut,
  Key,
  Lock,
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";

const StudentProfile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Account");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef(null);

  const [toastState, setToastState] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const [currentProfileImage, setCurrentProfileImage] = useState("");

  const [formData, setFormData] = useState({
    firstName: "MANZI SHIMWA",
    lastName: "Yves Seraphin",
    email: "myvesseraphin@gmail.com",
    studentId: "24091345",
    gradeLevel: "Year 1",
    className: "Y1B",
    currentPassword: "",
    newPassword: "",
    notifications: true,
    autoSync: true,
  });

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const { data } = await api.get("/student/profile");
        if (!isMounted) return;
        const fullFirst = data.user?.firstName || "";
        const fullLast = data.user?.lastName || "";
        setFormData((prev) => ({
          ...prev,
          firstName: fullFirst,
          lastName: fullLast,
          email: data.user?.email || prev.email,
          studentId: data.user?.studentId || prev.studentId,
          gradeLevel: data.user?.gradeLevel || prev.gradeLevel,
          className: data.user?.className || prev.className,
          notifications: data.settings?.notifications ?? prev.notifications,
          autoSync: data.settings?.autoSync ?? prev.autoSync,
        }));
        if (data.user?.avatarUrl) {
          setCurrentProfileImage(resolveMediaUrl(data.user.avatarUrl));
        } else {
          setCurrentProfileImage("");
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      toast.error("Failed to load profile.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = (message, type = "success") => {
    setToastState({ show: true, message, type });
    setTimeout(
      () => setToastState({ show: false, message: "", type: "success" }),
      3000,
    );
  };

  const handleImageClick = () => fileInputRef.current?.click();

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      const { data: upload } = await api.post("/uploads", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const avatarUrl = upload?.file?.url;
      if (!avatarUrl) {
        throw new Error("Upload failed.");
      }
      const { data: profile } = await api.patch("/student/profile", {
        avatarUrl,
      });
      const nextUrl = resolveMediaUrl(profile?.user?.avatarUrl || avatarUrl);
      setCurrentProfileImage(nextUrl);
      showNotification("Profile image updated!");
    } catch (err) {
      console.error("Failed to update profile image", err);
      toast.error("Failed to update profile image.");
    } finally {
      event.target.value = "";
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleSetting = async (field) => {
    const nextValue = !formData[field];
    setFormData((prev) => ({ ...prev, [field]: nextValue }));
    try {
      await api.patch("/student/profile/settings", {
        notifications: field === "notifications" ? nextValue : undefined,
        autoSync: field === "autoSync" ? nextValue : undefined,
      });
    } catch (err) {
      console.error("Failed to update settings", err);
      toast.error("Failed to update settings.");
      setFormData((prev) => ({ ...prev, [field]: !nextValue }));
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showNotification("Profile changes saved locally!");
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
      }));
    }, 1200);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-blue-100 selection:text-blue-600 pb-40 relative">
      {toastState.show && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-[1.5rem] shadow-2xl border bg-white ${toastState.type === "success" ? "border-emerald-100 text-emerald-600" : "border-rose-100 text-rose-600"}`}
          >
            {toastState.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span className="text-[11px] font-black uppercase tracking-widest">
              {toastState.message}
            </span>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageChange}
        className="hidden"
        accept="image/*"
      />

      <header className="max-w-4xl mx-auto pt-10 px-6 flex items-center justify-between">
        <button
          onClick={handleLogout}
          className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 rounded-2xl font-black text-[10px] tracking-widest transition-all shadow-sm active:scale-95"
        >
          <LogOut
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Log Out
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
        >
          {isSaving ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            "Save Changes"
          )}
        </button>
      </header>

      <main className="max-w-4xl mx-auto mt-12 px-6">
        <nav className="flex items-center justify-center gap-1.5 mb-12 bg-white/50 backdrop-blur-md p-1.5 rounded-[2.5rem] border border-slate-100 w-fit mx-auto shadow-sm">
          {["Account", "Settings"].map((name) => (
            <button
              key={name}
              onClick={() => setActiveTab(name)}
              className={`flex items-center gap-3 px-10 py-4 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === name ? "bg-blue-600 text-white shadow-xl shadow-blue-100 scale-105" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
            >
              {name === "Account" ? <User size={16} /> : <Settings size={16} />}
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="relative">
          {activeTab === "Account" ? (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-blue-50/50">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div
                    className="relative group cursor-pointer"
                    onClick={handleImageClick}
                  >
                    <div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 p-1 transition-transform group-hover:scale-105">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-4 border-white">
                        {currentProfileImage ? (
                          <img
                            src={currentProfileImage}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={60} className="text-blue-100" />
                        )}
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 p-2.5 bg-blue-600 text-white rounded-full border-4 border-white shadow-lg">
                      <Camera size={16} />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-800">
                      {formData.firstName} {formData.lastName}
                    </h2>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-tighter rounded-full border border-blue-100">
                        {formData.gradeLevel}
                      </span>
                      <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-tighter rounded-full border border-slate-100">
                        {formData.className}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: "First Name", value: formData.firstName },
                  { label: "Last Name", value: formData.lastName },
                  { label: "Email Address", value: formData.email },
                  { label: "Student ID", value: formData.studentId },
                ].map((field, i) => (
                  <div
                    key={i}
                    className="bg-slate-50/30 rounded-[2rem] p-6 border border-slate-100 shadow-sm opacity-80 cursor-not-allowed"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      {field.label}
                    </label>
                    <div className="font-bold text-slate-500 text-lg">
                      {field.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div
                  className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer"
                  onClick={() => toggleSetting("notifications")}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-2xl transition-colors ${formData.notifications ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`}
                    >
                      <Bell size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Push Alerts
                      </h4>
                      <p className="font-bold text-slate-700">
                        {formData.notifications ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.notifications ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.notifications ? "left-7" : "left-1"}`}
                    />
                  </div>
                </div>

                <div
                  className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer"
                  onClick={() => toggleSetting("autoSync")}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-2xl transition-colors ${formData.autoSync ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"}`}
                    >
                      <RefreshCw size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Cloud Sync
                      </h4>
                      <p className="font-bold text-slate-700">
                        {formData.autoSync ? "Always On" : "Manual"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.autoSync ? "bg-indigo-600" : "bg-slate-200"}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.autoSync ? "left-7" : "left-1"}`}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                  <Lock size={20} className="text-blue-600" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Security & Credentials
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Current Password
                    </label>
                    <div className="flex items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <Key size={16} className="text-slate-300 mr-3" />
                      <input
                        name="currentPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="w-full bg-transparent outline-none font-bold text-slate-700"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      New Password
                    </label>
                    <div className="flex items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <Shield size={16} className="text-slate-300 mr-3" />
                      <input
                        name="newPassword"
                        type="password"
                        placeholder="New Password"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="w-full bg-transparent outline-none font-bold text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentProfile;
