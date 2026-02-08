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
  Calendar,
  UserCircle,
  ChevronDown,
} from "lucide-react";

const MyCourses = () => {
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

  const currentYear = new Date().getFullYear();
  const currentTerm = "Term 2";
  const currentGrade = "Year 1B";
  const program = "RCA";

  const courses = [
    {
      id: 1,
      name: "Mathematics",
      code: "MATH-201",
      teacher: "Mr. Habimana",
      schedule: "Mon/Wed 10:00 - 11:30",
      credits: 4,
      category: "Core",
      progress: 82,
      status: "Active",
    },
    {
      id: 2,
      name: "Physics",
      code: "PHY-214",
      teacher: "Ms. Uwase",
      schedule: "Tue/Thu 08:00 - 09:30",
      credits: 3,
      category: "Core",
      progress: 74,
      status: "Active",
    },
    {
      id: 3,
      name: "Chemistry",
      code: "CHEM-210",
      teacher: "Mr. Niyonzima",
      schedule: "Mon/Fri 14:00 - 15:30",
      credits: 3,
      category: "Core",
      progress: 69,
      status: "Active",
    },
    {
      id: 4,
      name: "Web UI Design",
      code: "WEB-112",
      teacher: "Ms. Mukamana",
      schedule: "Wed 16:00 - 18:00",
      credits: 2,
      category: "Elective",
      progress: 88,
      status: "Active",
    },
    {
      id: 5,
      name: "Embedded Systems",
      code: "EMB-301",
      teacher: "Mr. Rukundo",
      schedule: "Thu 13:00 - 15:00",
      credits: 3,
      category: "Elective",
      progress: 62,
      status: "Pending",
    },
  ];

  const filters = ["All", "Core", "Elective"];

  const filteredCourses = courses.filter(
    (course) =>
      (activeFilter === "All" || course.category === activeFilter) &&
      course.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const { totalCourses, coreCount, electiveCount, avgProgress } = useMemo(() => {
    const total = courses.length;
    const core = courses.filter((c) => c.category === "Core").length;
    const elective = courses.filter((c) => c.category === "Elective").length;
    const average =
      total > 0
        ? Math.round(
            courses.reduce((sum, c) => sum + c.progress, 0) / total,
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
    if (!appealNotice) return;
    const timer = setTimeout(() => setAppealNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [appealNotice]);

  const submitMismatchAppeal = () => {
    setAppealNotice({
      title: "Appeal submitted",
      message: `We will review "${selectedCourse.name}" for ${currentGrade} (${program}) within 3 working days.`,
    });
    setSelectedCourse(null);
    setMismatchReason("Not in my grade");
    setMismatchDetails("");
  };

  const submitMissingAppeal = () => {
    if (!missingSubject.trim()) {
      setMissingSubjectError(true);
      return;
    }
    setAppealNotice({
      title: "Missing subject reported",
      message: `We have received your request for "${missingSubject}".`,
    });
    setShowMissingAppeal(false);
    setMissingSubject("");
    setMissingReason("Missing core subject");
    setMissingDetails("");
    setMissingSubjectError(false);
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "Active":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "Pending":
        return "bg-amber-50 text-amber-600 border-amber-100";
      default:
        return "bg-slate-50 text-slate-500 border-slate-100";
    }
  };

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
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-emerald-700 flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5" />
                <div>
                  <p className="text-sm font-black">{appealNotice.title}</p>
                  <p className="text-xs font-bold text-emerald-600">
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
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                },
                {
                  label: "Electives",
                  value: electiveCount,
                  icon: <CheckCircle2 size={20} />,
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                },
                {
                  label: "Avg Progress",
                  value: `${avgProgress}%`,
                  icon: <Activity size={20} />,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
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
              <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                <BookOpen className="mx-auto mb-4 text-slate-300" size={48} />
                <p className="font-black text-slate-400 uppercase tracking-widest">
                  No courses found
                </p>
                <p className="text-sm text-slate-400 mt-2">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(course.status)}`}
                      >
                        {course.status}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {course.code}
                      </span>
                    </div>
                    <h3 className="font-black text-slate-800 text-lg mb-1 leading-tight">
                      {course.name}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                      {course.category} | {course.credits} Credits
                    </p>
                    <div className="grid grid-cols-1 gap-3 text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        {course.schedule}
                      </div>
                      <div className="flex items-center gap-2">
                        <UserCircle size={14} className="text-slate-400" />
                        {course.teacher}
                      </div>
                    </div>
                    <div className="mt-6">
                      <div className="flex items-center justify-between text-xs font-black text-slate-600 mb-2">
                        <span>Progress</span>
                        <span>{course.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2D70FD] rounded-full transition-all"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Not in your grade?
                      </div>
                      <button
                        onClick={() => setSelectedCourse(course)}
                        className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all"
                      >
                        Appeal
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">
                    Appeal Center
                  </p>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
                    Fix course mismatches quickly
                  </h2>
                  <p className="text-sm text-slate-500 font-bold mt-2 max-w-2xl">
                    If a subject appears that does not match your current grade,
                    use the Appeal button on the course card. If a subject is
                    missing, report it here.
                  </p>
                </div>
                <button
                  onClick={() => setShowMissingAppeal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg"
                >
                  <Plus size={16} /> Report Missing Subject
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        Course Mismatch
                      </h3>
                      <p className="text-xs font-bold text-slate-400">
                        Appeal a subject that does not belong to your grade.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Response time</span>
                    <span className="flex items-center gap-2 text-slate-400">
                      <ChevronDown size={14} className="-rotate-90" />
                      3 working days
                    </span>
                  </div>
                </div>

                <div className="p-6 bg-blue-50/70 border border-blue-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 flex items-center justify-center">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">
                        Missing Subject
                      </h3>
                      <p className="text-xs font-bold text-slate-400">
                        Request a subject that should appear this term.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMissingAppeal(true)}
                    className="mt-6 w-full py-3 bg-white text-blue-700 border border-blue-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                  >
                    File Missing Subject Appeal
                  </button>
                </div>
              </div>
            </section>
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
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
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
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Reason
                  </label>
                  <select
                    value={mismatchReason}
                    onChange={(e) => setMismatchReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-bold"
                  >
                    <option>Not in my grade</option>
                    <option>Wrong program/stream</option>
                    <option>Duplicate subject</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Details (optional)
                  </label>
                  <textarea
                    rows="3"
                    value={mismatchDetails}
                    onChange={(e) => setMismatchDetails(e.target.value)}
                    placeholder="Add any extra context that will help the review team..."
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-bold resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedCourse(null)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMismatchAppeal}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 transition-colors active:scale-95"
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
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={missingSubject}
                    onChange={(e) => {
                      setMissingSubject(e.target.value);
                      if (missingSubjectError) setMissingSubjectError(false);
                    }}
                    placeholder="e.g. Technical Drawing"
                    className={`w-full bg-slate-50 border px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold ${
                      missingSubjectError
                        ? "border-rose-300 focus:ring-rose-400"
                        : "border-slate-200"
                    }`}
                  />
                  {missingSubjectError && (
                    <p className="text-xs font-bold text-rose-500 mt-2">
                      Please enter the missing subject name.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
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
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Additional Details (optional)
                  </label>
                  <textarea
                    rows="3"
                    value={missingDetails}
                    onChange={(e) => setMissingDetails(e.target.value)}
                    placeholder="Include any helpful information, such as your registration date."
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-bold resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowMissingAppeal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMissingAppeal}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors active:scale-95"
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
