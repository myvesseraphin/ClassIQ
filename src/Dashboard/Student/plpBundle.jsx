import React, { useState } from "react";
import {
  BookOpen,
  CheckCircle,
  Download,
  Zap,
  Printer,
  ArrowLeft,
  User,
  Clock,
  Search,
  PieChart,
  Filter,
  LayoutGrid,
  List,
  Brain,
} from "lucide-react";

const CircularProgress = ({
  progress,
  size = 60,
  strokeWidth = 6,
  color = "#2D70FD",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-800 leading-none">
          {progress}%
        </span>
        <span className="text-[12px] font-black text-slate-400 uppercase tracking-tighter">
          Level
        </span>
      </div>
    </div>
  );
};

const PLPBundle = () => {
  const [view, setView] = useState("overview");
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Subjects");
  const [selectedSubject, setSelectedSubject] = useState(null);

  const [subjects] = useState([
    {
      id: "SUB-001",
      name: "Mathematics",
      category: "Math",
      status: "Priority Intervention",
      progress: 42,
      lastAssessment: "Feb 01, 2026",
      teacher: "Jean Damascene H.",
      weakAreas: [
        {
          topic: "Quadratic Equations",
          level: "High Priority",
          desc: "Struggling with factoring and coefficients in end-unit assessment.",
        },
        {
          topic: "Fractions",
          level: "Critical",
          desc: "Detected learning gap in unlike denominators during diagnostic.",
        },
      ],
      actions: [
        "Daily Quadratic Formula practice",
        "AI-Generated fractions drill",
      ],
      tips: ["Focus on quadratics first.", "Use the Pomodoro technique."],
      feedback:
        "Linear equation mastery is high, but diagnostic assessment shows quadratic repetition is required for curriculum coverage.",
    },
    {
      id: "SUB-002",
      name: "Physics",
      category: "Physics",
      status: "On Track",
      progress: 78,
      lastAssessment: "Jan 28, 2026",
      teacher: "Jean Damascene H.",
      weakAreas: [
        {
          topic: "Thermodynamics",
          level: "Moderate",
          desc: "Concept of entropy and heat transfer needs reinforcement.",
        },
      ],
      actions: ["Review Laws of Thermodynamics", "Complete Lab Sim #4"],
      tips: ["Draw energy flow diagrams."],
      feedback:
        "Consistent performance across mechanics; AI predicts 85% mastery by next cycle.",
    },
  ]);

  const filters = ["All Subjects", "Physics", "Math"];
  const filteredSubjects = subjects.filter((sub) => {
    const matchesFilter =
      activeFilter === "All Subjects" || sub.category === activeFilter;
    const matchesSearch =
      sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSelectSubject = (sub) => {
    setSelectedSubject(sub);
    setView("detail");
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  {view === "overview"
                    ? "Personalized Learning Plans"
                    : "Learning Intelligence Detail"}
                </h1>
              </div>

              <div className="flex items-center gap-4">
                {view === "detail" ? (
                  <button
                    onClick={() => setView("overview")}
                    className="flex items-center gap-2 px-6 py-4 bg-white border-2 border-slate-100 rounded-[1.5rem] text-slate-600 font-black text-sm hover:border-blue-100 transition-all shadow-sm"
                  >
                    <ArrowLeft size={18} /> Back to Plans
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-xl transition-all ${viewMode === "grid" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400"}`}
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded-xl transition-all ${viewMode === "list" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400"}`}
                    >
                      <List size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {view === "overview" ? (
              <>
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                      <Filter size={18} />
                    </div>
                    {filters.map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeFilter === f ? "bg-[#2D70FD] text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200"}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full lg:w-96">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={20}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search reports..."
                      className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-black text-slate-700 shadow-sm"
                    />
                  </div>
                </div>

                {filteredSubjects.length > 0 ? (
                  viewMode === "grid" ? (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                      {filteredSubjects.map((sub) => (
                        <div
                          key={sub.id}
                          className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm"
                        >
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#2D70FD] mb-6 group-hover:bg-blue-50 transition-colors">
                            <PieChart size={28} />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight">
                              {sub.name}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-8">
                            <button
                              onClick={() => handleSelectSubject(sub)}
                              className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                            >
                              <BookOpen size={18} /> View PLP
                            </button>
                            <button className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all shadow-sm">
                              <Download size={18} /> Export
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Subject
                            </th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Status
                            </th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Mastery
                            </th>
                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubjects.map((sub) => (
                            <tr
                              key={sub.id}
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                            >
                              <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                  <div className="p-2 bg-blue-50 rounded-lg text-[#2D70FD]">
                                    <PieChart size={18} />
                                  </div>
                                  <div>
                                    <div className="font-black text-slate-800 text-sm">
                                      {sub.name}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6">
                                <span
                                  className={`text-[10px] font-black px-3 py-1 rounded-full border ${sub.progress < 50 ? "bg-red-50 text-red-500 border-red-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"}`}
                                >
                                  {sub.status.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <span className="text-xs font-black text-slate-700">
                                  {sub.progress}%
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleSelectSubject(sub)}
                                    className="p-2.5 bg-blue-50 text-[#2D70FD] rounded-xl hover:bg-[#2D70FD] hover:text-white transition-all"
                                  >
                                    <BookOpen size={16} />
                                  </button>
                                  <button className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all">
                                    <Download size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 font-black uppercase tracking-widest">
                      No matching plans found.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="grid lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white border-2 border-blue-50 rounded-[3rem] p-12 flex items-center justify-between shadow-xl shadow-blue-500/5">
                    <div className="space-y-6">
                      <span className="text-[#2D70FD] text-[10px] font-black uppercase tracking-[0.2em] bg-blue-50 px-5 py-2 rounded-full">
                        Unit Progress Analysis
                      </span>
                      <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                        {selectedSubject.name}
                      </h2>
                      <div className="flex items-center gap-5 text-slate-400 font-black text-[12px]">
                        <Clock size={20} className="text-blue-400" />
                        Last Intelligence Scan: {selectedSubject.lastAssessment}
                      </div>
                    </div>
                    <CircularProgress
                      progress={selectedSubject.progress}
                      size={160}
                      strokeWidth={14}
                    />
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-[13px] font-black text-slate-400 px-6 uppercase tracking-[0.2em]">
                      AI Gap Detection
                    </h3>
                    {selectedSubject.weakAreas.map((wa, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between hover:shadow-lg transition-all"
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-[#2D70FD]">
                            <Brain size={28} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 text-xl mb-1">
                              {wa.topic}
                            </h4>
                            <p className="text-sm text-slate-500 font-bold leading-relaxed max-w-md">
                              {wa.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="lg:col-span-4 space-y-8">
                  <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm relative overflow-hidden">
                    <h4 className="text-[13px] font-black text-[#2D70FD] mb-8 uppercase tracking-[0.2em]">
                      AI Recommend
                    </h4>
                    <p className="text-xl font-black text-slate-700 leading-relaxed relative z-10 mb-8">
                      "{selectedSubject.feedback}"
                    </p>
                    <div className="flex items-center gap-4 pt-8 border-t border-slate-50">
                      <div>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                          Instructor
                        </span>
                        <span className="text-sm font-black text-slate-800">
                          {selectedSubject.teacher}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-slate-200">
                    <h4 className="text-[13px] font-black text-blue-400 mb-8 uppercase tracking-[0.2em]">
                      Recovery Roadmap
                    </h4>
                    <div className="space-y-4">
                      {selectedSubject.actions.map((act, i) => (
                        <div
                          key={i}
                          className="flex gap-4 items-start p-5 bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors"
                        >
                          <CheckCircle
                            size={20}
                            className="text-blue-500 mt-0.5"
                          />
                          <span className="text-sm font-black text-slate-700">
                            {act}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-5 py-3 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                      <Printer size={20} /> Generate Assets
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PLPBundle;
