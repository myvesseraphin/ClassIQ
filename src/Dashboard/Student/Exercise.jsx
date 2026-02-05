import React, { useState } from "react";
import {
  Search,
  FileText,
  Download,
  BookOpen,
  LayoutGrid,
  List,
  Filter,
  X,
  Sparkles,
  Printer,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Send,
  Activity,
} from "lucide-react";

const Exercise = () => {
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);

  const subjects = ["All", "Mathematics", "Physics", "PHP"];

  const mockQuestions = [
    {
      id: 1,
      text: "Evaluate the integral of x*ln(x) dx using integration by parts.",
      type: "Open-ended",
    },
    {
      id: 2,
      text: "Determine the constant of integration if the curve passes through (1, 2).",
      type: "Calculation",
    },
    {
      id: 3,
      text: "Explain why integration by parts is preferred over substitution in this case.",
      type: "Theory",
    },
  ];

  const [exercises, setExercises] = useState([
    {
      id: 1,
      name: "Integration by Parts Mastery",
      subject: "Mathematics",
      difficulty: "Hard",
      questionCount: 5,
      date: "Jan 26, 2026",
      questions: mockQuestions,
    },
    {
      id: 2,
      name: "Electromagnetic Induction Set",
      subject: "Physics",
      difficulty: "Medium",
      questionCount: 8,
      date: "Jan 25, 2026",
      questions: mockQuestions,
    },
    {
      id: 3,
      name: "Organic Reaction Mechanisms",
      subject: "Chemistry",
      difficulty: "Medium",
      questionCount: 6,
      date: "Jan 24, 2026",
      questions: mockQuestions,
    },
  ]);

  const handleGenerateNew = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGenerating(false);
    alert("New AI-tailored worksheet generated!");
  };

  const filteredExercises = exercises.filter(
    (ex) =>
      (selectedSubject === "All" || ex.subject === selectedSubject) &&
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleNextQuestion = () => {
    if (activeQuestion < selectedExercise.questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                  Exercises
                </h1>
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleGenerateNew}
                  disabled={isGenerating}
                  className="flex items-center gap-2 px-6 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-blue-100 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {isGenerating ? "Analyzing..." : "Generate New"}
                </button>

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
            </div>
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 lg:pb-0 scrollbar-hide">
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                      selectedSubject === sub
                        ? "bg-[#2D70FD] text-white"
                        : "bg-white text-slate-500 border border-slate-200"
                    }`}
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
                  placeholder="Search exercises..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] font-medium"
                />
              </div>
            </div>
            {filteredExercises.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                  {filteredExercises.map((ex) => (
                    <div
                      key={ex.id}
                      className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]`}
                        >
                          <FileText size={28} />
                        </div>
                      </div>
                      <h3 className="font-black text-slate-800 text-lg mb-1">
                        {ex.name}
                      </h3>
                      <p className="text-sm font-bold text-slate-400 mb-8">
                        {ex.subject} • {ex.questionCount} Questions
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setSelectedExercise(ex);
                            setActiveQuestion(0);
                          }}
                          className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                        >
                          <Activity size={18} /> Solve
                        </button>
                        <button className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm">
                          <Printer size={18} /> Print
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                  {filteredExercises.map((ex, idx) => (
                    <div
                      key={ex.id}
                      className={`flex items-center justify-between p-6 ${idx !== filteredExercises.length - 1 ? "border-b border-slate-100" : ""} hover:bg-slate-50 transition-colors`}
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-xl flex items-center justify-center">
                          <FileText size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">
                            {ex.name}
                          </h4>
                          <p className="text-xs font-bold text-slate-400">
                            {ex.subject} • {ex.questionCount} Questions •{" "}
                            {ex.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setSelectedExercise(ex);
                            setActiveQuestion(0);
                          }}
                          className="px-6 py-2.5 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs"
                        >
                          Solve
                        </button>
                        <button className="p-2.5 text-slate-400 hover:text-slate-600">
                          <Printer size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">
                  No exercises found matching your criteria.
                </p>
              </div>
            )}
          </div>
        </main>
        {selectedExercise && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setSelectedExercise(null)}
            />
            <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in duration-300">
              <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
                <div className="p-8 border-b border-slate-200 bg-white">
                  <h2 className="font-black text-slate-800 text-xl leading-tight mb-2">
                    {selectedExercise.name}
                  </h2>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={14} />
                    <span className="text-xs font-bold">Est: 30 Mins</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {selectedExercise.questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestion(idx)}
                      className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                        activeQuestion === idx
                          ? "bg-white shadow-md border-l-4 border-[#2D70FD]"
                          : "hover:bg-slate-100"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                          activeQuestion === idx
                            ? "bg-[#2D70FD] text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <span
                        className={`text-sm font-bold ${activeQuestion === idx ? "text-slate-800" : "text-slate-400"}`}
                      >
                        Question {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="p-6 bg-white border-t border-slate-100">
                  <button className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100">
                    <CheckCircle2 size={16} /> Submit All
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-white">
                <div className="p-8 flex justify-between items-center border-b border-slate-50">
                  <span className="text-[10px] font-black text-slate-400 tracking-widest">
                    Interactive Practice Box
                  </span>
                  <button
                    onClick={() => setSelectedExercise(null)}
                    className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 p-12 overflow-y-auto">
                  <div className="max-w-2xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <span className="px-3 py-1 bg-blue-50 text-[#2D70FD] text-[10px] font-black rounded-lg uppercase">
                        {selectedExercise.questions[activeQuestion].type}
                      </span>
                      <h4 className="text-2xl font-extrabold text-slate-800 leading-snug">
                        {selectedExercise.questions[activeQuestion].text}
                      </h4>
                    </div>

                    <div className="space-y-4">
                      <textarea
                        placeholder="Type your solution or thought process here..."
                        className="w-full h-48 p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 resize-none"
                      />
                      <div className="flex justify-between items-center">
                        <button
                          onClick={handleNextQuestion}
                          disabled={
                            activeQuestion ===
                            selectedExercise.questions.length - 1
                          }
                          className="px-8 py-3 bg-[#2D70FD] text-white rounded-xl font-black text-xs flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                        >
                          Next Question <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/50">
                  <button className="text-slate-400 font-bold hover:text-slate-600 transition-colors flex items-center gap-2">
                    <Download size={18} /> Save Progress
                  </button>
                  <div className="flex gap-4">
                    <button className="px-8 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-white transition-all flex items-center gap-2">
                      <Printer size={18} /> Print PDF
                    </button>
                    <button className="px-8 py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center gap-2">
                      <Send size={18} /> Finish Exercise
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Exercise;
