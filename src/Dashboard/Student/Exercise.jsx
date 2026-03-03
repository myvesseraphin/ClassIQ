import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  FileText,
  LayoutGrid,
  List,
  X,
  Sparkles,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Clock,
  Send,
  Activity,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import StudentPageSkeleton from "../../Component/StudentPageSkeleton";

const Exercise = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value || "",
    );

  const DRAFT_KEY_PREFIX = "classiq.exerciseDraft.v1.";
  const DRAFT_META_PREFIX = "classiq.exerciseDraftMeta.v1.";
  const LAST_DRAFT_KEY = "classiq.lastDraftExerciseId.v1";
  const CONTEXT_CACHE_KEY = "classiq.exerciseContextCache.v1";

  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [openQuestionMode, setOpenQuestionMode] = useState("auto");
  const [isGradingMenuOpen, setIsGradingMenuOpen] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectChipQuery, setSubjectChipQuery] = useState("");
  const [isTopicPromptOpen, setIsTopicPromptOpen] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const gradingMenuRef = useRef(null);
  const didAutoOpenRef = useRef(false);
  const didHintToastRef = useRef(false);

  const [exercises, setExercises] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lessonMeta, setLessonMeta] = useState(null);
  const [isLessonLoading, setIsLessonLoading] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [resultStepIndex, setResultStepIndex] = useState(0);
  const [resultStepDirection, setResultStepDirection] = useState("next");
  const [reviewPayload, setReviewPayload] = useState(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [reviewActiveIndex, setReviewActiveIndex] = useState(0);
  const gradingModeOptions = [
    {
      value: "auto",
      label: "AI Fast Grading",
    },
    {
      value: "teacher_review",
      label: "Teacher Review",
    },
  ];
  const selectedGradingMode =
    gradingModeOptions.find((mode) => mode.value === openQuestionMode) ||
    gradingModeOptions[0];

  const allSubjects = (
    availableSubjects.length
      ? availableSubjects
      : Array.from(new Set(exercises.map((ex) => ex.subject).filter(Boolean)))
  ).filter(Boolean);
  const requestedSubjectFromUrl = String(
    searchParams.get("subject") || "",
  ).trim();
  const requestedExerciseIdFromUrl = String(
    searchParams.get("exerciseId") || "",
  ).trim();
  const requestedWeakAreaFromUrl = String(
    searchParams.get("weakArea") || "",
  ).trim();
  const assignmentActionFromUrl = String(searchParams.get("action") || "")
    .trim()
    .toLowerCase();
  const requestedOpenReviewFromUrl =
    String(searchParams.get("review") || "").trim() === "1" ||
    String(searchParams.get("mode") || "")
      .trim()
      .toLowerCase() === "review";

  const chipSubjects = (() => {
    const query = String(subjectChipQuery || "")
      .trim()
      .toLowerCase();
    if (!query) return allSubjects;
    return allSubjects.filter((subject) =>
      String(subject || "")
        .toLowerCase()
        .includes(query),
    );
  })();
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  const fileOrigin = apiBase.replace(/\/api\/?$/, "");
  const resolveMediaUrl = (value) => {
    const url = String(value || "").trim();
    if (!url) return "";
    return url.startsWith("/") ? `${fileOrigin}${url}` : url;
  };

  const loadJsonFromStorage = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const saveJsonToStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage failures
    }
  };

  const loadContextCache = () => loadJsonFromStorage(CONTEXT_CACHE_KEY, {});

  const cacheExerciseContext = (exercise) => {
    if (!exercise?.id) return;
    const payload = {
      generatedWith: exercise.generatedWith || null,
      weakArea: exercise.weakArea || null,
      lessonContext: exercise.lessonContext || null,
      references: Array.isArray(exercise.references) ? exercise.references : [],
      updatedAt: Date.now(),
    };
    const existing = loadContextCache();
    saveJsonToStorage(CONTEXT_CACHE_KEY, {
      ...existing,
      [exercise.id]: payload,
    });
  };

  const loadDraft = (exerciseId) =>
    loadJsonFromStorage(`${DRAFT_KEY_PREFIX}${exerciseId}`, null);

  const clearDraft = (exerciseId) => {
    if (!exerciseId) return;
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${exerciseId}`);
      localStorage.removeItem(`${DRAFT_META_PREFIX}${exerciseId}`);
      const last = localStorage.getItem(LAST_DRAFT_KEY);
      if (String(last || "") === String(exerciseId)) {
        localStorage.removeItem(LAST_DRAFT_KEY);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadExercises = async () => {
      try {
        const [{ data: exerciseData }, { data: todayData }] = await Promise.all(
          [
            api.get("/student/exercises?includeQuestions=true"),
            api.get("/student/exercises/today-subjects"),
          ],
        );
        if (isMounted && Array.isArray(exerciseData?.exercises)) {
          const contextCache = loadContextCache();
          setExercises(
            exerciseData.exercises.map((item) => ({
              ...item,
              ...(contextCache[item.id] || {}),
            })),
          );
        }
        if (isMounted) {
          const fetchedSubjects = Array.isArray(todayData?.subjects)
            ? todayData.subjects
            : [];
          const exerciseSubjects = Array.from(
            new Set(
              (Array.isArray(exerciseData?.exercises)
                ? exerciseData.exercises
                : []
              )
                .map((exercise) => exercise.subject)
                .filter(Boolean),
            ),
          );
          const mergedSubjects =
            fetchedSubjects.length > 0 ? fetchedSubjects : exerciseSubjects;
          setAvailableSubjects(fetchedSubjects);

          setSelectedSubject((previous) => {
            if (previous) return previous;
            const matchedFromUrl = mergedSubjects.find(
              (subject) =>
                String(subject || "").toLowerCase() ===
                requestedSubjectFromUrl.toLowerCase(),
            );
            const defaultSubject = matchedFromUrl || mergedSubjects[0] || "";
            return defaultSubject || previous;
          });
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
  }, [requestedSubjectFromUrl]);

  React.useEffect(() => {
    if (allSubjects.length === 0 || selectedSubject) return;
    const matchedFromUrl = allSubjects.find(
      (subject) =>
        String(subject || "").toLowerCase() ===
        requestedSubjectFromUrl.toLowerCase(),
    );
    setSelectedSubject(matchedFromUrl || allSubjects[0]);
  }, [selectedSubject, allSubjects, requestedSubjectFromUrl]);

  React.useEffect(() => {
    if (!requestedSubjectFromUrl || allSubjects.length === 0) return;
    const matchedFromUrl = allSubjects.find(
      (subject) =>
        String(subject || "").toLowerCase() ===
        requestedSubjectFromUrl.toLowerCase(),
    );
    if (matchedFromUrl && matchedFromUrl !== selectedSubject) {
      setSelectedSubject(matchedFromUrl);
    }
  }, [requestedSubjectFromUrl, selectedSubject, allSubjects]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        gradingMenuRef.current &&
        !gradingMenuRef.current.contains(event.target)
      ) {
        setIsGradingMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsGradingMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const openReviewForExerciseId = async (exerciseId) => {
    if (!exerciseId || !isUuid(exerciseId)) {
      toast.error("Invalid exercise id.");
      return;
    }
    setIsReviewOpen(true);
    setIsReviewLoading(true);
    setReviewPayload(null);
    setReviewActiveIndex(0);
    try {
      const { data } = await api.get(`/student/exercises/${exerciseId}/review`);
      setReviewPayload(data);
    } catch (err) {
      console.error("Failed to load review", err);
      toast.error(err?.response?.data?.error || "Failed to load review.");
      setIsReviewOpen(false);
    } finally {
      setIsReviewLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSubject) {
      setLessonMeta(null);
      return;
    }

    let active = true;
    setIsLessonLoading(true);

    api
      .get("/student/lesson-progress", { params: { subject: selectedSubject } })
      .then(({ data }) => {
        if (!active) return;
        const entry = Array.isArray(data?.lessons) ? data.lessons[0] : null;
        const lesson = entry?.lesson || null;
        const focusTopic = entry?.focusTopic || null;
        const topic = String(lesson?.topic || focusTopic || "").trim() || null;
        const pages =
          lesson?.pageFrom && lesson?.pageTo
            ? `${lesson.pageFrom}-${lesson.pageTo}`
            : lesson?.pageFrom
              ? `${lesson.pageFrom}`
              : "";
        const labelParts = [];
        if (lesson?.term) labelParts.push(`Term ${lesson.term}`);
        if (lesson?.weekNumber) labelParts.push(`Week ${lesson.weekNumber}`);
        if (lesson?.lessonNumber)
          labelParts.push(`Lesson ${lesson.lessonNumber}`);
        const label = labelParts.filter(Boolean).join(" | ");

        setLessonMeta({
          topic,
          unitTitle: lesson?.unitTitle || null,
          pages: pages || null,
          label: label || null,
          notes: lesson?.notes || null,
          updatedBy: lesson?.updatedBy || null,
          effectiveDate: lesson?.effectiveDate || null,
          source: lesson
            ? "class-lesson-tracker"
            : focusTopic
              ? "student-topic"
              : null,
        });
      })
      .catch(() => {
        if (!active) return;
        setLessonMeta(null);
      })
      .finally(() => {
        if (active) setIsLessonLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSubject]);

  useEffect(() => {
    if (didAutoOpenRef.current) return;
    if (!requestedExerciseIdFromUrl || !isUuid(requestedExerciseIdFromUrl))
      return;
    if (isLoading) return;

    didAutoOpenRef.current = true;

    const openFromUrl = async () => {
      if (requestedOpenReviewFromUrl) {
        await openReviewForExerciseId(requestedExerciseIdFromUrl);
        return;
      }

      const match = exercises.find(
        (exercise) => exercise.id === requestedExerciseIdFromUrl,
      );
      if (match) {
        if (match.subject && match.subject !== selectedSubject) {
          setSelectedSubject(match.subject);
        }
        handleSelectExercise(match);
        return;
      }

      try {
        const { data } = await api.get(
          `/student/exercises/${requestedExerciseIdFromUrl}`,
        );
        const fetchedExercise = data?.exercise;
        if (!fetchedExercise?.id) throw new Error("Invalid exercise payload");
        if (
          fetchedExercise.subject &&
          fetchedExercise.subject !== selectedSubject
        ) {
          setSelectedSubject(fetchedExercise.subject);
        }
        handleSelectExercise(fetchedExercise);
      } catch (err) {
        console.error("Failed to open exercise", err);
        toast.error("Failed to open exercise.");
      }
    };

    openFromUrl();
  }, [
    requestedExerciseIdFromUrl,
    requestedOpenReviewFromUrl,
    isLoading,
    exercises,
    selectedSubject,
  ]);

  useEffect(() => {
    if (didHintToastRef.current) return;
    if (assignmentActionFromUrl !== "submit") return;
    didHintToastRef.current = true;
    toast.info("Open or continue an exercise, then click Submit All.");
  }, [assignmentActionFromUrl]);

  const performGenerateExercise = async ({
    topicOverride = "",
    weakAreaOverride = "",
    subjectOverride = "",
  } = {}) => {
    const requestedSubject = String(
      subjectOverride || selectedSubject || "",
    ).trim();
    if (!requestedSubject) {
      toast.error("Choose a subject before generating an exercise.");
      return;
    }
    setIsGenerating(true);
    try {
      const payload = {
        subject: requestedSubject,
        ...(String(topicOverride || "").trim()
          ? { topic: String(topicOverride || "").trim() }
          : {}),
        ...(String(weakAreaOverride || "").trim()
          ? { weakArea: String(weakAreaOverride || "").trim() }
          : {}),
      };
      const { data } = await api.post("/student/exercises/generate", payload);
      const createdExercise = data?.exercise;
      if (!createdExercise?.id) {
        throw new Error("Invalid exercise response.");
      }

      cacheExerciseContext(createdExercise);
      setExercises((prev) => [
        createdExercise,
        ...prev.filter((item) => item.id !== createdExercise.id),
      ]);
      handleSelectExercise(createdExercise);
      toast.success(
        createdExercise.generatedWith === "gemini"
          ? "AI exercise generated."
          : "Exercise generated.",
      );
    } catch (err) {
      console.error("Failed to generate exercise", err);
      const errorCode = err?.response?.data?.code;
      if (errorCode === "TOPIC_REQUIRED") {
        setIsTopicPromptOpen(true);
        toast.info(
          "No lesson topic is set yet for this subject. Enter the current topic once.",
        );
        return;
      }
      toast.error(err?.response?.data?.error || "Failed to generate exercise.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateNew = async () => {
    await performGenerateExercise({
      topicOverride: "",
      weakAreaOverride: requestedWeakAreaFromUrl,
    });
  };

  const filteredExercises = exercises.filter(
    (ex) =>
      (!selectedSubject || ex.subject === selectedSubject) &&
      (ex.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    if (!selectedExercise?.id) return;
    if (!isUuid(selectedExercise.id)) return;

    const updatedAt = Date.now();
    const timeout = setTimeout(() => {
      saveJsonToStorage(`${DRAFT_KEY_PREFIX}${selectedExercise.id}`, {
        updatedAt,
        activeQuestion,
        answers,
      });
      saveJsonToStorage(`${DRAFT_META_PREFIX}${selectedExercise.id}`, {
        id: selectedExercise.id,
        name: selectedExercise.name || "Exercise",
        subject: selectedExercise.subject || "",
        questionCount:
          Number(selectedExercise.questionCount) ||
          (Array.isArray(selectedExercise.questions)
            ? selectedExercise.questions.length
            : 0),
        updatedAt,
      });
      try {
        localStorage.setItem(LAST_DRAFT_KEY, selectedExercise.id);
      } catch {
        // ignore
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [
    selectedExercise?.id,
    selectedExercise?.name,
    selectedExercise?.subject,
    selectedExercise?.questionCount,
    activeQuestion,
    answers,
  ]);

  const handleSelectExercise = (exercise) => {
    const nextExercise = {
      ...exercise,
      questions: Array.isArray(exercise?.questions) ? exercise.questions : [],
    };

    setSelectedExercise(nextExercise);
    setIsGradingMenuOpen(false);
    setOpenQuestionMode("auto");

    const draft = nextExercise?.id ? loadDraft(nextExercise.id) : null;
    const draftAnswers =
      draft && draft.answers && typeof draft.answers === "object"
        ? draft.answers
        : {};
    const draftIndex = Number(draft?.activeQuestion);
    const safeIndex =
      Number.isFinite(draftIndex) && nextExercise.questions.length > 0
        ? Math.max(0, Math.min(nextExercise.questions.length - 1, draftIndex))
        : 0;

    setAnswers(draftAnswers);
    setActiveQuestion(safeIndex);
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
      const answersPayload = Object.entries(answers).map(
        ([questionId, text]) => ({
          questionId,
          answerText: text,
        }),
      );
      const { data } = await api.post(
        `/student/exercises/${selectedExercise.id}/submit`,
        {
          status,
          answers: answersPayload,
          openQuestionMode,
        },
      );
      if (status === "submitted") {
        const submission = data?.submission || {};
        clearDraft(selectedExercise.id);
        const selectedQuestions = Array.isArray(selectedExercise.questions)
          ? selectedExercise.questions
          : [];
        const fallbackQuestionCount = Number(selectedExercise.questionCount);
        const questionCount =
          selectedQuestions.length > 0
            ? selectedQuestions.length
            : Number.isFinite(fallbackQuestionCount) &&
                fallbackQuestionCount > 0
              ? Math.round(fallbackQuestionCount)
              : 0;
        const answeredCount =
          selectedQuestions.length > 0
            ? selectedQuestions.reduce((count, question) => {
                if (!question?.id) return count;
                const answerValue = answers[question.id];
                return String(answerValue || "").trim() ? count + 1 : count;
              }, 0)
            : Object.values(answers).reduce(
                (count, answerValue) =>
                  String(answerValue || "").trim() ? count + 1 : count,
                0,
              );

        setExercises((prev) =>
          prev.map((exercise) =>
            exercise.id === selectedExercise.id
              ? {
                  ...exercise,
                  submissionStatus: "submitted",
                  submissionScore:
                    submission.score === null || submission.score === undefined
                      ? (exercise.submissionScore ?? null)
                      : submission.score,
                  submittedAt:
                    submission.submittedAt || exercise.submittedAt || null,
                }
              : exercise,
          ),
        );

        setResultSummary({
          exerciseId: selectedExercise.id,
          exerciseName: selectedExercise.name || "Exercise",
          subject: selectedExercise.subject || "",
          score: submission.score ?? null,
          weakArea: submission.weakArea || null,
          aiFeedback: submission.aiFeedback || null,
          improvements: Array.isArray(submission.improvements)
            ? submission.improvements
            : [],
          manualReviewRequired: Boolean(submission.manualReviewRequired),
          manualReviewCount: Number(submission.manualReviewCount) || 0,
          openQuestionMode: submission.openQuestionMode || openQuestionMode,
          lessonContext: selectedExercise.lessonContext || null,
          references: Array.isArray(selectedExercise.references)
            ? selectedExercise.references
            : [],
          questionCount,
          answeredCount,
          submittedAt: submission.submittedAt || submission.createdAt || null,
        });
        setIsResultOpen(true);
        setSelectedExercise(null);
        setIsGradingMenuOpen(false);

        const scoreText =
          submission.score === null || submission.score === undefined
            ? "Submitted."
            : `Submitted. Score: ${submission.score}%.`;
        toast.success(scoreText);
      } else {
        setExercises((prev) =>
          prev.map((exercise) =>
            exercise.id === selectedExercise.id
              ? { ...exercise, submissionStatus: "in_progress" }
              : exercise,
          ),
        );
        toast.success("Progress saved.");
      }
    } catch (err) {
      console.error("Failed to submit exercise", err);
      toast.error(err?.response?.data?.error || "Failed to submit exercise.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSubmitConfirmation = () => {
    setIsSubmitConfirmOpen(true);
  };

  const confirmSubmitExercise = async () => {
    setIsSubmitConfirmOpen(false);
    await submitExercise("submitted");
  };

  const confirmTopicAndGenerate = async () => {
    const cleanTopic = String(topicInput || "").trim();
    if (!cleanTopic) {
      toast.error("Topic is required.");
      return;
    }
    setIsTopicPromptOpen(false);
    setTopicInput("");
    await performGenerateExercise({
      topicOverride: cleanTopic,
      weakAreaOverride: requestedWeakAreaFromUrl,
    });
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
    return (
      type.includes("choice") ||
      type.includes("multiple") ||
      type.includes("mcq")
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
        const label = raw.replace(/\s+/g, " ").trim();
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

  const extractQuestionMedia = (text) => {
    let workingText = String(text || "").trim();
    let imageUrl = "";

    const markerMatch = workingText.match(/\[IMAGE_URL:([^\]\s]+)\]/i);
    if (markerMatch?.[1]) {
      imageUrl = markerMatch[1];
      workingText = workingText.replace(markerMatch[0], "").trim();
    }

    if (!imageUrl) {
      const markdownMatch = workingText.match(/!\[[^\]]*]\(([^)\s]+)\)/i);
      if (markdownMatch?.[1]) {
        imageUrl = markdownMatch[1];
        workingText = workingText.replace(markdownMatch[0], "").trim();
      }
    }

    return {
      text: workingText,
      imageUrl: resolveMediaUrl(imageUrl),
    };
  };

  const normalizeChoiceValue = (value) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-H]/g, "")
      .slice(0, 1);

  const activeQuestionData = selectedExercise?.questions?.[activeQuestion] || {
    type: "Question",
    text: "No questions available.",
  };
  const estimatedMinutes = (() => {
    if (!selectedExercise) return 0;

    const directEstimate = Number(
      selectedExercise.estimatedMinutes ||
        selectedExercise.estimatedDurationMinutes,
    );
    if (Number.isFinite(directEstimate) && directEstimate > 0) {
      return Math.max(5, Math.min(240, Math.round(directEstimate)));
    }

    const questionList = Array.isArray(selectedExercise.questions)
      ? selectedExercise.questions
      : [];
    const difficulty = String(selectedExercise.difficulty || "")
      .trim()
      .toLowerCase();

    const difficultyFactor =
      difficulty.includes("hard") || difficulty.includes("advanced")
        ? 1.2
        : difficulty.includes("easy") || difficulty.includes("beginner")
          ? 0.85
          : 1;

    const byType = (question) => {
      const type = String(question?.type || "")
        .trim()
        .toLowerCase();
      if (type.includes("true") || type.includes("false")) return 1;
      if (
        type.includes("choice") ||
        type.includes("multiple") ||
        type.includes("mcq")
      )
        return 1.5;
      if (type.includes("essay")) return 4;
      if (type.includes("short") || type.includes("open")) return 3;
      return 2.25;
    };

    let baseMinutes = 0;
    if (questionList.length > 0) {
      baseMinutes = questionList.reduce((sum, q) => sum + byType(q), 0);
    } else {
      const qCount = Number(selectedExercise.questionCount);
      baseMinutes = Number.isFinite(qCount) && qCount > 0 ? qCount * 2.25 : 10;
    }

    return Math.max(
      5,
      Math.min(240, Math.round(baseMinutes * difficultyFactor)),
    );
  })();

  const activeQuestionMedia = extractQuestionMedia(activeQuestionData.text);
  const parsedChoice = isMultipleChoice(activeQuestionData)
    ? parseMultipleChoiceContent(activeQuestionMedia.text)
    : { prompt: String(activeQuestionMedia.text || ""), options: [] };
  const questionPrompt = parsedChoice.prompt;
  const questionOptions = parsedChoice.options;
  const questionImageUrl = activeQuestionMedia.imageUrl;
  const selectedAnswer = activeQuestionData.id
    ? answers[activeQuestionData.id] || ""
    : "";
  const normalizedSelectedChoice = normalizeChoiceValue(selectedAnswer);

  const lessonTopic = String(lessonMeta?.topic || "").trim();
  const reviewQuestions = Array.isArray(reviewPayload?.questions)
    ? reviewPayload.questions
    : [];
  const reviewActiveQuestion =
    reviewQuestions.length > 0
      ? reviewQuestions[
          Math.max(0, Math.min(reviewQuestions.length - 1, reviewActiveIndex))
        ]
      : null;
  const reviewQuestionMedia = extractQuestionMedia(
    reviewActiveQuestion?.prompt || reviewActiveQuestion?.text || "",
  );
  const reviewParsedChoice = parseMultipleChoiceContent(
    reviewQuestionMedia.text,
  );
  const reviewQuestionImageUrl = reviewQuestionMedia.imageUrl;
  const resultScoreValue = Number(resultSummary?.score);
  const hasResultScore = Number.isFinite(resultScoreValue);
  const resultScoreRounded = hasResultScore
    ? Math.round(resultScoreValue)
    : null;
  const resultQuestionCountRaw = Number(resultSummary?.questionCount);
  const resultAnsweredCountRaw = Number(resultSummary?.answeredCount);
  const resultQuestionCount =
    Number.isFinite(resultQuestionCountRaw) && resultQuestionCountRaw > 0
      ? Math.round(resultQuestionCountRaw)
      : 0;
  const resultAnsweredCount =
    Number.isFinite(resultAnsweredCountRaw) && resultAnsweredCountRaw >= 0
      ? Math.round(resultAnsweredCountRaw)
      : 0;
  const safeAnsweredCount =
    resultQuestionCount > 0
      ? Math.min(resultAnsweredCount, resultQuestionCount)
      : resultAnsweredCount;
  const resultCompletionRate =
    resultQuestionCount > 0
      ? Math.min(
          100,
          Math.round(
            (safeAnsweredCount / Math.max(resultQuestionCount, 1)) * 100,
          ),
        )
      : 0;
  const pendingReviewCount = Number(resultSummary?.manualReviewCount) || 0;
  const resultOpenQuestionModeLabel =
    String(resultSummary?.openQuestionMode || "")
      .trim()
      .toLowerCase() === "teacher_review"
      ? "Teacher Review"
      : "AI Fast Grading";
  const resultSubmittedAtLabel = (() => {
    const raw = String(resultSummary?.submittedAt || "").trim();
    if (!raw) return null;
    const parsedDate = new Date(raw);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.toLocaleString();
  })();
  const resultReviewStatusLabel = resultSummary?.manualReviewRequired
    ? pendingReviewCount > 0
      ? `Waiting for teacher review (${pendingReviewCount})`
      : "Waiting for teacher review"
    : "Fully graded";
  const resultStepTitles = [
    "Completion Snapshot",
    "Score and Review Status",
    "Next Improvement Focus",
  ];
  const totalResultSteps = resultStepTitles.length;
  const resultStepAnimationClass =
    resultStepDirection === "next"
      ? "animate-in fade-in-0 slide-in-from-right-2 duration-300"
      : "animate-in fade-in-0 slide-in-from-left-2 duration-300";

  useEffect(() => {
    if (!isResultOpen) return;
    setResultStepIndex(0);
    setResultStepDirection("next");
  }, [isResultOpen, resultSummary?.exerciseId]);

  const goToNextResultStep = () => {
    setResultStepDirection("next");
    setResultStepIndex((prev) => Math.min(prev + 1, totalResultSteps - 1));
  };

  const goToPreviousResultStep = () => {
    setResultStepDirection("back");
    setResultStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const openPlpFromResult = () => {
    setIsResultOpen(false);
    navigate("/student/plp");
  };

  const handlePracticeWeakAreaFromResult = async () => {
    const targetSubject = String(
      resultSummary?.subject || selectedSubject || "",
    ).trim();
    const targetWeakArea = String(resultSummary?.weakArea || "").trim();
    if (!targetSubject) {
      toast.error("No subject found for this recommendation.");
      return;
    }
    setSelectedSubject(targetSubject);
    setIsResultOpen(false);
    await performGenerateExercise({
      subjectOverride: targetSubject,
      weakAreaOverride: targetWeakArea,
    });
  };

  const openResultReview = async () => {
    const exerciseId = String(resultSummary?.exerciseId || "").trim();
    if (!exerciseId) return;
    setIsResultOpen(false);
    await openReviewForExerciseId(exerciseId);
  };

  const preventRestrictedAction = (event) => {
    event.preventDefault();
  };

  useEffect(() => {
    const handleRestrictedKeys = (event) => {
      const key = String(event.key || "").toLowerCase();
      if (
        (event.ctrlKey || event.metaKey) &&
        ["a", "c", "x", "u"].includes(key)
      ) {
        event.preventDefault();
        return;
      }
      if (event.key === "PrintScreen") {
        event.preventDefault();
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText("").catch(() => {});
        }
      }
    };

    document.addEventListener("keydown", handleRestrictedKeys);
    return () => {
      document.removeEventListener("keydown", handleRestrictedKeys);
    };
  }, []);

  if (isLoading) {
    return <StudentPageSkeleton variant="exercise" />;
  }

  return (
    <div
      className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none"
      onContextMenu={preventRestrictedAction}
      onCopy={preventRestrictedAction}
      onCut={preventRestrictedAction}
      onDragStart={preventRestrictedAction}
      onSelectStart={preventRestrictedAction}
    >
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
                  disabled={isGenerating || !selectedSubject}
                  className="flex items-center gap-2 px-6 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black text-sm shadow-lg shadow-blue-100 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  {isGenerating
                    ? "Generating..."
                    : requestedWeakAreaFromUrl
                      ? "Generate Focus Set"
                      : "Generate New"}
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

            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="w-full space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
                  {chipSubjects.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubject(sub)}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        selectedSubject === sub
                          ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                          : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}

                  <div className="relative w-64 flex-shrink-0 group">
                    <Search
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                      size={18}
                    />
                    <input
                      type="text"
                      value={subjectChipQuery}
                      onChange={(e) => setSubjectChipQuery(e.target.value)}
                      placeholder="Find subject..."
                      className="w-full pl-11 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] transition-all font-bold text-sm text-slate-700 shadow-sm"
                    />
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2D70FD]">
                      Current Topic
                    </p>
                    <p className="mt-1 text-lg font-black tracking-tight text-slate-900 truncate">
                      {isLessonLoading
                        ? "Loading lesson context..."
                        : lessonTopic || "No topic set yet"}
                    </p>
                  </div>

                  {requestedWeakAreaFromUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-50 text-[#2D70FD] rounded-lg text-[10px] font-black uppercase tracking-widest">
                        Focus
                      </span>
                      <span className="max-w-[18rem] truncate text-sm font-extrabold text-slate-800 tracking-tight">
                        {requestedWeakAreaFromUrl}
                      </span>
                    </div>
                  ) : null}
                </div>
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
                      className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all group shadow-sm h-full flex flex-col"
                    >
                      {(() => {
                        const status = String(
                          ex.submissionStatus || "",
                        ).toLowerCase();
                        const isCompleted = status === "submitted";
                        const isInProgress = status === "in_progress";
                        const score =
                          ex.submissionScore === null ||
                          ex.submissionScore === undefined
                            ? null
                            : Number(ex.submissionScore);
                        const badge = isCompleted
                          ? "Completed"
                          : isInProgress
                            ? "In progress"
                            : "New";
                        const badgeClass = isCompleted
                          ? "bg-emerald-50 text-emerald-600"
                          : isInProgress
                            ? "bg-blue-50 text-[#2D70FD]"
                            : "bg-slate-50 text-slate-400";

                        return (
                          <>
                            <div className="flex justify-between items-start mb-6">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                                <FileText size={28} />
                              </div>
                              <div
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${badgeClass}`}
                              >
                                {badge}
                              </div>
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-1">
                              <span className="block leading-snug min-h-[3.4rem] break-words">
                                {ex.name}
                              </span>
                            </h3>
                            <p className="text-sm font-bold text-slate-400 mb-6">
                              {ex.subject} | {ex.questionCount} Questions
                            </p>

                            <div className="mt-auto grid grid-cols-2 gap-3">
                              <button
                                onClick={() =>
                                  isCompleted
                                    ? openReviewForExerciseId(ex.id)
                                    : handleSelectExercise(ex)
                                }
                                className="py-4 bg-blue-50 text-[#2D70FD] rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                              >
                                {isCompleted ? (
                                  <>
                                    <FileText size={18} /> Review
                                  </>
                                ) : (
                                  <>
                                    <Activity size={18} />{" "}
                                    {isInProgress ? "Continue" : "Solve"}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => downloadExercise(ex)}
                                disabled={isDownloading}
                                className="py-4 bg-[#2D70FD] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                              >
                                <Printer size={18} /> Print
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                  {filteredExercises.map((ex, idx) => (
                    <div
                      key={ex.id}
                      className={`flex items-start justify-between gap-4 p-6 ${idx !== filteredExercises.length - 1 ? "border-b border-slate-100" : ""} hover:bg-slate-50 transition-colors`}
                    >
                      <div className="flex items-start gap-5 min-w-0">
                        <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-xl flex items-center justify-center">
                          <FileText size={22} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 break-words">
                            {ex.name}
                          </h4>
                          <p className="text-xs font-bold text-slate-400 break-words">
                            {ex.subject} | {ex.questionCount} Questions |{" "}
                            {ex.date}
                          </p>
                          {(() => {
                            const status = String(
                              ex.submissionStatus || "",
                            ).toLowerCase();
                            const isCompleted = status === "submitted";
                            const isInProgress = status === "in_progress";
                            const score =
                              ex.submissionScore === null ||
                              ex.submissionScore === undefined
                                ? null
                                : Number(ex.submissionScore);
                            const badge = isCompleted
                              ? "Completed"
                              : isInProgress
                                ? "In progress"
                                : "New";
                            const badgeClass = isCompleted
                              ? "bg-emerald-50 text-emerald-600"
                              : isInProgress
                                ? "bg-blue-50 text-[#2D70FD]"
                                : "bg-slate-50 text-slate-400";
                            return (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${badgeClass}`}
                                >
                                  {badge}
                                </span>
                                {isCompleted && Number.isFinite(score) ? (
                                  <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600">
                                    Score: {Math.round(score)}%
                                  </span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 self-center">
                        <button
                          onClick={() => {
                            const status = String(
                              ex.submissionStatus || "",
                            ).toLowerCase();
                            if (status === "submitted") {
                              openReviewForExerciseId(ex.id);
                              return;
                            }
                            handleSelectExercise(ex);
                          }}
                          className="px-6 py-2.5 bg-blue-50 text-[#2D70FD] rounded-xl font-black text-xs"
                        >
                          {String(ex.submissionStatus || "").toLowerCase() ===
                          "submitted"
                            ? "Review"
                            : String(
                                  ex.submissionStatus || "",
                                ).toLowerCase() === "in_progress"
                              ? "Continue"
                              : "Solve"}
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
                    <span className="text-xs font-bold">
                      Est: {estimatedMinutes} Min
                      {estimatedMinutes === 1 ? "" : "s"}
                    </span>
                  </div>
                  {(() => {
                    const topicNumber =
                      selectedExercise.lessonContext?.lessonNumber || null;
                    const unitName = String(
                      selectedExercise.lessonContext?.unitTitle || "",
                    ).trim();
                    if (!topicNumber && !unitName) return null;
                    return (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#2D70FD]">
                          Current Lesson
                        </p>
                        <div className="mt-2 space-y-1.5">
                          <p className="text-xs font-bold text-slate-700 break-words">
                            Topic Number: {topicNumber || "--"}
                          </p>
                          <p className="text-xs font-bold text-slate-700 break-words">
                            Unit Name: {unitName || "--"}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-4 gap-3">
                    {selectedExercise.questions.map((q, idx) => (
                      <button
                        key={q.id}
                        onClick={() => setActiveQuestion(idx)}
                        className={`h-12 rounded-2xl border flex items-center justify-center transition-all ${
                          activeQuestion === idx
                            ? "border-[#2D70FD] bg-blue-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
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
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-white border-t border-slate-100">
                  <button
                    onClick={requestSubmitConfirmation}
                    disabled={isSubmitting}
                    className="w-full py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} /> Submit All
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-white">
                <div className="p-8 flex justify-between items-center border-b border-slate-50">
                  <span className="text-sm font-extrabold text-slate-700 tracking-wide">
                    Practice
                  </span>
                  <button
                    onClick={() => {
                      setSelectedExercise(null);
                      setIsGradingMenuOpen(false);
                    }}
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
                      {questionImageUrl ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <img
                            src={questionImageUrl}
                            alt="Question visual"
                            className="h-auto max-h-[20rem] w-full object-contain bg-white"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <h4 className="text-2xl font-extrabold text-slate-800 leading-snug whitespace-pre-line">
                        {questionPrompt || activeQuestionMedia.text}
                      </h4>
                    </div>

                    <div className="space-y-4">
                      {isMultipleChoice(activeQuestionData) &&
                      questionOptions.length > 0 ? (
                        <div className="space-y-3">
                          {questionOptions.map((option) => {
                            const isSelected =
                              normalizedSelectedChoice === option.key ||
                              String(selectedAnswer || "").trim() ===
                                option.label;
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
                                className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl border transition-all ${
                                  isSelected
                                    ? "border-[#2D70FD] bg-white shadow-sm"
                                    : "border-slate-200 bg-slate-50 hover:bg-white"
                                } ${!activeQuestionData.id ? "opacity-60" : ""}`}
                              >
                                <span
                                  className={`min-w-9 h-9 rounded-xl border text-xs font-black flex items-center justify-center ${
                                    isSelected
                                      ? "border-[#2D70FD] bg-[#2D70FD] text-white"
                                      : "border-slate-300 bg-white text-slate-500"
                                  }`}
                                >
                                  {option.key}
                                </span>
                                <span className="flex-1 text-sm font-semibold text-slate-700 text-left leading-relaxed break-words">
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

                <div className="p-8 border-t border-slate-50 flex flex-col gap-4 bg-slate-50/50">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Open Question Grading
                    </label>
                    <div
                      ref={gradingMenuRef}
                      className="relative w-full sm:w-80"
                    >
                      <button
                        type="button"
                        onClick={() => setIsGradingMenuOpen((prev) => !prev)}
                        className={`w-full rounded-2xl border bg-white px-4 py-3 text-left transition-all ${
                          isGradingMenuOpen
                            ? "border-[#2D70FD] ring-2 ring-blue-100"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                        aria-haspopup="listbox"
                        aria-expanded={isGradingMenuOpen}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-black text-slate-800">
                            {selectedGradingMode.label}
                          </p>
                          <ChevronDown
                            size={16}
                            className={`shrink-0 text-slate-400 transition-transform ${
                              isGradingMenuOpen
                                ? "rotate-180 text-[#2D70FD]"
                                : ""
                            }`}
                          />
                        </div>
                      </button>

                      {isGradingMenuOpen ? (
                        <div
                          role="listbox"
                          className="absolute left-0 right-0 bottom-[calc(100%+0.5rem)] z-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
                        >
                          {gradingModeOptions.map((option) => {
                            const isActive = option.value === openQuestionMode;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setOpenQuestionMode(option.value);
                                  setIsGradingMenuOpen(false);
                                }}
                                className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition-all last:mb-0 ${
                                  isActive
                                    ? "bg-blue-50 text-[#2D70FD]"
                                    : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <p className="text-sm font-bold">
                                  {option.label}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isResultOpen && resultSummary ? (
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 md:p-6">
            <div
              className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
              onClick={() => setIsResultOpen(false)}
            />
            <div className="relative w-full max-w-[1100px] aspect-[11/10] max-h-[86vh] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="flex h-full flex-col md:flex-row">
                <div className="w-full md:w-[36%] bg-slate-50 border-r border-slate-200 flex flex-col">
                  <div className="p-6 flex justify-end">
                    <button
                      onClick={() => setIsResultOpen(false)}
                      className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="flex-1 px-8 pb-8 flex flex-col items-center justify-center text-center">
                    <div className="h-28 w-28 rounded-full bg-[#2D70FD] text-white flex items-center justify-center shadow-lg shadow-blue-200">
                      <CheckCircle2 size={54} />
                    </div>
                    <h3 className="mt-7 text-3xl font-black text-slate-900">
                      Exercise Submitted
                    </h3>
                    <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 max-w-xs">
                      Great work. Follow the summary steps and continue
                      improving your weak area.
                    </p>
                  </div>
                </div>

                <div className="flex-1 bg-white p-6 md:p-8 overflow-y-auto">
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2D70FD]">
                        Result Summary
                      </p>
                      <h4 className="mt-2 text-2xl font-black text-slate-900 break-words">
                        {resultSummary.exerciseName}
                      </h4>
                      <p className="mt-1 text-sm font-semibold text-slate-500 break-words">
                        {resultSummary.subject || "Subject"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="inline-flex items-center gap-3">
                          <span className="h-7 w-7 rounded-full bg-slate-100 text-[#2D70FD] text-xs font-black flex items-center justify-center">
                            {resultStepIndex + 1}
                          </span>
                          <p className="text-sm font-black text-slate-800">
                            {resultStepTitles[resultStepIndex]}
                          </p>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Step {resultStepIndex + 1} of {totalResultSteps}
                        </p>
                      </div>

                      <div
                        key={`result-step-${resultStepIndex}`}
                        className={`mt-4 ${resultStepAnimationClass}`}
                      >
                        {resultStepIndex === 0 ? (
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                Questions done
                              </p>
                              <p className="mt-1 text-lg font-black text-slate-800">
                                {resultQuestionCount > 0
                                  ? `${safeAnsweredCount}/${resultQuestionCount}`
                                  : safeAnsweredCount}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                                Completion
                              </p>
                              <p className="mt-1 text-lg font-black text-[#2D70FD]">
                                {resultCompletionRate}%
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {resultStepIndex === 1 ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <p className="font-semibold text-slate-500">
                                Total Score
                              </p>
                              <p className="font-black text-[#2D70FD]">
                                {hasResultScore
                                  ? `${resultScoreRounded}%`
                                  : "Pending"}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <p className="font-semibold text-slate-500">
                                Review status
                              </p>
                              <p className="font-black text-slate-800 text-right">
                                {resultReviewStatusLabel}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <p className="font-semibold text-slate-500">
                                Grading mode
                              </p>
                              <p className="font-black text-slate-800 text-right">
                                {resultOpenQuestionModeLabel}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <p className="font-semibold text-slate-500">
                                Submitted at
                              </p>
                              <p className="font-black text-slate-800 text-right">
                                {resultSubmittedAtLabel || "Saved"}
                              </p>
                            </div>
                          </div>
                        ) : null}

                        {resultStepIndex === 2 ? (
                          <div className="text-center">
                            <p className="text-sm font-semibold text-slate-500">
                              Weak area
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-800 break-words">
                              {resultSummary.weakArea || "None detected"}
                            </p>
                            {Array.isArray(resultSummary.improvements) &&
                            resultSummary.improvements.length > 0 ? (
                              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 text-left">
                                {resultSummary.improvements
                                  .slice(0, 3)
                                  .map((item, index) => (
                                    <p
                                      key={`${item}-${index}`}
                                      className="text-xs font-semibold text-slate-700 break-words"
                                    >
                                      {index + 1}. {item}
                                    </p>
                                  ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-5 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={goToPreviousResultStep}
                          disabled={resultStepIndex === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-[#2D70FD] text-xs font-black hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} /> Back
                        </button>

                        {resultStepIndex < totalResultSteps - 1 ? (
                          <button
                            type="button"
                            onClick={goToNextResultStep}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D70FD] text-white text-xs font-black hover:bg-[#1E5CE0]"
                          >
                            Next <ChevronRight size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsResultOpen(false)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D70FD] text-white text-xs font-black hover:bg-[#1E5CE0]"
                          >
                            Finish
                          </button>
                        )}
                      </div>
                    </div>

                    {resultStepIndex === totalResultSteps - 1 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          onClick={openResultReview}
                          className="px-4 py-3 rounded-xl bg-[#2D70FD] text-white text-sm font-black hover:bg-[#1E5CE0] transition-colors"
                        >
                          Review Answers
                        </button>
                        <button
                          onClick={openPlpFromResult}
                          className="px-4 py-3 rounded-xl border border-slate-200 bg-white text-[#2D70FD] text-sm font-black hover:bg-slate-50 transition-colors"
                        >
                          Open PLP
                        </button>
                        <button
                          onClick={handlePracticeWeakAreaFromResult}
                          disabled={isGenerating}
                          className="sm:col-span-2 px-4 py-3 rounded-xl bg-[#2D70FD] text-white text-sm font-black hover:bg-[#1E5CE0] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {isGenerating ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Sparkles size={16} />
                          )}
                          Practice Weak Area
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isReviewOpen ? (
          <div className="fixed inset-0 z-[114] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                if (!isReviewLoading) setIsReviewOpen(false);
              }}
            />
            <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in duration-300">
              <div className="w-full md:w-80 bg-slate-50 border-r border-slate-100 flex flex-col">
                <div className="p-8 border-b border-slate-200 bg-white space-y-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Review Mode
                  </p>
                  <h3 className="font-black text-slate-800 text-xl leading-tight break-words">
                    {reviewPayload?.exercise?.name || "Exercise Review"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#2D70FD]">
                      {reviewPayload?.submission?.score === null ||
                      reviewPayload?.submission?.score === undefined
                        ? "Score pending"
                        : `Score ${Math.round(Number(reviewPayload?.submission?.score) || 0)}%`}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        reviewPayload?.submission?.reviewStatus ===
                        "waiting_teacher_review"
                          ? "bg-gray-200 text-gray-700"
                          : reviewPayload?.submission?.reviewStatus ===
                            "teacher_graded"
                            ? "bg-sky-100 text-sky-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {reviewPayload?.submission?.reviewStatus ===
                      "waiting_teacher_review"
                        ? "Waiting teacher review"
                        : reviewPayload?.submission?.reviewStatus ===
                          "teacher_graded"
                          ? "Teacher graded"
                        : "AI graded"}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-4 gap-3">
                    {reviewQuestions.map((question, index) => (
                      <button
                        key={question.id || index}
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
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {index + 1}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-white">
                <div className="p-8 flex justify-between items-center border-b border-slate-50">
                  <p className="text-sm font-extrabold text-slate-700 tracking-wide">
                    Practice
                  </p>
                  <button
                    onClick={() => setIsReviewOpen(false)}
                    className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-12">
                  {isReviewLoading ? (
                    <div className="h-full min-h-[320px] flex items-center justify-center">
                      <Loader2
                        size={34}
                        className="animate-spin text-[#2D70FD]"
                      />
                    </div>
                  ) : !reviewActiveQuestion ? (
                    <div className="h-full min-h-[320px] flex items-center justify-center text-sm font-bold text-slate-500">
                      No review data available.
                    </div>
                  ) : (
                    <div className="max-w-2xl mx-auto space-y-8">
                      <div className="space-y-4">
                        <span className="px-3 py-1 bg-blue-50 text-[#2D70FD] text-[10px] font-black rounded-lg uppercase">
                          {reviewActiveQuestion.type || "Question"}
                        </span>
                        {reviewQuestionImageUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <img
                              src={reviewQuestionImageUrl}
                              alt="Question visual"
                              className="h-auto max-h-[20rem] w-full object-contain bg-white"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        <h4 className="text-2xl font-extrabold text-slate-800 leading-snug whitespace-pre-line">
                          {reviewParsedChoice.prompt ||
                            reviewQuestionMedia.text}
                        </h4>
                      </div>

                      {Array.isArray(reviewParsedChoice.options) &&
                      reviewParsedChoice.options.length > 0 ? (
                        <div className="space-y-3">
                          {reviewParsedChoice.options.map((option) => {
                            const studentChoice = normalizeChoiceValue(
                              reviewActiveQuestion.studentAnswer,
                            );
                            const correctChoice = normalizeChoiceValue(
                              reviewActiveQuestion.correctAnswer,
                            );
                            const isStudent = studentChoice === option.key;
                            const isCorrect = correctChoice === option.key;
                            const isWrongStudent = isStudent && !isCorrect;
                            return (
                              <div
                                key={option.key}
                                className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl border ${
                                  isCorrect
                                    ? "border-emerald-200 bg-emerald-50"
                                    : isWrongStudent
                                      ? "border-red-200 bg-red-50"
                                      : "border-slate-200 bg-slate-50"
                                }`}
                              >
                                <span
                                  className={`min-w-9 h-9 rounded-xl border text-xs font-black flex items-center justify-center ${
                                    isCorrect
                                      ? "border-emerald-500 bg-emerald-500 text-white"
                                      : isWrongStudent
                                        ? "border-red-500 bg-red-500 text-white"
                                        : "border-slate-300 bg-white text-slate-500"
                                  }`}
                                >
                                  {option.key}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-700 leading-relaxed break-words">
                                    {option.label}
                                  </p>
                                  <div className="mt-2 flex items-center flex-wrap gap-2">
                                    {isCorrect ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        <CheckCircle2 size={12} />
                                        Correct answer
                                      </span>
                                    ) : null}
                                    {isWrongStudent ? (
                                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                        Your answer
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                {isCorrect ? (
                                  <CheckCircle2
                                    size={20}
                                    className="shrink-0 text-emerald-600 mt-0.5"
                                  />
                                ) : isWrongStudent ? (
                                  <XCircle
                                    size={20}
                                    className="shrink-0 text-red-600 mt-0.5"
                                  />
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-100 bg-white p-5">
                          <p className="text-xs font-semibold text-slate-500">
                            Your Answer
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-700 break-words whitespace-pre-line">
                            {String(
                              reviewActiveQuestion.studentAnswer || "",
                            ).trim() || "No answer submitted"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-white p-5">
                          <p className="text-xs font-semibold text-slate-500">
                            Correct Answer
                          </p>
                          <p className="mt-2 text-sm font-bold text-slate-700 break-words whitespace-pre-line">
                            {String(
                              reviewActiveQuestion.correctAnswer || "",
                            ).trim() ||
                              (reviewActiveQuestion.needsTeacherReview
                                ? "Pending teacher mark"
                                : "Not provided")}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`rounded-2xl border p-5 ${
                          reviewActiveQuestion.needsTeacherReview
                            ? "border-gray-300 bg-gray-100"
                            : reviewActiveQuestion.isCorrect
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-blue-100 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {reviewActiveQuestion.needsTeacherReview ? (
                            <Clock size={18} className="text-gray-700 mt-0.5" />
                          ) : reviewActiveQuestion.isCorrect ? (
                            <CheckCircle2
                              size={18}
                              className="text-emerald-600 mt-0.5"
                            />
                          ) : (
                            <XCircle
                              size={18}
                              className="text-[#2D70FD] mt-0.5"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-600">
                              Feedback
                            </p>
                            <p className="mt-2 text-sm font-bold text-slate-700 break-words">
                              {reviewActiveQuestion.feedback ||
                                (reviewActiveQuestion.needsTeacherReview
                                  ? "Pending teacher mark."
                                  : "Review completed.")}
                            </p>
                            <p className="mt-2 text-xs font-semibold text-slate-500">
                              Points: {reviewActiveQuestion.earnedPoints || 0}/
                              {reviewActiveQuestion.points || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isTopicPromptOpen ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                if (!isGenerating) setIsTopicPromptOpen(false);
              }}
            />
            <div className="relative w-full max-w-md rounded-[2rem] bg-white border border-slate-100 shadow-2xl p-8">
              <h3 className="text-2xl font-black text-slate-900">
                Current Topic Required
              </h3>
              <p className="mt-3 text-sm font-medium text-slate-500">
                No lesson tracker entry exists for this subject yet. Enter the
                topic you are currently learning, and we will remember it.
              </p>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Example: Fractions and ratios"
                className="mt-5 w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-[#2D70FD] text-sm font-medium text-slate-700"
              />
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setIsTopicPromptOpen(false)}
                  disabled={isGenerating}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmTopicAndGenerate}
                  disabled={isGenerating}
                  className="px-5 py-3 rounded-xl bg-[#2D70FD] text-white font-black disabled:opacity-60"
                >
                  Save Topic & Generate
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isSubmitConfirmOpen && selectedExercise && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => {
                if (!isSubmitting) setIsSubmitConfirmOpen(false);
              }}
            />
            <div className="relative w-full max-w-md rounded-[2rem] bg-white border border-slate-100 shadow-2xl p-8">
              <h3 className="text-2xl font-black text-slate-900">
                Submit Exercise?
              </h3>
              <p className="mt-3 text-sm font-medium text-slate-500">
                Are you sure you want to submit this exercise now? You can still
                save progress if you are not done.
              </p>
              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setIsSubmitConfirmOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSubmitExercise}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-xl bg-[#2D70FD] text-white font-black flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Exercise;
