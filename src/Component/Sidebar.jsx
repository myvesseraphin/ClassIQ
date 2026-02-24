import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  BookOpen,
  GraduationCap,
  ClipboardList,
  FileText,
  Brain,
  Library,
  User,
  LogOut,
} from "lucide-react";
import api, { resolveMediaUrl } from "../api/client";
import logo from "../assets/logo.png";

const Sidebar = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: "",
    school: "",
    avatarUrl: "",
  });
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const { data } = await api.get("/student/profile");
        if (!active) return;
        const first = data.user?.firstName || "";
        const last = data.user?.lastName || "";
        const fullName = `${first} ${last}`.trim() || "Student";
        setProfile({
          name: fullName,
          school: data.user?.schoolName || "ClassIQ",
          avatarUrl: resolveMediaUrl(data.user?.avatarUrl || ""),
        });
      } catch (err) {
        console.error("Failed to load sidebar profile", err);
        if (!active) return;
        setProfile((prev) => ({
          ...prev,
          name: prev.name || "Student",
          school: prev.school || "School",
        }));
      } finally {
        if (active) setProfileLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    api.post("/auth/logout").catch(() => {});
    localStorage.clear();
    navigate("/login");
  };

  const menuItems = [
    {
      icon: <LayoutGrid size={22} strokeWidth={2.5} />,
      label: "Dashboard",
      path: "/student",
    },
    {
      icon: <BookOpen size={22} strokeWidth={2.5} />,
      label: "My PLP",
      path: "/student/plp",
    },
    {
      icon: <GraduationCap size={22} strokeWidth={2.5} />,
      label: "My Courses",
      path: "/student/my-courses",
    },
    {
      icon: <Library size={22} strokeWidth={2.5} />,
      label: "Resources",
      path: "/student/resources",
    },
    {
      icon: <FileText size={22} strokeWidth={2.5} />,
      label: "Assessments & Grades",
      path: "/student/assessments",
    },
    {
      icon: <ClipboardList size={22} strokeWidth={2.5} />,
      label: "Assignments",
      path: "/student/assignments",
    },
    {
      icon: <Brain size={22} strokeWidth={2.5} />,
      label: "Exercises",
      path: "/student/Exercise",
    },
  ];

  return (
    <div className="h-screen w-[300px] bg-white flex flex-col border-r border-slate-200 shadow-sm">
      <div className="pt-10 px-8 flex items-center gap-3">
        <div className="w-15 h-15 flex items-center justify-center overflow-hidden">
          <img
            src={logo}
            alt="ClassIQ logo"
            className="w-full h-full object-contain"
          />
        </div>
        <span className="text-2xl font-black text-slate-900 tracking-tight">
          ClassIQ
        </span>
      </div>
      <nav className="flex-1 px-4 mt-8 space-y-2">
        {menuItems.map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            end={item.path === "/student"}
            className={({ isActive }) => `
              group flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300
              ${
                isActive
                  ? "bg-[#EBF2FF] text-[#2D70FD] shadow-sm font-bold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold"
              }
            `}
          >
            <span className="transition-transform duration-300 group-hover:scale-110">
              {item.icon}
            </span>
            <span className="text-[16px] tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 pb-10 space-y-4">
        <NavLink to="/student/profile" className="group block">
          <div className="flex items-center gap-3 rounded-3xl bg-blue-50/40 px-4 py-4 transition-all duration-300 hover:bg-blue-50/60 border border-transparent hover:border-blue-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 aspect-square rounded-full overflow-hidden bg-white text-slate-400 flex flex-shrink-0 items-center justify-center font-bold border border-slate-200">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        profile.name,
                      )}`;
                    }}
                  />
                ) : (
                  <User size={22} className="text-blue-500" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate">
                  {profileLoading ? (
                    <span className="block h-4 w-24 rounded bg-slate-200 animate-pulse" />
                  ) : (
                    profile.name || "Student"
                  )}
                </p>
                <p className="text-[12px] text-slate-500 truncate">
                  {profileLoading ? (
                    <span className="mt-1 block h-3 w-20 rounded bg-slate-200 animate-pulse" />
                  ) : (
                    profile.school || "School"
                  )}
                </p>
              </div>
            </div>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 px-5 py-3 text-slate-500 hover:text-red-600 transition-colors cursor-pointer group font-bold text-[16px]"
        >
          <LogOut
            size={22}
            strokeWidth={2.5}
            className="group-hover:-translate-x-1 transition-transform"
          />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
