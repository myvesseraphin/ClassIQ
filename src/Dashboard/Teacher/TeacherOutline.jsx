import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const COMPLETION_STORAGE_PREFIX = "teacher-planning-completion";

const norm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const compact = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const previewText = (value, maxLength = 120) => {
  const cleaned = compact(value);
  if (!cleaned) return "";
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trimEnd()}...`;
};

const splitSessionTitle = (value) => {
  const cleaned = compact(value);
  if (!cleaned) {
    return { primary: "", secondary: "" };
  }
  const parts = cleaned.split(/\s*[-:|]\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return { primary: parts[0], secondary: parts[1] };
  }
  return { primary: cleaned, secondary: "" };
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const getDayRank = (value) => {
  const day = norm(value);
  const index = DAY_ORDER.findIndex((item) => norm(item) === day);
  return index === -1 ? DAY_ORDER.length + 1 : index;
};

const getTimeRank = (value) => {
  const text = compact(value).toLowerCase();
  if (!text) return Number.POSITIVE_INFINITY;
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return Number.POSITIVE_INFINITY;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const marker = String(match[3] || "").toLowerCase();
  if (marker === "pm" && hour < 12) hour += 12;
  if (marker === "am" && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  return hour * 60 + minute;
};

const getSessionKey = (session) =>
  [
    norm(session?.day),
    norm(session?.time),
    norm(session?.title),
    norm(session?.room),
    norm(session?.instructor),
  ].join("|");

const getWeekStartIso = (isoDate) => {
  const date = new Date(isoDate || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
};

const lessonRangeLabel = (lesson) => {
  const from = lesson?.pageFrom;
  const to = lesson?.pageTo;
  if (from && to) return `Pages ${from}-${to}`;
  if (from) return `Page ${from}`;
  if (to) return `Page ${to}`;
  return "";
};

const resolveSessionMeta = (session, lessonProgress) => {
  const titleParts = splitSessionTitle(session?.title);
  const titleSubject = titleParts.primary || compact(session?.guide?.topic) || "Subject";
  const titleClass =
    titleParts.secondary || compact(session?.guide?.classLabel) || compact(session?.room) || "Class";

  const subjectToken = norm(titleSubject);
  const classToken = norm(titleClass);

  const exactMatch = lessonProgress.find((item) => {
    if (norm(item?.subject) !== subjectToken) return false;
    if (!classToken) return true;
    const lessonClass = norm(item?.className);
    return lessonClass === classToken || lessonClass.includes(classToken) || classToken.includes(lessonClass);
  });

  const subjectMatch =
    exactMatch ||
    lessonProgress.find((item) => {
      const candidate = norm(item?.subject);
      return candidate && (candidate === subjectToken || candidate.includes(subjectToken) || subjectToken.includes(candidate));
    });

  const lesson = subjectMatch?.lesson || null;
  const subject = compact(subjectMatch?.subject || titleSubject || "Subject");
  const classLabel = compact(subjectMatch?.className || titleClass || "Class");
  const topic = compact(lesson?.topic || session?.guide?.topic || subject || "Topic");

  return {
    subject,
    classLabel,
    topic,
    lesson,
    range: lessonRangeLabel(lesson),
  };
};

const SummaryCard = ({ label, value, note, icon, accent = "text-[#2D70FD]" }) => (
  <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
    <div className={`w-14 h-14 rounded-2xl inline-flex items-center justify-center bg-blue-50 ${accent}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-1">{note}</p>
    </div>
  </div>
);

const TeacherOutline = () => {
  const [planning, setPlanning] = useState(null);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [sessionCompletion, setSessionCompletion] = useState({});
  const [activeSessionKey, setActiveSessionKey] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("All Classes");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadPlanning = async () => {
      try {
        const [planningResult, lessonResult] = await Promise.allSettled([
          api.get("/teacher/planning/today"),
          api.get("/teacher/lesson-progress"),
        ]);

        if (!active) return;

        if (planningResult.status !== "fulfilled") {
          throw planningResult.reason;
        }

        setPlanning(planningResult.value?.data || null);
        if (lessonResult.status === "fulfilled") {
          setLessonProgress(Array.isArray(lessonResult.value?.data?.lessons) ? lessonResult.value.data.lessons : []);
        } else {
          setLessonProgress([]);
        }
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

  const completionStorageKey = useMemo(() => {
    if (!planning?.date) return "";
    return `${COMPLETION_STORAGE_PREFIX}:${getWeekStartIso(planning.date)}`;
  }, [planning?.date]);

  useEffect(() => {
    if (!completionStorageKey) {
      setSessionCompletion({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(completionStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      setSessionCompletion(parsed && typeof parsed === "object" ? parsed : {});
    } catch (error) {
      console.warn("Failed to read teaching plan completion from storage", error);
      setSessionCompletion({});
    }
  }, [completionStorageKey]);

  useEffect(() => {
    if (!completionStorageKey) return;
    try {
      window.localStorage.setItem(completionStorageKey, JSON.stringify(sessionCompletion));
    } catch (error) {
      console.warn("Failed to store teaching plan completion", error);
    }
  }, [completionStorageKey, sessionCompletion]);

  const allSessionCards = useMemo(() => {
    const source =
      Array.isArray(planning?.allSessions) && planning.allSessions.length > 0
        ? planning.allSessions
        : planning?.todaySessions || [];

    return source
      .map((session) => {
        const key = getSessionKey(session);
        const meta = resolveSessionMeta(session, lessonProgress);
        const guideSteps = Array.isArray(session?.guide?.steps)
          ? session.guide.steps.filter(Boolean)
          : [];
        const dayLabel = compact(session?.day || planning?.dayLabel || "Today");

        return {
          ...session,
          key,
          meta,
          dayLabel,
          dayRank: getDayRank(dayLabel),
          timeRank: getTimeRank(session?.time),
          guideSteps,
          startPoint:
            guideSteps[0] ||
            `Start with a short recap before introducing ${meta.topic}.`,
          stopPoint:
            guideSteps[guideSteps.length - 1] ||
            session?.guide?.diagnosticCheck ||
            "Stop with an exit check and summarize the key idea.",
          completed: Boolean(sessionCompletion[key]),
        };
      })
      .sort((a, b) => {
        if (a.dayRank !== b.dayRank) return a.dayRank - b.dayRank;
        if (a.timeRank !== b.timeRank) return a.timeRank - b.timeRank;
        if (a.meta.classLabel !== b.meta.classLabel) {
          return a.meta.classLabel.localeCompare(b.meta.classLabel, undefined, {
            sensitivity: "base",
          });
        }
        return a.meta.subject.localeCompare(b.meta.subject, undefined, {
          sensitivity: "base",
        });
      });
  }, [
    planning?.allSessions,
    planning?.todaySessions,
    planning?.dayLabel,
    lessonProgress,
    sessionCompletion,
  ]);

  const dayOptions = useMemo(
    () =>
      Array.from(new Set(allSessionCards.map((session) => session.dayLabel).filter(Boolean))).sort(
        (a, b) => {
          const dayDiff = getDayRank(a) - getDayRank(b);
          if (dayDiff !== 0) return dayDiff;
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        },
      ),
    [allSessionCards],
  );

  useEffect(() => {
    if (dayOptions.length === 0) {
      setSelectedDay("");
      return;
    }
    setSelectedDay((previous) => {
      if (previous && dayOptions.includes(previous)) return previous;
      const todayMatch = dayOptions.find(
        (item) => norm(item) === norm(planning?.dayLabel),
      );
      return todayMatch || dayOptions[0];
    });
  }, [dayOptions, planning?.dayLabel]);

  const dayCards = useMemo(() => {
    if (!selectedDay) return allSessionCards;
    return allSessionCards.filter(
      (session) => norm(session.dayLabel) === norm(selectedDay),
    );
  }, [allSessionCards, selectedDay]);

  const classOptions = useMemo(() => {
    const values = Array.from(
      new Set(dayCards.map((session) => session.meta.classLabel).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return ["All Classes", ...values];
  }, [dayCards]);

  useEffect(() => {
    if (classOptions.includes(selectedClassFilter)) return;
    setSelectedClassFilter("All Classes");
  }, [classOptions, selectedClassFilter]);

  const visibleCards = useMemo(() => {
    if (selectedClassFilter === "All Classes") return dayCards;
    return dayCards.filter(
      (session) => norm(session.meta.classLabel) === norm(selectedClassFilter),
    );
  }, [dayCards, selectedClassFilter]);

  const activeSession = useMemo(
    () => allSessionCards.find((session) => session.key === activeSessionKey) || null,
    [allSessionCards, activeSessionKey],
  );

  useEffect(() => {
    if (!activeSessionKey) return;
    if (allSessionCards.some((session) => session.key === activeSessionKey)) return;
    setActiveSessionKey("");
  }, [allSessionCards, activeSessionKey]);

  const sessionTotal = visibleCards.length;
  const sessionCompleted = visibleCards.filter((session) => session.completed).length;
  const sessionPending = Math.max(sessionTotal - sessionCompleted, 0);
  const sessionPercent = sessionTotal
    ? Math.round((sessionCompleted / sessionTotal) * 100)
    : 0;
  const activeClassCount = new Set(
    visibleCards.map((session) => session.meta.classLabel).filter(Boolean),
  ).size;

  const pendingQueue = useMemo(
    () =>
      visibleCards
        .filter((session) => !session.completed)
        .sort((a, b) => a.timeRank - b.timeRank)
        .slice(0, 3),
    [visibleCards],
  );

  const nextPendingSession = pendingQueue[0] || null;
  const planFocusMessage = nextPendingSession
    ? `${nextPendingSession.meta.subject} for ${nextPendingSession.meta.classLabel} at ${
        nextPendingSession.time || "TBD"
      } is next.`
    : "No pending session in this view.";

  const updateCompletion = (session, completed) => {
    setSessionCompletion((previous) => {
      const next = { ...previous };
      if (completed) {
        next[session.key] = true;
      } else {
        delete next[session.key];
      }
      return next;
    });
  };

  if (isLoading) {
    return <TeacherPageSkeleton variant="outline" />;
  }

  if (!planning) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Teaching Task Manager</h1>
            <p className="text-sm font-semibold text-slate-500">
              {selectedDay || planning.dayLabel || "Today"} | Week of {planning.date || "--"}
            </p>
            <p className="text-sm font-semibold text-slate-500">{planFocusMessage}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-black uppercase tracking-widest"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-11 px-4 rounded-xl bg-[#2D70FD] text-white text-xs font-black uppercase tracking-widest"
            >
              Print Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            label="Sessions"
            value={sessionTotal}
            note={`${activeClassCount} class${activeClassCount === 1 ? "" : "es"} in scope`}
            icon={<Clock3 size={20} />}
            accent="text-[#2D70FD]"
          />
          <SummaryCard
            label="Completed"
            value={sessionCompleted}
            note={`${sessionPercent}% completion`}
            icon={<CheckCircle2 size={20} />}
            accent="text-emerald-600"
          />
          <SummaryCard
            label="Pending"
            value={sessionPending}
            note="Still to deliver"
            icon={<CalendarDays size={20} />}
            accent="text-amber-600"
          />
        </div>

        <section className="space-y-6">
          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-end gap-4 xl:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Week View
                </p>
                <div className="flex flex-wrap gap-2">
                  {dayOptions.map((day) => {
                    const active = norm(day) === norm(selectedDay);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
                          active
                            ? "bg-[#2D70FD] text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-[#2D70FD]"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-full xl:w-64">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Class Filter
                </p>
                <select
                  value={selectedClassFilter}
                  onChange={(event) => setSelectedClassFilter(event.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  {classOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Next AI Actions
              </p>
              {pendingQueue.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500 mt-2">
                  No pending suggestions in this day/class filter.
                </p>
              ) : (
                <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pendingQueue.map((session) => (
                    <button
                      key={`${session.key}-queue`}
                      type="button"
                      onClick={() => setActiveSessionKey(session.key)}
                      className="text-left rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {session.time || "TBD"} | {session.meta.classLabel}
                      </p>
                      <p className="text-sm font-black text-slate-800 mt-1">
                        {session.meta.subject}
                      </p>
                      <p className="text-xs font-semibold text-slate-500 mt-1">
                        {previewText(session.meta.topic, 70)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2.5rem] border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Sessions
            </p>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              {selectedDay || "Teaching Sessions"} | {selectedClassFilter}
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Open a card to view AI guidance, then mark it done after teaching.
            </p>
          </div>

          {visibleCards.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {visibleCards.map((session) => (
                <article
                  key={session.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveSessionKey(session.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveSessionKey(session.key);
                    }
                  }}
                  className={`bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm transition-all duration-300 cursor-pointer ${
                    session.completed
                      ? "border-emerald-200 bg-emerald-50/30 hover:border-emerald-300"
                      : "hover:border-blue-200 hover:-translate-y-1 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                      <CalendarDays size={26} />
                    </div>
                    <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {session.completed ? "Completed" : "Pending"}
                    </div>
                  </div>

                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {session.dayLabel} | {session.time || "TBD"}
                  </p>
                  <h3 className="font-semibold text-slate-800 text-lg mt-2">
                    {session.meta.subject}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">
                    {session.meta.topic}
                  </p>
                  <p className="text-xs font-semibold text-slate-400 mt-2">
                    Class {session.meta.classLabel}
                    {session.meta.range ? ` | ${session.meta.range}` : ""}
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-4 leading-relaxed min-h-[42px]">
                    {previewText(session.startPoint, 92)}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveSessionKey(session.key);
                      }}
                      className="h-10 rounded-xl bg-blue-50 text-[#2D70FD] text-xs font-black inline-flex items-center justify-center gap-1.5"
                    >
                      <ChevronRight size={14} />
                      Open Guide
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateCompletion(session, !session.completed);
                      }}
                      className={`h-10 rounded-xl text-xs font-black ${
                        session.completed
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600"
                      }`}
                    >
                      {session.completed ? "Completed" : "Mark Done"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {activeSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            onClick={() => setActiveSessionKey("")}
          />
          <div className="relative w-full max-w-4xl rounded-[2.5rem] border border-slate-100 bg-white shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Teaching Guide
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{activeSession.meta.subject}</h3>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  {activeSession.meta.topic} | Class {activeSession.meta.classLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSessionKey("")}
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-400 inline-flex items-center justify-center hover:bg-slate-50"
                aria-label="Close guide"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 max-h-[78vh] overflow-y-auto">
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      Where To Start
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-2">
                      {activeSession.startPoint}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      Where To Stop
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mt-2">
                      {activeSession.stopPoint}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Step By Step Guide
                  </p>
                  {(activeSession.guideSteps || []).length > 0 ? (
                    activeSession.guideSteps.map((step, index) => (
                      <div
                        key={`${activeSession.key}-step-${index}`}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2D70FD] text-xs font-black inline-flex items-center justify-center">
                          {index + 1}
                        </div>
                        <p className="text-sm font-semibold text-slate-700">{step}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">
                        No detailed steps were generated for this session.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Classroom Example
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mt-2">
                    {activeSession?.guide?.classroomExample || "Use one practical example linked to the topic."}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Diagnostic Check
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mt-2">
                    {activeSession?.guide?.diagnosticCheck || "Close with a short diagnostic check."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    updateCompletion(activeSession, !activeSession.completed);
                    if (!activeSession.completed) toast.success("Session marked as completed.");
                  }}
                  className={`w-full h-11 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 ${
                    activeSession.completed
                      ? "bg-emerald-600 text-white"
                      : "bg-[#2D70FD] text-white hover:bg-[#1E5CE0]"
                  }`}
                >
                  <CheckCircle2 size={16} />
                  {activeSession.completed ? "Completed" : "Mark Completed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TeacherOutline;
