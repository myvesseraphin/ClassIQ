import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Download,
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
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const norm = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const cls = (item) =>
  `${item?.level || ""} ${item?.classGroup || ""}`.trim() || "Class";

const difficultyOptions = ["Beginner", "Intermediate", "Advanced"];
const questionCountOptions = [3, 5, 8, 10, 12, 15, 20].map((count) => ({
  value: String(count),
  label: `${count} questions`,
}));
const difficultyDropdownOptions = difficultyOptions.map((difficulty) => ({
  value: difficulty,
  label: difficulty,
}));

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

const compactText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeChoiceValue = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-H]/g, "")
    .slice(0, 1);

const resolveChoiceKey = (value, options = []) => {
  const directKey = normalizeChoiceValue(value);
  if (directKey) return directKey;

  const normalizedAnswer = compactText(value).toLowerCase();
  if (!normalizedAnswer) return "";

  const matched = options.find((option) => {
    const normalizedLabel = compactText(option?.label || option).toLowerCase();
    if (!normalizedLabel) return false;
    return (
      normalizedLabel === normalizedAnswer ||
      normalizedAnswer.includes(normalizedLabel) ||
      normalizedLabel.includes(normalizedAnswer)
    );
  });

  return matched?.key || "";
};

const requiresTeacherReview = (item) => {
  const status = norm(item?.reviewStatus || item?.status);
  return (
    Boolean(item?.needsTeacherReview) ||
    Boolean(item?.manualReviewRequired) ||
    status.includes("teacher") ||
    status.includes("manual")
  );
};

const isOpenEndedType = (value) => {
  const type = String(value || "").toLowerCase();
  return (
    type.includes("short") ||
    type.includes("open") ||
    type.includes("essay") ||
    type.includes("long")
  );
};

const parseMultipleChoiceContent = (text) => {
  const normalized = String(text || "").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return { prompt: "", options: [] };
  }

  const markerRegex = /(^|[\n\s])([A-H])[)\].:-]\s*/g;
  const markers = [];
  let match;
  while ((match = markerRegex.exec(normalized)) !== null) {
    const leading = match[1] || "";
    markers.push({
      key: String(match[2] || "").toUpperCase(),
      markerStart: match.index + leading.length,
      valueStart: match.index + match[0].length,
    });
  }

  if (markers.length < 2 || markers[0].key !== "A") {
    return { prompt: normalized.trim(), options: [] };
  }

  const options = markers
    .map((marker, index) => {
      const next = markers[index + 1];
      const raw = normalized.slice(
        marker.valueStart,
        next ? next.markerStart : normalized.length,
      );
      const label = compactText(raw);
      if (!label) return null;
      return { key: marker.key, label };
    })
    .filter(Boolean);

  if (options.length < 2) {
    return { prompt: normalized.trim(), options: [] };
  }

  return {
    prompt: normalized.slice(0, markers[0].markerStart).trim(),
    options,
  };
};

const extractQuestionDetails = (question) => {
  const fallbackAnswer = compactText(
    question?.answer || question?.correctAnswer || question?.expectedAnswer || "",
  );
  const inlineOptions = Array.isArray(question?.options)
    ? question.options
        .map((option, index) => {
          const label = compactText(
            String(option || "")
              .replace(/^([A-H]|\d+)[)\].:-]\s+/, "")
              .replace(/^[-*]\s+/, ""),
          );
          if (!label) return null;
          return { key: String.fromCharCode(65 + index), label };
        })
        .filter(Boolean)
    : [];
  const source = String(
    question?.question || question?.prompt || question?.text || "",
  ).trim();

  if (!source) {
    return {
      prompt: "Untitled question",
      options: inlineOptions,
      answer: fallbackAnswer,
    };
  }

  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const body = [];
  const options = [];
  let answer = fallbackAnswer;

  lines.forEach((line, index) => {
    const answerMatch = line.match(/^(?:answer|correct\s*answer)\s*[:-]\s*(.+)$/i);
    if (answerMatch) {
      if (!answer) answer = compactText(answerMatch[1]);
      return;
    }

    const markerOption = line.match(/^([A-H]|\d+)[)\].:-]\s+(.+)$/);
    if (index > 0 && markerOption) {
      const keyMatch = String(markerOption[1] || "").toUpperCase();
      const key = /^[A-H]$/.test(keyMatch)
        ? keyMatch
        : String.fromCharCode(65 + options.length);
      options.push({
        key,
        label: compactText(markerOption[2]),
      });
      return;
    }

    if (index > 0 && /^[-*]\s+/.test(line)) {
      options.push({
        key: String.fromCharCode(65 + options.length),
        label: compactText(line.replace(/^[-*]\s+/, "")),
      });
      return;
    }

    body.push(compactText(line));
  });

  let prompt = body.join(" ").trim();
  let normalizedOptions = options.length ? options : inlineOptions;

  if (normalizedOptions.length === 0) {
    const parsedInlineOptions = parseMultipleChoiceContent(prompt);
    if (parsedInlineOptions.options.length > 0) {
      prompt = parsedInlineOptions.prompt || prompt;
      normalizedOptions = parsedInlineOptions.options;
    }
  }

  return {
    prompt: prompt || "Untitled question",
    options: normalizedOptions,
    answer,
  };
};

const deriveReviewQuestionState = (item) => {
  const details = extractQuestionDetails(item);
  const points = Number.isFinite(Number(item?.points)) ? Number(item.points) : 1;
  const options = Array.isArray(details.options)
    ? details.options
        .map((option, optionIndex) => {
          if (typeof option === "string") {
            return {
              key: String.fromCharCode(65 + optionIndex),
              label: option,
            };
          }
          return {
            key: String(
              option?.key || String.fromCharCode(65 + optionIndex),
            ).toUpperCase(),
            label: String(option?.label || "").trim(),
          };
        })
        .filter((option) => option.label)
    : [];

  const studentAnswer = String(item?.answer || item?.studentAnswer || "").trim();
  const expectedAnswer = String(
    item?.expectedAnswer || item?.correctAnswer || details.answer || "",
  ).trim();

  const studentChoiceKey = resolveChoiceKey(studentAnswer, options);
  const correctChoiceKey = resolveChoiceKey(expectedAnswer, options);
  const teacherScoreRaw =
    item?.teacherScore === null || item?.teacherScore === undefined
      ? null
      : Number(item.teacherScore);
  const hasTeacherScore =
    isOpenEndedType(item?.type) && Number.isFinite(teacherScoreRaw);
  const teacherScore = hasTeacherScore
    ? Math.max(0, Math.min(points, teacherScoreRaw))
    : null;

  const teacherReviewRequired = requiresTeacherReview(item);
  const isCorrectFlag =
    item?.isCorrect === true ||
    String(item?.isCorrect || "").toLowerCase() === "true";
  const isCorrectByChoice =
    Boolean(studentChoiceKey) &&
    Boolean(correctChoiceKey) &&
    studentChoiceKey === correctChoiceKey;
  const correct = hasTeacherScore
    ? teacherScore >= points * 0.95
    : !teacherReviewRequired && (isCorrectFlag || isCorrectByChoice);

  const cardClass = hasTeacherScore
    ? "border-sky-200 bg-sky-50/70"
    : teacherReviewRequired
      ? "border-amber-200 bg-amber-50/70"
      : correct
        ? "border-emerald-100 bg-emerald-50/70"
        : "border-rose-100 bg-rose-50/70";
  const statusClass = hasTeacherScore
    ? "bg-sky-100 text-sky-700"
    : teacherReviewRequired
      ? "bg-amber-100 text-amber-700"
      : correct
        ? "bg-emerald-100 text-emerald-700"
        : "bg-rose-100 text-rose-700";
  const statusLabel = hasTeacherScore
    ? "Teacher graded"
    : teacherReviewRequired
      ? "Teacher Review Required"
      : correct
        ? "Correct"
        : "Incorrect";

  return {
    details,
    points,
    options,
    studentAnswer,
    expectedAnswer,
    teacherScore,
    teacherFeedback: String(item?.teacherFeedback || "").trim(),
    studentChoiceKey,
    correctChoiceKey,
    hasTeacherScore,
    teacherReviewRequired,
    correct,
    cardClass,
    statusClass,
    statusLabel,
  };
};

const TeacherExercises = () => {
  const [selectedClass, setSelectedClass] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [isClassPickerLoading, setIsClassPickerLoading] = useState(true);
  const [classPickerSubject, setClassPickerSubject] = useState("All");
  const [classPickerQuery, setClassPickerQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [isClassExercisesView, setIsClassExercisesView] = useState(false);

  const [exercises, setExercises] = useState([]);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");
  const [viewMode, setViewMode] = useState("list");

  const [isDownloading, setIsDownloading] = useState(false);
  const [previewExercise, setPreviewExercise] = useState(null);
  const [previewActiveIndex, setPreviewActiveIndex] = useState(0);

  const [reviewExercise, setReviewExercise] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewActiveIndex, setReviewActiveIndex] = useState(0);
  const [reviewTeacherScoreInput, setReviewTeacherScoreInput] = useState("");
  const [reviewTeacherFeedbackInput, setReviewTeacherFeedbackInput] = useState("");
  const [isSavingTeacherGrade, setIsSavingTeacherGrade] = useState(false);

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
    const loadClasses = async () => {
      try {
        const { data } = await api.get("/teacher/record-marks/classes");
        if (!active) return;
        setClasses(Array.isArray(data?.classes) ? data.classes : []);
      } catch (error) {
        console.error("Failed to load classes", error);
        toast.error("Failed to load classes.");
      } finally {
        if (active) setIsClassPickerLoading(false);
      }
    };
    loadClasses();
    return () => {
      active = false;
    };
  }, []);

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

  const classPickerSubjects = useMemo(
    () => ["All", ...Array.from(new Set(classes.map((item) => item.courseName).filter(Boolean)))],
    [classes],
  );

  useEffect(() => {
    if (!classPickerSubjects.includes(classPickerSubject)) {
      setClassPickerSubject("All");
    }
  }, [classPickerSubjects, classPickerSubject]);

  const filteredClasses = useMemo(() => {
    const query = norm(classPickerQuery);
    return classes.filter((item) => {
      if (classPickerSubject !== "All" && norm(item.courseName) !== norm(classPickerSubject)) {
        return false;
      }
      if (!query) return true;
      return `${item.courseName || ""} ${item.level || ""} ${item.classGroup || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [classes, classPickerQuery, classPickerSubject]);

  const classPickerStats = useMemo(
    () => ({
      classes: classes.length,
      students: classes.reduce((sum, item) => sum + (Number(item.studentsCount) || 0), 0),
      exercises: classes.reduce((sum, item) => sum + (Number(item.exercisesCount) || 0), 0),
    }),
    [classes],
  );

  const reloadExercises = async () => {
    const { data } = await api.get("/teacher/exercises?includeQuestions=true");
    setExercises(Array.isArray(data?.exercises) ? data.exercises : []);
  };

  const rosterStudents = useMemo(() => {
    if (!selectedClass) return [];
    const className = norm(selectedClass.classGroup);
    const gradeLevel = norm(selectedClass.level);
    return students
      .filter((student) => {
        if (className && norm(student.className) !== className) return false;
        if (gradeLevel && norm(student.gradeLevel) !== gradeLevel) return false;
        return true;
      })
      .map((student) => ({
        ...student,
        name: student.name || student.email || "Student",
      }))
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
        }),
      );
  }, [students, selectedClass]);

  const classExercises = useMemo(() => {
    if (!selectedClass) return [];
    const className = norm(selectedClass.classGroup);
    const gradeLevel = norm(selectedClass.level);
    const subjectName = norm(selectedClass.courseName);
    const rosterStudentIds = new Set(
      rosterStudents.map((student) => student.id).filter(Boolean),
    );

    return exercises.filter((exercise) => {
      if (subjectName && norm(exercise?.subject) !== subjectName) return false;

      const studentId = exercise?.student?.id;
      if (studentId && rosterStudentIds.has(studentId)) {
        return true;
      }

      if (className && norm(exercise?.student?.className) !== className) return false;
      if (gradeLevel && norm(exercise?.student?.gradeLevel) !== gradeLevel) return false;
      return true;
    });
  }, [exercises, selectedClass, rosterStudents]);

  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    const map = new Map();

    rosterStudents.forEach((student) => {
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
  }, [rosterStudents, classExercises, selectedClass]);

  const studentDropdownOptions = useMemo(
    () =>
      classStudents.map((student) => {
        const label = student.name || student.email || "Student";
        return {
          value: student.id,
          label,
        };
      }),
    [classStudents],
  );

  const selectedStudent = useMemo(
    () => classStudents.find((student) => student.id === selectedStudentId) || null,
    [classStudents, selectedStudentId],
  );

  useEffect(() => {
    if (!selectedStudentId) return;
    if (classStudents.some((student) => student.id === selectedStudentId)) return;
    setSelectedStudentId("");
  }, [classStudents, selectedStudentId]);

  const filteredClassStudents = useMemo(() => {
    const query = norm(studentPickerQuery);
    return classStudents.filter((student) => {
      if (!query) return true;
      return `${student.name || ""} ${student.email || ""} ${student.studentNumber || ""} ${
        student.studentNo || ""
      }`
        .toLowerCase()
        .includes(query);
    });
  }, [classStudents, studentPickerQuery]);

  const studentPickerRows = useMemo(() => {
    const byStudent = new Map();
    classExercises.forEach((exercise) => {
      const studentId = exercise?.student?.id;
      if (!studentId) return;
      if (!byStudent.has(studentId)) byStudent.set(studentId, []);
      byStudent.get(studentId).push(exercise);
    });

    return filteredClassStudents.map((student, index) => {
      const list = byStudent.get(student.id) || [];
      const completed = list.filter((exercise) => getStatusKey(exercise) === "submitted").length;
      const pending = Math.max(list.length - completed, 0);
      const latestDone = list
        .filter((exercise) => getStatusKey(exercise) === "submitted")
        .sort(
          (a, b) =>
            (new Date(b.submittedAt || 0).getTime() || 0) -
            (new Date(a.submittedAt || 0).getTime() || 0),
        )[0];

      return {
        id: student.id,
        index: index + 1,
        student,
        total: list.length,
        completed,
        pending,
        latestDoneAt: latestDone?.submittedAt || null,
      };
    });
  }, [classExercises, filteredClassStudents]);

  const inferredWholeClassExerciseIds = useMemo(() => {
    const signatureToStudentIds = new Map();
    classExercises.forEach((exercise) => {
      const origin = norm(exercise?.assignmentOrigin);
      if (origin !== "teacher_generated" && origin !== "teacher_class_upload") return;

      const studentId = String(exercise?.student?.id || "").trim();
      if (!studentId) return;

      const signature = [
        norm(exercise?.name),
        norm(exercise?.subject),
        norm(exercise?.difficulty),
        String(exercise?.questionCount || ""),
        String(exercise?.date || ""),
      ].join("|");

      if (!signatureToStudentIds.has(signature)) {
        signatureToStudentIds.set(signature, new Set());
      }
      signatureToStudentIds.get(signature).add(studentId);
    });

    const inferredIds = new Set();
    classExercises.forEach((exercise) => {
      const origin = norm(exercise?.assignmentOrigin);
      if (origin !== "teacher_generated" && origin !== "teacher_class_upload") return;

      const signature = [
        norm(exercise?.name),
        norm(exercise?.subject),
        norm(exercise?.difficulty),
        String(exercise?.questionCount || ""),
        String(exercise?.date || ""),
      ].join("|");
      const studentIds = signatureToStudentIds.get(signature);
      if (studentIds && studentIds.size > 1) {
        inferredIds.add(exercise.id);
      }
    });

    return inferredIds;
  }, [classExercises]);

  const activeStudents = useMemo(() => {
    if (!selectedStudentId) return classStudents;
    return classStudents.filter((student) => student.id === selectedStudentId);
  }, [classStudents, selectedStudentId]);

  const activeExercises = useMemo(() => {
    const scopedExercises = selectedStudentId
      ? classExercises.filter((exercise) => exercise?.student?.id === selectedStudentId)
      : classExercises;

    if (isClassExercisesView) {
      return scopedExercises.filter((exercise) => {
        const origin = norm(exercise?.assignmentOrigin);
        if (origin === "teacher_class_generated") return true;
        if (origin === "teacher_class_upload" || origin === "teacher_generated") {
          return inferredWholeClassExerciseIds.has(exercise.id);
        }
        return false;
      });
    }

    return scopedExercises;
  }, [
    classExercises,
    selectedStudentId,
    isClassExercisesView,
    inferredWholeClassExerciseIds,
  ]);

  const subjects = useMemo(
    () => [
      "All",
      ...Array.from(new Set(activeExercises.map((exercise) => exercise.subject).filter(Boolean))),
    ],
    [activeExercises],
  );

  useEffect(() => {
    if (!subjects.includes(selectedSubject)) {
      setSelectedSubject("All");
    }
  }, [subjects, selectedSubject]);

  const filteredExercises = useMemo(() => {
    const query = norm(searchQuery);
    return activeExercises.filter((exercise) => {
      if (selectedSubject !== "All" && exercise.subject !== selectedSubject) return false;
      if (!query) return true;
      const searchLabel = `${exercise.name || ""} ${exercise.subject || ""} ${
        exercise.student?.name || ""
      } ${exercise.student?.studentNumber || ""}`.toLowerCase();
      return searchLabel.includes(query);
    });
  }, [activeExercises, searchQuery, selectedSubject]);

  const studentsListRows = useMemo(() => {
    const byStudent = new Map();
    activeExercises.forEach((exercise) => {
      const studentId = exercise?.student?.id;
      if (!studentId) return;
      if (!byStudent.has(studentId)) byStudent.set(studentId, []);
      byStudent.get(studentId).push(exercise);
    });

    const query = norm(searchQuery);
    const hasFilter = query || selectedSubject !== "All";

    return activeStudents
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
  }, [activeExercises, activeStudents, filteredExercises, searchQuery, selectedSubject]);

  const classStats = useMemo(() => {
    const completed = activeExercises.filter((exercise) => getStatusKey(exercise) === "submitted").length;
    return {
      students: activeStudents.length,
      exercises: activeExercises.length,
      completed,
      pending: Math.max(activeExercises.length - completed, 0),
    };
  }, [activeExercises, activeStudents]);

  const selectedStudentOverview = useMemo(() => {
    const completed = activeExercises.filter((exercise) => getStatusKey(exercise) === "submitted").length;
    const latestDone = activeExercises
      .filter((exercise) => getStatusKey(exercise) === "submitted")
      .sort(
        (a, b) =>
          (new Date(b.submittedAt || 0).getTime() || 0) -
          (new Date(a.submittedAt || 0).getTime() || 0),
      )[0];

    return {
      total: activeExercises.length,
      completed,
      pending: Math.max(activeExercises.length - completed, 0),
      latestDoneAt: latestDone?.submittedAt || null,
    };
  }, [activeExercises]);

  const previewQuestions = useMemo(
    () => (Array.isArray(previewExercise?.questions) ? previewExercise.questions : []),
    [previewExercise],
  );

  useEffect(() => {
    setPreviewActiveIndex(0);
  }, [previewExercise]);

  const previewActiveQuestion = useMemo(
    () => previewQuestions[previewActiveIndex] || null,
    [previewQuestions, previewActiveIndex],
  );

  const previewActiveDetails = useMemo(
    () => extractQuestionDetails(previewActiveQuestion || {}),
    [previewActiveQuestion],
  );

  const reviewQuestions = useMemo(
    () => (Array.isArray(reviewData?.questions) ? reviewData.questions : []),
    [reviewData],
  );

  const reviewQuestionViews = useMemo(
    () => reviewQuestions.map((item) => deriveReviewQuestionState(item)),
    [reviewQuestions],
  );

  useEffect(() => {
    setReviewActiveIndex(0);
  }, [reviewExercise]);

  const reviewActiveView = useMemo(
    () => reviewQuestionViews[reviewActiveIndex] || null,
    [reviewQuestionViews, reviewActiveIndex],
  );

  const reviewActiveQuestion = useMemo(
    () => reviewQuestions[reviewActiveIndex] || null,
    [reviewQuestions, reviewActiveIndex],
  );

  useEffect(() => {
    if (!reviewActiveView) {
      setReviewTeacherScoreInput("");
      setReviewTeacherFeedbackInput("");
      return;
    }
    setReviewTeacherScoreInput(
      reviewActiveView.hasTeacherScore && Number.isFinite(Number(reviewActiveView.teacherScore))
        ? String(reviewActiveView.teacherScore)
        : "",
    );
    setReviewTeacherFeedbackInput(reviewActiveView.teacherFeedback || "");
  }, [reviewActiveView]);

  const reviewMaxPoints = Number(reviewActiveView?.points) || 1;
  const reviewTeacherScorePreview = useMemo(() => {
    const parsed = Number(reviewTeacherScoreInput);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(reviewMaxPoints, parsed));
  }, [reviewTeacherScoreInput, reviewMaxPoints]);
  const reviewTeacherScorePercent = useMemo(() => {
    if (reviewTeacherScorePreview === null || reviewMaxPoints <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((reviewTeacherScorePreview / reviewMaxPoints) * 100)),
    );
  }, [reviewTeacherScorePreview, reviewMaxPoints]);

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
          targetType: assignTargetType,
          difficulty: assignDifficulty,
          questionCount: resolveQuestionCount(assignQuestionCount),
          weakArea: String(assignWeakArea || "").trim() || undefined,
        });
        if (data?.exercise) created.push(data.exercise);
      } catch {
        failed += 1;
      }
    }

    if (created.length > 0) {
      setExercises((prev) => [...created, ...prev]);
      if (assignTargetType === "class") {
        setSelectedStudentId("");
        setIsClassExercisesView(true);
      }
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
      if (uploadTargetType === "class") {
        setSelectedStudentId("");
        setIsClassExercisesView(true);
      }
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
    setReviewActiveIndex(0);
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

  const handleSaveTeacherGrade = async () => {
    if (!reviewExercise?.id || !reviewActiveQuestion?.id || !reviewActiveView) {
      return;
    }

    if (!isOpenEndedType(reviewActiveQuestion.type)) {
      toast.error("Teacher grading is only available for open-ended questions.");
      return;
    }

    const maxPoints = Number(reviewActiveView.points) || 1;
    const parsedScore = Number(reviewTeacherScoreInput);
    if (!Number.isFinite(parsedScore)) {
      toast.error("Enter a valid teacher score.");
      return;
    }

    const safeScore = Math.max(0, Math.min(maxPoints, parsedScore));
    try {
      setIsSavingTeacherGrade(true);
      const { data } = await api.patch(`/teacher/exercises/${reviewExercise.id}/review`, {
        questionId: reviewActiveQuestion.id,
        teacherScore: safeScore,
        teacherFeedback: reviewTeacherFeedbackInput,
      });

      if (data) {
        const updatedQuestions = Array.isArray(data?.questions) ? data.questions : [];
        const nextIndex = updatedQuestions.findIndex(
          (question) => String(question?.id) === String(reviewActiveQuestion.id),
        );
        setReviewData(data);
        if (nextIndex >= 0) setReviewActiveIndex(nextIndex);
      }
      toast.success("Teacher grade saved.");
    } catch (error) {
      console.error("Failed to save teacher grade", error);
      toast.error(error?.response?.data?.error || "Failed to save teacher grade.");
    } finally {
      setIsSavingTeacherGrade(false);
    }
  };

  if (!selectedClass) {
    if (isClassPickerLoading) return <TeacherPageSkeleton variant="classPicker" />;
    return (
      <div className="w-full h-full font-sans animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Exercises</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ClassPickerStatCard icon={<BookOpen size={20} />} label="Classes" value={classPickerStats.classes} />
            <ClassPickerStatCard icon={<Users size={20} />} label="Students" value={classPickerStats.students} />
            <ClassPickerStatCard icon={<FileText size={20} />} label="Exercises" value={classPickerStats.exercises} />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                <Filter size={18} />
              </div>
              {classPickerSubjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setClassPickerSubject(subject)}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap ${
                    classPickerSubject === subject
                      ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                  }`}
                >
                  {subject}
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
                placeholder="Search class..."
                value={classPickerQuery}
                onChange={(event) => setClassPickerQuery(event.target.value)}
                className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all text-sm font-semibold text-slate-700 shadow-sm"
              />
            </div>
          </div>

          {classes.length === 0 || filteredClasses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredClasses.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 hover:-translate-y-1 hover:shadow-md transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-bottom-2"
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
                    onClick={() => {
                      setSelectedClass(item);
                      setSelectedStudentId("");
                      setIsClassExercisesView(false);
                      setStudentPickerQuery("");
                      setSearchQuery("");
                      setSelectedSubject("All");
                    }}
                    className="w-full py-4 bg-[#2D70FD] text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#1E5CE0]"
                  >
                    <ArrowUpRight size={18} />
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <TeacherPageSkeleton
        variant={!selectedStudentId && !isClassExercisesView ? "studentSelect" : "exercises"}
      />
    );
  }

  if (!selectedStudentId && !isClassExercisesView) {
    return (
      <div className="w-full h-full font-sans animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedClass(null);
                  setSelectedStudentId("");
                  setIsClassExercisesView(false);
                  setStudentPickerQuery("");
                  setSearchQuery("");
                  setSelectedSubject("All");
                  setClassPickerSubject("All");
                  setClassPickerQuery("");
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="space-y-1">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Select Student</h1>
                <p className="text-sm font-semibold text-slate-500">
                  {selectedClass.courseName || "Subject"} | {selectedClass.classGroup || "--"}{" "}
                  {selectedClass.level || "--"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedStudentId("");
                setIsClassExercisesView(true);
                setSearchQuery("");
                setSelectedSubject("All");
                setViewMode("grid");
              }}
              className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-5 hover:bg-[#1E5CE0] text-sm font-black"
            >
              <FileText size={18} />
              General Exercises
            </button>
          </div>

          <div className="relative w-full lg:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
              size={20}
            />
            <input
              type="text"
              value={studentPickerQuery}
              onChange={(event) => setStudentPickerQuery(event.target.value)}
              placeholder="Search student..."
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 shadow-sm"
            />
          </div>

          {classStudents.length === 0 || filteredClassStudents.length === 0 ? (
            <EmptyState />
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
                          <p>Exercises Completed</p>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full border border-slate-300 text-[11px] font-semibold text-slate-700">
                              Max: {Math.max(...studentPickerRows.map((row) => row.total), 0)}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                              TRACKING
                            </span>
                          </div>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-sm font-black text-slate-800 border border-slate-200 min-w-[220px]">
                        <div className="space-y-1">
                          <p>Pending Exercises</p>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full border border-slate-300 text-[11px] font-semibold text-slate-700">
                              Max: {Math.max(...studentPickerRows.map((row) => row.total), 0)}
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
                    {studentPickerRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => {
                          setSelectedStudentId(row.student.id);
                          setIsClassExercisesView(false);
                          setSearchQuery("");
                          setSelectedSubject("All");
                        }}
                        className="bg-white cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                      >
                        <td className="px-3 py-3 text-sm font-semibold text-slate-800 border border-slate-200">
                          {row.index}
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
                              {row.completed}
                              <span className="text-slate-400">/{row.total || 0}</span>
                            </p>
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          </div>
                        </td>
                        <td className="px-3 py-3 border border-slate-200">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {row.pending}
                              <span className="text-slate-400">/{row.total || 0}</span>
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
    );
  }

  return (
    <div className="w-full h-full font-sans animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setSelectedClass(null);
              setSelectedStudentId("");
              setIsClassExercisesView(false);
              setStudentPickerQuery("");
              setSearchQuery("");
              setSelectedSubject("All");
              setClassPickerSubject("All");
              setClassPickerQuery("");
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-slate-200 text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Exercises</h1>
            <p className="text-sm font-semibold text-slate-500">
              {selectedClass.courseName || "Subject"} | {selectedClass.classGroup || "--"}
            </p>
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => openAssignModal(isClassExercisesView ? "" : selectedStudent?.id || "")}
            disabled={(!selectedStudent && !isClassExercisesView) || isAssigning}
            className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-5 hover:bg-[#1E5CE0] disabled:opacity-60 text-sm font-black"
          >
            {isAssigning ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            AI Assign
          </button>
          <button
            type="button"
            onClick={() => openUploadModal(isClassExercisesView ? "" : selectedStudent?.id || "")}
            disabled={(!selectedStudent && !isClassExercisesView) || isUploadingAssignment}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <StatCard icon={<FileText size={18} />} label="Exercises" value={classStats.exercises} />
          <StatCard icon={<CheckIcon />} label="Completed" value={classStats.completed} />
          <StatCard icon={<Filter size={18} />} label="Pending" value={classStats.pending} />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="w-full">
            <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                <Filter size={18} />
              </div>
              {subjects.map((subject) => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                    selectedSubject === subject
                      ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full lg:w-96 group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
              size={20}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by exercise or student..."
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-medium text-slate-700 shadow-sm"
            />
          </div>
        </div>

      {viewMode === "grid" ? (
        filteredExercises.length > 0 ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col hover:border-blue-200 hover:-translate-y-1 hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                    <FileText size={28} />
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusClassName(exercise)}`}>
                    {getStatusLabel(exercise)}
                  </span>
                </div>
                <h3 className="font-black text-slate-800 text-lg mb-1">{exercise.name || "Exercise"}</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">{exercise.questionCount || 0} Questions</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{getCompletionDescription(exercise)}</p>

                <div className="mt-auto pt-6 grid grid-cols-3 gap-3">
                  <button onClick={() => setPreviewExercise(exercise)} className="py-3 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs inline-flex items-center justify-center gap-2">
                    <ArrowUpRight size={14} /> View
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
              className="bg-white rounded-[2.5rem] border border-slate-100 p-7 shadow-sm hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {row.student.name || "Student"}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    {row.latestDoneAt
                      ? `Latest completion: ${formatDateTime(row.latestDoneAt)}`
                      : "No completed exercise yet"}
                  </p>
                </div>
              </div>

              {row.exercises.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {row.exercises.slice(0, 4).map((exercise) => (
                    <div
                      key={exercise.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 px-5 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {exercise.name || "Exercise"}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {exercise.questionCount || 0} Questions
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPreviewExercise(exercise)}
                          className="px-3 py-2 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openReviewModal(exercise)}
                          disabled={!exercise.submissionId}
                          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs disabled:opacity-50"
                        >
                          Answers
                        </button>
                        <button
                          onClick={() => handleDownloadExercise(exercise)}
                          disabled={isDownloading}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-[#2D70FD] hover:border-blue-200 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setPreviewExercise(null)}
          />
          <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in duration-300">
            <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
              <div className="p-8 border-b border-slate-200 bg-white space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Exercise Preview
                </p>
                <h3 className="font-black text-slate-800 text-xl leading-tight break-words">
                  {previewExercise.name || "Exercise"}
                </h3>
                <p className="text-xs font-semibold text-slate-500 break-words">
                  {previewExercise.subject || "--"} |{" "}
                  {previewExercise.student?.name || "Student"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusClassName(previewExercise)}`}
                  >
                    {getStatusLabel(previewExercise)}
                  </span>
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#2D70FD]">
                    {previewExercise.questionCount || previewQuestions.length || 0} Questions
                  </span>
                </div>
              </div>

              <div className="p-5 border-b border-slate-200 bg-white space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student ID</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {previewExercise.student?.studentNumber || "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {previewExercise.date || "--"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {getCompletionDescription(previewExercise)}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {previewQuestions.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {previewQuestions.map((question, index) => (
                      <button
                        key={question?.id || index}
                        onClick={() => setPreviewActiveIndex(index)}
                        className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${
                          previewActiveIndex === index
                            ? "border-[#2D70FD] bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            previewActiveIndex === index
                              ? "bg-[#2D70FD] text-white"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
                    No question preview available.
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white">
              <div className="p-8 flex justify-between items-center border-b border-slate-50">
                <div>
                  <p className="text-sm font-extrabold text-slate-700 tracking-wide">
                    Practice
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {previewActiveQuestion
                      ? `Question ${previewActiveIndex + 1} of ${previewQuestions.length}`
                      : "No question selected"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewExercise(null)}
                  className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12">
                {previewQuestions.length === 0 || !previewActiveQuestion ? (
                  <div className="h-full min-h-[320px] flex items-center justify-center text-sm font-bold text-slate-500">
                    No question preview available for this exercise.
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <span className="px-3 py-1 bg-blue-50 text-[#2D70FD] text-[10px] font-black rounded-lg uppercase">
                        {previewActiveQuestion?.type || "Question"}
                      </span>
                      <h4 className="text-2xl font-extrabold text-slate-800 leading-snug whitespace-pre-line break-words">
                        {previewActiveDetails.prompt}
                      </h4>
                    </div>

                    {Array.isArray(previewActiveDetails.options) &&
                    previewActiveDetails.options.length > 0 ? (
                      <div className="space-y-3">
                        {previewActiveDetails.options.map((option, optionIndex) => {
                          const optionKey =
                            typeof option === "string"
                              ? String.fromCharCode(65 + optionIndex)
                              : option?.key || String.fromCharCode(65 + optionIndex);
                          const optionLabel =
                            typeof option === "string" ? option : option?.label;
                          return (
                            <div
                              key={`${previewActiveQuestion?.id || previewActiveIndex}-option-${optionIndex}`}
                              className="w-full flex items-start gap-4 px-5 py-4 rounded-2xl border border-slate-200 bg-slate-50"
                            >
                              <span className="min-w-9 h-9 rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-black flex items-center justify-center">
                                {optionKey}
                              </span>
                              <p className="text-sm font-semibold text-slate-700 leading-relaxed break-words">
                                {optionLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {previewActiveDetails.answer ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
                        <p className="text-xs font-semibold text-emerald-700">
                          Suggested Answer
                        </p>
                        <p className="mt-2 text-sm font-bold text-emerald-900 break-words whitespace-pre-line">
                          {previewActiveDetails.answer}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      </div>

      {reviewExercise ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              if (!isReviewLoading) {
                setReviewExercise(null);
                setReviewData(null);
                setReviewError("");
              }
            }}
          />
          <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in duration-300">
            <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
              <div className="p-8 border-b border-slate-200 bg-white space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Student Answers
                </p>
                <h3 className="font-black text-slate-800 text-xl leading-tight break-words">
                  {reviewExercise.name || "Exercise"}
                </h3>
                <p className="text-xs font-semibold text-slate-500 break-words">
                  {reviewExercise.student?.name || "Student"} | ID {reviewExercise.student?.studentNumber || "--"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#2D70FD]">
                    {reviewQuestionViews.length} Questions
                  </span>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      norm(reviewData?.submission?.reviewStatus) === "waiting_teacher_review"
                        ? "bg-amber-100 text-amber-700"
                        : norm(reviewData?.submission?.reviewStatus) === "teacher_graded"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {norm(reviewData?.submission?.reviewStatus) === "waiting_teacher_review"
                      ? "Waiting teacher review"
                      : norm(reviewData?.submission?.reviewStatus) === "teacher_graded"
                        ? "Teacher graded"
                        : "AI graded"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {isReviewLoading ? (
                  <div className="h-full min-h-[180px] rounded-2xl border border-slate-100 bg-white flex items-center justify-center gap-2 text-sm font-semibold text-slate-600">
                    <Loader2 size={16} className="animate-spin" />
                    Loading answers...
                  </div>
                ) : reviewError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600 inline-flex items-center gap-2">
                    <AlertCircle size={16} />
                    {reviewError}
                  </div>
                ) : reviewQuestionViews.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {reviewQuestionViews.map((view, index) => (
                      <button
                        key={reviewQuestions[index]?.id || index}
                        onClick={() => setReviewActiveIndex(index)}
                        className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${
                          reviewActiveIndex === index
                            ? "border-[#2D70FD] bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                            reviewActiveIndex === index
                              ? "bg-[#2D70FD] text-white"
                              : view.hasTeacherScore
                                ? "bg-sky-100 text-sky-700"
                              : view.teacherReviewRequired
                                ? "bg-amber-100 text-amber-700"
                                : view.correct
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs font-semibold text-slate-500">
                    No answer details were returned.
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white">
              <div className="p-8 flex justify-between items-center border-b border-slate-50">
                <div>
                  <p className="text-sm font-extrabold text-slate-700 tracking-wide">
                    Answers Review
                  </p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    {reviewActiveView
                      ? `Question ${reviewActiveIndex + 1} of ${reviewQuestionViews.length}`
                      : "No question selected"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReviewExercise(null);
                    setReviewData(null);
                    setReviewError("");
                  }}
                  className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                  aria-label="Close answers"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12">
                {isReviewLoading ? (
                  <div className="h-full min-h-[320px] flex items-center justify-center">
                    <Loader2 size={34} className="animate-spin text-[#2D70FD]" />
                  </div>
                ) : reviewError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600 inline-flex items-center gap-2">
                    <AlertCircle size={16} />
                    {reviewError}
                  </div>
                ) : !reviewActiveView ? (
                  <div className="h-full min-h-[320px] flex items-center justify-center text-sm font-bold text-slate-500">
                    No answer details were returned for this submission.
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-8">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-[#2D70FD] text-[10px] font-black rounded-lg uppercase">
                          {reviewQuestions[reviewActiveIndex]?.type || "Question"}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${reviewActiveView.statusClass}`}
                        >
                          {reviewActiveView.statusLabel}
                        </span>
                      </div>
                      <h4 className="text-2xl font-extrabold text-slate-800 leading-snug whitespace-pre-line break-words">
                        {reviewActiveView.details.prompt ||
                          reviewQuestions[reviewActiveIndex]?.question ||
                          reviewQuestions[reviewActiveIndex]?.prompt ||
                          "Question"}
                      </h4>
                    </div>

                    {reviewActiveView.options.length > 0 ? (
                      <div className="space-y-3">
                        {reviewActiveView.options.map((option, optionIndex) => {
                          const isStudentChoice =
                            Boolean(reviewActiveView.studentChoiceKey) &&
                            option.key === reviewActiveView.studentChoiceKey;
                          const isCorrectChoice =
                            Boolean(reviewActiveView.correctChoiceKey) &&
                            option.key === reviewActiveView.correctChoiceKey;

                          const optionTone = reviewActiveView.teacherReviewRequired
                            ? isStudentChoice
                              ? "border-amber-300 bg-amber-100"
                              : "border-slate-200 bg-white"
                            : isCorrectChoice
                              ? "border-emerald-300 bg-emerald-100"
                              : isStudentChoice
                                ? "border-rose-300 bg-rose-100"
                                : "border-slate-200 bg-white";

                          return (
                            <div
                              key={`${reviewQuestions[reviewActiveIndex]?.id || reviewActiveIndex}-option-${optionIndex}`}
                              className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl border ${optionTone}`}
                            >
                              <span className="min-w-9 h-9 rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-black flex items-center justify-center">
                                {option.key}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-700 leading-relaxed break-words">
                                  {option.label}
                                </p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  {isStudentChoice ? (
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                      Student choice
                                    </span>
                                  ) : null}
                                  {isCorrectChoice ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                      <CheckCircle2 size={11} />
                                      Correct answer
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <p className="text-xs font-semibold text-slate-500">
                          Student Answer
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-700 break-words whitespace-pre-line">
                          {reviewActiveView.studentAnswer || "No answer submitted"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-white p-5">
                        <p className="text-xs font-semibold text-slate-500">
                          Expected Answer
                        </p>
                        <p className="mt-2 text-sm font-bold text-slate-700 break-words whitespace-pre-line">
                          {reviewActiveView.expectedAnswer || "--"}
                        </p>
                      </div>
                    </div>

                    {isOpenEndedType(reviewActiveQuestion?.type) ? (
                      <div className="rounded-3xl bg-gradient-to-r from-sky-100 via-blue-100 to-indigo-100 p-[1px] shadow-sm animate-in fade-in duration-300">
                        <div className="rounded-3xl bg-white p-5 md:p-6 space-y-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
                                Teacher Grade Override
                              </p>
                            </div>
                            <div className="px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50">
                              <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                Max
                              </p>
                              <p className="text-sm font-black text-sky-800">{reviewMaxPoints} pts</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                              <span>Score strength</span>
                              <span>
                                {reviewTeacherScorePreview === null
                                  ? "Not set"
                                  : `${reviewTeacherScorePreview}/${reviewMaxPoints} (${reviewTeacherScorePercent}%)`}
                              </span>
                            </div>
                           
                          </div>

                          <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                                Score
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min={0}
                                  max={reviewMaxPoints}
                                  step="0.25"
                                  value={reviewTeacherScoreInput}
                                  onChange={(event) => setReviewTeacherScoreInput(event.target.value)}
                                  className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 pr-14 text-base font-black text-slate-700 outline-none focus:border-[#2D70FD] transition-colors"
                                  placeholder="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                                  /{reviewMaxPoints}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
                                Feedback
                              </label>
                              <textarea
                                rows={4}
                                value={reviewTeacherFeedbackInput}
                                onChange={(event) => setReviewTeacherFeedbackInput(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 resize-none outline-none focus:border-[#2D70FD] transition-colors"
                                placeholder="Tell the student what was good and what to improve next..."
                              />
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={handleSaveTeacherGrade}
                                  disabled={isSavingTeacherGrade}
                                  className="h-11 px-5 rounded-xl bg-[#2D70FD] text-white text-sm font-black inline-flex items-center gap-2 hover:bg-[#1E5CE0] transition-all disabled:opacity-60"
                                >
                                  {isSavingTeacherGrade ? <Loader2 size={16} className="animate-spin" /> : null}
                                  Save Teacher Grade
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {reviewActiveView.teacherReviewRequired ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                        Teacher review is required for this answer. The highlighted option is the student's selected choice.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
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
                  <DropdownField
                    value={assignStudentId}
                    onChange={setAssignStudentId}
                    options={studentDropdownOptions}
                    placeholder="Select student"
                  />
                </div>
              ) : null}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Difficulty
                  </label>
                  <DropdownField
                    value={assignDifficulty}
                    onChange={setAssignDifficulty}
                    options={difficultyDropdownOptions}
                  />
                </div>
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Questions
                  </label>
                  <DropdownField
                    value={assignQuestionCount}
                    onChange={setAssignQuestionCount}
                    options={questionCountOptions}
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
                  placeholder="Enter weak area"
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
                  <DropdownField
                    value={uploadStudentId}
                    onChange={setUploadStudentId}
                    options={studentDropdownOptions}
                    placeholder="Select student"
                  />
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
                  <DropdownField
                    value={uploadDifficulty}
                    onChange={setUploadDifficulty}
                    options={difficultyDropdownOptions}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2 block">
                  Question Count
                </label>
                <DropdownField
                  value={uploadQuestionCount}
                  onChange={setUploadQuestionCount}
                  options={questionCountOptions}
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

const DropdownField = ({
  value,
  onChange,
  options = [],
  placeholder = "Select option",
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (fieldRef.current && !fieldRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const selected = options.find((option) => String(option.value) === String(value));
  const isDisabled = disabled || options.length === 0;

  return (
    <div ref={fieldRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (isDisabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={isDisabled}
        className={`relative w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
          isDisabled
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
            : open
              ? "border-[#2D70FD] bg-blue-50/40 ring-2 ring-blue-100"
              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/20"
        }`}
      >
        <span className={`block truncate text-sm font-semibold ${isDisabled ? "text-slate-400" : "text-slate-700"}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${
            open ? "rotate-180 text-[#2D70FD]" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          {options.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange?.(option.value);
                  setOpen(false);
                }}
                className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition-colors last:mb-0 ${
                  active ? "bg-blue-50 text-[#2D70FD]" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block truncate text-sm font-semibold">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
    <div className="w-12 h-12 rounded-2xl inline-flex items-center justify-center bg-blue-50 text-[#2D70FD]">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
    </div>
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

const ClassPickerStatCard = ({ icon, label, value }) => (
  <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm hover:border-blue-200 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
    <div className="w-14 h-14 rounded-2xl inline-flex items-center justify-center bg-blue-50 text-[#2D70FD]">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
    </div>
  </div>
);

export default TeacherExercises;
