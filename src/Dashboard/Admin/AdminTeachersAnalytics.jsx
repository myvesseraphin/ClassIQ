import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const AdminTeachersAnalytics = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [sortBy, setSortBy] = useState("lessonLoggingConsistency");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await api.get("/admin/teacher-analytics");
        if (!active) return;
        setTeachers(Array.isArray(data?.teachers) ? data.teachers : []);
      } catch (err) {
        console.error("Failed to load teacher analytics", err);
        toast.error("Failed to load teacher analytics.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const sortedTeachers = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;
    return [...teachers].sort((a, b) => {
      const aVal = a?.[sortBy];
      const bVal = b?.[sortBy];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction;
      }
      return String(aVal || "").localeCompare(String(bVal || "")) * direction;
    });
  }, [teachers, sortBy, sortDir]);

  const weakTopics = useMemo(() => {
    const map = new Map();
    teachers.forEach((t) => {
      (t.weakTopics || []).forEach((topic) => {
        const key = String(topic).trim();
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [teachers]);

  const aggregate = useMemo(() => {
    if (!teachers.length) {
      return { consistency: 0, completion: 0, performance: 0 };
    }
    const sum = teachers.reduce(
      (acc, t) => {
        acc.consistency += Number(t.lessonLoggingConsistency) || 0;
        acc.completion += Number(t.assessmentCompletionRate) || 0;
        acc.performance += Number(t.averageStudentPerformance) || 0;
        return acc;
      },
      { consistency: 0, completion: 0, performance: 0 },
    );
    return {
      consistency: Math.round(sum.consistency / teachers.length),
      completion: Math.round(sum.completion / teachers.length),
      performance: Math.round(sum.performance / teachers.length),
    };
  }, [teachers]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDir("desc");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (teachers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Teacher Analytics
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Lesson logging quality, assessment completion, and performance impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Avg Lesson Logging Consistency"
            value={`${aggregate.consistency}%`}
            trend="up"
          />
          <KpiCard
            label="Avg Assessment Completion"
            value={`${aggregate.completion}%`}
            trend="up"
          />
          <KpiCard
            label="Avg Student Performance"
            value={`${aggregate.performance}%`}
            trend={aggregate.performance >= 60 ? "up" : "down"}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-8 bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">Teacher Performance Table</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <SortableTh label="Teacher" onClick={() => toggleSort("name")} />
                    <SortableTh
                      label="Lesson Logs"
                      onClick={() => toggleSort("lessonLoggingConsistency")}
                    />
                    <SortableTh
                      label="Assessment Rate"
                      onClick={() => toggleSort("assessmentCompletionRate")}
                    />
                    <SortableTh
                      label="Avg Performance"
                      onClick={() => toggleSort("averageStudentPerformance")}
                    />
                    <SortableTh label="Last Login" onClick={() => toggleSort("lastLogin")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-800">
                        {teacher.name || "Teacher"}
                        <div className="text-[11px] font-bold text-slate-400 mt-1">
                          {(teacher.weakTopics || []).slice(0, 2).join(", ") || "No recurring weak topics"}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {Number(teacher.lessonLoggingConsistency) || 0}%
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {Number(teacher.assessmentCompletionRate) || 0}%
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-600">
                        {Number(teacher.averageStudentPerformance) || 0}%
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-slate-400">
                        {teacher.lastLogin || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 mb-4">Recurring Weak Topics</h2>
              {weakTopics.length === 0 ? (
                <p className="text-sm font-bold text-slate-400">No weak-topic patterns yet.</p>
              ) : (
                <div className="space-y-3">
                  {weakTopics.map(([topic, hits]) => (
                    <div key={topic}>
                      <div className="flex items-center justify-between text-xs font-black text-slate-600">
                        <span className="truncate">{topic}</span>
                        <span>{hits} teacher(s)</span>
                      </div>
                      <div className="mt-1 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${Math.min(100, hits * 12)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 mb-4">Activity Trend</h2>
              <SimpleBars teachers={teachers} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SortableTh = ({ label, onClick }) => (
  <th className="px-8 py-4 text-xs font-black text-slate-400 tracking-tight uppercase">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-slate-700"
    >
      {label}
      <ArrowDownUp size={12} />
    </button>
  </th>
);

const KpiCard = ({ label, value, trend }) => (
  <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
    <p className="text-3xl font-black text-slate-800 mt-2">{value}</p>
    <div
      className={`mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest ${
        trend === "down" ? "text-rose-600" : "text-emerald-600"
      }`}
    >
      {trend === "down" ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
      {trend === "down" ? "Needs Attention" : "Stable"}
    </div>
  </div>
);

const SimpleBars = ({ teachers }) => {
  const top = [...teachers]
    .sort(
      (a, b) =>
        (Number(b.lessonLoggingConsistency) || 0) -
        (Number(a.lessonLoggingConsistency) || 0),
    )
    .slice(0, 5);
  if (top.length === 0) {
    return <p className="text-sm font-bold text-slate-400">No activity trend data.</p>;
  }
  return (
    <div className="space-y-3">
      {top.map((item) => (
        <div key={item.id}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span className="truncate">{item.name}</span>
            <span>{Number(item.lessonLoggingConsistency) || 0}%</span>
          </div>
          <div className="mt-1 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, Number(item.lessonLoggingConsistency) || 0),
                )}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminTeachersAnalytics;
