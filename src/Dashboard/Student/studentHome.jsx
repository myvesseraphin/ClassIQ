import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import Img from "../../assets/Seraphin.jpeg";
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
  Loader2,
  Plus,
  Calendar,
  CheckCircle2,
  X,
} from "lucide-react";

const StudentHome = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Complete Python Assignment",
      due: "2024-02-10",
      completed: false,
    },
    {
      id: 2,
      title: "Study for Chemistry Exam",
      due: "2024-02-15",
      completed: true,
    },
  ]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const addTask = () => {
    if (taskTitle.trim()) {
      const newTask = {
        id: tasks.length + 1,
        title: taskTitle,
        due: taskDue || new Date().toISOString().split("T")[0],
        completed: false,
      };
      setTasks([...tasks, newTask]);
      setTaskTitle("");
      setTaskDue("");
      setShowAddTask(false);
    }
  };

  const toggleTask = (id) => {
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const studentData = {
    name: "MANZI SHIMWA Yves Seraphin",
    id: "STU-20491",
    major: "Software Programming & Embedded Systems",
    image_url: Img,
    currentTerm: "Term 2",
    ranking: "Top 10 students in campus",
    overallPercentage: "78%",
    weakness: "Algebraic manipulation & quadratic equations",
    summary: [
      {
        label: "Attendance",
        current: 18,
        total: 20,
        percent: "90%",
        icon: <UserCheck size={20} />,
      },
      {
        label: "Assessments",
        current: 12,
        total: 15,
        percent: "80%",
        icon: <Activity size={20} />,
      },
      {
        label: "Assignments",
        current: 9,
        total: 12,
        percent: "75%",
        icon: <BookOpen size={20} />,
      },
    ],
    scores: [
      { term_id: 1, val: 65 },
      { term_id: 2, val: 72 },
      { term_id: 3, val: 78 },
    ],
    schedule: [
      { day: "Mon", time: "09:00 – 10:30", title: "Mathematics" },
      { day: "Tue", time: "11:00 – 12:30", title: "Physics" },
      { day: "Wed", time: "14:00 – 15:30", title: "Computer Science" },
      { day: "Fri", time: "10:00 – 11:30", title: "Chemistry" },
    ],
  };

  const filteredSchedule = studentData.schedule.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.day.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const currentDayName = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
  }).format(new Date());

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-10 animate-in fade-in duration-700">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between gap-8">
            <div className="flex-1 relative max-w-md">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search schedules..."
                className="w-full bg-white border border-slate-100 py-3 pl-12 pr-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
              />
            </div>
            <button
              onClick={() => navigate("/student/notifications")}
              className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 shadow-sm relative transition-all active:scale-90"
            >
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Hello, {studentData.name.split(" ")[0]}
            </h1>
            <p className="text-slate-400 font-bold text-sm">
              Student Dashboard
            </p>
          </div>
          <section className="bg-blue-600 rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-40 h-40 border-[20px] border-white/10 rounded-full" />
            <div className="absolute -right-20 -bottom-20 w-60 h-60 border-[40px] border-white/5 rounded-full" />

            <div className="flex justify-between items-center mb-8 relative z-10">
              <h3 className="text-sm font-black uppercase tracking-widest opacity-90">
                Activity Summary
              </h3>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-xs font-bold border border-white/10">
                {studentData.currentTerm} <ChevronDown size={14} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {studentData.summary.map((stat, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 border-r border-white/10 last:border-0 pr-4"
                >
                  <div className="relative w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-lg text-blue-600 overflow-hidden">
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
                        className="text-blue-600"
                        strokeDasharray={`${parseInt(stat.percent)}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                    </svg>
                    <div className="relative z-10">{stat.icon}</div>
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
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full">
                <h3 className="text-lg font-black text-slate-800 mb-10 flex items-center gap-2">
                  Score Analysis{" "}
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
                        <stop offset="0%" stopColor="#dbeafe" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 50,80 Q 150,60 250,40 T 350,20"
                      fill="none"
                      stroke="url(#lineGradient)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {studentData.scores.map((s, i) => {
                      const x = 50 + i * 100;
                      const y = 80 - (s.val - 60) * 2;
                      return (
                        <g key={i}>
                          <circle
                            cx={x}
                            cy={y}
                            r="6"
                            fill="#2563eb"
                            stroke="white"
                            strokeWidth="2"
                          />
                          <foreignObject
                            x={x - 20}
                            y={y - 35}
                            width="40"
                            height="25"
                          >
                            <div className="text-[10px] font-black text-blue-600 bg-white px-2 py-1 rounded-lg border border-blue-100 shadow-sm text-center">
                              {s.val}%
                            </div>
                          </foreignObject>
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
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <section className="relative overflow-hidden bg-white/40 backdrop-blur-md border border-white/20 rounded-[2.5rem] p-8 shadow-xl h-full flex flex-col items-center justify-center text-center">
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-400/20 rounded-full" />

                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 relative z-10">
                  Academic Average
                </p>
                <h2 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter relative z-10">
                  {studentData.overallPercentage}
                </h2>
                <div className="bg-white-600 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-100 relative z-10">
                  {studentData.ranking}
                </div>
              </section>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Target size={24} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  Weakness Detected
                </h2>
                <p className="text-slate-500 font-medium text-sm">
                  {studentData.weakness}
                </p>
              </div>
            </div>
            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95">
              Start Exercises <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="w-[320px] bg-white border-l border-slate-100 overflow-y-auto no-scrollbar p-5 hidden xl:block">
        <div className="space-y-10">
          <div className="text-center space-y-4">
            <div className="w-24 h-24 mx-auto rounded-full border-4 border-blue-50 p-1 overflow-hidden">
              <img
                src={studentData.image_url}
                className="w-full h-full object-cover rounded-full bg-blue-50"
                alt="Profile"
                onError={(e) =>
                  (e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(studentData.name)}`)
                }
              />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {studentData.name}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                {studentData.id}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Year 1B • RCA
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <style>{`.rdp { --rdp-cell-size: 38px; --rdp-accent-color: #2563eb; margin: 0; } .rdp-day_selected:not([disabled]) { font-weight: 900; background-color: #2563eb; } .rdp-day { font-weight: 600; }`}</style>
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
                Schedule
              </h3>
              <button
                onClick={() => setShowAddTask(true)}
                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-75 transition-transform"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {filteredSchedule.map((item, i) => (
                <div
                  key={i}
                  className={`p-5 rounded-2xl border transition-all ${item.day.startsWith(currentDayName) ? "bg-blue-600 border-transparent text-white" : "bg-white border-slate-100"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xl font-black">{item.day}</span>
                    <span className="text-[10px] font-black uppercase opacity-80">
                      {item.time}
                    </span>
                  </div>
                  <h4 className="font-black text-sm">{item.title}</h4>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                Tasks
              </h3>
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
                            className={`text-[13px] font-bold transition-all ${task.completed ? "line-through text-slate-400" : "text-slate-800"}`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {task.due}
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
                  onClick={() => navigate("/student/schedule")}
                  className="flex-1 p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <Calendar size={20} className="mx-auto mb-2 text-blue-600" />
                  <span className="text-[11px] font-black text-blue-700 uppercase tracking-wide">
                    Timetable
                  </span>
                </button>
                <button
                  onClick={() => navigate("/student/tasks")}
                  className="flex-1 p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl hover:shadow-md transition-all active:scale-95 text-center"
                >
                  <CheckCircle2
                    size={20}
                    className="mx-auto mb-2 text-purple-600"
                  />
                  <span className="text-[11px] font-black text-purple-700 uppercase tracking-wide">
                    Tasks
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors active:scale-95"
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

export default StudentHome;
