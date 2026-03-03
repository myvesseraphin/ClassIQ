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
  analyzeAssessmentWithGemini,
  extractExerciseFromSourceWithGemini,
  generateExerciseWithGemini,
  isGeminiEnabled,
} from "../utils/gemini.js";

dotenv.config();

const router = express.Router();
router.use(requireAuth, requireRole(["teacher"]));

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_REGEX.test(value || "");

const formatIsoDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

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

const createNotification = async (userId, title, body) => {
  if (!userId || !title || !body) return;
  try {
    await query(
      `INSERT INTO notifications (user_id, title, body)
       VALUES ($1, $2, $3)`,
      [userId, title, body],
    );
  } catch (error) {
    console.error("Failed to create notification", error);
  }
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

const buildResourceUrl = (row) => {
  if (row.url) return row.url;
  if (row.bucket && row.filePath && process.env.SUPABASE_URL) {
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${row.bucket}/${row.filePath}`;
  }
  return null;
};

const sanitizeFilename = (value) =>
  String(value || "exercise")
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "exercise";

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
      needsTeacherReview:
        earnedPoints >= maxPoints * 0.35 && earnedPoints < maxPoints * 0.75,
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
    const isCorrect = normalizeBoolean(submittedText) === normalizeBoolean(correctAnswer);
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

const parseMarkValue = (row, keys) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const parsed = toNumberOrNull(row[key]);
    if (parsed !== null) return parsed;
  }
  return null;
};

const markToPercent = (mark, maxMarks) => {
  if (mark === null || maxMarks <= 0) return null;
  const sanitizedMark = clamp(mark, 0, maxMarks);
  return clamp(Math.round((sanitizedMark / maxMarks) * 100), 0, 100);
};

const inferWeakArea = ({ subject, type, gradePercent }) => {
  const normalizedSubject = String(subject || "General").toLowerCase();
  const normalizedType = String(type || "").toLowerCase();

  if (gradePercent >= 80) {
    return `${subject || "Subject"} extension challenge`;
  }

  if (normalizedSubject.includes("math")) {
    if (normalizedType.includes("diagnostic")) return "multi-step problem solving";
    return "fractions and operation accuracy";
  }
  if (normalizedSubject.includes("english")) return "reading comprehension details";
  if (normalizedSubject.includes("science")) return "concept explanation and vocabulary";
  if (normalizedSubject.includes("history")) return "cause and effect reasoning";
  if (normalizedSubject.includes("geography")) return "map interpretation and evidence use";

  return gradePercent < 50
    ? "core concept understanding"
    : "application in extended tasks";
};

const getSupportStatus = (gradePercent) => {
  if (gradePercent >= 80) return "On Track";
  if (gradePercent >= 60) return "Improving";
  return "Needs Support";
};

const buildPlanRecommendations = ({ subject, weakArea, gradePercent }) => {
  const fallbackSubject = subject || "the subject";
  if (gradePercent >= 80) {
    return [
      `Give extension tasks in ${fallbackSubject} to deepen mastery.`,
      "Pair the learner with a peer for challenge-based practice.",
      "Use one weekly diagnostic check to confirm sustained growth.",
    ];
  }
  if (gradePercent >= 60) {
    return [
      `Run two short practice sessions on ${weakArea}.`,
      "Model one worked example before independent practice.",
      "Add a five-minute exit ticket after each lesson.",
    ];
  }
  return [
    `Re-teach ${weakArea} with concrete examples from Rwanda basic education content.`,
    "Use guided small-group support at least three times this week.",
    "Assign a short diagnostic exercise after each reteach lesson.",
  ];
};

const buildAiFeedback = ({
  gradePercent,
  weakArea,
  recommendations,
  subject,
  type,
  teacherNotes,
}) => {
  const strengthNote =
    gradePercent >= 80
      ? "Strong concept command was observed in the scanned work."
      : gradePercent >= 60
        ? "The learner shows partial understanding with room to improve fluency."
        : "The learner needs structured reinforcement of foundation concepts.";
  const notes = String(teacherNotes || "").trim();
  const context = notes ? ` Teacher notes: ${notes}.` : "";
  return `${strengthNote} Primary weak area: ${weakArea}. Recommended pathway for ${subject || "this subject"} (${type || "assessment"}): ${recommendations.join(" ")}${context}`;
};

const sanitizeInsightItems = (items, max = 5, maxLength = 220) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max)
    .map((item) => item.slice(0, maxLength));
};

const uniqueItems = (items = [], max = 6, maxLength = 220) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const text = String(item || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(0, maxLength));
    if (out.length >= max) break;
  }
  return out;
};

const extractAiInsightLines = (feedback, max = 8) => {
  const lines = String(feedback || "")
    .split(/[.!?]\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const priorityPattern =
    /mastery signal|primary weak area|likely misconceptions|support priorities|learner profile|next checkpoint|recommended actions|observed strengths/i;
  const priority = lines.filter((line) => priorityPattern.test(line));
  const secondary = lines.filter((line) => !priorityPattern.test(line));
  return uniqueItems([...priority, ...secondary], max, 260);
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

const buildDetailedPlpFeedback = ({
  subject,
  assessmentTitle,
  assessmentType,
  gradePercent,
  predictedPercent,
  scoreObtained,
  scoreTotal,
  weakArea,
  recommendations = [],
  strengths = [],
  misconceptions = [],
  supportNeeds = [],
  learningProfile,
  nextCheckpoint,
  teacherNotes,
}) => {
  const safeSubject = String(subject || "Subject").trim() || "Subject";
  const safeType = String(assessmentType || "Assessment").trim() || "Assessment";
  const safeTitle =
    String(assessmentTitle || "").replace(/\s+/g, " ").trim() || null;
  const weak = String(weakArea || "core concepts").trim();
  const grade =
    gradePercent === null || gradePercent === undefined
      ? null
      : clamp(Math.round(Number(gradePercent)), 0, 100);
  const predicted =
    predictedPercent === null || predictedPercent === undefined
      ? null
      : clamp(Math.round(Number(predictedPercent)), 0, 100);

  const strengthItems = sanitizeInsightItems(strengths, 4, 180);
  const misconceptionItems = sanitizeInsightItems(misconceptions, 4, 180);
  const supportItems = sanitizeInsightItems(supportNeeds, 4, 180);
  const recommendationItems = sanitizeInsightItems(recommendations, 6, 240);

  const scoreText =
    Number.isFinite(Number(scoreObtained)) && Number.isFinite(Number(scoreTotal))
      ? `${Math.max(0, Number(scoreObtained))}/${Math.max(1, Number(scoreTotal))}`
      : null;
  const progressText =
    grade === null
      ? "awaiting full grading"
      : `grade ${grade}%${predicted === null ? "" : ` (projected ${predicted}%)`}`;

  const masterySignal =
    grade === null
      ? "Evidence is still being reviewed."
      : grade >= 80
        ? "Strong mastery is visible with extension potential."
        : grade >= 60
          ? "Partial mastery with consistent improvement opportunities."
          : "Foundational reinforcement is required for stability.";

  const lines = [
    safeTitle
      ? `Assessment: ${safeTitle} (${safeType} - ${safeSubject}).`
      : `Assessment context: ${safeType} in ${safeSubject}.`,
    scoreText ? `Score snapshot: ${scoreText}; ${progressText}.` : `Progress snapshot: ${progressText}.`,
    `Mastery signal: ${masterySignal}`,
    `Primary weak area: ${weak}.`,
    strengthItems.length ? `Observed strengths: ${strengthItems.join("; ")}.` : null,
    misconceptionItems.length
      ? `Likely misconceptions: ${misconceptionItems.join("; ")}.`
      : null,
    supportItems.length ? `Support priorities: ${supportItems.join("; ")}.` : null,
    recommendationItems.length
      ? `Recommended actions: ${recommendationItems.join("; ")}.`
      : "Recommended actions: maintain weekly targeted practice and quick formative checks.",
    String(learningProfile || "").trim()
      ? `Learner profile: ${String(learningProfile).trim()}.`
      : null,
    String(nextCheckpoint || "").trim()
      ? `Next checkpoint: ${String(nextCheckpoint).trim()}.`
      : null,
    String(teacherNotes || "").trim()
      ? `Teacher notes: ${String(teacherNotes).trim()}.`
      : null,
  ];

  return lines.filter(Boolean).join(" ");
};

const upsertAssessmentPlpVersion = async ({
  studentId,
  teacherId,
  subjectId = null,
  subject,
  assessmentId,
  assessmentTitle,
  assessmentType,
  assessmentDate,
  gradePercent,
  predictedPercent = null,
  scoreObtained = null,
  scoreTotal = null,
  weakArea,
  recommendations = [],
  strengths = [],
  misconceptions = [],
  supportNeeds = [],
  learningProfile = "",
  nextCheckpoint = "",
  teacherNotes = "",
  teacherName = "Teacher",
}) => {
  const safeSubject = String(subject || "Subject").trim().slice(0, 120) || "Subject";
  const safeCategory =
    String(assessmentType || "Assessment").trim().slice(0, 120) || "Assessment";
  const safeTeacherName =
    String(teacherName || "Teacher").trim().slice(0, 120) || "Teacher";
  const safeAssessmentTitle =
    String(assessmentTitle || `${safeSubject} ${safeCategory}`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160) || `${safeSubject} ${safeCategory}`;
  const normalizedGrade = toNumberOrNull(gradePercent);
  const progress =
    normalizedGrade === null ? 0 : clamp(Math.round(normalizedGrade), 0, 100);
  const status =
    normalizedGrade === null ? "Pending Review" : getSupportStatus(progress);
  const versionCode = buildPlpVersionCode({
    subject: safeSubject,
    assessmentId,
    assessmentDate,
  });
  const lastAssessment = formatIsoDate(assessmentDate || new Date());
  const feedback = buildDetailedPlpFeedback({
    subject: safeSubject,
    assessmentTitle: safeAssessmentTitle,
    assessmentType: safeCategory,
    gradePercent: normalizedGrade,
    predictedPercent,
    scoreObtained,
    scoreTotal,
    weakArea,
    recommendations,
    strengths,
    misconceptions,
    supportNeeds,
    learningProfile,
    nextCheckpoint,
    teacherNotes,
  });

  const { rows: existingRows } = await query(
    `SELECT id
       FROM plp_subjects
      WHERE user_id = $1
        AND subject_code = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [studentId, versionCode],
  );

  if (existingRows[0]?.id) {
    const { rows: updatedRows } = await query(
      `UPDATE plp_subjects
          SET subject_id = COALESCE($2, subject_id),
              teacher_id = $3,
              name = $4,
              category = $5,
              status = $6,
              progress = $7,
              last_assessment = $8,
              teacher_name = $9,
              feedback = $10
        WHERE id = $1
      RETURNING id`,
      [
        existingRows[0].id,
        subjectId || null,
        teacherId || null,
        safeSubject,
        safeCategory,
        status,
        progress,
        lastAssessment,
        safeTeacherName,
        feedback,
      ],
    );
    const planId = updatedRows[0]?.id || existingRows[0].id;

    if (planId) {
      await Promise.all([
        query(`DELETE FROM plp_weak_areas WHERE plp_subject_id = $1`, [planId]),
        query(`DELETE FROM plp_actions WHERE plp_subject_id = $1`, [planId]),
        query(`DELETE FROM plp_tips WHERE plp_subject_id = $1`, [planId]),
      ]);

      const weakLevel = progress >= 80 ? "Low" : progress >= 60 ? "Medium" : "High";
      await query(
        `INSERT INTO plp_weak_areas (plp_subject_id, topic, level, description)
         VALUES ($1, $2, $3, $4)`,
        [
          planId,
          String(weakArea || "Core concepts").slice(0, 260),
          weakLevel,
          `Assessment-linked focus for ${safeSubject}. ${status} (${progress}%).`,
        ],
      );

      const actionItems = uniqueItems(
        [...sanitizeInsightItems(supportNeeds, 4, 220), ...sanitizeInsightItems(recommendations, 6, 240)],
        6,
        300,
      );
      if (actionItems.length > 0) {
        const values = [];
        const params = [];
        let idx = 1;
        actionItems.forEach((item) => {
          values.push(`($${idx++}, $${idx++})`);
          params.push(planId, item);
        });
        await query(
          `INSERT INTO plp_actions (plp_subject_id, action_text)
           VALUES ${values.join(", ")}`,
          params,
        );
      }

      const tipItems = uniqueItems(
        [
          ...sanitizeInsightItems(strengths, 3, 200).map((item) => `Strength to build: ${item}`),
          String(learningProfile || "").trim() ? `Learner profile: ${String(learningProfile).trim()}` : "",
          String(nextCheckpoint || "").trim() ? `Checkpoint: ${String(nextCheckpoint).trim()}` : "",
          ...extractAiInsightLines(feedback, 4),
        ],
        6,
        260,
      );
      if (tipItems.length > 0) {
        const values = [];
        const params = [];
        let idx = 1;
        tipItems.forEach((item) => {
          values.push(`($${idx++}, $${idx++})`);
          params.push(planId, item);
        });
        await query(
          `INSERT INTO plp_tips (plp_subject_id, tip_text)
           VALUES ${values.join(", ")}`,
          params,
        );
      }
    }

    return {
      id: planId,
      versionCode,
      status,
      progress,
      feedback,
    };
  }

  const { rows: insertedRows } = await query(
    `INSERT INTO plp_subjects (
        user_id,
        subject_id,
        teacher_id,
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
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11
      )
     RETURNING id`,
    [
      studentId,
      subjectId || null,
      teacherId || null,
      versionCode,
      safeSubject,
      safeCategory,
      status,
      progress,
      lastAssessment,
      safeTeacherName,
      feedback,
    ],
  );

  const planId = insertedRows[0]?.id || null;

  if (planId) {
    await Promise.all([
      query(`DELETE FROM plp_weak_areas WHERE plp_subject_id = $1`, [planId]),
      query(`DELETE FROM plp_actions WHERE plp_subject_id = $1`, [planId]),
      query(`DELETE FROM plp_tips WHERE plp_subject_id = $1`, [planId]),
    ]);

    const weakLevel = progress >= 80 ? "Low" : progress >= 60 ? "Medium" : "High";
    await query(
      `INSERT INTO plp_weak_areas (plp_subject_id, topic, level, description)
       VALUES ($1, $2, $3, $4)`,
      [
        planId,
        String(weakArea || "Core concepts").slice(0, 260),
        weakLevel,
        `Assessment-linked focus for ${safeSubject}. ${status} (${progress}%).`,
      ],
    );

    const actionItems = uniqueItems(
      [...sanitizeInsightItems(supportNeeds, 4, 220), ...sanitizeInsightItems(recommendations, 6, 240)],
      6,
      300,
    );
    if (actionItems.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;
      actionItems.forEach((item) => {
        values.push(`($${idx++}, $${idx++})`);
        params.push(planId, item);
      });
      await query(
        `INSERT INTO plp_actions (plp_subject_id, action_text)
         VALUES ${values.join(", ")}`,
        params,
      );
    }

    const tipItems = uniqueItems(
      [
        ...sanitizeInsightItems(strengths, 3, 200).map((item) => `Strength to build: ${item}`),
        String(learningProfile || "").trim() ? `Learner profile: ${String(learningProfile).trim()}` : "",
        String(nextCheckpoint || "").trim() ? `Checkpoint: ${String(nextCheckpoint).trim()}` : "",
        ...extractAiInsightLines(feedback, 4),
      ],
      6,
      260,
    );
    if (tipItems.length > 0) {
      const values = [];
      const params = [];
      let idx = 1;
      tipItems.forEach((item) => {
        values.push(`($${idx++}, $${idx++})`);
        params.push(planId, item);
      });
      await query(
        `INSERT INTO plp_tips (plp_subject_id, tip_text)
         VALUES ${values.join(", ")}`,
        params,
      );
    }
  }

  return {
    id: planId,
    versionCode,
    status,
    progress,
    feedback,
  };
};

const scoreAssessmentAnalysisQuality = (analysis) => {
  if (!analysis || typeof analysis !== "object") return -1;
  let score = 0;

  const gradePercent = toNumberOrNull(analysis.gradePercent);
  const scoreTotal = toNumberOrNull(analysis.scoreTotal);
  const scoreObtained = toNumberOrNull(analysis.scoreObtained);
  const weakArea = String(analysis.weakArea || "").trim();
  const teacherFeedback = String(analysis.teacherFeedback || "").trim();
  const recommendationCount = Array.isArray(analysis.recommendations)
    ? analysis.recommendations.filter((item) => String(item || "").trim()).length
    : 0;
  const strengthsCount = Array.isArray(analysis.strengths)
    ? analysis.strengths.filter((item) => String(item || "").trim()).length
    : 0;

  if (gradePercent !== null) score += 7;
  if (scoreTotal !== null && scoreObtained !== null) score += 5;
  if (weakArea.length >= 4) score += 2;
  score += Math.min(recommendationCount, 3);
  score += Math.min(strengthsCount, 2);
  if (teacherFeedback.length > 0) score += 1;

  return score;
};

const pickBestAssessmentAnalysis = (candidates) => {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 0) return null;

  let winner = list[0];
  let winnerScore = scoreAssessmentAnalysisQuality(winner.analysis);
  for (let index = 1; index < list.length; index += 1) {
    const candidate = list[index];
    const candidateScore = scoreAssessmentAnalysisQuality(candidate.analysis);
    if (candidateScore > winnerScore) {
      winner = candidate;
      winnerScore = candidateScore;
    }
  }

  return {
    ...winner,
    qualityScore: winnerScore,
  };
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

const extractImageUrlFromQuestionText = (value) => {
  const raw = String(value || "");
  const markerMatch = raw.match(/\[IMAGE_URL:([^\]\s]+)\]/i);
  if (markerMatch?.[1]) {
    const url = String(markerMatch[1]).trim();
    if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
      return {
        imageUrl: url,
        text: raw.replace(markerMatch[0], "").trim(),
      };
    }
  }

  const markdownMatch = raw.match(
    /!\[[^\]]*]\(((?:https?:\/\/|\/)[^\s)]+)\)/i,
  );
  if (markdownMatch?.[1]) {
    return {
      imageUrl: String(markdownMatch[1]).trim(),
      text: raw.replace(markdownMatch[0], "").trim(),
    };
  }

  return { imageUrl: null, text: raw.trim() };
};

const attachQuestionImageMarker = (text, imageUrl) => {
  const cleanText = String(text || "").trim();
  const cleanUrl = String(imageUrl || "").trim();
  if (!cleanUrl || (!/^https?:\/\//i.test(cleanUrl) && !cleanUrl.startsWith("/"))) {
    return cleanText;
  }
  return `[IMAGE_URL:${cleanUrl}]\n${cleanText}`;
};

const parseQuestionsFromRawText = (rawText, maxCount = 20) => {
  const text = String(rawText || "").replace(/\r/g, "").trim();
  if (!text) return [];

  const chunks = text
    .split(/(?=^\s*(?:Q?\d+[\)\].:-]))/gm)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const sourceChunks = chunks.length > 1 ? chunks : text.split(/\n{2,}/g);

  const results = [];
  for (const chunk of sourceChunks) {
    let questionBlock = String(chunk || "").trim();
    if (!questionBlock) continue;

    questionBlock = questionBlock.replace(/^\s*Q?\d+[\)\].:-]\s*/i, "").trim();

    const answerMatch = questionBlock.match(
      /(?:^|\n)\s*(?:Answer|Correct\s*Answer)\s*[:=-]\s*([^\n]+)\s*$/i,
    );
    let answer = answerMatch?.[1] ? String(answerMatch[1]).trim() : "";
    if (answerMatch) {
      questionBlock = questionBlock
        .slice(0, answerMatch.index)
        .trim();
    }

    const pointsMatch = questionBlock.match(
      /(?:^|\n)\s*Points?\s*[:=-]\s*(\d+)\s*$/i,
    );
    let points = pointsMatch?.[1] ? Number(pointsMatch[1]) : null;
    if (pointsMatch) {
      questionBlock = questionBlock
        .slice(0, pointsMatch.index)
        .trim();
    }

    const { imageUrl, text: cleanedQuestion } =
      extractImageUrlFromQuestionText(questionBlock);
    if (!cleanedQuestion) continue;

    const hasChoiceLines = /(?:^|\n)\s*[A-H][)\].:-]\s+/i.test(cleanedQuestion);
    const isTrueFalse = /true\s*\/?\s*false|true or false/i.test(cleanedQuestion);
    const type = hasChoiceLines
      ? "Multiple Choice"
      : isTrueFalse
        ? "True/False"
        : "Short Answer";
    const safePoints = clamp(
      points === null || points === undefined
        ? type === "Short Answer"
          ? 3
          : type === "Multiple Choice"
            ? 2
            : 1
        : points,
      1,
      5,
    );

    results.push({
      type,
      text: cleanedQuestion.slice(0, 1800),
      answer: String(answer || "").trim().slice(0, 600),
      points: safePoints,
      imageUrl,
    });
    if (results.length >= clamp(maxCount, 3, 20)) break;
  }

  return results;
};

const resolveUploadedExerciseQuestions = async ({
  sourceText,
  file,
  subject,
  gradeLevel,
  className,
  title,
  questionCount,
}) => {
  const safeCount = clamp(questionCount, 3, 20);
  const trimmedSourceText = String(sourceText || "").trim();
  const parsedFromText = parseQuestionsFromRawText(trimmedSourceText, safeCount);
  if (parsedFromText.length >= 3) {
    return {
      name: String(title || "").trim() || `${subject || "Subject"} Uploaded Exercise`,
      difficulty: "Intermediate",
      questions: parsedFromText.slice(0, safeCount),
      extractionMode: "manual_text",
    };
  }

  if (file?.path) {
    if (String(file.mimetype || "").startsWith("text/")) {
      try {
        const textContent = fs.readFileSync(file.path, "utf8");
        const parsedFromFileText = parseQuestionsFromRawText(
          textContent,
          safeCount,
        );
        if (parsedFromFileText.length >= 3) {
          return {
            name:
              String(title || "").trim() ||
              `${subject || "Subject"} Uploaded Exercise`,
            difficulty: "Intermediate",
            questions: parsedFromFileText.slice(0, safeCount),
            extractionMode: "text_file",
          };
        }
      } catch (error) {
        console.error("Failed to parse text upload", error);
      }
    }

    const aiExtracted = await extractExerciseFromSourceWithGemini({
      filePath: file.path,
      mimeType: file.mimetype,
      subject,
      gradeLevel,
      className,
      titleHint: title,
      questionCount: safeCount,
    });
    if (aiExtracted?.questions?.length >= 3) {
      return {
        name: aiExtracted.name,
        difficulty: aiExtracted.difficulty,
        questions: aiExtracted.questions.slice(0, safeCount),
        extractionMode: "ai_file_extract",
      };
    }
  }

  return null;
};

const riskBandFromMetrics = (avgGrade, completionRate) => {
  if (avgGrade === null || avgGrade === undefined) return "watch";
  if (avgGrade < 50 || completionRate < 40) return "high";
  if (avgGrade < 70 || completionRate < 65) return "medium";
  return "low";
};

const possibleReasonFromMetrics = (riskBand, weakArea, completionRate) => {
  if (riskBand === "high" && completionRate < 40) {
    return "low submission consistency and limited practice time";
  }
  if (riskBand === "high") {
    return "foundational gaps in prior concepts";
  }
  if (riskBand === "medium" && weakArea) {
    return `inconsistent mastery in ${weakArea}`;
  }
  if (riskBand === "medium") {
    return "needs tighter feedback cycles";
  }
  return "steady performance with minor support needs";
};

const nextActionFromMetrics = (riskBand, weakArea) => {
  if (riskBand === "high") {
    return `Schedule targeted intervention on ${weakArea || "core skills"} within 48 hours.`;
  }
  if (riskBand === "medium") {
    return "Assign one diagnostic check and review in the next lesson.";
  }
  return "Provide extension work and monitor weekly.";
};

const getTeacherAssignments = async (teacherId) => {
  const { rows } = await query(
    `SELECT ta.class_id AS "classId",
            ta.subject_id AS "subjectId",
            COALESCE(c.grade_level, ta.grade_level) AS "gradeLevel",
            COALESCE(c.class_name, ta.class_name) AS "className",
            COALESCE(s.name, ta.subject) AS "subject",
            ta.is_primary_class AS "isPrimaryClass"
       FROM teacher_assignments ta
       LEFT JOIN classes c ON c.id = ta.class_id
       LEFT JOIN subjects s ON s.id = ta.subject_id
      WHERE ta.teacher_id = $1`,
    [teacherId],
  );
  return rows;
};

const getAssignedStudentIds = async (teacherId) => {
  const assignments = await getTeacherAssignments(teacherId);
  if (!assignments.length) {
    return { assignments, studentIds: [] };
  }

  const classIds = assignments
    .map((assignment) => assignment.classId)
    .filter(Boolean);

  if (classIds.length > 0) {
    const { rows } = await query(
      `SELECT u.id
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND p.class_id = ANY($1::uuid[])`,
      [classIds],
    );

    return {
      assignments,
      studentIds: rows.map((row) => row.id),
    };
  }

  const gradeLevels = assignments.map((a) => a.gradeLevel);
  const classNames = assignments.map((a) => a.className);

  const { rows } = await query(
    `SELECT u.id
       FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       JOIN (
         SELECT *
           FROM unnest($1::text[], $2::text[])
                AS t(grade_level, class_name)
       ) assigned
         ON assigned.grade_level = p.grade_level
        AND assigned.class_name = p.class_name
      WHERE u.role = 'student'`,
    [gradeLevels, classNames],
  );

  return {
    assignments,
    studentIds: rows.map((row) => row.id),
  };
};

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
    cb(null, `${safeBase || "avatar"}-${Date.now()}${ext}`);
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

const classroomFileUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    const isAllowed =
      mime.startsWith("image/") ||
      mime === "application/pdf" ||
      mime === "text/plain" ||
      mime === "text/markdown";
    if (!isAllowed) {
      return cb(
        new Error("Only image, PDF, TXT, or Markdown uploads are allowed."),
      );
    }
    return cb(null, true);
  },
});

let exerciseAssignmentMetaReady = null;
const ensureExerciseAssignmentMeta = async () => {
  if (exerciseAssignmentMetaReady === true) return true;
  try {
    const { rows: existingRows } = await query(
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
    let hasMeta =
      Boolean(existingRows[0]?.hasTeacherId) &&
      Boolean(existingRows[0]?.hasAssignmentOrigin);

    if (!hasMeta) {
      await query(
        `ALTER TABLE exercises
           ADD COLUMN IF NOT EXISTS assigned_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL`,
      );
      await query(
        `ALTER TABLE exercises
           ADD COLUMN IF NOT EXISTS assignment_origin text`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS exercises_assigned_by_teacher_idx
            ON exercises(assigned_by_teacher_id)`,
      );

      const { rows: recheckRows } = await query(
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
      hasMeta =
        Boolean(recheckRows[0]?.hasTeacherId) &&
        Boolean(recheckRows[0]?.hasAssignmentOrigin);
    }

    exerciseAssignmentMetaReady = hasMeta;
    return hasMeta;
  } catch (error) {
    console.error("Failed to ensure exercises assignment metadata columns", error);
    exerciseAssignmentMetaReady = false;
    return false;
  }
};

let exerciseAnswerTeacherReviewMetaReady = null;
const ensureExerciseAnswerTeacherReviewMeta = async () => {
  if (exerciseAnswerTeacherReviewMetaReady === true) return true;
  try {
    await query(
      `ALTER TABLE exercise_answers
         ADD COLUMN IF NOT EXISTS teacher_score numeric`,
    );
    await query(
      `ALTER TABLE exercise_answers
         ADD COLUMN IF NOT EXISTS teacher_feedback text`,
    );
    await query(
      `ALTER TABLE exercise_answers
         ADD COLUMN IF NOT EXISTS reviewed_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL`,
    );
    await query(
      `ALTER TABLE exercise_answers
         ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`,
    );
    await query(
      `CREATE INDEX IF NOT EXISTS exercise_answers_reviewed_by_teacher_idx
          ON exercise_answers(reviewed_by_teacher_id)`,
    );

    const { rows } = await query(
      `SELECT EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercise_answers'
             AND column_name = 'teacher_score'
        ) AS "hasTeacherScore",
        EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercise_answers'
             AND column_name = 'teacher_feedback'
        ) AS "hasTeacherFeedback",
        EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercise_answers'
             AND column_name = 'reviewed_by_teacher_id'
        ) AS "hasReviewedByTeacherId",
        EXISTS (
          SELECT 1
            FROM information_schema.columns
           WHERE table_name = 'exercise_answers'
             AND column_name = 'reviewed_at'
        ) AS "hasReviewedAt"`,
    );
    const ready =
      Boolean(rows[0]?.hasTeacherScore) &&
      Boolean(rows[0]?.hasTeacherFeedback) &&
      Boolean(rows[0]?.hasReviewedByTeacherId) &&
      Boolean(rows[0]?.hasReviewedAt);
    exerciseAnswerTeacherReviewMetaReady = ready;
    return ready;
  } catch (error) {
    console.error("Failed to ensure exercise answer teacher review columns", error);
    exerciseAnswerTeacherReviewMetaReady = false;
    return false;
  }
};

const evaluateExerciseReviewRows = (questionRows = []) => {
  const mapped = [];
  let totalPoints = 0;
  let earnedPoints = 0;
  let pendingTeacher = 0;
  let teacherReviewed = 0;

  for (const row of questionRows) {
    const safePoints = Number.isFinite(Number(row.points))
      ? Number(row.points)
      : 1;
    const submittedAnswer = String(row.studentAnswer || "");
    const correctAnswer = String(row.correctAnswer || "");
    const teacherScoreRaw =
      row.teacherScore === null || row.teacherScore === undefined
        ? null
        : Number(row.teacherScore);
    const hasTeacherOverride =
      isOpenEndedType(row.type) && Number.isFinite(teacherScoreRaw);
    const teacherScore = hasTeacherOverride
      ? clamp(teacherScoreRaw, 0, safePoints)
      : null;

    let grading;
    if (hasTeacherOverride) {
      grading = {
        countInScore: true,
        earnedPoints: teacherScore,
        isCorrect: teacherScore >= safePoints * 0.95,
        needsTeacherReview: false,
        mode: "teacher_review",
      };
    } else {
      grading = gradeExerciseQuestion({
        questionType: row.type,
        submittedAnswer,
        correctAnswer,
        points: safePoints,
      });
    }

    if (grading.countInScore) {
      totalPoints += safePoints;
      earnedPoints += clamp(Number(grading.earnedPoints) || 0, 0, safePoints);
    }

    if (grading.needsTeacherReview) {
      pendingTeacher += 1;
    } else if (grading.mode === "teacher_review") {
      teacherReviewed += 1;
    }

    mapped.push({
      id: row.id,
      order: row.order,
      type: row.type || "Question",
      text: row.text || "",
      correctAnswer,
      studentAnswer: submittedAnswer,
      points: safePoints,
      teacherScore,
      teacherFeedback: row.teacherFeedback || null,
      reviewedByTeacherId: row.reviewedByTeacherId || null,
      reviewedAt: row.reviewedAt || null,
      isCorrect: Boolean(grading.isCorrect),
      earnedPoints: Number(Number(grading.earnedPoints || 0).toFixed(2)),
      needsTeacherReview: Boolean(grading.needsTeacherReview),
      gradingMode: grading.mode || "auto",
    });
  }

  const score =
    totalPoints > 0
      ? clamp(Math.round((earnedPoints / totalPoints) * 100), 0, 100)
      : null;
  const status =
    pendingTeacher > 0
      ? "waiting_teacher_review"
      : teacherReviewed > 0
        ? "teacher_graded"
        : "ai_graded";

  return {
    questions: mapped,
    summary: {
      totalPoints,
      earnedPoints: Number(earnedPoints.toFixed(2)),
      score,
      pendingTeacher,
      teacherReviewed,
      autoReviewed: Math.max(mapped.length - pendingTeacher - teacherReviewed, 0),
      status,
    },
  };
};

router.get("/profile", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.role,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.phone,
              p.staff_number AS "staffNumber",
              p.nid,
              p.school_name AS "schoolName",
              p.avatar_url AS "avatarUrl"
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
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

router.get("/dashboard", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { assignments, studentIds } = await getAssignedStudentIds(userId);
    const classMap = new Map();
    assignments.forEach((assignment) => {
      const key = assignment.classId
        ? assignment.classId
        : `${assignment.gradeLevel}::${assignment.className}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          classId: assignment.classId || null,
          gradeLevel: assignment.gradeLevel,
          className: assignment.className,
          subjects: [],
          isPrimaryClass: assignment.isPrimaryClass,
        });
      }
      const entry = classMap.get(key);
      if (assignment.subject && !entry.subjects.includes(assignment.subject)) {
        entry.subjects.push(assignment.subject);
      }
      if (assignment.isPrimaryClass) entry.isPrimaryClass = true;
    });
    const classList = Array.from(classMap.values());
    const primaryClass =
      classList.find((cls) => cls.isPrimaryClass) || classList[0] || null;

    const [
      profileResult,
      scoresResult,
      scheduleResult,
      tasksResult,
      focusResult,
      lessonCoverageResult,
    ] = await Promise.all([
      query(
        `SELECT first_name AS "firstName",
                last_name AS "lastName",
                staff_number AS "staffNumber",
                school_name AS "schoolName",
                avatar_url AS "avatarUrl"
           FROM user_profiles
          WHERE user_id = $1`,
        [userId],
      ),
      studentIds.length
        ? query(
            `SELECT grade_percent AS score
               FROM assessments
              WHERE user_id = ANY($1::uuid[])
                AND grade_percent IS NOT NULL
              ORDER BY assessment_date DESC NULLS LAST, created_at DESC
              LIMIT 3`,
            [studentIds],
          )
        : Promise.resolve({ rows: [] }),
      query(
        `SELECT day_of_week AS "day",
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
                completed,
                priority
           FROM tasks
          WHERE user_id = $1
          ORDER BY due_date`,
        [userId],
      ),
      studentIds.length
        ? query(
            `SELECT weak_area
               FROM assessments
              WHERE user_id = ANY($1::uuid[])
                AND weak_area IS NOT NULL
              ORDER BY created_at DESC
              LIMIT 1`,
            [studentIds],
          )
        : Promise.resolve({ rows: [] }),
      query(
        `SELECT COUNT(*)::int AS "totalAssignments",
                COUNT(*) FILTER (WHERE l.id IS NOT NULL)::int AS "trackedAssignments"
           FROM teacher_assignments ta
           LEFT JOIN class_subject_lessons l
             ON l.class_id = ta.class_id
            AND l.subject_id = ta.subject_id
          WHERE ta.teacher_id = $1`,
        [userId],
      ),
    ]);

    const profile = profileResult.rows[0] || {};
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ");
    const classesCount = classList.length;
    let assessmentsCount = 0;
    let plpsCount = 0;
    if (studentIds.length) {
      const { rows: assessmentCountRows } = await query(
        `SELECT COUNT(*)::int AS total
           FROM assessments
          WHERE user_id = ANY($1::uuid[])`,
        [studentIds],
      );
      assessmentsCount = assessmentCountRows[0]?.total || 0;
      const { rows: plpCountRows } = await query(
        `SELECT COUNT(*)::int AS total
           FROM plp_subjects
          WHERE user_id = ANY($1::uuid[])`,
        [studentIds],
      );
      plpsCount = plpCountRows[0]?.total || 0;
    }

    const summary = [
      {
        label: "Classes",
        current: classesCount,
        total: classesCount,
        percent: formatPercent(classesCount ? 100 : 0),
      },
      {
        label: "Assessments",
        current: assessmentsCount,
        total: assessmentsCount,
        percent: formatPercent(assessmentsCount ? 100 : 0),
      },
      {
        label: "PLPs",
        current: plpsCount,
        total: plpsCount,
        percent: formatPercent(plpsCount ? 100 : 0),
      },
    ];

    const scores = scoresResult.rows.map((row, idx) => ({
      term_id: idx + 1,
      val: row.score,
    }));
    const scoreValues = scoresResult.rows.map((row) => row.score);
    const avgScore =
      scoreValues.length > 0
        ? Math.round(scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length)
        : null;

    const ranking =
      avgScore === null
        ? "Ranking unavailable"
        : avgScore >= 85
          ? "Top Performer"
          : avgScore >= 70
            ? "On Track"
            : "Needs Support";

    const lessonCoverage = lessonCoverageResult.rows[0] || {};
    const totalAssignments =
      Number(lessonCoverage.totalAssignments) || assignments.length || 0;
    const trackedAssignments = Number(lessonCoverage.trackedAssignments) || 0;
    const curriculumProgressValue = totalAssignments
      ? Math.round((trackedAssignments / totalAssignments) * 100)
      : 0;
    const curriculumProgress = formatPercent(curriculumProgressValue) || "0%";
    const curriculumStatus = totalAssignments
      ? `${trackedAssignments}/${totalAssignments} class subjects updated`
      : "No class subjects assigned yet";

    const schedule = scheduleResult.rows.map((row) => ({
      day: DAY_LABELS[row.day] || `Day ${row.day}`,
      time: formatTimeRange(row.startTime, row.endTime),
      title: row.title,
    }));

    return res.json({
      teacher: {
        name: fullName || "Teacher",
        id: profile.staffNumber || null,
        school: profile.schoolName || null,
        image_url: profile.avatarUrl || null,
        currentTerm: process.env.CURRENT_TERM || "Term 2",
        ranking,
        overallPercentage: formatPercent(avgScore) || "0%",
        curriculumProgress,
        curriculumStatus,
        focus: focusResult.rows[0]?.weak_area || null,
      },
      assignments: {
        primaryClass,
        classes: classList,
        subjects: Array.from(
          new Set(assignments.map((assignment) => assignment.subject).filter(Boolean)),
        ),
      },
      summary,
      scores,
      schedule,
      tasks: tasksResult.rows.map((row) => ({
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

router.get("/search", async (req, res, next) => {
  try {
    const queryText = String(req.query.q || "").trim();
    const emptyResults = {
      classes: [],
      tasks: [],
      assessments: [],
      plans: [],
      resources: [],
      reports: [],
    };

    if (!queryText) {
      return res.json({ query: "", results: emptyResults });
    }

    const likeQuery = `%${queryText}%`;
    const lowerQuery = queryText.toLowerCase();
    const { assignments, studentIds } = await getAssignedStudentIds(req.user.id);

    const classMap = new Map();
    assignments.forEach((assignment) => {
      const key =
        assignment.classId || `${assignment.gradeLevel || ""}::${assignment.className || ""}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          id: key,
          className: assignment.className || "Class",
          gradeLevel: assignment.gradeLevel || null,
          subjects: new Set(),
        });
      }
      if (assignment.subject) {
        classMap.get(key).subjects.add(assignment.subject);
      }
    });

    const classRows = Array.from(classMap.values())
      .filter((item) => {
        const searchable = `${item.className} ${item.gradeLevel || ""} ${Array.from(
          item.subjects,
        ).join(" ")}`.toLowerCase();
        return searchable.includes(lowerQuery);
      })
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.className,
        subtitle:
          [item.gradeLevel, Array.from(item.subjects).join(", ")]
            .filter(Boolean)
            .join(" | ") || null,
        route: "/teacher/assessments",
      }));

    const taughtSubjects = Array.from(
      new Set(assignments.map((assignment) => assignment.subject).filter(Boolean)),
    );

    const [
      tasksResult,
      assessmentsResult,
      plansResult,
      resourcesResult,
      reportsResult,
    ] = await Promise.all([
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
                status,
                assessment_date AS "assessmentDate"
           FROM assessments
          WHERE teacher_id = $1
            AND (
              title ILIKE $2
              OR COALESCE(subject, '') ILIKE $2
              OR COALESCE(type, '') ILIKE $2
            )
          ORDER BY assessment_date DESC NULLS LAST, created_at DESC
          LIMIT 5`,
        [req.user.id, likeQuery],
      ),
      studentIds.length
        ? query(
            `SELECT ps.id,
                    ps.name,
                    ps.subject_code AS "subjectCode",
                    ps.status,
                    ps.last_assessment AS "lastAssessment",
                    p.first_name AS "firstName",
                    p.last_name AS "lastName"
               FROM plp_subjects ps
               LEFT JOIN user_profiles p ON p.user_id = ps.user_id
              WHERE ps.user_id = ANY($1::uuid[])
                AND (
                  ps.name ILIKE $2
                  OR COALESCE(ps.subject_code, '') ILIKE $2
                  OR COALESCE(ps.status, '') ILIKE $2
                  OR COALESCE(ps.category, '') ILIKE $2
                  OR COALESCE(p.first_name, '') ILIKE $2
                  OR COALESCE(p.last_name, '') ILIKE $2
                )
              ORDER BY ps.last_assessment DESC NULLS LAST, ps.created_at DESC
              LIMIT 5`,
            [studentIds, likeQuery],
          )
        : Promise.resolve({ rows: [] }),
      taughtSubjects.length
        ? query(
            `SELECT id,
                    name,
                    subject
               FROM resources
              WHERE subject = ANY($1::text[])
                AND (name ILIKE $2 OR subject ILIKE $2)
              ORDER BY resource_date DESC NULLS LAST, created_at DESC
              LIMIT 5`,
            [taughtSubjects, likeQuery],
          )
        : Promise.resolve({ rows: [] }),
      studentIds.length
        ? query(
            `SELECT p.grade_level AS "gradeLevel",
                    p.class_name AS "className",
                    COUNT(a.id)::int AS "assessmentsCount",
                    ROUND(AVG(a.grade_percent))::int AS "avgGrade"
               FROM assessments a
               JOIN user_profiles p ON p.user_id = a.user_id
              WHERE a.user_id = ANY($1::uuid[])
                AND (
                  COALESCE(p.class_name, '') ILIKE $2
                  OR COALESCE(p.grade_level, '') ILIKE $2
                  OR COALESCE(a.subject, '') ILIKE $2
                )
              GROUP BY p.grade_level, p.class_name
              ORDER BY COUNT(a.id) DESC, p.grade_level, p.class_name
              LIMIT 5`,
            [studentIds, likeQuery],
          )
        : Promise.resolve({ rows: [] }),
    ]);

    return res.json({
      query: queryText,
      results: {
        classes: classRows,
        tasks: tasksResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.dueDate ? `Due: ${formatShortDate(row.dueDate)}` : null,
          route: "/teacher/outline",
        })),
        assessments: assessmentsResult.rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: [row.subject, row.type, row.status, formatShortDate(row.assessmentDate)]
            .filter(Boolean)
            .join(" | "),
          route: "/teacher/assessments",
        })),
        plans: plansResult.rows.map((row) => {
          const learnerName =
            [row.firstName, row.lastName].filter(Boolean).join(" ") || "Student";
          return {
            id: row.id,
            title: row.name,
            subtitle: [learnerName, row.subjectCode, row.status]
              .filter(Boolean)
              .join(" | "),
            route: "/teacher/plp",
          };
        }),
        resources: resourcesResult.rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: row.subject || null,
          route: "/teacher/resources",
        })),
        reports: reportsResult.rows.map((row, index) => {
          const averageText =
            row.avgGrade === null || row.avgGrade === undefined
              ? "--"
              : `${row.avgGrade}%`;
          return {
            id: `${row.gradeLevel || "grade"}-${row.className || "class"}-${index}`,
            title: [row.className || "Class", row.gradeLevel].filter(Boolean).join(" - "),
            subtitle: `Assessments: ${row.assessmentsCount || 0} | Avg: ${averageText}`,
            route: "/teacher/reports",
          };
        }),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/lesson-progress", async (req, res, next) => {
  try {
    const { classId, subjectId } = req.query || {};
    const classFilter = String(classId || "").trim();
    const subjectFilter = String(subjectId || "").trim();
    if (classFilter && !isUuid(classFilter)) {
      return res.status(400).json({ error: "Invalid class id." });
    }
    if (subjectFilter && !isUuid(subjectFilter)) {
      return res.status(400).json({ error: "Invalid subject id." });
    }

    const { rows } = await query(
      `SELECT ta.id AS "assignmentId",
              ta.class_id AS "classId",
              ta.subject_id AS "subjectId",
              COALESCE(c.class_name, ta.class_name) AS "className",
              COALESCE(c.grade_level, ta.grade_level) AS "gradeLevel",
              COALESCE(s.name, ta.subject) AS "subjectName",
              l.id AS "lessonId",
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
              up.first_name AS "updatedByFirstName",
              up.last_name AS "updatedByLastName",
              uu.email AS "updatedByEmail"
         FROM teacher_assignments ta
         LEFT JOIN classes c ON c.id = ta.class_id
         LEFT JOIN subjects s ON s.id = ta.subject_id
         LEFT JOIN class_subject_lessons l
           ON l.class_id = ta.class_id
          AND l.subject_id = ta.subject_id
         LEFT JOIN users uu ON uu.id = l.updated_by
         LEFT JOIN user_profiles up ON up.user_id = l.updated_by
        WHERE ta.teacher_id = $1
          AND ($2::uuid IS NULL OR ta.class_id = $2)
          AND ($3::uuid IS NULL OR ta.subject_id = $3)
        ORDER BY COALESCE(c.grade_level, ta.grade_level),
                 COALESCE(c.class_name, ta.class_name),
                 COALESCE(s.name, ta.subject)`,
      [req.user.id, classFilter || null, subjectFilter || null],
    );

    return res.json({
      lessons: rows.map((row) => ({
        assignmentId: row.assignmentId,
        classId: row.classId,
        subjectId: row.subjectId,
        className: row.className || "--",
        gradeLevel: row.gradeLevel || "--",
        subject: row.subjectName || "Subject",
        lesson: row.lessonId
          ? {
              id: row.lessonId,
              unitTitle: row.unitTitle,
              lessonNumber: row.lessonNumber,
              topic: row.topic,
              pageFrom: row.pageFrom,
              pageTo: row.pageTo,
              term: row.term,
              weekNumber: row.weekNumber,
              notes: row.notes,
              effectiveDate: formatIsoDate(row.effectiveDate),
              updatedAt: row.updatedAt,
              updatedBy:
                [row.updatedByFirstName, row.updatedByLastName]
                  .filter(Boolean)
                  .join(" ") || row.updatedByEmail || null,
            }
          : null,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.put("/lesson-progress", async (req, res, next) => {
  try {
    const {
      classId,
      subjectId,
      unitTitle,
      lessonNumber,
      topic,
      pageFrom,
      pageTo,
      term,
      weekNumber,
      notes,
      effectiveDate,
    } = req.body || {};

    if (!isUuid(classId || "")) {
      return res.status(400).json({ error: "Valid classId is required." });
    }
    if (!isUuid(subjectId || "")) {
      return res.status(400).json({ error: "Valid subjectId is required." });
    }
    if (!String(topic || "").trim()) {
      return res.status(400).json({ error: "Topic is required." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id, class_id AS "classId", subject_id AS "subjectId"
         FROM teacher_assignments
        WHERE teacher_id = $1
          AND class_id = $2
          AND subject_id = $3
        LIMIT 1`,
      [req.user.id, classId, subjectId],
    );
    if (!assignmentRows[0]) {
      return res.status(403).json({
        error: "You are not assigned to this class and subject.",
      });
    }

    const pageFromValue = toNumberOrNull(pageFrom);
    const pageToValue = toNumberOrNull(pageTo);
    if (
      pageFromValue !== null &&
      pageToValue !== null &&
      pageFromValue > pageToValue
    ) {
      return res.status(400).json({
        error: "pageFrom cannot be greater than pageTo.",
      });
    }

    const { rows } = await query(
      `INSERT INTO class_subject_lessons (
          class_id,
          subject_id,
          teacher_id,
          updated_by,
          unit_title,
          lesson_number,
          topic,
          page_from,
          page_to,
          term,
          week_number,
          notes,
          effective_date,
          updated_at
        )
       VALUES (
          $1, $2, $3, $3,
          $4, $5, $6,
          $7, $8, $9, $10, $11,
          COALESCE($12::date, CURRENT_DATE),
          now()
        )
       ON CONFLICT (class_id, subject_id)
       DO UPDATE SET
          teacher_id = EXCLUDED.teacher_id,
          updated_by = EXCLUDED.updated_by,
          unit_title = EXCLUDED.unit_title,
          lesson_number = EXCLUDED.lesson_number,
          topic = EXCLUDED.topic,
          page_from = EXCLUDED.page_from,
          page_to = EXCLUDED.page_to,
          term = EXCLUDED.term,
          week_number = EXCLUDED.week_number,
          notes = EXCLUDED.notes,
          effective_date = EXCLUDED.effective_date,
          updated_at = now()
       RETURNING id,
                 class_id AS "classId",
                 subject_id AS "subjectId",
                 unit_title AS "unitTitle",
                 lesson_number AS "lessonNumber",
                 topic,
                 page_from AS "pageFrom",
                 page_to AS "pageTo",
                 term,
                 week_number AS "weekNumber",
                 notes,
                 effective_date AS "effectiveDate",
                 updated_at AS "updatedAt"`,
      [
        classId,
        subjectId,
        req.user.id,
        String(unitTitle || "").trim() || null,
        toNumberOrNull(lessonNumber),
        String(topic || "").trim().slice(0, 220),
        pageFromValue,
        pageToValue,
        String(term || "").trim() || null,
        toNumberOrNull(weekNumber),
        String(notes || "").trim() || null,
        String(effectiveDate || "").trim() || null,
      ],
    );

    await query(
      `INSERT INTO notifications (user_id, title, body)
       SELECT sse.student_id,
              'Lesson updated',
              $3
         FROM student_subject_enrollments sse
        WHERE sse.class_id = $1
          AND sse.subject_id = $2
          AND sse.status = 'Active'`,
      [
        classId,
        subjectId,
        `Your lesson progress was updated. Current topic: ${String(topic || "").trim().slice(0, 120)}.`,
      ],
    );

    return res.json({ lesson: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get("/record-marks/classes", async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH assignments AS (
         SELECT id,
                grade_level AS "gradeLevel",
                class_name AS "className",
                subject
           FROM teacher_assignments
          WHERE teacher_id = $1
       )
       SELECT a.id,
              a.subject,
              a."gradeLevel",
              a."className",
              COUNT(DISTINCT s.student_id)::int AS "studentsCount",
              MAX(s.program) AS "combination",
              COALESCE(
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT ass.type), NULL),
                '{}'
              ) AS "recordedTypes",
              COUNT(DISTINCT ass.id)::int AS "assessmentsCount",
              COUNT(DISTINCT ex.id)::int AS "exercisesCount",
              COUNT(
                DISTINCT CASE
                  WHEN es.status = 'submitted' THEN ex.id
                  ELSE NULL
                END
              )::int AS "submittedExercisesCount"
         FROM assignments a
         LEFT JOIN LATERAL (
           SELECT u.id AS student_id,
                  p.major AS program
             FROM users u
             JOIN user_profiles p ON p.user_id = u.id
            WHERE u.role = 'student'
              AND p.grade_level = a."gradeLevel"
              AND p.class_name = a."className"
         ) s ON true
         LEFT JOIN assessments ass
           ON ass.user_id = s.student_id
          AND (
            a.subject IS NULL
            OR lower(trim(COALESCE(ass.subject, ''))) =
               lower(trim(COALESCE(a.subject, '')))
          )
         LEFT JOIN exercises ex
           ON ex.user_id = s.student_id
          AND (
            a.subject IS NULL
            OR lower(trim(COALESCE(ex.subject, ''))) =
               lower(trim(COALESCE(a.subject, '')))
          )
         LEFT JOIN exercise_submissions es
           ON es.exercise_id = ex.id
          AND es.user_id = s.student_id
        GROUP BY a.id, a.subject, a."gradeLevel", a."className"
        ORDER BY a."gradeLevel", a."className", a.subject`,
      [req.user.id],
    );

    const maxMarks = 20;
    return res.json({
      classes: rows.map((row) => ({
        id: row.id,
        courseName: row.subject || "Course",
        classGroup: row.className || "--",
        level: row.gradeLevel || "--",
        combination: row.combination || "--",
        maxMarks,
        recordedTypes: row.recordedTypes || [],
        studentsCount: row.studentsCount || 0,
        assessmentsCount: row.assessmentsCount || 0,
        exercisesCount: row.exercisesCount || 0,
        submittedExercisesCount: row.submittedExercisesCount || 0,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/record-marks/classes/:id", async (req, res, next) => {
  try {
    const assignmentId = req.params.id;
    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class id." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: studentsRows } = await query(
      `SELECT u.id,
              u.email,
              p.student_id AS "studentNumber",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              unit.grade_percent AS "endUnitPercent",
              term.grade_percent AS "endTermPercent"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN LATERAL (
           SELECT grade_percent
             FROM assessments a
            WHERE a.user_id = u.id
              AND a.subject = $3
              AND LOWER(a.type) = 'end of unit'
            ORDER BY a.assessment_date DESC NULLS LAST, a.created_at DESC
            LIMIT 1
         ) unit ON true
         LEFT JOIN LATERAL (
           SELECT grade_percent
             FROM assessments a
            WHERE a.user_id = u.id
              AND a.subject = $3
              AND LOWER(a.type) = 'end of term'
            ORDER BY a.assessment_date DESC NULLS LAST, a.created_at DESC
            LIMIT 1
         ) term ON true
        WHERE u.role = 'student'
          AND p.grade_level = $1
          AND p.class_name = $2
        ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
      [assignment.gradeLevel, assignment.className, assignment.subject],
    );

    const maxMarks = 20;
    const toMark = (percent) =>
      percent === null || percent === undefined
        ? null
        : Math.round((Number(percent) / 100) * maxMarks);

    return res.json({
      classInfo: {
        id: assignment.id,
        courseName: assignment.subject || "Course",
        classGroup: assignment.className || "--",
        level: assignment.gradeLevel || "--",
        combination: "--",
        maxMarks,
      },
      students: studentsRows.map((row) => ({
        id: row.id,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "Student",
        studentNumber: row.studentNumber || "--",
        endUnit: toMark(row.endUnitPercent),
        endTerm: toMark(row.endTermPercent),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/record-marks/import", async (req, res, next) => {
  try {
    const { assignmentId, rows, maxMarks } = req.body || {};
    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class id." });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Rows are required for import." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: classStudentRows } = await query(
      `SELECT u.id,
              p.student_id AS "studentNumber"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND (
            ($1::uuid IS NOT NULL AND p.class_id = $1)
            OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
          )`,
      [assignment.classId, assignment.gradeLevel, assignment.className],
    );

    const allowedStudentIds = new Set(
      classStudentRows.map((row) => String(row.id)),
    );
    const studentNumberMap = new Map();
    classStudentRows.forEach((row) => {
      const key = String(row.studentNumber || "").trim().toLowerCase();
      if (key) studentNumberMap.set(key, String(row.id));
    });

    const safeMaxMarks = clamp(toNumberOrNull(maxMarks) ?? 20, 1, 100);
    const updated = [];
    const skipped = [];
    const cappedRows = rows.slice(0, 500);

    const upsertAssessmentMark = async ({ studentId, type, mark }) => {
      const boundedMark = clamp(mark, 0, safeMaxMarks);
      const obtainedMark = Math.round(boundedMark);
      const percent = markToPercent(obtainedMark, safeMaxMarks);
      if (percent === null) return;

      const assessmentTitle = `${assignment.subject || "Subject"} ${type}`.trim();
      const predictedPercent = clamp(percent + 5, 0, 100);
      const { rows: existingRows } = await query(
        `SELECT id
           FROM assessments
          WHERE user_id = $1
            AND subject = $2
            AND LOWER(type) = LOWER($3)
          ORDER BY assessment_date DESC NULLS LAST, created_at DESC
          LIMIT 1`,
        [studentId, assignment.subject, type],
      );

      if (existingRows[0]) {
        await query(
          `UPDATE assessments
              SET title = $3,
                  type = $4,
                  assessment_date = now(),
                  status = 'Completed',
                  grade_percent = $5,
                  predicted_percent = $6,
                  score_obtained = $7,
                  score_total = $8,
                  teacher_id = $9
            WHERE id = $1
              AND user_id = $2`,
          [
            existingRows[0].id,
            studentId,
            assessmentTitle,
            type,
            percent,
            predictedPercent,
            obtainedMark,
            safeMaxMarks,
            req.user.id,
          ],
        );
        return;
      }

      await query(
        `INSERT INTO assessments (
            user_id, student_id, teacher_id, title, subject, type,
            assessment_date, status, grade_percent, predicted_percent,
            score_obtained, score_total
          )
         VALUES (
            $1, $1, $2, $3, $4, $5,
            now(), 'Completed', $6, $7,
            $8, $9
          )`,
        [
          studentId,
          req.user.id,
          assessmentTitle,
          assignment.subject,
          type,
          percent,
          predictedPercent,
          obtainedMark,
          safeMaxMarks,
        ],
      );
    };

    for (const row of cappedRows) {
      const directStudentId = isUuid(row?.studentId || "") ? String(row.studentId) : null;
      const normalizedStudentNumber = String(
        row?.studentNumber || row?.student_id || row?.studentIdLabel || "",
      )
        .trim()
        .toLowerCase();

      const resolvedStudentId =
        (directStudentId && allowedStudentIds.has(directStudentId)
          ? directStudentId
          : null) || studentNumberMap.get(normalizedStudentNumber);

      if (!resolvedStudentId) {
        skipped.push({
          studentId: row?.studentId || null,
          studentNumber: row?.studentNumber || null,
          reason: "Student not found in selected class.",
        });
        continue;
      }

      const endUnitMark = parseMarkValue(row, [
        "endUnit",
        "end_unit",
        "unit",
        "endOfUnit",
      ]);
      const endTermMark = parseMarkValue(row, [
        "endTerm",
        "end_term",
        "term",
        "endOfTerm",
      ]);

      if (endUnitMark === null && endTermMark === null) {
        skipped.push({
          studentId: resolvedStudentId,
          studentNumber: row?.studentNumber || null,
          reason: "No mark value provided.",
        });
        continue;
      }

      if (endUnitMark !== null) {
        await upsertAssessmentMark({
          studentId: resolvedStudentId,
          type: "End of Unit",
          mark: endUnitMark,
        });
      }
      if (endTermMark !== null) {
        await upsertAssessmentMark({
          studentId: resolvedStudentId,
          type: "End of Term",
          mark: endTermMark,
        });
      }

      updated.push({
        studentId: resolvedStudentId,
        studentNumber: row?.studentNumber || null,
        endUnit: endUnitMark,
        endTerm: endTermMark,
      });
    }

    await logAudit(req, "marks_import", {
      assignmentId,
      importedRows: updated.length,
      skippedRows: skipped.length,
    });

    const summaryBody = [
      `${updated.length} mark row(s) imported for ${assignment.subject || "the selected subject"}.`,
      assignment.className ? `Class: ${assignment.className}.` : null,
      skipped.length ? `Skipped: ${skipped.length}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    await createNotification(
      req.user.id,
      "Marks import completed",
      summaryBody,
    );

    return res.json({
      assignmentId,
      maxMarks: safeMaxMarks,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      updated,
      skipped: skipped.slice(0, 30),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/students", async (req, res, next) => {
  try {
    const { rows } = await query(
      `WITH teacher_scope AS (
         SELECT ta.teacher_id,
                COALESCE(ta.class_id, c.id) AS class_id,
                COALESCE(ta.grade_level, c.grade_level) AS grade_level,
                COALESCE(ta.class_name, c.class_name) AS class_name,
                COALESCE(ta.subject, s.name) AS subject,
                ta.is_primary_class AS is_primary_class
           FROM teacher_assignments ta
           LEFT JOIN classes c ON c.id = ta.class_id
           LEFT JOIN subjects s ON s.id = ta.subject_id
          WHERE ta.teacher_id = $1
       ),
       student_scope AS (
         SELECT DISTINCT u.id AS student_id,
                u.email,
                p.first_name,
                p.last_name,
                COALESCE(
                  NULLIF(to_jsonb(p)->>'student_id', ''),
                  NULLIF(to_jsonb(p)->>'student_number', ''),
                  NULLIF(to_jsonb(p)->>'studentNumber', ''),
                  NULLIF(to_jsonb(p)->>'reg_number', ''),
                  NULLIF(to_jsonb(p)->>'registration_number', '')
                ) AS student_number,
                p.class_id,
                p.grade_level,
                p.class_name,
                p.major AS program,
                p.avatar_url
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
           JOIN teacher_scope ts
             ON (ts.class_id IS NOT NULL AND p.class_id = ts.class_id)
             OR (ts.class_id IS NULL AND p.grade_level = ts.grade_level AND p.class_name = ts.class_name)
          WHERE u.role = 'student'
       ),
       student_subjects AS (
         SELECT ss.student_id,
                array_agg(DISTINCT ts.subject) FILTER (WHERE ts.subject IS NOT NULL) AS subjects,
                bool_or(ts.is_primary_class) AS is_primary_class
           FROM student_scope ss
           JOIN teacher_scope ts
             ON (ts.class_id IS NOT NULL AND ss.class_id = ts.class_id)
             OR (ts.class_id IS NULL AND ss.grade_level = ts.grade_level AND ss.class_name = ts.class_name)
          GROUP BY ss.student_id
       )
       SELECT ss.student_id AS id,
              ss.email,
              ss.first_name AS "firstName",
              ss.last_name AS "lastName",
              ss.student_number AS "studentNumber",
              ss.class_id AS "classId",
              ss.grade_level AS "gradeLevel",
              ss.class_name AS "className",
              ROW_NUMBER() OVER (
                PARTITION BY ss.grade_level, ss.class_name
                ORDER BY ss.first_name NULLS LAST, ss.last_name NULLS LAST, ss.email
              )::int AS "studentNo",
              ss.program,
              ss.avatar_url AS "avatarUrl",
              student_subjects.subjects,
              student_subjects.is_primary_class AS "isPrimaryClass",
              stats.total_assessments AS "assessmentsCount",
              stats.completed_assessments AS "completedCount",
              stats.avg_grade AS "avgGrade",
              stats.last_assessment_date AS "lastAssessmentDate",
              stats.last_weak_area AS "weakArea"
         FROM student_scope ss
         JOIN student_subjects ON student_subjects.student_id = ss.student_id
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS total_assessments,
                  COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_assessments,
                  AVG(grade_percent)::int AS avg_grade,
                  MAX(assessment_date) AS last_assessment_date,
                  (
                    SELECT a2.weak_area
                      FROM assessments a2
                     WHERE a2.user_id = ss.student_id
                       AND a2.weak_area IS NOT NULL
                       AND (student_subjects.subjects IS NULL OR a2.subject = ANY(student_subjects.subjects))
                     ORDER BY a2.assessment_date DESC NULLS LAST, a2.created_at DESC
                     LIMIT 1
                  ) AS last_weak_area
             FROM assessments a
            WHERE a.user_id = ss.student_id
              AND (student_subjects.subjects IS NULL OR a.subject = ANY(student_subjects.subjects))
         ) stats ON true
        ORDER BY ss.first_name NULLS LAST, ss.last_name NULLS LAST, ss.email`,
      [req.user.id],
    );

    return res.json({
      students: rows.map((row) => {
        const name =
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "Student";
        return {
          id: row.id,
          name,
          email: row.email,
          studentNumber: row.studentNumber || null,
          classId: row.classId,
          gradeLevel: row.gradeLevel,
          className: row.className,
          studentNo: row.studentNo || null,
          program: row.program,
          avatarUrl: row.avatarUrl,
          subjects: row.subjects || [],
          isPrimaryClass: row.isPrimaryClass || false,
          assessmentsCount: row.assessmentsCount || 0,
          completedCount: row.completedCount || 0,
          avgGrade:
            row.avgGrade === null || row.avgGrade === undefined
              ? null
              : formatPercent(row.avgGrade),
          lastAssessmentDate: formatShortDate(row.lastAssessmentDate),
          weakArea: row.weakArea || null,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/students/:id/overview", async (req, res, next) => {
  try {
    const studentId = req.params.id;
    if (!isUuid(studentId)) {
      return res.status(400).json({ error: "Invalid student id." });
    }

    const { assignments } = await getAssignedStudentIds(req.user.id);
    const { rows: studentRows } = await query(
      `SELECT u.id,
              u.email,
              u.role,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.class_id AS "classId",
              p.grade_level AS "gradeLevel",
              p.class_name AS "className",
              p.major AS program,
              p.avatar_url AS "avatarUrl",
              s.overall_percentage AS "overallPercentage",
              s.ranking,
              s.weakness
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN student_stats s ON s.user_id = u.id
        WHERE u.id = $1`,
      [studentId],
    );

    const student = studentRows[0];
    if (!student || student.role !== "student") {
      return res.status(404).json({ error: "Student not found." });
    }
    const isAssigned = assignments.some((assignment) => {
      if (assignment.classId && student.classId) {
        return assignment.classId === student.classId;
      }
      return (
        assignment.gradeLevel === student.gradeLevel &&
        assignment.className === student.className
      );
    });
    if (!isAssigned) {
      return res.status(403).json({ error: "Student not assigned to you." });
    }

    const { rows: subjectRows } = await query(
      `SELECT DISTINCT COALESCE(ta.subject, s.name) AS subject
         FROM teacher_assignments ta
         LEFT JOIN subjects s ON s.id = ta.subject_id
         LEFT JOIN classes c ON c.id = ta.class_id
        WHERE ta.teacher_id = $1
          AND (
            (ta.class_id IS NOT NULL AND ta.class_id = $2)
            OR (ta.class_id IS NULL AND ta.grade_level = $3 AND ta.class_name = $4)
          )`,
      [req.user.id, student.classId, student.gradeLevel, student.className],
    );
    const allowedSubjects = subjectRows
      .map((row) => row.subject)
      .filter(Boolean);
    const subjectFilter =
      allowedSubjects.length > 0 ? allowedSubjects : null;

    const [
      summaryResult,
      assessmentsResult,
      exercisesResult,
      termScoresResult,
      plpResult,
    ] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total_assessments,
                COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_assessments,
                AVG(grade_percent)::int AS avg_grade,
                MAX(assessment_date) AS last_assessment_date
           FROM assessments
          WHERE user_id = $1
            AND ($2::text[] IS NULL OR subject = ANY($2::text[]))`,
        [studentId, subjectFilter],
      ),
      query(
        `SELECT id,
                title,
                subject,
                status,
                grade_percent AS "gradePercent",
                predicted_percent AS "predictedPercent",
                assessment_date AS "assessmentDate",
                weak_area AS "weakArea"
           FROM assessments
          WHERE user_id = $1
            AND ($2::text[] IS NULL OR subject = ANY($2::text[]))
          ORDER BY assessment_date DESC NULLS LAST, created_at DESC
          LIMIT 6`,
        [studentId, subjectFilter],
      ),
      query(
        `SELECT e.id,
                e.name,
                e.subject,
                e.question_count AS "questionCount",
                e.exercise_date AS "exerciseDate",
                sub.score AS "score",
                sub.status AS "status",
                sub.submitted_at AS "submittedAt"
           FROM exercises e
           LEFT JOIN LATERAL (
             SELECT score, status, submitted_at
               FROM exercise_submissions es
              WHERE es.user_id = $1
                AND es.exercise_id = e.id
              ORDER BY es.submitted_at DESC NULLS LAST, es.created_at DESC
              LIMIT 1
           ) sub ON true
          WHERE e.user_id = $1
            AND ($2::text[] IS NULL OR e.subject = ANY($2::text[]))
          ORDER BY e.exercise_date DESC NULLS LAST, e.created_at DESC
          LIMIT 6`,
        [studentId, subjectFilter],
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
          GROUP BY t.id, t.name, t.year, t.starts_on, t.ends_on, t.is_current
          ORDER BY t.year, t.starts_on`,
        [studentId],
      ),
      query(
        `SELECT p.id,
                p.subject_code AS "subjectCode",
                p.name,
                p.category,
                p.status,
                p.progress,
                p.last_assessment AS "lastAssessment",
                p.teacher_name AS "teacherName",
                p.feedback
           FROM plp_subjects p
          WHERE p.user_id = $1
            AND ($2::text[] IS NULL OR p.name = ANY($2::text[]) OR p.subject_code = ANY($2::text[]))
          ORDER BY p.last_assessment DESC NULLS LAST, p.created_at DESC`,
        [studentId, subjectFilter],
      ),
    ]);

    const summary = summaryResult.rows[0] || {
      total_assessments: 0,
      completed_assessments: 0,
      avg_grade: null,
      last_assessment_date: null,
    };

    const completionRate = summary.total_assessments
      ? Math.round(
          (summary.completed_assessments / summary.total_assessments) * 100,
        )
      : 0;

    const filteredWeakAreas = assessmentsResult.rows
      .map((row) => row.weakArea)
      .filter(Boolean);
    const latestWeakArea = filteredWeakAreas[0] || null;

    const termRows = termScoresResult.rows || [];
    const computedScores = termRows.map((row, index) => ({
      term_id: parseTermNumber(row.name) || index + 1,
      val: row.avgScore,
      name: row.name,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
    }));
    const scoredTerms = computedScores.filter(
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
    if (!currentTermRow && termRows.length > 0) {
      currentTermRow = termRows[termRows.length - 1];
    }

    const currentTermNumber = parseTermNumber(currentTermRow?.name);
    const scores = currentTermNumber
      ? scoredTerms.filter((row) => row.term_id <= currentTermNumber)
      : scoredTerms;

    return res.json({
      student: {
        id: student.id,
        name:
          [student.firstName, student.lastName].filter(Boolean).join(" ") ||
          student.email ||
          "Student",
        email: student.email,
        gradeLevel: student.gradeLevel,
        className: student.className,
        program: student.program,
        avatarUrl: student.avatarUrl,
        subjects: allowedSubjects,
        overallPercentage:
          student.overallPercentage === null ||
          student.overallPercentage === undefined
            ? null
            : formatPercent(student.overallPercentage),
        ranking: student.ranking,
        weakness: latestWeakArea || student.weakness,
      },
      summary: {
        totalAssessments: summary.total_assessments || 0,
        completedAssessments: summary.completed_assessments || 0,
        avgGrade:
          summary.avg_grade === null || summary.avg_grade === undefined
            ? null
            : formatPercent(summary.avg_grade),
        completionRate: `${completionRate}%`,
        lastAssessmentDate: formatShortDate(summary.last_assessment_date),
      },
      scores,
      assessments: assessmentsResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        status: row.status,
        grade:
          row.gradePercent === null || row.gradePercent === undefined
            ? null
            : formatPercent(row.gradePercent),
        predicted:
          row.predictedPercent === null || row.predictedPercent === undefined
            ? null
            : formatPercent(row.predictedPercent),
        date: formatShortDate(row.assessmentDate),
        weakArea: row.weakArea,
      })),
      exercises: exercisesResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        questionCount: row.questionCount,
        date: formatShortDate(row.exerciseDate),
        score:
          row.score === null || row.score === undefined ? null : row.score,
        status: row.status || null,
        submittedAt: formatShortDate(row.submittedAt),
      })),
      plp: plpResult.rows.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        name: row.name,
        category: row.category,
        status: row.status,
        progress: row.progress,
        lastAssessment: formatShortDate(row.lastAssessment),
        teacherName: row.teacherName,
        feedback: row.feedback,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assessments", async (req, res, next) => {
  try {
    const requestedStudentId = req.query.studentId;
    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.json({ assessments: [] });
    }
    let scopedStudentIds = studentIds;
    if (requestedStudentId) {
      if (!isUuid(requestedStudentId)) {
        return res.status(400).json({ error: "Invalid student id." });
      }
      if (!studentIds.includes(requestedStudentId)) {
        return res.status(403).json({ error: "Student not assigned to you." });
      }
      scopedStudentIds = [requestedStudentId];
    }
    const { rows } = await query(
      `SELECT a.id,
              a.title,
              a.subject,
              a.type,
              a.assessment_date AS "assessmentDate",
              a.status,
              a.grade_percent AS "gradePercent",
              a.predicted_percent AS "predictedPercent",
              a.weak_area AS "weakArea",
              a.ai_feedback AS "aiFeedback",
              u.id AS "studentId",
              u.email AS "studentEmail",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber",
              p.class_name AS "className",
              p.grade_level AS "gradeLevel"
         FROM assessments a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE a.user_id = ANY($1::uuid[])
        ORDER BY a.assessment_date DESC NULLS LAST`,
      [scopedStudentIds],
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
        predicted:
          row.predictedPercent === null ? null : formatPercent(row.predictedPercent),
        weakArea: row.weakArea,
        aiFeedback: row.aiFeedback,
        student: {
          id: row.studentId,
          email: row.studentEmail,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.studentEmail ||
            "Student",
          studentNumber: row.studentNumber || null,
          className: row.className || null,
          gradeLevel: row.gradeLevel || null,
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/assessments/class", async (req, res, next) => {
  try {
    const assignmentId = req.query.assignmentId;
    if (!assignmentId || !isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class id." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: studentRows } = await query(
      `SELECT u.id
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND (
            ($1::uuid IS NOT NULL AND p.class_id = $1)
            OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
          )`,
      [assignment.classId, assignment.gradeLevel, assignment.className],
    );

    const studentIds = studentRows.map((row) => row.id);
    const totalStudents = studentIds.length;
    const classInfo = {
      id: assignment.id,
      courseName: assignment.subject || "Course",
      classGroup: assignment.className || "--",
      level: assignment.gradeLevel || "--",
      totalStudents,
    };

    if (!totalStudents) {
      return res.json({ classInfo, assessments: [] });
    }

    const { rows } = await query(
      `SELECT a.title,
              a.type,
              a.subject,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS completed,
              AVG(a.grade_percent)::int AS avg_score,
              MAX(a.assessment_date) AS "lastDate"
         FROM assessments a
        WHERE a.user_id = ANY($1::uuid[])
          AND ($2::text IS NULL OR a.subject = $2)
        GROUP BY a.title, a.type, a.subject
        ORDER BY MAX(a.assessment_date) DESC NULLS LAST, a.title`,
      [studentIds, assignment.subject || null],
    );

    const toKey = (value) =>
      String(value || "assessment")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);

    return res.json({
      classInfo,
      assessments: rows.map((row) => {
        const typeLabel = row.type || "Assessment";
        const titleLabel = row.title || typeLabel;
        const normalized = `${typeLabel} ${titleLabel}`.toLowerCase();
        const isDiagnostic =
          normalized.includes("diagnostic") || normalized.includes("ai");
        const isUnit = normalized.includes("unit");
        const category = isDiagnostic ? "diagnostic" : isUnit ? "unit" : "assessment";
        const completionRate = totalStudents
          ? Math.round(((row.completed || 0) / totalStudents) * 100)
          : 0;
        const avgScore =
          row.avg_score === null || row.avg_score === undefined
            ? null
            : Number(row.avg_score);
        return {
          id: `${assignment.id}-${toKey(typeLabel)}-${toKey(titleLabel)}`,
          title: titleLabel,
          type: typeLabel,
          subject: row.subject || assignment.subject,
          totalStudents,
          assignedCount: row.total || 0,
          completedCount: row.completed || 0,
          completionRate,
          avgScore,
          lastDate: formatShortDate(row.lastDate),
          isAi: isDiagnostic,
          category,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/assessments/from-exercises", async (req, res, next) => {
  try {
    const { assignmentId, exerciseIds } = req.body || {};
    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class assignment id." });
    }

    const requestedIds = Array.isArray(exerciseIds)
      ? Array.from(new Set(exerciseIds.filter((id) => isUuid(id))))
      : [];
    if (!requestedIds.length) {
      return res.status(400).json({ error: "Select at least one exercise." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              subject_id AS "subjectId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: classStudentRows } = await query(
      `SELECT u.id,
              u.email,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND (
            ($1::uuid IS NOT NULL AND p.class_id = $1)
            OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
          )`,
      [assignment.classId, assignment.gradeLevel, assignment.className],
    );
    const classStudentIds = classStudentRows.map((row) => row.id);
    if (!classStudentIds.length) {
      return res.status(400).json({ error: "No students found for this class." });
    }

    const studentMap = new Map(
      classStudentRows.map((row) => {
        const fullName =
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "Student";
        return [
          row.id,
          {
            id: row.id,
            email: row.email || null,
            name: fullName,
            studentNumber: row.studentNumber || null,
          },
        ];
      }),
    );

    const { rows: exerciseRows } = await query(
      `SELECT e.id,
              e.user_id AS "studentId",
              e.name,
              e.subject,
              e.exercise_date AS "exerciseDate",
              latest.score AS "submissionScore"
         FROM exercises e
         LEFT JOIN LATERAL (
           SELECT es.score
             FROM exercise_submissions es
            WHERE es.exercise_id = e.id
              AND es.user_id = e.user_id
            ORDER BY es.submitted_at DESC NULLS LAST, es.created_at DESC
            LIMIT 1
         ) latest ON true
        WHERE e.id = ANY($1::uuid[])
          AND e.user_id = ANY($2::uuid[])
          AND (
            $3::text IS NULL
            OR lower(trim(COALESCE(e.subject, ''))) = lower(trim($3))
          )`,
      [requestedIds, classStudentIds, assignment.subject || null],
    );

    if (!exerciseRows.length) {
      return res.status(404).json({
        error:
          "No matching exercises found for this class. Ensure exercises are generated for this class subject.",
      });
    }

    const insertedAssessments = [];
    const skipped = [];

    for (const exercise of exerciseRows) {
      const assessmentDate =
        formatIsoDate(exercise.exerciseDate) || formatIsoDate(new Date());
      const title =
        String(exercise.name || `${assignment.subject || "Subject"} Diagnostic`)
          .trim()
          .slice(0, 160) || "Exercise Diagnostic";
      const typeLabel = "Exercise Diagnostic";
      const scoreValue = toNumberOrNull(exercise.submissionScore);
      const gradePercent =
        scoreValue === null
          ? null
          : clamp(Math.round(Number(scoreValue)), 0, 100);
      const status = gradePercent === null ? "In Progress" : "Completed";
      const weakArea =
        gradePercent === null
          ? null
          : inferWeakArea({
              subject: assignment.subject || exercise.subject,
              type: typeLabel,
              gradePercent,
            });
      const predictedPercent =
        gradePercent === null ? null : clamp(gradePercent + 6, 0, 100);
      const feedback =
        gradePercent === null
          ? `Exercise "${title}" was added to assessments and is waiting for submission.`
          : buildAiFeedback({
              gradePercent,
              weakArea: weakArea || "core concept understanding",
              recommendations: buildPlanRecommendations({
                subject: assignment.subject || exercise.subject,
                weakArea: weakArea || "core concept understanding",
                gradePercent,
              }),
              subject: assignment.subject || exercise.subject,
              type: typeLabel,
            });

      const { rows: existingRows } = await query(
        `SELECT id
           FROM assessments
          WHERE user_id = $1
            AND teacher_id = $2
            AND type = $3
            AND title = $4
            AND assessment_date = $5
          LIMIT 1`,
        [
          exercise.studentId,
          req.user.id,
          typeLabel,
          title,
          assessmentDate,
        ],
      );

      if (existingRows[0]) {
        skipped.push({
          exerciseId: exercise.id,
          reason: "already_added",
        });
        continue;
      }

      const { rows: insertedRows } = await query(
        `INSERT INTO assessments (
            user_id,
            student_id,
            teacher_id,
            subject_id,
            title,
            subject,
            type,
            assessment_date,
            status,
            grade_percent,
            predicted_percent,
            weak_area,
            ai_feedback,
            score_obtained,
            score_total
          )
         VALUES (
            $1, $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14
          )
         RETURNING id,
                   title,
                   subject,
                   type,
                   assessment_date AS "assessmentDate",
                   status,
                   grade_percent AS "gradePercent",
                   predicted_percent AS "predictedPercent",
                   weak_area AS "weakArea",
                   ai_feedback AS "aiFeedback"`,
        [
          exercise.studentId,
          req.user.id,
          assignment.subjectId || null,
          title,
          assignment.subject || exercise.subject || "Subject",
          typeLabel,
          assessmentDate,
          status,
          gradePercent,
          predictedPercent,
          weakArea,
          feedback,
          gradePercent,
          gradePercent === null ? null : 100,
        ],
      );

      const inserted = insertedRows[0];
      const student = studentMap.get(exercise.studentId);
      insertedAssessments.push({
        id: inserted.id,
        title: inserted.title,
        subject: inserted.subject,
        type: inserted.type,
        date: formatShortDate(inserted.assessmentDate),
        status: inserted.status,
        grade:
          inserted.gradePercent === null
            ? null
            : formatPercent(inserted.gradePercent),
        predicted:
          inserted.predictedPercent === null
            ? null
            : formatPercent(inserted.predictedPercent),
        weakArea: inserted.weakArea,
        aiFeedback: inserted.aiFeedback,
        student: {
          id: student?.id || exercise.studentId,
          email: student?.email || null,
          name: student?.name || "Student",
          studentNumber: student?.studentNumber || null,
          className: assignment.className || null,
          gradeLevel: assignment.gradeLevel || null,
        },
      });
    }

    if (insertedAssessments.length > 0) {
      await createNotification(
        req.user.id,
        "Assessments updated",
        `${insertedAssessments.length} exercise(s) were added to assessments for ${assignment.className || "the selected class"}.`,
      );
    }

    await logAudit(req, "assessments_added_from_exercises", {
      assignmentId,
      requestedCount: requestedIds.length,
      addedCount: insertedAssessments.length,
      skippedCount: skipped.length,
    });

    return res.json({
      addedCount: insertedAssessments.length,
      skippedCount: skipped.length,
      skipped,
      assessments: insertedAssessments,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/assessments/submit-answers",
  aiLimiter,
  uploadLimiter,
  classroomFileUpload.array("files", 10),
  async (req, res, next) => {
    try {
      const {
        assignmentId,
        studentId,
        assessmentId,
        title,
        type,
        weakArea,
        teacherNotes,
      } = req.body || {};

      if (!isUuid(assignmentId)) {
        return res.status(400).json({ error: "Invalid class assignment id." });
      }
      if (!isUuid(studentId)) {
        return res.status(400).json({ error: "Invalid student id." });
      }
      if (assessmentId && !isUuid(assessmentId)) {
        return res.status(400).json({ error: "Invalid assessment id." });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (!files.length) {
        return res
          .status(400)
          .json({ error: "Upload at least one answer image or document." });
      }

      const { rows: assignmentRows } = await query(
        `SELECT id,
                class_id AS "classId",
                subject_id AS "subjectId",
                grade_level AS "gradeLevel",
                class_name AS "className",
                subject
           FROM teacher_assignments
          WHERE id = $1
            AND teacher_id = $2`,
        [assignmentId, req.user.id],
      );
      const assignment = assignmentRows[0];
      if (!assignment) {
        return res.status(404).json({ error: "Class assignment not found." });
      }

      const { rows: studentRows } = await query(
        `SELECT u.id,
                u.email,
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                p.student_id AS "studentNumber"
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
          WHERE u.id = $1
            AND u.role = 'student'
            AND (
              ($2::uuid IS NOT NULL AND p.class_id = $2)
              OR ($2::uuid IS NULL AND p.grade_level = $3 AND p.class_name = $4)
            )`,
        [studentId, assignment.classId, assignment.gradeLevel, assignment.className],
      );
      const student = studentRows[0];
      if (!student) {
        return res
          .status(403)
          .json({ error: "Student is not in the selected class assignment." });
      }

      let targetAssessment = null;
      if (assessmentId) {
        const { rows: existingAssessmentRows } = await query(
          `SELECT id,
                  title,
                  type
             FROM assessments
            WHERE id = $1
              AND user_id = $2
              AND teacher_id = $3
            LIMIT 1`,
          [assessmentId, student.id, req.user.id],
        );
        targetAssessment = existingAssessmentRows[0] || null;
        if (!targetAssessment) {
          return res.status(404).json({ error: "Assessment not found." });
        }
      }

      const analysisCandidates = [];
      for (const file of files) {
        const analysis = await analyzeAssessmentWithGemini({
          imagePath: file.path,
          mimeType: file.mimetype,
          subject: assignment.subject,
          assessmentType: type || targetAssessment?.type || "Assessment",
          className: assignment.className,
          gradeLevel: assignment.gradeLevel,
          teacherNotes,
          providedScoreObtained: null,
          providedScoreTotal: null,
        });
        if (analysis) {
          analysisCandidates.push({
            analysis,
            fileName: file.originalname || path.basename(file.path || ""),
          });
        }
      }
      const bestAnalysisCandidate = pickBestAssessmentAnalysis(analysisCandidates);
      const bestAnalysis = bestAnalysisCandidate?.analysis || null;

      const normalizedType = String(
        type || targetAssessment?.type || "Assessment",
      )
        .trim()
        .slice(0, 80);
      const normalizedTitle = String(
        title ||
          targetAssessment?.title ||
          `${assignment.subject || "Subject"} ${normalizedType}`,
      )
        .trim()
        .slice(0, 160);

      const gradePercent =
        bestAnalysis?.gradePercent === null ||
        bestAnalysis?.gradePercent === undefined
          ? null
          : clamp(Math.round(Number(bestAnalysis.gradePercent)), 0, 100);
      const scoreTotal =
        bestAnalysis?.scoreTotal === null || bestAnalysis?.scoreTotal === undefined
          ? null
          : clamp(Math.round(Number(bestAnalysis.scoreTotal)), 1, 100);
      const scoreObtained =
        bestAnalysis?.scoreObtained === null ||
        bestAnalysis?.scoreObtained === undefined
          ? null
          : clamp(
              Math.round(Number(bestAnalysis.scoreObtained)),
              0,
              scoreTotal || 100,
            );

      const resolvedWeakArea =
        String(weakArea || "").trim() ||
        String(bestAnalysis?.weakArea || "").trim() ||
        inferWeakArea({
          subject: assignment.subject,
          type: normalizedType,
          gradePercent: gradePercent === null ? 55 : gradePercent,
        });

      const recommendations =
        Array.isArray(bestAnalysis?.recommendations) &&
        bestAnalysis.recommendations.length > 0
          ? bestAnalysis.recommendations
          : buildPlanRecommendations({
              subject: assignment.subject,
              weakArea: resolvedWeakArea,
              gradePercent: gradePercent === null ? 55 : gradePercent,
            });

      let feedback =
        String(bestAnalysis?.teacherFeedback || "").trim() ||
        buildAiFeedback({
          gradePercent: gradePercent === null ? 55 : gradePercent,
          weakArea: resolvedWeakArea,
          recommendations,
          subject: assignment.subject,
          type: normalizedType,
          teacherNotes,
        });
      if (gradePercent === null) {
        feedback = `Answer script received and queued for marking. Preliminary focus: ${resolvedWeakArea}. ${feedback}`;
      }

      const status = gradePercent === null ? "In Progress" : "Completed";
      const predictedPercent =
        gradePercent === null ? null : clamp(gradePercent + 8, 0, 100);

      let savedAssessment = null;
      if (targetAssessment) {
        const { rows: updateRows } = await query(
          `UPDATE assessments
              SET title = $2,
                  subject = $3,
                  type = $4,
                  assessment_date = now(),
                  status = $5,
                  grade_percent = $6,
                  predicted_percent = $7,
                  weak_area = $8,
                  ai_feedback = $9,
                  score_obtained = $10,
                  score_total = $11
            WHERE id = $1
         RETURNING id,
                   title,
                   subject,
                   type,
                   assessment_date AS "assessmentDate",
                   status,
                   grade_percent AS "gradePercent",
                   predicted_percent AS "predictedPercent",
                   weak_area AS "weakArea",
                   ai_feedback AS "aiFeedback"`,
          [
            targetAssessment.id,
            normalizedTitle,
            assignment.subject || "Subject",
            normalizedType,
            status,
            gradePercent,
            predictedPercent,
            resolvedWeakArea,
            feedback,
            scoreObtained,
            scoreTotal,
          ],
        );
        savedAssessment = updateRows[0] || null;
      } else {
        const { rows: insertRows } = await query(
          `INSERT INTO assessments (
              user_id, student_id, teacher_id, subject_id,
              title, subject, type, assessment_date, status,
              grade_percent, predicted_percent, weak_area, ai_feedback,
              score_obtained, score_total
            )
           VALUES (
              $1, $1, $2, $3,
              $4, $5, $6, now(), $7,
              $8, $9, $10, $11,
              $12, $13
            )
           RETURNING id,
                     title,
                     subject,
                     type,
                     assessment_date AS "assessmentDate",
                     status,
                     grade_percent AS "gradePercent",
                     predicted_percent AS "predictedPercent",
                     weak_area AS "weakArea",
                     ai_feedback AS "aiFeedback"`,
          [
            student.id,
            req.user.id,
            assignment.subjectId || null,
            normalizedTitle,
            assignment.subject || "Subject",
            normalizedType,
            status,
            gradePercent,
            predictedPercent,
            resolvedWeakArea,
            feedback,
            scoreObtained,
            scoreTotal,
          ],
        );
        savedAssessment = insertRows[0] || null;
      }

      const resolvedAssessmentId =
        savedAssessment?.id || targetAssessment?.id || null;
      const plpVersion = await upsertAssessmentPlpVersion({
        studentId: student.id,
        teacherId: req.user.id,
        subjectId: assignment.subjectId || null,
        subject: assignment.subject || savedAssessment?.subject || "Subject",
        assessmentId: resolvedAssessmentId,
        assessmentTitle: savedAssessment?.title || normalizedTitle,
        assessmentType: savedAssessment?.type || normalizedType,
        assessmentDate: savedAssessment?.assessmentDate || new Date(),
        gradePercent:
          savedAssessment?.gradePercent === null ||
          savedAssessment?.gradePercent === undefined
            ? gradePercent
            : savedAssessment?.gradePercent,
        predictedPercent:
          savedAssessment?.predictedPercent === null ||
          savedAssessment?.predictedPercent === undefined
            ? predictedPercent
            : savedAssessment?.predictedPercent,
        scoreObtained,
        scoreTotal,
        weakArea: savedAssessment?.weakArea || resolvedWeakArea,
        recommendations,
        strengths: bestAnalysis?.strengths || [],
        misconceptions: bestAnalysis?.misconceptions || [],
        supportNeeds: bestAnalysis?.supportNeeds || [],
        learningProfile: bestAnalysis?.learningProfile || "",
        nextCheckpoint: bestAnalysis?.nextCheckpoint || "",
        teacherNotes,
        teacherName: "Teacher",
      });

      const studentName =
        [student.firstName, student.lastName].filter(Boolean).join(" ") ||
        student.email ||
        "Student";

      await createNotification(
        req.user.id,
        "Assessment answers submitted",
        `Answer upload for ${studentName} (${assignment.subject || "Subject"}) was processed.`,
      );

      await createNotification(
        student.id,
        "Assessment answers received",
        `Your ${normalizedType.toLowerCase()} answers were received and reviewed.`,
      );

      await logAudit(req, "assessment_answers_submitted", {
        assignmentId,
        studentId: student.id,
        assessmentId: resolvedAssessmentId,
        plpVersionCode: plpVersion.versionCode,
        fileCount: files.length,
        hasGrade: gradePercent !== null,
      });

      return res.status(201).json({
        assessment: {
          id: resolvedAssessmentId,
          title: savedAssessment?.title || normalizedTitle,
          subject: savedAssessment?.subject || assignment.subject || "Subject",
          type: savedAssessment?.type || normalizedType,
          date: formatShortDate(savedAssessment?.assessmentDate || new Date()),
          status: savedAssessment?.status || status,
          grade:
            savedAssessment?.gradePercent === null ||
            savedAssessment?.gradePercent === undefined
              ? null
              : formatPercent(savedAssessment?.gradePercent),
          predicted:
            savedAssessment?.predictedPercent === null ||
            savedAssessment?.predictedPercent === undefined
              ? null
              : formatPercent(savedAssessment?.predictedPercent),
          weakArea: savedAssessment?.weakArea || resolvedWeakArea,
          aiFeedback: savedAssessment?.aiFeedback || feedback,
          plpVersionCode: plpVersion.versionCode,
          student: {
            id: student.id,
            email: student.email,
            name: studentName,
            studentNumber: student.studentNumber || null,
            className: assignment.className || null,
            gradeLevel: assignment.gradeLevel || null,
          },
          filesUploaded: files.length,
        },
        analysis: {
          derivedWeakArea: resolvedWeakArea,
          recommendations,
          strengths: bestAnalysis?.strengths || [],
          misconceptions: bestAnalysis?.misconceptions || [],
          supportNeeds: bestAnalysis?.supportNeeds || [],
          learningProfile: bestAnalysis?.learningProfile || "",
          nextCheckpoint: bestAnalysis?.nextCheckpoint || "",
          plpVersionCode: plpVersion.versionCode,
          graded: gradePercent !== null,
          aiUsed: Boolean(bestAnalysis),
          analyzedFiles: analysisCandidates.length,
          selectedFile: bestAnalysisCandidate?.fileName || null,
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/assessments/scan",
  aiLimiter,
  uploadLimiter,
  avatarUpload.single("file"),
  async (req, res, next) => {
    try {
      const {
        assignmentId,
        studentId,
        title,
        type,
        scoreObtained,
        scoreTotal,
        gradePercent,
        weakArea,
        teacherNotes,
      } = req.body || {};

      if (!isUuid(assignmentId)) {
        return res.status(400).json({ error: "Invalid class assignment id." });
      }
      if (!isUuid(studentId)) {
        return res.status(400).json({ error: "Invalid student id." });
      }

      const { rows: assignmentRows } = await query(
        `SELECT id,
                class_id AS "classId",
                subject_id AS "subjectId",
                grade_level AS "gradeLevel",
                class_name AS "className",
                subject
           FROM teacher_assignments
          WHERE id = $1
            AND teacher_id = $2`,
        [assignmentId, req.user.id],
      );
      const assignment = assignmentRows[0];
      if (!assignment) {
        return res.status(404).json({ error: "Class assignment not found." });
      }

      const { rows: studentRows } = await query(
        `SELECT u.id,
                u.email,
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                p.student_id AS "studentNumber"
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
          WHERE u.id = $1
            AND u.role = 'student'
            AND (
              ($2::uuid IS NOT NULL AND p.class_id = $2)
              OR ($2::uuid IS NULL AND p.grade_level = $3 AND p.class_name = $4)
            )`,
        [studentId, assignment.classId, assignment.gradeLevel, assignment.className],
      );
      const student = studentRows[0];
      if (!student) {
        return res
          .status(403)
          .json({ error: "Student is not in the selected class assignment." });
      }

      const normalizedType = String(
        type || (req.file ? "AI Diagnostic" : "Assessment"),
      )
        .trim()
        .slice(0, 80);

      const safeScoreTotal = clamp(toNumberOrNull(scoreTotal) ?? 20, 1, 100);
      let normalizedPercent = toNumberOrNull(gradePercent);
      let normalizedObtained = toNumberOrNull(scoreObtained);

      let geminiAnalysis = null;
      if (req.file?.path) {
        geminiAnalysis = await analyzeAssessmentWithGemini({
          imagePath: req.file.path,
          mimeType: req.file.mimetype,
          subject: assignment.subject,
          assessmentType: normalizedType,
          className: assignment.className,
          gradeLevel: assignment.gradeLevel,
          teacherNotes,
          providedScoreObtained: normalizedObtained,
          providedScoreTotal: safeScoreTotal,
        });
      }

      if (normalizedPercent === null && normalizedObtained === null) {
        if (
          geminiAnalysis?.gradePercent !== null &&
          geminiAnalysis?.gradePercent !== undefined
        ) {
          normalizedPercent = Number(geminiAnalysis.gradePercent);
        }
        if (
          normalizedObtained === null &&
          geminiAnalysis?.scoreObtained !== null &&
          geminiAnalysis?.scoreObtained !== undefined
        ) {
          normalizedObtained = Number(geminiAnalysis.scoreObtained);
        }
      }

      if (normalizedPercent === null && normalizedObtained === null) {
        return res.status(400).json({
          error:
            "Provide score obtained or grade percent. You can also upload a clear scan for AI-assisted analysis.",
        });
      }

      if (normalizedPercent === null && normalizedObtained !== null) {
        normalizedPercent = markToPercent(normalizedObtained, safeScoreTotal);
      }
      if (normalizedObtained === null && normalizedPercent !== null) {
        normalizedObtained = Math.round(
          (clamp(normalizedPercent, 0, 100) / 100) * safeScoreTotal,
        );
      }

      normalizedPercent = clamp(Math.round(normalizedPercent || 0), 0, 100);
      normalizedObtained = clamp(
        Math.round(normalizedObtained || 0),
        0,
        safeScoreTotal,
      );

      const resolvedWeakArea =
        String(weakArea || "").trim() ||
        String(geminiAnalysis?.weakArea || "").trim() ||
        inferWeakArea({
          subject: assignment.subject,
          type: normalizedType,
          gradePercent: normalizedPercent,
        });

      const recommendations =
        Array.isArray(geminiAnalysis?.recommendations) &&
        geminiAnalysis.recommendations.length > 0
          ? geminiAnalysis.recommendations
          : buildPlanRecommendations({
              subject: assignment.subject,
              weakArea: resolvedWeakArea,
              gradePercent: normalizedPercent,
            });

      let feedback =
        String(geminiAnalysis?.teacherFeedback || "").trim() ||
        buildAiFeedback({
          gradePercent: normalizedPercent,
          weakArea: resolvedWeakArea,
          recommendations,
          subject: assignment.subject,
          type: normalizedType,
          teacherNotes,
        });

      if (
        Array.isArray(geminiAnalysis?.strengths) &&
        geminiAnalysis.strengths.length
      ) {
        feedback =
          feedback +
          " Strengths observed: " +
          geminiAnalysis.strengths.join("; ") +
          ".";
      }

      const predictedPercent = clamp(normalizedPercent + 8, 0, 100);
      const safeTitle =
        String(
          title || `${assignment.subject || "Subject"} ${normalizedType}`,
        ).trim() || "Assessment";
      const assessmentTitle = safeTitle.slice(0, 160);

      const { rows: insertedRows } = await query(
        `INSERT INTO assessments (
            user_id, student_id, teacher_id, subject_id,
            title, subject, type, assessment_date, status,
            grade_percent, predicted_percent, weak_area, ai_feedback,
            score_obtained, score_total
          )
         VALUES (
            $1, $1, $2, $3,
            $4, $5, $6, now(), 'Completed',
            $7, $8, $9, $10,
            $11, $12
          )
         RETURNING id,
                   title,
                   subject,
                   type,
                   assessment_date AS "assessmentDate",
                   status,
                   grade_percent AS "gradePercent",
                   predicted_percent AS "predictedPercent",
                   weak_area AS "weakArea",
                   ai_feedback AS "aiFeedback"`,
        [
          student.id,
          req.user.id,
          assignment.subjectId || null,
          assessmentTitle,
          assignment.subject,
          normalizedType,
          normalizedPercent,
          predictedPercent,
          resolvedWeakArea,
          feedback,
          normalizedObtained,
          safeScoreTotal,
        ],
      );

      const inserted = insertedRows[0];
      const plpVersion = await upsertAssessmentPlpVersion({
        studentId: student.id,
        teacherId: req.user.id,
        subjectId: assignment.subjectId || null,
        subject: assignment.subject || inserted?.subject || "Subject",
        assessmentId: inserted?.id || null,
        assessmentTitle: inserted?.title || assessmentTitle,
        assessmentType: inserted?.type || normalizedType,
        assessmentDate: inserted?.assessmentDate || new Date(),
        gradePercent: inserted?.gradePercent ?? normalizedPercent,
        predictedPercent: inserted?.predictedPercent ?? predictedPercent,
        scoreObtained: normalizedObtained,
        scoreTotal: safeScoreTotal,
        weakArea: inserted?.weakArea || resolvedWeakArea,
        recommendations,
        strengths: geminiAnalysis?.strengths || [],
        misconceptions: geminiAnalysis?.misconceptions || [],
        supportNeeds: geminiAnalysis?.supportNeeds || [],
        learningProfile: geminiAnalysis?.learningProfile || "",
        nextCheckpoint: geminiAnalysis?.nextCheckpoint || "",
        teacherNotes,
        teacherName: "Teacher",
      });

      const studentName =
        [student.firstName, student.lastName].filter(Boolean).join(" ") ||
        student.email ||
        "Student";

      await createNotification(
        student.id,
        "New assessed result",
        `Your ${normalizedType.toLowerCase()} in ${
          assignment.subject || "this subject"
        } has been analyzed. Review your personalized learning plan.`,
      );

      await createNotification(
        req.user.id,
        "Assessment analyzed",
        `Assessment scan for ${studentName} (${normalizedType} - ${
          assignment.subject || "Subject"
        }) was completed successfully.`,
      );

      await logAudit(req, "assessment_scan_analyzed", {
        assignmentId,
        studentId: student.id,
        assessmentId: insertedRows[0]?.id,
        plpVersionCode: plpVersion.versionCode,
        scanUploaded: Boolean(req.file),
        fileName: req.file?.filename || null,
      });

      return res.status(201).json({
        assessment: {
          id: inserted.id,
          title: inserted.title,
          subject: inserted.subject,
          type: inserted.type,
          date: formatShortDate(inserted.assessmentDate),
          status: inserted.status,
          grade: formatPercent(inserted.gradePercent),
          predicted: formatPercent(inserted.predictedPercent),
          weakArea: inserted.weakArea,
          aiFeedback: inserted.aiFeedback,
          plpVersionCode: plpVersion.versionCode,
          student: {
            id: student.id,
            email: student.email,
            name: studentName,
            studentNumber: student.studentNumber || null,
            className: assignment.className || null,
            gradeLevel: assignment.gradeLevel || null,
          },
          scanPath: req.file ? `/uploads/${req.file.filename}` : null,
        },
        analysis: {
          supportStatus: plpVersion.status,
          weakArea: resolvedWeakArea,
          recommendations,
          strengths: geminiAnalysis?.strengths || [],
          misconceptions: geminiAnalysis?.misconceptions || [],
          supportNeeds: geminiAnalysis?.supportNeeds || [],
          learningProfile: geminiAnalysis?.learningProfile || "",
          nextCheckpoint: geminiAnalysis?.nextCheckpoint || "",
          plpVersionCode: plpVersion.versionCode,
          ai: {
            enabled: isGeminiEnabled(),
            used: Boolean(geminiAnalysis),
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get("/plp", async (req, res, next) => {
  try {
    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.json({ plans: [] });
    }
    const { rows } = await query(
      `SELECT p.id,
              p.subject_code AS "subjectCode",
              p.name,
              p.category,
              p.status,
              p.progress,
              p.last_assessment AS "lastAssessment",
              p.teacher_name AS "teacherName",
              p.feedback,
              u.id AS "studentId",
              u.email AS "studentEmail",
              prof.first_name AS "firstName",
              prof.last_name AS "lastName",
              COALESCE(
                NULLIF(to_jsonb(prof)->>'student_id', ''),
                NULLIF(to_jsonb(prof)->>'student_number', ''),
                NULLIF(to_jsonb(prof)->>'studentNumber', ''),
                NULLIF(to_jsonb(prof)->>'reg_number', ''),
                NULLIF(to_jsonb(prof)->>'registration_number', '')
              ) AS "studentNumber",
              prof.class_name AS "className",
              prof.grade_level AS "gradeLevel"
         FROM plp_subjects p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN user_profiles prof ON prof.user_id = u.id
        WHERE u.id = ANY($1::uuid[])
        ORDER BY p.last_assessment DESC NULLS LAST, p.created_at DESC`,
      [studentIds],
    );

    return res.json({
      plans: rows.map((row) => ({
        id: row.id,
        subjectCode: row.subjectCode,
        name: row.name,
        category: row.category,
        status: row.status,
        progress: row.progress,
        lastAssessment: formatShortDate(row.lastAssessment),
        teacherName: row.teacherName,
        feedback: row.feedback,
        student: {
          id: row.studentId,
          email: row.studentEmail,
          studentNumber: row.studentNumber || null,
          className: row.className || null,
          gradeLevel: row.gradeLevel || null,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.studentEmail ||
            "Student",
        },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plp/class", async (req, res, next) => {
  try {
    const assignmentId = String(req.query?.assignmentId || "").trim();
    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class assignment id." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: studentRows } = await query(
      `SELECT u.id,
              u.email,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              COALESCE(
                NULLIF(to_jsonb(p)->>'student_id', ''),
                NULLIF(to_jsonb(p)->>'student_number', ''),
                NULLIF(to_jsonb(p)->>'studentNumber', ''),
                NULLIF(to_jsonb(p)->>'reg_number', ''),
                NULLIF(to_jsonb(p)->>'registration_number', '')
              ) AS "studentNumber",
              p.class_name AS "className",
              p.grade_level AS "gradeLevel",
              ROW_NUMBER() OVER (
                ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email
              )::int AS "studentNo"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND (
            ($1::uuid IS NOT NULL AND p.class_id = $1)
            OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
          )
        ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
      [assignment.classId, assignment.gradeLevel, assignment.className],
    );

    const classInfo = {
      id: assignment.id,
      courseName: assignment.subject || "Course",
      classGroup: assignment.className || "--",
      level: assignment.gradeLevel || "--",
      totalStudents: studentRows.length,
    };

    if (!studentRows.length) {
      return res.json({
        classInfo,
        stats: {
          students: 0,
          withPlans: 0,
          withoutPlans: 0,
          avgProgress: 0,
          avgGrade: null,
        },
        students: [],
        plans: [],
      });
    }

    const studentIds = studentRows.map((row) => row.id);

    const [plansResult, weakAreasResult, avgGradesResult] = await Promise.all([
      query(
        `SELECT p.id,
                p.user_id AS "studentId",
                p.subject_code AS "subjectCode",
                p.name,
                p.category,
                p.status,
                p.progress,
                p.last_assessment AS "lastAssessment",
                p.teacher_name AS "teacherName",
                p.feedback
           FROM plp_subjects p
          WHERE p.user_id = ANY($1::uuid[])
            AND (
              $2::text IS NULL
              OR lower(trim(COALESCE(p.name, ''))) = lower(trim($2))
            )
          ORDER BY p.last_assessment DESC NULLS LAST, p.created_at DESC`,
        [studentIds, assignment.subject || null],
      ),
      query(
        `SELECT DISTINCT ON (a.user_id)
                a.user_id AS "studentId",
                a.subject,
                a.weak_area AS "weakArea",
                a.assessment_date AS "assessmentDate"
           FROM assessments a
          WHERE a.user_id = ANY($1::uuid[])
            AND a.weak_area IS NOT NULL
            AND (
              $2::text IS NULL
              OR lower(trim(COALESCE(a.subject, ''))) = lower(trim($2))
            )
          ORDER BY a.user_id, a.assessment_date DESC NULLS LAST, a.created_at DESC`,
        [studentIds, assignment.subject || null],
      ),
      query(
        `SELECT a.user_id AS "studentId",
                AVG(a.grade_percent)::int AS "avgGrade"
           FROM assessments a
          WHERE a.user_id = ANY($1::uuid[])
            AND a.grade_percent IS NOT NULL
            AND (
              $2::text IS NULL
              OR lower(trim(COALESCE(a.subject, ''))) = lower(trim($2))
            )
          GROUP BY a.user_id`,
        [studentIds, assignment.subject || null],
      ),
    ]);

    const weakAreaByStudent = new Map(
      weakAreasResult.rows.map((row) => [
        row.studentId,
        {
          weakArea: row.weakArea || null,
          subject: row.subject || assignment.subject || null,
          lastSeen: formatShortDate(row.assessmentDate),
        },
      ]),
    );

    const avgGradeByStudent = new Map(
      avgGradesResult.rows.map((row) => [row.studentId, row.avgGrade]),
    );

    const plansByStudent = new Map();
    plansResult.rows.forEach((row) => {
      const current = plansByStudent.get(row.studentId) || [];
      current.push({
        id: row.id,
        subjectCode: row.subjectCode,
        name: row.name,
        category: row.category,
        status: row.status,
        progress: row.progress,
        lastAssessment: formatShortDate(row.lastAssessment),
        teacherName: row.teacherName,
        feedback: row.feedback,
      });
      plansByStudent.set(row.studentId, current);
    });

    const students = studentRows.map((student) => {
      const studentPlans = plansByStudent.get(student.id) || [];
      const totalPlans = studentPlans.length;
      const activePlans = studentPlans.filter((plan) =>
        String(plan.status || "").toLowerCase().includes("active"),
      ).length;
      const avgProgress = totalPlans
        ? Math.round(
            studentPlans.reduce(
              (sum, plan) => sum + (Number(plan.progress) || 0),
              0,
            ) / totalPlans,
          )
        : 0;
      const weakInfo = weakAreaByStudent.get(student.id) || null;
      const gradeValue = avgGradeByStudent.get(student.id);
      return {
        id: student.id,
        email: student.email,
        name:
          [student.firstName, student.lastName].filter(Boolean).join(" ") ||
          student.email ||
          "Student",
        studentNumber: student.studentNumber || null,
        studentNo: student.studentNo || null,
        className: student.className || null,
        gradeLevel: student.gradeLevel || null,
        hasPlan: totalPlans > 0,
        totalPlans,
        activePlans,
        avgProgress,
        avgGrade:
          gradeValue === null || gradeValue === undefined
            ? null
            : formatPercent(gradeValue),
        weakArea: weakInfo?.weakArea || null,
        weakAreaSubject: weakInfo?.subject || null,
        weakAreaLastSeen: weakInfo?.lastSeen || null,
      };
    });

    const withPlans = students.filter((student) => student.hasPlan).length;
    const avgProgress =
      withPlans > 0
        ? Math.round(
            students
              .filter((student) => student.hasPlan)
              .reduce((sum, student) => sum + (Number(student.avgProgress) || 0), 0) /
              withPlans,
          )
        : 0;
    const avgGradeValues = students
      .map((student) => {
        const cleaned = String(student.avgGrade || "")
          .replace(/[^0-9.-]/g, "")
          .trim();
        const numeric = Number(cleaned);
        return Number.isFinite(numeric) ? numeric : null;
      })
      .filter((value) => value !== null);
    const classAvgGrade =
      avgGradeValues.length > 0
        ? formatPercent(
            Math.round(
              avgGradeValues.reduce((sum, value) => sum + value, 0) /
                avgGradeValues.length,
            ),
          )
        : null;

    const studentNameById = new Map(students.map((student) => [student.id, student]));
    const plans = plansResult.rows.map((row) => ({
      id: row.id,
      subjectCode: row.subjectCode,
      name: row.name,
      category: row.category,
      status: row.status,
      progress: row.progress,
      lastAssessment: formatShortDate(row.lastAssessment),
      teacherName: row.teacherName,
      feedback: row.feedback,
      student: {
        id: row.studentId,
        email: studentNameById.get(row.studentId)?.email || null,
        studentNumber: studentNameById.get(row.studentId)?.studentNumber || null,
        className: studentNameById.get(row.studentId)?.className || null,
        gradeLevel: studentNameById.get(row.studentId)?.gradeLevel || null,
        name: studentNameById.get(row.studentId)?.name || "Student",
      },
    }));

    return res.json({
      classInfo,
      stats: {
        students: students.length,
        withPlans,
        withoutPlans: Math.max(students.length - withPlans, 0),
        avgProgress,
        avgGrade: classAvgGrade,
      },
      students,
      plans,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/plp/:id/export", async (req, res, next) => {
  try {
    const planId = String(req.params.id || "").trim();
    if (!isUuid(planId)) {
      return res.status(400).json({ error: "Invalid PLP id." });
    }

    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.status(403).json({ error: "No assigned students." });
    }

    const { rows: planRows } = await query(
      `SELECT p.id,
              p.subject_code AS "subjectCode",
              p.name,
              p.category,
              p.status,
              p.progress,
              p.last_assessment AS "lastAssessment",
              p.teacher_name AS "teacherName",
              p.feedback,
              u.id AS "studentId",
              u.email AS "studentEmail",
              prof.first_name AS "firstName",
              prof.last_name AS "lastName",
              COALESCE(
                NULLIF(to_jsonb(prof)->>'student_id', ''),
                NULLIF(to_jsonb(prof)->>'student_number', ''),
                NULLIF(to_jsonb(prof)->>'studentNumber', ''),
                NULLIF(to_jsonb(prof)->>'reg_number', ''),
                NULLIF(to_jsonb(prof)->>'registration_number', '')
              ) AS "studentNumber",
              prof.class_name AS "className",
              prof.grade_level AS "gradeLevel"
         FROM plp_subjects p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN user_profiles prof ON prof.user_id = u.id
        WHERE p.id = $1
          AND p.user_id = ANY($2::uuid[])
        LIMIT 1`,
      [planId, studentIds],
    );

    const plan = planRows[0];
    if (!plan) {
      return res.status(404).json({ error: "PLP version not found." });
    }

    const [weakAreasResult, actionsResult, tipsResult] = await Promise.all([
      query(
        `SELECT topic,
                level,
                description AS "desc"
           FROM plp_weak_areas
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [planId],
      ),
      query(
        `SELECT action_text AS "action"
           FROM plp_actions
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [planId],
      ),
      query(
        `SELECT tip_text AS "tip"
           FROM plp_tips
          WHERE plp_subject_id = $1
          ORDER BY created_at`,
        [planId],
      ),
    ]);

    const studentName =
      [plan.firstName, plan.lastName].filter(Boolean).join(" ") ||
      plan.studentEmail ||
      "Student";
    const aiInsightLines = extractAiInsightLines(plan.feedback, 10);

    const weakAreas = (weakAreasResult.rows || []).map((row) => ({
      topic: row.topic,
      level: row.level,
      desc: row.desc,
    }));
    if (!weakAreas.length && aiInsightLines.length) {
      const weakLine = aiInsightLines.find((line) =>
        /primary weak area/i.test(line),
      );
      if (weakLine) {
        weakAreas.push({
          topic: weakLine.replace(/^.*?primary weak area:\s*/i, "").trim(),
          level: plan.progress >= 80 ? "Low" : plan.progress >= 60 ? "Medium" : "High",
          desc: "Derived from AI analysis summary.",
        });
      }
    }

    const actions = uniqueItems(
      (actionsResult.rows || []).map((row) => row.action),
      8,
      320,
    );
    const fallbackActions = uniqueItems(
      aiInsightLines.filter((line) => /recommended actions|support priorities|checkpoint/i.test(line)),
      6,
      320,
    );
    const resolvedActions = actions.length ? actions : fallbackActions;

    const tips = uniqueItems(
      (tipsResult.rows || []).map((row) => row.tip),
      8,
      320,
    );
    const fallbackTips = uniqueItems(
      aiInsightLines.filter((line) => /strength|learner profile|mastery signal|misconception/i.test(line)),
      6,
      320,
    );
    const resolvedTips = tips.length ? tips : fallbackTips;

    const safeName = sanitizeFilename(
      `${plan.name || "plp"}_${plan.subjectCode || "version"}_learning_plan`,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentWidth = right - left;
    const schoolName = process.env.SCHOOL_NAME || "ClassIQ";

    const sectionTitle = (title) => {
      doc.moveDown(0.5);
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#102A63")
        .text(String(title || "").toUpperCase(), { width: contentWidth });
      doc.moveDown(0.2);
    };

    const bodyLine = (text, { bold = false, indent = 0 } = {}) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10.5)
        .fillColor("#1f2937")
        .text(String(text || "--"), {
          width: contentWidth - indent,
          indent,
          lineGap: 2,
        });
    };

    const ensureSpace = (heightNeeded = 80) => {
      if (doc.y + heightNeeded > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#102A63")
      .text(schoolName, left, doc.y, { width: contentWidth });
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0f172a")
      .text("Personalized Learning Plan - Version Report", {
        width: contentWidth,
      });
    doc.moveDown(0.2);
    doc
      .strokeColor("#102A63")
      .lineWidth(1.2)
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .stroke();
    doc.moveDown(0.8);

    const metaRows = [
      `Student: ${studentName}`,
      `Student ID: ${plan.studentNumber || "--"}`,
      `Class: ${plan.className || "--"} - ${plan.gradeLevel || "--"}`,
      `Subject: ${plan.name || "Subject"}`,
      `Version Code: ${plan.subjectCode || "--"}`,
      `Category: ${plan.category || "Assessment"}`,
      `Status: ${plan.status || "--"} | Progress: ${plan.progress ?? 0}%`,
      `Last Assessment: ${formatShortDate(plan.lastAssessment) || "--"}`,
      `Teacher: ${plan.teacherName || "Teacher"}`,
    ];
    metaRows.forEach((line) => bodyLine(line, { bold: true }));

    sectionTitle("AI Summary");
    bodyLine(
      plan.feedback
        ? plan.feedback
        : "No AI summary has been generated for this version yet.",
    );

    sectionTitle("Special AI Details");
    if (!aiInsightLines.length) {
      bodyLine("No special AI details were extracted.");
    } else {
      aiInsightLines.forEach((line, index) => {
        ensureSpace(28);
        bodyLine(`${index + 1}. ${line}`);
      });
    }

    sectionTitle("Weakness Focus");
    if (!weakAreas.length) {
      bodyLine("No weak area recorded.");
    } else {
      weakAreas.forEach((item, index) => {
        ensureSpace(36);
        bodyLine(
          `${index + 1}. ${item.topic || "Topic"} (${item.level || "Needs attention"})`,
          { bold: true },
        );
        if (item.desc) bodyLine(item.desc, { indent: 12 });
      });
    }

    sectionTitle("Action Steps");
    if (!resolvedActions.length) {
      bodyLine("No action steps available.");
    } else {
      resolvedActions.forEach((item, index) => {
        ensureSpace(28);
        bodyLine(`${index + 1}. ${item}`);
      });
    }

    sectionTitle("Teacher Tips");
    if (!resolvedTips.length) {
      bodyLine("No tips available.");
    } else {
      resolvedTips.forEach((item, index) => {
        ensureSpace(28);
        bodyLine(`${index + 1}. ${item}`);
      });
    }

    doc.moveDown(1.2);
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("#475569")
      .text("Generated by ClassIQ AI learning plan workflow.", {
        width: contentWidth,
        align: "right",
      });

    doc.end();
  } catch (error) {
    return next(error);
  }
});

router.get("/weak-areas", async (req, res, next) => {
  try {
    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.json({ weakAreas: [] });
    }
    const { rows } = await query(
      `SELECT u.id AS "studentId",
              u.email AS "studentEmail",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              a.subject,
              a.weak_area AS "weakArea",
              COUNT(*)::int AS occurrences,
              MAX(a.assessment_date) AS "lastSeen"
         FROM assessments a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ANY($1::uuid[])
          AND a.weak_area IS NOT NULL
        GROUP BY u.id, u.email, p.first_name, p.last_name, a.subject, a.weak_area
        ORDER BY occurrences DESC, lastSeen DESC`,
      [studentIds],
    );

    return res.json({
      weakAreas: rows.map((row) => ({
        student: {
          id: row.studentId,
          email: row.studentEmail,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.studentEmail ||
            "Student",
        },
        subject: row.subject,
        weakArea: row.weakArea,
        occurrences: row.occurrences || 0,
        lastSeen: formatShortDate(row.lastSeen),
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/resources", async (req, res, next) => {
  try {
    const { assignments, studentIds } = await getAssignedStudentIds(req.user.id);
    const gradeLevels = Array.from(
      new Set(assignments.map((assignment) => assignment.gradeLevel).filter(Boolean)),
    );
    const filterLevels = gradeLevels.length > 0;
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
        WHERE ($1::boolean = false OR levels && $2::text[])
        ORDER BY resource_date DESC NULLS LAST`,
      [filterLevels, gradeLevels],
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

router.get("/analytics", async (req, res, next) => {
  try {
    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.json({
        totals: { students: 0, assessments: 0, completionRate: "0%", avgGrade: null },
        subjects: [],
        trend: [],
      });
    }
    const { rows: totalsRows } = await query(
      `SELECT
         $1::int AS students,
         (SELECT COUNT(*)::int FROM assessments WHERE user_id = ANY($2::uuid[])) AS assessments,
         (SELECT COUNT(*)::int FROM assessments WHERE user_id = ANY($2::uuid[]) AND status = 'Completed') AS completed,
         (SELECT AVG(grade_percent)::int FROM assessments WHERE user_id = ANY($2::uuid[]) AND grade_percent IS NOT NULL) AS avg_grade`,
      [studentIds.length, studentIds],
    );

    const { rows: subjectRows } = await query(
      `SELECT subject, COUNT(*)::int AS count
         FROM assessments a
        WHERE a.user_id = ANY($1::uuid[])
        GROUP BY subject
        ORDER BY count DESC
        LIMIT 6`,
      [studentIds],
    );

    const { rows: trendRows } = await query(
      `SELECT t.name,
              t.starts_on AS "startsOn",
              AVG(a.grade_percent)::int AS "avgScore"
         FROM assessments a
         JOIN terms t ON t.id = a.term_id
        WHERE a.user_id = ANY($1::uuid[])
          AND a.grade_percent IS NOT NULL
        GROUP BY t.id, t.name, t.starts_on
        ORDER BY t.starts_on`,
      [studentIds],
    );

    const totals = totalsRows[0] || {
      students: 0,
      assessments: 0,
      completed: 0,
      avg_grade: null,
    };
    const completionRate = totals.assessments
      ? Math.round((totals.completed / totals.assessments) * 100)
      : 0;

    return res.json({
      totals: {
        students: totals.students || 0,
        assessments: totals.assessments || 0,
        completionRate: `${completionRate}%`,
        avgGrade:
          totals.avg_grade === null || totals.avg_grade === undefined
            ? null
            : formatPercent(totals.avg_grade),
      },
      subjects: subjectRows.map((row) => ({
        subject: row.subject,
        count: row.count,
      })),
      trend: trendRows.map((row, index) => ({
        term_id: parseTermNumber(row.name) || index + 1,
        val: row.avgScore,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/outline", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT day_of_week AS "day",
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
      outline: rows.map((row) => ({
        day: DAY_LABELS[row.day] || `Day ${row.day}`,
        time: formatTimeRange(row.startTime, row.endTime),
        title: row.title,
        room: row.room,
        instructor: row.instructor,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/planning/today", async (req, res, next) => {
  try {
    const now = new Date();
    const todayIso = formatIsoDate(now);
    const todayIndex = (now.getDay() + 6) % 7;

    const [scheduleResult, tasksResult] = await Promise.all([
      query(
        `SELECT day_of_week AS "day",
                start_time AS "startTime",
                end_time AS "endTime",
                title,
                room,
                instructor
           FROM schedule_classes
          WHERE user_id = $1
          ORDER BY day_of_week, start_time`,
        [req.user.id],
      ),
      query(
        `SELECT id,
                title,
                due_date AS "due",
                completed,
                priority
           FROM tasks
          WHERE user_id = $1
            AND (due_date IS NULL OR due_date <= $2::date)
          ORDER BY completed ASC, due_date NULLS LAST, created_at`,
        [req.user.id, todayIso],
      ),
    ]);

    const allSessions = scheduleResult.rows.map((row) => ({
      dayIndex: row.day,
      day: DAY_LABELS[row.day] || `Day ${row.day}`,
      time: formatTimeRange(row.startTime, row.endTime),
      title: row.title,
      room: row.room,
      instructor: row.instructor,
    }));

    const buildTeachingGuide = (session) => {
      const [topicPart, classPart] = String(session.title || "").split("-").map((v) =>
        v.trim(),
      );
      const topic = topicPart || "today's topic";
      const classLabel = classPart || "this class";
      const classroomExample = `Use one worked example in ${topic} that mirrors Rwanda basic education textbook structure for ${classLabel}.`;
      const diagnosticCheck = `Give a 3-question exit check focused on ${topic} and review the results before next lesson.`;
      const steps = [
        `Start with a 5-minute recap of the previous lesson connected to ${topic}.`,
        `Teach the core concept in small chunks and model the method step-by-step.`,
        classroomExample,
        "Run guided practice, then shift to independent practice with quick support rounds.",
        diagnosticCheck,
      ];
      return { topic, classLabel, classroomExample, diagnosticCheck, steps };
    };

    const todaySessions = allSessions
      .filter((session) => session.dayIndex === todayIndex)
      .map((session, idx) => ({
        id: `${todayIso}-${idx + 1}`,
        ...session,
        guide: buildTeachingGuide(session),
      }));

    return res.json({
      date: todayIso,
      dayLabel: DAY_LABELS[todayIndex],
      todaySessions,
      allSessions: allSessions.map((session) => ({
        day: session.day,
        time: session.time,
        title: session.title,
        room: session.room,
        instructor: session.instructor,
      })),
      backlog: tasksResult.rows.map((task) => ({
        id: task.id,
        title: task.title,
        due: formatIsoDate(task.due),
        completed: task.completed,
        priority: task.priority,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/reports", async (req, res, next) => {
  try {
    const { assignments, studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.json({ reports: [] });
    }
    const { rows } = await query(
      `SELECT p.grade_level AS "gradeLevel",
              p.class_name AS "className",
              COUNT(*)::int AS students,
              AVG(a.grade_percent)::int AS "avgGrade",
              COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS "completedAssessments",
              COUNT(a.*)::int AS "totalAssessments"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
         LEFT JOIN assessments a ON a.user_id = u.id
        WHERE u.id = ANY($1::uuid[])
        GROUP BY p.grade_level, p.class_name
        ORDER BY p.grade_level NULLS LAST, p.class_name NULLS LAST`,
      [studentIds],
    );

    return res.json({
      reports: rows.map((row) => {
        const completionRate = row.totalAssessments
          ? Math.round((row.completedAssessments / row.totalAssessments) * 100)
          : 0;
        return {
          gradeLevel: row.gradeLevel,
          className: row.className,
          students: row.students || 0,
          avgGrade:
            row.avgGrade === null || row.avgGrade === undefined
              ? null
              : formatPercent(row.avgGrade),
          completionRate: `${completionRate}%`,
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/reports/:assignmentId", async (req, res, next) => {
  try {
    const assignmentId = req.params.assignmentId;
    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class assignment id." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: classStudentRows } = await query(
      `SELECT u.id,
              u.email,
              p.student_id AS "studentNumber",
              p.first_name AS "firstName",
              p.last_name AS "lastName"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.role = 'student'
          AND (
            ($1::uuid IS NOT NULL AND p.class_id = $1)
            OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
          )
        ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
      [assignment.classId, assignment.gradeLevel, assignment.className],
    );
    const studentIds = classStudentRows.map((row) => row.id);

    if (!studentIds.length) {
      return res.json({
        classInfo: {
          assignmentId: assignment.id,
          courseName: assignment.subject || "Course",
          classGroup: assignment.className || "--",
          level: assignment.gradeLevel || "--",
          students: 0,
        },
        summary: {
          avgGrade: null,
          completionRate: "0%",
          highRiskCount: 0,
          mediumRiskCount: 0,
          lowRiskCount: 0,
          generatedOn: formatShortDate(new Date()),
        },
        weakAreas: [],
        students: [],
        recommendations: [],
      });
    }

    const [studentStatsResult, weakAreaResult] = await Promise.all([
      query(
        `SELECT u.id,
                u.email,
                p.student_id AS "studentNumber",
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                stats.total_assessments AS "totalAssessments",
                stats.completed_assessments AS "completedAssessments",
                stats.avg_grade AS "avgGrade",
                stats.last_assessment_date AS "lastAssessmentDate",
                stats.last_weak_area AS "weakArea"
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS total_assessments,
                    COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed_assessments,
                    AVG(grade_percent)::int AS avg_grade,
                    MAX(assessment_date) AS last_assessment_date,
                    (
                      SELECT a2.weak_area
                        FROM assessments a2
                       WHERE a2.user_id = u.id
                         AND a2.weak_area IS NOT NULL
                         AND ($2::text IS NULL OR a2.subject = $2)
                       ORDER BY a2.assessment_date DESC NULLS LAST, a2.created_at DESC
                       LIMIT 1
                    ) AS last_weak_area
               FROM assessments a
              WHERE a.user_id = u.id
                AND ($2::text IS NULL OR a.subject = $2)
           ) stats ON true
          WHERE u.id = ANY($1::uuid[])
          ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
        [studentIds, assignment.subject || null],
      ),
      query(
        `SELECT weak_area AS "weakArea", COUNT(*)::int AS count
           FROM assessments
          WHERE user_id = ANY($1::uuid[])
            AND weak_area IS NOT NULL
            AND ($2::text IS NULL OR subject = $2)
          GROUP BY weak_area
          ORDER BY count DESC, weak_area
          LIMIT 10`,
        [studentIds, assignment.subject || null],
      ),
    ]);

    const studentRows = studentStatsResult.rows.map((row) => {
      const completionRate = row.totalAssessments
        ? Math.round((row.completedAssessments / row.totalAssessments) * 100)
        : 0;
      const riskBand = riskBandFromMetrics(row.avgGrade, completionRate);
      const weakArea = row.weakArea || null;
      const behaviorSignal =
        completionRate < 50
          ? "Follow up on attendance and assignment habits."
          : "Learning behavior is stable.";
      return {
        id: row.id,
        name:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email ||
          "Student",
        studentNumber: row.studentNumber || null,
        avgGrade:
          row.avgGrade === null || row.avgGrade === undefined
            ? null
            : formatPercent(row.avgGrade),
        completionRate: `${completionRate}%`,
        completionValue: completionRate,
        riskBand,
        weakArea,
        possibleReason: possibleReasonFromMetrics(
          riskBand,
          weakArea,
          completionRate,
        ),
        nextAction: nextActionFromMetrics(riskBand, weakArea),
        behaviorSignal,
        lastAssessmentDate: formatShortDate(row.lastAssessmentDate),
      };
    });

    const avgGradeValues = studentStatsResult.rows
      .map((row) => row.avgGrade)
      .filter((value) => value !== null && value !== undefined);
    const avgGrade = avgGradeValues.length
      ? Math.round(
          avgGradeValues.reduce((sum, value) => sum + Number(value), 0) /
            avgGradeValues.length,
        )
      : null;
    const completionValues = studentRows.map((row) => row.completionValue);
    const avgCompletion = completionValues.length
      ? Math.round(
          completionValues.reduce((sum, value) => sum + value, 0) /
            completionValues.length,
        )
      : 0;
    const highRiskCount = studentRows.filter((row) => row.riskBand === "high").length;
    const mediumRiskCount = studentRows.filter(
      (row) => row.riskBand === "medium",
    ).length;
    const lowRiskCount = studentRows.filter((row) => row.riskBand === "low").length;

    const topWeakArea = weakAreaResult.rows[0]?.weakArea || "foundational skills";
    const recommendations = [
      `Prioritize targeted support on ${topWeakArea} for the next two weeks.`,
      "Use weekly diagnostic checks and adjust grouping based on new results.",
      "Review incomplete work daily to improve consistency and behavior.",
      "Share progress snapshots with class teachers for coordinated follow-up.",
    ];

    return res.json({
      classInfo: {
        assignmentId: assignment.id,
        courseName: assignment.subject || "Course",
        classGroup: assignment.className || "--",
        level: assignment.gradeLevel || "--",
        students: studentIds.length,
      },
      summary: {
        avgGrade: avgGrade === null ? null : formatPercent(avgGrade),
        completionRate: `${avgCompletion}%`,
        highRiskCount,
        mediumRiskCount,
        lowRiskCount,
        generatedOn: formatShortDate(new Date()),
      },
      weakAreas: weakAreaResult.rows.map((row) => ({
        weakArea: row.weakArea,
        count: row.count,
      })),
      students: studentRows,
      recommendations,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/exercises/upload-class",
  aiLimiter,
  uploadLimiter,
  classroomFileUpload.single("file"),
  async (req, res, next) => {
    try {
      const supportsExerciseMeta = await ensureExerciseAssignmentMeta();
      const {
        assignmentId,
        studentId,
        title,
        difficulty,
        questionCount,
        sourceText,
      } =
        req.body || {};

      if (!isUuid(assignmentId)) {
        return res.status(400).json({ error: "Invalid class assignment id." });
      }
      if (studentId && !isUuid(studentId)) {
        return res.status(400).json({ error: "Invalid student id." });
      }

      const { rows: assignmentRows } = await query(
        `SELECT id,
                class_id AS "classId",
                subject_id AS "subjectId",
                grade_level AS "gradeLevel",
                class_name AS "className",
                subject
           FROM teacher_assignments
          WHERE id = $1
            AND teacher_id = $2`,
        [assignmentId, req.user.id],
      );
      const assignment = assignmentRows[0];
      if (!assignment) {
        return res.status(404).json({ error: "Class assignment not found." });
      }

      const { rows: classStudentRows } = await query(
        `SELECT u.id,
                u.email,
                p.first_name AS "firstName",
                p.last_name AS "lastName",
                p.student_id AS "studentNumber"
           FROM users u
           JOIN user_profiles p ON p.user_id = u.id
          WHERE u.role = 'student'
            AND (
              ($1::uuid IS NOT NULL AND p.class_id = $1)
              OR ($1::uuid IS NULL AND p.grade_level = $2 AND p.class_name = $3)
            )
          ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST, u.email`,
        [assignment.classId, assignment.gradeLevel, assignment.className],
      );
      if (!classStudentRows.length) {
        return res.status(400).json({ error: "No students found for this class." });
      }
      const scopedStudents = studentId
        ? classStudentRows.filter((student) => student.id === studentId)
        : classStudentRows;
      if (studentId && !scopedStudents.length) {
        return res.status(403).json({
          error: "Student is not in the selected class assignment.",
        });
      }

      const resolvedQuestionCount = clamp(
        toNumberOrNull(questionCount) ?? 8,
        3,
        20,
      );
      const extractedSet = await resolveUploadedExerciseQuestions({
        sourceText,
        file: req.file || null,
        subject: assignment.subject || "Subject",
        gradeLevel: assignment.gradeLevel,
        className: assignment.className,
        title,
        questionCount: resolvedQuestionCount,
      });

      if (!extractedSet?.questions || extractedSet.questions.length < 3) {
        return res.status(400).json({
          error:
            "We could not extract enough questions. Provide cleaner text or upload a clearer document/image.",
        });
      }

      const uploadedSourceImageUrl =
        req.file && String(req.file.mimetype || "").startsWith("image/")
          ? `/uploads/${path.basename(req.file.filename || req.file.path || "")}`
          : null;
      const normalizedQuestions = extractedSet.questions
        .slice(0, resolvedQuestionCount)
        .map((question) => {
          const rawImageUrl = String(question?.imageUrl || "").trim();
          return {
            ...question,
            imageUrl: rawImageUrl || uploadedSourceImageUrl || null,
          };
        });

      const normalizedDifficulty = normalizeDifficultyLabel(
        difficulty || extractedSet.difficulty || "Intermediate",
      );
      const exerciseName =
        String(title || extractedSet.name || "")
          .trim()
          .slice(0, 180) ||
        `${assignment.subject || "Subject"} Uploaded Exercise`;

      const createdExercises = [];

      for (const student of scopedStudents) {
        const exerciseInsertSql = supportsExerciseMeta
          ? `INSERT INTO exercises (
               user_id,
               name,
               subject,
               difficulty,
               question_count,
               exercise_date,
               subject_id,
               assigned_by_teacher_id,
               assignment_origin
             )
            VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)
            RETURNING id,
                      name,
                      subject,
                      difficulty,
                      question_count AS "questionCount",
                      exercise_date AS "exerciseDate"`
          : `INSERT INTO exercises (
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
                      exercise_date AS "exerciseDate"`;
        const exerciseInsertParams = supportsExerciseMeta
          ? [
              student.id,
              exerciseName,
              assignment.subject || "Subject",
              normalizedDifficulty,
              normalizedQuestions.length,
              assignment.subjectId || null,
              req.user.id,
              studentId ? "teacher_student_upload" : "teacher_class_upload",
            ]
          : [
              student.id,
              exerciseName,
              assignment.subject || "Subject",
              normalizedDifficulty,
              normalizedQuestions.length,
              assignment.subjectId || null,
            ];
        const { rows: exerciseRows } = await query(
          exerciseInsertSql,
          exerciseInsertParams,
        );
        const createdExercise = exerciseRows[0];

        const valueParts = [];
        const params = [];
        let paramIndex = 1;
        normalizedQuestions.forEach((question, index) => {
          valueParts.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`,
          );
          params.push(
            createdExercise.id,
            index + 1,
            attachQuestionImageMarker(question.text, question.imageUrl)
              .trim()
              .slice(0, 1800),
            String(question.type || "Short Answer").trim().slice(0, 80),
            String(question.answer || "").trim().slice(0, 600),
            clamp(toNumberOrNull(question.points) ?? 1, 1, 5),
          );
        });

        await query(
          `INSERT INTO exercise_questions (
              exercise_id,
              question_order,
              question_text,
              question_type,
              correct_answer,
              points
            )
           VALUES ${valueParts.join(", ")}`,
          params,
        );

        const studentName =
          [student.firstName, student.lastName].filter(Boolean).join(" ") ||
          student.email ||
          "Student";
        await createNotification(
          student.id,
          "New class exercise uploaded",
          `${exerciseName} is now available in your ${assignment.subject || "subject"} exercises.`,
        );

        createdExercises.push({
          id: createdExercise.id,
          studentId: student.id,
          studentName,
        });
      }

      await createNotification(
        req.user.id,
        "Exercise uploaded to class",
        `${createdExercises.length} student exercise(s) were published for ${assignment.className || "the class"}.`,
      );

      await logAudit(req, "class_exercise_uploaded", {
        assignmentId,
        studentId: studentId || null,
        studentsPublished: createdExercises.length,
        questionCount: normalizedQuestions.length,
        extractionMode: extractedSet.extractionMode || "unknown",
      });

      return res.status(201).json({
        uploaded: {
          assignmentId,
          target: studentId ? "student" : "class",
          studentId: studentId || null,
          exerciseName,
          difficulty: normalizedDifficulty,
          extractionMode: extractedSet.extractionMode || "unknown",
          questionCount: normalizedQuestions.length,
          publishedStudents: createdExercises.length,
          previewQuestions: normalizedQuestions.slice(0, 3).map((item, index) => ({
            order: index + 1,
            type: item.type,
            text: item.text,
            imageUrl: item.imageUrl || null,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.post("/exercises/generate", aiLimiter, async (req, res, next) => {
  try {
    const supportsExerciseMeta = await ensureExerciseAssignmentMeta();
    const {
      assignmentId,
      studentId,
      questionCount,
      difficulty,
      weakArea,
      targetType,
      assignmentScope,
    } = req.body || {};

    const resolvedTargetType = String(
      targetType || assignmentScope || "student",
    )
      .trim()
      .toLowerCase();
    const isClassTarget = resolvedTargetType === "class";

    if (!isUuid(assignmentId)) {
      return res.status(400).json({ error: "Invalid class assignment id." });
    }
    if (!isUuid(studentId)) {
      return res.status(400).json({ error: "Invalid student id." });
    }
    if (!["class", "student"].includes(resolvedTargetType)) {
      return res
        .status(400)
        .json({ error: "Invalid target type. Use class or student." });
    }

    const { rows: assignmentRows } = await query(
      `SELECT id,
              class_id AS "classId",
              subject_id AS "subjectId",
              grade_level AS "gradeLevel",
              class_name AS "className",
              subject
         FROM teacher_assignments
        WHERE id = $1
          AND teacher_id = $2`,
      [assignmentId, req.user.id],
    );

    const assignment = assignmentRows[0];
    if (!assignment) {
      return res.status(404).json({ error: "Class assignment not found." });
    }

    const { rows: studentRows } = await query(
      `SELECT u.id,
              u.email,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber"
         FROM users u
         JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1
          AND u.role = 'student'
          AND (
            ($2::uuid IS NOT NULL AND p.class_id = $2)
            OR ($2::uuid IS NULL AND p.grade_level = $3 AND p.class_name = $4)
          )`,
      [studentId, assignment.classId, assignment.gradeLevel, assignment.className],
    );

    const student = studentRows[0];
    if (!student) {
      return res.status(403).json({
        error: "Student is not in the selected class assignment.",
      });
    }

    const [{ rows: latestRows }, { rows: classWeakAreaRows }] =
      await Promise.all([
        query(
          `SELECT weak_area AS "weakArea",
                  grade_percent AS "gradePercent"
             FROM assessments
            WHERE user_id = $1
              AND subject = $2
            ORDER BY assessment_date DESC NULLS LAST, created_at DESC
            LIMIT 1`,
          [student.id, assignment.subject],
        ),
        query(
          `SELECT trim(a.weak_area) AS "weakArea",
                  COUNT(*)::int AS count,
                  MAX(a.assessment_date) AS "latestAssessmentDate",
                  MAX(a.created_at) AS "latestCreatedAt"
             FROM assessments a
             JOIN user_profiles p ON p.user_id = a.user_id
            WHERE a.weak_area IS NOT NULL
              AND trim(a.weak_area) <> ''
              AND (
                $1::text IS NULL
                OR lower(trim(a.subject)) = lower(trim($1))
              )
              AND (
                ($2::uuid IS NOT NULL AND p.class_id = $2)
                OR ($2::uuid IS NULL AND p.grade_level = $3 AND p.class_name = $4)
              )
            GROUP BY trim(a.weak_area)
            ORDER BY count DESC,
                     "latestAssessmentDate" DESC NULLS LAST,
                     "latestCreatedAt" DESC NULLS LAST,
                     "weakArea"
            LIMIT 1`,
          [
            assignment.subject || null,
            assignment.classId || null,
            assignment.gradeLevel || null,
            assignment.className || null,
          ],
        ),
      ]);

    const latest = latestRows[0] || {};
    const classWeakArea = String(classWeakAreaRows[0]?.weakArea || "").trim();
    const resolvedWeakArea =
      String(weakArea || "").trim() ||
      classWeakArea ||
      String(latest.weakArea || "").trim() ||
      inferWeakArea({
        subject: assignment.subject,
        type: "Exercise",
        gradePercent:
          latest.gradePercent === null || latest.gradePercent === undefined
            ? 55
            : Number(latest.gradePercent),
      });

    const safeDifficulty = normalizeDifficultyLabel(difficulty);
    const safeQuestionCount = await resolveRequestedQuestionCount({
      userId: student.id,
      subject: assignment.subject,
      requestedCount: questionCount,
      difficulty: safeDifficulty,
    });
    const studentName =
      [student.firstName, student.lastName].filter(Boolean).join(" ") ||
      student.email ||
      "Student";

    const { rows: subjectBookRows } = await query(
      `SELECT id,
              name,
              subject,
              file_url AS "url",
              bucket,
              file_path AS "filePath",
              resource_date AS "resourceDate",
              levels
         FROM resources
        WHERE (
            lower(trim(COALESCE(bucket, ''))) = 'books'
            OR lower(COALESCE(file_path, '')) LIKE 'books/%'
            OR lower(COALESCE(file_url, '')) LIKE '%/books/%'
          )
          AND (
            lower(trim(COALESCE(subject, ''))) = lower(trim($1))
            OR replace(lower(trim(COALESCE(subject, ''))), ' ', '') = replace(lower(trim($1)), ' ', '')
            OR lower(trim(COALESCE(subject, ''))) LIKE lower(trim($1)) || '%'
            OR lower(trim($1)) LIKE lower(trim(COALESCE(subject, ''))) || '%'
          )
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
      [assignment.subject, assignment.gradeLevel || null],
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
                resource_date AS "resourceDate",
                levels
           FROM resources
          WHERE (
            lower(trim(COALESCE(bucket, ''))) = 'books'
            OR lower(COALESCE(file_path, '')) LIKE 'books/%'
            OR lower(COALESCE(file_url, '')) LIKE '%/books/%'
          )
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
    const safeBookContext = bookRows.slice(0, 6).map((row) => ({
      id: row.id,
      title: String(row.name || "Book")
        .trim()
        .slice(0, 140),
      excerpt: "",
      url: buildResourceUrl(row),
    }));

    const geminiExercise = await generateExerciseWithGemini({
      subject: assignment.subject,
      gradeLevel: assignment.gradeLevel,
      className: assignment.className,
      weakArea: resolvedWeakArea,
      studentName,
      questionCount: safeQuestionCount,
      difficulty: safeDifficulty,
      resourceContext: safeBookContext,
    });

    const fallbackQuestions = buildFallbackExerciseQuestions({
      subject: assignment.subject,
      weakArea: resolvedWeakArea,
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
    const exerciseName =
      String(geminiExercise?.name || "").trim() ||
      ((assignment.subject || "Subject") +
        " Practice - " +
        resolvedWeakArea +
        " Set " +
        fallbackSuffix);
    const exerciseDifficulty = normalizeDifficultyLabel(
      geminiExercise?.difficulty || safeDifficulty,
    );

    const exerciseInsertSql = supportsExerciseMeta
      ? `INSERT INTO exercises (
           user_id,
           name,
           subject,
           difficulty,
           question_count,
           exercise_date,
           subject_id,
           assigned_by_teacher_id,
           assignment_origin
         )
        VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)
        RETURNING id,
                  name,
                  subject,
                  difficulty,
                  question_count AS "questionCount",
                  exercise_date AS "exerciseDate"`
      : `INSERT INTO exercises (
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
                  exercise_date AS "exerciseDate"`;
    const exerciseInsertParams = supportsExerciseMeta
      ? [
          student.id,
          exerciseName.slice(0, 180),
          assignment.subject || "Subject",
          exerciseDifficulty,
          selectedQuestions.length,
          assignment.subjectId || null,
          req.user.id,
          isClassTarget ? "teacher_class_generated" : "teacher_student_generated",
        ]
      : [
          student.id,
          exerciseName.slice(0, 180),
          assignment.subject || "Subject",
          exerciseDifficulty,
          selectedQuestions.length,
          assignment.subjectId || null,
        ];
    const { rows: exerciseRows } = await query(
      exerciseInsertSql,
      exerciseInsertParams,
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
        String(question.text || ("Question " + (order + 1))).trim().slice(0, 1800),
        String(question.type || "Short Answer").trim().slice(0, 80),
        String(question.answer || "").trim().slice(0, 500),
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

    await createNotification(
      student.id,
      "New exercise generated",
      `A new ${assignment.subject || "subject"} exercise has been prepared for your weak area: ${resolvedWeakArea}.`,
    );

    await createNotification(
      req.user.id,
      "Exercise generated",
      `A new exercise for ${studentName} (${assignment.subject || "Subject"}) was generated successfully.`,
    );

    await logAudit(req, "exercise_generated", {
      assignmentId,
      studentId: student.id,
      exerciseId: createdExercise.id,
      generatedWith: generationMode,
      questionCount: orderedQuestions.length,
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
        student: {
          id: student.id,
          email: student.email,
          name: studentName,
          studentNumber: student.studentNumber || null,
          className: assignment.className || null,
          gradeLevel: assignment.gradeLevel || null,
        },
        questions: orderedQuestions,
        generatedWith: generationMode,
        weakArea: resolvedWeakArea,
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
router.get("/exercises", async (req, res, next) => {
  try {
    const includeQuestions = req.query.includeQuestions === "true";
    const requestedStudentId = req.query.studentId;
    const { studentIds } = await getAssignedStudentIds(req.user.id);
    const supportsExerciseMeta = await ensureExerciseAssignmentMeta();
    if (!studentIds.length) {
      return res.json({ exercises: [] });
    }
    let scopedStudentIds = studentIds;
    if (requestedStudentId) {
      if (!isUuid(requestedStudentId)) {
        return res.status(400).json({ error: "Invalid student id." });
      }
      if (!studentIds.includes(requestedStudentId)) {
        return res.status(403).json({ error: "Student not assigned to you." });
      }
      scopedStudentIds = [requestedStudentId];
    }
    const { rows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.difficulty,
              e.question_count AS "questionCount",
              e.exercise_date AS "exerciseDate",
              ${
                supportsExerciseMeta
                  ? `e.assignment_origin AS "assignmentOrigin",
                     e.assigned_by_teacher_id AS "assignedByTeacherId",`
                  : `NULL::text AS "assignmentOrigin",
                     NULL::uuid AS "assignedByTeacherId",`
              }
              latest.id AS "submissionId",
              latest.status AS "submissionStatus",
              latest.score AS "submissionScore",
              latest.submitted_at AS "submittedAt",
              latest.created_at AS "submissionCreatedAt",
              attempts.count AS "attemptCount",
              u.id AS "studentId",
              u.email AS "studentEmail",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber",
              p.class_name AS "className",
              p.grade_level AS "gradeLevel"
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
         JOIN users u ON u.id = e.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE e.user_id = ANY($1::uuid[])
         ORDER BY e.exercise_date DESC NULLS LAST, e.created_at DESC`,
      [scopedStudentIds],
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
        assignmentOrigin: row.assignmentOrigin || null,
        assignedByTeacherId: row.assignedByTeacherId || null,
        submissionId: row.submissionId || null,
        submissionStatus: row.submissionStatus || null,
        submissionScore:
          row.submissionScore === null || row.submissionScore === undefined
            ? null
            : Number(row.submissionScore),
        submittedAt: row.submittedAt || row.submissionCreatedAt || null,
        attemptCount: Number(row.attemptCount) || 0,
        student: {
          id: row.studentId,
          email: row.studentEmail,
          name:
            [row.firstName, row.lastName].filter(Boolean).join(" ") ||
            row.studentEmail ||
            "Student",
          studentNumber: row.studentNumber || null,
          className: row.className || null,
          gradeLevel: row.gradeLevel || null,
        },
        questions: includeQuestions ? questionsByExercise[row.id] || [] : undefined,
      })),
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

    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.status(403).json({ error: "No assigned students." });
    }

    await ensureExerciseAnswerTeacherReviewMeta();
    const supportsExerciseMeta = await ensureExerciseAssignmentMeta();
    const { rows: exerciseRows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.difficulty,
              e.question_count AS "questionCount",
              e.exercise_date AS "exerciseDate",
              ${
                supportsExerciseMeta
                  ? `e.assignment_origin AS "assignmentOrigin",`
                  : `NULL::text AS "assignmentOrigin",`
              }
              latest.id AS "submissionId",
              latest.status AS "submissionStatus",
              latest.score AS "submissionScore",
              latest.submitted_at AS "submittedAt",
              latest.created_at AS "submissionCreatedAt",
              attempts.count AS "attemptCount",
              u.id AS "studentId",
              u.email AS "studentEmail",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber",
              p.class_name AS "className",
              p.grade_level AS "gradeLevel"
         FROM exercises e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
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
          AND e.user_id = ANY($2::uuid[])`,
      [exerciseId, studentIds],
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
              a.answer_text AS "studentAnswer",
              a.teacher_score AS "teacherScore",
              a.teacher_feedback AS "teacherFeedback",
              a.reviewed_by_teacher_id AS "reviewedByTeacherId",
              a.reviewed_at AS "reviewedAt"
         FROM exercise_questions q
         LEFT JOIN exercise_answers a
           ON a.question_id = q.id
          AND a.submission_id = $2
        WHERE q.exercise_id = $1
        ORDER BY q.question_order`,
      [exerciseId, exercise.submissionId],
    );

    const evaluation = evaluateExerciseReviewRows(questionRows);
    const resolvedScore =
      evaluation.summary.score === null || evaluation.summary.score === undefined
        ? exercise.submissionScore === null || exercise.submissionScore === undefined
          ? null
          : Number(exercise.submissionScore)
        : Number(evaluation.summary.score);

    return res.json({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        subject: exercise.subject,
        difficulty: exercise.difficulty,
        questionCount: exercise.questionCount,
        date: formatShortDate(exercise.exerciseDate),
        assignmentOrigin: exercise.assignmentOrigin || null,
      },
      student: {
        id: exercise.studentId,
        email: exercise.studentEmail,
        name:
          [exercise.firstName, exercise.lastName].filter(Boolean).join(" ") ||
          exercise.studentEmail ||
          "Student",
        studentNumber: exercise.studentNumber || null,
        className: exercise.className || null,
        gradeLevel: exercise.gradeLevel || null,
      },
      submission: {
        id: exercise.submissionId,
        status: exercise.submissionStatus || "submitted",
        score: resolvedScore,
        submittedAt: exercise.submittedAt || exercise.submissionCreatedAt || null,
        attemptCount: Number(exercise.attemptCount) || 1,
        reviewStatus: evaluation.summary.status,
        pendingTeacherCount: evaluation.summary.pendingTeacher,
        teacherReviewedCount: evaluation.summary.teacherReviewed,
        aiReviewedCount: evaluation.summary.autoReviewed,
      },
      questions: evaluation.questions,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/exercises/:id/review", async (req, res, next) => {
  try {
    const exerciseId = req.params.id;
    if (!isUuid(exerciseId)) {
      return res.status(400).json({ error: "Invalid exercise id." });
    }

    const questionId = String(req.body?.questionId || "").trim();
    if (!isUuid(questionId)) {
      return res.status(400).json({ error: "Invalid question id." });
    }

    const requestedScore = req.body?.teacherScore;
    const numericScore = Number(requestedScore);
    if (!Number.isFinite(numericScore)) {
      return res.status(400).json({ error: "Teacher score must be a valid number." });
    }

    const teacherFeedbackRaw = String(req.body?.teacherFeedback || "").trim();
    const teacherFeedback = teacherFeedbackRaw ? teacherFeedbackRaw.slice(0, 2000) : null;

    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.status(403).json({ error: "No assigned students." });
    }

    await ensureExerciseAnswerTeacherReviewMeta();
    const supportsExerciseMeta = await ensureExerciseAssignmentMeta();

    const { rows: exerciseRows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.difficulty,
              e.question_count AS "questionCount",
              e.exercise_date AS "exerciseDate",
              ${
                supportsExerciseMeta
                  ? `e.assignment_origin AS "assignmentOrigin",`
                  : `NULL::text AS "assignmentOrigin",`
              }
              latest.id AS "submissionId",
              latest.status AS "submissionStatus",
              latest.score AS "submissionScore",
              latest.submitted_at AS "submittedAt",
              latest.created_at AS "submissionCreatedAt",
              attempts.count AS "attemptCount",
              u.id AS "studentId",
              u.email AS "studentEmail",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentNumber",
              p.class_name AS "className",
              p.grade_level AS "gradeLevel"
         FROM exercises e
         JOIN users u ON u.id = e.user_id
         LEFT JOIN user_profiles p ON p.user_id = u.id
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
          AND e.user_id = ANY($2::uuid[])`,
      [exerciseId, studentIds],
    );

    const exercise = exerciseRows[0];
    if (!exercise) {
      return res.status(404).json({ error: "Exercise not found." });
    }
    if (!exercise.submissionId) {
      return res.status(400).json({ error: "No submission found for this exercise yet." });
    }

    const { rows: questionMetaRows } = await query(
      `SELECT q.id,
              q.question_type AS "type",
              COALESCE(q.points, 1) AS points,
              a.id AS "answerId"
         FROM exercise_questions q
         LEFT JOIN exercise_answers a
           ON a.question_id = q.id
          AND a.submission_id = $3
        WHERE q.exercise_id = $1
          AND q.id = $2
        LIMIT 1`,
      [exerciseId, questionId, exercise.submissionId],
    );

    const questionMeta = questionMetaRows[0];
    if (!questionMeta) {
      return res.status(404).json({ error: "Question not found in this exercise." });
    }
    if (!isOpenEndedType(questionMeta.type)) {
      return res.status(400).json({ error: "Teacher grading is only available for open-ended questions." });
    }

    const safePoints = Number.isFinite(Number(questionMeta.points))
      ? Number(questionMeta.points)
      : 1;
    const safeTeacherScore = clamp(numericScore, 0, safePoints);

    if (questionMeta.answerId) {
      await query(
        `UPDATE exercise_answers
            SET teacher_score = $1,
                teacher_feedback = $2,
                reviewed_by_teacher_id = $3,
                reviewed_at = now()
          WHERE id = $4`,
        [safeTeacherScore, teacherFeedback, req.user.id, questionMeta.answerId],
      );
    } else {
      await query(
        `INSERT INTO exercise_answers (
            submission_id,
            question_id,
            answer_text,
            teacher_score,
            teacher_feedback,
            reviewed_by_teacher_id,
            reviewed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, now())`,
        [
          exercise.submissionId,
          questionId,
          "",
          safeTeacherScore,
          teacherFeedback,
          req.user.id,
        ],
      );
    }

    const { rows: questionRows } = await query(
      `SELECT q.id,
              q.question_order AS "order",
              q.question_text AS "text",
              q.question_type AS "type",
              q.correct_answer AS "correctAnswer",
              COALESCE(q.points, 1) AS points,
              a.answer_text AS "studentAnswer",
              a.teacher_score AS "teacherScore",
              a.teacher_feedback AS "teacherFeedback",
              a.reviewed_by_teacher_id AS "reviewedByTeacherId",
              a.reviewed_at AS "reviewedAt"
         FROM exercise_questions q
         LEFT JOIN exercise_answers a
           ON a.question_id = q.id
          AND a.submission_id = $2
        WHERE q.exercise_id = $1
        ORDER BY q.question_order`,
      [exerciseId, exercise.submissionId],
    );

    const evaluation = evaluateExerciseReviewRows(questionRows);
    await query(
      `UPDATE exercise_submissions
          SET score = $1
        WHERE id = $2`,
      [evaluation.summary.score, exercise.submissionId],
    );

    await createNotification(
      exercise.studentId,
      "Exercise review updated",
      `Your teacher reviewed an open-ended answer in "${exercise.name || "Exercise"}".`,
    );

    return res.json({
      exercise: {
        id: exercise.id,
        name: exercise.name,
        subject: exercise.subject,
        difficulty: exercise.difficulty,
        questionCount: exercise.questionCount,
        date: formatShortDate(exercise.exerciseDate),
        assignmentOrigin: exercise.assignmentOrigin || null,
      },
      student: {
        id: exercise.studentId,
        email: exercise.studentEmail,
        name:
          [exercise.firstName, exercise.lastName].filter(Boolean).join(" ") ||
          exercise.studentEmail ||
          "Student",
        studentNumber: exercise.studentNumber || null,
        className: exercise.className || null,
        gradeLevel: exercise.gradeLevel || null,
      },
      submission: {
        id: exercise.submissionId,
        status: exercise.submissionStatus || "submitted",
        score: evaluation.summary.score,
        submittedAt: exercise.submittedAt || exercise.submissionCreatedAt || null,
        attemptCount: Number(exercise.attemptCount) || 1,
        reviewStatus: evaluation.summary.status,
        pendingTeacherCount: evaluation.summary.pendingTeacher,
        teacherReviewedCount: evaluation.summary.teacherReviewed,
        aiReviewedCount: evaluation.summary.autoReviewed,
      },
      questions: evaluation.questions,
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

    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.status(403).json({ error: "No assigned students." });
    }

    const { rows: existingRows } = await query(
      `SELECT id
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
        .json({ error: "You have already submitted this exercise." });
    }

    const { status, answers } = req.body || {};
    const submissionStatus = status === "in_progress" ? "in_progress" : "submitted";

    const { rows: exerciseRows } = await query(
      `SELECT id, name, subject
         FROM exercises
        WHERE id = $1
          AND user_id = ANY($2::uuid[])`,
      [exerciseId, studentIds],
    );

    if (!exerciseRows[0]) {
      return res.status(404).json({ error: "Exercise not found." });
    }

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

    return res.status(201).json({ submission });
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

    const { studentIds } = await getAssignedStudentIds(req.user.id);
    if (!studentIds.length) {
      return res.status(403).json({ error: "No assigned students." });
    }

    const { rows } = await query(
      `SELECT e.id,
              e.name,
              e.subject,
              e.exercise_date AS "exerciseDate",
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentId"
         FROM exercises e
         LEFT JOIN user_profiles p ON p.user_id = e.user_id
        WHERE e.id = $1
          AND e.user_id = ANY($2::uuid[])`,
      [exerciseId, studentIds],
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

    const { rows: teacherProfileRows } = await query(
      `SELECT first_name AS "firstName",
              last_name AS "lastName"
         FROM user_profiles
        WHERE user_id = $1`,
      [req.user.id],
    );
    const teacherProfile = teacherProfileRows[0] || {};

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
    const academicYear = process.env.ACADEMIC_YEAR || new Date().getFullYear().toString();
    const termLabel = process.env.CURRENT_TERM || "N/A";
    const teacherName =
      [teacherProfile.firstName, teacherProfile.lastName]
        .filter(Boolean)
        .join(" ") || "Teacher";
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
    const centeredBodyWidth = Math.min(contentWidth * 0.88, 470);
    const centeredBodyX = left + (contentWidth - centeredBodyWidth) / 2;
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
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#0f172a")
      .text("Instructions:", centeredBodyX, doc.y, { width: centeredBodyWidth });
    doc.moveDown(0.3);
    [
      "Attempt all questions.",
      "Write clear and complete responses.",
      "Review your answers before submission.",
    ].forEach((line) => {
      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#1f2937")
        .text(`- ${line}`, centeredBodyX, doc.y, {
          width: centeredBodyWidth,
          indent: 10,
        });
    });
    doc.moveDown(0.4);
    doc
      .strokeColor("#1e293b")
      .lineWidth(1)
      .moveTo(centeredBodyX, doc.y)
      .lineTo(centeredBodyX + centeredBodyWidth, doc.y)
      .stroke();
    doc.y += 10;

    const ensureSpace = (heightNeeded = 60) => {
      if (doc.y + heightNeeded > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
    };

    questionRows.forEach((q, idx) => {
      ensureSpace(70);
      const lines = String(q.text || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const mainLine = lines.shift() || "Question";
      const points = Number.isFinite(Number(q.points)) ? Number(q.points) : 1;

      doc
        .font("Helvetica-Bold")
        .fontSize(11.5)
        .fillColor("#0f172a")
        .text(`Question ${idx + 1}: ${mainLine} /${points} pts`, centeredBodyX, doc.y, {
          width: centeredBodyWidth,
        });
      lines.forEach((line) => {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#1f2937")
          .text(line, centeredBodyX, doc.y, {
            width: centeredBodyWidth,
            indent: 12,
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
        `WITH base AS (
           SELECT u.id,
                  u.email,
                  p.first_name AS "firstName",
                  p.last_name AS "lastName"
             FROM users u
             LEFT JOIN user_profiles p ON p.user_id = u.id
            WHERE u.id = $1
         )
         INSERT INTO user_profiles (user_id, first_name, last_name, avatar_url, updated_at)
         SELECT id,
                COALESCE("firstName", split_part(email, '@', 1), 'Teacher'),
                COALESCE("lastName", ''),
                $2,
                now()
           FROM base
         ON CONFLICT (user_id)
         DO UPDATE SET
           avatar_url = EXCLUDED.avatar_url,
           updated_at = now()
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

    await createNotification(
      req.user.id,
      "Task created",
      `"${rows[0].title}" was added to your task list${
        rows[0].due ? ` (due ${formatIsoDate(rows[0].due)}).` : "."
      }`,
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

    const completionRequested = completed === true || completed === "true";
    if (completionRequested && rows[0].completed) {
      await createNotification(
        req.user.id,
        "Task completed",
        `You completed "${rows[0].title}".`,
      );
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

export default router;

