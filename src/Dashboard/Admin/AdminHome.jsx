import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";

const fallback = {
  summary: [
    { label: "Curriculum Coverage", current: 0, percent: "0%" },
    { label: "Assessment Completion", current: 0, percent: "0%" },
    { label: "Teacher Compliance", current: 0, percent: "0%" },
    { label: "Average Performance", current: 0, percent: "0%" },
  ],
  termTrend: [],
  curriculumOverview: [],
  weakSubjects: [],
  teacherActivity: {
    incompleteLogs: [],
    missingAssessments: [],
  },
};

const AdminHome = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboard, setDashboard] = useState(fallback);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        if (!active) return;
        setDashboard({
          summary:
            Array.isArray(data?.academicSummary) && data.academicSummary.length
              ? data.academicSummary
              : fallback.summary,
          termTrend: Array.isArray(data?.termTrend) ? data.termTrend : [],
          curriculumOverview: Array.isArray(data?.curriculumOverview)
            ? data.curriculumOverview
            : [],
          weakSubjects: Array.isArray(data?.weakSubjects) ? data.weakSubjects : [],
          teacherActivity: data?.teacherActivity || fallback.teacherActivity,
        });
      } catch (err) {
        console.error("Failed to load admin dashboard", err);
        toast.error("Failed to load admin dashboard.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const delayedUnits = useMemo(
    () =>
      dashboard.curriculumOverview.reduce(
        (acc, cls) => acc + (Number(cls.delayedUnitsCount) || 0),
        0,
      ),
    [dashboard.curriculumOverview],
  );

  const subjectsBehind = useMemo(
    () =>
      dashboard.curriculumOverview.reduce((acc, cls) => {
        const list = Array.isArray(cls.behindScheduleSubjects)
          ? cls.behindScheduleSubjects
          : [];
        return acc + list.length;
      }, 0),
    [dashboard.curriculumOverview],
  );

  const schoolAverageScore = useMemo(() => {
    const entry = dashboard.summary.find((item) => item.label === "Average Performance");
    return entry?.current || 0;
  }, [dashboard.summary]);

  const chartPoints = useMemo(() => {
    const trend = Array.isArray(dashboard.termTrend) ? dashboard.termTrend : [];
    if (trend.length === 0) return [];
    const max = Math.max(1, ...trend.map((t) => Number(t.value) || 0));
    const min = Math.min(...trend.map((t) => Number(t.value) || 0), 0);
    const scale = max - min === 0 ? 1 : max - min;
    const step = trend.length > 1 ? 260 / (trend.length - 1) : 0;
    return trend.map((point, idx) => {
      const x = 40 + idx * step;
      const normalized = ((Number(point.value) || 0) - min) / scale;
      const y = 85 - normalized * 60;
      return { x, y, label: point.label, value: point.value };
    });
  }, [dashboard.termTrend]);

  const linePath =
    chartPoints.length > 0
      ? chartPoints
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`)
          .join(" ")
      : "";

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-[#F8FAFC] rounded-[2rem]">
        <Loader2 className="animate-spin text-[#2D70FD]" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-700 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Academic Intelligence Control Center
            </h1>
            <p className="text-sm font-bold text-slate-400 mt-1">
              Curriculum oversight, teacher consistency, and school performance insights.
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/teachers-analytics")}
            className="px-6 py-3 rounded-2xl bg-[#2D70FD] text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100"
          >
            Open Teacher Analytics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {dashboard.summary.map((item) => (
            <OverviewCard
              key={item.label}
              label={item.label}
              value={item.current}
              percent={item.percent}
              icon={
                item.label.includes("Curriculum") ? (
                  <BookOpen size={18} />
                ) : item.label.includes("Assessment") ? (
                  <ClipboardCheck size={18} />
                ) : item.label.includes("Teacher") ? (
                  <Users size={18} />
                ) : (
                  <TrendingUp size={18} />
                )
              }
            />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <section className="xl:col-span-5 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">
              Curriculum Completion Overview
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1">
              Completion by class, delayed units, and subjects behind schedule.
            </p>
            <div className="mt-6 space-y-4">
              {dashboard.curriculumOverview.slice(0, 6).map((item) => (
                <div key={item.classId || item.className}>
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-slate-700">{item.className || "Class"}</span>
                    <span className="text-slate-500">
                      {Number(item.completionPct) || 0}% complete
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(item.completionPct) || 0))}%`,
                      }}
                    />
                  </div>
                  {(item.behindScheduleSubjects || []).length > 0 ? (
                    <p className="mt-1 text-[11px] font-bold text-amber-700">
                      Behind: {(item.behindScheduleSubjects || []).join(", ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Chip label="Subjects Behind Schedule" value={subjectsBehind} tone="amber" />
              <Chip label="Delayed Units" value={delayedUnits} tone="rose" />
            </div>
            <button
              onClick={() => navigate("/admin/curriculum")}
              className="mt-6 text-[#2D70FD] text-xs font-black uppercase tracking-widest hover:underline"
            >
              Drill into curriculum oversight
            </button>
          </section>

          <section className="xl:col-span-7 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-900">
              School-wide Performance Snapshot
            </h2>
            <p className="text-sm font-bold text-slate-400 mt-1">
              Term trend comparison and weakest subject monitoring.
            </p>

            <div className="mt-5 p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                School Average Score
              </p>
              <p className="text-3xl font-black text-[#2D70FD] mt-1">
                {Number(schoolAverageScore) || 0}%
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                  Top 3 Weakest Subjects
                </h3>
                <div className="space-y-3">
                  {(dashboard.weakSubjects || []).slice(0, 3).map((subject) => (
                    <div
                      key={subject.subject || subject.name}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                    >
                      <span className="text-sm font-black text-slate-700">
                        {subject.subject || subject.name}
                      </span>
                      <span className="text-xs font-black text-rose-600">
                        {Number(subject.score) || 0}%
                      </span>
                    </div>
                  ))}
                  {dashboard.weakSubjects.length === 0 ? (
                    <p className="text-sm font-bold text-slate-400">No weak subjects data.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">
                  Term Performance Trend
                </h3>
                <div className="h-44 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <svg viewBox="0 0 320 120" className="w-full h-full">
                    {linePath ? (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#2D70FD"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {chartPoints.map((point) => (
                      <g key={point.label}>
                        <circle cx={point.x} cy={point.y} r="5" fill="#2D70FD" />
                        <text
                          x={point.x}
                          y="113"
                          textAnchor="middle"
                          className="text-[9px] font-black fill-slate-400 uppercase"
                        >
                          {point.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Teacher Activity Summary</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">
                Incomplete lesson logging and missing end-unit assessments.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/teachers-analytics")}
              className="text-xs font-black uppercase tracking-widest text-[#2D70FD] hover:underline"
            >
              Go to teacher analytics
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <TeacherListCard
              title="Incomplete Lesson Logs"
              items={dashboard.teacherActivity?.incompleteLogs || []}
              emptyText="No teachers with incomplete logs."
            />
            <TeacherListCard
              title="Missing End-unit Assessments"
              items={dashboard.teacherActivity?.missingAssessments || []}
              emptyText="No missing assessment records."
            />
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-amber-700">
                Action Required
              </p>
              <p className="text-sm font-bold text-amber-800 truncate">
                Follow up with flagged teachers before weekly review.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/teachers-analytics")}
              className="px-4 py-2 rounded-xl bg-white border border-amber-200 text-amber-700 font-black text-xs uppercase tracking-widest shrink-0"
            >
              Review <ArrowRight size={14} className="inline -mt-0.5 ml-1" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const OverviewCard = ({ label, value, percent, icon }) => (
  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      <p className="text-xs font-black text-[#2D70FD]">{percent || "--"}</p>
    </div>
  </div>
);

const Chip = ({ label, value, tone }) => {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 border-rose-100 text-rose-700"
      : "bg-amber-50 border-amber-100 text-amber-700";
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
    </div>
  );
};

const TeacherListCard = ({ title, items, emptyText }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">
      {title}
    </h3>
    {items.length === 0 ? (
      <p className="text-sm font-bold text-slate-400">{emptyText}</p>
    ) : (
      <div className="space-y-3">
        {items.slice(0, 6).map((item) => (
          <div key={item.id || item.name} className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 text-amber-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-700 truncate">
                {item.name || "Teacher"}
              </p>
              <p className="text-[11px] font-bold text-slate-400 truncate">
                {item.reason || "Missing submissions"}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default AdminHome;
