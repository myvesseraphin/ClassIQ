import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CheckCircle,
  Download,
  Printer,
  ArrowLeft,
  Clock,
  Search,
  PieChart,
  Filter,
  LayoutGrid,
  List,
  Brain,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

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
  const navigate = useNavigate();
  const [view, setView] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Subjects");
  const [selectedSubject, setSelectedSubject] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [resourceTopic, setResourceTopic] = useState("");
  const [linkedResources, setLinkedResources] = useState([]);
  const [resourceLesson, setResourceLesson] = useState(null);
  const [markingWeakAreaId, setMarkingWeakAreaId] = useState("");
  const [exportingPlpId, setExportingPlpId] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadSubjects = async () => {
      try {
        const { data } = await api.get("/student/plp");
        if (isMounted && Array.isArray(data?.subjects)) {
          setSubjects(data.subjects);
        }
      } catch (err) {
        console.error("Failed to load PLP subjects", err);
        toast.error("Failed to load PLP subjects.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadSubjects();
    return () => {
      isMounted = false;
    };
  }, []);

  const filters = [
    "All Subjects",
    ...Array.from(
      new Set(subjects.map((sub) => sub.category).filter(Boolean)),
    ),
  ];
  const filteredSubjects = subjects.filter((sub) => {
    const matchesFilter =
      activeFilter === "All Subjects" || sub.category === activeFilter;
    const matchesSearch =
      (sub.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.id || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSelectSubject = async (sub) => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/student/plp/${sub.id}`);
      const detail = data.subject || sub;
      setSelectedSubject({
        ...sub,
        ...detail,
        weakAreas: detail.weakAreas || sub.weakAreas || [],
        actions: detail.actions || sub.actions || [],
        tips: detail.tips || sub.tips || [],
        feedback: detail.feedback || sub.feedback || "",
      });
      setView("detail");
    } catch (err) {
      console.error("Failed to load PLP detail", err);
      toast.error("Failed to load PLP detail.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPractice = (subjectName, weakAreaTopic) => {
    const subject = encodeURIComponent(subjectName || "");
    const weakArea = encodeURIComponent(weakAreaTopic || "");
    navigate(`/student/exercise?subject=${subject}&weakArea=${weakArea}`);
  };

  const handleViewWeakAreaResources = async (plpSubjectId, weakAreaTopic) => {
    if (!plpSubjectId) return;
    setResourceTopic(weakAreaTopic || "");
    setIsResourcesOpen(true);
    setIsResourcesLoading(true);
    setLinkedResources([]);
    setResourceLesson(null);
    try {
      const { data } = await api.get(`/student/plp/${plpSubjectId}/resources`, {
        params: { topic: weakAreaTopic || "" },
      });
      setLinkedResources(Array.isArray(data?.resources) ? data.resources : []);
      setResourceLesson(data?.lesson || null);
    } catch (err) {
      console.error("Failed to load linked resources", err);
      toast.error("Failed to load linked resources.");
    } finally {
      setIsResourcesLoading(false);
    }
  };

  const handleMarkWeakAreaImproved = async (weakArea) => {
    if (!weakArea?.id) return;
    setMarkingWeakAreaId(weakArea.id);
    try {
      const { data } = await api.patch(
        `/student/plp/weak-areas/${weakArea.id}/mark-improved`,
      );
      const updatedWeakArea = data?.weakArea || null;
      if (!updatedWeakArea) throw new Error("Invalid weak area response");
      setSelectedSubject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          weakAreas: Array.isArray(prev.weakAreas)
            ? prev.weakAreas.map((item) =>
                item.id === updatedWeakArea.id
                  ? {
                      ...item,
                      level: updatedWeakArea.level,
                      desc: updatedWeakArea.desc,
                    }
                  : item,
              )
            : prev.weakAreas,
        };
      });
      toast.success("Marked as improved.");
    } catch (err) {
      console.error("Failed to mark weak area as improved", err);
      toast.error("Failed to update weak area.");
    } finally {
      setMarkingWeakAreaId("");
    }
  };

  const resolveFilename = (headerValue, fallback = "plp-export.pdf") => {
    const value = String(headerValue || "");
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "");
    }
    const basicMatch = value.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback;
  };

  const handleExportPlp = async (subject) => {
    const subjectId = String(subject?.id || "");
    if (!subjectId) return;
    try {
      setExportingPlpId(subjectId);
      const response = await api.get(`/student/plp/${subjectId}/export`, {
        responseType: "blob",
      });
      const safeName = (subject?.name || "plp")
        .replace(/[^a-z0-9-_]+/gi, "_")
        .slice(0, 60);
      const filename = resolveFilename(
        response.headers?.["content-disposition"],
        `${safeName || "plp"}_learning_plan.pdf`,
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export learning plan", err);
      toast.error("Failed to export learning plan.");
    } finally {
      setExportingPlpId("");
    }
  };
  if (isLoading) {
    return <StudentPageSkeleton variant="plp" />;
  }
  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
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
                            <button
                              onClick={() => handleExportPlp(sub)}
                              disabled={exportingPlpId === String(sub.id)}
                              className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:shadow-lg transition-all shadow-sm disabled:opacity-60"
                            >
                              <Download size={18} /> Export
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-[2rem] overflow-x-auto shadow-sm">
                      <table className="w-full min-w-[720px] text-left border-collapse">
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
                                  {String(sub.status || "Needs Support").toUpperCase()}
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
                                  <button
                                    onClick={() => handleExportPlp(sub)}
                                    disabled={exportingPlpId === String(sub.id)}
                                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                                  >
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
                  <EmptyState />
                )}
              </>
            ) : (
              !selectedSubject ? (
                <EmptyState />
              ) : (
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                  <div className="bg-white border-2 border-blue-50 rounded-[3rem] p-8 md:p-10 lg:p-12 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between shadow-xl shadow-blue-500/5">
                    <div className="space-y-6">
                      <span className="text-[#2D70FD] text-[10px] font-black uppercase tracking-[0.2em] bg-blue-50 px-5 py-2 rounded-full">
                        Unit Progress Analysis
                      </span>
                      <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight break-words">
                        {selectedSubject.name}
                      </h2>
                      <div className="flex items-center gap-5 text-slate-400 font-black text-[12px] break-words">
                        <Clock size={20} className="text-blue-400" />
                        Last Intelligence Scan:{" "}
                        {selectedSubject.lastAssessment || "--"}
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
                    {selectedSubject.weakAreas.length > 0 ? (
                      selectedSubject.weakAreas.map((wa, i) => (
                        <div
                          key={wa.id || i}
                          className="bg-white border border-slate-100 p-8 rounded-[2.5rem] hover:shadow-lg transition-all"
                        >
                          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-6">
                              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-[#2D70FD]">
                                <Brain size={28} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-black text-slate-800 text-xl mb-1 break-words">
                                    {wa.topic}
                                  </h4>
                                  {wa.level ? (
                                    <span
                                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                                        String(wa.level).toLowerCase() === "improved"
                                          ? "bg-emerald-50 text-emerald-600"
                                          : "bg-blue-50 text-[#2D70FD]"
                                      }`}
                                    >
                                      {wa.level}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-sm text-slate-500 font-bold leading-relaxed break-words">
                                  {wa.desc || "No additional detail yet."}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 md:justify-end">
                              <button
                                onClick={() =>
                                  handleStartPractice(selectedSubject.name, wa.topic)
                                }
                                className="px-4 py-2 rounded-xl bg-[#2D70FD] text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"
                              >
                                <Sparkles size={14} /> Start practice
                              </button>
                              <button
                                onClick={() =>
                                  handleViewWeakAreaResources(
                                    selectedSubject.id,
                                    wa.topic,
                                  )
                                }
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-white"
                              >
                                <BookOpen size={14} /> View resources
                              </button>
                              <button
                                onClick={() => handleMarkWeakAreaImproved(wa)}
                                disabled={
                                  markingWeakAreaId === wa.id ||
                                  String(wa.level || "").toLowerCase() === "improved"
                                }
                                className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-emerald-50 disabled:opacity-60"
                              >
                                {markingWeakAreaId === wa.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={14} />
                                )}
                                Mark improved
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem]">
                        <p className="text-sm font-bold text-slate-500">
                          No weak area has been recorded for this subject yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="lg:col-span-4 space-y-8">
                  <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm relative overflow-hidden">
                    <h4 className="text-[13px] font-black text-[#2D70FD] mb-8 uppercase tracking-[0.2em]">
                      AI Recommend
                    </h4>
                    <p className="text-xl font-black text-slate-700 leading-relaxed relative z-10 mb-8 break-words">
                      "
                      {selectedSubject.feedback ||
                        "Keep practicing with your current recovery roadmap."}
                      "
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
                      {selectedSubject.actions.length > 0 ? (
                        selectedSubject.actions.map((act, i) => (
                          <div
                            key={i}
                            className="flex gap-4 items-start p-5 bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-colors"
                          >
                            <CheckCircle
                              size={20}
                              className="text-blue-500 mt-0.5"
                            />
                            <span className="text-sm font-black text-slate-700 break-words">
                              {act}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm font-bold text-slate-500">
                          No action plan items yet.
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleExportPlp(selectedSubject)}
                      disabled={exportingPlpId === String(selectedSubject?.id || "")}
                      className="w-full mt-5 py-3 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-500/20 disabled:opacity-60"
                    >
                      <Printer size={20} /> Generate Assets
                    </button>
                  </div>
                </aside>
              </div>
              )
            )}

            {isResourcesOpen ? (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                <div
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                  onClick={() => {
                    if (!isResourcesLoading) setIsResourcesOpen(false);
                  }}
                />
                <div className="relative w-full max-w-3xl rounded-[2rem] bg-white border border-slate-100 shadow-2xl p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#2D70FD]">
                        Linked Books
                      </p>
                      <h3 className="mt-2 text-2xl font-black text-slate-900 break-words">
                        {resourceTopic || selectedSubject?.name || "Resources"}
                      </h3>
                      {resourceLesson?.recommendedPages ? (
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Recommended pages: {resourceLesson.recommendedPages}
                        </p>
                      ) : null}
                    </div>
                    <button
                      onClick={() => setIsResourcesOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-black text-sm"
                    >
                      Close
                    </button>
                  </div>

                  <div className="mt-6 max-h-[60vh] overflow-y-auto space-y-3">
                    {isResourcesLoading ? (
                      <div className="py-16 flex items-center justify-center">
                        <Loader2 size={28} className="animate-spin text-[#2D70FD]" />
                      </div>
                    ) : linkedResources.length > 0 ? (
                      linkedResources.map((resource) => (
                        <div
                          key={resource.id}
                          className="rounded-2xl border border-slate-100 p-4 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 break-words">
                              {resource.name}
                            </p>
                            <p className="text-xs font-bold text-slate-500 break-words">
                              {resource.subject || selectedSubject?.name}{" "}
                              {resource.date ? `| ${resource.date}` : ""}
                            </p>
                          </div>
                          <a
                            href={resource.url || undefined}
                            target={resource.url ? "_blank" : undefined}
                            rel={resource.url ? "noreferrer noopener" : undefined}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                              resource.url
                                ? "bg-[#2D70FD] text-white"
                                : "bg-slate-100 text-slate-400 pointer-events-none"
                            }`}
                          >
                            Open <ExternalLink size={14} />
                          </a>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm font-bold text-slate-500 py-8 text-center">
                        No linked books found for this weak area.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
      </div>
    </div>
  );
};

export default PLPBundle;
