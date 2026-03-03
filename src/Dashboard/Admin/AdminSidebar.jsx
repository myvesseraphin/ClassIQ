import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  FileText,
  BookOpen,
  UserCheck,
  Shield,
  User,
  LogOut,
  ClipboardList,
  Activity,
  ScrollText,
  CalendarDays,
} from "lucide-react";
import api, { resolveMediaUrl } from "../../api/client";
import logo from "../../assets/logo.png";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState({
    name: "Administrator",
    school: "School not set",
    avatarUrl: "",
    email: "",
  });

  const handleLogout = () => {
    api.post("/auth/logout").catch(() => {});
    localStorage.clear();
    navigate("/login");
  };

  useEffect(() => {
    let active = true;
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (!active) return;
        const first = data?.user?.firstName?.trim();
        const last = data?.user?.lastName?.trim();
        const name =
          [first, last].filter(Boolean).join(" ") ||
          data?.user?.email ||
          "Administrator";
        const avatarUrl = data?.user?.avatarUrl
          ? resolveMediaUrl(data.user.avatarUrl)
          : "";
        setAdmin({
          name,
          school: data?.user?.school || "School not set",
          avatarUrl,
          email: data?.user?.email || "",
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const menuItems = [
    {
      icon: <LayoutGrid size={22} strokeWidth={2.5} />,
      label: "Dashboard",
      path: "/admin",
    },
    {
      icon: <Users size={22} strokeWidth={2.5} />,
      label: "Users",
      path: "/admin/users",
    },
    {
      icon: <UserCheck size={22} strokeWidth={2.5} />,
      label: "Access Requests",
      path: "/admin/requests",
    },
    {
      icon: <ClipboardList size={22} strokeWidth={2.5} />,
      label: "Curriculum Oversight",
      path: "/admin/curriculum",
    },
    {
      icon: <Activity size={22} strokeWidth={2.5} />,
      label: "Teacher Analytics",
      path: "/admin/teachers-analytics",
    },
    {
      icon: <CalendarDays size={22} strokeWidth={2.5} />,
      label: "Teacher Timetable",
      path: "/admin/teacher-timetable",
    },
    {
      icon: <BookOpen size={22} strokeWidth={2.5} />,
      label: "Curriculum Resources",
      path: "/admin/resources",
    },
    {
      icon: <FileText size={22} strokeWidth={2.5} />,
      label: "Reports",
      path: "/admin/reports",
    },
    {
      icon: <Shield size={22} strokeWidth={2.5} />,
      label: "Academic Management",
      path: "/admin/academic-management",
    },
    {
      icon: <ScrollText size={22} strokeWidth={2.5} />,
      label: "Audit Logs",
      path: "/admin/audit-logs",
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
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            className={({ isActive }) => `
              group flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300
              ${isActive ? "bg-[#EBF2FF] text-[#2D70FD] shadow-sm font-bold" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-bold"}
            `}
          >
            <span className="transition-transform duration-300 group-hover:scale-110">
              {item.icon}
            </span>
            <span className="text-[16px] tracking-tight">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 pb-8 space-y-3">
        <NavLink to="/admin/profile" className="group block">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-2 py-3 transition-all duration-300 hover:bg-slate-50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 text-slate-400 flex items-center justify-center font-bold">
                {admin.avatarUrl ? (
                  <img
                    src={admin.avatarUrl}
                    alt={admin.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={20} className="text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate">
                  {admin.name}
                </p>
                <p className="text-[12px] text-slate-500 truncate">
                  {admin.school}
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

        <p className="text-xs text-slate-400 text-center pt-2">
          Copyright 2026 ClassIQ
        </p>
      </div>
    </div>
  );
};

export default AdminSidebar;
