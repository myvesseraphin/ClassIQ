-- ClassIQ Supabase schema (consolidated)
-- Run in Supabase SQL editor. Safe to re-run where possible.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Core entities
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  email_verified boolean NOT NULL DEFAULT false,
  token_version integer NOT NULL DEFAULT 0
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  year integer NOT NULL,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS terms_unique_idx
  ON terms (school_id, name, year);

CREATE UNIQUE INDEX IF NOT EXISTS terms_current_unique_idx
  ON terms (school_id)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level text NOT NULL,
  class_name text NOT NULL,
  school_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  school_id uuid REFERENCES schools(id)
);

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id);

CREATE UNIQUE INDEX IF NOT EXISTS classes_unique_idx
  ON classes(grade_level, class_name, school_id);

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  code text UNIQUE,
  category text CHECK (category IN ('Core', 'Elective')) DEFAULT 'Core',
  credits integer
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  student_id text,
  student_code text,
  grade_level text,
  class_name text,
  program text,
  major text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  phone text,
  staff_number text,
  nid text,
  school_name text,
  department text,
  subjects text,
  experience text,
  location text,
  certifications text,
  class_id uuid REFERENCES classes(id),
  school_id uuid REFERENCES schools(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_key
  ON user_profiles(user_id);

CREATE INDEX IF NOT EXISTS user_profiles_class_idx
  ON user_profiles(class_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notifications_enabled boolean NOT NULL DEFAULT true,
  auto_sync boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  academic_year text,
  terms text,
  grading_scale text,
  role_permissions text,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_id text,
  student_code text,
  grade_level text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  program text,
  major text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  staff_number text,
  nid text,
  department text,
  subjects text,
  experience text,
  location text,
  certifications text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grade_level text NOT NULL,
  class_name text NOT NULL,
  subject text NOT NULL,
  is_primary_class boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS teacher_assignments_class_idx
  ON teacher_assignments(class_id);

CREATE INDEX IF NOT EXISTS teacher_assignments_subject_idx
  ON teacher_assignments(subject_id);

CREATE TABLE IF NOT EXISTS student_class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT true,
  term text,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_subject_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Pending', 'Completed')),
  progress integer NOT NULL DEFAULT 0,
  term text,
  year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_subject_enrollments_student_idx
  ON student_subject_enrollments(student_id);

CREATE INDEX IF NOT EXISTS student_subject_enrollments_subject_idx
  ON student_subject_enrollments(subject_id);

CREATE INDEX IF NOT EXISTS student_subject_enrollments_class_idx
  ON student_subject_enrollments(class_id);

-- ============================================================
-- Access + notifications + tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  school text NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS access_requests_school_id_idx
  ON access_requests(school_id);

CREATE INDEX IF NOT EXISTS schools_name_lower_idx
  ON schools (lower(name));

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  priority text CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schedule_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  title text NOT NULL,
  room text,
  instructor text,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedule_classes
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE schedule_classes
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS schedule_classes_user_day_idx
  ON schedule_classes(user_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS schedule_classes_class_day_idx
  ON schedule_classes(class_id, day_of_week, start_time);

-- ============================================================
-- Learning content
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  file_type text,
  file_size text,
  resource_date date,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  bucket text DEFAULT 'Books',
  file_path text,
  levels text[],
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS resources_levels_idx
  ON resources USING GIN (levels);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  difficulty text,
  question_count integer,
  exercise_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  assigned_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assignment_origin text
);

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS assigned_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS assignment_origin text;

CREATE INDEX IF NOT EXISTS exercises_assigned_by_teacher_idx
  ON exercises(assigned_by_teacher_id);

CREATE TABLE IF NOT EXISTS exercise_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  question_order integer NOT NULL,
  question_text text NOT NULL,
  question_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  correct_answer text,
  points integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercise_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('in_progress', 'submitted')) DEFAULT 'submitted',
  score integer,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS exercise_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES exercise_submissions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES exercise_questions(id) ON DELETE CASCADE,
  answer_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  teacher_score numeric,
  teacher_feedback text,
  reviewed_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

ALTER TABLE exercise_answers
  ADD COLUMN IF NOT EXISTS teacher_score numeric;
ALTER TABLE exercise_answers
  ADD COLUMN IF NOT EXISTS teacher_feedback text;
ALTER TABLE exercise_answers
  ADD COLUMN IF NOT EXISTS reviewed_by_teacher_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exercise_answers
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS exercise_answers_reviewed_by_teacher_idx
  ON exercise_answers(reviewed_by_teacher_id);

DELETE FROM exercise_submissions older
USING exercise_submissions newer
WHERE older.user_id = newer.user_id
  AND older.exercise_id = newer.exercise_id
  AND (
    older.created_at < newer.created_at
    OR (older.created_at = newer.created_at AND older.id::text < newer.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS exercise_submissions_user_exercise_unique_idx
  ON exercise_submissions(user_id, exercise_id);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  type text,
  assessment_date date,
  status text CHECK (status IN ('Completed', 'In Progress')),
  grade_percent integer,
  predicted_percent integer,
  weak_area text,
  ai_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  student_id uuid REFERENCES users(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  score_obtained integer,
  score_total integer
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_score_total_check'
  ) THEN
    ALTER TABLE assessments
      ADD CONSTRAINT assessments_score_total_check
      CHECK (score_total IS NULL OR score_total > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_score_obtained_check'
  ) THEN
    ALTER TABLE assessments
      ADD CONSTRAINT assessments_score_obtained_check
      CHECK (score_obtained IS NULL OR score_obtained >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plp_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_code text,
  name text NOT NULL,
  category text,
  status text,
  progress integer,
  last_assessment date,
  teacher_name text,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS plp_weak_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plp_subject_id uuid NOT NULL REFERENCES plp_subjects(id) ON DELETE CASCADE,
  topic text NOT NULL,
  level text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plp_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plp_subject_id uuid NOT NULL REFERENCES plp_subjects(id) ON DELETE CASCADE,
  action_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plp_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plp_subject_id uuid NOT NULL REFERENCES plp_subjects(id) ON DELETE CASCADE,
  tip_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Support + audit
-- ============================================================
CREATE TABLE IF NOT EXISTS course_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid,
  type text NOT NULL CHECK (type IN ('mismatch', 'missing')),
  reason text NOT NULL,
  details text,
  subject_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  attachment_url text,
  attachment_name text
);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  context jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_subject_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  unit_title text,
  lesson_number integer,
  topic text NOT NULL,
  page_from integer,
  page_to integer,
  term text,
  week_number integer,
  notes text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id)
);

CREATE INDEX IF NOT EXISTS class_subject_lessons_class_idx
  ON class_subject_lessons(class_id);

CREATE INDEX IF NOT EXISTS class_subject_lessons_subject_idx
  ON class_subject_lessons(subject_id);

CREATE INDEX IF NOT EXISTS class_subject_lessons_effective_date_idx
  ON class_subject_lessons(effective_date DESC);

CREATE TABLE IF NOT EXISTS student_subject_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic text NOT NULL,
  source text NOT NULL DEFAULT 'student' CHECK (source IN ('student', 'teacher', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id)
);

CREATE INDEX IF NOT EXISTS student_subject_focus_student_idx
  ON student_subject_focus(student_id);

CREATE INDEX IF NOT EXISTS student_subject_focus_subject_idx
  ON student_subject_focus(subject_id);

-- ============================================================
-- Backfills + normalization
-- ============================================================
UPDATE user_profiles
  SET school_name = program
WHERE school_name IS NULL
  AND program IS NOT NULL;

INSERT INTO schools (name)
SELECT DISTINCT school_name
FROM user_profiles
WHERE school_name IS NOT NULL
UNION
SELECT DISTINCT school_name
FROM classes
WHERE school_name IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE user_profiles p
SET school_id = s.id
FROM schools s
WHERE p.school_id IS NULL
  AND p.school_name IS NOT NULL
  AND lower(p.school_name) = lower(s.name);

UPDATE classes c
SET school_id = s.id
FROM schools s
WHERE c.school_id IS NULL
  AND c.school_name IS NOT NULL
  AND lower(c.school_name) = lower(s.name);

INSERT INTO classes (grade_level, class_name, school_name, school_id)
SELECT DISTINCT p.grade_level, p.class_name, p.school_name, p.school_id
FROM user_profiles p
WHERE p.grade_level IS NOT NULL AND p.class_name IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE user_profiles p
SET class_id = c.id
FROM classes c
WHERE p.class_id IS NULL
  AND p.grade_level = c.grade_level
  AND p.class_name = c.class_name
  AND COALESCE(p.school_id, '00000000-0000-0000-0000-000000000000') =
      COALESCE(c.school_id, '00000000-0000-0000-0000-000000000000');

INSERT INTO student_class_enrollments (student_id, class_id, is_current)
SELECT u.id, p.class_id, true
FROM users u
JOIN user_profiles p ON p.user_id = u.id
WHERE u.role = 'student'
  AND p.class_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO subjects (name)
SELECT DISTINCT subject
FROM teacher_assignments
WHERE subject IS NOT NULL
UNION
SELECT DISTINCT subject
FROM assessments
WHERE subject IS NOT NULL
UNION
SELECT DISTINCT subject
FROM exercises
WHERE subject IS NOT NULL
UNION
SELECT DISTINCT subject
FROM resources
WHERE subject IS NOT NULL
UNION
SELECT DISTINCT name
FROM plp_subjects
WHERE name IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE teacher_assignments ta
SET subject_id = s.id
FROM subjects s
WHERE ta.subject_id IS NULL
  AND ta.subject IS NOT NULL
  AND lower(ta.subject) = lower(s.name);

UPDATE teacher_assignments ta
SET class_id = c.id
FROM classes c
WHERE ta.class_id IS NULL
  AND ta.grade_level = c.grade_level
  AND ta.class_name = c.class_name;

UPDATE assessments a
SET subject_id = s.id
FROM subjects s
WHERE a.subject_id IS NULL
  AND a.subject IS NOT NULL
  AND lower(a.subject) = lower(s.name);

UPDATE assessments
SET student_id = user_id
WHERE student_id IS NULL;

UPDATE exercises e
SET subject_id = s.id
FROM subjects s
WHERE e.subject_id IS NULL
  AND e.subject IS NOT NULL
  AND lower(e.subject) = lower(s.name);

UPDATE resources r
SET subject_id = s.id
FROM subjects s
WHERE r.subject_id IS NULL
  AND r.subject IS NOT NULL
  AND lower(r.subject) = lower(s.name);

UPDATE plp_subjects p
SET subject_id = s.id
FROM subjects s
WHERE p.subject_id IS NULL
  AND p.name IS NOT NULL
  AND lower(p.name) = lower(s.name);

UPDATE access_requests ar
SET school_id = s.id
FROM schools s
WHERE ar.school_id IS NULL
  AND ar.school IS NOT NULL
  AND lower(ar.school) = lower(s.name);

UPDATE access_requests ar
SET school = s.name
FROM schools s
WHERE ar.school_id = s.id
  AND (ar.school IS NULL OR ar.school <> s.name);

-- ============================================================
-- Assessment automation
-- ============================================================
CREATE OR REPLACE FUNCTION set_assessment_grade_percent()
RETURNS trigger AS $$
BEGIN
  IF NEW.score_obtained IS NOT NULL AND NEW.score_total IS NOT NULL AND NEW.score_total > 0 THEN
    NEW.grade_percent := ROUND((NEW.score_obtained::numeric / NEW.score_total::numeric) * 100);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_assessment_grade_percent_trigger ON assessments;
CREATE TRIGGER set_assessment_grade_percent_trigger
BEFORE INSERT OR UPDATE OF score_obtained, score_total
ON assessments
FOR EACH ROW EXECUTE FUNCTION set_assessment_grade_percent();

CREATE OR REPLACE FUNCTION set_assessment_term_id()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
  v_term_id uuid;
BEGIN
  IF NEW.term_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT school_id INTO v_school_id
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  IF v_school_id IS NULL OR NEW.assessment_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO v_term_id
  FROM terms t
  WHERE t.school_id = v_school_id
    AND NEW.assessment_date BETWEEN t.starts_on AND t.ends_on
  ORDER BY t.starts_on DESC
  LIMIT 1;

  NEW.term_id := v_term_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_assessment_term_id_trigger ON assessments;
CREATE TRIGGER set_assessment_term_id_trigger
BEFORE INSERT OR UPDATE OF assessment_date, user_id
ON assessments
FOR EACH ROW EXECUTE FUNCTION set_assessment_term_id();

UPDATE assessments a
SET term_id = t.id
FROM user_profiles p
JOIN terms t ON t.school_id = p.school_id
WHERE a.term_id IS NULL
  AND a.assessment_date IS NOT NULL
  AND p.user_id = a.user_id
  AND a.assessment_date BETWEEN t.starts_on AND t.ends_on;

UPDATE assessments
SET grade_percent = ROUND((score_obtained::numeric / score_total::numeric) * 100)
WHERE grade_percent IS NULL
  AND score_obtained IS NOT NULL
  AND score_total IS NOT NULL
  AND score_total > 0;

-- ============================================================
-- Views
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'student_summary_stats'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'student_summary_stats_legacy'
    ) THEN
      EXECUTE 'ALTER TABLE student_summary_stats RENAME TO student_summary_stats_legacy';
    END IF;
  END IF;
END $$;

CREATE OR REPLACE VIEW student_summary_stats AS
SELECT stats.user_id,
       stats.label,
       stats.current_value,
       stats.total_value,
       CASE WHEN stats.total_value = 0 THEN 0
            ELSE round((stats.current_value::numeric / stats.total_value::numeric) * 100)
       END AS percent,
       stats.sort_order
FROM (
  SELECT u.id AS user_id,
         'Subjects' AS label,
         COUNT(sse.id) FILTER (WHERE sse.status IN ('Active', 'Completed')) AS current_value,
         COUNT(sse.id) AS total_value,
         1 AS sort_order
    FROM users u
    LEFT JOIN student_subject_enrollments sse ON sse.student_id = u.id
   WHERE u.role = 'student'
   GROUP BY u.id

  UNION ALL
  SELECT u.id,
         'Assessments',
         COUNT(a.id) FILTER (WHERE a.status = 'Completed') AS current_value,
         COUNT(a.id) AS total_value,
         2
    FROM users u
    LEFT JOIN assessments a
      ON COALESCE(a.student_id, a.user_id) = u.id
   WHERE u.role = 'student'
   GROUP BY u.id

  UNION ALL
  SELECT u.id,
         'Exercises',
         COUNT(es.id) FILTER (WHERE es.status = 'submitted') AS current_value,
         COUNT(es.id) AS total_value,
         3
    FROM users u
    LEFT JOIN exercise_submissions es ON es.user_id = u.id
   WHERE u.role = 'student'
   GROUP BY u.id

  UNION ALL
  SELECT u.id,
         'Tasks',
         COUNT(t.id) FILTER (WHERE t.completed) AS current_value,
         COUNT(t.id) AS total_value,
         4
    FROM users u
    LEFT JOIN tasks t ON t.user_id = u.id
   WHERE u.role = 'student'
   GROUP BY u.id
) stats;

CREATE OR REPLACE VIEW student_teacher_links AS
SELECT DISTINCT sse.student_id,
       ta.teacher_id,
       sse.class_id,
       sse.subject_id
FROM student_subject_enrollments sse
JOIN teacher_assignments ta
  ON ta.class_id = sse.class_id
 AND ta.subject_id = sse.subject_id;

CREATE OR REPLACE VIEW student_term_scores_calc AS
SELECT a.user_id,
       a.term_id,
       AVG(a.grade_percent)::int AS score
FROM assessments a
WHERE a.term_id IS NOT NULL
  AND a.grade_percent IS NOT NULL
GROUP BY a.user_id, a.term_id;

-- ============================================================
-- Optional cleanup (destructive, uncomment only if confirmed)
-- ============================================================
-- DROP TABLE IF EXISTS student_summary_stats_legacy;
-- DROP TABLE IF EXISTS student_term_scores;
-- DROP TABLE IF EXISTS student_courses;
-- DROP TABLE IF EXISTS courses;
