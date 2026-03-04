import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  FileText,
  Filter,
  ImagePlus,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const norm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const doneStatus = (value) => ["completed", "submitted"].includes(norm(value));

const pct = (value) => {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const cls = (item) =>
  `${item?.level || ""} ${item?.classGroup || ""}`.trim() || "Class";

const TeacherAssessments = () => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [subject, setSubject] = useState("All");
  const [query, setQuery] = useState("");
  const [classesViewMode, setClassesViewMode] = useState("grid");
  const [studentsViewMode, setStudentsViewMode] = useState("list");

  const [selectedClass, setSelectedClass] = useState(null);
  const [classLoading, setClassLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [studentFilter, setStudentFilter] = useState("all");
  const [studentQuery, setStudentQuery] = useState("");

  const [generateBusy, setGenerateBusy] = useState(false);
  const [classUploadOpen, setClassUploadOpen] = useState(false);
  const [classUploadBusy, setClassUploadBusy] = useState(false);
  const [classUploadTitle, setClassUploadTitle] = useState("");
  const [classUploadDifficulty, setClassUploadDifficulty] = useState("Intermediate");
  const [classUploadQuestionCount, setClassUploadQuestionCount] = useState("8");
  const [classUploadSourceText, setClassUploadSourceText] = useState("");
  const [classUploadFile, setClassUploadFile] = useState(null);

  const [studentModalId, setStudentModalId] = useState("");
  const [scanModalStudent, setScanModalStudent] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanAssessmentId, setScanAssessmentId] = useState("new");
  const [scanAssessmentTitle, setScanAssessmentTitle] = useState("");
  const [scanType, setScanType] = useState("Assessment");
  const [scanFiles, setScanFiles] = useState([]);
  const [scanWeakArea, setScanWeakArea] = useState("");
  const [scanNotes, setScanNotes] = useState("");

  const loadClasses = async () => {
    const { data } = await api.get("/teacher/record-marks/classes");
    setClasses(Array.isArray(data?.classes) ? data.classes : []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get("/teacher/record-marks/classes");
        if (!active) return;
        setClasses(Array.isArray(data?.classes) ? data.classes : []);
      } catch (error) {
        console.error("Failed to load classes", error);
        toast.error("Failed to load classes.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadClassData = async (item) => {
    if (!item?.id) return;
    setClassLoading(true);
    try {
      const [studentsRes, assessmentsRes] = await Promise.all([
        api.get("/teacher/students"),
        api.get("/teacher/assessments"),
      ]);
      setStudents(Array.isArray(studentsRes?.data?.students) ? studentsRes.data.students : []);
      setAssessments(
        Array.isArray(assessmentsRes?.data?.assessments) ? assessmentsRes.data.assessments : [],
      );
    } catch (error) {
      console.error("Failed to load class data", error);
      toast.error("Failed to load class data.");
    } finally {
      setClassLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClass?.id) loadClassData(selectedClass);
  }, [selectedClass]);

  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(classes.map((c) => c.courseName).filter(Boolean)))],
    [classes],
  );

  useEffect(() => {
    if (!subjects.includes(subject)) setSubject("All");
  }, [subjects, subject]);

  const filteredClasses = useMemo(() => {
    const q = norm(query);
    return classes.filter((c) => {
      if (subject !== "All" && norm(c.courseName) !== norm(subject)) return false;
      if (!q) return true;
      return `${c.courseName || ""} ${c.level || ""} ${c.classGroup || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [classes, subject, query]);

  const overallStats = useMemo(
    () => ({
      classes: classes.length,
      students: classes.reduce((s, c) => s + (Number(c.studentsCount) || 0), 0),
      assessments: classes.reduce((s, c) => s + (Number(c.assessmentsCount) || 0), 0),
    }),
    [classes],
  );

  const scopedStudents = useMemo(() => {
    if (!selectedClass) return [];
    return students.filter(
      (s) =>
        norm(s.className) === norm(selectedClass.classGroup) &&
        norm(s.gradeLevel) === norm(selectedClass.level),
    );
  }, [students, selectedClass]);

  const scopedIds = useMemo(() => new Set(scopedStudents.map((s) => s.id)), [scopedStudents]);

  const scopedAssessments = useMemo(() => {
    if (!selectedClass) return [];
    const sub = norm(selectedClass.courseName);
    return assessments.filter(
      (a) => scopedIds.has(a?.student?.id) && (!sub || norm(a.subject) === sub),
    );
  }, [assessments, scopedIds, selectedClass]);

  const assessmentsByStudent = useMemo(() => {
    const map = new Map();
    scopedAssessments.forEach((assessment) => {
      const studentId = assessment?.student?.id;
      if (!studentId) return;
      if (!map.has(studentId)) map.set(studentId, []);
      map.get(studentId).push(assessment);
    });
    return map;
  }, [scopedAssessments]);

  const latestByStudent = useMemo(() => {
    const map = new Map();
    scopedAssessments.forEach((a) => {
      const id = a?.student?.id;
      if (!id || map.has(id)) return;
      map.set(id, a);
    });
    return map;
  }, [scopedAssessments]);

  const rows = useMemo(
    () =>
      scopedStudents.map((student) => {
        const latest = latestByStudent.get(student.id) || null;
        const list = assessmentsByStudent.get(student.id) || [];
        const completedAssessments = list.filter((item) => doneStatus(item?.status)).length;
        const totalAssessments = list.length;
        const done = doneStatus(latest?.status);
        return {
          student,
          studentNo: Number(student.studentNo) || null,
          done,
          grade: latest?.grade || "--",
          weakArea: latest?.weakArea || student.weakArea || "--",
          totalAssessments,
          completedAssessments,
          pendingAssessments: Math.max(totalAssessments - completedAssessments, 0),
        };
      }),
    [scopedStudents, latestByStudent, assessmentsByStudent],
  );

  const filteredRows = useMemo(() => {
    const q = norm(studentQuery);
    return rows.filter((r) => {
      if (studentFilter === "done" && !r.done) return false;
      if (studentFilter === "pending" && r.done) return false;
      if (!q) return true;
      return `${r.student.name || ""} ${r.student.email || ""} ${r.student.studentNumber || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, studentFilter, studentQuery]);

  const classStats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.done).length;
    const grades = rows.map((r) => pct(r.grade)).filter((v) => v !== null);
    const avg = grades.length
      ? `${Math.round(grades.reduce((s, v) => s + v, 0) / grades.length)}%`
      : "--";
    return { total, completed, pending: Math.max(total - completed, 0), avg };
  }, [rows]);

  const maxAssessmentsByStudent = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.totalAssessments || 0), 0),
    [rows],
  );

  const openClass = (item) => {
    setSelectedClass(item);
    setStudentQuery("");
    setStudentFilter("all");
  };

  const closeClass = () => {
    setSelectedClass(null);
    setStudents([]);
    setAssessments([]);
    setStudentModalId("");
  };

  const selectedStudent = scopedStudents.find((s) => s.id === studentModalId) || null;
  const selectedStudentAssessments = scopedAssessments.filter(
    (a) => a?.student?.id === studentModalId,
  );
  const classDifficultyOptions = useMemo(
    () => [
      { value: "Beginner", label: "Beginner", meta: "Foundational practice set" },
      { value: "Intermediate", label: "Intermediate", meta: "Balanced class-level set" },
      { value: "Advanced", label: "Advanced", meta: "Challenging extension set" },
    ],
    [],
  );
  const scanTypeOptions = useMemo(
    () => [
      { value: "Assessment", label: "Assessment", meta: "General student assessment" },
      { value: "Diagnostic", label: "Diagnostic", meta: "Identify weak points quickly" },
      { value: "Quiz", label: "Quiz", meta: "Short checkpoint submission" },
      { value: "Exam", label: "Exam", meta: "Formal test submission" },
    ],
    [],
  );
  const scanStudentOptions = useMemo(
    () =>
      scopedStudents.map((student) => ({
        value: student.id,
        label: student.name || student.email || "Student",
        meta: `ID ${student.studentNumber || "--"}`,
      })),
    [scopedStudents],
  );
  const scanStudentAssessments = useMemo(
    () =>
      scanModalStudent
        ? scopedAssessments.filter((a) => a?.student?.id === scanModalStudent.id)
        : [],
    [scopedAssessments, scanModalStudent],
  );
  const scanAssessmentOptions = useMemo(
    () => [
      {
        value: "new",
        label: "Create New Assessment",
        meta: "Start a fresh submission",
      },
      ...scanStudentAssessments.map((item) => ({
        value: item.id,
        label: item.title || "Assessment",
        meta: item.date || item.status || "",
      })),
    ],
    [scanStudentAssessments],
  );

  const openClassUpload = () => {
    if (!selectedClass?.id) {
      toast.error("Choose a class first.");
      return;
    }
    setClassUploadTitle(`${selectedClass.courseName || "Subject"} Exercise Set`);
    setClassUploadDifficulty("Intermediate");
    setClassUploadQuestionCount("8");
    setClassUploadSourceText("");
    setClassUploadFile(null);
    setClassUploadOpen(true);
  };

  const submitClassUpload = async () => {
    if (!selectedClass?.id) return;
    if (!classUploadFile && !String(classUploadSourceText || "").trim()) {
      toast.error("Add source text or upload a document/image.");
      return;
    }
    setClassUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("assignmentId", selectedClass.id);
      fd.append("title", String(classUploadTitle || "").trim());
      fd.append("difficulty", classUploadDifficulty);
      fd.append("questionCount", String(classUploadQuestionCount || "8"));
      fd.append("sourceText", String(classUploadSourceText || "").trim());
      if (classUploadFile) fd.append("file", classUploadFile);

      const { data } = await api.post("/teacher/exercises/upload-class", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const published =
        Number(data?.uploaded?.publishedStudents) || scopedStudents.length || 0;
      const count = Number(data?.uploaded?.questionCount) || 0;
      toast.success(`Uploaded and published to ${published} students (${count} questions).`);
      setClassUploadOpen(false);
      await Promise.all([loadClasses(), loadClassData(selectedClass)]);
    } catch (error) {
      console.error("Failed to upload class exercise", error);
      toast.error(error?.response?.data?.error || "Failed to upload exercise.");
    } finally {
      setClassUploadBusy(false);
    }
  };

  const generateDiagnostic = async () => {
    if (!selectedClass?.id || scopedStudents.length === 0) {
      toast.error("No students in class.");
      return;
    }
    setGenerateBusy(true);
    try {
      const ids = [];
      let failed = 0;
      for (const s of scopedStudents) {
        try {
          const { data } = await api.post("/teacher/exercises/generate", {
            assignmentId: selectedClass.id,
            studentId: s.id,
            questionCount: 6,
            difficulty: "Intermediate",
            weakArea: s.weakArea || "",
          });
          if (data?.exercise?.id) ids.push(data.exercise.id);
        } catch {
          failed += 1;
        }
      }
      if (!ids.length) {
        toast.error("Could not generate diagnostics.");
        return;
      }
      const { data } = await api.post("/teacher/assessments/from-exercises", {
        assignmentId: selectedClass.id,
        exerciseIds: ids,
      });
      toast.success(
        `${Number(data?.addedCount) || 0} generated.${failed ? ` ${failed} failed.` : ""}`,
      );
      await Promise.all([loadClasses(), loadClassData(selectedClass)]);
    } catch (error) {
      console.error("Failed to generate diagnostics", error);
      toast.error(error?.response?.data?.error || "Failed to generate diagnostics.");
    } finally {
      setGenerateBusy(false);
    }
  };

  const openScan = (student) => {
    setScanModalStudent(student);
    setScanAssessmentId("new");
    setScanAssessmentTitle(
      `${selectedClass?.courseName || "Subject"} Assessment`,
    );
    setScanType("Assessment");
    setScanFiles([]);
    setScanWeakArea("");
    setScanNotes("");
  };

  useEffect(() => {
    if (!scanModalStudent) return;
    if (scanStudentAssessments.length === 0) {
      setScanAssessmentId("new");
      setScanAssessmentTitle(
        `${selectedClass?.courseName || "Subject"} Assessment`,
      );
      setScanType("Assessment");
      return;
    }
    const latest = scanStudentAssessments[0];
    setScanAssessmentId(latest.id || "new");
    setScanAssessmentTitle(latest.title || `${selectedClass?.courseName || "Subject"} Assessment`);
    setScanType(latest.type || "Assessment");
  }, [scanModalStudent, scanStudentAssessments, selectedClass]);

  const submitScan = async () => {
    if (!scanModalStudent?.id || !selectedClass?.id) return;
    if (!scanFiles.length) {
      toast.error("Upload at least one answer file.");
      return;
    }
    setScanBusy(true);
    try {
      const fd = new FormData();
      fd.append("assignmentId", selectedClass.id);
      fd.append("studentId", scanModalStudent.id);
      if (scanAssessmentId && scanAssessmentId !== "new") {
        fd.append("assessmentId", scanAssessmentId);
      }
      fd.append("title", String(scanAssessmentTitle || "").trim());
      fd.append("type", String(scanType || "").trim());
      if (String(scanWeakArea).trim()) fd.append("weakArea", String(scanWeakArea).trim());
      if (String(scanNotes).trim()) fd.append("teacherNotes", String(scanNotes).trim());
      scanFiles.forEach((file) => fd.append("files", file));

      const { data } = await api.post("/teacher/assessments/submit-answers", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const weak = data?.assessment?.weakArea;
      const aiUsed = Boolean(data?.analysis?.aiUsed);
      const graded = Boolean(data?.analysis?.graded);
      const selectedFile = String(data?.analysis?.selectedFile || "").trim();
      if (aiUsed) {
        toast.success(
          weak
            ? `Answers analyzed${selectedFile ? ` (${selectedFile})` : ""}. Weak area: ${weak}`
            : "Answers analyzed successfully.",
        );
      } else {
        toast.info(
          weak
            ? `Answers uploaded. AI score not detected yet, estimated weak area: ${weak}.`
            : "Answers uploaded. AI score not detected yet.",
        );
      }
      if (!graded) {
        toast.info("This submission is saved as in-progress until scoring is confirmed.");
      }
      setScanModalStudent(null);
      await Promise.all([loadClasses(), loadClassData(selectedClass)]);
    } catch (error) {
      console.error("Failed to submit student answers", error);
      toast.error(error?.response?.data?.error || "Failed to analyze uploaded answers.");
    } finally {
      setScanBusy(false);
    }
  };

  if (loading) return <TeacherPageSkeleton variant="assessments" />;

  return (
    <div className="w-full h-full font-sans animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            {selectedClass ? (
              <button
                type="button"
                onClick={closeClass}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 hover:text-[#2D70FD]"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            ) : null}
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Assessments</h1>
          </div>
          {selectedClass ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={generateDiagnostic}
                disabled={generateBusy || classLoading}
                className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-4 hover:bg-[#1E5CE0] disabled:opacity-60 text-sm font-semibold"
                title="Generate diagnostic"
              >
                {generateBusy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                AI Generate
              </button>
              <button
                type="button"
                onClick={openClassUpload}
                disabled={classLoading}
                className="h-12 rounded-2xl bg-white border border-slate-200 text-[#2D70FD] inline-flex items-center justify-center gap-2 px-4 hover:bg-blue-50 disabled:opacity-60 text-sm font-semibold"
                title="Upload"
              >
                <Upload size={18} />
                Upload
              </button>
            </div>
          ) : null}
        </div>

        {!selectedClass ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<BookOpen size={20} />} label="Classes" value={overallStats.classes} />
              <StatCard icon={<Users size={20} />} label="Students" value={overallStats.students} />
              <StatCard icon={<FileText size={20} />} label="Assessments" value={overallStats.assessments} />
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                  <Filter size={18} />
                </div>
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubject(s)}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap ${
                      subject === s
                        ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                        : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="inline-flex items-center gap-1 self-end sm:self-auto rounded-2xl border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setClassesViewMode("grid")}
                    className={`h-9 w-9 rounded-xl inline-flex items-center justify-center transition-all ${
                      classesViewMode === "grid"
                        ? "bg-blue-50 text-[#2D70FD]"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                    aria-label="Grid class layout"
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassesViewMode("list")}
                    className={`h-9 w-9 rounded-xl inline-flex items-center justify-center transition-all ${
                      classesViewMode === "list"
                        ? "bg-blue-50 text-[#2D70FD]"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                    aria-label="List class layout"
                  >
                    <List size={18} />
                  </button>
                </div>
                <div className="relative w-full lg:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search class..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700 shadow-sm"
                  />
                </div>
              </div>
            </div>

            {classes.length === 0 || filteredClasses.length === 0 ? (
              <EmptyState />
            ) : classesViewMode === "grid" ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredClasses.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                        <BookOpen size={28} />
                      </div>
                      <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                        {item.level || "--"}
                      </div>
                    </div>
                    <h3 className="font-semibold text-slate-800 text-lg mb-1">
                      {item.courseName || "Subject"}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 mb-5">
                      {cls(item)}
                    </p>
                    <button
                      type="button"
                      onClick={() => openClass(item)}
                      className="w-full py-4 bg-[#2D70FD] text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1E5CE0]"
                    >
                      <ArrowUpRight size={18} />
                      View
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClasses.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm hover:border-blue-200 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="min-w-0 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD] shrink-0">
                          <BookOpen size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-slate-900 truncate">
                            {item.courseName || "Subject"}
                          </h3>
                          <p className="text-sm font-medium text-slate-500">
                            {cls(item)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                          {item.level || "--"}
                        </span>
                        <button
                          type="button"
                          onClick={() => openClass(item)}
                          className="px-4 py-2.5 bg-[#2D70FD] text-white rounded-xl font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#1E5CE0]"
                        >
                          <ArrowUpRight size={16} />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<Users size={20} />} label="Students" value={classStats.total} />
              <StatCard icon={<CheckCircle2 size={20} />} label="Completed" value={classStats.completed} />
              <StatCard icon={<FileText size={20} />} label="Avg Score" value={classStats.avg} />
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                  {["all", "done", "pending"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStudentFilter(f)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest ${
                        studentFilter === f
                          ? "bg-[#2D70FD] text-white"
                          : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search student..."
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <h3 className="text-xl font-black text-slate-900">Students</h3>
                <div className="inline-flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setStudentsViewMode("grid")}
                      className={`h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all ${
                        studentsViewMode === "grid"
                          ? "bg-blue-50 text-[#2D70FD]"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      aria-label="Grid student layout"
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentsViewMode("list")}
                      className={`h-8 w-8 rounded-lg inline-flex items-center justify-center transition-all ${
                        studentsViewMode === "list"
                          ? "bg-blue-50 text-[#2D70FD]"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                      aria-label="List student layout"
                    >
                      <List size={16} />
                    </button>
                  </div>
                  {classLoading ? (
                    <Loader2 size={20} className="animate-spin text-[#2D70FD]" />
                  ) : null}
                </div>
              </div>
              {classLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredRows.length === 0 ? (
                <EmptyState />
              ) : studentsViewMode === "grid" ? (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredRows.map((row) => (
                    <div
                      key={row.student.id}
                      className="rounded-3xl border border-slate-200 bg-white p-5 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900 truncate">
                            {row.student.name || "Student"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {row.student.studentNumber || "--"}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-widest ${
                            row.done
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {row.done ? "Done" : "Pending"}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                            Completed
                          </p>
                          <p className="mt-1 text-lg font-black text-slate-900">
                            {row.completedAssessments}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                            Pending
                          </p>
                          <p className="mt-1 text-lg font-black text-slate-900">
                            {row.pendingAssessments}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStudentModalId(row.student.id)}
                          className="flex-1 h-10 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:border-blue-200 hover:text-[#2D70FD]"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => openScan(row.student)}
                          className="h-10 px-4 rounded-xl bg-[#2D70FD] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#1E5CE0]"
                        >
                          <ImagePlus size={14} />
                          Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse">
                      <thead>
                        <tr className="bg-white">
                          <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200 w-14">
                            No
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200">
                            Student Number
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200">
                            Student Names
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200 min-w-[220px]">
                            <div className="space-y-1">
                              <p>Assessments Completed</p>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full border border-slate-300 text-[11px] font-semibold text-slate-700">
                                  Max: {maxAssessmentsByStudent}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                                  TRACKING
                                </span>
                              </div>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200 min-w-[220px]">
                            <div className="space-y-1">
                              <p>Pending Assessments</p>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full border border-slate-300 text-[11px] font-semibold text-slate-700">
                                  Max: {maxAssessmentsByStudent}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                                  TRACKING
                                </span>
                              </div>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, index) => (
                          <tr
                            key={row.student.id}
                            onClick={() => setStudentModalId(row.student.id)}
                            className="bg-white cursor-pointer hover:bg-slate-50"
                          >
                            <td className="px-3 py-3 text-sm font-semibold text-slate-800 border border-slate-200">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 border border-slate-200">
                              <div className="inline-flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-slate-200 text-[#1d4ed8] inline-flex items-center justify-center">
                                  <Users size={15} />
                                </span>
                                <span className="text-sm font-semibold text-slate-800">
                                  {row.student.studentNumber || "--"}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 border border-slate-200">
                              <p className="text-sm font-semibold text-slate-900">
                                {row.student.name || "Student"}
                              </p>
                            </td>
                            <td className="px-3 py-3 border border-slate-200">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  {row.completedAssessments}
                                  <span className="text-slate-400">/{row.totalAssessments || 0}</span>
                                </p>
                                <CheckCircle2 size={18} className="text-emerald-500" />
                              </div>
                            </td>
                            <td className="px-3 py-3 border border-slate-200">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  {row.pendingAssessments}
                                  <span className="text-slate-400">/{row.totalAssessments || 0}</span>
                                </p>
                                <CheckCircle2 size={18} className="text-emerald-500" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {classUploadOpen ? (
        <Modal onClose={() => !classUploadBusy && setClassUploadOpen(false)}>
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">Upload Exercises To Class</h3>
            <button
              type="button"
              onClick={() => !classUploadBusy && setClassUploadOpen(false)}
              className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 inline-flex items-center justify-center hover:bg-slate-200 disabled:opacity-60"
              disabled={classUploadBusy}
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-6 md:p-8 space-y-4">
            <input
              type="text"
              value={classUploadTitle}
              onChange={(e) => setClassUploadTitle(e.target.value)}
              placeholder="Exercise title"
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
            />

            <div className="grid grid-cols-2 gap-3">
              <DropdownField
                value={classUploadDifficulty}
                onChange={setClassUploadDifficulty}
                options={classDifficultyOptions}
              >
              </DropdownField>
              <input
                type="number"
                min="3"
                max="20"
                value={classUploadQuestionCount}
                onChange={(e) => setClassUploadQuestionCount(e.target.value)}
                placeholder="Questions"
                className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
              />
            </div>

            <textarea
              rows={6}
              value={classUploadSourceText}
              onChange={(e) => setClassUploadSourceText(e.target.value)}
              placeholder="Paste questions here (optional if you upload a file)."
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700 resize-none"
            />

            <label className="block rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 cursor-pointer hover:border-blue-200 hover:bg-blue-50/40">
              <input
                type="file"
                accept="image/*,.pdf,.txt,.md,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => setClassUploadFile(e.target.files?.[0] || null)}
              />
              <Upload size={20} className="mx-auto text-[#2D70FD]" />
              <p className="mt-2 text-sm font-semibold text-slate-700">Upload source document</p>
              <p className="text-xs font-medium text-slate-400">Image, PDF, TXT, or Markdown</p>
            </label>
            {classUploadFile ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-3">
                <p className="text-xs font-medium text-slate-600 truncate">
                  {classUploadFile.name}
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              <AlertCircle size={14} />
              Uploaded exercises are published immediately to all students in this class.
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setClassUploadOpen(false)}
                disabled={classUploadBusy}
                className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitClassUpload}
                disabled={classUploadBusy}
                className="px-5 py-3 rounded-xl bg-[#2D70FD] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1E5CE0] disabled:opacity-60"
              >
                {classUploadBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                Upload
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {selectedStudent ? (
        <Modal onClose={() => setStudentModalId("")}>
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">{selectedStudent.name || "Student"}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setStudentModalId("");
                  openScan(selectedStudent);
                }}
                className="h-10 w-10 rounded-xl bg-[#2D70FD] text-white inline-flex items-center justify-center hover:bg-[#1E5CE0]"
                title="Upload student answers"
              >
                <ImagePlus size={16} />
              </button>
              <button
                type="button"
                onClick={() => setStudentModalId("")}
                className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 inline-flex items-center justify-center hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-2 max-h-[65vh] overflow-y-auto">
            {selectedStudentAssessments.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-medium text-slate-500 text-center">
                No assessments yet.
              </div>
            ) : (
              selectedStudentAssessments.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.title || "Assessment"}</p>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {a.status || "Pending"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {a.grade || "--"} <span className="text-slate-400">•</span> {a.weakArea || "--"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Modal>
      ) : null}

      {scanModalStudent ? (
        <Modal onClose={() => !scanBusy && setScanModalStudent(null)}>
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between gap-3">
            <h3 className="text-xl font-black text-slate-900">{scanModalStudent.name || "Student"}</h3>
            <button
              type="button"
              onClick={() => !scanBusy && setScanModalStudent(null)}
              className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 inline-flex items-center justify-center hover:bg-slate-200 disabled:opacity-60"
              disabled={scanBusy}
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-6 md:p-8 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Student</label>
              <DropdownField
                value={scanModalStudent?.id || ""}
                onChange={(nextStudentId) => {
                  const next = scopedStudents.find((student) => student.id === nextStudentId);
                  if (next) setScanModalStudent(next);
                }}
                options={scanStudentOptions}
              >
              </DropdownField>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Assessment</label>
              <DropdownField
                value={scanAssessmentId}
                onChange={(value) => {
                  setScanAssessmentId(value);
                  if (value === "new") {
                    setScanAssessmentTitle(
                      `${selectedClass?.courseName || "Subject"} Assessment`,
                    );
                    setScanType("Assessment");
                    return;
                  }
                  const found = scanStudentAssessments.find((item) => item.id === value);
                  if (found) {
                    setScanAssessmentTitle(found.title || "");
                    setScanType(found.type || "Assessment");
                  }
                }}
                options={scanAssessmentOptions}
              >
              </DropdownField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={scanAssessmentTitle}
                onChange={(e) => setScanAssessmentTitle(e.target.value)}
                placeholder="Assessment title"
                className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
              />
              <DropdownField
                value={scanType}
                onChange={setScanType}
                options={scanTypeOptions}
              >
              </DropdownField>
            </div>
            <input
              type="text"
              value={scanWeakArea}
              onChange={(e) => setScanWeakArea(e.target.value)}
              placeholder="Weak area (optional)"
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
            />
            <textarea
              rows={3}
              value={scanNotes}
              onChange={(e) => setScanNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700 resize-none"
            />
            <label className="block rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50 cursor-pointer hover:border-blue-200 hover:bg-blue-50/40">
              <input
                type="file"
                accept="image/*,.pdf,.txt,.md,text/plain,text/markdown,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => setScanFiles(Array.from(e.target.files || []))}
              />
              <ImagePlus size={20} className="mx-auto text-[#2D70FD]" />
              <p className="mt-2 text-sm font-semibold text-slate-700">Upload Student Answers</p>
              <p className="text-xs font-medium text-slate-400">Images, PDF, TXT, Markdown</p>
            </label>
            {scanFiles.length > 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-3">
                {scanFiles.map((f) => (
                  <p key={`${f.name}-${f.lastModified}`} className="text-xs font-medium text-slate-600 truncate">
                    {f.name}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setScanModalStudent(null)}
                disabled={scanBusy}
                className="px-5 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitScan}
                disabled={scanBusy}
                className="px-5 py-3 rounded-xl bg-[#2D70FD] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#1E5CE0] disabled:opacity-60"
              >
                {scanBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
};

const DropdownField = ({
  value,
  onChange,
  options = [],
  className = "",
  placeholder = "Select option",
}) => {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selected = options.find(
    (option) => String(option.value) === String(value),
  );

  return (
    <div ref={fieldRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full px-4 py-3 bg-white border-2 rounded-2xl text-left transition-all ${
          open
            ? "border-[#2D70FD] ring-2 ring-blue-100"
            : "border-slate-100 hover:border-blue-100"
        }`}
      >
        <span className="block truncate text-sm font-semibold text-slate-700">
          {selected?.label || placeholder}
        </span>
        {selected?.meta ? (
          <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
            {selected.meta}
          </span>
        ) : null}
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${
            open ? "rotate-180 text-[#2D70FD]" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs font-medium text-slate-400">
              No options available
            </p>
          ) : (
            options.map((option) => {
              const isActive = String(option.value) === String(value);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setOpen(false);
                  }}
                  className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors last:mb-0 ${
                    isActive
                      ? "bg-blue-50 text-[#2D70FD]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold">
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span
                      className={`mt-0.5 block truncate text-[11px] font-medium ${
                        isActive ? "text-blue-500/80" : "text-slate-400"
                      }`}
                    >
                      {option.meta}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm">
    <div className="w-14 h-14 rounded-2xl inline-flex items-center justify-center bg-blue-50 text-[#2D70FD]">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
    </div>
  </div>
);

const MiniPill = ({ icon, value }) => (
  <div className="h-9 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center justify-center gap-1.5">
    <span className="text-slate-400">{icon}</span>
    <span>{value}</span>
  </div>
);

const Modal = ({ children, onClose }) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-3xl rounded-[2rem] border border-slate-100 bg-white shadow-2xl max-h-[90vh] overflow-hidden animate-in zoom-in duration-300">
      {children}
    </div>
  </div>
);

export default TeacherAssessments;
