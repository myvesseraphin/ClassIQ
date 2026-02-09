import express from "express";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

dotenv.config();

const router = express.Router();

router.use(requireAuth);

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

const getActiveSubjects = async (userId) => {
  const { rows } = await query(
    `SELECT c.name
       FROM student_courses sc
       JOIN courses c ON c.id = sc.course_id
      WHERE sc.user_id = $1
        AND sc.status = 'Active'`,
    [userId],
  );

  return rows.map((row) => row.name).filter(Boolean);
};

router.get("/profile", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.email, u.role,
              p.first_name AS "firstName",
              p.last_name AS "lastName",
              p.student_id AS "studentId",
              p.student_code AS "studentCode",
              p.grade_level AS "gradeLevel",
              p.class_name AS "className",
              p.program,
              p.major,
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
    const [profileResult, statsResult, summaryResult, scoresResult, scheduleResult, tasksResult] =
      await Promise.all([
        query(
          `SELECT p.first_name AS "firstName",
                  p.last_name AS "lastName",
                  p.student_code AS "studentCode",
                  p.student_id AS "studentId",
                  p.grade_level AS "gradeLevel",
                  p.class_name AS "className",
                  p.program,
                  p.major,
                  p.avatar_url AS "avatarUrl"
             FROM user_profiles p
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
          `SELECT label,
                  current_value AS "current",
                  total_value AS "total",
                  percent,
                  sort_order AS "sortOrder"
             FROM student_summary_stats
            WHERE user_id = $1
            ORDER BY sort_order`,
          [userId],
        ),
        query(
          `SELECT term_id AS "termId", score AS "val"
             FROM student_term_scores
            WHERE user_id = $1
            ORDER BY term_id`,
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
      ]);

    const profile = profileResult.rows[0] || {};
    const stats = statsResult.rows[0] || {};
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(" ");

    const schedule = scheduleResult.rows.map((row) => ({
      day: DAY_LABELS[row.dayOfWeek] || `Day ${row.dayOfWeek}`,
      time: formatTimeRange(row.startTime, row.endTime),
      title: row.title,
    }));

    return res.json({
      student: {
        name: fullName,
        id: profile.studentCode || profile.studentId || null,
        major: profile.major || null,
        gradeLevel: profile.gradeLevel || null,
        className: profile.className || null,
        program: profile.program || null,
        image_url: profile.avatarUrl || null,
        currentTerm: stats.currentTerm || null,
        ranking: stats.ranking || null,
        overallPercentage: formatPercent(stats.overallPercentage),
        weakness: stats.weakness || null,
      },
      summary: summaryResult.rows.map((row) => ({
        label: row.label,
        current: row.current,
        total: row.total,
        percent: formatPercent(row.percent),
      })),
      scores: scoresResult.rows.map((row) => ({
        term_id: row.termId,
        val: row.val,
      })),
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
      `SELECT sc.id AS "enrollmentId",
              c.id AS "id",
              c.name,
              c.code,
              c.teacher_name AS "teacher",
              c.schedule,
              c.credits,
              c.category,
              sc.progress,
              sc.status
         FROM student_courses sc
         JOIN courses c ON c.id = sc.course_id
        WHERE sc.user_id = $1
        ORDER BY c.name`,
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

    if (type === "mismatch" && !courseId) {
      return res.status(400).json({ error: "courseId is required." });
    }
    if (courseId && !isUuid(courseId)) {
      return res.status(400).json({ error: "Invalid courseId." });
    }

    if (type === "missing" && !subjectName) {
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
        courseId || null,
        type,
        reason,
        details || null,
        subjectName || null,
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

router.get("/exercises", async (req, res, next) => {
  try {
    const includeQuestions = req.query.includeQuestions === "true";
    const subjects = await getActiveSubjects(req.user.id);
    if (subjects.length === 0) {
      return res.json({ exercises: [] });
    }

    const { rows } = await query(
      `SELECT id, name, subject, difficulty,
              question_count AS "questionCount",
              exercise_date AS "exerciseDate"
         FROM exercises
        WHERE user_id = $1
          AND subject = ANY($2::text[])
        ORDER BY exercise_date DESC`,
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
        questions: includeQuestions ? questionsByExercise[row.id] || [] : undefined,
      })),
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

      const { status, answers } = req.body || {};
      const submissionStatus = status === "in_progress" ? "in_progress" : "submitted";

      const { rows: exerciseRows } = await query(
        `SELECT id, name, subject
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
    if (normalizedAnswers.length > 0) {
      const { rows: questionRows } = await query(
        `SELECT id,
                correct_answer AS "correctAnswer",
                COALESCE(points, 1) AS points
           FROM exercise_questions
          WHERE exercise_id = $1`,
        [exerciseId],
      );

      const normalize = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

      const answerMap = new Map(
        normalizedAnswers
          .filter((ans) => ans.questionId)
          .map((ans) => [String(ans.questionId), ans.answerText]),
      );

      let totalPoints = 0;
      let earnedPoints = 0;

      for (const q of questionRows) {
        if (!q.correctAnswer) continue;
        const points = Number.isFinite(q.points) ? q.points : 1;
        totalPoints += points;
        const submitted = answerMap.get(String(q.id));
        if (submitted === undefined) continue;
        if (normalize(submitted) === normalize(q.correctAnswer)) {
          earnedPoints += points;
        }
      }

      if (totalPoints > 0) {
        score = Math.round((earnedPoints / totalPoints) * 100);
        await query(
          `UPDATE exercise_submissions SET score = $1 WHERE id = $2`,
          [score, submission.id],
        );
      }
    }

    if (submissionStatus === "submitted") {
      if (score !== null) {
        await query(
          `INSERT INTO assessments (
              user_id, title, subject, type,
              assessment_date, status, grade_percent
            )
           VALUES ($1, $2, $3, $4, now(), $5, $6)`,
          [
            req.user.id,
            exercise.name,
            exercise.subject,
            "Exercise",
            "Completed",
            score,
          ],
        );

        await query(
          `UPDATE plp_subjects
              SET progress = COALESCE($3, progress),
                  last_assessment = now()
            WHERE user_id = $1
              AND LOWER(name) = LOWER($2)`,
          [req.user.id, exercise.subject, score],
        );

        await query(
          `INSERT INTO notifications (user_id, title, body)
           VALUES ($1, $2, $3)`,
          [
            req.user.id,
            "Exercise graded",
            `Your exercise "${exercise.name}" was graded. Score: ${score}%.`,
          ],
        );
      }
    }

    return res.status(201).json({ submission: { ...submission, score } });
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
              c.teacher_name AS "teacherName",
              sc.term AS "courseTerm",
              sc.year AS "courseYear"
         FROM exercises e
         LEFT JOIN user_profiles p ON p.user_id = e.user_id
         LEFT JOIN courses c ON c.name = e.subject
         LEFT JOIN student_courses sc
           ON sc.user_id = e.user_id
          AND sc.course_id = c.id
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
              question_type AS "type"
         FROM exercise_questions
        WHERE exercise_id = $1
        ORDER BY question_order`,
      [exerciseId],
    );

    const schoolName = process.env.SCHOOL_NAME || "ClassIQ";
    const academicYear =
      exercise.courseYear || new Date().getFullYear().toString();
    const termLabel = exercise.courseTerm || "N/A";
    const teacherName = exercise.teacherName || "N/A";
    const studentName =
      [exercise.firstName, exercise.lastName].filter(Boolean).join(" ") ||
      "Student";
    const exerciseDate =
      formatShortDate(exercise.exerciseDate) || formatShortDate(new Date());

    const filename = `${sanitizeFilename(exercise.name)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).fillColor("#0f172a").text(schoolName, {
      align: "center",
    });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor("#1f2937").text("Exercise Sheet", {
      align: "center",
    });
    doc.moveDown(0.6);
    doc.fontSize(14).fillColor("#0f172a").text(exercise.name, {
      align: "center",
    });
    doc.moveDown();

    doc.fontSize(10).fillColor("#475569");
    doc.text(`Academic Year: ${academicYear}`);
    doc.text(`Term: ${termLabel}`);
    doc.text(`Date: ${exerciseDate}`);
    doc.text(`Teacher: ${teacherName}`);
    doc.text(`Student: ${studentName}`);
    doc.text(`Subject: ${exercise.subject || "N/A"}`);
    doc.moveDown();

    doc
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown();

    questionRows.forEach((q, idx) => {
      const lines = String(q.text || "").split("\n");
      const mainLine = lines.shift() || "";
      doc
        .fontSize(11)
        .fillColor("#0f172a")
        .text(`${idx + 1}. (${q.type || "Question"}) ${mainLine}`);
      lines.forEach((line) => {
        doc.text(`   ${line.trim()}`);
      });
      doc.moveDown(0.7);
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
        `SELECT topic, level, description AS "desc"
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
        subjectCode: subject.subjectCode,
        name: subject.name,
        category: subject.category,
        status: subject.status,
        progress: subject.progress,
        lastAssessment: formatShortDate(subject.lastAssessment),
        teacher: subject.teacher,
        feedback: subject.feedback,
        weakAreas: weakAreasResult.rows,
        actions: actionsResult.rows.map((row) => row.action),
        tips: tipsResult.rows.map((row) => row.tip),
      },
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
