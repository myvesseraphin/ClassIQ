import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  Users,
  UserCheck,
  BookOpen,
  FileText,
  TrendingUp,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";

const AdminHome = () => {
  const defaultSummary = [
    { label: "Students", current: 0, total: 0, percent: "0%" },
    { label: "Teachers", current: 0, total: 0, percent: "0%" },
    { label: "Resources", current: 0, total: 0, percent: "0%" },
    { label: "Assessments", current: 0, total: 0, percent: "0%" },
  ];
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboard, setDashboard] = useState({
    admin: {
      name: "Administrator",
      school: "School not set",
      avatarUrl: "",
      email: "",
    },
    summary: defaultSummary,
    trend: [],
    requests: [],
    recentUsers: [],
  });

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        if (!active) return;
        setDashboard((prev) => ({
          ...prev,
          ...data,
          summary:
            Array.isArray(data.summary) && data.summary.length > 0
              ? data.summary
              : prev.summary,
          trend: Array.isArray(data.trend) ? data.trend : prev.trend,
          requests: Array.isArray(data.requests) ? data.requests : prev.requests,
          recentUsers: Array.isArray(data.recentUsers)
            ? data.recentUsers
            : prev.recentUsers,
        }));
      } catch (err) {
        console.error("Failed to load admin dashboard", err);
        toast.error("Failed to load admin dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const summaryIcons = {
    Students: <Users size={20} />,
    Teachers: <UserCheck size={20} />,
    Resources: <BookOpen size={20} />,
    Assessments: <FileText size={20} />,
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return dashboard.requests;
    const query = searchQuery.toLowerCase();
    return dashboard.requests.filter((req) => {
      const label = `${req.fullName || ""} ${req.email || ""}`.toLowerCase();
      return label.includes(query);
    });
  }, [dashboard.requests, searchQuery]);

  const trendValues = dashboard.trend.map((point) => point.val);
  const maxTrend = Math.max(1, ...trendValues);
  const minTrend = Math.min(...trendValues, 0);
  const scale = maxTrend - minTrend === 0 ? 1 : maxTrend - minTrend;

  const chartPoints = useMemo(() => {
    const points = Array.isArray(dashboard.trend) ? dashboard.trend : [];
    if (points.length === 0) return [];
    const step = points.length > 1 ? 300 / (points.length - 1) : 0;
    return points.map((point, idx) => {
      const x = 50 + idx * step;
      const normalized = (Number(point.val || 0) - minTrend) / scale;
      const y = 80 - normalized * 60;
      return {
        x,
        y,
        label: point.label,
        val: Number(point.val || 0),
      };
    });
  }, [dashboard.trend, minTrend, scale]);

  const linePath =
    chartPoints.length > 0
      ? chartPoints
          .map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x},${point.y}`)
          .join(" ")
      : "";

  if (loading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-[#F8FAFC] rounded-[2rem]">
        <Loader2 className="animate-spin text-[#2D70FD]" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-700 font-sans">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
        <div className="no-scrollbar p-2 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <div className="flex-1 relative max-w-md group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                  size={18}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search access requests..."
                  className="w-full bg-white border-2 border-slate-100 py-3 pl-11 pr-4 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD] shadow-sm transition-all"
                />
              </div>
              <button
                onClick={() => navigate("/admin/requests")}
                className="p-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] shadow-sm relative transition-all active:scale-90"
                aria-label="Open notifications"
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#2D70FD] rounded-full border-2 border-white"></span>
              </button>
            </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Welcome back, {dashboard.admin.name.split(" ")[0] || "Leader"}
            </h1>
            <p className="text-slate-400 font-bold text-sm">
              District Operations Dashboard
            </p>
          </div>

          <section className="bg-[#2D70FD] rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 border-[20px] border-white/10 rounded-full" />
            <div className="absolute -right-20 -bottom-20 w-60 h-60 border-[40px] border-white/5 rounded-full" />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-90">
                System Overview
              </h3>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/10">
                {dashboard.admin.school}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {dashboard.summary.map((stat, i) => {
                const percentValue = parseInt(stat.percent, 10) || 0;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 pb-4 border-b border-white/10 last:border-b-0 md:border-b-0 md:border-r md:border-white/10 md:last:border-r-0 md:pr-4 md:pb-0"
                  >
                    <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-lg text-[#2D70FD] overflow-hidden">
                      <svg
                        className="absolute w-full h-full transform -rotate-90"
                        viewBox="0 0 36 36"
                      >
                        <path
                          className="text-blue-100"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeOpacity="0.2"
                        />
                        <path
                          className="text-[#2D70FD]"
                          strokeDasharray={`${percentValue}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                      </svg>
                      <div className="relative z-10">
                        {summaryIcons[stat.label] || <TrendingUp size={20} />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 opacity-80">
                        {stat.label}
                      </p>
                      <div className="flex items-center gap-2">
                        <h4 className="text-2xl font-black">
                          {stat.current}
                        </h4>
                        <span className="px-2 py-0.5 bg-white/20 text-[10px] font-black rounded-lg">
                          {stat.percent}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full">
                <h3 className="text-lg font-black text-slate-800 mb-10 flex items-center gap-2">
                  Enrollment Trend{" "}
                  <TrendingUp size={18} className="text-[#2D70FD]" />
                </h3>
                <div className="relative h-48 w-full">
                  <svg
                    viewBox="0 0 400 100"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient
                        id="adminTrend"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#dbeafe" />
                        <stop offset="100%" stopColor="#2D70FD" />
                      </linearGradient>
                    </defs>
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="url(#adminTrend)"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    )}
                    {chartPoints.map((point, i) => {
                      return (
                        <g key={`${point.label || "m"}-${i}`}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="6"
                            fill="#2D70FD"
                            stroke="white"
                            strokeWidth="2"
                          />
                          <text
                            x={point.x}
                            y="115"
                            textAnchor="middle"
                            className="text-[10px] font-bold fill-slate-400 uppercase"
                          >
                            {point.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  {dashboard.trend.length === 0 && (
                    <p className="text-sm text-slate-400 text-center">
                      No trend data yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <section className="relative overflow-hidden bg-white/40 backdrop-blur-md border border-white/20 rounded-[2.5rem] p-8 shadow-xl h-full flex flex-col items-center justify-center text-center">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-400/20 rounded-full" />

                <p className="text-[10px] font-black text-[#2D70FD] uppercase tracking-[0.2em] mb-4 relative z-10">
                  Admin Focus
                </p>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight relative z-10">
                  Access & Growth
                </h2>
                <div className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-100 relative z-10">
                  {dashboard.requests.length} pending requests
                </div>
              </section>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-[#2D70FD] rounded-2xl">
                <UserCheck size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Access Requests
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                  Review and approve new staff or student access.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/admin/requests")}
              className="bg-[#2D70FD] text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#1F5AE0] transition-all shadow-lg active:scale-95"
            >
              Review Now <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
        <div className="space-y-10">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-blue-50 p-1 overflow-hidden">
              <img
                src={
                  resolveMediaUrl(dashboard.admin.avatarUrl) ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    dashboard.admin.name || "Admin",
                  )}`
                }
                className="w-full h-full object-cover rounded-full bg-blue-50"
                alt="Profile"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    dashboard.admin.name || "Admin",
                  )}`;
                }}
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {dashboard.admin.name}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                {dashboard.admin.email || "Principal"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {dashboard.admin.school}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <style>{`.rdp { --rdp-cell-size: 38px; --rdp-accent-color: #2D70FD; margin: 0; } .rdp-day_selected:not([disabled]) { font-weight: 900; background-color: #2D70FD; } .rdp-day { font-weight: 600; }`}</style>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              components={{
                IconLeft: () => <ChevronLeft size={16} />,
                IconRight: () => <ChevronRight size={16} />,
              }}
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Pending Requests
              </h3>
              <button
                onClick={() => navigate("/admin/requests")}
                className="text-[10px] font-black text-[#2D70FD] uppercase tracking-wider hover:underline"
              >
                View all
              </button>
            </div>
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No pending requests
                </p>
              ) : (
                filteredRequests.slice(0, 4).map((request) => (
                  <div
                    key={request.id}
                    className="p-4 bg-slate-50 border border-slate-100 rounded-xl"
                  >
                    <p className="text-[13px] font-bold text-slate-800">
                      {request.fullName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {request.school || "School"} | {request.createdAt}
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest text-[#2D70FD]">
                      {request.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Recent Users
                </h3>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                {dashboard.recentUsers.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No recent users
                  </p>
                ) : (
                  dashboard.recentUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-4 bg-slate-50 border border-slate-100 rounded-xl"
                    >
                      <p className="text-[13px] font-bold text-slate-800">
                        {user.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {user.role} | {user.createdAt}
                      </p>
                      <span className="inline-block mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {user.email}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Quick Actions
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/admin/users")}
                  className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <Users size={20} className="mx-auto mb-2 text-[#2D70FD]" />
                  <span className="text-[11px] font-black text-[#1F5AE0] uppercase tracking-wide">
                    Users
                  </span>
                </button>
                <button
                  onClick={() => navigate("/admin/reports")}
                  className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <CheckCircle2
                    size={20}
                    className="mx-auto mb-2 text-[#2D70FD]"
                  />
                  <span className="text-[11px] font-black text-[#1F5AE0] uppercase tracking-wide">
                    Reports
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default AdminHome;
