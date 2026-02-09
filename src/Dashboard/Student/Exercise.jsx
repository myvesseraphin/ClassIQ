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
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const Exercise = () => {
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value || "",
    );
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [exercises, setExercises] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const subjects = [
    "All",
    ...Array.from(new Set(exercises.map((ex) => ex.subject).filter(Boolean))),
  ];

  React.useEffect(() => {
    let isMounted = true;
    const loadExercises = async () => {
      try {
        const { data } = await api.get("/student/exercises?includeQuestions=true");
        if (isMounted && Array.isArray(data?.exercises)) {
          setExercises(data.exercises);
        }
      } catch (err) {
        console.error("Failed to load exercises", err);
        toast.error("Failed to load exercises.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadExercises();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleGenerateNew = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsGenerating(false);
    alert("New AI-tailored worksheet generated!");
  };

  const filteredExercises = exercises.filter(
    (ex) =>
      (selectedSubject === "All" || ex.subject === selectedSubject) &&
      (ex.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const handleSelectExercise = (exercise) => {
    setSelectedExercise({
      ...exercise,
      questions: exercise.questions || [],
    });
    setActiveQuestion(0);
    setAnswers({});
  };

  const handleAnswerChange = (questionId, value) => {
    if (!questionId) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submitExercise = async (status = "submitted") => {
    if (!selectedExercise?.id) return;
    if (!isUuid(selectedExercise.id)) {
      toast.error("Sync exercises before submitting.");
      return;
    }
    setIsSubmitting(true);
    try {
      const answersPayload = Object.entries(answers).map(([questionId, text]) => ({
        questionId,
        answerText: text,
      }));
      await api.post(`/student/exercises/${selectedExercise.id}/submit`, {
        status,
        answers: answersPayload,
      });
      toast.success(
        status === "submitted" ? "Exercise submitted!" : "Progress saved.",
      );
    } catch (err) {
      console.error("Failed to submit exercise", err);
      toast.error("Failed to submit exercise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadExercise = async (exercise) => {
    if (!exercise?.id) return;
    if (!isUuid(exercise.id)) {
      toast.error("Sync exercises before downloading.");
      return;
    }
    setIsDownloading(true);
    try {
      const { data } = await api.get(
        `/student/exercises/${exercise.id}/download`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exercise.name || "exercise"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download exercise", err);
      toast.error("Failed to download exercise.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleNextQuestion = () => {
    if (!selectedExercise?.questions?.length) return;
    if (activeQuestion < selectedExercise.questions.length - 1) {
      setActiveQuestion((prev) => prev + 1);
    }
  };

  const isMultipleChoice = (question) => {
    const type = String(question?.type || "").toLowerCase();
    return type.includes("choice") || type.includes("multiple") || type.includes("mcq");
  };

  const extractOptions = (text) => {
    if (!text) return [];
    return String(text)
      .split("\n")
      .map((line) => line.trim())
      .map((line) => {
        const match = line.match(/^([A-Z])\)\s*(.+)$/);
        if (!match) return null;
        return { key: match[1], label: match[2] };
      })
      .filter(Boolean);
  };

  const getQuestionPrompt = (text) => {
    if (!text) return "";
    const lines = String(text).split("\n");
    const optionIndex = lines.findIndex((line) => /^\s*[A-Z]\)\s*/.test(line));
    if (optionIndex === -1) return String(text);
    return lines.slice(0, optionIndex).join("\n").trim();
  };

  const activeQuestionData =
    selectedExercise?.questions?.[activeQuestion] || {
      type: "Question",
      text: "No questions available.",
    };
  const questionPrompt = getQuestionPrompt(activeQuestionData.text);
  const questionOptions = isMultipleChoice(activeQuestionData)
    ? extractOptions(activeQuestionData.text)
    : [];
  const selectedAnswer = activeQuestionData.id
    ? answers[activeQuestionData.id] || ""
    : "";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
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
            {exercises.length === 0 ? (
              <EmptyState />
            ) : filteredExercises.length > 0 ? (
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
                          onClick={() => handleSelectExercise(ex)}
                          className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                        >
                          <Activity size={18} /> Solve
                        </button>
                        <button
                          onClick={() => downloadExercise(ex)}
                          disabled={isDownloading}
                          className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                        >
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
                          onClick={() => handleSelectExercise(ex)}
                          className="px-6 py-2.5 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs"
                        >
                          Solve
                        </button>
                        <button
                          onClick={() => downloadExercise(ex)}
                          disabled={isDownloading}
                          className="p-2.5 text-slate-400 hover:text-slate-600 disabled:opacity-60"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <EmptyState />
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
                  <button
                    onClick={() => submitExercise("submitted")}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 disabled:opacity-60"
                  >
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
                        {activeQuestionData.type}
                      </span>
                      <h4 className="text-2xl font-extrabold text-slate-800 leading-snug whitespace-pre-line">
                        {questionPrompt || activeQuestionData.text}
                      </h4>
                    </div>

                    <div className="space-y-4">
                      {isMultipleChoice(activeQuestionData) &&
                      questionOptions.length > 0 ? (
                        <div className="space-y-3">
                          {questionOptions.map((option) => {
                            const isSelected = selectedAnswer === option.key;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() =>
                                  handleAnswerChange(
                                    activeQuestionData.id,
                                    option.key,
                                  )
                                }
                                disabled={!activeQuestionData.id}
                                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl border transition-all ${
                                  isSelected
                                    ? "border-[#2D70FD] bg-white shadow-sm"
                                    : "border-slate-200 bg-slate-50 hover:bg-white"
                                } ${!activeQuestionData.id ? "opacity-60" : ""}`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                    isSelected
                                      ? "border-[#2D70FD] bg-[#2D70FD]/10"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected ? (
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#2D70FD]" />
                                  ) : null}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 text-left">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Type your answer here..."
                          value={selectedAnswer}
                          onChange={(e) =>
                            handleAnswerChange(
                              activeQuestionData.id,
                              e.target.value,
                            )
                          }
                          disabled={!activeQuestionData.id}
                          className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 disabled:opacity-60"
                        />
                      )}
                      <div className="flex justify-between items-center">
                        <button
                          onClick={handleNextQuestion}
                          disabled={
                            selectedExercise.questions.length === 0 ||
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
                  <button
                    onClick={() => submitExercise("in_progress")}
                    disabled={isSubmitting}
                    className="text-slate-400 font-bold hover:text-slate-600 transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    <Download size={18} /> Save Progress
                  </button>
                  <div className="flex gap-4">
                    <button
                      onClick={() => downloadExercise(selectedExercise)}
                      disabled={isDownloading}
                      className="px-8 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-white transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                      <Printer size={18} /> Print PDF
                    </button>
                    <button
                      onClick={() => submitExercise("submitted")}
                      disabled={isSubmitting}
                      className="px-8 py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 flex items-center gap-2 disabled:opacity-60"
                    >
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
