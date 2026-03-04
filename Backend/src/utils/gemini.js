import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_RETRIES = Math.max(
  1,
  Number.parseInt(process.env.GEMINI_MAX_RETRIES || "3", 10) || 3,
);
const RETRY_BASE_MS = Math.max(
  200,
  Number.parseInt(process.env.GEMINI_RETRY_BASE_MS || "1200", 10) || 1200,
);
const RETRY_MAX_WAIT_MS = Math.max(
  1000,
  Number.parseInt(process.env.GEMINI_RETRY_MAX_WAIT_MS || "60000", 10) ||
    60000,
);
const MAX_TEXT_LENGTH = 1200;
const MAX_ITEM_LENGTH = 220;

const KEY_ENV_PREFIX = "GEMINI_API_KEY_";

let nextKeyIndex = 0;
const clientsByKey = new Map();

const clamp = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
};

const normalizeText = (value, max = MAX_TEXT_LENGTH) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripStudentIdentityFromTitle = (title, studentName) => {
  let cleaned = normalizeText(title, 180);
  if (!cleaned) return "";

  const rawName = String(studentName || "").trim().toLowerCase();
  if (rawName) {
    const parts = rawName
      .split(/[^a-z0-9]+/gi)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3);
    const tokens = Array.from(new Set([rawName, ...parts])).sort(
      (a, b) => b.length - a.length,
    );
    for (const token of tokens) {
      const pattern = new RegExp(`\\b${escapeRegex(token)}(?:'s)?\\b`, "gi");
      cleaned = cleaned.replace(pattern, " ");
    }
  }

  return cleaned
    .replace(/\s+/g, " ")
    .replace(/\s*[-|,:;]+\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\-|,:;\s]+|[\-|,:;\s]+$/g, "")
    .trim()
    .slice(0, 180);
};

const sanitizeArray = (items, maxItems = 3, maxLength = MAX_ITEM_LENGTH) => {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    const value = normalizeText(item, maxLength);
    if (!value) continue;
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
};

const extractJson = (rawText) => {
  const text = String(rawText || "").trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_) {
    // Try JSON code fence.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch (_) {
      // Continue.
    }
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (_) {
      return null;
    }
  }

  return null;
};

const getMimeTypeFromPath = (filePath, fallback = "image/jpeg") => {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".txt") return "text/plain";
  if (ext === ".md") return "text/markdown";
  return fallback;
};

const collectGeminiApiKeys = () => {
  const keys = [];
  const seen = new Set();

  const pushKey = (value) => {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  pushKey(process.env.GEMINI_API_KEY);

  const csvKeys = String(process.env.GEMINI_API_KEYS || "");
  if (csvKeys) {
    csvKeys
      .split(",")
      .map((item) => item.trim())
      .forEach((item) => pushKey(item));
  }

  Object.keys(process.env)
    .filter((name) => name.startsWith(KEY_ENV_PREFIX))
    .sort()
    .forEach((name) => pushKey(process.env[name]));

  return keys;
};

const getClientForKey = (apiKey) => {
  if (!apiKey) return null;
  if (!clientsByKey.has(apiKey)) {
    clientsByKey.set(apiKey, new GoogleGenerativeAI(apiKey));
  }
  return clientsByKey.get(apiKey);
};

const getModelsInRotation = () => {
  const keys = collectGeminiApiKeys();
  if (keys.length === 0) return [];

  const start = nextKeyIndex % keys.length;
  nextKeyIndex = (nextKeyIndex + 1) % keys.length;

  const rotatedKeys = [
    ...keys.slice(start),
    ...keys.slice(0, start),
  ];

  return rotatedKeys
    .map((apiKey) => {
      const sdk = getClientForKey(apiKey);
      if (!sdk) return null;
      return {
        apiKey,
        model: sdk.getGenerativeModel({ model: DEFAULT_MODEL }),
      };
    })
    .filter(Boolean);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getErrorMessage = (error) => String(error?.message || error || "");

const isRateLimitError = (error) => {
  const status =
    Number(error?.status) ||
    Number(error?.statusCode) ||
    Number(error?.response?.status);
  if (status === 429) return true;
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("resource_exhausted") ||
    message.includes("quota")
  );
};

const isHardQuotaExhausted = (error) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("limit: 0") ||
    message.includes("free_tier_requests") ||
    message.includes("generaterequestsperdayperprojectpermodel-freetier") ||
    message.includes("quota exceeded for metric")
  );
};

const parseRetryDelayMs = (error) => {
  const message = getErrorMessage(error);

  const decimalSecondsMatch = message.match(
    /retry in\s+([0-9]+(?:\.[0-9]+)?)s/i,
  );
  if (decimalSecondsMatch?.[1]) {
    return Math.min(
      RETRY_MAX_WAIT_MS,
      Math.max(250, Math.ceil(Number(decimalSecondsMatch[1]) * 1000)),
    );
  }

  const secondsFieldMatch = message.match(/seconds:\s*([0-9]+)/i);
  if (secondsFieldMatch?.[1]) {
    return Math.min(
      RETRY_MAX_WAIT_MS,
      Math.max(250, Number(secondsFieldMatch[1]) * 1000),
    );
  }

  const retryAfterHeader = error?.response?.headers?.["retry-after"];
  if (retryAfterHeader !== undefined && retryAfterHeader !== null) {
    const asNumber = Number(retryAfterHeader);
    if (Number.isFinite(asNumber)) {
      return Math.min(RETRY_MAX_WAIT_MS, Math.max(250, asNumber * 1000));
    }
  }

  return null;
};

const computeBackoffMs = (attempt) => {
  const exp = Math.min(attempt, 8);
  const wait = RETRY_BASE_MS * 2 ** exp;
  const jitter = Math.floor(Math.random() * 350);
  return Math.min(RETRY_MAX_WAIT_MS, wait + jitter);
};

const generateContentWithRetry = async (
  model,
  payload,
  { rotateOnRateLimit = false } = {},
) => {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      return await model.generateContent(payload);
    } catch (error) {
      lastError = error;
      if (isHardQuotaExhausted(error)) {
        throw error;
      }
      if (rotateOnRateLimit && isRateLimitError(error)) {
        throw error;
      }
      if (!isRateLimitError(error) || attempt >= MAX_RETRIES - 1) {
        throw error;
      }
      const parsedMs = parseRetryDelayMs(error);
      const waitMs = parsedMs ?? computeBackoffMs(attempt);
      await sleep(waitMs);
    }
  }
  throw lastError || new Error("Gemini call failed after retries.");
};

const generateStructuredJson = async ({
  prompt,
  imagePath = null,
  mimeType = null,
  temperature = 0.2,
}) => {
  const modelsInRotation = getModelsInRotation();
  if (modelsInRotation.length === 0) return null;

  const parts = [{ text: prompt }];
  if (imagePath) {
    const fileBytes = fs.readFileSync(imagePath);
    parts.push({
      inlineData: {
        data: fileBytes.toString("base64"),
        mimeType: mimeType || getMimeTypeFromPath(imagePath),
      },
    });
  }

  const payload = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };

  let lastError = null;
  const rotateOnRateLimit = modelsInRotation.length > 1;

  for (let index = 0; index < modelsInRotation.length; index += 1) {
    const currentModel = modelsInRotation[index]?.model;
    if (!currentModel) continue;
    try {
      const response = await generateContentWithRetry(currentModel, payload, {
        rotateOnRateLimit,
      });
      const text = response?.response?.text?.() || "";
      return extractJson(text);
    } catch (error) {
      lastError = error;
      if (index >= modelsInRotation.length - 1) {
        break;
      }
      if (isRateLimitError(error) || isHardQuotaExhausted(error)) {
        continue;
      }
      continue;
    }
  }

  if (lastError) throw lastError;
  return null;
};

export const isGeminiEnabled = () => collectGeminiApiKeys().length > 0;

export const analyzeAssessmentWithGemini = async ({
  imagePath,
  mimeType,
  subject,
  assessmentType,
  className,
  gradeLevel,
  teacherNotes,
  providedScoreObtained,
  providedScoreTotal,
}) => {
  if (!imagePath || !isGeminiEnabled()) return null;

  const prompt = `
You are an education assessment assistant for Rwanda basic education context.
Analyze the scanned student work image and return STRICT JSON only.

Context:
- Subject: ${subject || "General"}
- Assessment type: ${assessmentType || "Assessment"}
- Class: ${className || "Unknown"}
- Grade level: ${gradeLevel || "Unknown"}
- Teacher notes: ${teacherNotes || "None"}
- Provided score obtained: ${providedScoreObtained ?? "None"}
- Provided score total: ${providedScoreTotal ?? "None"}

JSON schema:
{
  "scoreObtained": number | null,
  "scoreTotal": number | null,
  "gradePercent": number | null,
  "weakArea": string,
  "strengths": string[],
  "recommendations": string[],
  "misconceptions": string[],
  "supportNeeds": string[],
  "learningProfile": string,
  "nextCheckpoint": string,
  "teacherFeedback": string
}

Rules:
- If score cannot be inferred from image, return null for score fields.
- gradePercent must be 0..100 if present.
- strengths should be 1..3 concise bullets.
- recommendations should be 3..5 practical actions for teacher.
- misconceptions should be 1..3 likely misunderstanding points.
- supportNeeds should be 2..4 concrete supports the learner needs.
- learningProfile should be 1..3 sentences describing how the learner is performing.
- nextCheckpoint should be one short measurable check for the next lesson.
- weakArea should be a specific learning concept.
- teacherFeedback must be concise and actionable.
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      imagePath,
      mimeType,
      temperature: 0.1,
    });
    if (!parsed || typeof parsed !== "object") return null;

    const scoreTotalRaw =
      parsed.scoreTotal === null || parsed.scoreTotal === undefined
        ? null
        : Number(parsed.scoreTotal);
    const scoreObtainedRaw =
      parsed.scoreObtained === null || parsed.scoreObtained === undefined
        ? null
        : Number(parsed.scoreObtained);
    const gradePercentRaw =
      parsed.gradePercent === null || parsed.gradePercent === undefined
        ? null
        : Number(parsed.gradePercent);

    let scoreTotal = Number.isFinite(scoreTotalRaw)
      ? clamp(Math.round(scoreTotalRaw), 1, 100)
      : null;
    let scoreObtained = Number.isFinite(scoreObtainedRaw)
      ? Math.max(0, Math.round(scoreObtainedRaw))
      : null;
    let gradePercent = Number.isFinite(gradePercentRaw)
      ? clamp(Math.round(gradePercentRaw), 0, 100)
      : null;

    if (scoreTotal !== null && scoreObtained !== null) {
      scoreObtained = clamp(scoreObtained, 0, scoreTotal);
      if (gradePercent === null) {
        gradePercent = clamp(Math.round((scoreObtained / scoreTotal) * 100), 0, 100);
      }
    } else if (gradePercent !== null && scoreTotal !== null && scoreObtained === null) {
      scoreObtained = clamp(Math.round((gradePercent / 100) * scoreTotal), 0, scoreTotal);
    }

    return {
      scoreObtained,
      scoreTotal,
      gradePercent,
      weakArea: normalizeText(parsed.weakArea, 140),
      strengths: sanitizeArray(parsed.strengths, 3, 160),
      recommendations: sanitizeArray(parsed.recommendations, 5, 220),
      misconceptions: sanitizeArray(parsed.misconceptions, 3, 180),
      supportNeeds: sanitizeArray(parsed.supportNeeds, 4, 180),
      learningProfile: normalizeText(parsed.learningProfile, 600),
      nextCheckpoint: normalizeText(parsed.nextCheckpoint, 240),
      teacherFeedback: normalizeText(parsed.teacherFeedback, 1400),
    };
  } catch (error) {
    console.error("Gemini assessment analysis failed", error?.message || error);
    return null;
  }
};

export const generateExerciseWithGemini = async ({
  subject,
  gradeLevel,
  className,
  weakArea,
  studentName,
  lessonContext = null,
  questionCount = 8,
  difficulty = "Intermediate",
  resourceContext = [],
}) => {
  if (!isGeminiEnabled()) return null;

  const safeCount = clamp(questionCount, 3, 20);
  const safeResources = Array.isArray(resourceContext)
    ? resourceContext
        .slice(0, 4)
        .map((item, index) => ({
          label: `R${index + 1}`,
          title: normalizeText(item?.title || item?.name || "Book", 140),
          excerpt: normalizeText(item?.excerpt || "", 450),
        }))
        .filter((item) => item.title)
    : [];
  const resourcesBlock =
    safeResources.length > 0
      ? safeResources
          .map((item) =>
            item.excerpt
              ? `${item.label}: ${item.title}\nExcerpt: ${item.excerpt}`
              : `${item.label}: ${item.title}`,
          )
          .join("\n\n")
      : "No book snippets were provided.";
  const lessonTopic = normalizeText(lessonContext?.topic || "", 160);
  const lessonUnit = normalizeText(lessonContext?.unit || "", 120);
  const lessonPages = normalizeText(lessonContext?.pages || "", 80);
  const lessonLabel = normalizeText(lessonContext?.label || "", 160);

  const prompt = `
You are an education content generator for Rwanda basic education.
Create a personalized exercise set and return STRICT JSON only.

Context:
- Student: ${studentName || "Student"}
- Subject: ${subject || "General"}
- Grade level: ${gradeLevel || "Unknown"}
- Class: ${className || "Unknown"}
- Weak area: ${weakArea || "Core concepts"}
- Current lesson topic: ${lessonTopic || "Not specified"}
- Current lesson unit: ${lessonUnit || "Not specified"}
- Current lesson pages: ${lessonPages || "Not specified"}
- Lesson context label: ${lessonLabel || "Not specified"}
- Target questions: ${safeCount}
- Target difficulty: ${difficulty || "Intermediate"}

Approved source policy:
- Use only the approved references from Supabase bucket "Books" shown below.
- Keep every question aligned to the selected subject and the approved references.
- Anchor every question to the current lesson topic/unit when provided.
- If a reference snippet is short, create simple reinforcement questions from that concept only.

Approved references:
${resourcesBlock}

JSON schema:
{
  "name": string,
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "questions": [
    {
      "type": "Multiple Choice" | "Short Answer" | "True/False",
      "text": string,
      "answer": string,
      "points": number
    }
  ]
}

Rules:
- Return exactly ${safeCount} questions.
- The exercise name must be generic and must NOT contain the student's name, email, or personal identifiers.
- Keep the exercise focused on the current lesson context and weak area.
- For "Multiple Choice", include options in text as lines:
  A) ...
  B) ...
  C) ...
  D) ...
- Keep language simple, clear, and curriculum-aligned.
- Ensure all questions are grounded in the approved references list.
- points must be integers in range 1..5.
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      temperature: 0.4,
    });
    if (!parsed || typeof parsed !== "object") return null;

    const allowedTypes = new Set(["multiple choice", "short answer", "true/false"]);
    const questionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = [];
    for (const item of questionsRaw) {
      if (!item || typeof item !== "object") continue;
      const typeRaw = normalizeText(item.type, 40).toLowerCase();
      const type = allowedTypes.has(typeRaw)
        ? typeRaw
            .split("/")
            .map((part) => part.trim())
            .join("/")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Short Answer";
      const text = normalizeText(item.text, 1400);
      if (!text) continue;
      const answer = normalizeText(item.answer, 500);
      const points = clamp(Math.round(Number(item.points) || 1), 1, 5);
      questions.push({ type, text, answer, points });
      if (questions.length >= safeCount) break;
    }

    if (questions.length < 3) return null;

    const normalizedDifficulty = normalizeText(parsed.difficulty, 30).toLowerCase();
    let safeDifficulty = "Intermediate";
    if (normalizedDifficulty.includes("begin")) safeDifficulty = "Beginner";
    if (normalizedDifficulty.includes("advanced")) safeDifficulty = "Advanced";

    const rawName = normalizeText(parsed.name, 180);
    const safeName =
      stripStudentIdentityFromTitle(rawName, studentName) ||
      `${subject || "Subject"} Practice`;

    return {
      name: safeName,
      difficulty: safeDifficulty,
      questions,
    };
  } catch (error) {
    if (isHardQuotaExhausted(error)) {
      console.warn("Gemini quota exhausted. Falling back to Books-based generator.");
    } else {
      console.error("Gemini exercise generation failed", error?.message || error);
    }
    return null;
  }
};

export const extractExerciseFromSourceWithGemini = async ({
  filePath,
  mimeType,
  subject,
  gradeLevel,
  className,
  titleHint,
  questionCount = 8,
}) => {
  if (!filePath || !isGeminiEnabled()) return null;

  const safeCount = clamp(questionCount, 3, 20);
  const safeMimeType = mimeType || getMimeTypeFromPath(filePath);

  const prompt = `
You are an education content extraction assistant for Rwanda basic education.
Extract exercise questions from the provided document/image and return STRICT JSON only.

Context:
- Subject: ${subject || "General"}
- Grade level: ${gradeLevel || "Unknown"}
- Class: ${className || "Unknown"}
- Title hint: ${titleHint || "Exercise"}
- Target question count: ${safeCount}

JSON schema:
{
  "name": string,
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "questions": [
    {
      "type": "Multiple Choice" | "Short Answer" | "True/False",
      "text": string,
      "answer": string,
      "points": number,
      "imageUrl": string | null
    }
  ]
}

Rules:
- Return 3 to ${safeCount} questions that best match the document.
- Preserve original question wording as much as possible.
- If a question references a visible figure/diagram and a URL is explicitly available, set imageUrl to that URL.
- If no URL is available for the figure/diagram, set imageUrl to null and keep figure reference in text.
- points must be integers in range 1..5.
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      imagePath: filePath,
      mimeType: safeMimeType,
      temperature: 0.1,
    });
    if (!parsed || typeof parsed !== "object") return null;

    const normalizedDifficulty = normalizeText(parsed.difficulty, 30).toLowerCase();
    let safeDifficulty = "Intermediate";
    if (normalizedDifficulty.includes("begin")) safeDifficulty = "Beginner";
    if (normalizedDifficulty.includes("advanced")) safeDifficulty = "Advanced";

    const allowedTypes = new Set(["multiple choice", "short answer", "true/false"]);
    const questionsRaw = Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = [];
    for (const item of questionsRaw) {
      if (!item || typeof item !== "object") continue;
      const typeRaw = normalizeText(item.type, 40).toLowerCase();
      const type = allowedTypes.has(typeRaw)
        ? typeRaw
            .split("/")
            .map((part) => part.trim())
            .join("/")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Short Answer";
      const text = normalizeText(item.text, 1800);
      if (!text) continue;
      const answer = normalizeText(item.answer, 600);
      const points = clamp(Math.round(Number(item.points) || 1), 1, 5);
      const imageUrlRaw = normalizeText(item.imageUrl, 600);
      const imageUrl =
        /^https?:\/\//i.test(imageUrlRaw) || imageUrlRaw.startsWith("/")
          ? imageUrlRaw
          : null;
      questions.push({
        type,
        text,
        answer,
        points,
        imageUrl,
      });
      if (questions.length >= safeCount) break;
    }

    if (questions.length < 3) return null;

    const safeName = normalizeText(parsed.name, 180) || normalizeText(titleHint, 180) || "Uploaded Exercise";

    return {
      name: safeName,
      difficulty: safeDifficulty,
      questions,
    };
  } catch (error) {
    if (isHardQuotaExhausted(error)) {
      console.warn(
        "Gemini quota exhausted while extracting uploaded exercise.",
      );
    } else {
      console.error(
        "Gemini uploaded exercise extraction failed",
        error?.message || error,
      );
    }
    return null;
  }
};

export const extractTimetableFromImageWithGemini = async ({
  imagePath,
  mimeType,
  teacherName,
}) => {
  if (!imagePath || !isGeminiEnabled()) return null;

  const prompt = `
You are a timetable extraction assistant.
Analyze this timetable image and return STRICT JSON only.

Context:
- Teacher: ${teacherName || "Unknown"}

JSON schema:
{
  "rows": [
    {
      "day": string,
      "startTime": string,
      "endTime": string,
      "title": string,
      "room": string | null,
      "instructor": string | null
    }
  ]
}

Rules:
- Return each class period visible in the image.
- day should be weekday text (Mon, Tuesday, etc.) or number 0..6.
- startTime and endTime should be short time text (prefer HH:MM 24-hour when possible).
- title should be the subject/class name.
- Use null when room or instructor is not visible.
- Do not invent sessions that are not visible.
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      imagePath,
      mimeType: mimeType || getMimeTypeFromPath(imagePath),
      temperature: 0.1,
    });

    if (!parsed || typeof parsed !== "object") return null;
    const rowsRaw = Array.isArray(parsed.rows)
      ? parsed.rows
      : Array.isArray(parsed.classes)
        ? parsed.classes
        : [];

    const rows = rowsRaw
      .slice(0, 300)
      .map((item) => ({
        day: normalizeText(item?.day, 24),
        startTime: normalizeText(item?.startTime, 20),
        endTime: normalizeText(item?.endTime, 20),
        title: normalizeText(item?.title, 220),
        room: normalizeText(item?.room, 120) || null,
        instructor:
          normalizeText(item?.instructor, 120) ||
          normalizeText(teacherName, 120) ||
          null,
      }))
      .filter((row) => row.day && row.startTime && row.endTime && row.title);

    if (!rows.length) return null;
    return { rows };
  } catch (error) {
    if (isHardQuotaExhausted(error)) {
      console.warn(
        "Gemini quota exhausted while extracting timetable from image.",
      );
    } else {
      console.error(
        "Gemini timetable extraction failed",
        error?.message || error,
      );
    }
    return null;
  }
};

export const generateTeacherTimetableWithGemini = async ({
  teacherName,
  lessons = [],
  constraints = {},
}) => {
  if (!isGeminiEnabled()) return null;

  const safeLessons = Array.isArray(lessons)
    ? lessons
        .slice(0, 120)
        .map((item) => ({
          subject: normalizeText(item?.subject, 120),
          className: normalizeText(item?.className, 120),
          gradeLevel: normalizeText(item?.gradeLevel, 80),
          lessonLabel: normalizeText(item?.lessonLabel, 180),
        }))
        .filter((item) => item.subject || item.className || item.lessonLabel)
    : [];

  if (!safeLessons.length) return null;

  const prompt = `
You are a school timetable planner.
Generate a balanced weekly timetable and return STRICT JSON only.

Context:
- Teacher: ${normalizeText(teacherName, 120) || "Teacher"}
- Available days: ${Array.isArray(constraints?.dayLabels) ? constraints.dayLabels.join(", ") : "Mon, Tue, Wed, Thu, Fri"}
- Start time: ${normalizeText(constraints?.startTime, 10) || "08:00"}
- Slot duration (minutes): ${Number(constraints?.slotMinutes) || 50}
- Gap between slots (minutes): ${Number(constraints?.gapMinutes) || 10}
- Maximum slots per day: ${Number(constraints?.slotsPerDay) || 6}
- Target lessons per class-subject assignment: ${Number(constraints?.sessionsPerAssignment) || 2}

Lessons to schedule:
${safeLessons
  .map(
    (item, index) =>
      `${index + 1}. Subject: ${item.subject || "Subject"} | Class: ${
        item.className || "Class"
      } | Grade: ${item.gradeLevel || "N/A"} | Lesson focus: ${
        item.lessonLabel || "General lesson"
      }`,
  )
  .join("\n")}

JSON schema:
{
  "rows": [
    {
      "day": "Mon|Tue|Wed|Thu|Fri|Sat|Sun",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "title": string,
      "room": string | null,
      "instructor": string | null,
      "className": string | null,
      "subjectName": string | null
    }
  ]
}

Rules:
- Use only provided lessons/subjects/classes.
- Keep times valid and non-overlapping for the same teacher.
- Spread classes across the week.
- Do not exceed max slots per day.
- Keep title concise (subject + class + optional lesson focus).
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      temperature: 0.2,
    });
    if (!parsed || typeof parsed !== "object") return null;

    const rowsRaw = Array.isArray(parsed.rows)
      ? parsed.rows
      : Array.isArray(parsed.classes)
        ? parsed.classes
        : [];
    const rows = rowsRaw
      .slice(0, 500)
      .map((item) => ({
        day: normalizeText(item?.day, 20),
        startTime: normalizeText(item?.startTime, 10),
        endTime: normalizeText(item?.endTime, 10),
        title: normalizeText(item?.title, 220),
        room: normalizeText(item?.room, 120) || null,
        instructor:
          normalizeText(item?.instructor, 120) ||
          normalizeText(teacherName, 120) ||
          null,
        className: normalizeText(item?.className, 120) || null,
        subjectName: normalizeText(item?.subjectName, 120) || null,
      }))
      .filter((row) => row.day && row.startTime && row.endTime && row.title);

    if (!rows.length) return null;
    return { rows };
  } catch (error) {
    if (isHardQuotaExhausted(error)) {
      console.warn("Gemini quota exhausted while generating teacher timetable.");
    } else {
      console.error(
        "Gemini teacher timetable generation failed",
        error?.message || error,
      );
    }
    return null;
  }
};

export const analyzeExerciseSubmissionWithGemini = async ({
  subject,
  gradeLevel,
  className,
  exerciseName,
  score,
  weakAreaHint,
  answeredQuestions = [],
}) => {
  if (!isGeminiEnabled()) return null;

  const safeQuestions = Array.isArray(answeredQuestions)
    ? answeredQuestions
        .slice(0, 12)
        .map((item, index) => ({
          index: index + 1,
          type: normalizeText(item?.type || "Question", 40),
          question: normalizeText(item?.question || "", 260),
          studentAnswer: normalizeText(item?.studentAnswer || "", 180),
          correctAnswer: normalizeText(item?.correctAnswer || "", 120),
          isCorrect: Boolean(item?.isCorrect),
        }))
    : [];

  const wrongItems = safeQuestions.filter((item) => !item.isCorrect);
  const wrongSummary =
    wrongItems.length > 0
      ? wrongItems
          .slice(0, 8)
          .map(
            (item) =>
              `Q${item.index} (${item.type}) | Question: ${item.question} | Student: ${item.studentAnswer || "no answer"} | Correct: ${item.correctAnswer || "n/a"}`,
          )
          .join("\n")
      : "No explicit wrong answers captured. Infer from score and context.";

  const prompt = `
You are an education coach for Rwanda basic education.
Analyze this exercise submission and return STRICT JSON only.

Context:
- Subject: ${subject || "General"}
- Grade level: ${gradeLevel || "Unknown"}
- Class: ${className || "Unknown"}
- Exercise: ${exerciseName || "Exercise"}
- Score: ${score ?? "Unknown"}%
- Weak area hint: ${weakAreaHint || "None"}

Incorrect or weak responses:
${wrongSummary}

JSON schema:
{
  "weakArea": string,
  "improvements": string[],
  "feedback": string
}

Rules:
- weakArea must be a specific concept to improve.
- improvements must be 3 to 5 practical steps for the student.
- feedback must be concise, supportive, and actionable.
- Ground analysis in the provided incorrect responses.
`.trim();

  try {
    const parsed = await generateStructuredJson({
      prompt,
      temperature: 0.2,
    });
    if (!parsed || typeof parsed !== "object") return null;

    return {
      weakArea: normalizeText(parsed.weakArea, 160),
      improvements: sanitizeArray(parsed.improvements, 5, 220),
      feedback: normalizeText(parsed.feedback, 1400),
    };
  } catch (error) {
    if (isHardQuotaExhausted(error)) {
      console.warn(
        "Gemini quota exhausted. Falling back to local exercise analysis.",
      );
    } else {
      console.error(
        "Gemini exercise submission analysis failed",
        error?.message || error,
      );
    }
    return null;
  }
};

