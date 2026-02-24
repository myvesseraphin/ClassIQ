import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherClassPicker from "../../Component/TeacherClassPicker";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const norm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const sourceFilters = [
  { key: "all", label: "All Sources" },
  { key: "class", label: "Class Assigned" },
  { key: "individual", label: "Individual" },
];

const statusFilters = [
  { key: "all", label: "All Status" },
  { key: "submitted", label: "Submitted" },
  { key: "in_progress", label: "In Progress" },
  { key: "pending", label: "Pending" },
];

const difficultyOptions = ["Beginner", "Intermediate", "Advanced"];

const getSourceKey = (exercise) =>
  norm(exercise?.assignmentOrigin) === "teacher_class_upload" ? "class" : "individual";

const getSourceLabel = (exercise) => {
  const origin = norm(exercise?.assignmentOrigin);
  if (origin === "teacher_class_upload") return "Class Assignment";
  if (origin === "teacher_generated") return "Teacher Individual";
  return "Student Practice";
};

const getStatusKey = (exercise) => {
  const status = norm(exercise?.submissionStatus);
  if (status === "submitted") return "submitted";
  if (status === "in_progress") return "in_progress";
  return "pending";
};

const getStatusLabel = (exercise) => {
  const key = getStatusKey(exercise);
  if (key === "submitted") return "Submitted";
  if (key === "in_progress") return "In Progress";
  return "Pending";
};

const getStatusClassName = (exercise) => {
  const key = getStatusKey(exercise);
  if (key === "submitted") return "bg-emerald-50 text-emerald-600";
  if (key === "in_progress") return "bg-amber-50 text-amber-600";
  return "bg-slate-100 text-slate-500";
};

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getCompletionDescription = (exercise) => {
  const status = getStatusKey(exercise);
  if (status === "submitted") return `Done on ${formatDateTime(exercise?.submittedAt)}`;
  if (status === "in_progress") return `Started on ${formatDateTime(exercise?.submittedAt)}`;
  return `Assigned on ${exercise?.date || "--"}`;
};

const resolveQuestionCount = (value, fallback = 8) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 3), 20);
};

const TeacherExercises = () => {
  const [selectedClass, setSelectedClass] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [exercises, setExercises] = useState([]);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  const [isDownloading, setIsDownloading] = useState(false);
  const [previewExercise, setPreviewExercise] = useState(null);

  const [reviewExercise, setReviewExercise] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignTargetType, setAssignTargetType] = useState("class");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignDifficulty, setAssignDifficulty] = useState("Intermediate");
  const [assignQuestionCount, setAssignQuestionCount] = useState("8");
  const [assignWeakArea, setAssignWeakArea] = useState("");

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadingAssignment, setIsUploadingAssignment] = useState(false);
  const [uploadTargetType, setUploadTargetType] = useState("class");
  const [uploadStudentId, setUploadStudentId] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDifficulty, setUploadDifficulty] = useState("Intermediate");
  const [uploadQuestionCount, setUploadQuestionCount] = useState("8");
  const [uploadSourceText, setUploadSourceText] = useState("");
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [exerciseRes, studentRes] = await Promise.all([
          api.get("/teacher/exercises?includeQuestions=true"),
          api.get("/teacher/students"),
        ]);
        if (!active) return;
        setExercises(Array.isArray(exerciseRes?.data?.exercises) ? exerciseRes.data.exercises : []);
        setStudents(Array.isArray(studentRes?.data?.students) ? studentRes.data.students : []);
      } catch (error) {
        console.error("Failed to load exercises", error);
        toast.error("Failed to load exercises.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const reloadExercises = async () => {
    const { data } = await api.get("/teacher/exercises?includeQuestions=true");
    setExercises(Array.isArray(data?.exercises) ? data.exercises : []);
  };

  const classExercises = useMemo(() => {
    if (!selectedClass) return [];
    const className = norm(selectedClass.classGroup);
    const gradeLevel = norm(selectedClass.level);
    const subjectName = norm(selectedClass.courseName);
    return exercises.filter((exercise) => {
      if (className && norm(exercise?.student?.className) !== className) return false;
      if (gradeLevel && norm(exercise?.student?.gradeLevel) !== gradeLevel) return false;
      if (subjectName && norm(exercise?.subject) !== subjectName) return false;
      return true;
    });
  }, [exercises, selectedClass]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    const className = norm(selectedClass.classGroup);
    const gradeLevel = norm(selectedClass.level);
    const map = new Map();

    students.forEach((student) => {
      if (className && norm(student.className) !== className) return;
      if (gradeLevel && norm(student.gradeLevel) !== gradeLevel) return;
      map.set(student.id, {
        ...student,
        name: student.name || student.email || "Student",
      });
    });

    classExercises.forEach((exercise) => {
      const student = exercise?.student;
      if (!student?.id || map.has(student.id)) return;
      map.set(student.id, {
        id: student.id,
        name: student.name || student.email || "Student",
        email: student.email || "",
        studentNumber: student.studentNumber || null,
        className: student.className || null,
        gradeLevel: student.gradeLevel || null,
        studentNo: null,
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      }),
    );
  }, [students, classExercises, selectedClass]);

  const subjects = useMemo(
    () => [
      "All",
      ...Array.from(new Set(classExercises.map((exercise) => exercise.subject).filter(Boolean))),
    ],
    [classExercises],
  );

  useEffect(() => {
    if (!subjects.includes(selectedSubject)) {
      setSelectedSubject("All");
    }
  }, [subjects, selectedSubject]);

  const filteredExercises = useMemo(() => {
    const query = norm(searchQuery);
    return classExercises.filter((exercise) => {
      if (selectedSubject !== "All" && exercise.subject !== selectedSubject) return false;
      if (selectedSource !== "all" && getSourceKey(exercise) !== selectedSource) return false;
      if (selectedStatus !== "all" && getStatusKey(exercise) !== selectedStatus) return false;
      if (!query) return true;
      const searchLabel = `${exercise.name || ""} ${exercise.subject || ""} ${
        exercise.student?.name || ""
      } ${exercise.student?.studentNumber || ""}`.toLowerCase();
      return searchLabel.includes(query);
    });
  }, [classExercises, searchQuery, selectedSource, selectedStatus, selectedSubject]);

  const studentsListRows = useMemo(() => {
    const byStudent = new Map();
    classExercises.forEach((exercise) => {
      const studentId = exercise?.student?.id;
      if (!studentId) return;
      if (!byStudent.has(studentId)) byStudent.set(studentId, []);
      byStudent.get(studentId).push(exercise);
    });

    const query = norm(searchQuery);
    const hasFilter =
      query || selectedSubject !== "All" || selectedSource !== "all" || selectedStatus !== "all";

    return classStudents
      .map((student) => {
        const list = byStudent.get(student.id) || [];
        const visible = list.filter((exercise) => filteredExercises.some((item) => item.id === exercise.id));
        const completed = list.filter((exercise) => getStatusKey(exercise) === "submitted").length;
        const latestDone = list
          .filter((exercise) => getStatusKey(exercise) === "submitted")
          .sort((a, b) => (new Date(b.submittedAt || 0).getTime() || 0) - (new Date(a.submittedAt || 0).getTime() || 0))[0];

        const studentLabel = `${student.name || ""} ${student.email || ""} ${student.studentNumber || ""}`
          .toLowerCase();
        const queryMatch = query ? studentLabel.includes(query) : true;
        const shouldShow = query ? queryMatch || visible.length > 0 : hasFilter ? visible.length > 0 : true;

        return {
          student,
          shouldShow,
          exercises: visible,
          total: list.length,
          completed,
          pending: Math.max(list.length - completed, 0),
          latestDoneAt: latestDone?.submittedAt || null,
        };
      })
      .filter((row) => row.shouldShow);
  }, [classExercises, classStudents, filteredExercises, searchQuery, selectedSource, selectedStatus, selectedSubject]);

  const classStats = useMemo(() => {
    const completed = classExercises.filter((exercise) => getStatusKey(exercise) === "submitted").length;
    return {
      students: classStudents.length,
      exercises: classExercises.length,
      completed,
      pending: Math.max(classExercises.length - completed, 0),
    };
  }, [classExercises, classStudents]);

  const openAssignModal = (studentId = "") => {
    setAssignTargetType(studentId ? "student" : "class");
    setAssignStudentId(studentId);
    setAssignWeakArea("");
    setAssignQuestionCount("8");
    setAssignDifficulty("Intermediate");
    setIsAssignModalOpen(true);
  };

  const openUploadModal = (studentId = "") => {
    setUploadTargetType(studentId ? "student" : "class");
    setUploadStudentId(studentId);
    setUploadTitle("");
    setUploadDifficulty("Intermediate");
    setUploadQuestionCount("8");
    setUploadSourceText("");
    setUploadFile(null);
    setIsUploadModalOpen(true);
  };

  const handleGenerateAssignments = async () => {
    if (!selectedClass?.id) {
      toast.error("Select a class first.");
      return;
    }

    const targets =
      assignTargetType === "student"
        ? classStudents.filter((student) => student.id === assignStudentId)
        : classStudents;

    if (!targets.length) {
      toast.error(assignTargetType === "student" ? "Choose a student." : "No students found.");
      return;
    }

    setIsAssigning(true);
    const created = [];
    let failed = 0;

    for (const student of targets) {
      try {
        const { data } = await api.post("/teacher/exercises/generate", {
          assignmentId: selectedClass.id,
          studentId: student.id,
          difficulty: assignDifficulty,
          questionCount: resolveQuestionCount(assignQuestionCount),
          weakArea: String(assignWeakArea || "").trim() || undefined,
        });
        if (data?.exercise) created.push(data.exercise);
      } catch (error) {
        failed += 1;
      }
    }

    if (created.length > 0) {
      setExercises((prev) => [...created, ...prev]);
      toast.success(
        failed === 0
          ? `Generated ${created.length} exercise${created.length === 1 ? "" : "s"}.`
          : `Generated ${created.length}/${targets.length} exercises.`,
      );
      setIsAssignModalOpen(false);
    } else {
      toast.error("Failed to generate exercises.");
    }

    setIsAssigning(false);
  };

  const handleUploadAssignments = async () => {
    if (!selectedClass?.id) {
      toast.error("Select a class first.");
      return;
    }

    if (!uploadFile && !String(uploadSourceText || "").trim()) {
      toast.error("Add source text or upload a file.");
      return;
    }

    if (uploadTargetType === "student" && !uploadStudentId) {
      toast.error("Choose a student target.");
      return;
    }

    setIsUploadingAssignment(true);
    try {
      const formData = new FormData();
      formData.append("assignmentId", selectedClass.id);
      if (uploadTargetType === "student") {
        formData.append("studentId", uploadStudentId);
      }
      formData.append("title", String(uploadTitle || "").trim());
      formData.append("difficulty", uploadDifficulty);
      formData.append("questionCount", String(resolveQuestionCount(uploadQuestionCount)));
      formData.append("sourceText", String(uploadSourceText || "").trim());
      if (uploadFile) formData.append("file", uploadFile);

      await api.post("/teacher/exercises/upload-class", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await reloadExercises();
      toast.success("Exercise uploaded and assigned.");
      setIsUploadModalOpen(false);
    } catch (error) {
      console.error("Failed to upload exercise", error);
      toast.error(error?.response?.data?.error || "Failed to upload exercise.");
    } finally {
      setIsUploadingAssignment(false);
    }
  };

  const handleDownloadExercise = async (exercise) => {
    if (!exercise?.id) return;

    setIsDownloading(true);
    try {
      const { data } = await api.get(`/teacher/exercises/${exercise.id}/download`, {
        responseType: "blob",
      });
      const blob = new Blob([data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${exercise.name || "exercise"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download exercise", error);
      toast.error("Failed to download exercise.");
    } finally {
      setIsDownloading(false);
    }
  };

  const openReviewModal = async (exercise) => {
    if (!exercise?.id || !exercise.submissionId) {
      toast.error("No submitted answers yet for this exercise.");
      return;
    }

    setReviewExercise(exercise);
    setReviewData(null);
    setReviewError("");
    setIsReviewLoading(true);
    try {
      const { data } = await api.get(`/teacher/exercises/${exercise.id}/review`);
      setReviewData(data || null);
    } catch (error) {
      console.error("Failed to load review", error);
      setReviewError(error?.response?.data?.error || "Failed to load review.");
    } finally {
      setIsReviewLoading(false);
    }
  };

  if (!selectedClass) {
    return (
      <TeacherClassPicker
        title="Exercises"
        actionLabel="Manage Exercises"
        onSelect={setSelectedClass}
      />
    );
  }

  if (isLoading) return <TeacherPageSkeleton variant="exercises" />;

  return (
    <div className="space-y-10 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedClass(null);
              setSearchQuery("");
              setSelectedSubject("All");
              setSelectedSource("all");
              setSelectedStatus("all");
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors"
          >
            <ChevronLeft size={16} />
            Change Class
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Exercises</h1>
            <p className="text-sm font-semibold text-slate-500">
              {selectedClass.courseName || "Subject"} | {selectedClass.classGroup || "--"} {selectedClass.level || "--"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openAssignModal()}
            disabled={classStudents.length === 0 || isAssigning}
            className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-5 hover:bg-[#1E5CE0] disabled:opacity-60 text-sm font-black"
          >
            {isAssigning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            AI Assign
          </button>
          <button
            type="button"
            onClick={() => openUploadModal()}
            disabled={classStudents.length === 0 || isUploadingAssignment}
            className="h-12 rounded-2xl bg-white border border-slate-200 text-[#2D70FD] inline-flex items-center justify-center gap-2 px-5 hover:bg-blue-50 disabled:opacity-60 text-sm font-black"
          >
            {isUploadingAssignment ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload
          </button>
          <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-xl transition-all ${viewMode === "grid" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400"}`}
              aria-label="Grid view"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-xl transition-all ${viewMode === "list" ? "bg-blue-50 text-[#2D70FD]" : "text-slate-400"}`}
              aria-label="List view"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users size={16} />} label="Students" value={classStats.students} />
        <StatCard icon={<FileText size={16} />} label="Exercises" value={classStats.exercises} />
        <StatCard icon={<CheckIcon />} label="Completed" value={classStats.completed} />
        <StatCard icon={<Filter size={16} />} label="Pending" value={classStats.pending} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="w-full space-y-3">
          <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 shrink-0">
                <Filter size={18} />
              </div>
              {sourceFilters.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSelectedSource(item.key)}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${
                    selectedSource === item.key
                      ? "bg-[#2D70FD] text-white"
                      : "bg-white border border-slate-200 text-slate-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {statusFilters.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSelectedStatus(item.key)}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${
                    selectedStatus === item.key
                      ? "bg-[#2D70FD] text-white"
                      : "bg-white border border-slate-200 text-slate-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
            {subjects.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap ${
                  selectedSubject === subject
                    ? "bg-[#2D70FD] text-white"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by exercise or student..."
            className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] font-medium text-slate-700 shadow-sm"
          />
        </div>
      </div>

      {viewMode === "grid" ? (
        filteredExercises.length > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredExercises.map((exercise) => (
              <div key={exercise.id} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                    <FileText size={28} />
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusClassName(exercise)}`}>
                    {getStatusLabel(exercise)}
                  </span>
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-1">{exercise.name || "Exercise"}</h3>
                <p className="text-sm font-bold text-slate-500">{exercise.student?.name || "Student"} | ID {exercise.student?.studentNumber || "--"}</p>
                <p className="text-xs font-bold text-slate-400 mt-1">{exercise.subject || "--"} | {exercise.questionCount || 0} Questions</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{getCompletionDescription(exercise)}</p>

                <div className="mt-auto pt-6 grid grid-cols-3 gap-3">
                  <button onClick={() => setPreviewExercise(exercise)} className="py-3 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs inline-flex items-center justify-center gap-2">
                    <Eye size={14} /> View
                  </button>
                  <button onClick={() => openReviewModal(exercise)} disabled={!exercise.submissionId} className="py-3 border border-slate-200 text-slate-600 rounded-xl font-black text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    <MessageSquare size={14} /> Answers
                  </button>
                  <button onClick={() => handleDownloadExercise(exercise)} disabled={isDownloading} className="py-3 bg-[#2D70FD] text-white rounded-xl font-black text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50">
                    <Download size={14} /> PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState />
        )
      ) : studentsListRows.length > 0 ? (
        <div className="space-y-5">
          {studentsListRows.map((row) => (
            <div
              key={row.student.id}
              className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {row.student.name || "Student"}
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    ID {row.student.studentNumber || "--"} | Student No{" "}
                    {row.student.studentNo || "--"}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    {row.latestDoneAt
                      ? `Latest completion: ${formatDateTime(row.latestDoneAt)}`
                      : "No completed exercise yet"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                    Exercises {row.total}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                    Done {row.completed}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600">
                    Pending {row.pending}
                  </span>
                  <button
                    onClick={() => openAssignModal(row.student.id)}
                    className="h-9 px-3 rounded-lg bg-[#2D70FD] text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                  >
                    <Sparkles size={12} /> AI Assign
                  </button>
                  <button
                    onClick={() => openUploadModal(row.student.id)}
                    className="h-9 px-3 rounded-lg border border-slate-200 text-[#2D70FD] text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1.5"
                  >
                    <Upload size={12} /> Upload
                  </button>
                </div>
              </div>

              {row.exercises.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {row.exercises.slice(0, 4).map((exercise) => (
                    <div
                      key={exercise.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {exercise.name || "Exercise"}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {exercise.subject || "--"} | {exercise.questionCount || 0} Questions
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {getCompletionDescription(exercise)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewExercise(exercise)}
                          className="px-3 py-2 bg-blue-50 text-[#2D70FD] rounded-lg font-black text-xs"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openReviewModal(exercise)}
                          disabled={!exercise.submissionId}
                          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg font-black text-xs disabled:opacity-50"
                        >
                          Answers
                        </button>
                        <button
                          onClick={() => handleDownloadExercise(exercise)}
                          disabled={isDownloading}
                          className="p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                  No exercises for this student with current filters.
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {previewExercise ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {previewExercise.name || "Exercise Preview"}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {previewExercise.subject || "--"} |{" "}
                  {previewExercise.student?.name || "Student"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExercise(null)}
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:bg-slate-50"
                aria-label="Close preview"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 max-h-[72vh] overflow-y-auto space-y-4">
              {(previewExercise.questions || []).length > 0 ? (
                (previewExercise.questions || []).map((question, index) => (
                  <div
                    key={question?.id || index}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <p className="text-sm font-black text-slate-800">
                      {index + 1}.{" "}
                      {question?.question ||
                        question?.prompt ||
                        question?.text ||
                        "Untitled question"}
                    </p>
                    {Array.isArray(question?.options) && question.options.length > 0 ? (
                      <ul className="mt-3 space-y-1.5">
                        {question.options.map((option, optionIndex) => (
                          <li
                            key={`${question?.id || index}-option-${optionIndex}`}
                            className="text-xs font-semibold text-slate-600"
                          >
                            {String.fromCharCode(65 + optionIndex)}. {option}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
                  No question preview available for this exercise.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {reviewExercise ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Student Answers
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {reviewExercise.name || "Exercise"} |{" "}
                  {reviewExercise.student?.name || "Student"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReviewExercise(null);
                  setReviewData(null);
                  setReviewError("");
                }}
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:bg-slate-50"
                aria-label="Close answers"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 max-h-[72vh] overflow-y-auto space-y-4">
              {isReviewLoading ? (
                <div className="h-24 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                  <Loader2 size={16} className="animate-spin" />
                  Loading submitted answers...
                </div>
              ) : reviewError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600 inline-flex items-center gap-2">
                  <AlertCircle size={16} />
                  {reviewError}
                </div>
              ) : (reviewData?.questions || []).length > 0 ? (
                (reviewData.questions || []).map((item, index) => {
                  const correct = Boolean(item?.isCorrect);
                  return (
                    <div
                      key={item?.id || index}
                      className={`rounded-2xl border p-4 ${
                        correct
                          ? "border-emerald-100 bg-emerald-50/70"
                          : "border-amber-100 bg-amber-50/70"
                      }`}
                    >
                      <p className="text-sm font-black text-slate-800">
                        {index + 1}.{" "}
                        {item?.question || item?.prompt || "Question"}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-slate-600">
                        Student: {item?.answer || item?.studentAnswer || "--"}
                      </p>
                      <p className="text-xs font-semibold text-slate-600">
                        Expected: {item?.expectedAnswer || item?.correctAnswer || "--"}
                      </p>
                      <p
                        className={`mt-2 text-[11px] font-black uppercase tracking-widest ${
                          correct ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {correct ? "Correct" : "Needs Review"}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
                  No answer details were returned for this submission.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isAssignModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Generate AI Exercises</h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:bg-slate-50"
                aria-label="Close generate modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Target
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignTargetType("class");
                      setAssignStudentId("");
                    }}
                    className={`h-11 rounded-xl border text-sm font-black ${
                      assignTargetType === "class"
                        ? "border-[#2D70FD] text-[#2D70FD] bg-blue-50"
                        : "border-slate-200 text-slate-500 bg-white"
                    }`}
                  >
                    Whole Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignTargetType("student")}
                    className={`h-11 rounded-xl border text-sm font-black ${
                      assignTargetType === "student"
                        ? "border-[#2D70FD] text-[#2D70FD] bg-blue-50"
                        : "border-slate-200 text-slate-500 bg-white"
                    }`}
                  >
                    One Student
                  </button>
                </div>
              </div>

              {assignTargetType === "student" ? (
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Student
                  </label>
                  <select
                    value={assignStudentId}
                    onChange={(event) => setAssignStudentId(event.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  >
                    <option value="">Select student</option>
                    {classStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name || student.email || "Student"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Difficulty
                  </label>
                  <select
                    value={assignDifficulty}
                    onChange={(event) => setAssignDifficulty(event.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  >
                    {difficultyOptions.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Questions
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    value={assignQuestionCount}
                    onChange={(event) => setAssignQuestionCount(event.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                  Weak Area (optional)
                </label>
                <textarea
                  value={assignWeakArea}
                  onChange={(event) => setAssignWeakArea(event.target.value)}
                  rows={3}
                  placeholder="e.g. Fractions, grammar, word problems..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAssignments}
                disabled={isAssigning || (assignTargetType === "student" && !assignStudentId)}
                className="h-10 px-4 rounded-xl bg-[#2D70FD] text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isAssigning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUploadModalOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Upload Exercise Source</h3>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:bg-slate-50"
                aria-label="Close upload modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  Target
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadTargetType("class");
                      setUploadStudentId("");
                    }}
                    className={`h-11 rounded-xl border text-sm font-black ${
                      uploadTargetType === "class"
                        ? "border-[#2D70FD] text-[#2D70FD] bg-blue-50"
                        : "border-slate-200 text-slate-500 bg-white"
                    }`}
                  >
                    Whole Class
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTargetType("student")}
                    className={`h-11 rounded-xl border text-sm font-black ${
                      uploadTargetType === "student"
                        ? "border-[#2D70FD] text-[#2D70FD] bg-blue-50"
                        : "border-slate-200 text-slate-500 bg-white"
                    }`}
                  >
                    One Student
                  </button>
                </div>
              </div>

              {uploadTargetType === "student" ? (
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Student
                  </label>
                  <select
                    value={uploadStudentId}
                    onChange={(event) => setUploadStudentId(event.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  >
                    <option value="">Select student</option>
                    {classStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name || student.email || "Student"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Title
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    placeholder="Optional title"
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Difficulty
                  </label>
                  <select
                    value={uploadDifficulty}
                    onChange={(event) => setUploadDifficulty(event.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                  >
                    {difficultyOptions.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                  Question Count
                </label>
                <input
                  type="number"
                  min="3"
                  max="20"
                  value={uploadQuestionCount}
                  onChange={(event) => setUploadQuestionCount(event.target.value)}
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                  Source Text
                </label>
                <textarea
                  value={uploadSourceText}
                  onChange={(event) => setUploadSourceText(event.target.value)}
                  rows={4}
                  placeholder="Paste source content here (optional if file uploaded)"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                  Upload File
                </label>
                <input
                  type="file"
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                  className="w-full h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                />
                {uploadFile ? (
                  <p className="text-[11px] font-semibold text-slate-500 mt-2">
                    Selected: {uploadFile.name}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAssignments}
                disabled={isUploadingAssignment}
                className="h-10 px-4 rounded-xl bg-[#2D70FD] text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-60"
              >
                {isUploadingAssignment ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
      {icon}
    </div>
    <p className="mt-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
      {label}
    </p>
    <p className="text-2xl font-black text-slate-900">{value}</p>
  </div>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M20 7L9 18L4 13"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default TeacherExercises;
