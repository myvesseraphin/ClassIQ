import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Users,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const TeacherAnalytics = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      try {
        const { data: payload } = await api.get("/teacher/analytics");
        if (active) setData(payload);
      } catch (err) {
        console.error("Failed to load analytics", err);
        toast.error("Failed to load analytics.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadAnalytics();
    return () => {
      active = false;
    };
  }, []);

  const summaryCards = useMemo(() => {
    if (!data?.totals) return [];
    return [
      {
        label: "Students",
        value: data.totals.students || 0,
        icon: <Users size={20} />,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "Assessments",
        value: data.totals.assessments || 0,
        icon: <TrendingUp size={20} />,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      },
      {
        label: "Avg Grade",
        value: data.totals.avgGrade || "—",
        icon: <Trophy size={20} />,
        color: "text-blue-600",
        bg: "bg-blue-50",
      },
      {
        label: "Completion",
        value: data.totals.completionRate || "0%",
        icon: <CheckCircle2 size={20} />,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
      },
    ];
  }, [data]);

  if (isLoading) {
    return <TeacherPageSkeleton variant="analytics" />;
  }

  if (!data) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Teaching Impact Analytics
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {summaryCards.map((card, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm"
            >
              <div
                className={`w-14 h-14 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center`}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {card.label}
                </p>
                <p className="text-2xl font-black text-slate-800 leading-none">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6">
              Term Performance Trend
            </h3>
            <div className="relative h-48 w-full">
              <svg
                viewBox="0 0 400 100"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="analyticsLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#EDF3FF" />
                    <stop offset="100%" stopColor="#2D70FD" />
                  </linearGradient>
                </defs>
                {data.trend?.length > 0 && (
                  <path
                    d={data.trend
                      .map((s, i) => {
                        const x = 50 + i * 100;
                        const y = 80 - (s.val - 60) * 2;
                        return `${i === 0 ? "M" : "L"} ${x},${y}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="url(#analyticsLine)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                )}
                {(data.trend || []).map((s, i) => {
                  const x = 50 + i * 100;
                  const y = 80 - (s.val - 60) * 2;
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
                        Term {s.term_id}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {(!data.trend || data.trend.length === 0) && (
                <p className="text-sm text-slate-400 text-center">
                  No term trend data available.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-6">
              Top Subjects
            </h3>
            {data.subjects?.length ? (
              <div className="space-y-4">
                {data.subjects.map((subject) => (
                  <div
                    key={subject.subject}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl"
                  >
                    <div>
                      <p className="font-black text-slate-800">
                        {subject.subject || "General"}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Assessments
                      </p>
                    </div>
                    <span className="text-xl font-black text-slate-700">
                      {subject.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No subject analytics yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherAnalytics;

