import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const AdminReports = () => {
  const [dashboard, setDashboard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeCategory, setActiveCategory] = useState("academic");

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        if (!active) return;
        setDashboard(data || null);
      } catch (err) {
        console.error("Failed to load reports", err);
        toast.error("Failed to load reports.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const trendPoints = Array.isArray(dashboard?.trend) ? dashboard.trend : [];
  const trendValues = trendPoints.map((p) => Number(p.val) || 0);
  const maxTrend = Math.max(1, ...trendValues);
  const minTrend = Math.min(...trendValues, 0);
  const scale = maxTrend - minTrend === 0 ? 1 : maxTrend - minTrend;

  const linePath = useMemo(() => {
    if (trendPoints.length === 0) return "";
    const points = trendPoints.map((point, index) => {
      const x = 50 + index * 100;
      const normalized = ((Number(point.val) || 0) - minTrend) / scale;
      const y = 80 - normalized * 60;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [trendPoints, minTrend, scale]);

  const exportSnapshot = async () => {
    if (!dashboard) return;
    setIsExporting(true);
    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        dashboard,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "classiq-admin-report-snapshot.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Report snapshot exported.");
    } catch (err) {
      console.error("Failed to export snapshot", err);
      toast.error("Failed to export snapshot.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!dashboard) {
    return <EmptyState />;
  }

  const summary = Array.isArray(dashboard.summary) ? dashboard.summary : [];
  const requests = Array.isArray(dashboard.requests) ? dashboard.requests : [];
  const recentUsers = Array.isArray(dashboard.recentUsers)
    ? dashboard.recentUsers
    : [];
  const reportCategories = [
    { id: "academic", label: "Academic Reports" },
    { id: "curriculum", label: "Curriculum Reports" },
    { id: "teacher", label: "Teacher Activity Reports" },
    { id: "performance", label: "Performance Reports" },
  ];

  const categorizedItems = {
    academic: summary.map((item) => ({
      id: item.label,
      title: item.label,
      subtitle: `Current value: ${item.current}`,
    })),
    curriculum: requests.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.fullName || item.email || "Curriculum Update",
      subtitle: `${item.school || "--"} | ${item.status || "pending"}`,
    })),
    teacher: recentUsers
      .filter((item) => String(item.role || "").toLowerCase() === "teacher")
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.name || item.email,
        subtitle: `${item.email} | ${item.createdAt || "--"}`,
      })),
    performance: (dashboard.weakSubjects || []).slice(0, 8).map((item, index) => ({
      id: `${item.subject || item.name}-${index}`,
      title: item.subject || item.name || "Subject",
      subtitle: `Average score: ${Number(item.score) || 0}%`,
    })),
  };

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Reports
            </h1>
            <p className="text-sm font-bold text-slate-400">
              Exportable snapshots and operational summaries.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportPdf}
              className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Export PDF
            </button>
            <button
              onClick={exportSnapshot}
              disabled={isExporting}
              className="px-5 py-3 rounded-2xl bg-[#2D70FD] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 disabled:opacity-60"
            >
              <Download size={16} className="inline -mt-0.5 mr-2" />
              {isExporting ? "Exporting..." : "Export JSON"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summary.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.current}
              icon={
                item.label === "Students" ? (
                  <Users size={18} />
                ) : item.label === "Teachers" ? (
                  <UserCheck size={18} />
                ) : (
                  <FileText size={18} />
                )
              }
            />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-2">
                Enrollment Trend <TrendingUp size={18} className="text-blue-600" />
              </h3>
              <div className="relative h-48 w-full">
                <svg
                  viewBox="0 0 400 100"
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="adminReportTrend" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#dbeafe" />
                      <stop offset="100%" stopColor="#2D70FD" />
                    </linearGradient>
                  </defs>
                  {linePath ? (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="url(#adminReportTrend)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {trendPoints.map((point, i) => {
                    const x = 50 + i * 100;
                    const normalized = ((Number(point.val) || 0) - minTrend) / scale;
                    const y = 80 - normalized * 60;
                    return (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill="#2D70FD"
                          stroke="white"
                          strokeWidth="2"
                        />
                        <text
                          x={x}
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
                {trendPoints.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center">
                    No trend data yet.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-4">
                Report Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {reportCategories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                      activeCategory === category.id
                        ? "bg-[#2D70FD] text-white"
                        : "bg-white border border-slate-200 text-slate-500"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
                {(categorizedItems[activeCategory] || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No items in this category.</p>
                ) : (
                  (categorizedItems[activeCategory] || []).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <p className="text-sm font-black text-slate-800">{item.title}</p>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        {item.subtitle}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-6">
                Latest Access Requests
              </h3>
              {requests.length === 0 ? (
                <p className="text-sm text-slate-400">No requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {requests.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                    >
                      <p className="text-sm font-black text-slate-800">
                        {item.fullName || item.email}
                      </p>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        {item.school || "--"} | {item.status || "pending"} |{" "}
                        {item.createdAt || "--"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-6">
                Recent Users
              </h3>
              {recentUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No users found.</p>
              ) : (
                <div className="space-y-3">
                  {recentUsers.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate">
                          {item.name || item.email}
                        </p>
                        <p className="text-xs font-bold text-slate-400 mt-1 truncate">
                          {item.email} | {item.role} | {item.createdAt || "--"}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-xl bg-blue-50 text-[#2D70FD] text-[10px] font-black uppercase tracking-widest shrink-0">
                        {String(item.role || "user")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }) => (
  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

export default AdminReports;
