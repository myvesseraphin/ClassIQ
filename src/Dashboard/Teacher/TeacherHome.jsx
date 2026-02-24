import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  TrendingUp,
  Target,
  Activity,
  UserCheck,
  BookOpen,
  ArrowRight,
  ChevronDown,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const TeacherHome = () => {
  const defaultSummary = [
    { label: "Classes", current: 0, total: 0, percent: "0%" },
    { label: "Assessments", current: 0, total: 0, percent: "0%" },
    { label: "PLPs", current: 0, total: 0, percent: "0%" },
  ];
  const defaultScores = [
    { term_id: 1, val: 72 },
    { term_id: 2, val: 78 },
    { term_id: 3, val: 84 },
  ];
  const defaultSchedule = [
    { day: "Mon", time: "08:00 - 09:00", title: "Mathematics - S1" },
    { day: "Tue", time: "09:30 - 10:30", title: "Biology - S2" },
    { day: "Wed", time: "11:00 - 12:00", title: "English - P6" },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [classReports, setClassReports] = useState([]);
  const navigate = useNavigate();
  const [teacherData, setTeacherData] = useState({
    name: "",
    id: "",
    school: "",
    image_url: "",
    currentTerm: "Term 2",
    ranking: "Top 3",
    overallPercentage: "82%",
    curriculumProgress: "0%",
    curriculumStatus: "No class subjects assigned yet",
    focus: "Differentiate learning paths for struggling learners.",
    summary: defaultSummary,
    scores: defaultScores,
    schedule: defaultSchedule,
    assignments: {
      primaryClass: null,
      subjects: [],
      classes: [],
    },
  });

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      try {
        const [{ data }, reportsResponse] = await Promise.all([
          api.get("/teacher/dashboard"),
          api.get("/teacher/reports").catch(() => ({ data: { reports: [] } })),
        ]);
        if (!isMounted) return;
        setTeacherData((prev) => ({
          ...prev,
          ...data.teacher,
          image_url: data.teacher?.image_url
            ? resolveMediaUrl(data.teacher.image_url)
            : prev.image_url,
          assignments: data.assignments || prev.assignments,
          summary:
            Array.isArray(data.summary) && data.summary.length > 0
              ? data.summary
              : prev.summary,
          scores:
            Array.isArray(data.scores) && data.scores.length > 0
              ? data.scores
              : prev.scores,
          schedule:
            Array.isArray(data.schedule) && data.schedule.length > 0
              ? data.schedule
              : prev.schedule,
        }));
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
        setClassReports(
          Array.isArray(reportsResponse?.data?.reports)
            ? reportsResponse.data.reports
            : [],
        );
      } catch (err) {
        console.error("Failed to load dashboard", err);
        if (err.response?.status === 401) {
          return;
        }
        toast.error("Failed to load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      const { data } = await api.post("/teacher/tasks", {
        title: taskTitle,
        due: taskDue || undefined,
        priority: "medium",
      });
      setTasks((prev) => [...prev, data.task]);
      setTaskTitle("");
      setTaskDue("");
      setShowAddTask(false);
    } catch (err) {
      console.error("Failed to add task", err);
      toast.error("Failed to add task.");
    }
  };

  const toggleTask = async (id) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    try {
      const { data } = await api.patch(`/teacher/tasks/${id}`, {
        completed: !current.completed,
      });
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? data.task : task)),
      );
    } catch (err) {
      console.error("Failed to update task", err);
      toast.error("Failed to update task.");
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/teacher/tasks/${id}`);
      setTasks((prev) => prev.filter((task) => task.id !== id));
    } catch (err) {
      console.error("Failed to delete task", err);
      toast.error("Failed to delete task.");
    }
  };

  const summaryIcons = {
    Classes: <UserCheck size={20} />,
    Assessments: <Activity size={20} />,
    PLPs: <BookOpen size={20} />,
  };

  const filteredSchedule = teacherData.schedule.filter((item) => {
    const title = (item.title || "").toLowerCase();
    const day = (item.day || "").toLowerCase();
    return (
      title.includes(searchQuery.toLowerCase()) ||
      day.includes(searchQuery.toLowerCase())
    );
  });

  const currentDayName = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(new Date());

  const scorePoints = Array.isArray(teacherData.scores) ? teacherData.scores : [];
  const normalizedScores = scorePoints
    .map((score) => ({
      term_id: score?.term_id,
      val: Math.max(0, Math.min(100, Number(score?.val) || 0)),
    }))
    .filter((score) => Number.isFinite(score.val));

  const classAveragePoints = (Array.isArray(classReports) ? classReports : [])
    .map((report) => {
      const avgGradeRaw =
        report?.avgGrade === null || report?.avgGrade === undefined
          ? null
          : Number(String(report.avgGrade).replace("%", "").trim());
      if (!Number.isFinite(avgGradeRaw)) return null;
      const classLabel = String(report?.className || "")
        .trim()
        .toUpperCase();
      return {
        label: classLabel || "Class",
        val: Math.max(0, Math.min(100, Math.round(avgGradeRaw))),
      };
    })
    .filter(Boolean);

  const fallbackPoints = normalizedScores.map((score, index) => ({
    label: score?.term_id ? `Term ${score.term_id}` : `Term ${index + 1}`,
    val: score.val,
  }));

  const graphPoints =
    classAveragePoints.length > 0 ? classAveragePoints : fallbackPoints;

  const chartWidth = 400;
  const chartHeight = 120;
  const chartPaddingX = 26;
  const chartTop = 10;
  const chartBottom = 32;
  const chartUsableHeight = chartHeight - chartTop - chartBottom;

  const xStep =
    graphPoints.length > 1
      ? (chartWidth - chartPaddingX * 2) / (graphPoints.length - 1)
      : 0;

  const positionedScores = graphPoints.map((score, index) => {
    const x =
      graphPoints.length === 1
        ? chartWidth / 2
        : chartPaddingX + index * xStep;
    const y = chartTop + ((100 - score.val) / 100) * chartUsableHeight;
    return { ...score, x, y };
  });

  const linePath =
    positionedScores.length > 0
      ? positionedScores
          .map(
            (score, index) =>
              `${index === 0 ? "M" : "L"} ${score.x},${score.y}`,
          )
          .join(" ")
      : "";
  const labelStep = Math.max(1, Math.ceil(positionedScores.length / 6));
  const curriculumStatusLabel =
    teacherData.curriculumStatus || "No class subjects assigned yet";

  if (loading) {
    return <TeacherPageSkeleton variant="home" />;
  }
  return (
    <div className="w-full h-full animate-in fade-in duration-700 font-sans">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
        <div className="min-w-0">
          <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
            <div className="flex-1 relative max-w-md w-full group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schedules..."
                className="w-full bg-white border-2 border-slate-100 py-3 pl-11 pr-4 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD] shadow-sm transition-all"
              />
            </div>
            <button
              onClick={() => navigate("/teacher/notifications")}
              className="p-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-400 hover:text-[#2D70FD] shadow-sm relative transition-all active:scale-90 self-end sm:self-auto"
              aria-label="Open notifications"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#2D70FD] rounded-full border-2 border-white"></span>
            </button>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Hello, {(teacherData.name || "Teacher").split(" ")[0]}
            </h1>
            <p className="text-slate-400 font-bold text-sm">
              Teacher Dashboard
            </p>
          </div>
          <section className="bg-[#2D70FD] rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 border-[20px] border-white/10 rounded-full" />
            <div className="absolute -right-20 -bottom-20 w-60 h-60 border-[40px] border-white/5 rounded-full" />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-90">
                Teaching Summary
              </h3>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/10">
                {teacherData.currentTerm} <ChevronDown size={14} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {teacherData.summary.map((stat, i) => {
                const percentValue = parseInt(stat.percent, 10) || 0;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-4 rounded-2xl bg-white/10 border border-white/10 p-4"
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
                        {summaryIcons[stat.label] || <Activity size={20} />}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 opacity-80">
                        {stat.label}
                      </p>
                      <div className="flex items-center gap-2">
                        <h4 className="text-2xl font-black">
                          {stat.current}/{stat.total}
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
                  {classAveragePoints.length > 0
                    ? "Class Average Performance"
                    : "Class Performance"}{" "}
                  <TrendingUp size={18} className="text-blue-600" />
                </h3>
                <div className="relative h-48 w-full">
                  <svg
                    viewBox="0 0 400 100"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient
                        id="lineGradient"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0%" stopColor="#EDF3FF" />
                        <stop offset="100%" stopColor="#2D70FD" />
                      </linearGradient>
                    </defs>
                    <path
                      d={linePath}
                      fill="none"
                      stroke="url(#lineGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {positionedScores.map((s, i) => {
                      return (
                        <g key={i}>
                          <circle
                            cx={s.x}
                            cy={s.y}
                            r="6"
                            fill="#2D70FD"
                            stroke="white"
                            strokeWidth="2"
                          />
                          <foreignObject
                            x={s.x - 20}
                            y={s.y - 35}
                            width="40"
                            height="25"
                          >
                            <div className="text-[10px] font-black text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-100 shadow-sm text-center">
                              {s.val}%
                            </div>
                          </foreignObject>
                          {i % labelStep === 0 || i === positionedScores.length - 1 ? (
                            <text
                              x={s.x}
                              y="115"
                              textAnchor="middle"
                              className="text-[10px] font-bold fill-slate-400"
                            >
                              {s.label}
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </svg>
                  {positionedScores.length === 0 ? (
                    <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-400">
                      No score trend yet.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <section className="relative overflow-hidden bg-white/40 backdrop-blur-md border border-white/20 rounded-[2.5rem] p-8 shadow-xl h-full flex flex-col items-center justify-center text-center">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-400/20 rounded-full" />

                <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] mb-4 relative z-10">
                  Curriculum Progress
                </p>
                <h2 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter relative z-10">
                  {teacherData.curriculumProgress || "0%"}
                </h2>
                <div className="bg-white text-slate-700 px-4 py-2 rounded-xl text-[11px] font-bold shadow-lg shadow-blue-100 relative z-10">
                  {curriculumStatusLabel}
                </div>
              </section>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Target size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Priority Focus
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                  {teacherData.focus || "No focus flagged yet."}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/teacher/exercises")}
              className="bg-[#2D70FD] text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#1F5AE0] transition-all shadow-lg active:scale-95"
            >
              Start Exercises <ArrowRight size={16} />
            </button>
          </div>

        </div>
      </div>
      <aside className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm xl:rounded-none xl:border-l xl:border-r-0 xl:border-t-0 xl:border-b-0 xl:p-5 xl:shadow-none">
        <div className="space-y-10">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-blue-50 p-1 overflow-hidden">
              <img
                src={
                  resolveMediaUrl(teacherData.image_url) ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    teacherData.name || "Teacher",
                  )}`
                }
                className="w-full h-full object-cover rounded-full bg-blue-50"
                alt="Profile"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    teacherData.name || "Teacher",
                  )}`;
                }}
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {teacherData.name || "Teacher"}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                {teacherData.id || "Teacher"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {teacherData.school || "School"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <style>{`.rdp { --rdp-cell-size: 38px; --rdp-accent-color: #2D70FD; margin: 0; } .rdp-day_selected:not([disabled]) { font-weight: 900; background-color: #2D70FD; } .rdp-day { font-weight: 600; }`}</style>
            <div className="flex justify-center">
              <DayPicker
                navLayout="around"
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                components={{
                  IconLeft: () => <ChevronLeft size={16} />,
                  IconRight: () => <ChevronRight size={16} />,
                }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Schedule
              </h3>
              <button
                onClick={() => setShowAddTask(true)}
                className="w-8 h-8 rounded-full bg-[#2D70FD] text-white flex items-center justify-center active:scale-75 transition-transform"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {filteredSchedule.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No schedule available.
                </p>
              ) : (
                filteredSchedule.map((item, i) => (
                  <div
                    key={i}
                    className={`p-5 rounded-2xl border transition-all ${
                      item.day.startsWith(currentDayName)
                        ? "bg-[#2D70FD] border-transparent text-white"
                        : "bg-white border-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xl font-black">{item.day}</span>
                      <span className="text-[10px] font-black uppercase opacity-80">
                        {item.time}
                      </span>
                    </div>
                    <h4 className="font-black text-sm">{item.title}</h4>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                  Tasks
                </h3>
                <button
                  onClick={() => navigate("/teacher/outline")}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-wider hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                {tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No tasks yet
                  </p>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleTask(task.id)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          <CheckCircle2
                            size={18}
                            className={
                              task.completed
                                ? "text-green-600 fill-green-50"
                                : "text-slate-300"
                            }
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] font-bold transition-all ${
                              task.completed
                                ? "line-through text-slate-400"
                                : "text-slate-800"
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {task.due || "No due date"}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                Quick Access
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/teacher/outline")}
                  className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <Calendar size={20} className="mx-auto mb-2 text-[#2D70FD]" />
                  <span className="text-[11px] font-black text-[#1F5AE0] uppercase tracking-wide">
                    Outline
                  </span>
                </button>
                <button
                  onClick={() => navigate("/teacher/assessments")}
                  className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <CheckCircle2
                    size={20}
                    className="mx-auto mb-2 text-[#2D70FD]"
                  />
                  <span className="text-[11px] font-black text-[#1F5AE0] uppercase tracking-wide">
                    Assessments
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
      </div>

      {showAddTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">Add Task</h2>
                <button
                  onClick={() => setShowAddTask(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Enter task title..."
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    onKeyPress={(e) => e.key === "Enter" && addTask()}
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddTask(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  className="flex-1 px-4 py-3 bg-[#2D70FD] text-white rounded-xl font-black text-sm hover:bg-blue-600 transition-colors active:scale-95"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHome;


