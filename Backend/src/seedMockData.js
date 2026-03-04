import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import pool, { query } from "./db.js";

dotenv.config();

const SCHOOL_NAME = "ClassIQ Demonstration School";
const SCHOOL_LOCATION = "Kigali, Rwanda";
const DEFAULT_PASSWORD = "ClassIQ@2026";
const DEFAULT_AVATAR = null;

const CLASSES = [
  { gradeLevel: "Year 1", className: "A" },
  { gradeLevel: "Year 1", className: "B" },
  { gradeLevel: "Year 1", className: "C" },
];

const SUBJECTS = [
  { name: "Mathematics", code: "MATH", category: "Core", credits: 5 },
  { name: "Physics", code: "PHYS", category: "Core", credits: 5 },
  { name: "Networking", code: "NET", category: "Core", credits: 4 },
  {
    name: "Fundamentals of Programming",
    code: "FOP",
    category: "Core",
    credits: 5,
  },
  { name: "Javascript", code: "JS", category: "Core", credits: 4 },
  { name: "PHP", code: "PHP", category: "Core", credits: 4 },
  {
    name: "Web User Interface",
    code: "WUI",
    category: "Core",
    credits: 4,
  },
  { name: "Embedded Systems", code: "ESYS", category: "Core", credits: 4 },
  { name: "English", code: "ENG", category: "Core", credits: 3 },
];

const TERMS = [
  {
    name: "Term 1",
    year: 2025,
    startsOn: "2025-09-08",
    endsOn: "2025-12-19",
    isCurrent: false,
  },
  {
    name: "Term 2",
    year: 2026,
    startsOn: "2026-01-05",
    endsOn: "2026-04-03",
    isCurrent: true,
  },
  {
    name: "Term 3",
    year: 2026,
    startsOn: "2026-04-20",
    endsOn: "2026-07-03",
    isCurrent: false,
  },
];

const TEACHERS = [
  {
    firstName: "Niyonkuru",
    lastName: "Aline",
    email: "teacher.math@classiq.local",
    subject: "Mathematics",
    staffNumber: "TR-001",
    department: "Sciences",
  },
  {
    firstName: "Uwimana",
    lastName: "Didier",
    email: "teacher.physics@classiq.local",
    subject: "Physics",
    staffNumber: "TR-002",
    department: "Sciences",
  },
  {
    firstName: "Munyaneza",
    lastName: "Yvette",
    email: "teacher.networking@classiq.local",
    subject: "Networking",
    staffNumber: "TR-003",
    department: "ICT",
  },
  {
    firstName: "Ingabire",
    lastName: "Pacifique",
    email: " ",
    subject: "Fundamentals of Programming",
    staffNumber: "TR-004",
    department: "ICT",
  },
  {
    firstName: "Nshimiyimana",
    lastName: "Claude",
    email: "teacher.javascript@classiq.local",
    subject: "Javascript",
    staffNumber: "TR-005",
    department: "ICT",
  },
  {
    firstName: "Mukamana",
    lastName: "Odette",
    email: "teacher.php@classiq.local",
    subject: "PHP",
    staffNumber: "TR-006",
    department: "ICT",
  },
  {
    firstName: "Hategekimana",
    lastName: "Aimable",
    email: "teacher.wui@classiq.local",
    subject: "Web User Interface",
    staffNumber: "TR-007",
    department: "ICT",
  },
  {
    firstName: "Nyiransabimana",
    lastName: "Belange",
    email: "teacher.embedded@classiq.local",
    subject: "Embedded Systems",
    staffNumber: "TR-008",
    department: "ICT",
  },
  {
    firstName: "Uwayezu",
    lastName: "Emmanuel",
    email: "teacher.english@classiq.local",
    subject: "English",
    staffNumber: "TR-009",
    department: "Languages",
  },
];

const STUDENT_FIRST_NAMES = [
  "Aimee",
  "Ange",
  "Ariane",
  "Benigne",
  "Blaise",
  "Cedric",
  "Clarisse",
  "Diane",
  "Eric",
  "Fabrice",
  "Fiona",
  "Ganza",
  "Gisele",
  "Honorine",
  "Ineza",
  "Jean",
  "Joyeuse",
  "Kevin",
  "Lauriane",
  "Merveille",
  "Nadine",
  "Odile",
  "Patient",
  "Rachel",
  "Samuel",
  "Sandrine",
  "Thierry",
  "Umutoni",
  "Vestine",
  "Yvonne",
];

const STUDENT_LAST_NAMES = [
  "Ndayisaba",
  "Niyonzima",
  "Uwase",
  "Iradukunda",
  "Hakizimana",
  "Murekatete",
  "Nyirahabimana",
  "Ntakirutimana",
  "Niyigena",
  "Mutoni",
  "Ishimwe",
  "Munyakazi",
  "Uwamahoro",
  "Bizimana",
  "Nkurunziza",
  "Umutesi",
  "Mugisha",
  "Mukeshimana",
  "Habimana",
  "Nshimiyimana",
];

const toClassKey = ({ gradeLevel, className }) =>
  `${gradeLevel} ${className}`.trim();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const tableColumnsCache = new Map();

const getTableColumns = async (tableName) => {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName);
  }
  const { rows } = await query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1`,
    [tableName],
  );
  const columns = new Set(rows.map((row) => row.column_name));
  tableColumnsCache.set(tableName, columns);
  return columns;
};

const upsertByUserId = async (tableName, valuesByColumn, timestampColumn = null) => {
  const columns = await getTableColumns(tableName);
  const insertColumns = [];
  const insertValues = [];

  Object.entries(valuesByColumn).forEach(([column, value]) => {
    if (!columns.has(column)) return;
    insertColumns.push(column);
    insertValues.push(value);
  });

  if (!insertColumns.includes("user_id")) return;

  const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(", ");
  const updateSet = insertColumns
    .filter((column) => column !== "user_id")
    .map((column) => `${column} = EXCLUDED.${column}`);

  if (timestampColumn && columns.has(timestampColumn)) {
    updateSet.push(`${timestampColumn} = now()`);
  }

  const conflictClause =
    updateSet.length > 0
      ? `DO UPDATE SET ${updateSet.join(", ")}`
      : "DO NOTHING";

  await query(
    `INSERT INTO ${tableName} (${insertColumns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (user_id) ${conflictClause}`,
    insertValues,
  );
};

const pickWeakArea = (subject, scorePercent) => {
  const normalized = String(subject || "").toLowerCase();
  if (scorePercent >= 80) return `${subject} advanced challenge`;
  if (normalized.includes("math")) return "algebraic reasoning";
  if (normalized.includes("physics")) return "forces and motion";
  if (normalized.includes("network")) return "network topology mapping";
  if (normalized.includes("programming")) return "algorithm tracing";
  if (normalized.includes("javascript")) return "DOM and events";
  if (normalized.includes("php")) return "server-side form handling";
  if (normalized.includes("web user interface")) return "responsive layout";
  if (normalized.includes("embedded")) return "microcontroller timing";
  if (normalized.includes("english")) return "reading comprehension";
  return "core concept understanding";
};

const buildAssessmentType = (subjectIndex) => {
  if (subjectIndex % 3 === 0) return "Quiz";
  if (subjectIndex % 3 === 1) return "CAT";
  return "Project";
};

const buildAssessmentDate = (term, offsetSeed) => {
  const start = new Date(term.startsOn);
  const end = new Date(term.endsOn);
  const totalDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const offset = offsetSeed % totalDays;
  const date = new Date(start);
  date.setDate(start.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const upsertUser = async ({
  email,
  passwordHash,
  role,
  firstName,
  lastName,
  schoolId,
  profile = {},
}) => {
  const insertedUser = await query(
    `INSERT INTO users (email, password_hash, role, email_verified)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [email, passwordHash, role],
  );
  const userId = insertedUser.rows[0].id;

  await upsertByUserId(
    "user_profiles",
    {
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      avatar_url: DEFAULT_AVATAR,
      school_name: SCHOOL_NAME,
      school_id: schoolId,
      student_id: profile.studentId || null,
      student_code: profile.studentCode || null,
      grade_level: profile.gradeLevel || null,
      class_name: profile.className || null,
      class_id: profile.classId || null,
      program: SCHOOL_NAME,
      major: profile.major || "Software Development",
      phone: profile.phone || null,
      staff_number: profile.staffNumber || null,
      nid: profile.nid || null,
      department: profile.department || null,
      subjects: profile.subjects || null,
      experience: profile.experience || null,
      location: SCHOOL_LOCATION,
      certifications: profile.certifications || null,
    },
    "updated_at",
  );

  await query(
    `INSERT INTO user_settings (user_id, notifications_enabled, auto_sync)
     VALUES ($1, true, true)
     ON CONFLICT (user_id)
     DO UPDATE SET
       notifications_enabled = EXCLUDED.notifications_enabled,
       auto_sync = EXCLUDED.auto_sync,
       updated_at = now()`,
    [userId],
  );

  return userId;
};

const upsertTeacherProfile = async ({
  userId,
  staffNumber,
  department,
  subject,
}) => {
  await upsertByUserId(
    "teacher_profiles",
    {
      user_id: userId,
      staff_number: staffNumber,
      nid: null,
      department,
      subjects: subject,
      experience: "5 years",
      location: SCHOOL_LOCATION,
      certifications: "REB Pedagogy",
    },
    "updated_at",
  );
};

const upsertStudentProfile = async ({
  userId,
  studentId,
  studentCode,
  gradeLevel,
  classId,
}) => {
  await upsertByUserId(
    "student_profiles",
    {
      user_id: userId,
      student_id: studentId,
      student_code: studentCode,
      grade_level: gradeLevel,
      class_id: classId,
      program: SCHOOL_NAME,
      major: "Software Development",
    },
    "updated_at",
  );
};

const seed = async () => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  try {
    await query("BEGIN");

    const schoolRes = await query(
      `INSERT INTO schools (name, location)
       VALUES ($1, $2)
       ON CONFLICT (name)
       DO UPDATE SET location = EXCLUDED.location
       RETURNING id`,
      [SCHOOL_NAME, SCHOOL_LOCATION],
    );
    const schoolId = schoolRes.rows[0].id;

    await query(`UPDATE terms SET is_current = false WHERE school_id = $1`, [
      schoolId,
    ]);

    const termMap = new Map();
    for (const term of TERMS) {
      const termResult = await query(
        `INSERT INTO terms (school_id, name, year, starts_on, ends_on, is_current)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (school_id, name, year)
         DO UPDATE SET
           starts_on = EXCLUDED.starts_on,
           ends_on = EXCLUDED.ends_on,
           is_current = EXCLUDED.is_current
         RETURNING id, name, year, starts_on AS "startsOn", ends_on AS "endsOn", is_current AS "isCurrent"`,
        [
          schoolId,
          term.name,
          term.year,
          term.startsOn,
          term.endsOn,
          term.isCurrent,
        ],
      );
      termMap.set(`${term.name}-${term.year}`, termResult.rows[0]);
    }

    const subjectMap = new Map();
    for (const subject of SUBJECTS) {
      const subjectResult = await query(
        `INSERT INTO subjects (name, code, category, credits)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name)
         DO UPDATE SET
           code = EXCLUDED.code,
           category = EXCLUDED.category,
           credits = EXCLUDED.credits
         RETURNING id, name`,
        [subject.name, subject.code, subject.category, subject.credits],
      );
      subjectMap.set(subject.name, subjectResult.rows[0].id);
    }

    const classMap = new Map();
    for (const classItem of CLASSES) {
      const classRes = await query(
        `INSERT INTO classes (grade_level, class_name, school_name, school_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (grade_level, class_name, school_id)
         DO UPDATE SET school_name = EXCLUDED.school_name
         RETURNING id, grade_level AS "gradeLevel", class_name AS "className"`,
        [classItem.gradeLevel, classItem.className, SCHOOL_NAME, schoolId],
      );
      classMap.set(toClassKey(classItem), classRes.rows[0]);
    }

    await query(`DELETE FROM users WHERE email LIKE '%@classiq.local'`);

    const adminId = await upsertUser({
      email: "admin@classiq.local",
      passwordHash,
      role: "admin",
      firstName: "Ndaruhutse",
      lastName: "Admin",
      schoolId,
      profile: {
        department: "Administration",
        phone: "+250788100001",
      },
    });

    const teacherMap = new Map();
    for (const teacher of TEACHERS) {
      const teacherId = await upsertUser({
        email: teacher.email,
        passwordHash,
        role: "teacher",
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        schoolId,
        profile: {
          staffNumber: teacher.staffNumber,
          department: teacher.department,
          subjects: teacher.subject,
          experience: "5 years",
          phone: `+25078810${teacher.staffNumber.slice(-3)}`,
          certifications: "REB Pedagogy",
        },
      });

      await upsertTeacherProfile({
        userId: teacherId,
        staffNumber: teacher.staffNumber,
        department: teacher.department,
        subject: teacher.subject,
      });

      teacherMap.set(teacher.subject, {
        id: teacherId,
        name: `${teacher.firstName} ${teacher.lastName}`,
      });
    }

    await query(`DELETE FROM teacher_assignments WHERE teacher_id = ANY(
      SELECT id FROM users WHERE email LIKE 'teacher.%@classiq.local'
    )`);

    const assignmentMap = new Map();
    for (const classItem of CLASSES) {
      const classRow = classMap.get(toClassKey(classItem));
      for (const subject of SUBJECTS) {
        const teacher = teacherMap.get(subject.name);
        const subjectId = subjectMap.get(subject.name);
        if (!teacher || !subjectId) continue;
        const assignmentRes = await query(
          `INSERT INTO teacher_assignments (
            teacher_id,
            grade_level,
            class_name,
            subject,
            is_primary_class,
            class_id,
            subject_id
          )
          VALUES ($1, $2, $3, $4, false, $5, $6)
          RETURNING id`,
          [
            teacher.id,
            classItem.gradeLevel,
            classItem.className,
            subject.name,
            classRow.id,
            subjectId,
          ],
        );
        assignmentMap.set(`${classRow.id}:${subjectId}`, {
          assignmentId: assignmentRes.rows[0].id,
          teacherId: teacher.id,
          teacherName: teacher.name,
        });
      }
    }

    const students = [];
    for (const classItem of CLASSES) {
      const classKey = toClassKey(classItem);
      const classRow = classMap.get(classKey);
      const classCode = classItem.className;
      for (let i = 1; i <= 20; i += 1) {
        const seedIndex = i + classCode.charCodeAt(0);
        const firstName = STUDENT_FIRST_NAMES[seedIndex % STUDENT_FIRST_NAMES.length];
        const lastName =
          STUDENT_LAST_NAMES[(seedIndex * 3) % STUDENT_LAST_NAMES.length];
        const studentCode = `Y1${classCode}${String(i).padStart(3, "0")}`;
        const studentEmail =
          `student.y1${classCode.toLowerCase()}${String(i).padStart(2, "0")}@classiq.local`;

        const studentId = await upsertUser({
          email: studentEmail,
          passwordHash,
          role: "student",
          firstName,
          lastName,
          schoolId,
          profile: {
            studentId: `STD-${studentCode}`,
            studentCode,
            gradeLevel: classItem.gradeLevel,
            className: classItem.className,
            classId: classRow.id,
            phone: `+250790${String(100000 + seedIndex).slice(-6)}`,
            major: "Software Development",
          },
        });

        await upsertStudentProfile({
          userId: studentId,
          studentId: `STD-${studentCode}`,
          studentCode,
          gradeLevel: classItem.gradeLevel,
          classId: classRow.id,
        });

        await query(
          `INSERT INTO student_class_enrollments (student_id, class_id, is_current, term, year)
           VALUES ($1, $2, true, $3, $4)
           ON CONFLICT DO NOTHING`,
          [studentId, classRow.id, "Term 2", 2026],
        );

        students.push({
          id: studentId,
          email: studentEmail,
          firstName,
          lastName,
          classId: classRow.id,
          className: classItem.className,
          gradeLevel: classItem.gradeLevel,
          index: i,
        });
      }
    }

    await query(
      `DELETE FROM student_subject_enrollments
       WHERE student_id = ANY(
         SELECT id FROM users WHERE email LIKE 'student.%@classiq.local'
       )`,
    );

    for (const student of students) {
      for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex += 1) {
        const subject = SUBJECTS[subjectIndex];
        const subjectId = subjectMap.get(subject.name);
        const assignment =
          assignmentMap.get(`${student.classId}:${subjectId}`) || null;
        const progress = clamp(
          35 + ((student.index * 9 + subjectIndex * 11) % 66),
          0,
          100,
        );
        const status =
          progress >= 85 ? "Completed" : progress >= 45 ? "Active" : "Pending";

        await query(
          `INSERT INTO student_subject_enrollments (
            student_id,
            subject_id,
            class_id,
            teacher_id,
            status,
            progress,
            term,
            year
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            student.id,
            subjectId,
            student.classId,
            assignment?.teacherId || null,
            status,
            progress,
            "Term 2",
            2026,
          ],
        );
      }
    }

    await query(
      `DELETE FROM assessments
       WHERE user_id = ANY(
         SELECT id FROM users WHERE email LIKE 'student.%@classiq.local'
       )`,
    );

    const assessmentTerms = TERMS;
    for (const student of students) {
      for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex += 1) {
        const subject = SUBJECTS[subjectIndex];
        const subjectId = subjectMap.get(subject.name);
        const term = assessmentTerms[subjectIndex % assessmentTerms.length];
        const termRow = termMap.get(`${term.name}-${term.year}`);
        const assignment =
          assignmentMap.get(`${student.classId}:${subjectId}`) || null;

        const seedValue = student.index * 17 + subjectIndex * 13 + term.year;
        const scoreTotal = 100;
        const rawScore = seedValue % 101;
        const inProgress = seedValue % 7 === 0;
        const scoreObtained = inProgress ? null : rawScore;
        const gradePercent = inProgress ? null : rawScore;
        const predictedPercent = inProgress
          ? clamp(45 + (seedValue % 40), 0, 100)
          : clamp(rawScore + ((seedValue % 9) - 4), 0, 100);
        const weakArea = pickWeakArea(subject.name, rawScore);
        const status = inProgress ? "In Progress" : "Completed";
        const assessmentDate = buildAssessmentDate(term, seedValue);

        await query(
          `INSERT INTO assessments (
            user_id,
            student_id,
            teacher_id,
            subject_id,
            term_id,
            title,
            subject,
            type,
            assessment_date,
            status,
            score_obtained,
            score_total,
            grade_percent,
            predicted_percent,
            weak_area,
            ai_feedback
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16
          )`,
          [
            student.id,
            student.id,
            assignment?.teacherId || null,
            subjectId,
            termRow?.id || null,
            `${subject.name} ${term.name} Assessment`,
            subject.name,
            buildAssessmentType(subjectIndex),
            assessmentDate,
            status,
            scoreObtained,
            scoreTotal,
            gradePercent,
            predictedPercent,
            weakArea,
            inProgress
              ? `Assessment still in progress for ${subject.name}.`
              : `Performance in ${subject.name}: ${rawScore}%. Focus area: ${weakArea}.`,
          ],
        );
      }
    }

    await query(
      `DELETE FROM class_subject_lessons
       WHERE class_id = ANY(
         SELECT id FROM classes WHERE school_id = $1
       )`,
      [schoolId],
    );

    for (const classItem of CLASSES) {
      const classRow = classMap.get(toClassKey(classItem));
      for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex += 1) {
        const subject = SUBJECTS[subjectIndex];
        const subjectId = subjectMap.get(subject.name);
        const assignment = assignmentMap.get(`${classRow.id}:${subjectId}`);
        await query(
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
            effective_date
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_DATE
          )`,
          [
            classRow.id,
            subjectId,
            assignment?.teacherId || null,
            adminId,
            `Unit ${Math.floor(subjectIndex / 3) + 1}`,
            subjectIndex + 1,
            `${subject.name} foundational concepts`,
            1 + subjectIndex * 2,
            10 + subjectIndex * 2,
            "Term 2",
            (subjectIndex % 12) + 1,
            "Seeded lesson-progress mock content",
          ],
        );
      }
    }

    await query(`DELETE FROM audit_logs WHERE action LIKE 'mock_%'`);

    const usersForLogs = [
      adminId,
      ...Array.from(teacherMap.values()).map((teacher) => teacher.id),
      ...students.slice(0, 24).map((student) => student.id),
    ];
    const auditActions = [
      "mock_login_success",
      "mock_assessment_created",
      "mock_profile_update",
      "mock_resource_viewed",
      "mock_lesson_progress_updated",
      "mock_notification_read",
    ];

    for (let i = 0; i < 120; i += 1) {
      const action = auditActions[i % auditActions.length];
      const userId = usersForLogs[i % usersForLogs.length];
      await query(
        `INSERT INTO audit_logs (user_id, action, context, ip, user_agent, created_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now() - ($6::int * interval '1 hour'))`,
        [
          userId,
          action,
          JSON.stringify({
            module: "mock-seeder",
            status: "success",
            serial: i + 1,
          }),
          `192.168.1.${(i % 200) + 10}`,
          "MockDataSeeder/1.0",
          i,
        ],
      );
    }

    await query(
      `INSERT INTO notifications (user_id, title, body)
       SELECT id,
              'Mock data loaded',
              'ClassIQ demo data is now available for your role view.'
         FROM users
        WHERE email LIKE '%@classiq.local'`,
    );

    await query("COMMIT");

    console.log("Mock data seed complete.");
    console.log("Login credentials (all accounts use same password):");
    console.log(`Password: ${DEFAULT_PASSWORD}`);
    console.log("Admin: admin@classiq.local");
    console.log("Teachers: teacher.<subject>@classiq.local");
    console.log("Students pattern: student.y1[a|b|c]NN@classiq.local (NN = 01..20)");
    console.log("Example students:");
    console.log(" - student.y1a01@classiq.local");
    console.log(" - student.y1b01@classiq.local");
    console.log(" - student.y1c01@classiq.local");
  } catch (error) {
    await query("ROLLBACK");
    console.error("Mock seed failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

seed();
