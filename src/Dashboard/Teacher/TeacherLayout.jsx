import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Menu, X } from "lucide-react";
import TeacherSidebar from "./TeacherSidebar";
import TeacherNavbar from "./TeacherNavbar";
import logo from "../../assets/logo.png";
import useNotificationPoller from "../../Component/useNotificationPoller";

const TeacherLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount, hasNew, requestPermission } =
    useNotificationPoller("teacher");

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-[60] lg:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-72 transform bg-white border-r border-slate-100 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 
          ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        <TeacherSidebar />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center justify-between p-4 lg:hidden">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src={logo} alt="ClassIQ Logo" className="h-8 w-auto" />
              <span className="font-black text-xl tracking-tighter text-slate-900 truncate">
                ClassIQ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  requestPermission();
                  navigate("/teacher/notifications");
                }}
                className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-600 hover:text-[#2D70FD] hover:border-blue-100 transition-colors relative"
                aria-label="Open notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {hasNew && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400/70 animate-ping" />
                )}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2.5 rounded-2xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors active:scale-95"
                aria-label="Toggle Menu"
              >
                {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
          <div className="hidden lg:block">
            <TeacherNavbar
              unreadCount={unreadCount}
              hasNew={hasNew}
              requestPermission={requestPermission}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="max-w-[1600px] mx-auto px-4 py-6 lg:px-10 lg:py-10 animate-in fade-in duration-500">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeacherLayout;

