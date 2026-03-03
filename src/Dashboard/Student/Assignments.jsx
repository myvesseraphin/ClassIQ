import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  Download,
  FileText,
  LayoutGrid,
  List,
  Search,
  User,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

const statusBadgeClass = (status) =>
  String(status || "").toLowerCase() === "completed"
    ? "bg-emerald-50 text-emerald-600"
    : "bg-blue-50 text-[#2D70FD]";

const reviewBadgeClass = (reviewStatus) => {
  const value = String(reviewStatus || "").toLowerCase();
  if (value.includes("ai")) return "bg-blue-50 text-[#2D70FD]";
  if (value.includes("teacher")) return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
};

const Assignments = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState("list");
  const [activeSubject, setActiveSubject] = useState("All");
  const [activeSummaryFilter, setActiveSummaryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAssignments = async () => {
      try {
        const { data } = await api.get("/student/assignments");
        if (!active) return;
        setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      } catch (err) {
        console.error("Failed to load assignments", err);
        toast.error("Failed to load assignments.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadAssignments();
    return () => {
      active = false;
    };
  }, []);

  const subjects = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(assignments.map((item) => item.subject).filter(Boolean)),
      ),
    ],
    [assignments],
  );

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((item) => {
        const matchesSubject =
          activeSubject === "All" || item.subject === activeSubject;
        const isCompleted =
          String(item.status || "").toLowerCase() === "completed";
        const matchesSummaryFilter =
          activeSummaryFilter === "all" ||
          (activeSummaryFilter === "completed" && isCompleted) ||
          (activeSummaryFilter === "pending" && !isCompleted);
        const keyword = `${item.title || ""} ${item.subject || ""} ${item.type || ""} ${
          item.teacher?.name || ""
        }`.toLowerCase();
        const matchesSearch = keyword.includes(searchQuery.toLowerCase());
        return matchesSubject && matchesSummaryFilter && matchesSearch;
      }),
    [assignments, activeSubject, activeSummaryFilter, searchQuery],
  );

  const summary = useMemo(() => {
    const total = assignments.length;
    const pending = assignments.filter(
      (item) => String(item.status || "").toLowerCase() !== "completed",
    ).length;
    const completed = total - pending;
    return { total, pending, completed };
  }, [assignments]);

  const resolveFilename = (headerValue, fallback = "assignments-export.pdf") => {
    const value = String(headerValue || "");
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "");
    }
    const basicMatch = value.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback;
  };

  const goToPractice = (assignment, action = "start") => {
    const params = new URLSearchParams();
    if (assignment?.subject) params.set("subject", assignment.subject);
    if (assignment?.weakArea) params.set("weakArea", assignment.weakArea);
    if (assignment?.exerciseId) params.set("exerciseId", assignment.exerciseId);
    if (action === "review") {
      params.set("review", "1");
    } else if (action) {
      params.set("action", action);
    }
    const query = params.toString();
    navigate(`/student/exercise${query ? `?${query}` : ""}`);
  };

  const handleExportAssignments = async () => {
    if (filteredAssignments.length === 0) {
      toast.info("No assignments available to export.");
      return;
    }
    try {
      setIsExporting(true);
      const response = await api.post(
        "/student/assignments/export",
        {
          assignments: filteredAssignments,
          filters: {
            subject: activeSubject,
            status: activeSummaryFilter,
            search: searchQuery,
          },
          summary,
        },
        { responseType: "blob" },
      );
      const filename = resolveFilename(
        response.headers?.["content-disposition"],
        "assignments-export.pdf",
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
      console.error("Failed to export assignments", err);
      toast.error("Failed to export assignments.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <StudentPageSkeleton variant="assignments" />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Teacher Assignments
          </h1>
          <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-3">
            <button
              onClick={handleExportAssignments}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#2D70FD] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm disabled:opacity-60"
            >
              <Download size={16} />
              {isExporting ? "Exporting..." : "Export"}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Total"
            value={summary.total}
            icon={<ClipboardList size={18} />}
            active={activeSummaryFilter === "all"}
            onClick={() => setActiveSummaryFilter("all")}
          />
          <StatCard
            label="Pending"
            value={summary.pending}
            icon={<Clock size={18} />}
            active={activeSummaryFilter === "pending"}
            onClick={() => setActiveSummaryFilter("pending")}
          />
          <StatCard
            label="Completed"
            value={summary.completed}
            icon={<CheckCircle2 size={18} />}
            active={activeSummaryFilter === "completed"}
            onClick={() => setActiveSummaryFilter("completed")}
          />
        </div>

        {assignments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="bg-white border border-slate-100 rounded-[2rem] p-4 md:p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                  {subjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => setActiveSubject(subject)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        activeSubject === subject
                          ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                          : "bg-white text-slate-500 border border-slate-200"
                      }`}
                    >
                      {subject}
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
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search assignments..."
                    className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-bold text-slate-700"
                  />
                </div>
              </div>
            </div>

            {filteredAssignments.length === 0 ? (
              <EmptyState />
            ) : viewMode === "list" ? (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                {filteredAssignments.map((item, index) => (
                  <div
                    key={item.id}
                    className={`px-6 py-6 ${index !== filteredAssignments.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px_210px_auto] lg:items-center">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center mt-1">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-800 break-words">
                            {item.title}
                          </p>
                          <p className="text-xs font-bold text-slate-400 mt-1 break-words">
                            {item.subject || "Subject"} | {item.type || "Assessment"}
                          </p>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Teacher
                        </p>
                        <p className="font-black text-slate-700 flex items-center gap-2 mt-1">
                          <User size={14} className="text-slate-400" />
                          {item.teacher?.name || "Teacher"}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Due Date
                        </p>
                        <p className="font-black text-slate-700 mt-1">
                          {item.dueDate || item.date || "--"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {String(item.status || "").toLowerCase() === "completed" ? (
                          item.category === "exercise" ? (
                            <button
                              onClick={() => goToPractice(item, "review")}
                              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-[#2D70FD] text-white"
                            >
                              Review
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-[#2D70FD] text-white"
                            >
                              Review
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => goToPractice(item, "start")}
                            className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-blue-50 text-[#2D70FD]"
                          >
                            Start
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredAssignments.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-100 rounded-[2.2rem] p-7 shadow-sm hover:border-blue-200 transition-all"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusBadgeClass(item.status)}`}
                      >
                        {item.status || "In Progress"}
                      </span>
                    </div>
                    <p className="font-black text-slate-800 text-lg mt-4 break-words">
                      {item.title}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1 break-words">
                      {item.subject || "Subject"} | {item.type || "Assessment"}
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-4 break-words">
                      Teacher: {item.teacher?.name || "Teacher"}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1">
                      Due: {item.dueDate || item.date || "--"}
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Attempts: {Number(item.attemptCount) || 0}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${reviewBadgeClass(item.reviewStatus)}`}
                      >
                        {item.reviewStatus || "Not submitted"}
                      </span>
                      {item.source === "teacher_exercise" ? (
                        <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-[#2D70FD]">
                          Class Exercise
                        </span>
                      ) : null}
                    </div>
                    {String(item.status || "").toLowerCase() === "completed" ? (
                      item.category === "exercise" ? (
                        <button
                          onClick={() => goToPractice(item, "review")}
                          className="w-full mt-6 py-3.5 rounded-2xl text-sm font-black bg-[#2D70FD] text-white"
                        >
                          Review Answers
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="w-full mt-6 py-3.5 rounded-2xl text-sm font-black bg-[#2D70FD] text-white"
                        >
                          Review Report
                        </button>
                      )
                    ) : (
                      <div className="mt-6 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => goToPractice(item, "start")}
                          className="py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-50 text-[#2D70FD]"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => goToPractice(item, "submit")}
                          className="py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-[#2D70FD] text-white"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
          />
          <div className="relative w-full max-w-xl rounded-[2.2rem] bg-white border border-slate-100 shadow-2xl p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-900 break-words">
                  {selectedItem.title}
                </h3>
                <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-widest break-words">
                  {selectedItem.subject || "Subject"} |{" "}
                  {selectedItem.type || "Assessment"}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Teacher
                </p>
                <p className="text-sm font-black text-slate-800 mt-1 break-words">
                  {selectedItem.teacher?.name || "Teacher"}
                </p>
              </div>

              {selectedItem.grade ? (
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                    Score
                  </p>
                  <p className="text-lg font-black text-[#2D70FD] mt-1">
                    {selectedItem.grade}
                  </p>
                </div>
              ) : null}

              <div className="p-4 rounded-xl border border-slate-100 bg-white">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Review Status
                </p>
                <p className="text-sm font-black text-slate-700 mt-1 break-words">
                  {selectedItem.reviewStatus || "Not submitted"}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-white">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Attempt Count
                </p>
                <p className="text-sm font-black text-slate-700 mt-1">
                  {Number(selectedItem.attemptCount) || 0}
                </p>
              </div>

              {selectedItem.weakArea ? (
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Weak Area
                  </p>
                  <p className="text-sm font-bold text-slate-700 mt-1 break-words">
                    {selectedItem.weakArea}
                  </p>
                </div>
              ) : null}

              {selectedItem.aiFeedback ? (
                <div className="p-4 rounded-xl border border-slate-100 bg-white">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Feedback
                  </p>
                  <p className="text-sm font-bold text-slate-700 mt-1 leading-relaxed break-words">
                    {selectedItem.aiFeedback}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => navigate("/student/plp")}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-black text-sm"
              >
                Open PLP
              </button>
              <button
                onClick={() => goToPractice(selectedItem)}
                className="px-5 py-3 rounded-xl bg-[#2D70FD] text-white font-black text-sm"
              >
                Practice Subject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ label, value, icon, active = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left bg-white p-6 rounded-[2rem] flex items-center gap-4 shadow-sm transition-all ${
      active
        ? "border-2 border-[#2D70FD] ring-2 ring-blue-100"
        : "border border-slate-100 hover:border-blue-200"
    }`}
  >
    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  </button>
);

export default Assignments;
