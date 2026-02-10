import React, { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Settings,
  Command,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import api from "../api/client";

const Navbar = () => {
  const inputRef = useRef(null);
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
  const navigate = useNavigate();

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
        const { data } = await api.get("/student/search", {
          params: { q: trimmed },
        });
        if (active) {
          setSearchResults(data?.results || {});
        }
      } catch (err) {
        console.error("Search failed", err);
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
        id: "ql-courses",
        title: "My Courses",
        keywords: ["course", "courses"],
        route: "/student/my-courses",
      },
      {
        id: "ql-exercises",
        title: "Exercises",
        keywords: ["exercise", "exercises", "quiz", "quizzes"],
        route: "/student/exercise",
      },
      {
        id: "ql-assessments",
        title: "Assessments",
        keywords: ["assessment", "assessments", "scores", "marks"],
        route: "/student/assessments",
      },
      {
        id: "ql-resources",
        title: "Resources",
        keywords: ["resource", "resources", "library", "material", "materials"],
        route: "/student/resources",
      },
      {
        id: "ql-plp",
        title: "PLP Bundle",
        keywords: ["plp", "bundle", "plan"],
        route: "/student/plp",
      },
      {
        id: "ql-tasks",
        title: "Tasks",
        keywords: ["task", "tasks", "todo"],
        route: "/student/tasks",
      },
      {
        id: "ql-schedule",
        title: "Schedule",
        keywords: ["schedule", "calendar", "timetable"],
        route: "/student/schedule",
      },
      {
        id: "ql-notifications",
        title: "Notifications",
        keywords: ["notification", "notifications", "alerts"],
        route: "/student/notifications",
      },
      {
        id: "ql-profile",
        title: "Profile",
        keywords: ["profile", "account", "settings"],
        route: "/student/profile",
      },
      {
        id: "ql-help",
        title: "Help Center",
        keywords: ["help", "support", "guide", "faq"],
        route: "/student/help",
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
      { key: "courses", label: "Courses" },
      { key: "tasks", label: "Tasks" },
      { key: "assessments", label: "Assessments" },
      { key: "exercises", label: "Exercises" },
      { key: "resources", label: "Resources" },
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
  }, [searchResults, sections]);

  const handleSelect = (item) => {
    if (item?.route) navigate(item.route);
    setIsOpen(false);
  };

  return (
    <div className="h-20 bg-white border-b border-slate-100 sticky top-0 z-30 px-8 flex items-center justify-between">
      <div className="flex-1 relative max-w-xl mx-12 group">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD] transition-colors"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search anything"
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
          className="w-full bg-white border border-slate-100 py-3 pl-12 pr-16 rounded-2xl text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-[#2D70FD]/30 transition-all shadow-sm"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-1 bg-slate-50 border border-slate-100 rounded-lg pointer-events-none">
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
                <div
                  key={section.key}
                  className="py-4 border-b border-slate-50"
                >
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
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/student/help")}
          className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
        >
          <HelpCircle size={22} />
        </button>

        <button
          onClick={() => navigate("/student/notifications")}
          className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] hover:border-blue-100 shadow-sm relative transition-all group"
        >
          <Bell size={20} className="group-hover:shake" />
          <span className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
        <button
          onClick={() => navigate("/student/profile")}
          className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all group"
        >
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
