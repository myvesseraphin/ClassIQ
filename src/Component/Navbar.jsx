import React from "react";
import {
  Search,
  Bell,
  Settings,
  Command,
  HelpCircle,
  Sparkles,
} from "lucide-react";

const Navbar = () => {
  return (
    <div className="h-20 bg-white border-b border-slate-100 sticky top-0 z-30 px-8 flex items-center justify-between">
      <div className="flex-1 relative max-w-xl mx-12 group">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD] transition-colors"
          size={18}
        />
        <input
          type="text"
          placeholder="Search anything"
          className="w-full bg-white border border-slate-100 py-3 pl-12 pr-16 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2D70FD]/30 transition-all shadow-sm"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-1 bg-slate-50 border border-slate-100 rounded-lg pointer-events-none">
          <Command size={10} className="text-slate-300" strokeWidth={3} />
          <span className="text-[10px] font-black text-slate-300">K</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all">
          <HelpCircle size={22} />
        </button>

        <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] hover:border-blue-100 shadow-sm relative transition-all group">
          <Bell size={20} className="group-hover:shake" />
          <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
        <button className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all group">
          <Settings
            size={22}
            className="group-hover:rotate-45 transition-transform duration-500"
          />
        </button>
      </div>
    </div>
  );
};

export default Navbar;
