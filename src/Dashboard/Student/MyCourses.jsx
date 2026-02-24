import React, { useMemo, useEffect, useState } from "react";
import {
  BookOpen,
  Library,
  CheckCircle2,
  Activity,
  Search,
  Filter,
  Plus,
  X,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

const MyCourses = () => {
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value || "",
    );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showMissingAppeal, setShowMissingAppeal] = useState(false);
  const [appealNotice, setAppealNotice] = useState(null);
  const [mismatchReason, setMismatchReason] = useState("Not in my grade");
  const [mismatchDetails, setMismatchDetails] = useState("");
  const [missingSubject, setMissingSubject] = useState("");
  const [missingReason, setMissingReason] = useState("Missing core subject");
  const [missingDetails, setMissingDetails] = useState("");
  const [missingSubjectError, setMissingSubjectError] = useState(false);
  const [mismatchAttachment, setMismatchAttachment] = useState(null);
  const [missingAttachment, setMissingAttachment] = useState(null);
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const currentTerm = "Term 2";
  const currentGrade = "Year 1B";
  const program = "RCA";

  const filters = ["All", "Core", "Elective"];

  const filteredCourses = courses.filter(
    (course) =>
      (activeFilter === "All" || course.category === activeFilter) &&
      course.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const { totalCourses, coreCount, electiveCount, avgProgress } =
    useMemo(() => {
      const total = courses.length;
      const core = courses.filter((c) => c.category === "Core").length;
      const elective = courses.filter((c) => c.category === "Elective").length;
      const average =
        total > 0
          ? Math.round(
              courses.reduce((sum, c) => sum + (c.progress || 0), 0) / total,
            )
          : 0;
      return {
        totalCourses: total,
        coreCount: core,
        electiveCount: elective,
        avgProgress: average,
      };
    }, [courses]);

  useEffect(() => {
    let isMounted = true;
    const loadCourses = async () => {
      try {
        const { data } = await api.get("/student/courses");
        if (isMounted && Array.isArray(data?.courses)) {
          setCourses(data.courses);
        }
      } catch (err) {
        console.error("Failed to load courses", err);
        toast.error("Failed to load courses.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadCourses();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!appealNotice) return;
    const timer = setTimeout(() => setAppealNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [appealNotice]);

  const uploadAttachment = async (file) => {
    if (!file) return {};
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/uploads", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return {
      attachmentUrl: data?.file?.url,
      attachmentName: data?.file?.name,
    };
  };

  const submitMismatchAppeal = async () => {
    try {
      if (!isUuid(selectedCourse?.id)) {
        toast.error("Sync courses first before submitting an appeal.");
        return;
      }
      const attachment = await uploadAttachment(mismatchAttachment);
      await api.post("/student/appeals", {
        type: "mismatch",
        courseId: selectedCourse?.id,
        reason: mismatchReason,
        details: mismatchDetails,
        ...attachment,
      });
      setAppealNotice({
        title: "Appeal submitted",
        message: `We will review "${selectedCourse.name}" for ${currentGrade} (${program}) within 3 working days.`,
      });
      setSelectedCourse(null);
      setMismatchReason("Not in my grade");
      setMismatchDetails("");
      setMismatchAttachment(null);
      toast.success("Appeal submitted.");
    } catch (err) {
      console.error("Failed to submit mismatch appeal", err);
      toast.error("Unable to submit appeal.");
      setAppealNotice({
        title: "Appeal failed",
        message: "We could not submit your appeal. Please try again.",
      });
    }
  };

  const submitMissingAppeal = async () => {
    if (!missingSubject.trim()) {
      setMissingSubjectError(true);
      return;
    }
    try {
      const attachment = await uploadAttachment(missingAttachment);
      await api.post("/student/appeals", {
        type: "missing",
        subjectName: missingSubject,
        reason: missingReason,
        details: missingDetails,
        ...attachment,
      });
      setAppealNotice({
        title: "Missing subject reported",
        message: `We have received your request for "${missingSubject}".`,
      });
      setShowMissingAppeal(false);
      setMissingSubject("");
      setMissingReason("Missing core subject");
      setMissingDetails("");
      setMissingSubjectError(false);
      setMissingAttachment(null);
      toast.success("Request submitted.");
    } catch (err) {
      console.error("Failed to submit missing subject appeal", err);
      toast.error("Unable to submit request.");
      setAppealNotice({
        title: "Request failed",
        message: "We could not submit your request. Please try again.",
      });
    }
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "Active":
        return "bg-blue-50 text-blue-700 border-blue-100";
      case "Pending":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-white text-blue-600 border-blue-100";
    }
  };

  if (isLoading) {
    return <StudentPageSkeleton variant="courses" />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white border border-slate-100 text-[#2D70FD]">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                    My Courses
                  </h1>
                  <p className="text-sm text-slate-400 font-bold">
                    {currentGrade} | {program} | {currentTerm} {currentYear}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMissingAppeal(true)}
                  className="px-5 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                >
                  <Plus size={16} /> Report Missing Subject
                </button>
              </div>
            </div>

            {appealNotice && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4 text-blue-700 flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 text-blue-600" />
                <div>
                  <p className="text-sm font-bold">{appealNotice.title}</p>
                  <p className="text-xs font-bold text-blue-600">
                    {appealNotice.message}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {[
                {
                  label: "Total Courses",
                  value: totalCourses,
                  icon: <BookOpen size={20} />,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Core Subjects",
                  value: coreCount,
                  icon: <Library size={20} />,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Electives",
                  value: electiveCount,
                  icon: <CheckCircle2 size={20} />,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Avg Progress",
                  value: `${avgProgress}%`,
                  icon: <Activity size={20} />,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm"
                >
                  <div
                    className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}
                  >
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-black text-slate-800 leading-none">
                      {stat.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                  <Filter size={18} />
                </div>
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                      activeFilter === filter
                        ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                        : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-96 group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search your courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 shadow-sm"
                />
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${getStatusStyles(course.status)}`}
                      >
                        {course.status}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {course.code}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight">
                      {course.name}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                      {course.category}
                    </p>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Not in your grade?
                      </div>
                      <button
                        onClick={() => setSelectedCourse(course)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all"
                      >
                        Appeal
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">
                  Appeal Course
                </h2>
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Course
                  </label>
                  <input
                    type="text"
                    value={`${selectedCourse.name} (${selectedCourse.code})`}
                    readOnly
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl font-bold text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Reason
                  </label>
                  <select
                    value={mismatchReason}
                    onChange={(e) => setMismatchReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                  >
                    <option>Not in my grade</option>
                    <option>Wrong program/stream</option>
                    <option>Duplicate subject</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Details (optional)
                  </label>
                  <textarea
                    rows="3"
                    value={mismatchDetails}
                    onChange={(e) => setMismatchDetails(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMismatchAppeal}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors active:scale-95"
                >
                  Submit Appeal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMissingAppeal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">
                  Report Missing Subject
                </h2>
                <button
                  onClick={() => setShowMissingAppeal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={missingSubject}
                    onChange={(e) => {
                      setMissingSubject(e.target.value);
                      if (missingSubjectError) setMissingSubjectError(false);
                    }}
                    className={`w-full bg-slate-50 border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold ${
                      missingSubjectError
                        ? "border-blue-300 focus:ring-blue-400"
                        : "border-slate-200"
                    }`}
                  />
                  {missingSubjectError && (
                    <p className="text-xs font-bold text-blue-600 mt-2">
                      Please enter the missing subject name.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Reason
                  </label>
                  <select
                    value={missingReason}
                    onChange={(e) => setMissingReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold"
                  >
                    <option>Missing core subject</option>
                    <option>Registered elective not showing</option>
                    <option>Transfer credit update</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Details (optional)
                  </label>
                  <textarea
                    rows="3"
                    value={missingDetails}
                    onChange={(e) => setMissingDetails(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMissingAppeal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMissingAppeal}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors active:scale-95"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyCourses;
