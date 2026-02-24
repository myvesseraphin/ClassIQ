import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import PDFDocument from "pdfkit";
import { query } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { aiLimiter, uploadLimiter } from "../middleware/rateLimit.js";
import { logAudit } from "../utils/audit.js";
import {
  analyzeExerciseSubmissionWithGemini,
  generateExerciseWithGemini,
} from "../utils/gemini.js";

dotenv.config();

const router = express.Router();

router.use(requireAuth, requireRole(["student"]));

const uploadDir = path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 40);
    const stamp = Date.now();
    cb(null, `${safeBase || "avatar"}-${stamp}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed."));
    }
    return cb(null, true);
  },
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_REGEX.test(value || "");

const formatShortDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const formatTime = (value) => (value ? String(value).slice(0, 5) : null);

const formatTimeRange = (start, end) => {
  const startValue = formatTime(start);
  const endValue = formatTime(end);
  if (!startValue || !endValue) return null;
  return `${startValue} - ${endValue}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined) return null;
  return `${value}%`;
};

const parseTermNumber = (value) => {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRanking = (avgScore) => {
  if (avgScore === null || avgScore === undefined) {
    return "Ranking unavailable";
  }
  if (avgScore >= 85) return "Top Performer";
  if (avgScore >= 70) return "On Track";
  return "Needs Support";
};

const buildResourceUrl = (row) => {
  if (row.url) return row.url;
  if (row.bucket && row.filePath && process.env.SUPABASE_URL) {
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${row.bucket}/${row.filePath}`;
  }
  return null;
};

const timeAgo = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
};

const sanitizeFilename = (value) =>
  String(value || "exercise")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "exercise";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildIdentityTokens = ({ studentName, email }) => {
  const skipTokens = new Set([
    "gmail",
    "yahoo",
    "outlook",
    "hotmail",
    "icloud",
    "mail",
    "com",
    "org",
    "net",
    "rw",
    "co",
    "ac",
  ]);

  const tokens = new Set();
  const pushToken = (value) => {
    const cleaned = String(value || "")
      .trim()
      .toLowerCase();
    if (cleaned.length < 3) return;
    if (skipTokens.has(cleaned)) return;
    tokens.add(cleaned);
  };

  const fullName = String(studentName || "").trim();
  if (fullName) {
    pushToken(fullName);
    fullName
      .split(/[^a-z0-9]+/gi)
      .map((part) => part.trim())
      .forEach(pushToken);
  }

  const emailValue = String(email || "").trim().toLowerCase();
  if (emailValue) {
    const local = emailValue.split("@")[0] || "";
    if (local) {
      pushToken(local);
      local
        .split(/[^a-z0-9]+/gi)
        .map((part) => part.trim())
        .forEach(pushToken);
    }
  }

  return Array.from(tokens).sort((a, b) => b.length - a.length);
};

const sanitizeExerciseTitle = ({
  title,
  subject,
  weakArea,
  studentName,
  email,
}) => {
  let cleaned = String(title || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const identityTokens = buildIdentityTokens({ studentName, email });
  for (const token of identityTokens) {
    const pattern = new RegExp(`\\b${escapeRegex(token)}(?:'s)?\\b`, "gi");
    cleaned = cleaned.replace(pattern, " ");
  }

  cleaned = cleaned
    .replace(/\s+/g, " ")
    .replace(/\s*[-|,:;]+\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\-|,:;\s]+|[\-|,:;\s]+$/g, "")
    .trim();

  if (cleaned.length < 4) {
    const safeSubject = String(subject || "Subject").trim() || "Subject";
    const safeWeakArea = String(weakArea || "").trim();
    return safeWeakArea
      ? `${safeSubject} Practice - ${safeWeakArea}`.slice(0, 180)
      : `${safeSubject} Practice`.slice(0, 180);
  }

  return cleaned.slice(0, 180);
};

const clamp = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDifficultyLabel = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("begin")) return "Beginner";
  if (normalized.includes("advanced")) return "Advanced";
  return "Intermediate";
};

const DIVERSE_QUESTION_COUNT_POOLS = {
  Beginner: [5, 6, 7, 8, 9],
  Intermediate: [6, 7, 8, 9, 10, 12],
  Advanced: [8, 9, 10, 12, 14, 16],
};

const pickRandomQuestionCount = (pool) => {
  const safePool = Array.isArray(pool) && pool.length > 0 ? pool : [8];
  return safePool[Math.floor(Math.random() * safePool.length)];
};

const resolveRequestedQuestionCount = async ({
  userId,
  subject,
  requestedCount,
  difficulty,
}) => {
  const explicitCount = toNumberOrNull(requestedCount);
  if (explicitCount !== null) {
    return clamp(explicitCount, 3, 20);
  }

  const normalizedDifficulty = normalizeDifficultyLabel(difficulty);
  const basePool =
    DIVERSE_QUESTION_COUNT_POOLS[normalizedDifficulty] ||
    DIVERSE_QUESTION_COUNT_POOLS.Intermediate;
  const safePool = basePool.filter((count) => count >= 3 && count <= 20);

  try {
    const { rows } = await query(
      `SELECT question_count AS "questionCount"
         FROM exercises
        WHERE user_id = $1
          AND ($2::text IS NULL OR lower(subject) = lower($2))
        ORDER BY exercise_date DESC NULLS LAST, created_at DESC
        LIMIT 8`,
      [userId, subject || null],
    );
    const recentCounts = new Set(
      rows
        .map((row) => toNumberOrNull(row.questionCount))
        .filter((value) => value !== null)
        .map((value) => clamp(value, 3, 20)),
    );
    const unseenPool = safePool.filter((count) => !recentCounts.has(count));
    return pickRandomQuestionCount(unseenPool.length > 0 ? unseenPool : safePool);
  } catch (_) {
    return pickRandomQuestionCount(safePool);
  }
};

const inferWeakArea = ({ subject, gradePercent }) => {
  const normalizedSubject = String(subject || "General").toLowerCase();

  if (gradePercent >= 80) {
    return `${subject || "Subject"} extension challenge`;
  }

  if (normalizedSubject.includes("math")) {
    return "fractions and operation accuracy";
  }
  if (normalizedSubject.includes("english")) {
    return "reading comprehension details";
  }
  if (normalizedSubject.includes("science")) {
    return "concept explanation and vocabulary";
  }
  if (normalizedSubject.includes("history")) {
    return "cause and effect reasoning";
  }
  if (normalizedSubject.includes("geography")) {
    return "map interpretation and evidence use";
  }

  return gradePercent < 50
    ? "core concept understanding"
    : "application in extended tasks";
};

const buildExerciseImprovementSuggestions = ({ subject, weakArea, score }) => {
  const baseSubject = subject || "this subject";
  const target = weakArea || "core concept understanding";
  if (score >= 80) {
    return [
      `Practice one advanced problem on ${target} each day in ${baseSubject}.`,
      "Explain your reasoning out loud before final answers.",
      "Do one weekly self-check quiz to keep mastery stable.",
    ];
  }
  if (score >= 60) {
    return [
      `Review ${target} with two worked examples before practice.`,
      "After each answer, verify steps and correct misconceptions immediately.",
      "Complete a short diagnostic set and revisit missed items.",
    ];
  }
  return [
    `Relearn ${target} from the class notes and the Books resources.`,
    "Practice in small sets and ask for feedback after each set.",
    "Use correction review: rewrite each wrong answer with the correct method.",
  ];
};

const inferPlpStatus = (score) => {
  const safeScore = Number(score);
  if (!Number.isFinite(safeScore)) return "Needs Support";
  if (safeScore >= 80) return "On Track";
  if (safeScore >= 60) return "Developing";
  return "Needs Support";
};

const subjectToken = (value, max = 6) =>
  String(value || "SUBJ")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, max) || "SUBJ";

const buildPlpVersionCode = ({ subject, assessmentId, assessmentDate }) => {
  const dateCode = String(formatIsoDate(assessmentDate || new Date()) || "")
    .replace(/[^0-9]/g, "")
    .slice(0, 8);
  const assessmentToken = String(assessmentId || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 8);
  const safeDateCode = dateCode || formatIsoDate(new Date()).replace(/-/g, "");
  const safeAssessmentToken =
    assessmentToken || Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PLP-${subjectToken(subject)}-${safeDateCode}-${safeAssessmentToken}`;
};

const buildDetailedExercisePlpFeedback = ({
  subject,
  exerciseName,
  score,
  weakArea,
  improvements = [],
  aiFeedback,
}) => {
  const safeSubject = String(subject || "Subject").trim() || "Subject";
  const safeExercise = String(exerciseName || "Exercise").trim() || "Exercise";
  const safeWeakArea = String(weakArea || "core concepts").trim();
  const normalizedScore = Number.isFinite(Number(score))
    ? Math.max(0, Math.min(100, Math.round(Number(score))))
    : null;
  const safeImprovements = Array.isArray(improvements)
    ? improvements
        .map((item) => String(item || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  const insightSummary =
    normalizedScore === null
      ? "Performance is pending review."
      : normalizedScore >= 80
        ? "Strong mastery with potential for extension practice."
        : normalizedScore >= 60
          ? "Partial mastery with targeted reinforcement needed."
          : "Foundational understanding needs immediate support.";

  return [
    `Assessment context: ${safeExercise} (${safeSubject}).`,
    normalizedScore === null
      ? "Score snapshot: pending."
      : `Score snapshot: ${normalizedScore}%.`,
    `Mastery signal: ${insightSummary}`,
    `Primary weak area: ${safeWeakArea}.`,
    safeImprovements.length
      ? `Recommended actions: ${safeImprovements.join("; ")}.`
      : null,
    String(aiFeedback || "").trim() ? `AI insight: ${String(aiFeedback).trim()}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
};

const normalizeComparableText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeChoiceToken = (value) => {
  const direct = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-H]/g, "");
  if (direct) return direct[0];
  return "";
};

const isMultipleChoiceType = (value) => {
  const type = String(value || "").toLowerCase();
  return (
    type.includes("choice") ||
    type.includes("multiple") ||
    type.includes("mcq")
  );
};

const isTrueFalseType = (value) => {
  const type = String(value || "").toLowerCase();
  return (
    type.includes("true/false") ||
    type.includes("true false") ||
    type.includes("boolean")
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

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "their",
  "they",
  "them",
  "you",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "can",
  "could",
  "will",
  "would",
  "about",
  "then",
  "than",
  "what",
  "when",
  "where",
  "which",
  "while",
  "also",
  "not",
  "only",
  "one",
  "two",
  "three",
  "four",
  "five",
]);

const tokenizeForOverlap = (value) =>
  normalizeComparableText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const scoreOpenEndedAnswer = (submittedAnswer, correctAnswer, points) => {
  const maxPoints = Number.isFinite(points) ? points : 1;
  const submittedText = normalizeComparableText(submittedAnswer);
  if (!submittedText) {
    return { earnedPoints: 0, isCorrect: false, needsTeacherReview: false };
  }

  const expectedText = normalizeComparableText(correctAnswer);
  if (!expectedText) {
    return {
      earnedPoints: 0,
      isCorrect: false,
      needsTeacherReview: true,
    };
  }

  if (submittedText === expectedText) {
    return {
      earnedPoints: maxPoints,
      isCorrect: true,
      needsTeacherReview: false,
    };
  }

  const expectedTokens = Array.from(new Set(tokenizeForOverlap(correctAnswer)));
  const submittedTokens = new Set(tokenizeForOverlap(submittedAnswer));

  if (expectedTokens.length === 0) {
    const includesExpected =
      submittedText.includes(expectedText) || expectedText.includes(submittedText);
    const earnedPoints = includesExpected ? maxPoints * 0.8 : maxPoints * 0.3;
    return {
      earnedPoints,
      isCorrect: earnedPoints >= maxPoints * 0.95,
      needsTeacherReview: earnedPoints >= maxPoints * 0.35 && earnedPoints < maxPoints * 0.75,
    };
  }

  let overlap = 0;
  expectedTokens.forEach((token) => {
    if (submittedTokens.has(token)) overlap += 1;
  });
  const overlapRatio = overlap / expectedTokens.length;

  let scoreRatio = 0.15;
  if (overlapRatio >= 0.8) scoreRatio = 1;
  else if (overlapRatio >= 0.6) scoreRatio = 0.75;
  else if (overlapRatio >= 0.4) scoreRatio = 0.55;
  else if (overlapRatio >= 0.25) scoreRatio = 0.35;

  const earnedPoints = maxPoints * scoreRatio;
  return {
    earnedPoints,
    isCorrect: scoreRatio >= 0.95,
    needsTeacherReview: scoreRatio >= 0.35 && scoreRatio < 0.8,
  };
};

const gradeExerciseQuestion = ({
  questionType,
  submittedAnswer,
  correctAnswer,
  points,
  manualReviewOpenQuestions = false,
}) => {
  const safePoints = Number.isFinite(points) ? points : 1;
  const submittedText = String(submittedAnswer || "").trim();
  if (!submittedText) {
    return {
      countInScore: true,
      earnedPoints: 0,
      isCorrect: false,
      needsTeacherReview: false,
      mode: "auto",
    };
  }

  if (manualReviewOpenQuestions && isOpenEndedType(questionType)) {
    return {
      countInScore: false,
      earnedPoints: 0,
      isCorrect: false,
      needsTeacherReview: true,
      mode: "teacher_review",
    };
  }

  if (!String(correctAnswer || "").trim()) {
    return {
      countInScore: false,
      earnedPoints: 0,
      isCorrect: false,
      needsTeacherReview: isOpenEndedType(questionType),
      mode: "auto",
    };
  }

  if (isMultipleChoiceType(questionType)) {
    const submittedChoice = normalizeChoiceToken(submittedText);
    const correctChoice = normalizeChoiceToken(correctAnswer);
    const isCorrect =
      (submittedChoice && correctChoice && submittedChoice === correctChoice) ||
      normalizeComparableText(submittedText) === normalizeComparableText(correctAnswer);
    return {
      countInScore: true,
      earnedPoints: isCorrect ? safePoints : 0,
      isCorrect,
      needsTeacherReview: false,
      mode: "auto",
    };
  }

  if (isTrueFalseType(questionType)) {
    const normalizeBoolean = (value) => {
      const text = normalizeComparableText(value);
      if (["true", "t", "yes", "y", "1"].includes(text)) return "true";
      if (["false", "f", "no", "n", "0"].includes(text)) return "false";
      return text;
    };
    const isCorrect =
      normalizeBoolean(submittedText) === normalizeBoolean(correctAnswer);
    return {
      countInScore: true,
      earnedPoints: isCorrect ? safePoints : 0,
      isCorrect,
      needsTeacherReview: false,
      mode: "auto",
    };
  }

  if (isOpenEndedType(questionType)) {
    const openScore = scoreOpenEndedAnswer(submittedText, correctAnswer, safePoints);
    return {
      countInScore: true,
      earnedPoints: openScore.earnedPoints,
      isCorrect: openScore.isCorrect,
      needsTeacherReview: openScore.needsTeacherReview,
      mode: "hybrid_open",
    };
  }

  const exactMatch =
    normalizeComparableText(submittedText) === normalizeComparableText(correctAnswer);
  return {
    countInScore: true,
    earnedPoints: exactMatch ? safePoints : 0,
    isCorrect: exactMatch,
    needsTeacherReview: false,
    mode: "auto",
  };
};

const parseMultipleChoiceQuestion = (text) => {
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
      const rawValue = normalized.slice(
        marker.valueStart,
        next ? next.markerStart : normalized.length,
      );
      const label = rawValue.replace(/\s+/g, " ").trim();
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

const buildQuestionReviewFeedback = ({
  questionType,
  submittedAnswer,
  correctAnswer,
  grading,
  points,
  options = [],
}) => {
  const hasAnswer = String(submittedAnswer || "").trim().length > 0;
  if (!hasAnswer) {
    return "No answer submitted for this question.";
  }

  if (grading.needsTeacherReview && isOpenEndedType(questionType)) {
    if (!String(correctAnswer || "").trim()) {
      return "Pending teacher mark for this open response.";
    }
    return "Partially matched response. Teacher review is recommended.";
  }

  if (isMultipleChoiceType(questionType)) {
    if (grading.isCorrect) {
      return "Correct answer selected.";
    }
    const correctChoice = normalizeChoiceToken(correctAnswer);
    if (correctChoice) {
      const match = options.find((option) => option.key === correctChoice);
      if (match?.label) {
        return `Incorrect. Correct answer is ${correctChoice}: ${match.label}`;
      }
      return `Incorrect. Correct answer is ${correctChoice}.`;
    }
    return "Incorrect option selected.";
  }

  if (isTrueFalseType(questionType)) {
    return grading.isCorrect
      ? "Correct True/False judgment."
      : `Incorrect. Correct answer: ${String(correctAnswer || "").trim() || "N/A"}.`;
  }

  if (isOpenEndedType(questionType)) {
    const ratio =
      Number.isFinite(grading.earnedPoints) && Number.isFinite(points)
        ? points > 0
          ? grading.earnedPoints / points
          : 0
        : 0;
    if (ratio >= 0.95) return "Strong explanation. Key concept captured correctly.";
    if (ratio >= 0.6) return "Partially correct. Add clearer reasoning and examples.";
    return "Needs revision. Review topic notes and retry with full reasoning.";
  }

  return grading.isCorrect ? "Correct response." : "Response needs correction.";
};

const inferSubmissionReviewStatus = (questionReviews) => {
  const items = Array.isArray(questionReviews) ? questionReviews : [];
  const pendingTeacher = items.filter((item) => item.needsTeacherReview).length;
  const autoReviewed = items.length - pendingTeacher;
  return {
    pendingTeacher,
    autoReviewed,
    status: pendingTeacher > 0 ? "waiting_teacher_review" : "ai_graded",
  };
};

const buildPlpTipsFromImprovements = ({
  subject,
  weakArea,
  improvements = [],
  score,
}) => {
  const tips = [];
  const safeSubject = subject || "this subject";
  const safeWeakArea = weakArea || "key concepts";

  tips.push(`Spend 15 minutes daily practicing ${safeWeakArea} in ${safeSubject}.`);
  if (Number(score) < 70) {
    tips.push("Start with easier examples, then move to mixed practice questions.");
  } else {
    tips.push("Challenge yourself with one extension question after each practice set.");
  }

  for (const improvement of improvements) {
    const clean = String(improvement || "").trim();
    if (!clean) continue;
    tips.push(clean);
    if (tips.length >= 4) break;
  }

  return Array.from(new Set(tips.map((tip) => tip.slice(0, 220)))).slice(0, 4);
};

const splitQuestionLinesForPdf = (value) => {
  const baseLines = String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (baseLines.length === 0) return ["Question"];

  const lines = [];
  for (const line of baseLines) {
    const markerIndex = line.search(/[A-H][)\].:-]\s*/);
    if (markerIndex === -1) {
      lines.push(line);
      continue;
    }

    const optionSection = line.slice(markerIndex);
    const optionRegex =
      /([A-H])[)\].:-]\s*([\s\S]*?)(?=(?:\s+[A-H][)\].:-]\s*)|$)/g;
    const options = [];
    let optionMatch;
    while ((optionMatch = optionRegex.exec(optionSection)) !== null) {
      const optionLabel = String(optionMatch[2] || "")
        .replace(/\s+/g, " ")
        .trim();
      if (optionLabel) {
        options.push(`${optionMatch[1]}) ${optionLabel}`);
      }
    }

    if (options.length >= 2) {
      const intro = line.slice(0, markerIndex).trim();
      if (intro) lines.push(intro);
      lines.push(...options);
      continue;
    }

    lines.push(line);
  }

  return lines.length > 0 ? lines : ["Question"];
};

const createPdfTemplateDocument = ({
  res,
  filename,
  reportTitle,
  reportSubtitle,
  metaLeft = [],
  metaRight = [],
}) => {
  const safeFilename = `${sanitizeFilename(filename || reportTitle || "report")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  const schoolName = process.env.SCHOOL_NAME || "ClassIQ";
  const schoolDistrict = process.env.SCHOOL_DISTRICT || "School District";
  const schoolWebsite = process.env.SCHOOL_WEBSITE || "";
  const schoolEmail = process.env.SCHOOL_EMAIL || "";
  const schoolPhone = process.env.SCHOOL_PHONE || "";
  const schoolLogoConfig = String(process.env.SCHOOL_LOGO_PATH || "").trim();
  const schoolLogoPath = schoolLogoConfig
    ? path.isAbsolute(schoolLogoConfig)
      ? schoolLogoConfig
      : path.resolve(schoolLogoConfig)
    : null;
  const hasSchoolLogo = Boolean(schoolLogoPath && fs.existsSync(schoolLogoPath));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const contentWidth = right - left;
  const rightColumnX = left + contentWidth * 0.64;
  const headerTop = doc.y;

  if (hasSchoolLogo) {
    try {
      doc.image(schoolLogoPath, left, headerTop, {
        fit: [70, 70],
        align: "left",
        valign: "top",
      });
    } catch {
      // Continue without logo.
    }
  }

  const brandingX = hasSchoolLogo ? left + 84 : left;
  const brandingWidth = contentWidth * 0.54 - (hasSchoolLogo ? 22 : 0);
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#102A63")
    .text(schoolName, brandingX, headerTop + 2, { width: brandingWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#102A63")
    .text(reportTitle || "Report", brandingX, doc.y + 2, {
      width: brandingWidth,
    });
  if (reportSubtitle) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#334155")
      .text(reportSubtitle, brandingX, doc.y + 2, { width: brandingWidth });
  }
  const brandingBottom = doc.y;

  let contactY = headerTop + 4;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(schoolDistrict, rightColumnX, contactY, {
      width: contentWidth * 0.34,
    });
  contactY = doc.y + 2;
  doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
  if (schoolWebsite) {
    doc.text(schoolWebsite, rightColumnX, contactY, {
      width: contentWidth * 0.34,
    });
    contactY = doc.y + 2;
  }
  if (schoolEmail) {
    doc.text(schoolEmail, rightColumnX, contactY, {
      width: contentWidth * 0.34,
    });
    contactY = doc.y + 2;
  }
  if (schoolPhone) {
    doc.text(schoolPhone, rightColumnX, contactY, {
      width: contentWidth * 0.34,
    });
    contactY = doc.y + 2;
  }

  doc.y = Math.max(
    brandingBottom,
    contactY,
    hasSchoolLogo ? headerTop + 70 : headerTop + 36,
  );
  doc.y += 8;
  doc
    .strokeColor("#102A63")
    .lineWidth(1.4)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();
  doc.y += 14;

  const metaStartY = doc.y;
  const leftMetaWidth = contentWidth * 0.54;
  const rightMetaWidth = contentWidth * 0.36;

  let leftMetaY = metaStartY;
  metaLeft
    .filter(Boolean)
    .forEach((line) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(String(line), left, leftMetaY, { width: leftMetaWidth });
      leftMetaY = doc.y + 2;
    });

  let rightMetaY = metaStartY;
  metaRight
    .filter(Boolean)
    .forEach((line) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(String(line), rightColumnX, rightMetaY, { width: rightMetaWidth });
      rightMetaY = doc.y + 2;
    });

  doc.y = Math.max(leftMetaY, rightMetaY, metaStartY) + 10;
  doc
    .strokeColor("#1e293b")
    .lineWidth(1)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();
  doc.y += 12;

  const ensureSpace = (heightNeeded = 60) => {
    if (doc.y + heightNeeded > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  };

  const sectionTitle = (title) => {
    ensureSpace(48);
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0f172a")
      .text(title);
    doc.moveDown(0.35);
  };

  const bodyLine = (line, options = {}) => {
    const { bullet = false, color = "#1f2937", bold = false, indent = 0 } = options;
    ensureSpace(24);
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(11)
      .fillColor(color)
      .text(bullet ? `- ${line}` : line, left + indent, doc.y, {
        width: contentWidth - indent,
      });
  };

  return {
    doc,
    left,
    right,
    contentWidth,
    ensureSpace,
    sectionTitle,
    bodyLine,
  };
};

const buildFallbackExerciseQuestions = ({
  subject,
  weakArea,
  questionCount,
  resourceContext = [],
}) => {
  const safeCount = clamp(questionCount, 3, 20);
  const baseSubject = subject || "the subject";
  const topic = weakArea || "core concepts";

  const normalize = (value, max = 180) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);

  const candidateFacts = [];
  const seen = new Set();
  for (const resource of Array.isArray(resourceContext) ? resourceContext : []) {
    const source = normalize(resource?.title || "Book", 80) || "Book";
    const excerpt = normalize(resource?.excerpt || "", 1400);
    const fragments = excerpt
      ? excerpt
          .split(/[.!?;\n]/g)
          .map((item) => normalize(item, 180))
          .filter((item) => item.length >= 24)
      : [];
    if (fragments.length === 0) {
      const titleSeed = normalize(resource?.title || "", 120);
      if (titleSeed) fragments.push(titleSeed);
    }
    for (const fragment of fragments) {
      const key = fragment.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidateFacts.push({ source, fact: fragment });
      if (candidateFacts.length >= 30) break;
    }
    if (candidateFacts.length >= 30) break;
  }

  if (candidateFacts.length === 0) {
    candidateFacts.push({
      source: "Books",
      fact: `${topic} in ${baseSubject}`,
    });
  }

  const questions = [];
  for (let i = 1; i <= safeCount; i += 1) {
    const base = candidateFacts[(i - 1) % candidateFacts.length];
    const statement = normalize(base.fact, 150);
    const source = base.source || "Books";
    const mode = i % 3;

    if (mode === 1) {
      questions.push({
        type: "Multiple Choice",
        text:
          `Q${i}. According to "${source}", which option best applies this idea in ${baseSubject}: "${statement}"?\n` +
          `A) Use the concept to explain and solve relevant class tasks.\n` +
          `B) Ignore the concept and memorize answers only.\n` +
          `C) Use the concept only for unrelated topics.\n` +
          `D) Avoid checking understanding with examples.`,
        answer: "A",
        points: 2,
      });
      continue;
    }

    if (mode === 2) {
      questions.push({
        type: "Short Answer",
        text:
          `Q${i}. In 2-3 sentences, explain this point from "${source}": "${statement}". ` +
          `Then give one classroom example in ${baseSubject}.`,
        answer:
          "A complete answer should explain the point accurately and give one relevant example.",
        points: 3,
      });
      continue;
    }

    questions.push({
      type: "True/False",
      text:
        `Q${i}. True or False: The statement "${statement}" from "${source}" should be applied when learning ${baseSubject}.`,
      answer: "True",
      points: 1,
    });
  }

  return questions;
};

const resolveRequestedSubject = (subjects, requestedSubject) => {
  if (!Array.isArray(subjects) || subjects.length === 0) return null;
  const requested = String(requestedSubject || "").trim();
  if (!requested) return null;
  return (
    subjects.find(
      (subject) => subject.toLowerCase() === requested.toLowerCase(),
    ) || null
  );
};

const BOOK_BUCKET = "books";
const RESOURCE_FETCH_TIMEOUT_MS = 7000;
const RESOURCE_MAX_FETCH_BYTES = 900000;
const RESOURCE_SNIPPET_CHAR_LIMIT = 900;
const SUPPORTED_RESOURCE_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "yaml",
  "yml",
  "html",
  "htm",
  "xml",
  "rtf",
  "doc",
  "docx",
  "docm",
  "ppt",
  "pptx",
  "pptm",
  "xls",
  "xlsx",
  "xlsm",
  "odt",
  "ods",
  "odp",
  "epub",
  "tex",
]);
const BINARY_DOCUMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "docm",
  "ppt",
  "pptx",
  "pptm",
  "xls",
  "xlsx",
  "xlsm",
  "odt",
  "ods",
  "odp",
  "epub",
]);
const MIME_EXTENSION_MAP = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "text/tab-separated-values": "tsv",
  "application/json": "json",
  "application/xml": "xml",
  "text/xml": "xml",
  "text/html": "html",
  "application/rtf": "rtf",
  "text/rtf": "rtf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-word.document.macroEnabled.12": "docm",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.ms-powerpoint.presentation.macroEnabled.12": "pptm",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel.sheet.macroEnabled.12": "xlsm",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "application/epub+zip": "epub",
};

const normalizeSnippetText = (value, max = RESOURCE_SNIPPET_CHAR_LIMIT) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]+/g, " ")
    .trim()
    .slice(0, max);

const isReadableSnippet = (value) => {
  const sample = String(value || "").slice(0, 800);
  if (!sample) return false;
  const readableChars = sample.replace(/[^\x20-\x7e]/g, "");
  return readableChars.length / sample.length >= 0.65;
};

const stripTags = (value) => String(value || "").replace(/<[^>]*>/g, " ");

const stripRtfControlWords = (value) =>
  String(value || "")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ");

const unescapePdfText = (value) =>
  String(value || "")
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\[0-7]{1,3}/g, " ");

const extractPdfSnippet = (buffer) => {
  const raw = Buffer.from(buffer || "").toString("latin1");
  const segments = [];

  let singleMatch;
  const singleRegex = /\(([^()]*)\)\s*Tj/g;
  while ((singleMatch = singleRegex.exec(raw)) !== null) {
    const cleaned = unescapePdfText(singleMatch[1]);
    if (cleaned) segments.push(cleaned);
    if (segments.length >= 40) break;
  }

  let arrayMatch;
  const arrayRegex = /\[(.*?)\]\s*TJ/gs;
  while ((arrayMatch = arrayRegex.exec(raw)) !== null) {
    const chunk = arrayMatch[1] || "";
    let partMatch;
    const partRegex = /\(([^()]*)\)/g;
    while ((partMatch = partRegex.exec(chunk)) !== null) {
      const cleaned = unescapePdfText(partMatch[1]);
      if (cleaned) segments.push(cleaned);
      if (segments.length >= 80) break;
    }
    if (segments.length >= 80) break;
  }

  if (segments.length === 0) return "";
  return normalizeSnippetText(segments.join(" "));
};

const extractReadableBinarySnippet = (buffer) => {
  const raw = Buffer.from(buffer || "").toString("latin1");
  const matches =
    raw.match(/[A-Za-z0-9][A-Za-z0-9 ,.;:'"()\-_/]{18,}/g) || [];
  if (matches.length === 0) return "";
  return normalizeSnippetText(matches.slice(0, 50).join(" "));
};

const normalizeMimeType = (value) =>
  String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

const resolveResourceExtension = (resource, resolvedUrl) => {
  const candidates = [
    resource?.filePath,
    resource?.url,
    resolvedUrl,
    resource?.name,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").split("?")[0];
    const ext = path.extname(value).replace(".", "").toLowerCase();
    if (ext) return ext;
  }
  const mimeType = normalizeMimeType(
    resource?.type || resource?.mimeType || resource?.fileType,
  );
  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }
  return "";
};

const decodeResourceText = (buffer, extension) => {
  const ext = String(extension || "").toLowerCase();
  if (ext === "pdf") return extractPdfSnippet(buffer);
  if (ext === "rtf") {
    const rawRtf = Buffer.from(buffer || "").toString("latin1");
    return normalizeSnippetText(stripRtfControlWords(rawRtf));
  }
  if (BINARY_DOCUMENT_EXTENSIONS.has(ext)) {
    return extractReadableBinarySnippet(buffer);
  }
  let text = Buffer.from(buffer || "").toString("utf8");
  if (ext === "html" || ext === "htm" || ext === "xml") {
    text = stripTags(text);
  }
  return normalizeSnippetText(text);
};

const fetchBookResourceSnippet = async (resource) => {
  const resourceUrl = buildResourceUrl(resource);
  if (!resourceUrl) return "";
  const extension = resolveResourceExtension(resource, resourceUrl);
  if (!SUPPORTED_RESOURCE_EXTENSIONS.has(extension)) {
    return "";
  }

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(
    () => abortController.abort(),
    RESOURCE_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(resourceUrl, { signal: abortController.signal });
    if (!response.ok) return "";

    const headerLength = Number(response.headers.get("content-length") || 0);
    if (
      Number.isFinite(headerLength) &&
      headerLength > RESOURCE_MAX_FETCH_BYTES
    ) {
      return "";
    }

    const arrayBuffer = await response.arrayBuffer();
    let fileBuffer = Buffer.from(arrayBuffer);
    if (fileBuffer.length > RESOURCE_MAX_FETCH_BYTES) {
      fileBuffer = fileBuffer.subarray(0, RESOURCE_MAX_FETCH_BYTES);
    }

    const snippet = decodeResourceText(fileBuffer, extension);
    return isReadableSnippet(snippet) ? snippet : "";
  } catch (_) {
    return "";
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const buildBookResourceContext = async (resources) => {
  const selectedResources = Array.isArray(resources) ? resources.slice(0, 4) : [];
  const contextRows = await Promise.all(
    selectedResources.map(async (resource) => {
      const title = String(resource?.name || "Book").trim().slice(0, 140) || "Book";
      const excerpt = await fetchBookResourceSnippet(resource);
      return {
        id: resource?.id || null,
        title,
        excerpt,
        url: buildResourceUrl(resource),
      };
    }),
  );
  return contextRows.filter((row) => row.title);
};

const isBooksBucketSql = `
(
  lower(trim(COALESCE(bucket, ''))) = '${BOOK_BUCKET}'
  OR lower(COALESCE(file_path, '')) LIKE '${BOOK_BUCKET}/%'
  OR lower(COALESCE(file_url, '')) LIKE '%/${BOOK_BUCKET}/%'
)
`;

const subjectMatchSql = `
(
  lower(trim(COALESCE(subject, ''))) = lower(trim($1))
  OR replace(lower(trim(COALESCE(subject, ''))), ' ', '') = replace(lower(trim($1)), ' ', '')
  OR lower(trim(COALESCE(subject, ''))) LIKE lower(trim($1)) || '%'
  OR lower(trim($1)) LIKE lower(trim(COALESCE(subject, ''))) || '%'
)
`;

const getActiveSubjects = async (userId) => {
  const { rows } = await query(
    `SELECT DISTINCT s.name
       FROM student_subject_enrollments sse
       JOIN subjects s ON s.id = sse.subject_id
      WHERE sse.student_id = $1
        AND sse.status = 'Active'`,
    [userId],
  );

  return rows.map((row) => row.name).filter(Boolean);
};

const MAX_DAILY_EXERCISES = clamp(
  Number.parseInt(process.env.MAX_DAILY_EXERCISES || "3", 10) || 3,
  1,
  10,
);
const MAX_DAILY_SUBJECTS = clamp(
  Number.parseInt(process.env.MAX_DAILY_SUBJECTS || "3", 10) || 3,
  1,
  10,
);
const WEEKLY_ROTATION_SUBJECTS = clamp(
  Number.parseInt(process.env.WEEKLY_ROTATION_SUBJECTS || "3", 10) || 3,
  1,
  10,
);

const normalizeSubjectToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeAssessmentToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getTeacherAssignmentCategory = (type) => {
  const normalizedType = normalizeAssessmentToken(type);
  if (!normalizedType) return null;
  if (normalizedType.includes("exercise")) return null;
  if (normalizedType.includes("diagnostic")) return "diagnostic";
  if (normalizedType.includes("end of unit") || normalizedType.includes("unit")) {
    return "end_of_unit";
  }
  if (normalizedType.includes("end of term") || normalizedType.includes("term")) {
    return "end_of_term";
  }
  if (normalizedType.includes("assessment")) return "assessment";
  return null;
};

const isTeacherAssignmentType = (type) => Boolean(getTeacherAssignmentCategory(type));

const buildTeacherAssignmentKey = ({ teacherId, subject, type, title }) =>
  [
    String(teacherId || "").trim().toLowerCase(),
    normalizeAssessmentToken(subject),
    normalizeAssessmentToken(type),
    normalizeAssessmentToken(title),
  ].join("|");

let teacherExerciseMetaSupport = null;
const hasTeacherExerciseMetaSupport = async () => {
  if (teacherExerciseMetaSupport !== null) return teacherExerciseMetaSupport;
  try {
    const { rows } = await query(
      `SELECT EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercises'
             AND column_name = 'assigned_by_teacher_id'
        ) AS "hasTeacherId",
        EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercises'
             AND column_name = 'assignment_origin'
        ) AS "hasAssignmentOrigin"`,
    );
    teacherExerciseMetaSupport =
      Boolean(rows[0]?.hasTeacherId) && Boolean(rows[0]?.hasAssignmentOrigin);
    return teacherExerciseMetaSupport;
  } catch (error) {
    console.error("Failed to inspect teacher exercise metadata support", error);
    teacherExerciseMetaSupport = false;
    return false;
  }
};

const parseScheduleTitleSubjects = (title, activeSubjects) => {
  const text = normalizeSubjectToken(title);
  if (!text || !Array.isArray(activeSubjects) || activeSubjects.length === 0) {
    return [];
  }
  return activeSubjects.filter((subject) => {
    const normalizedSubject = normalizeSubjectToken(subject);
    if (!normalizedSubject) return false;
    const compactSubject = normalizedSubject.replace(/\s+/g, "");
    const compactText = text.replace(/\s+/g, "");
    return (
      text.includes(normalizedSubject) ||
      compactText.includes(compactSubject) ||
      normalizedSubject
        .split(" ")
        .filter(Boolean)
        .every((part) => text.includes(part))
    );
  });
};

const getCurrentSchoolDayIndex = () => {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
};

const getDailyExerciseStats = async (studentId) => {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT lower(subject))::int AS "distinctSubjects",
            COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT lower(subject)), NULL), '{}') AS "subjects"
       FROM exercises
      WHERE user_id = $1
        AND exercise_date = CURRENT_DATE`,
    [studentId],
  );
  const row = rows[0] || {};
  const normalizedSubjects = Array.isArray(row.subjects)
    ? row.subjects.map((item) => normalizeSubjectToken(item)).filter(Boolean)
    : [];
  return {
    total: row.total || 0,
    distinctSubjects: row.distinctSubjects || 0,
    subjects: normalizedSubjects,
  };
};

const getTodaySubjectPlan = async (studentId, activeSubjects) => {
  const dayIndex = getCurrentSchoolDayIndex();
  const { rows: scheduleRows } = await query(
    `SELECT title
       FROM schedule_classes
      WHERE user_id = $1
        AND day_of_week = $2
      ORDER BY start_time`,
    [studentId, dayIndex],
  );

  const fromSchedule = [];
  const seen = new Set();
  scheduleRows.forEach((row) => {
    const matches = parseScheduleTitleSubjects(row.title, activeSubjects);
    matches.forEach((subject) => {
      const key = normalizeSubjectToken(subject);
      if (!key || seen.has(key)) return;
      seen.add(key);
      fromSchedule.push(subject);
    });
  });

  if (fromSchedule.length > 0) {
    return {
      source: "schedule",
      dayIndex,
      subjects: fromSchedule.slice(0, MAX_DAILY_SUBJECTS),
    };
  }

  const { rows: weeklyRows } = await query(
    `SELECT subject,
            COUNT(*)::int AS "generatedCount",
            MAX(exercise_date) AS "lastGenerated"
       FROM exercises
      WHERE user_id = $1
        AND subject = ANY($2::text[])
        AND exercise_date >= CURRENT_DATE - interval '7 days'
      GROUP BY subject`,
    [studentId, activeSubjects],
  );

  const weeklyMap = new Map();
  weeklyRows.forEach((row) => {
    weeklyMap.set(normalizeSubjectToken(row.subject), {
      generatedCount: row.generatedCount || 0,
      lastGenerated: row.lastGenerated ? new Date(row.lastGenerated) : null,
    });
  });

  const ranked = activeSubjects
    .map((subject) => {
      const key = normalizeSubjectToken(subject);
      const meta = weeklyMap.get(key) || {
        generatedCount: 0,
        lastGenerated: null,
      };
      return { subject, ...meta };
    })
    .sort((a, b) => {
      if (a.generatedCount !== b.generatedCount) {
        return a.generatedCount - b.generatedCount;
      }
      const aTime = a.lastGenerated ? a.lastGenerated.getTime() : 0;
      const bTime = b.lastGenerated ? b.lastGenerated.getTime() : 0;
      return aTime - bTime;
    });

  return {
    source: "rotation",
    dayIndex,
    subjects: ranked
      .slice(0, Math.min(WEEKLY_ROTATION_SUBJECTS, MAX_DAILY_SUBJECTS))
      .map((item) => item.subject),
  };
};

const getStudentSubjectContext = async (studentId, subjectName) => {
  const { rows } = await query(
    `SELECT s.id AS "subjectId",
            s.name AS "subjectName",
            sse.class_id AS "classId",
            sse.teacher_id AS "teacherId",
            p.class_id AS "profileClassId",
            p.class_name AS "className",
            p.grade_level AS "gradeLevel"
       FROM student_subject_enrollments sse
       JOIN subjects s ON s.id = sse.subject_id
       LEFT JOIN user_profiles p ON p.user_id = sse.student_id
      WHERE sse.student_id = $1
        AND sse.status = 'Active'
        AND lower(s.name) = lower($2)
      ORDER BY sse.created_at DESC
      LIMIT 1`,
    [studentId, subjectName],
  );
  return rows[0] || null;
};

const getInheritedLessonContext = async ({
  classId,
  subjectId,
}) => {
  if (!classId || !subjectId) return null;
  const { rows } = await query(
    `SELECT l.id,
            l.unit_title AS "unitTitle",
            l.lesson_number AS "lessonNumber",
            l.topic,
            l.page_from AS "pageFrom",
            l.page_to AS "pageTo",
            l.term,
            l.week_number AS "weekNumber",
            l.notes,
            l.effective_date AS "effectiveDate",
            l.updated_at AS "updatedAt",
            u.email AS "updatedByEmail",
            p.first_name AS "updatedByFirstName",
            p.last_name AS "updatedByLastName"
       FROM class_subject_lessons l
       LEFT JOIN users u ON u.id = l.updated_by
       LEFT JOIN user_profiles p ON p.user_id = l.updated_by
      WHERE l.class_id = $1
        AND l.subject_id = $2
      LIMIT 1`,
    [classId, subjectId],
  );
  return rows[0] || null;
};

const getStudentTopicFocus = async (studentId, subjectId) => {
  if (!studentId || !subjectId) return null;
  const { rows } = await query(
    `SELECT topic,
            source,
            updated_at AS "updatedAt"
       FROM student_subject_focus
      WHERE student_id = $1
        AND subject_id = $2
      LIMIT 1`,
    [studentId, subjectId],
  );
  return rows[0] || null;
};

const upsertStudentTopicFocus = async ({
  studentId,
  subjectId,
  topic,
  source = "student",
}) => {
  if (!studentId || !subjectId || !String(topic || "").trim()) return;
  await query(
    `INSERT INTO student_subject_focus (
        student_id,
        subject_id,
        topic,
        source,
        updated_at
      )
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (student_id, subject_id)
     DO UPDATE SET
       topic = EXCLUDED.topic,
       source = EXCLUDED.source,
       updated_at = now()`,
    [
      studentId,
      subjectId,
      String(topic || "").trim().slice(0, 220),
      String(source || "student").trim().toLowerCase() === "admin"
        ? "admin"
        : String(source || "student").trim().toLowerCase() === "teacher"
          ? "teacher"
          : "student",
    ],
  );
};

const filterResourceContextByTopic = (contextRows, topic) => {
  const normalizedTopic = normalizeSnippetText(topic || "", 180).toLowerCase();
  if (!normalizedTopic) return contextRows;
  const keywords = normalizedTopic
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  if (keywords.length === 0) return contextRows;

  const scored = contextRows
    .map((row) => {
      const haystack = `${String(row.title || "").toLowerCase()} ${String(row.excerpt || "").toLowerCase()}`;
      let score = 0;
      keywords.forEach((word) => {
        if (haystack.includes(word)) score += 1;
      });
      return { row, score };
    })
    .sort((a, b) => b.score - a.score);
  const bestScore = scored[0]?.score || 0;
  if (bestScore <= 0) return contextRows;
  return scored
    .filter((entry) => entry.score > 0)
    .slice(0, 4)
    .map((entry) => entry.row);
};

router.get("/search", async (req, res, next) => {
  try {
    const queryText = String(req.query.q || "").trim();
    if (!queryText) {
      return res.json({
        query: "",
        results: {
          courses: [],
          tasks: [],
          assignments: [],
          assessments: [],
          exercises: [],
          resources: [],
        },
      });
    }

    const likeQuery = `%${queryText}%`;
    const subjects = await getActiveSubjects(req.user.id);

    const [
      coursesResult,
      tasksResult,
      assignmentsResult,
      assessmentsResult,
      exercisesResult,
    ] =
      await Promise.all([
        query(
          `SELECT s.id,
                  s.name AS title,
                  s.code
             FROM student_subject_enrollments sse
             JOIN subjects s ON s.id = sse.subject_id
            WHERE sse.student_id = $1
              AND sse.status = 'Active'
              AND (s.name ILIKE $2 OR s.code ILIKE $2)
            ORDER BY s.name
            LIMIT 5`,
          [req.user.id, likeQuery],
        ),
      query(
        `SELECT id,
                title,
                due_date AS "dueDate"
           FROM tasks
          WHERE user_id = $1
            AND title ILIKE $2
          ORDER BY due_date NULLS LAST
          LIMIT 5`,
        [req.user.id, likeQuery],
      ),
      query(
        `SELECT id,
                title,
                subject,
                type,
                status
           FROM assessments
          WHERE user_id = $1
            AND teacher_id IS NOT NULL
            AND lower(COALESCE(type, '')) NOT LIKE '%exercise%'
            AND (title ILIKE $2 OR subject ILIKE $2 OR type ILIKE $2)
          ORDER BY assessment_date DESC NULLS LAST
          LIMIT 5`,
        [req.user.id, likeQuery],
      ),
      query(
        `SELECT id,
                title,
                subject,
                status
           FROM assessments
          WHERE user_id = $1
            AND (title ILIKE $2 OR subject ILIKE $2)
          ORDER BY assessment_date DESC NULLS LAST
          LIMIT 5`,
        [req.user.id, likeQuery],
      ),
      query(
        `SELECT id,
                name,
                subject
           FROM exercises
          WHERE user_id = $1
            AND (name ILIKE $2 OR subject ILIKE $2)
          ORDER BY exercise_date DESC NULLS LAST
          LIMIT 5`,
        [req.user.id, likeQuery],
      ),
    ]);

    let resourcesResult = { rows: [] };
    if (subjects.length > 0) {
      const { rows: profileRows } = await query(
        `SELECT grade_level AS "gradeLevel"
           FROM user_profiles
          WHERE user_id = $1`,
        [req.user.id],
      );
      const currentLevel = profileRows[0]?.gradeLevel || null;
      if (currentLevel) {
        resourcesResult = await query(
          `SELECT id,
                  name,
                  subject
             FROM resources
            WHERE subject = ANY($1::text[])
              AND (
                levels IS NULL
                OR array_length(levels, 1) = 0
                OR EXISTS (
                  SELECT 1
                  FROM unnest(levels) level_item
                  WHERE lower(level_item) = lower($2)
                     OR lower($2) LIKE lower(level_item) || '%'
                     OR lower(level_item) LIKE lower($2) || '%'
                )
              )
              AND (name ILIKE $3 OR subject ILIKE $3)
            ORDER BY resource_date DESC NULLS LAST
            LIMIT 5`,
          [subjects, currentLevel, likeQuery],
        );
      }
    }

    return res.json({
      query: queryText,
      results: {
        courses: coursesResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.code ? `Code: ${row.code}` : null,
          route: "/student/my-courses",
        })),
        tasks: tasksResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.dueDate ? `Due: ${formatShortDate(row.dueDate)}` : null,
          route: "/student/tasks",
        })),
        assignments: assignmentsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: [row.subject, row.type, row.status]
            .filter(Boolean)
            .join(" | "),
          route: "/student/assignments",
        })),
        assessments: assessmentsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.subject
            ? `${row.subject}${row.status ? ` · ${row.status}` : ""}`
            : row.status || null,
          route: "/student/assessments",
        })),
        exercises: exercisesResult.rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.subject || null,
          route: "/student/exercise",
        })),
        resources: resourcesResult.rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.subject || null,
          route: "/student/resources",
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/profile", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.role,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentId",
              p.student_code AS "studentCode",
              p.class_id AS "classId",
              p.grade_level AS "gradeLevel",
              p.class_name AS "className",
              p.major AS program,
              p.major,
              p.avatar_url AS "avatarUrl",
              COALESCE(s.name, p.school_name) AS "schoolName"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN schools s ON s.id = p.school_id
        WHERE u.id = $1`,
      [req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Profile not found." });
    }

    const { rows: settingsRows } = await query(
      `SELECT notifications_enabled AS "notifications",
              auto_sync AS "autoSync"
         FROM user_settings
        WHERE user_id = $1`,
      [req.user.id],
    );

    return res.json({
      user: rows[0],
      settings: settingsRows[0] || { notifications: true, autoSync: true },
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/profile/avatar",
  uploadLimiter,
  avatarUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required." });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;
      const { rows } = await query(
        `UPDATE user_profiles
            SET avatar_url = $2,
                updated_at = now()
          WHERE user_id = $1
        RETURNING avatar_url AS "avatarUrl"`,
        [req.user.id, avatarUrl],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "Profile not found." });
      }

      await logAudit(req, "profile_image_upload", {
        filename: req.file.filename,
      });

      return res.json({ user: rows[0] });
    } catch (error) {
      return next(error);
    }
  },
);

router.patch("/profile", async (req, res, next) => {
  try {
    const { avatarUrl } = req.body || {};
    if (!avatarUrl) {
      return res.status(400).json({ error: "avatarUrl is required." });
    }

    const { rows } = await query(
      `UPDATE user_profiles
          SET avatar_url = $2,
              updated_at = now()
        WHERE user_id = $1
      RETURNING avatar_url AS "avatarUrl"`,
      [req.user.id, avatarUrl],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Profile not found." });
    }

    return res.json({ user: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.patch("/profile/settings", async (req, res, next) => {
  try {
    const { notifications, autoSync } = req.body || {};
    const { rows } = await query(
      `INSERT INTO user_settings (user_id, notifications_enabled, auto_sync)
       VALUES ($1, COALESCE($2, true), COALESCE($3, true))
       ON CONFLICT (user_id)
       DO UPDATE SET
         notifications_enabled = COALESCE($2, user_settings.notifications_enabled),
         auto_sync = COALESCE($3, user_settings.auto_sync)
       RETURNING notifications_enabled AS "notifications",
                 auto_sync AS "autoSync"`,
      [req.user.id, notifications, autoSync],
    );

    return res.json({ settings: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [
      profileResult,
      statsResult,
      summaryCountsResult,
      termScoresResult,
      scheduleResult,
      tasksResult,
      assessmentAvgResult,
      dailyMarksResult,
    ] = await Promise.all([
        query(
          `SELECT p.first_name AS "firstName",
                  p.last_name AS "lastName",
                  p.student_code AS "studentCode",
                  p.student_id AS "studentId",
                  p.class_id AS "classId",
                  p.grade_level AS "gradeLevel",
                  p.class_name AS "className",
                  p.major AS program,
                  p.major,
                  p.avatar_url AS "avatarUrl",
                  p.school_id AS "schoolId",
                  COALESCE(s.name, p.school_name) AS "schoolName"
             FROM user_profiles p
             LEFT JOIN schools s ON s.id = p.school_id
            WHERE p.user_id = $1`,
          [userId],
        ),
        query(
          `SELECT current_term AS "currentTerm",
                  ranking,
                  overall_percentage AS "overallPercentage",
                  weakness
             FROM student_stats
            WHERE user_id = $1`,
          [userId],
        ),
        query(
          `SELECT
              (SELECT COUNT(*)::int
                 FROM student_subject_enrollments
                WHERE student_id = $1
                  AND status IN ('Active', 'Completed')) AS subjects_current,
              (SELECT COUNT(*)::int
                 FROM student_subject_enrollments
                WHERE student_id = $1) AS subjects_total,
              (SELECT COUNT(*)::int
                 FROM assessments
                WHERE user_id = $1
                  AND status = 'Completed') AS assessments_current,
              (SELECT COUNT(*)::int
                 FROM assessments
                WHERE user_id = $1) AS assessments_total,
              (SELECT COUNT(DISTINCT exercise_id)::int
                 FROM exercise_submissions
                WHERE user_id = $1
                  AND status = 'submitted') AS exercises_current,
              (SELECT COUNT(*)::int
                 FROM exercises
                WHERE user_id = $1) AS exercises_total,
              (SELECT COUNT(*)::int
                 FROM tasks
                WHERE user_id = $1
                  AND completed) AS tasks_current,
              (SELECT COUNT(*)::int
                 FROM tasks
                WHERE user_id = $1) AS tasks_total`,
          [userId],
        ),
        query(
          `SELECT t.id,
                  t.name,
                  t.year,
                  t.starts_on AS "startsOn",
                  t.ends_on AS "endsOn",
                  t.is_current AS "isCurrent",
                  AVG(a.grade_percent)::int AS "avgScore"
             FROM user_profiles p
             JOIN terms t ON t.school_id = p.school_id
             LEFT JOIN assessments a
               ON a.user_id = p.user_id
              AND a.grade_percent IS NOT NULL
              AND a.assessment_date BETWEEN t.starts_on AND t.ends_on
            WHERE p.user_id = $1
            GROUP BY t.id, t.name, t.year, t.starts_on, t.ends_on
            ORDER BY t.year, t.starts_on`,
          [userId],
        ),
        query(
          `SELECT day_of_week AS "dayOfWeek",
                  start_time AS "startTime",
                  end_time AS "endTime",
                  title
             FROM schedule_classes
            WHERE user_id = $1
            ORDER BY day_of_week, start_time`,
          [userId],
        ),
        query(
          `SELECT id, title,
                  due_date AS "due",
                  completed
             FROM tasks
            WHERE user_id = $1
            ORDER BY due_date`,
          [userId],
        ),
        query(
          `SELECT AVG(grade_percent)::int AS "avgGrade",
                  MAX(assessment_date) AS "lastAssessmentDate",
                  (
                    SELECT weak_area
                      FROM assessments
                     WHERE user_id = $1
                       AND weak_area IS NOT NULL
                     ORDER BY assessment_date DESC NULLS LAST, created_at DESC
                     LIMIT 1
                  ) AS "lastWeakArea"
             FROM assessments
            WHERE user_id = $1
              AND grade_percent IS NOT NULL`,
          [userId],
        ),
        query(
          `SELECT day::date AS "day",
                  ROUND(AVG(mark_value))::int AS "avgMark"
             FROM (
               SELECT a.assessment_date::date AS day,
                      a.grade_percent::numeric AS mark_value
                 FROM assessments a
                WHERE a.user_id = $1
                  AND a.grade_percent IS NOT NULL
                  AND a.assessment_date IS NOT NULL
               UNION ALL
               SELECT es.submitted_at::date AS day,
                      es.score::numeric AS mark_value
                 FROM exercise_submissions es
                WHERE es.user_id = $1
                  AND es.status = 'submitted'
                  AND es.score IS NOT NULL
             ) daily_scores
            GROUP BY day
            ORDER BY day DESC
            LIMIT 14`,
          [userId],
        ),
      ]);

    const profile = profileResult.rows[0] || {};
    const stats = statsResult.rows[0] || {};
    const assessmentStats = assessmentAvgResult.rows[0] || {};
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ");

    const schedule = scheduleResult.rows.map((row) => ({
      day: DAY_LABELS[row.dayOfWeek] || `Day ${row.dayOfWeek}`,
      time: formatTimeRange(row.startTime, row.endTime),
      title: row.title,
    }));

    const termRows = Array.isArray(termScoresResult?.rows)
      ? termScoresResult.rows
      : [];
    const computedScores = termRows.map((row, index) => ({
      term_id: parseTermNumber(row.name) || index + 1,
      val: row.avgScore,
      name: row.name,
      year: row.year,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
    }));
    const rawScores = computedScores.filter(
      (row) => row.val !== null && row.val !== undefined,
    );

    const now = new Date();
    let currentTermRow = termRows.find((term) => term.isCurrent);

    if (!currentTermRow) {
      currentTermRow = termRows.find((term) => {
        if (!term.startsOn || !term.endsOn) return false;
        const start = new Date(term.startsOn);
        const end = new Date(term.endsOn);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return false;
        }
        return start <= now && now <= end;
      });
    }

    if (!currentTermRow && stats.currentTerm) {
      const desired = parseTermNumber(stats.currentTerm);
      if (desired) {
        const candidates = termRows.filter(
          (term) => parseTermNumber(term.name) === desired,
        );
        if (candidates.length > 0) {
          currentTermRow = candidates.sort((a, b) => {
            if ((b.year || 0) !== (a.year || 0)) {
              return (b.year || 0) - (a.year || 0);
            }
            return new Date(b.startsOn || 0) - new Date(a.startsOn || 0);
          })[0];
        }
      }
    }

    if (!currentTermRow && termRows.length > 0) {
      currentTermRow = termRows[termRows.length - 1];
    }

    let currentTermNumber =
      parseTermNumber(currentTermRow?.name) ||
      parseTermNumber(stats.currentTerm);

    if (!currentTermNumber && rawScores.length > 0) {
      currentTermNumber = rawScores.reduce(
        (max, row) => Math.max(max, row.term_id || 0),
        0,
      );
    }

    const scores = currentTermNumber
      ? rawScores.filter((row) => row.term_id <= currentTermNumber)
      : rawScores;

    const avgFromAssessments = assessmentStats.avgGrade;
    const avgFromScores = scores.length
      ? Math.round(
          scores.reduce((sum, score) => sum + (score.val || 0), 0) /
            scores.length,
        )
      : null;
    const computedAverage =
      avgFromAssessments ?? avgFromScores ?? stats.overallPercentage ?? null;
    const currentTermLabel =
      currentTermRow?.name ||
      stats.currentTerm ||
      (currentTermNumber ? `Term ${currentTermNumber}` : null);

    const classId = profile.classId || null;
    const className = profile.className || null;
    const gradeLevel = profile.gradeLevel || null;
    let classRankLabel = null;

    if (classId || (gradeLevel && className)) {
      const { rows: classRankRows } = await query(
        `SELECT u.id,
                AVG(a.grade_percent)::numeric AS avg_score
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN assessments a
             ON a.user_id = u.id
            AND a.grade_percent IS NOT NULL
          WHERE u.role = 'student'
            AND (
              ($1::uuid IS NOT NULL AND p.class_id = $1)
              OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
            )
          GROUP BY u.id
          ORDER BY avg_score DESC NULLS LAST, u.id`,
        [classId, gradeLevel, className],
      );

      const rankedRows = classRankRows.filter(
        (row) => row.avg_score !== null && row.avg_score !== undefined,
      );
      const rankIndex = rankedRows.findIndex((row) => row.id === userId);
      if (rankIndex >= 0 && classRankRows.length > 0) {
        classRankLabel = `Rank ${rankIndex + 1}/${classRankRows.length}`;
      }
    }

    const fallbackRanking = getRanking(computedAverage);
    const rankingLabel = classRankLabel || fallbackRanking;
    const dailyMarks = (dailyMarksResult?.rows || [])
      .slice()
      .reverse()
      .map((row) => {
        const raw = row.day ? new Date(row.day) : null;
        const label =
          raw && !Number.isNaN(raw.getTime())
            ? new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(raw)
            : formatShortDate(row.day);
        return {
          day: row.day ? formatIsoDate(row.day) : null,
          label,
          val: clamp(toNumberOrNull(row.avgMark) ?? 0, 0, 100),
        };
      });

    await query(
      `INSERT INTO student_stats (user_id, ranking, overall_percentage, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id)
       DO UPDATE SET
         ranking = EXCLUDED.ranking,
         overall_percentage = COALESCE(EXCLUDED.overall_percentage, student_stats.overall_percentage),
         updated_at = now()`,
      [userId, rankingLabel, computedAverage],
    );

    return res.json({
      student: {
        name: fullName,
        id: profile.studentCode || profile.studentId || null,
        major: profile.major || null,
        gradeLevel: profile.gradeLevel || null,
        className: profile.className || null,
        program: profile.program || null,
        school: profile.schoolName || null,
        image_url: profile.avatarUrl || null,
        currentTerm: currentTermLabel,
        ranking: rankingLabel,
        overallPercentage: formatPercent(computedAverage),
        weakness: assessmentStats.lastWeakArea || null,
      },
      summary: (() => {
        const counts = summaryCountsResult.rows[0] || {};
        const makePercent = (current, total) =>
          formatPercent(
            total ? Math.round((current / total) * 100) : 0,
          );
        return [
          {
            label: "Subjects",
            current: counts.subjects_current || 0,
            total: counts.subjects_total || 0,
            percent: makePercent(
              counts.subjects_current || 0,
              counts.subjects_total || 0,
            ),
          },
          {
            label: "Assessments",
            current: counts.assessments_current || 0,
            total: counts.assessments_total || 0,
            percent: makePercent(
              counts.assessments_current || 0,
              counts.assessments_total || 0,
            ),
          },
          {
            label: "Exercises",
            current: counts.exercises_current || 0,
            total: counts.exercises_total || 0,
            percent: makePercent(
              counts.exercises_current || 0,
              counts.exercises_total || 0,
            ),
          },
          {
            label: "Tasks",
            current: counts.tasks_current || 0,
            total: counts.tasks_total || 0,
            percent: makePercent(
              counts.tasks_current || 0,
              counts.tasks_total || 0,
            ),
          },
        ];
      })(),
      scores,
      dailyMarks,
      schedule,
      tasks: tasksResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        due: formatIsoDate(row.due),
        completed: row.completed,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/courses", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sse.id AS "enrollmentId",
              s.id AS "id",
              s.name,
              s.code,
              s.category,
              s.credits,
              sse.progress,
              sse.status
         FROM student_subject_enrollments sse
         JOIN subjects s ON s.id = sse.subject_id
        WHERE sse.student_id = $1
        ORDER BY s.name`,
      [req.user.id],
    );

    return res.json({ courses: rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/appeals", async (req, res, next) => {
  try {
    const {
      type,
      courseId,
      reason,
      details,
      subjectName,
      attachmentUrl,
      attachmentName,
    } = req.body || {};
    if (!type || !reason) {
      return res.status(400).json({ error: "Type and reason are required." });
    }

    let resolvedCourseId = null;
    let resolvedSubjectName = subjectName ? subjectName.trim() : null;

    if (courseId) {
      if (!isUuid(courseId)) {
        return res.status(400).json({ error: "Invalid courseId." });
      }
      const { rows: subjectRows } = await query(
        `SELECT id, name
           FROM subjects
          WHERE id = $1`,
        [courseId],
      );
      if (!subjectRows[0]) {
        return res.status(400).json({ error: "Subject not found." });
      }
      resolvedCourseId = subjectRows[0].id;
      if (!resolvedSubjectName) {
        resolvedSubjectName = subjectRows[0].name;
      }
    }

    if (type === "mismatch" && !resolvedCourseId) {
      return res.status(400).json({ error: "courseId is required." });
    }

    if (type === "missing" && !resolvedSubjectName) {
      return res.status(400).json({ error: "subjectName is required." });
    }

    const { rows } = await query(
      `INSERT INTO course_appeals (
          user_id,
          course_id,
          type,
          reason,
          details,
          subject_name,
          attachment_url,
          attachment_name
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, status, created_at AS "createdAt"`,
      [
        req.user.id,
        resolvedCourseId,
        type,
        reason,
        details || null,
        resolvedSubjectName || null,
        attachmentUrl || null,
        attachmentName || null,
      ],
    );

    return res.status(201).json({ appeal: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/assessments", async (req, res, next) => {
  try {
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.json({ assessments: [] });
    }

    const { rows } = await query(
      `SELECT id, title, subject, type,
              assessment_date AS "assessmentDate",
              status,
              grade_percent AS "gradePercent",
              predicted_percent AS "predictedPercent",
              weak_area AS "weakArea",
              ai_feedback AS "aiFeedback"
         FROM assessments
        WHERE user_id = $1
          AND subject = ANY($2::text[])
        ORDER BY assessment_date DESC`,
      [req.user.id, subjects],
    );

    return res.json({
      assessments: rows.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        type: row.type,
        date: formatShortDate(row.assessmentDate),
        status: row.status,
        grade: row.gradePercent === null ? null : formatPercent(row.gradePercent),
        predicted: row.predictedPercent === null ? null : formatPercent(row.predictedPercent),
        weakArea: row.weakArea,
        aiFeedback: row.aiFeedback,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assessments/:id/download", async (req, res, next) => {
  try {
    const assessmentId = req.params.id;
    if (!isUuid(assessmentId)) {
      return res.status(400).json({ error: "Invalid assessment id." });
    }

    const { rows } = await query(
      `SELECT a.id,
              a.title,
              a.subject,
              a.type,
              a.status,
              a.assessment_date AS "assessmentDate",
              a.grade_percent AS "gradePercent",
              a.predicted_percent AS "predictedPercent",
              a.weak_area AS "weakArea",
              a.ai_feedback AS "aiFeedback",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentId",
              tp.first_name AS "teacherFirstName",
              tp.last_name AS "teacherLastName",
              tu.email AS "teacherEmail"
         FROM assessments a
         LEFT JOIN user_profiles p ON p.user_id = a.user_id
         LEFT JOIN user_profiles tp ON tp.user_id = a.teacher_id
         LEFT JOIN users tu ON tu.id = a.teacher_id
        WHERE a.id = $1
          AND a.user_id = $2
        LIMIT 1`,
      [assessmentId, req.user.id],
    );

    const assessment = rows[0];
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found." });
    }

    const studentName =
      [assessment.firstName, assessment.lastName].filter(Boolean).join(" ") ||
      "Student";
    const teacherName =
      [assessment.teacherFirstName, assessment.teacherLastName]
        .filter(Boolean)
        .join(" ") ||
      assessment.teacherEmail ||
      "Teacher";
    const statusLabel = assessment.status || "In Progress";
    const scoreLabel =
      assessment.gradePercent === null || assessment.gradePercent === undefined
        ? "--"
        : `${Math.round(Number(assessment.gradePercent))}%`;
    const predictedLabel =
      assessment.predictedPercent === null ||
      assessment.predictedPercent === undefined
        ? "--"
        : `${Math.round(Number(assessment.predictedPercent))}%`;

    const { doc, sectionTitle, bodyLine, ensureSpace } = createPdfTemplateDocument({
      res,
      filename: `${assessment.title || "assessment"}_report`,
      reportTitle: "Assessment Report",
      reportSubtitle: "Detailed performance snapshot",
      metaLeft: [
        `STUDENT: ${studentName}`,
        `STUDENT ID: ${assessment.studentId || "--"}`,
        `SUBJECT: ${assessment.subject || "Subject"}`,
        `TYPE: ${assessment.type || "Assessment"}`,
      ],
      metaRight: [
        `Date: ${formatShortDate(assessment.assessmentDate) || "--"}`,
        `Status: ${statusLabel}`,
        `Score: ${scoreLabel}`,
        `Teacher: ${teacherName}`,
      ],
    });

    sectionTitle("Assessment Summary");
    bodyLine(`Title: ${assessment.title || "Assessment"}`, { bold: true });
    bodyLine(`Current Status: ${statusLabel}`);
    bodyLine(`Recorded Score: ${scoreLabel}`);
    bodyLine(`AI Predicted Score: ${predictedLabel}`);

    sectionTitle("AI Diagnostic");
    bodyLine(
      assessment.weakArea
        ? `Weak Area Identified: ${assessment.weakArea}`
        : "Weak Area Identified: Not specified yet.",
    );
    bodyLine(
      assessment.aiFeedback
        ? `Feedback: ${assessment.aiFeedback}`
        : "Feedback: No AI feedback has been attached to this assessment yet.",
    );

    sectionTitle("Recommended Next Steps");
    const actionItems = [
      assessment.weakArea
        ? `Practice more questions focused on "${assessment.weakArea}".`
        : "Review recent class notes and retry similar questions.",
      "Take one timed practice set and compare your result with this report.",
      "Track your next result to confirm improvement trend.",
    ];
    actionItems.forEach((item) => bodyLine(item, { bullet: true }));

    ensureSpace(48);
    doc.moveDown(0.8);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#64748b")
      .text(
        `Generated on ${formatShortDate(new Date())} by ClassIQ Student Insights.`,
      );

    doc.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

router.get("/assignments", async (req, res, next) => {
  try {
    const subjects = await getActiveSubjects(req.user.id);
    const normalizedSubjects = subjects
      .map((subject) => String(subject || "").trim().toLowerCase())
      .filter(Boolean);

    const [profileResult, ownResult] = await Promise.all([
      query(
        `SELECT class_id AS "classId",
                grade_level AS "gradeLevel",
                class_name AS "className"
           FROM user_profiles
          WHERE user_id = $1
          LIMIT 1`,
        [req.user.id],
      ),
      query(
        `SELECT a.id,
                a.title,
                a.subject,
                a.type,
                a.status,
                a.assessment_date AS "assessmentDate",
                a.created_at AS "createdAt",
                a.grade_percent AS "gradePercent",
                a.weak_area AS "weakArea",
                a.ai_feedback AS "aiFeedback",
                a.teacher_id AS "teacherId",
                tp.first_name AS "teacherFirstName",
                tp.last_name AS "teacherLastName",
                tu.email AS "teacherEmail",
                COUNT(*) OVER (
                  PARTITION BY lower(trim(COALESCE(a.subject, ''))),
                               lower(trim(COALESCE(a.type, ''))),
                               lower(trim(COALESCE(a.title, ''))),
                               a.teacher_id
                )::int AS "attemptCount"
           FROM assessments a
           LEFT JOIN user_profiles tp ON tp.user_id = a.teacher_id
           LEFT JOIN users tu ON tu.id = a.teacher_id
          WHERE a.user_id = $1
            AND a.teacher_id IS NOT NULL
            AND (
              cardinality($2::text[]) = 0
              OR lower(a.subject) = ANY($2::text[])
            )
          ORDER BY a.assessment_date DESC NULLS LAST, a.created_at DESC`,
        [req.user.id, normalizedSubjects],
      ),
    ]);

    const profile = profileResult.rows[0] || {};

    const ownAssignments = ownResult.rows
      .filter((row) => isTeacherAssignmentType(row.type))
      .map((row) => {
        const statusText = String(
          row.status || (row.gradePercent === null ? "In Progress" : "Completed"),
        )
          .trim()
          .toLowerCase();
        const isCompleted = statusText === "completed" || row.gradePercent !== null;
        const status = isCompleted ? "Completed" : "In Progress";
        const gradingState = !isCompleted
          ? "waiting_teacher_review"
          : row.aiFeedback
            ? "ai_graded"
            : "teacher_graded";
        const reviewStatus =
          gradingState === "ai_graded"
            ? "AI graded"
            : gradingState === "teacher_graded"
              ? "Teacher graded"
              : "Waiting teacher review";
        const category = getTeacherAssignmentCategory(row.type) || "assessment";
        const teacherName =
          [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(" ") ||
          row.teacherEmail ||
          "Teacher";
        const sortDateRaw = row.assessmentDate || row.createdAt || null;
        const sortDate = sortDateRaw ? new Date(sortDateRaw).getTime() : 0;
        return {
          id: row.id,
          title:
            String(row.title || "").trim() ||
            `${row.subject || "Subject"} ${row.type || "Assessment"}`.trim(),
          subject: row.subject || "Subject",
          type: row.type || "Assessment",
          category,
          status,
          date: formatShortDate(sortDateRaw),
          dueDate: formatIsoDate(sortDateRaw),
          grade: row.gradePercent === null ? null : formatPercent(row.gradePercent),
          weakArea: row.weakArea || null,
          aiFeedback: row.aiFeedback || null,
          reviewStatus,
          gradingState,
          attemptCount: Math.max(1, Number(row.attemptCount) || 1),
          source: "teacher_result",
          canStart: !isCompleted,
          canSubmit: !isCompleted,
          teacher: {
            id: row.teacherId,
            name: teacherName,
          },
          _key: buildTeacherAssignmentKey({
            teacherId: row.teacherId,
            subject: row.subject,
            type: row.type,
            title: row.title,
          }),
          _sortDate: Number.isFinite(sortDate) ? sortDate : 0,
        };
      });

    const ownKeys = new Set(ownAssignments.map((item) => item._key));
    let inferredAssignments = [];

    if (profile.classId || (profile.gradeLevel && profile.className)) {
      const { rows: classRows } = await query(
        `WITH ranked AS (
           SELECT a.title,
                  a.subject,
                  a.type,
                  a.assessment_date AS "assessmentDate",
                  a.created_at AS "createdAt",
                  a.teacher_id AS "teacherId",
                  tp.first_name AS "teacherFirstName",
                  tp.last_name AS "teacherLastName",
                  tu.email AS "teacherEmail",
                  ROW_NUMBER() OVER (
                    PARTITION BY lower(trim(COALESCE(a.subject, ''))),
                                 lower(trim(COALESCE(a.type, ''))),
                                 lower(trim(COALESCE(a.title, ''))),
                                 a.teacher_id
                    ORDER BY a.assessment_date DESC NULLS LAST, a.created_at DESC
                  ) AS row_no
             FROM assessments a
             JOIN user_profiles cp ON cp.user_id = a.user_id
             LEFT JOIN user_profiles tp ON tp.user_id = a.teacher_id
             LEFT JOIN users tu ON tu.id = a.teacher_id
            WHERE a.user_id <> $1
              AND a.teacher_id IS NOT NULL
              AND (
                cardinality($2::text[]) = 0
                OR lower(a.subject) = ANY($2::text[])
              )
              AND (
                ($3::uuid IS NOT NULL AND cp.class_id = $3::uuid)
                OR (
                  $3::uuid IS NULL
                  AND cp.grade_level = $4
                  AND cp.class_name = $5
                )
              )
         )
         SELECT title,
                subject,
                type,
                "assessmentDate",
                "createdAt",
                "teacherId",
                "teacherFirstName",
                "teacherLastName",
                "teacherEmail"
           FROM ranked
          WHERE row_no = 1
          ORDER BY "assessmentDate" DESC NULLS LAST, "createdAt" DESC`,
        [
          req.user.id,
          normalizedSubjects,
          profile.classId || null,
          profile.gradeLevel || null,
          profile.className || null,
        ],
      );

      inferredAssignments = classRows
        .filter((row) => isTeacherAssignmentType(row.type))
        .map((row, index) => {
          const key = buildTeacherAssignmentKey({
            teacherId: row.teacherId,
            subject: row.subject,
            type: row.type,
            title: row.title,
          });
          if (ownKeys.has(key)) return null;
          const teacherName =
            [row.teacherFirstName, row.teacherLastName].filter(Boolean).join(" ") ||
            row.teacherEmail ||
            "Teacher";
          const sortDateRaw = row.assessmentDate || row.createdAt || null;
          const sortDate = sortDateRaw ? new Date(sortDateRaw).getTime() : 0;
          return {
            id: `class-assignment-${row.teacherId || "teacher"}-${index + 1}`,
            title:
              String(row.title || "").trim() ||
              `${row.subject || "Subject"} ${row.type || "Assessment"}`.trim(),
            subject: row.subject || "Subject",
            type: row.type || "Assessment",
            category: getTeacherAssignmentCategory(row.type) || "assessment",
            status: "In Progress",
            date: formatShortDate(sortDateRaw),
            dueDate: formatIsoDate(sortDateRaw),
            grade: null,
            weakArea: null,
            aiFeedback: null,
            reviewStatus: "Not submitted",
            gradingState: "not_submitted",
            attemptCount: 0,
            source: "class_assignment",
            canStart: true,
            canSubmit: true,
            teacher: {
              id: row.teacherId || null,
              name: teacherName,
            },
            _key: key,
            _sortDate: Number.isFinite(sortDate) ? sortDate : 0,
          };
        })
        .filter(Boolean);
    }

    let teacherExerciseAssignments = [];
    if (await hasTeacherExerciseMetaSupport()) {
      const { rows: exerciseRows } = await query(
        `SELECT e.id,
                e.name,
                e.subject,
                e.question_count AS "questionCount",
                e.difficulty,
                e.exercise_date AS "exerciseDate",
                e.created_at AS "createdAt",
                e.assigned_by_teacher_id AS "teacherId",
                e.assignment_origin AS "assignmentOrigin",
                tp.first_name AS "teacherFirstName",
                tp.last_name AS "teacherLastName",
                tu.email AS "teacherEmail",
                latest.status AS "submissionStatus",
                latest.score AS "submissionScore",
                latest.submitted_at AS "submittedAt",
                latest.created_at AS "submissionCreatedAt",
                attempts.count AS "attemptCount"
           FROM exercises e
           LEFT JOIN user_profiles tp ON tp.user_id = e.assigned_by_teacher_id
           LEFT JOIN users tu ON tu.id = e.assigned_by_teacher_id
           LEFT JOIN LATERAL (
             SELECT es.status,
                    es.score,
                    es.submitted_at,
                    es.created_at
               FROM exercise_submissions es
              WHERE es.exercise_id = e.id
                AND es.user_id = e.user_id
              ORDER BY es.created_at DESC
              LIMIT 1
           ) latest ON TRUE
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS count
               FROM exercise_submissions es
              WHERE es.exercise_id = e.id
                AND es.user_id = e.user_id
           ) attempts ON TRUE
          WHERE e.user_id = $1
            AND e.assigned_by_teacher_id IS NOT NULL
            AND e.assignment_origin IN ('teacher_class_upload', 'teacher_generated')
            AND (
              cardinality($2::text[]) = 0
              OR lower(e.subject) = ANY($2::text[])
            )
          ORDER BY e.exercise_date DESC NULLS LAST, e.created_at DESC`,
        [req.user.id, normalizedSubjects],
      );

      teacherExerciseAssignments = exerciseRows.map((row) => {
        const submissionStatus = String(row.submissionStatus || "")
          .trim()
          .toLowerCase();
        const isCompleted = submissionStatus === "submitted";
        const status = isCompleted ? "Completed" : "In Progress";
        const teacherName =
          [row.teacherFirstName, row.teacherLastName]
            .filter(Boolean)
            .join(" ") ||
          row.teacherEmail ||
          "Teacher";
        const sortDateRaw =
          row.exerciseDate ||
          row.createdAt ||
          row.submittedAt ||
          row.submissionCreatedAt ||
          null;
        const sortDate = sortDateRaw ? new Date(sortDateRaw).getTime() : 0;
        const rawScore = Number(row.submissionScore);
        const hasScore = Number.isFinite(rawScore);
        return {
          id: `exercise-assignment-${row.id}`,
          exerciseId: row.id,
          title:
            String(row.name || "").trim() ||
            `${row.subject || "Subject"} Exercise`.trim(),
          subject: row.subject || "Subject",
          type: "Exercise",
          category: "exercise",
          status,
          date: formatShortDate(sortDateRaw),
          dueDate: formatIsoDate(row.exerciseDate || sortDateRaw),
          grade: hasScore ? formatPercent(Math.round(rawScore)) : null,
          weakArea: null,
          aiFeedback: null,
          reviewStatus: isCompleted
            ? hasScore
              ? "AI graded"
              : "Submitted"
            : "Not submitted",
          gradingState: isCompleted ? "ai_graded" : "not_submitted",
          attemptCount: Number(row.attemptCount) || 0,
          source: "teacher_exercise",
          canStart: !isCompleted,
          canSubmit: !isCompleted,
          teacher: {
            id: row.teacherId,
            name: teacherName,
          },
          _sortDate: Number.isFinite(sortDate) ? sortDate : 0,
        };
      });
    }

    const assignments = [
      ...teacherExerciseAssignments,
      ...ownAssignments,
      ...inferredAssignments,
    ]
      .sort((a, b) => {
        const statusRank = (item) =>
          String(item.status || "").toLowerCase() === "in progress" ? 0 : 1;
        const rankDiff = statusRank(a) - statusRank(b);
        if (rankDiff !== 0) return rankDiff;
        return (b._sortDate || 0) - (a._sortDate || 0);
      })
      .map(({ _key, _sortDate, ...assignment }) => assignment);

    return res.json({ assignments });
  } catch (error) {
    return next(error);
  }
});

router.post("/assignments/export", async (req, res, next) => {
  try {
    const rawItems = Array.isArray(req.body?.assignments)
      ? req.body.assignments
      : [];
    const items = rawItems
      .slice(0, 200)
      .map((item) => ({
        title: String(item?.title || "").trim() || "Assignment",
        subject: String(item?.subject || "").trim() || "Subject",
        type: String(item?.type || "").trim() || "Assessment",
        status: String(item?.status || "").trim() || "In Progress",
        reviewStatus: String(item?.reviewStatus || "").trim() || "Not submitted",
        grade: item?.grade ? String(item.grade) : "--",
        dueDate: String(item?.dueDate || item?.date || "").trim() || "--",
        teacherName: String(item?.teacher?.name || "").trim() || "Teacher",
        attemptCount: Number(item?.attemptCount) || 0,
        weakArea: String(item?.weakArea || "").trim(),
        aiFeedback: String(item?.aiFeedback || "").trim(),
      }))
      .filter((item) => item.title);

    if (items.length === 0) {
      return res.status(400).json({ error: "No assignment data to export." });
    }

    const total = items.length;
    const completedCount = items.filter(
      (item) => item.status.toLowerCase() === "completed",
    ).length;
    const pendingCount = total - completedCount;
    const filters = req.body?.filters || {};
    const subjectFilter = String(filters.subject || "All").trim() || "All";
    const statusFilter = String(filters.status || "All").trim() || "All";
    const searchFilter = String(filters.search || "").trim() || "None";

    const { rows: profileRows } = await query(
      `SELECT first_name AS "firstName",
              last_name AS "lastName",
              student_id AS "studentId"
         FROM user_profiles
        WHERE user_id = $1
        LIMIT 1`,
      [req.user.id],
    );
    const profile = profileRows[0] || {};
    const studentName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Student";

    const { doc, sectionTitle, bodyLine, ensureSpace } = createPdfTemplateDocument({
      res,
      filename: `assignments_export_${new Date().toISOString().slice(0, 10)}`,
      reportTitle: "Assignments Export",
      reportSubtitle: "Organized assignment tracker",
      metaLeft: [
        `STUDENT: ${studentName}`,
        `STUDENT ID: ${profile.studentId || "--"}`,
        `TOTAL: ${total}`,
        `COMPLETED: ${completedCount} | PENDING: ${pendingCount}`,
      ],
      metaRight: [
        `Generated: ${formatShortDate(new Date()) || "--"}`,
        `Subject Filter: ${subjectFilter}`,
        `Status Filter: ${statusFilter}`,
        `Search: ${searchFilter}`,
      ],
    });

    sectionTitle("Assignment Details");
    items.forEach((item, index) => {
      ensureSpace(120);
      doc
        .roundedRect(doc.page.margins.left, doc.y, doc.page.width - 100, 92, 8)
        .fillColor("#f8fafc")
        .fill();
      doc
        .font("Helvetica-Bold")
        .fontSize(11.5)
        .fillColor("#0f172a")
        .text(`${index + 1}. ${item.title}`, doc.page.margins.left + 12, doc.y + 10, {
          width: doc.page.width - 124,
        });
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor("#334155")
        .text(
          `${item.subject} | ${item.type} | Status: ${item.status} | Review: ${item.reviewStatus}`,
          doc.page.margins.left + 12,
          doc.y + 4,
          { width: doc.page.width - 124 },
        );
      doc
        .font("Helvetica")
        .fontSize(10.5)
        .fillColor("#334155")
        .text(
          `Teacher: ${item.teacherName} | Due: ${item.dueDate} | Score: ${item.grade} | Attempts: ${item.attemptCount}`,
          doc.page.margins.left + 12,
          doc.y + 4,
          { width: doc.page.width - 124 },
        );
      if (item.weakArea) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#475569")
          .text(`Weak Area: ${item.weakArea}`, doc.page.margins.left + 12, doc.y + 4, {
            width: doc.page.width - 124,
          });
      }
      if (item.aiFeedback) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#475569")
          .text(`Feedback: ${item.aiFeedback}`, doc.page.margins.left + 12, doc.y + 4, {
            width: doc.page.width - 124,
          });
      }
      doc.y += 18;
    });

    sectionTitle("Quick Notes");
    bodyLine("Use this export to review due dates and focus weak areas quickly.");
    bodyLine("Prioritize pending items with teacher review still waiting.", {
      bullet: true,
    });
    bodyLine("Revisit tasks with weak areas before your next submission.", {
      bullet: true,
    });

    doc.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

router.get("/exercises/today-subjects", async (req, res, next) => {
  try {
    const activeSubjects = await getActiveSubjects(req.user.id);
    if (activeSubjects.length === 0) {
      return res.json({
        subjects: [],
        recommended: [],
        source: "none",
        limits: {
          maxDailyExercises: MAX_DAILY_EXERCISES,
          maxDailySubjects: MAX_DAILY_SUBJECTS,
          remainingExercises: 0,
        },
      });
    }

    const [dailyStats, todayPlan] = await Promise.all([
      getDailyExerciseStats(req.user.id),
      getTodaySubjectPlan(req.user.id, activeSubjects),
    ]);

    const remainingExercises = Math.max(
      0,
      MAX_DAILY_EXERCISES - (dailyStats.total || 0),
    );

    return res.json({
      subjects: activeSubjects,
      recommended: todayPlan.subjects,
      source: todayPlan.source,
      limits: {
        maxDailyExercises: MAX_DAILY_EXERCISES,
        maxDailySubjects: MAX_DAILY_SUBJECTS,
        remainingExercises,
        generatedToday: dailyStats.total || 0,
        distinctSubjectsToday: dailyStats.distinctSubjects || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/lesson-progress", async (req, res, next) => {
  try {
    const activeSubjects = await getActiveSubjects(req.user.id);
    if (activeSubjects.length === 0) {
      return res.json({ lessons: [] });
    }

    const requestedSubject = String(req.query.subject || "").trim();
    const subjectFilter = requestedSubject
      ? resolveRequestedSubject(activeSubjects, requestedSubject)
      : null;
    if (requestedSubject && !subjectFilter) {
      return res.status(400).json({ error: "Subject is not active for this student." });
    }

    const targetSubjects = subjectFilter ? [subjectFilter] : activeSubjects;
    const lessons = [];

    for (const subjectName of targetSubjects) {
      const context = await getStudentSubjectContext(req.user.id, subjectName);
      if (!context) continue;

      const lesson = await getInheritedLessonContext({
        classId: context.classId || context.profileClassId || null,
        subjectId: context.subjectId,
      });
      const focus = await getStudentTopicFocus(req.user.id, context.subjectId);
      const updatedBy =
        [lesson?.updatedByFirstName, lesson?.updatedByLastName]
          .filter(Boolean)
          .join(" ") ||
        lesson?.updatedByEmail ||
        null;

      lessons.push({
        subject: subjectName,
        subjectId: context.subjectId,
        classId: context.classId || context.profileClassId || null,
        className: context.className || null,
        gradeLevel: context.gradeLevel || null,
        lesson: lesson
          ? {
              id: lesson.id,
              unitTitle: lesson.unitTitle,
              lessonNumber: lesson.lessonNumber,
              topic: lesson.topic,
              pageFrom: lesson.pageFrom,
              pageTo: lesson.pageTo,
              term: lesson.term,
              weekNumber: lesson.weekNumber,
              notes: lesson.notes,
              effectiveDate: formatIsoDate(lesson.effectiveDate),
              updatedAt: lesson.updatedAt,
              updatedBy,
            }
          : null,
        focusTopic: focus?.topic || null,
      });
    }

    return res.json({ lessons });
  } catch (error) {
    return next(error);
  }
});

router.get("/exercises", async (req, res, next) => {
  try {
    const includeQuestions = req.query.includeQuestions === "true";
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.json({ exercises: [] });
    }

    const { rows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.difficulty,
              e.question_count AS "questionCount",
              e.exercise_date AS "exerciseDate",
              latest.id AS "latestSubmissionId",
              latest.status AS "submissionStatus",
              latest.score AS "submissionScore",
              latest.submitted_at AS "submittedAt",
              latest.created_at AS "submissionCreatedAt",
              attempts.count AS "attemptCount"
         FROM exercises e
         LEFT JOIN LATERAL (
           SELECT es.id,
                  es.status,
                  es.score,
                  es.submitted_at,
                  es.created_at
             FROM exercise_submissions es
            WHERE es.exercise_id = e.id
              AND es.user_id = e.user_id
            ORDER BY es.created_at DESC
            LIMIT 1
         ) latest ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS count
             FROM exercise_submissions es
            WHERE es.exercise_id = e.id
              AND es.user_id = e.user_id
         ) attempts ON TRUE
        WHERE e.user_id = $1
          AND e.subject = ANY($2::text[])
        ORDER BY e.exercise_date DESC, e.created_at DESC`,
      [req.user.id, subjects],
    );

    let questionsByExercise = {};
    if (includeQuestions && rows.length > 0) {
      const ids = rows.map((row) => row.id);
      const { rows: questionRows } = await query(
        `SELECT id, exercise_id AS "exerciseId",
                question_text AS "text",
                question_type AS "type",
                question_order AS "order"
           FROM exercise_questions
          WHERE exercise_id = ANY($1::uuid[])
          ORDER BY question_order`,
        [ids],
      );
      questionsByExercise = questionRows.reduce((acc, row) => {
        if (!acc[row.exerciseId]) acc[row.exerciseId] = [];
        acc[row.exerciseId].push({
          id: row.id,
          text: row.text,
          type: row.type,
        });
        return acc;
      }, {});
    }

    return res.json({
      exercises: rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        difficulty: row.difficulty,
        questionCount: row.questionCount,
        date: formatShortDate(row.exerciseDate),
        submissionId: row.latestSubmissionId || null,
        submissionStatus: row.submissionStatus || null,
        submissionScore:
          row.submissionScore === null || row.submissionScore === undefined
            ? null
            : Number(row.submissionScore),
        submittedAt: row.submittedAt || row.submissionCreatedAt || null,
        attemptCount: Number(row.attemptCount) || 0,
        questions: includeQuestions ? questionsByExercise[row.id] || [] : undefined,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/exercises/generate", aiLimiter, async (req, res, next) => {
  try {
    const { subject, questionCount, difficulty, weakArea, topic } = req.body || {};
    const activeSubjects = await getActiveSubjects(req.user.id);
    if (activeSubjects.length === 0) {
      return res.status(400).json({
        error: "No active subjects found for this student.",
      });
    }
    const requestedSubjectRaw = String(subject || "").trim();
    if (!requestedSubjectRaw) {
      return res.status(400).json({
        error: "Subject is required to generate an exercise.",
      });
    }
    const requestedSubject = resolveRequestedSubject(
      activeSubjects,
      requestedSubjectRaw,
    );
    if (!requestedSubject) {
      return res.status(400).json({
        error: "Selected subject is not active for this student.",
      });
    }

    const { rows: profileRows } = await query(
      `SELECT first_name AS "firstName",
              last_name AS "lastName",
              grade_level AS "gradeLevel",
              class_name AS "className",
              class_id AS "classId"
         FROM user_profiles
        WHERE user_id = $1`,
      [req.user.id],
    );
    const profile = profileRows[0] || {};

    const { rows: latestRows } = await query(
      `SELECT weak_area AS "weakArea",
              grade_percent AS "gradePercent"
         FROM assessments
        WHERE user_id = $1
          AND LOWER(subject) = LOWER($2)
        ORDER BY assessment_date DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      [req.user.id, requestedSubject],
    );
    const latestAssessment = latestRows[0] || null;
    const resolvedSubject = requestedSubject;

    const [dailyStats, todayPlan] = await Promise.all([
      getDailyExerciseStats(req.user.id),
      getTodaySubjectPlan(req.user.id, activeSubjects),
    ]);
    const normalizedResolvedSubject = normalizeSubjectToken(resolvedSubject);
    const subjectAlreadyGeneratedToday = dailyStats.subjects.includes(
      normalizedResolvedSubject,
    );
    if (dailyStats.total >= MAX_DAILY_EXERCISES) {
      return res.status(429).json({
        error: `Daily exercise limit reached (${MAX_DAILY_EXERCISES}). Try again tomorrow.`,
      });
    }
    if (
      !subjectAlreadyGeneratedToday &&
      dailyStats.distinctSubjects >= MAX_DAILY_SUBJECTS
    ) {
      return res.status(429).json({
        error: `Daily subject limit reached (${MAX_DAILY_SUBJECTS}). Continue with today's active subjects.`,
        recommendedSubjects: todayPlan.subjects,
      });
    }

    const subjectContext = await getStudentSubjectContext(
      req.user.id,
      resolvedSubject,
    );
    if (!subjectContext?.subjectId) {
      return res.status(400).json({
        error: "Subject context not found. Check your enrollment for this subject.",
      });
    }

    const inheritedLesson = await getInheritedLessonContext({
      classId:
        subjectContext.classId || subjectContext.profileClassId || profile.classId || null,
      subjectId: subjectContext.subjectId,
    });
    const storedFocus = await getStudentTopicFocus(
      req.user.id,
      subjectContext.subjectId,
    );
    const requestedTopic = String(topic || "").trim();
    const resolvedLessonTopic =
      String(inheritedLesson?.topic || "").trim() ||
      String(storedFocus?.topic || "").trim() ||
      requestedTopic;

    if (!String(inheritedLesson?.topic || "").trim()) {
      if (!resolvedLessonTopic) {
        return res.status(400).json({
          code: "TOPIC_REQUIRED",
          error:
            "No lesson has been set for this subject yet. Enter the current topic once to continue.",
          subject: resolvedSubject,
        });
      }
      if (
        requestedTopic &&
        requestedTopic.toLowerCase() !==
          String(storedFocus?.topic || "").trim().toLowerCase()
      ) {
        await upsertStudentTopicFocus({
          studentId: req.user.id,
          subjectId: subjectContext.subjectId,
          topic: requestedTopic,
          source: "student",
        });
      }
    }

    const { rows: subjectBookRows } = await query(
      `SELECT id,
              name,
              subject,
              file_url AS "url",
              bucket,
              file_path AS "filePath",
              file_type AS "type",
              resource_date AS "resourceDate",
              levels
         FROM resources
        WHERE ${isBooksBucketSql}
          AND ${subjectMatchSql}
          AND (
            $2::text IS NULL
            OR levels IS NULL
            OR array_length(levels, 1) = 0
            OR EXISTS (
              SELECT 1
              FROM unnest(levels) level_item
              WHERE lower(level_item) = lower($2)
                 OR lower($2) LIKE lower(level_item) || '%'
                 OR lower(level_item) LIKE lower($2) || '%'
            )
          )
        ORDER BY resource_date DESC NULLS LAST
        LIMIT 8`,
      [resolvedSubject, profile.gradeLevel || null],
    );

    let bookRows = subjectBookRows;
    if (bookRows.length === 0) {
      const { rows: fallbackBookRows } = await query(
        `SELECT id,
                name,
                subject,
                file_url AS "url",
                bucket,
                file_path AS "filePath",
                file_type AS "type",
                resource_date AS "resourceDate",
                levels
           FROM resources
          WHERE ${isBooksBucketSql}
          ORDER BY resource_date DESC NULLS LAST
          LIMIT 8`,
        [],
      );
      bookRows = fallbackBookRows;
    }

    if (bookRows.length === 0) {
      return res.status(400).json({
        error:
          "No resources were found in the Books bucket. Upload books to the Books bucket first.",
      });
    }

    const bookContext = await buildBookResourceContext(bookRows);
    const baseBookContext =
      bookContext.length > 0
        ? bookContext
        : bookRows.slice(0, 4).map((row) => ({
            id: row.id,
            title: String(row.name || "Book").trim().slice(0, 140),
            excerpt: "",
            url: buildResourceUrl(row),
          }));
    const safeBookContext = filterResourceContextByTopic(
      baseBookContext,
      resolvedLessonTopic,
    );

    const safeDifficulty = normalizeDifficultyLabel(difficulty);
    const safeQuestionCount = await resolveRequestedQuestionCount({
      userId: req.user.id,
      subject: resolvedSubject,
      requestedCount: questionCount,
      difficulty: safeDifficulty,
    });
    const latestPercent = toNumberOrNull(latestAssessment?.gradePercent);
    const inferredWeakArea = inferWeakArea({
      subject: resolvedSubject,
      gradePercent: latestPercent === null ? 55 : latestPercent,
    });
    const resolvedWeakArea =
      String(weakArea || "").trim() ||
      String(latestAssessment?.weakArea || "").trim() ||
      (resolvedLessonTopic
        ? `${resolvedLessonTopic} application and mastery`
        : inferredWeakArea);

    const studentName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      req.user.email ||
      "Student";
    const lessonPages =
      inheritedLesson?.pageFrom && inheritedLesson?.pageTo
        ? `${inheritedLesson.pageFrom}-${inheritedLesson.pageTo}`
        : inheritedLesson?.pageFrom
          ? `${inheritedLesson.pageFrom}`
          : "";
    const lessonContext = {
      topic: resolvedLessonTopic || "",
      unit: inheritedLesson?.unitTitle || "",
      pages: lessonPages,
      label: inheritedLesson
        ? [
            inheritedLesson.term ? `Term ${inheritedLesson.term}` : null,
            inheritedLesson.weekNumber
              ? `Week ${inheritedLesson.weekNumber}`
              : null,
            inheritedLesson.lessonNumber
              ? `Lesson ${inheritedLesson.lessonNumber}`
              : null,
          ]
            .filter(Boolean)
            .join(" | ")
        : "Student selected topic",
    };

    const geminiExercise = await generateExerciseWithGemini({
      subject: resolvedSubject,
      gradeLevel: profile.gradeLevel || null,
      className: subjectContext.className || profile.className || null,
      weakArea: resolvedWeakArea,
      studentName,
      lessonContext,
      questionCount: safeQuestionCount,
      difficulty: safeDifficulty,
      resourceContext: safeBookContext,
    });

    const fallbackQuestions = buildFallbackExerciseQuestions({
      subject: resolvedSubject,
      weakArea:
        resolvedLessonTopic && resolvedLessonTopic.length > 0
          ? `${resolvedLessonTopic} - ${resolvedWeakArea}`
          : resolvedWeakArea,
      questionCount: safeQuestionCount,
      resourceContext: safeBookContext,
    });

    const selectedQuestions =
      Array.isArray(geminiExercise?.questions) &&
      geminiExercise.questions.length > 0
        ? geminiExercise.questions.slice(0, safeQuestionCount)
        : fallbackQuestions;
    const generationMode = geminiExercise ? "gemini" : "books-fallback";

    const fallbackSuffix = Date.now().toString().slice(-6);
    const rawGeneratedName = String(geminiExercise?.name || "").trim();
    const safeGeneratedName = sanitizeExerciseTitle({
      title: rawGeneratedName,
      subject: resolvedSubject,
      weakArea: resolvedWeakArea,
      studentName,
      email: req.user.email || "",
    });
    const exerciseName =
      safeGeneratedName ||
      `${resolvedSubject} Practice - ${resolvedWeakArea} Set ${fallbackSuffix}`;
    const exerciseDifficulty = normalizeDifficultyLabel(
      geminiExercise?.difficulty || safeDifficulty,
    );

    const { rows: exerciseRows } = await query(
      `INSERT INTO exercises (
          user_id,
          name,
          subject,
          difficulty,
          question_count,
          exercise_date,
          subject_id
        )
       VALUES ($1, $2, $3, $4, $5, now(), $6)
       RETURNING id,
                 name,
                 subject,
                 difficulty,
                 question_count AS "questionCount",
                 exercise_date AS "exerciseDate"`,
      [
        req.user.id,
        exerciseName.slice(0, 180),
        resolvedSubject,
        exerciseDifficulty,
        selectedQuestions.length,
        subjectContext.subjectId || null,
      ],
    );

    const createdExercise = exerciseRows[0];
    const insertValues = [];
    const insertParams = [];
    let idx = 1;

    selectedQuestions.forEach((question, order) => {
      insertValues.push(
        "($" +
          idx++ +
          ", $" +
          idx++ +
          ", $" +
          idx++ +
          ", $" +
          idx++ +
          ", $" +
          idx++ +
          ", $" +
          idx++ +
          ")",
      );
      insertParams.push(
        createdExercise.id,
        order + 1,
        String(question.text || `Question ${order + 1}`)
          .trim()
          .slice(0, 1800),
        String(question.type || "Short Answer")
          .trim()
          .slice(0, 80),
        String(question.answer || "")
          .trim()
          .slice(0, 500),
        clamp(toNumberOrNull(question.points) ?? 1, 1, 5),
      );
    });

    const { rows: insertedQuestionRows } = await query(
      `INSERT INTO exercise_questions (
          exercise_id,
          question_order,
          question_text,
          question_type,
          correct_answer,
          points
        )
       VALUES ${insertValues.join(", ")}
       RETURNING id,
                 question_text AS "text",
                 question_type AS "type",
                 question_order AS "order"`,
      insertParams,
    );

    const orderedQuestions = insertedQuestionRows
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((row) => ({
        id: row.id,
        text: row.text,
        type: row.type,
      }));

    await query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, $2, $3)`,
      [
        req.user.id,
        "Exercise generated",
        `A new ${resolvedSubject} exercise is ready.${resolvedLessonTopic ? ` Topic: ${resolvedLessonTopic}.` : ""} Focus area: ${resolvedWeakArea}.`,
      ],
    );

    await logAudit(req, "student_exercise_generated", {
      exerciseId: createdExercise.id,
      subject: resolvedSubject,
      questionCount: orderedQuestions.length,
      generatedWith: generationMode,
      weakArea: resolvedWeakArea,
      lessonTopic: resolvedLessonTopic || null,
      lessonSource: inheritedLesson ? "class-lesson-tracker" : "student-topic",
      todayPlanSource: todayPlan.source,
      booksMatched: bookRows.length,
    });

    return res.status(201).json({
      exercise: {
        id: createdExercise.id,
        name: createdExercise.name,
        subject: createdExercise.subject,
        difficulty: createdExercise.difficulty,
        questionCount: createdExercise.questionCount,
        date: formatShortDate(createdExercise.exerciseDate),
        questions: orderedQuestions,
        generatedWith: generationMode,
        weakArea: resolvedWeakArea,
        lessonContext: {
          topic: resolvedLessonTopic || null,
          unitTitle: inheritedLesson?.unitTitle || null,
          lessonNumber: inheritedLesson?.lessonNumber || null,
          pageFrom: inheritedLesson?.pageFrom || null,
          pageTo: inheritedLesson?.pageTo || null,
          source: inheritedLesson ? "class-lesson-tracker" : "student-topic",
        },
        recommendedTodaySubjects: todayPlan.subjects,
        limits: {
          maxDailyExercises: MAX_DAILY_EXERCISES,
          maxDailySubjects: MAX_DAILY_SUBJECTS,
          generatedToday: dailyStats.total + 1,
          remainingExercises: Math.max(
            0,
            MAX_DAILY_EXERCISES - (dailyStats.total + 1),
          ),
        },
        references: safeBookContext.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url || null,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/exercises/:id", async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    if (!isUuid(exerciseId)) {
      return res.status(400).json({ error: "Invalid exercise id." });
    }
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.status(404).json({ error: "Exercise not found." });
    }
    const { rows } = await query(
      `SELECT id, name, subject, difficulty,
              question_count AS "questionCount",
              exercise_date AS "exerciseDate"
         FROM exercises
        WHERE user_id = $1
          AND id = $2
          AND subject = ANY($3::text[])`,
      [req.user.id, exerciseId, subjects],
    );

    const exercise = rows[0];
    if (!exercise) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    const { rows: questionRows } = await query(
      `SELECT id,
              question_text AS "text",
              question_type AS "type",
              question_order AS "order"
         FROM exercise_questions
        WHERE exercise_id = $1
        ORDER BY question_order`,
      [exerciseId],
    );

    return res.json({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        subject: exercise.subject,
        difficulty: exercise.difficulty,
        questionCount: exercise.questionCount,
        date: formatShortDate(exercise.exerciseDate),
        questions: questionRows.map((row) => ({
          id: row.id,
          text: row.text,
          type: row.type,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/exercises/:id/review", async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    if (!isUuid(exerciseId)) {
      return res.status(400).json({ error: "Invalid exercise id." });
    }

    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    const { rows: exerciseRows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.difficulty,
              e.question_count AS "questionCount",
              e.exercise_date AS "exerciseDate",
              latest.id AS "submissionId",
              latest.status AS "submissionStatus",
              latest.score AS "submissionScore",
              latest.submitted_at AS "submittedAt",
              latest.created_at AS "submissionCreatedAt",
              attempts.count AS "attemptCount"
         FROM exercises e
         LEFT JOIN LATERAL (
           SELECT es.id,
                  es.status,
                  es.score,
                  es.submitted_at,
                  es.created_at
             FROM exercise_submissions es
            WHERE es.exercise_id = e.id
              AND es.user_id = e.user_id
            ORDER BY es.created_at DESC
            LIMIT 1
         ) latest ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS count
             FROM exercise_submissions es
            WHERE es.exercise_id = e.id
              AND es.user_id = e.user_id
         ) attempts ON TRUE
        WHERE e.id = $1
          AND e.user_id = $2
          AND e.subject = ANY($3::text[])`,
      [exerciseId, req.user.id, subjects],
    );

    const exercise = exerciseRows[0];
    if (!exercise) {
      return res.status(404).json({ error: "Exercise not found." });
    }
    if (!exercise.submissionId) {
      return res.status(400).json({
        error: "No submission found for this exercise yet.",
      });
    }

    const { rows: questionRows } = await query(
      `SELECT q.id,
              q.question_order AS "order",
              q.question_text AS "text",
              q.question_type AS "type",
              q.correct_answer AS "correctAnswer",
              COALESCE(q.points, 1) AS points,
              a.answer_text AS "studentAnswer"
         FROM exercise_questions q
         LEFT JOIN exercise_answers a
           ON a.question_id = q.id
          AND a.submission_id = $2
        WHERE q.exercise_id = $1
        ORDER BY q.question_order`,
      [exerciseId, exercise.submissionId],
    );

    const questionReviews = questionRows.map((row) => {
      const safePoints = Number.isFinite(Number(row.points))
        ? Number(row.points)
        : 1;
      const parsedChoice = isMultipleChoiceType(row.type)
        ? parseMultipleChoiceQuestion(row.text)
        : { prompt: String(row.text || "").trim(), options: [] };
      const submittedAnswer = String(row.studentAnswer || "");
      const grading = gradeExerciseQuestion({
        questionType: row.type,
        submittedAnswer,
        correctAnswer: row.correctAnswer,
        points: safePoints,
        manualReviewOpenQuestions: false,
      });
      const feedback = buildQuestionReviewFeedback({
        questionType: row.type,
        submittedAnswer,
        correctAnswer: row.correctAnswer,
        grading,
        points: safePoints,
        options: parsedChoice.options,
      });

      return {
        id: row.id,
        order: row.order,
        type: row.type || "Question",
        text: row.text || "",
        prompt: parsedChoice.prompt || String(row.text || "").trim(),
        options: parsedChoice.options,
        points: safePoints,
        studentAnswer: submittedAnswer,
        correctAnswer: String(row.correctAnswer || ""),
        isCorrect: Boolean(grading.isCorrect),
        earnedPoints: Number(
          Number(grading.earnedPoints || 0).toFixed(2),
        ),
        needsTeacherReview: Boolean(grading.needsTeacherReview),
        gradingMode: grading.mode || "auto",
        feedback,
      };
    });

    const reviewMeta = inferSubmissionReviewStatus(questionReviews);

    return res.json({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        subject: exercise.subject,
        difficulty: exercise.difficulty,
        questionCount: exercise.questionCount,
        date: formatShortDate(exercise.exerciseDate),
      },
      submission: {
        id: exercise.submissionId,
        status: exercise.submissionStatus || "submitted",
        score:
          exercise.submissionScore === null ||
          exercise.submissionScore === undefined
            ? null
            : Number(exercise.submissionScore),
        submittedAt: exercise.submittedAt || exercise.submissionCreatedAt || null,
        attemptCount: Number(exercise.attemptCount) || 1,
        reviewStatus: reviewMeta.status,
        pendingTeacherCount: reviewMeta.pendingTeacher,
        aiReviewedCount: reviewMeta.autoReviewed,
      },
      questions: questionReviews,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/exercises/:id/submit", async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    if (!isUuid(exerciseId)) {
      return res.status(400).json({ error: "Invalid exercise id." });
    }

    const { rows: existingRows } = await query(
      `SELECT id, status
           FROM exercise_submissions
          WHERE user_id = $1
            AND exercise_id = $2
          ORDER BY created_at DESC
          LIMIT 1`,
      [req.user.id, exerciseId],
    );

    if (existingRows[0]) {
      return res
        .status(409)
        .json({ error: "You have already taken this exercise." });
    }

    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    const { status, answers, openQuestionMode } = req.body || {};
    const submissionStatus =
      status === "in_progress" ? "in_progress" : "submitted";
    const normalizedOpenQuestionMode = String(openQuestionMode || "auto")
      .trim()
      .toLowerCase();
    const manualReviewOpenQuestions =
      normalizedOpenQuestionMode === "teacher_review";

    const { rows: exerciseRows } = await query(
      `SELECT id, name, subject, subject_id AS "subjectId"
           FROM exercises
          WHERE id = $1
            AND user_id = $2
            AND subject = ANY($3::text[])`,
      [exerciseId, req.user.id, subjects],
    );

    if (!exerciseRows[0]) {
      return res.status(404).json({ error: "Exercise not found." });
    }
    const exercise = exerciseRows[0];

    const { rows: submissionRows } = await query(
      `INSERT INTO exercise_submissions (user_id, exercise_id, status)
       VALUES ($1, $2, $3)
       RETURNING id, status, submitted_at AS "submittedAt", created_at AS "createdAt"`,
      [req.user.id, exerciseId, submissionStatus],
    );

    const submission = submissionRows[0];

    const normalizedAnswers = Array.isArray(answers) ? answers : [];
    if (normalizedAnswers.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;
      for (const answer of normalizedAnswers) {
        if (!answer.questionId) continue;
        values.push(`($${idx++}, $${idx++}, $${idx++})`);
        params.push(submission.id, answer.questionId, answer.answerText || "");
      }

      if (values.length > 0) {
        await query(
          `INSERT INTO exercise_answers (submission_id, question_id, answer_text)
           VALUES ${values.join(", ")}`,
          params,
        );
      }
    }

    let score = null;
    let manualReviewCount = 0;
    let evaluatedQuestions = [];
    if (normalizedAnswers.length > 0) {
      const { rows: questionRows } = await query(
        `SELECT id,
                question_text AS "questionText",
                question_type AS "questionType",
                correct_answer AS "correctAnswer",
                COALESCE(points, 1) AS points
           FROM exercise_questions
          WHERE exercise_id = $1`,
        [exerciseId],
      );

      const answerMap = new Map(
        normalizedAnswers
          .filter((ans) => ans.questionId)
          .map((ans) => [String(ans.questionId), ans.answerText]),
      );

      let totalPoints = 0;
      let earnedPoints = 0;

      for (const q of questionRows) {
        const pointsValue = Number(q.points);
        const points = Number.isFinite(pointsValue) ? pointsValue : 1;
        const submitted = answerMap.get(String(q.id));
        const hasSubmission =
          submitted !== undefined && String(submitted || "").trim() !== "";
        const grading = gradeExerciseQuestion({
          questionType: q.questionType,
          submittedAnswer: hasSubmission ? submitted : "",
          correctAnswer: q.correctAnswer,
          points,
          manualReviewOpenQuestions,
        });

        if (grading.needsTeacherReview) {
          manualReviewCount += 1;
        }

        evaluatedQuestions.push({
          question: q.questionText || "",
          type: q.questionType || "Question",
          studentAnswer: hasSubmission ? String(submitted || "") : "",
          correctAnswer: String(q.correctAnswer || ""),
          isCorrect: grading.isCorrect,
          earnedPoints: Number(grading.earnedPoints.toFixed(2)),
          points,
          needsTeacherReview: grading.needsTeacherReview,
          gradingMode: grading.mode,
        });

        if (grading.countInScore) {
          totalPoints += points;
        }
        if (!hasSubmission) continue;
        if (!grading.countInScore) continue;

        const boundedEarned = Math.max(
          0,
          Math.min(points, Number(grading.earnedPoints) || 0),
        );
        earnedPoints += boundedEarned;
      }

      if (totalPoints > 0) {
        score = Math.max(0, Math.min(100, Math.round((earnedPoints / totalPoints) * 100)));
        await query(`UPDATE exercise_submissions SET score = $1 WHERE id = $2`, [
          score,
          submission.id,
        ]);
      }
    }

    if (submissionStatus === "submitted") {
      if (score !== null) {
        const { rows: profileRows } = await query(
          `SELECT grade_level AS "gradeLevel",
                  class_name AS "className"
             FROM user_profiles
            WHERE user_id = $1`,
          [req.user.id],
        );
        const profile = profileRows[0] || {};

        const fallbackWeakArea = inferWeakArea({
          subject: exercise.subject,
          gradePercent: score,
        });
        const fallbackImprovements = buildExerciseImprovementSuggestions({
          subject: exercise.subject,
          weakArea: fallbackWeakArea,
          score,
        });

        const aiAnalysis = await analyzeExerciseSubmissionWithGemini({
          subject: exercise.subject,
          gradeLevel: profile.gradeLevel || null,
          className: profile.className || null,
          exerciseName: exercise.name,
          score,
          weakAreaHint: fallbackWeakArea,
          answeredQuestions: evaluatedQuestions,
        });

        const resolvedWeakArea =
          String(aiAnalysis?.weakArea || "").trim() || fallbackWeakArea;
        const resolvedImprovements =
          Array.isArray(aiAnalysis?.improvements) &&
          aiAnalysis.improvements.length > 0
            ? aiAnalysis.improvements
            : fallbackImprovements;
        const resolvedFeedback =
          String(aiAnalysis?.feedback || "").trim() ||
          `Primary weak area: ${resolvedWeakArea}. Improvement plan: ${resolvedImprovements.join(" ")}`;

        const { rows: insertedAssessmentRows } = await query(
          `INSERT INTO assessments (
              user_id, title, subject, type,
              assessment_date, status, grade_percent,
              weak_area, ai_feedback
            )
           VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8)
        RETURNING id, assessment_date AS "assessmentDate"`,
          [
            req.user.id,
            exercise.name,
            exercise.subject,
            "Exercise",
            "Completed",
            score,
            resolvedWeakArea,
            resolvedFeedback,
          ],
        );
        const insertedAssessment = insertedAssessmentRows[0] || null;

        const plpStatus = inferPlpStatus(score);
        const subjectCode = buildPlpVersionCode({
          subject: exercise.subject || "Subject",
          assessmentId: insertedAssessment?.id || null,
          assessmentDate: insertedAssessment?.assessmentDate || new Date(),
        });
        const detailedPlpFeedback = buildDetailedExercisePlpFeedback({
          subject: exercise.subject || "Subject",
          exerciseName: exercise.name,
          score,
          weakArea: resolvedWeakArea,
          improvements: resolvedImprovements,
          aiFeedback: resolvedFeedback,
        });

        const { rows: existingPlpRows } = await query(
          `SELECT id
             FROM plp_subjects
            WHERE user_id = $1
              AND subject_code = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [req.user.id, subjectCode],
        );

        let plpSubjectId = existingPlpRows[0]?.id || null;
        if (plpSubjectId) {
          await query(
            `UPDATE plp_subjects
                SET subject_id = COALESCE($2, subject_id),
                    category = $3,
                    progress = $4,
                    status = $5,
                    last_assessment = $6,
                    feedback = $7,
                    teacher_name = $8
              WHERE id = $1`,
            [
              plpSubjectId,
              exercise.subjectId || null,
              "Exercise",
              score,
              plpStatus,
              formatIsoDate(insertedAssessment?.assessmentDate || new Date()),
              detailedPlpFeedback,
              "AI Coach",
            ],
          );
        } else {
          const { rows: insertedPlpRows } = await query(
            `INSERT INTO plp_subjects (
                user_id,
                subject_id,
                subject_code,
                name,
                category,
                status,
                progress,
                last_assessment,
                teacher_name,
                feedback
              )
             VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10
              )
             RETURNING id`,
            [
              req.user.id,
              exercise.subjectId || null,
              subjectCode,
              exercise.subject || "Subject",
              "Exercise",
              plpStatus,
              score,
              formatIsoDate(insertedAssessment?.assessmentDate || new Date()),
              "AI Coach",
              detailedPlpFeedback,
            ],
          );
          plpSubjectId = insertedPlpRows[0]?.id || null;
        }

        if (plpSubjectId) {
          await Promise.all([
            query(`DELETE FROM plp_weak_areas WHERE plp_subject_id = $1`, [plpSubjectId]),
            query(`DELETE FROM plp_actions WHERE plp_subject_id = $1`, [plpSubjectId]),
            query(`DELETE FROM plp_tips WHERE plp_subject_id = $1`, [plpSubjectId]),
          ]);

          const weakAreaLevel = score >= 80 ? "Low" : score >= 60 ? "Medium" : "High";
          await query(
            `INSERT INTO plp_weak_areas (
                plp_subject_id,
                topic,
                level,
                description
              )
             VALUES ($1, $2, $3, $4)`,
            [
              plpSubjectId,
              resolvedWeakArea,
              weakAreaLevel,
              `Focus area identified from "${exercise.name}" in ${exercise.subject}. Current score: ${score}%.`,
            ],
          );

          const safeActions = Array.isArray(resolvedImprovements)
            ? resolvedImprovements
                .map((item) => String(item || "").trim())
                .filter(Boolean)
                .slice(0, 5)
            : [];
          if (safeActions.length > 0) {
            const actionValues = [];
            const actionParams = [];
            let actionIdx = 1;
            safeActions.forEach((action) => {
              actionValues.push(`($${actionIdx++}, $${actionIdx++})`);
              actionParams.push(plpSubjectId, action.slice(0, 300));
            });
            await query(
              `INSERT INTO plp_actions (plp_subject_id, action_text)
               VALUES ${actionValues.join(", ")}`,
              actionParams,
            );
          }

          const tips = buildPlpTipsFromImprovements({
            subject: exercise.subject,
            weakArea: resolvedWeakArea,
            improvements: resolvedImprovements,
            score,
          });
          if (tips.length > 0) {
            const tipValues = [];
            const tipParams = [];
            let tipIdx = 1;
            tips.forEach((tip) => {
              tipValues.push(`($${tipIdx++}, $${tipIdx++})`);
              tipParams.push(plpSubjectId, tip);
            });
            await query(
              `INSERT INTO plp_tips (plp_subject_id, tip_text)
               VALUES ${tipValues.join(", ")}`,
              tipParams,
            );
          }
        }

        const reviewSuffix =
          manualReviewCount > 0
            ? ` ${manualReviewCount} open response(s) may need teacher review.`
            : "";
        await query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [
            req.user.id,
            "Exercise graded",
            `Your exercise "${exercise.name}" was graded. Score: ${score}%. Focus: ${resolvedWeakArea}.${reviewSuffix}`,
          ],
        );

        return res.status(201).json({
          submission: {
            ...submission,
            score,
            weakArea: resolvedWeakArea,
            aiFeedback: resolvedFeedback,
            improvements: resolvedImprovements,
            manualReviewRequired: manualReviewCount > 0,
            manualReviewCount,
            openQuestionMode: manualReviewOpenQuestions
              ? "teacher_review"
              : "auto",
          },
        });
      }

      if (manualReviewCount > 0) {
        await query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [
            req.user.id,
            "Exercise submitted",
            `Your exercise was submitted and ${manualReviewCount} open response(s) are awaiting teacher review.`,
          ],
        );
        return res.status(201).json({
          submission: {
            ...submission,
            score,
            manualReviewRequired: true,
            manualReviewCount,
            openQuestionMode: manualReviewOpenQuestions
              ? "teacher_review"
              : "auto",
          },
        });
      }
    }

    return res.status(201).json({
      submission: {
        ...submission,
        score,
        manualReviewRequired: manualReviewCount > 0,
        manualReviewCount,
        openQuestionMode: manualReviewOpenQuestions ? "teacher_review" : "auto",
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/exercises/:id/download", async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    if (!isUuid(exerciseId)) {
      return res.status(400).json({ error: "Invalid exercise id." });
    }

    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    const { rows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.exercise_date AS "exerciseDate",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentId",
              tp.first_name AS "teacherFirst",
              tp.last_name AS "teacherLast",
              sse.term AS "enrollmentTerm",
              sse.year AS "enrollmentYear"
         FROM exercises e
         LEFT JOIN user_profiles p ON p.user_id = e.user_id
         LEFT JOIN subjects s
           ON s.id = e.subject_id
           OR (e.subject_id IS NULL AND lower(s.name) = lower(e.subject))
         LEFT JOIN student_subject_enrollments sse
           ON sse.student_id = e.user_id
          AND sse.subject_id = s.id
         LEFT JOIN user_profiles tp ON tp.user_id = sse.teacher_id
        WHERE e.id = $1
          AND e.user_id = $2
          AND e.subject = ANY($3::text[])`,
      [exerciseId, req.user.id, subjects],
    );

    const exercise = rows[0];
    if (!exercise) {
      return res.status(404).json({ error: "Exercise not found." });
    }

    const { rows: questionRows } = await query(
      `SELECT question_order AS "order",
              question_text AS "text",
              question_type AS "type",
              COALESCE(points, 1) AS "points"
         FROM exercise_questions
        WHERE exercise_id = $1
        ORDER BY question_order`,
      [exerciseId],
    );

    const schoolName = process.env.SCHOOL_NAME || "ClassIQ";
    const schoolDistrict = process.env.SCHOOL_DISTRICT || "School District";
    const schoolWebsite = process.env.SCHOOL_WEBSITE || "";
    const schoolEmail = process.env.SCHOOL_EMAIL || "";
    const schoolPhone = process.env.SCHOOL_PHONE || "";
    const periodMinutes = Number.parseInt(
      process.env.EXERCISE_DURATION_MINUTES || "120",
      10,
    );
    const schoolLogoConfig = String(process.env.SCHOOL_LOGO_PATH || "").trim();
    const schoolLogoPath = schoolLogoConfig
      ? path.isAbsolute(schoolLogoConfig)
        ? schoolLogoConfig
        : path.resolve(schoolLogoConfig)
      : null;
    const hasSchoolLogo = Boolean(schoolLogoPath && fs.existsSync(schoolLogoPath));
    const academicYear =
      exercise.enrollmentYear || new Date().getFullYear().toString();
    const termLabel = exercise.enrollmentTerm || "N/A";
    const teacherName =
      [exercise.teacherFirst, exercise.teacherLast]
        .filter(Boolean)
        .join(" ") || "N/A";
    const studentName =
      [exercise.firstName, exercise.lastName].filter(Boolean).join(" ") ||
      "Student";
    const studentId = exercise.studentId || "--";
    const exerciseDate =
      formatShortDate(exercise.exerciseDate) || formatShortDate(new Date());
    const totalMarks = questionRows.reduce((sum, row) => {
      const pts = Number(row.points);
      return sum + (Number.isFinite(pts) ? pts : 1);
    }, 0);

    const filename = `${sanitizeFilename(exercise.name)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    const rightColumnX = left + contentWidth * 0.64;
    const headerTop = doc.y;

    if (hasSchoolLogo) {
      try {
        doc.image(schoolLogoPath, left, headerTop, {
          fit: [70, 70],
          align: "left",
          valign: "top",
        });
      } catch (_) {
        // Ignore logo load errors and continue with text-only header.
      }
    }

    const brandingX = hasSchoolLogo ? left + 84 : left;
    const brandingWidth = contentWidth * 0.54 - (hasSchoolLogo ? 22 : 0);
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#102A63")
      .text(schoolName, brandingX, headerTop + 2, { width: brandingWidth });
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#102A63")
      .text("Exercise Paper", brandingX, doc.y + 2, { width: brandingWidth });
    const brandingBottom = doc.y;

    let contactY = headerTop + 4;
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0f172a")
      .text(schoolDistrict, rightColumnX, contactY, {
        width: contentWidth * 0.34,
      });
    contactY = doc.y + 2;
    doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
    if (schoolWebsite) {
      doc.text(schoolWebsite, rightColumnX, contactY, {
        width: contentWidth * 0.34,
      });
      contactY = doc.y + 2;
    }
    if (schoolEmail) {
      doc.text(schoolEmail, rightColumnX, contactY, {
        width: contentWidth * 0.34,
      });
      contactY = doc.y + 2;
    }
    if (schoolPhone) {
      doc.text(schoolPhone, rightColumnX, contactY, {
        width: contentWidth * 0.34,
      });
      contactY = doc.y + 2;
    }

    doc.y = Math.max(
      brandingBottom,
      contactY,
      hasSchoolLogo ? headerTop + 70 : headerTop + 32,
    );
    doc.y += 8;
    doc
      .strokeColor("#102A63")
      .lineWidth(1.4)
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .stroke();
    doc.y += 14;

    const metaStartY = doc.y;
    const leftMetaWidth = contentWidth * 0.54;
    const rightMetaWidth = contentWidth * 0.36;
    const leftMeta = [
      `COURSE: ${String(exercise.subject || exercise.name || "Exercise").toUpperCase()}`,
      `CAT: ${termLabel}`,
      `PERIOD: ${Number.isFinite(periodMinutes) ? periodMinutes : 120} minutes`,
      `STUDENT: ${studentName}`,
      `STUDENT ID: ${studentId}`,
    ];
    const rightMeta = [
      `Date: ${exerciseDate}`,
      `MARKS: ${totalMarks} pts`,
      `Examiner: ${teacherName}`,
      `Academic Year: ${academicYear}`,
    ];

    let leftMetaY = metaStartY;
    leftMeta.forEach((line) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(line, left, leftMetaY, { width: leftMetaWidth });
      leftMetaY = doc.y + 2;
    });

    let rightMetaY = metaStartY;
    rightMeta.forEach((line) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#0f172a")
        .text(line, rightColumnX, rightMetaY, { width: rightMetaWidth });
      rightMetaY = doc.y + 2;
    });

    doc.y = Math.max(leftMetaY, rightMetaY) + 10;
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#0f172a").text("Instructions:");
    doc.moveDown(0.3);
    [
      "Attempt all questions.",
      "Write clear and complete responses.",
      "Review your answers before submission.",
    ].forEach((line) => {
      doc.font("Helvetica").fontSize(11).fillColor("#1f2937").text(`- ${line}`, {
        indent: 10,
      });
    });
    doc.moveDown(0.4);
    doc
      .strokeColor("#1e293b")
      .lineWidth(1)
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .stroke();
    doc.y += 10;

    const ensureSpace = (heightNeeded = 60) => {
      if (doc.y + heightNeeded > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    questionRows.forEach((q, idx) => {
      const lines = splitQuestionLinesForPdf(q.text || "");
      const mainLine = lines.shift() || "Question";
      const points = Number.isFinite(Number(q.points)) ? Number(q.points) : 1;
      const estimatedHeight = 45 + lines.length * 16;
      ensureSpace(Math.max(72, estimatedHeight));

      doc
        .font("Helvetica-Bold")
        .fontSize(11.5)
        .fillColor("#0f172a")
        .text(`Question ${idx + 1}: ${mainLine} /${points} pts`, left, doc.y, {
          width: contentWidth,
          align: "left",
        });
      lines.forEach((line) => {
        const isOptionLine = /^[A-H][)\].:-]/.test(line);
        doc
          .font(isOptionLine ? "Helvetica-Bold" : "Helvetica")
          .fontSize(11)
          .fillColor("#1f2937")
          .text(line, left + 12, doc.y, {
            width: contentWidth - 12,
            align: "left",
          });
      });
      doc.moveDown(0.8);
    });

    doc.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

router.get("/resources", async (req, res, next) => {
  try {
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.json({ resources: [] });
    }

    const { rows: profileRows } = await query(
      `SELECT grade_level AS "gradeLevel"
         FROM user_profiles
        WHERE user_id = $1`,
      [req.user.id],
    );
    const currentLevel = profileRows[0]?.gradeLevel || null;
    if (!currentLevel) {
      return res.json({ resources: [] });
    }

    const { rows } = await query(
      `SELECT id, name, subject,
              file_type AS "type",
              file_size AS "size",
              resource_date AS "resourceDate",
              file_url AS "url",
              bucket,
              file_path AS "filePath",
              levels
         FROM resources
        WHERE subject = ANY($1::text[])
          AND (
            levels IS NULL
            OR array_length(levels, 1) = 0
            OR EXISTS (
              SELECT 1
              FROM unnest(levels) level_item
              WHERE lower(level_item) = lower($2)
                 OR lower($2) LIKE lower(level_item) || '%'
                 OR lower(level_item) LIKE lower($2) || '%'
            )
          )
        ORDER BY resource_date DESC`,
      [subjects, currentLevel],
    );

    return res.json({
      resources: rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        url: buildResourceUrl(row),
        levels: row.levels || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plp", async (req, res, next) => {
  try {
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.json({ subjects: [] });
    }
    const subjectsLower = subjects.map((subject) => subject.toLowerCase());

    const { rows } = await query(
      `SELECT id,
              subject_id AS "subjectId",
              subject_code AS "subjectCode",
              name,
              category,
              status,
              progress,
              last_assessment AS "lastAssessment",
              teacher_name AS "teacher",
              feedback
         FROM plp_subjects
        WHERE user_id = $1
          AND LOWER(name) = ANY($2::text[])
        ORDER BY name`,
      [req.user.id, subjectsLower],
    );

    return res.json({
      subjects: rows.map((row) => ({
        id: row.id,
        subjectId: row.subjectId || null,
        subjectCode: row.subjectCode,
        name: row.name,
        category: row.category,
        status: row.status,
        progress: row.progress,
        lastAssessment: formatShortDate(row.lastAssessment),
        teacher: row.teacher,
        feedback: row.feedback,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plp/:id", async (req, res, next) => {
  try {
    const subjectId = req.params.id;
    if (!isUuid(subjectId)) {
      return res.status(400).json({ error: "Invalid PLP subject id." });
    }
    const { rows } = await query(
      `SELECT id,
              subject_id AS "subjectId",
              subject_code AS "subjectCode",
              name,
              category,
              status,
              progress,
              last_assessment AS "lastAssessment",
              teacher_name AS "teacher",
              feedback
         FROM plp_subjects
        WHERE user_id = $1
          AND id = $2`,
      [req.user.id, subjectId],
    );

    const subject = rows[0];
    if (!subject) {
      return res.status(404).json({ error: "PLP subject not found." });
    }

    const [weakAreasResult, actionsResult, tipsResult] = await Promise.all([
      query(
        `SELECT id,
                topic,
                level,
                description AS "desc"
           FROM plp_weak_areas
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
      query(
        `SELECT action_text AS "action"
           FROM plp_actions
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
      query(
        `SELECT tip_text AS "tip"
           FROM plp_tips
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
    ]);

    return res.json({
      subject: {
        id: subject.id,
        subjectId: subject.subjectId || null,
        subjectCode: subject.subjectCode,
        name: subject.name,
        category: subject.category,
        status: subject.status,
        progress: subject.progress,
        lastAssessment: formatShortDate(subject.lastAssessment),
        teacher: subject.teacher,
        feedback: subject.feedback,
        weakAreas: weakAreasResult.rows.map((row) => ({
          id: row.id,
          topic: row.topic,
          level: row.level,
          desc: row.desc,
        })),
        actions: actionsResult.rows.map((row) => row.action),
        tips: tipsResult.rows.map((row) => row.tip),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plp/:id/export", async (req, res, next) => {
  try {
    const subjectId = req.params.id;
    if (!isUuid(subjectId)) {
      return res.status(400).json({ error: "Invalid PLP subject id." });
    }

    const { rows } = await query(
      `SELECT id,
              name,
              category,
              status,
              progress,
              last_assessment AS "lastAssessment",
              teacher_name AS "teacher",
              feedback
         FROM plp_subjects
        WHERE user_id = $1
          AND id = $2`,
      [req.user.id, subjectId],
    );
    const subject = rows[0];
    if (!subject) {
      return res.status(404).json({ error: "PLP subject not found." });
    }

    const [weakAreasResult, actionsResult, tipsResult, profileResult] = await Promise.all([
      query(
        `SELECT topic,
                level,
                description AS "desc"
           FROM plp_weak_areas
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
      query(
        `SELECT action_text AS "action"
           FROM plp_actions
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
      query(
        `SELECT tip_text AS "tip"
           FROM plp_tips
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [subjectId],
      ),
      query(
        `SELECT first_name AS "firstName",
                last_name AS "lastName",
                student_id AS "studentId"
           FROM user_profiles
          WHERE user_id = $1
          LIMIT 1`,
        [req.user.id],
      ),
    ]);

    const profile = profileResult.rows[0] || {};
    const studentName =
      [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Student";
    const weakAreas = weakAreasResult.rows || [];
    const actions = actionsResult.rows.map((row) => row.action).filter(Boolean);
    const tips = tipsResult.rows.map((row) => row.tip).filter(Boolean);

    const { doc, sectionTitle, bodyLine, ensureSpace } = createPdfTemplateDocument({
      res,
      filename: `${subject.name || "plp"}_learning_plan`,
      reportTitle: "Personalized Learning Plan",
      reportSubtitle: "Detailed support roadmap",
      metaLeft: [
        `STUDENT: ${studentName}`,
        `STUDENT ID: ${profile.studentId || "--"}`,
        `SUBJECT: ${subject.name || "Subject"}`,
        `CATEGORY: ${subject.category || "General"}`,
      ],
      metaRight: [
        `Status: ${subject.status || "Needs Support"}`,
        `Progress: ${subject.progress ?? 0}%`,
        `Last Scan: ${formatShortDate(subject.lastAssessment) || "--"}`,
        `Teacher: ${subject.teacher || "--"}`,
      ],
    });

    sectionTitle("AI Recommendation");
    bodyLine(
      subject.feedback
        ? subject.feedback
        : "No feedback has been generated yet for this subject.",
    );

    sectionTitle("Weak Areas");
    if (weakAreas.length === 0) {
      bodyLine("No weak areas recorded yet.");
    } else {
      weakAreas.forEach((item, index) => {
        ensureSpace(56);
        bodyLine(
          `${index + 1}. ${item.topic || "Topic"} (${item.level || "Needs attention"})`,
          { bold: true },
        );
        bodyLine(item.desc || "No additional detail provided.", { indent: 12 });
      });
    }

    sectionTitle("Recovery Roadmap");
    if (actions.length === 0) {
      bodyLine("No action items available yet.");
    } else {
      actions.forEach((action) => bodyLine(action, { bullet: true }));
    }

    sectionTitle("Study Tips");
    if (tips.length === 0) {
      bodyLine("No study tips available yet.");
    } else {
      tips.forEach((tip) => bodyLine(tip, { bullet: true }));
    }

    doc.end();
    return undefined;
  } catch (error) {
    return next(error);
  }
});

router.get("/plp/:id/resources", async (req, res, next) => {
  try {
    const plpSubjectId = req.params.id;
    if (!isUuid(plpSubjectId)) {
      return res.status(400).json({ error: "Invalid PLP subject id." });
    }

    const { rows: plpRows } = await query(
      `SELECT id,
              name,
              subject_id AS "subjectId"
         FROM plp_subjects
        WHERE id = $1
          AND user_id = $2`,
      [plpSubjectId, req.user.id],
    );
    const plpSubject = plpRows[0];
    if (!plpSubject) {
      return res.status(404).json({ error: "PLP subject not found." });
    }

    const requestedTopic = String(req.query.topic || "").trim();
    const likeTopic = requestedTopic ? `%${requestedTopic}%` : null;

    const { rows: profileRows } = await query(
      `SELECT class_id AS "classId",
              grade_level AS "gradeLevel"
         FROM user_profiles
        WHERE user_id = $1
        LIMIT 1`,
      [req.user.id],
    );
    const profile = profileRows[0] || {};

    const subjectContext = await getStudentSubjectContext(req.user.id, plpSubject.name);
    const lesson = subjectContext?.subjectId
      ? await getInheritedLessonContext({
          classId: subjectContext.classId || subjectContext.profileClassId || profile.classId || null,
          subjectId: subjectContext.subjectId,
        })
      : null;
    const recommendedPages =
      lesson?.pageFrom && lesson?.pageTo
        ? `${lesson.pageFrom}-${lesson.pageTo}`
        : lesson?.pageFrom
          ? `${lesson.pageFrom}`
          : null;

    const { rows: subjectResourceRows } = await query(
      `SELECT id,
              name,
              subject,
              file_type AS "type",
              file_size AS "size",
              resource_date AS "resourceDate",
              file_url AS "url",
              bucket,
              file_path AS "filePath",
              levels
         FROM resources
        WHERE ${isBooksBucketSql}
          AND ${subjectMatchSql}
          AND (
            $2::text IS NULL
            OR levels IS NULL
            OR array_length(levels, 1) = 0
            OR EXISTS (
              SELECT 1
              FROM unnest(levels) level_item
              WHERE lower(level_item) = lower($2)
                 OR lower($2) LIKE lower(level_item) || '%'
                 OR lower(level_item) LIKE lower($2) || '%'
            )
          )
          AND (
            $3::text IS NULL
            OR name ILIKE $3
            OR COALESCE(file_path, '') ILIKE $3
          )
        ORDER BY resource_date DESC NULLS LAST
        LIMIT 12`,
      [plpSubject.name, profile.gradeLevel || null, likeTopic],
    );

    let resourceRows = subjectResourceRows;
    if (resourceRows.length === 0) {
      const { rows: fallbackRows } = await query(
        `SELECT id,
                name,
                subject,
                file_type AS "type",
                file_size AS "size",
                resource_date AS "resourceDate",
                file_url AS "url",
                bucket,
                file_path AS "filePath",
                levels
           FROM resources
          WHERE ${isBooksBucketSql}
            AND (
              $1::text IS NULL
              OR name ILIKE $1
              OR COALESCE(file_path, '') ILIKE $1
            )
          ORDER BY resource_date DESC NULLS LAST
          LIMIT 12`,
        [likeTopic],
      );
      resourceRows = fallbackRows;
    }

    return res.json({
      subject: {
        id: plpSubject.id,
        name: plpSubject.name,
      },
      lesson: lesson
        ? {
            topic: lesson.topic || null,
            unitTitle: lesson.unitTitle || null,
            pageFrom: lesson.pageFrom || null,
            pageTo: lesson.pageTo || null,
            recommendedPages,
          }
        : null,
      resources: resourceRows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        size: row.size,
        date: formatShortDate(row.resourceDate),
        url: buildResourceUrl(row),
        bucket: row.bucket || null,
        filePath: row.filePath || null,
        levels: row.levels || [],
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/plp/weak-areas/:id/mark-improved", async (req, res, next) => {
  try {
    const weakAreaId = req.params.id;
    if (!isUuid(weakAreaId)) {
      return res.status(400).json({ error: "Invalid weak area id." });
    }

    const note = String(req.body?.note || "")
      .trim()
      .slice(0, 280);

    const { rows: existingRows } = await query(
      `SELECT w.id,
              w.topic,
              w.level,
              w.description,
              w.plp_subject_id AS "plpSubjectId",
              ps.name AS "subjectName"
         FROM plp_weak_areas w
         JOIN plp_subjects ps ON ps.id = w.plp_subject_id
        WHERE w.id = $1
          AND ps.user_id = $2`,
      [weakAreaId, req.user.id],
    );
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ error: "Weak area not found." });
    }

    const improvedStamp = `Marked improved on ${formatShortDate(new Date())}.`;
    const nextDescription = [existing.description, improvedStamp, note ? `Note: ${note}` : null]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1200);

    const { rows: updatedRows } = await query(
      `UPDATE plp_weak_areas
          SET level = 'Improved',
              description = $2
        WHERE id = $1
      RETURNING id,
                topic,
                level,
                description AS "desc"`,
      [weakAreaId, nextDescription],
    );

    await query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, $2, $3)`,
      [
        req.user.id,
        "PLP updated",
        `Weak area "${existing.topic}" in ${existing.subjectName} was marked as improved.`,
      ],
    );

    return res.json({
      weakArea: updatedRows[0],
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, body, created_at AS "createdAt", read
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.user.id],
    );

    return res.json({
      notifications: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        time: timeAgo(row.createdAt),
        read: row.read,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE notifications
          SET read = true
        WHERE id = $1
          AND user_id = $2
      RETURNING id, title, body, created_at AS "createdAt", read`,
      [req.params.id, req.user.id],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Notification not found." });
    }

    return res.json({
      notification: {
        id: rows[0].id,
        title: rows[0].title,
        body: rows[0].body,
        time: timeAgo(rows[0].createdAt),
        read: rows[0].read,
        createdAt: rows[0].createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/notifications/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM notifications
        WHERE id = $1
          AND user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Notification not found." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.delete("/notifications", async (req, res, next) => {
  try {
    await query(`DELETE FROM notifications WHERE user_id = $1`, [req.user.id]);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/tasks", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title,
              due_date AS "due",
              completed,
              priority
         FROM tasks
        WHERE user_id = $1
        ORDER BY due_date`,
      [req.user.id],
    );

    return res.json({
      tasks: rows.map((row) => ({
        id: row.id,
        title: row.title,
        due: formatIsoDate(row.due),
        completed: row.completed,
        priority: row.priority,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const { title, due, priority } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: "Title is required." });
    }

    const { rows } = await query(
      `INSERT INTO tasks (user_id, title, due_date, priority)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, due_date AS "due", completed, priority`,
      [req.user.id, title, due || null, priority || "medium"],
    );

    return res.status(201).json({
      task: {
        id: rows[0].id,
        title: rows[0].title,
        due: formatIsoDate(rows[0].due),
        completed: rows[0].completed,
        priority: rows[0].priority,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const { title, due, completed, priority } = req.body || {};
    const { rows } = await query(
      `UPDATE tasks
          SET title = COALESCE($3, title),
              due_date = COALESCE($4, due_date),
              completed = COALESCE($5, completed),
              priority = COALESCE($6, priority)
        WHERE id = $1
          AND user_id = $2
      RETURNING id, title, due_date AS "due", completed, priority`,
      [req.params.id, req.user.id, title, due, completed, priority],
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Task not found." });
    }

    return res.json({
      task: {
        id: rows[0].id,
        title: rows[0].title,
        due: formatIsoDate(rows[0].due),
        completed: rows[0].completed,
        priority: rows[0].priority,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Task not found." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.get("/schedule", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id,
              day_of_week AS "day",
              start_time AS "startTime",
              end_time AS "endTime",
              title,
              room,
              instructor
         FROM schedule_classes
        WHERE user_id = $1
        ORDER BY day_of_week, start_time`,
      [req.user.id],
    );

    return res.json({
      classes: rows.map((row) => ({
        id: row.id,
        day: row.day,
        startTime: formatTime(row.startTime),
        endTime: formatTime(row.endTime),
        title: row.title,
        room: row.room,
        instructor: row.instructor,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/schedule", async (req, res, next) => {
  try {
    const { day, startTime, endTime, title, room, instructor } = req.body || {};
    if (
      day === undefined ||
      day === null ||
      !startTime ||
      !endTime ||
      !title
    ) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const { rows } = await query(
      `INSERT INTO schedule_classes (
          user_id, day_of_week, start_time, end_time, title, room, instructor
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, day_of_week AS "day", start_time AS "startTime",
                 end_time AS "endTime", title, room, instructor`,
      [req.user.id, day, startTime, endTime, title, room || null, instructor || null],
    );

    return res.status(201).json({
      class: {
        id: rows[0].id,
        day: rows[0].day,
        startTime: formatTime(rows[0].startTime),
        endTime: formatTime(rows[0].endTime),
        title: rows[0].title,
        room: rows[0].room,
        instructor: rows[0].instructor,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete("/schedule/:id", async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM schedule_classes
        WHERE id = $1
          AND user_id = $2`,
      [req.params.id, req.user.id],
    );

    if (!rowCount) {
      return res.status(404).json({ error: "Class not found." });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

export default router;
