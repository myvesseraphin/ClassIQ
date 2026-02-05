import React, { useState, useEffect } from "react";
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
  Loader2,
  Plus,
} from "lucide-react";

const StudentHome = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Simulation of a quick initial load
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Hardcoded Frontend Data (No Backend Required)
  const studentData = {
    name: "MANZI SHIMWA Yves Seraphin",
    id: "STU-20491",
    major: "Software Programming & Embedded Systems",
    image_url: "https://yvesseraphin.vercel.app/portofolio.jpg",
    currentTerm: "Term 3",
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
      <div className="flex-1 overflow-y-auto p-8 lg:p-10 animate-in fade-in duration-700">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header & Search */}
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
            <button className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 shadow-sm relative transition-all active:scale-90">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Hello, {studentData.name.split(" ")[0]}
            </h1>
            <p className="text-slate-400 font-bold text-sm">
              ClassIQ Performance Tracking
            </p>
          </div>

          {/* Activity Summary Card */}
          <section className="bg-blue-600 rounded-[2.5rem] p-8 shadow-xl shadow-blue-100 text-white relative overflow-hidden">
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
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-lg">
                    {stat.icon}
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

          {/* Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full">
                <h3 className="text-lg font-black text-slate-800 mb-10 flex items-center gap-2">
                  Score Analysis{" "}
                  <TrendingUp size={18} className="text-blue-600" />
                </h3>
                <div className="relative h-40 w-full flex items-end justify-between px-4">
                  <svg
                    className="absolute inset-0 w-full h-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 400 100"
                  >
                    <path
                      d="M 0 80 Q 100 65, 200 45 T 400 20 L 400 100 L 0 100 Z"
                      fill="url(#blueGradient)"
                      className="opacity-5"
                    />
                    <path
                      d="M 0 80 Q 100 65, 200 45 T 400 20"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient
                        id="blueGradient"
                        x1="0%"
                        y1="0%"
                        x2="0%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="white" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {studentData.scores.map((s, i) => (
                    <div
                      key={i}
                      className="relative z-10 flex flex-col items-center gap-3"
                    >
                      <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                        {s.val}%
                      </div>
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-blue-600 shadow-md"></div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Term {s.term_id}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-4">
              <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4">
                  Academic Average
                </p>
                <h2 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">
                  {studentData.overallPercentage}
                </h2>
                <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-100">
                  {studentData.ranking}
                </div>
              </section>
            </div>
          </div>

          {/* Weakness Detection Section */}
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
              Start Fix <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-[320px] bg-white border-l border-slate-100 overflow-y-auto p-5 hidden xl:block">
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {studentData.id}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <style>{`.rdp { --rdp-cell-size: 38px; --rdp-accent-color: #2563eb; margin: 0; }`}</style>
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
              <button className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-75 transition-transform">
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentHome;
