import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  HelpCircle,
  Bell,
  Command,
} from "lucide-react";
import api from "../../api/client";

const TeacherNavbar = ({
  unreadCount = 0,
  hasNew = false,
  requestPermission = () => {},
}) => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        if (inputRef.current?.select) inputRef.current.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }

    let active = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/teacher/search", {
          params: { q: trimmed },
        });
        if (active) {
          setSearchResults(data?.results || {});
        }
      } catch (error) {
        console.error("Teacher search failed", error);
        if (active) setSearchResults({});
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  const quickLinks = useMemo(
    () => [
      {
        id: "teacher-quick-dashboard",
        title: "Dashboard",
        keywords: ["dashboard", "home"],
        route: "/teacher",
      },
      {
        id: "teacher-quick-assessments",
        title: "Assessments",
        keywords: ["assessment", "scan", "tests"],
        route: "/teacher/assessments",
      },
      {
        id: "teacher-quick-plp",
        title: "PLP & Weak Areas",
        keywords: ["plp", "weak", "plans"],
        route: "/teacher/plp",
      },
      {
        id: "teacher-quick-exercises",
        title: "Exercises",
        keywords: ["exercise", "practice"],
        route: "/teacher/exercises",
      },
      {
        id: "teacher-quick-outline",
        title: "Teaching Plan",
        keywords: ["outline", "plan", "timetable", "schedule"],
        route: "/teacher/outline",
      },
      {
        id: "teacher-quick-reports",
        title: "Class Reports",
        keywords: ["report", "analytics", "progress"],
        route: "/teacher/reports",
      },
      {
        id: "teacher-quick-resources",
        title: "Resources",
        keywords: ["resources", "materials", "books"],
        route: "/teacher/resources",
      },
      {
        id: "teacher-quick-notifications",
        title: "Notifications",
        keywords: ["notification", "alerts"],
        route: "/teacher/notifications",
      },
      {
        id: "teacher-quick-profile",
        title: "Profile",
        keywords: ["profile", "account", "settings"],
        route: "/teacher/profile",
      },
      {
        id: "teacher-quick-help",
        title: "Help",
        keywords: ["help", "support"],
        route: "/teacher/help",
      },
    ],
    [],
  );

  const quickMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return quickLinks.filter((link) => {
      if (link.title.toLowerCase().includes(q)) return true;
      return link.keywords.some((keyword) => keyword.includes(q));
    });
  }, [quickLinks, searchQuery]);

  const sections = useMemo(
    () => [
      { key: "classes", label: "Classes" },
      { key: "tasks", label: "Tasks" },
      { key: "assessments", label: "Assessments" },
      { key: "plans", label: "PLP" },
      { key: "resources", label: "Resources" },
      { key: "reports", label: "Reports" },
    ],
    [],
  );

  const totalResults = useMemo(() => {
    let total = quickMatches.length;
    if (!searchResults) return total;
    return sections.reduce((sum, section) => {
      const items = searchResults[section.key] || [];
      return sum + items.length;
    }, total);
  }, [searchResults, sections, quickMatches]);

  const firstResult = useMemo(() => {
    if (quickMatches.length > 0) return quickMatches[0];
    if (!searchResults) return null;
    for (const section of sections) {
      const items = searchResults[section.key] || [];
      if (items.length > 0) return items[0];
    }
    return null;
  }, [quickMatches, searchResults, sections]);

  const handleSelect = (item) => {
    if (item?.route) navigate(item.route);
    setIsOpen(false);
  };

  return (
    <div className="h-16 lg:h-20 bg-white border-b border-slate-100 sticky top-0 z-30 px-4 md:px-5 lg:px-8 flex items-center justify-between gap-3 md:gap-4">
      <div className="flex-1 relative max-w-full md:max-w-lg lg:max-w-xl mx-1 md:mx-4 lg:mx-10 group min-w-0">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD] transition-colors"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search classes, reports, or plans"
          aria-label="Search"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsOpen(false);
            }
            if (e.key === "Enter" && firstResult) {
              handleSelect(firstResult);
            }
          }}
          className="w-full bg-white border border-slate-100 py-2.5 md:py-3 pl-11 md:pl-12 pr-4 md:pr-14 rounded-2xl text-xs md:text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2D70FD]/30 transition-all shadow-sm"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 px-1.5 py-1 bg-slate-50 border border-slate-100 rounded-lg pointer-events-none">
          <Command size={10} className="text-slate-300" strokeWidth={3} />
          <span className="text-[10px] font-black text-slate-300">K</span>
        </div>

        {isOpen && (searchQuery.trim() || searchResults) && (
          <div className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-40 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Search Results</span>
              {isSearching ? (
                <span className="text-blue-500">Searching...</span>
              ) : (
                <span>{totalResults} results</span>
              )}
            </div>

            {!isSearching && totalResults === 0 && (
              <div className="px-5 py-6 text-sm text-slate-500">
                No matches found.
              </div>
            )}

            {quickMatches.length > 0 && (
              <div className="py-4 border-b border-slate-50">
                <div className="px-5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Quick Links
                </div>
                <div className="border-y border-slate-100 divide-y divide-slate-100">
                  {quickMatches.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-5 py-3 hover:bg-blue-50/40 transition-all"
                    >
                      <div className="text-sm font-bold text-slate-800">
                        {item.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sections.map((section) => {
              const items = searchResults?.[section.key] || [];
              if (!items.length) return null;
              return (
                <div key={section.key} className="py-4 border-b border-slate-50">
                  <div className="px-5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                    {section.label}
                  </div>
                  <div className="border-y border-slate-100 divide-y divide-slate-100">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="w-full text-left px-5 py-3 hover:bg-blue-50/40 transition-all"
                      >
                        <div className="text-sm font-bold text-slate-800">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {item.subtitle}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={() => navigate("/teacher/help")}
          className="p-2.5 md:p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
        >
          <HelpCircle size={22} />
        </button>
        <button
          onClick={() => {
            requestPermission();
            navigate("/teacher/notifications");
          }}
          className="p-2.5 md:p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] hover:border-blue-100 shadow-sm relative transition-all group"
        >
          <Bell size={20} className="group-hover:shake" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {hasNew && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-400/70 animate-ping" />
          )}
        </button>
      </div>
    </div>
  );
};

export default TeacherNavbar;
