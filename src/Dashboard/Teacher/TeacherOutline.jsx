import React, { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Clock } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const TeacherOutline = () => {
  const [planning, setPlanning] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadPlanning = async () => {
      try {
        const { data } = await api.get("/teacher/planning/today");
        if (!active) return;
        setPlanning(data || null);
      } catch (err) {
        console.error("Failed to load planning", err);
        toast.error("Failed to load daily planning data.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadPlanning();
    return () => {
      active = false;
    };
  }, []);

  const groupedSessions = useMemo(() => {
    if (!planning?.allSessions?.length) return {};
    return planning.allSessions.reduce((acc, session) => {
      if (!acc[session.day]) acc[session.day] = [];
      acc[session.day].push(session);
      return acc;
    }, {});
  }, [planning]);

  if (isLoading) {
    return <TeacherPageSkeleton variant="outline" />;
  }

  if (!planning) {
    return <EmptyState />;
  }

  const todaySessions = planning.todaySessions || [];
  const backlog = planning.backlog || [];
  const totalSessions = planning.allSessions?.length || 0;
  const sessionsWithGuides = (planning.allSessions || []).filter(
    (session) => (session?.guide?.steps || []).length > 0,
  ).length;
  const curriculumCoverage = totalSessions
    ? Math.round((sessionsWithGuides / totalSessions) * 100)
    : 0;
  const completedBacklog = backlog.filter((task) => task.completed).length;
  const backlogCompletionRate = backlog.length
    ? Math.round((completedBacklog / backlog.length) * 100)
    : 0;
  const nextPriorities = backlog
    .filter((task) => !task.completed)
    .slice(0, 4);
  const dayLoad = Object.entries(groupedSessions).map(([day, sessions]) => ({
    day,
    count: sessions.length,
  }));

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Teaching Plan Today
            </h1>
            <p className="text-sm font-bold text-slate-400">
              {planning.dayLabel || "Today"} | {planning.date || "--"}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-3 bg-[#2D70FD] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-sm"
          >
            Print plan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Today's Sessions"
            value={todaySessions.length}
            icon={<Calendar size={20} />}
            tone="blue"
            note="Classes to teach"
          />
          <StatCard
            label="Action Steps"
            value={todaySessions.reduce(
              (sum, session) => sum + (session?.guide?.steps?.length || 0),
              0,
            )}
            icon={<CheckCircle2 size={20} />}
            tone="green"
            note="Guided teaching actions"
          />
          <StatCard
            label="Priority Tasks"
            value={backlog.filter((task) => !task.completed).length}
            icon={<Clock size={20} />}
            tone="blue"
            note="Due today or earlier"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Curriculum Manager
            </p>
            <h3 className="text-xl font-black text-slate-800 mt-1">
              Weekly Coverage and Delivery
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <MiniStat
                label="Planned Sessions"
                value={totalSessions}
                note="This week"
              />
              <MiniStat
                label="Guided Sessions"
                value={sessionsWithGuides}
                note={`${curriculumCoverage}% coverage`}
              />
              <MiniStat
                label="Backlog Done"
                value={completedBacklog}
                note={`${backlogCompletionRate}% complete`}
              />
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                <span>Backlog completion</span>
                <span>{backlogCompletionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-[#2D70FD]"
                  style={{ width: `${backlogCompletionRate}%` }}
                />
              </div>
            </div>
            {dayLoad.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {dayLoad.map((item) => (
                  <div
                    key={item.day}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                  >
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {item.day}
                    </span>
                    <span className="text-sm font-black text-slate-800">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Assignment Focus
            </p>
            <h3 className="text-lg font-black text-slate-800 mt-1 mb-4">
              Next Priority Tasks
            </h3>
            {nextPriorities.length === 0 ? (
              <p className="text-sm text-slate-400">
                No pending curriculum tasks.
              </p>
            ) : (
              <div className="space-y-3">
                {nextPriorities.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50"
                  >
                    <p className="text-sm font-black text-slate-800">
                      {task.title}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Due: {task.due || "No due date"} | Priority:{" "}
                      {task.priority || "medium"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {todaySessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {todaySessions.map((session) => (
              <div
                key={session.id}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {session.day} | {session.time || "TBD"}
                    </p>
                    <h2 className="text-2xl font-black text-slate-900 mt-1">
                      {session.title}
                    </h2>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Room: {session.room || "TBD"} | Instructor:{" "}
                      {session.instructor || "Teacher"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      Classroom Example
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-2">
                      {session?.guide?.classroomExample || "No example generated."}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Diagnostic Check
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-2">
                      {session?.guide?.diagnosticCheck || "No diagnostic check generated."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {(session?.guide?.steps || []).map((step, index) => (
                    <div
                      key={`${session.id}-step-${index}`}
                      className="flex items-start gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-4">
              Timetable Overview
            </h3>
            {Object.keys(groupedSessions).length === 0 ? (
              <p className="text-sm text-slate-400">No timetable yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedSessions).map(([day, sessions]) => (
                  <div key={day} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {day}
                    </p>
                    <div className="mt-2 space-y-2">
                      {sessions.map((session, index) => (
                        <div
                          key={`${day}-${index}`}
                          className="flex items-center justify-between text-sm font-semibold text-slate-700"
                        >
                          <span>{session.title}</span>
                          <span className="text-slate-500">{session.time || "TBD"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-800 mb-4">
              Priority Backlog
            </h3>
            {backlog.length === 0 ? (
              <p className="text-sm text-slate-400">No pending tasks.</p>
            ) : (
              <div className="space-y-3">
                {backlog.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-800">
                        {task.title}
                      </p>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        Due: {task.due || "No due date"} | Priority:{" "}
                        {task.priority || "medium"}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        task.completed
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {task.completed ? "Done" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, note, icon, tone }) => {
  const toneClasses =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm">
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${toneClasses}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-800 leading-none mt-1">
          {value}
        </p>
        <p className="text-xs font-bold text-slate-400 mt-1">{note}</p>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, note }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <p className="text-2xl font-black text-slate-800 mt-1 leading-none">
      {value}
    </p>
    <p className="text-xs font-bold text-slate-400 mt-1">{note}</p>
  </div>
);

export default TeacherOutline;

