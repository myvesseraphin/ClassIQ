import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const KEY_ENV_PREFIX = "GEMINI_API_KEY_";

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

const apiKeys = collectGeminiApiKeys();
if (apiKeys.length === 0) {
  throw new Error(
    "Set GEMINI_API_KEY (or GEMINI_API_KEYS / GEMINI_API_KEY_1...) in Backend/.env before running script.js",
  );
}

const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const isRateLimitError = (error) => {
  const text = String(error?.message || error || "").toLowerCase();
  const status =
    Number(error?.status) ||
    Number(error?.statusCode) ||
    Number(error?.response?.status);
  return (
    status === 429 ||
    text.includes("429") ||
    text.includes("too many requests") ||
    text.includes("resource_exhausted") ||
    text.includes("quota")
  );
};

const generateWithRotatingKeys = async (prompt) => {
  let lastError = null;

  for (let index = 0; index < apiKeys.length; index += 1) {
    const apiKey = apiKeys[index];
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    try {
      return await model.generateContent(prompt);
    } catch (error) {
      lastError = error;
      if (index >= apiKeys.length - 1) break;
      if (isRateLimitError(error)) continue;
      continue;
    }
  }

  throw lastError || new Error("Gemini request failed for all configured API keys.");
};

async function runAnalysis() {
  const prompt =
    "ClassIQ Analysis: Provide a minimal, text-based summary of performance weaknesses for a student.";

  try {
    const result = await generateWithRotatingKeys(prompt);
    const response = result.response;
    console.log("--- ClassIQ Intelligence ---");
    console.log(response.text());
  } catch (error) {
    console.error("Analysis Error:", error.message);
  }
}

runAnalysis();

