import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Command, HelpCircle, Search } from "lucide-react";
import api from "../../api/client";

const AdminNavbar = () => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

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
    let active = true;
    api
      .get("/admin/requests", { params: { status: "pending", limit: 1 } })
      .then(({ data }) => {
        if (!active) return;
        const total = Number(data?.total);
        setPendingRequests(Number.isFinite(total) ? total : 0);
      })
      .catch(() => {
        if (active) setPendingRequests(0);
      });
    return () => {
      active = false;
    };
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
        const { data } = await api.get("/admin/search", {
          params: { q: trimmed },
        });
        if (active) {
          setSearchResults(data?.results || {});
        }
      } catch (err) {
        console.error("Admin search failed", err);
        if (active) setSearchResults({});
      } finally {
        if (active) setIsSearching(false);
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  const quickLinks = useMemo(
    () => [
      { id: "ql-dashboard", title: "Dashboard", route: "/admin" },
      { id: "ql-users", title: "Users", route: "/admin/users" },
      { id: "ql-requests", title: "Access Requests", route: "/admin/requests" },
      { id: "ql-resources", title: "Resources", route: "/admin/resources" },
      { id: "ql-reports", title: "Reports", route: "/admin/reports" },
      { id: "ql-settings", title: "Settings", route: "/admin/settings" },
      { id: "ql-profile", title: "Profile", route: "/admin/profile" },
      { id: "ql-help", title: "Help Center", route: "/admin/help" },
    ],
    [],
  );

  const quickMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return quickLinks.filter((link) => link.title.toLowerCase().includes(q));
  }, [quickLinks, searchQuery]);

  const sections = useMemo(
    () => [
      { key: "users", label: "Users" },
      { key: "requests", label: "Requests" },
      { key: "resources", label: "Resources" },
      { key: "lessons", label: "Lesson Tracker" },
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
          placeholder="Search users, requests, resources..."
          aria-label="Search"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setIsOpen(false);
            if (e.key === "Enter" && firstResult) handleSelect(firstResult);
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

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={() => navigate("/admin/help")}
          className="p-2.5 md:p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
        >
          <HelpCircle size={22} />
        </button>

        <button
          onClick={() => navigate("/admin/requests")}
          className="p-2.5 md:p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] hover:border-blue-100 shadow-sm relative transition-all group"
          aria-label="Access requests"
        >
          <Bell size={20} />
          {pendingRequests > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {pendingRequests > 9 ? "9+" : pendingRequests}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminNavbar;

