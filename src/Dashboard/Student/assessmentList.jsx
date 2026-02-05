import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Download,
  LayoutGrid,
  List,
  Trophy,
  CheckCircle2,
  BrainCircuit,
  TrendingUp,
  X,
} from "lucide-react";

const AssessmentList = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("list");
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubject, setActiveSubject] = useState("All");

  const subjects = ["All", "PHP", "Physics", "Web UI", "Basics of Database"];

  const assessments = [
    {
      id: 1,
      title: "PHP Frameworks",
      subject: "PHP",
      type: "Quiz",
      date: "Jan 12, 2026",
      status: "Completed",
      grade: "88%",
      weakArea: "Found Weakness in the use of Laravel",
      predicted: "92%",
      aiFeedback:
        "Excellent Intro in Frameworks. Review the use of Laravel to hit your 92% goal.",
    },
    {
      id: 2,
      title: "CSS combinators",
      subject: "Web UI",
      type: "Midterm",
      date: "Jan 22, 2026",
      status: "In Progress",
      grade: null,
      predicted: "85%",
    },
    {
      id: 3,
      title: "GPS Calculations in Python",
      subject: "Physics",
      type: "Diagnostic",
      date: "Jan 15, 2026",
      status: "Completed",
      grade: "72%",
      weakArea: "Use of Python in the context of GPS calculation",
      predicted: "78%",
      aiFeedback: "Focus on studying basics of python (Arrays, variables)",
    },
  ];

  const filtered = assessments.filter(
    (a) =>
      (activeSubject === "All" || a.subject === activeSubject) &&
      a.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Performance & Grades
          </h1>
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
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: "Marks",
              value: "82%",
              icon: <Trophy size={20} />,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Completion",
              value: "94%",
              icon: <CheckCircle2 size={20} />,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Prediction",
              value: "87%",
              icon: <BrainCircuit size={20} />,
              color: "text-purple-600",
              bg: "bg-purple-50",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm"
            >
              <div
                className={`w-14 h-14 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center`}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  {s.label}
                </p>
                <p className="text-2xl font-black text-slate-800 leading-none">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setActiveSubject(sub)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm border border-slate-200 transition-all
                  ${activeSubject === sub ? "bg-blue-50 text-[#2D70FD] border-blue-200" : "bg-white text-slate-500 hover:border-blue-100 hover:text-[#2D70FD]"}`}
              >
                {sub}
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
              placeholder="Search your assessments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 shadow-sm"
            />
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Assessment
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Status
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase text-center">
                    Score
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase text-right pr-12">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-blue-50/20 transition-colors group"
                  >
                    <td className="px-8 py-6 flex items-center gap-4">
                      <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:text-[#2D70FD] transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 tracking-widest">
                          {item.subject}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span
                        className={`px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest ${item.status === "Completed" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {item.grade ? (
                        <div className="flex flex-col items-center">
                          <span className="text-base font-black text-slate-800">
                            {item.grade}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-slate-300 uppercase">
                          {"—"}
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right pr-12 flex gap-3 justify-end">
                      {item.status === "Completed" ? (
                        <button
                          onClick={() => setSelectedTask(item)}
                          className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                        >
                          <FileText size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/assessments/${item.id}`)}
                          className="px-6 py-2 bg-[#2D70FD] text-white rounded-xl font-black text-xs tracking-widest"
                        >
                          Start
                        </button>
                      )}
                      <button className="p-3 text-slate-300 hover:text-slate-500 transition-colors">
                        <Download size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm"
              >
                <div className="flex justify-between mb-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-[#2D70FD]">
                    <FileText size={28} />
                  </div>
                  <span className="text-2xl font-black text-slate-800">
                    {item.grade || "—"}
                  </span>
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight">
                  {item.title}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">
                  {item.subject}
                </p>
                <button
                  onClick={() => setSelectedTask(item)}
                  className="w-full py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                >
                  View Analysis
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={() => setSelectedTask(null)}
          />
          <div className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800 text-2xl tracking-tight">
                Performance Diagnostic
              </h2>
              <button
                onClick={() => setSelectedTask(null)}
                className="p-4 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-10 space-y-8">
              {selectedTask.weakArea && (
                <div className="bg-50 p-6 rounded-[2rem]">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
                    Weak Point Identified
                  </p>
                  <p className="text-lg font-black text-black-600">
                    “{selectedTask.weakArea}”
                  </p>
                </div>
              )}
              {selectedTask.aiFeedback && (
                <div className="p-6 bg-slate-50 rounded-[2rem]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    AI Instructor Feedback
                  </p>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    "{selectedTask.aiFeedback}"
                  </p>
                </div>
              )}
              <button className="w-full py-5 bg-[#2D70FD] text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-[1.02] transition-all">
                Learning Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentList;
