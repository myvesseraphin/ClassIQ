-- final.sql
-- Purpose: patch key schema mismatches between backend code and Supabase.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) user_profiles must support ON CONFLICT (user_id)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_key
  ON public.user_profiles (user_id);

-- ============================================================
-- 2) class_subject_lessons must support ON CONFLICT (class_id, subject_id)
--    Keep newest row per (class_id, subject_id), then enforce uniqueness.
-- ============================================================
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY class_id, subject_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.class_subject_lessons
)
DELETE FROM public.class_subject_lessons l
USING ranked r
WHERE l.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS class_subject_lessons_class_subject_uidx
  ON public.class_subject_lessons (class_id, subject_id);

-- ============================================================
-- 3) student_subject_focus table required by /student/exercises/generate
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_subject_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic text NOT NULL,
  source text NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_subject_focus
  ADD COLUMN IF NOT EXISTS topic text;

ALTER TABLE public.student_subject_focus
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.student_subject_focus
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.student_subject_focus
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.student_subject_focus
SET source = COALESCE(NULLIF(TRIM(source), ''), 'student');

UPDATE public.student_subject_focus
SET topic = COALESCE(NULLIF(TRIM(topic), ''), 'General topic');

ALTER TABLE public.student_subject_focus
  ALTER COLUMN source SET DEFAULT 'student';

ALTER TABLE public.student_subject_focus
  ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.student_subject_focus
  ALTER COLUMN topic SET NOT NULL;

ALTER TABLE public.student_subject_focus
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.student_subject_focus
  ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_subject_focus_source_check'
      AND conrelid = 'public.student_subject_focus'::regclass
  ) THEN
    ALTER TABLE public.student_subject_focus
      ADD CONSTRAINT student_subject_focus_source_check
      CHECK (source IN ('student', 'teacher', 'admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS student_subject_focus_student_subject_uidx
  ON public.student_subject_focus (student_id, subject_id);

CREATE INDEX IF NOT EXISTS student_subject_focus_student_idx
  ON public.student_subject_focus (student_id);

CREATE INDEX IF NOT EXISTS student_subject_focus_subject_idx
  ON public.student_subject_focus (subject_id);

-- ============================================================
-- 4) student_stats guard (backend writes ON CONFLICT (user_id))
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_stats (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_term text,
  ranking text,
  overall_percentage integer,
  weakness text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5) resources.levels should be text[] (backend uses unnest(levels))
-- ============================================================
DO $$
DECLARE
  v_udt_name text;
BEGIN
  SELECT c.udt_name
    INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'resources'
    AND c.column_name = 'levels';

  IF v_udt_name IS NULL THEN
    ALTER TABLE public.resources
      ADD COLUMN levels text[];
  ELSIF v_udt_name <> '_text' THEN
    BEGIN
      ALTER TABLE public.resources
      ALTER COLUMN levels TYPE text[]
      USING (
        CASE
          WHEN levels IS NULL THEN NULL::text[]
          ELSE regexp_split_to_array(
            regexp_replace(levels::text, '^[\\{\\[\\(\"]+|[\\}\\]\\)\"]+$', '', 'g'),
            '\\s*,\\s*'
          )
        END
      );
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Could not auto-convert resources.levels to text[]. Error: %', SQLERRM;
    END;
  END IF;
END $$;

ALTER TABLE public.resources
  ALTER COLUMN levels SET DEFAULT '{}'::text[];
