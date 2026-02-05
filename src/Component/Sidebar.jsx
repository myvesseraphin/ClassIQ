import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import {
  LayoutGrid,
  BookOpen,
  FileText,
  Brain,
  Library,
  UserCircle,
  Settings,
  LogOut,
} from "lucide-react";

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
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
      icon: <Brain size={22} strokeWidth={2.5} />,
      label: "Exercises",
      path: "/student/Exercise",
    },
    {
      icon: <UserCircle size={22} strokeWidth={2.5} />,
      label: "Profile",
      path: "/student/profile",
    },
  ];

  return (
    <div className="h-screen w-[300px] bg-white flex flex-col border-r border-slate-200 shadow-sm">
      <div className="pt-10 px-8 flex items-center gap-3">
        <div className="w-15 h-15 flex items-center justify-center overflow-hidden">
          <img
            src={logo}
            alt="ClassIQ Logo"
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
      <div className="px-4 pb-10 space-y-1">
        <NavLink
          to="/student/settings"
          className="flex items-center gap-4 px-5 py-3 text-slate-500 hover:text-slate-900 transition-colors font-bold text-[16px]"
        >
          <Settings size={22} strokeWidth={2.5} />
          <span>Settings</span>
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
