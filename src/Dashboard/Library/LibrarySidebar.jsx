import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { LayoutGrid, Library, LogOut, ArrowLeft } from "lucide-react";

const LibrarySidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate("/library-login");
  };

  const menuItems = [
    {
      icon: <LayoutGrid size={22} strokeWidth={2.5} />,
      label: "Library Dashboard",
      path: "/library",
    },
    {
      icon: <Library size={22} strokeWidth={2.5} />,
      label: "Resources",
      path: "/library/resources",
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
          Library
        </span>
      </div>
      <nav className="flex-1 px-4 mt-8 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/library"}
            className={({ isActive }) => `
              group flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all duration-300
              ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm font-bold"
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

export default LibrarySidebar;
