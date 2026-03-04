import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
  Pencil,
  RefreshCcw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const toIsoDateInput = (value) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatShortDateTime = (value) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const AdminSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLessonId = String(searchParams.get("lessonId") || "").trim();

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [lessons, setLessons] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    classId: "",
    subjectId: "",
    teacherId: "",
    unitTitle: "",
    lessonNumber: "",
    topic: "",
    pageFrom: "",
    pageTo: "",
    term: "",
    weekNumber: "",
    unitCompleted: false,
    notes: "",
    effectiveDate: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    academicYear: "",
    terms: "Term 1, Term 2, Term 3",
    gradingScale: "A:80-100, B:70-79, C:60-69, D:50-59, F:0-49",
    rolePermissions:
      "Admin: full access; Teacher: class tools + analytics; Student: learning tools",
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId) || null;
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || null;

  const hydrateFormFromLesson = (lesson) => {
    if (!lesson) return;
    setForm({
      classId: lesson.classId || "",
      subjectId: lesson.subjectId || "",
      teacherId: lesson.teacherId || "",
      unitTitle: lesson.unitTitle || "",
      lessonNumber:
        lesson.lessonNumber === null || lesson.lessonNumber === undefined
          ? ""
          : String(lesson.lessonNumber),
      topic: lesson.topic || "",
      pageFrom:
        lesson.pageFrom === null || lesson.pageFrom === undefined
          ? ""
          : String(lesson.pageFrom),
      pageTo:
        lesson.pageTo === null || lesson.pageTo === undefined ? "" : String(lesson.pageTo),
      term: lesson.term || "",
      weekNumber:
        lesson.weekNumber === null || lesson.weekNumber === undefined
          ? ""
          : String(lesson.weekNumber),
      unitCompleted: Boolean(lesson.unitCompleted),
      notes: lesson.notes || "",
      effectiveDate: toIsoDateInput(lesson.effectiveDate),
    });
  };

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const [{ data: classData }, { data: subjectData }, { data: teacherData }] =
          await Promise.all([
            api.get("/admin/classes"),
            api.get("/admin/subjects"),
            api.get("/admin/teachers"),
          ]);
        if (!active) return;
        setClasses(Array.isArray(classData?.classes) ? classData.classes : []);
        setSubjects(Array.isArray(subjectData?.subjects) ? subjectData.subjects : []);
        setTeachers(Array.isArray(teacherData?.teachers) ? teacherData.teachers : []);
      } catch (err) {
        console.error("Failed to load settings catalog", err);
        toast.error("Failed to load settings catalog.");
      }
    };

    const loadLessons = async () => {
      try {
        const { data } = await api.get("/admin/lesson-progress");
        if (!active) return;
        setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
        const incomingSystem = data?.systemSettings || {};
        setSystemSettings((prev) => ({
          academicYear: incomingSystem.academicYear || prev.academicYear,
          terms: incomingSystem.terms || prev.terms,
          gradingScale: incomingSystem.gradingScale || prev.gradingScale,
          rolePermissions: incomingSystem.rolePermissions || prev.rolePermissions,
        }));
      } catch (err) {
        console.error("Failed to load lesson progress", err);
        toast.error("Failed to load lesson progress.");
      }
    };

    Promise.all([loadCatalog(), loadLessons()])
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClassId && !selectedSubjectId) return;

    let active = true;
    setIsRefreshing(true);
    api
      .get("/admin/lesson-progress", {
        params: {
          classId: selectedClassId || undefined,
          subjectId: selectedSubjectId || undefined,
        },
      })
      .then(({ data }) => {
        if (!active) return;
        setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
      })
      .catch((err) => {
        console.error("Failed to refresh lesson progress", err);
        toast.error("Failed to refresh lesson progress.");
      })
      .finally(() => {
        if (active) setIsRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClassId, selectedSubjectId]);

  useEffect(() => {
    if (!requestedLessonId || lessons.length === 0) return;
    const match = lessons.find((l) => l.id === requestedLessonId);
    if (match) {
      setSelectedClassId(match.classId || "");
      setSelectedSubjectId(match.subjectId || "");
      hydrateFormFromLesson(match);
    }
  }, [requestedLessonId, lessons]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      classId: selectedClassId || prev.classId,
      subjectId: selectedSubjectId || prev.subjectId,
    }));
  }, [selectedClassId, selectedSubjectId]);

  const filteredLessons = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter((l) => {
      return (
        String(l.className || "").toLowerCase().includes(q) ||
        String(l.gradeLevel || "").toLowerCase().includes(q) ||
        String(l.subject || "").toLowerCase().includes(q) ||
        String(l.topic || "").toLowerCase().includes(q) ||
        String(l.teacher || "").toLowerCase().includes(q)
      );
    });
  }, [lessons, searchQuery]);

  const handleEditLesson = (lesson) => {
    setSelectedClassId(lesson.classId || "");
    setSelectedSubjectId(lesson.subjectId || "");
    hydrateFormFromLesson(lesson);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("lessonId", lesson.id);
      return next;
    });
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveLessonProgress = async () => {
    const payload = {
      classId: String(form.classId || "").trim(),
      subjectId: String(form.subjectId || "").trim(),
      teacherId: String(form.teacherId || "").trim() || undefined,
      unitTitle: String(form.unitTitle || "").trim() || undefined,
      lessonNumber: String(form.lessonNumber || "").trim() || undefined,
      topic: String(form.topic || "").trim(),
      pageFrom: String(form.pageFrom || "").trim() || undefined,
      pageTo: String(form.pageTo || "").trim() || undefined,
      term: String(form.term || "").trim() || undefined,
      weekNumber: String(form.weekNumber || "").trim() || undefined,
      unitCompleted: Boolean(form.unitCompleted),
      notes: String(form.notes || "").trim() || undefined,
      effectiveDate: String(form.effectiveDate || "").trim() || undefined,
    };

    if (!payload.classId) {
      toast.error("Class is required.");
      return;
    }
    if (!payload.subjectId) {
      toast.error("Subject is required.");
      return;
    }
    if (!payload.topic) {
      toast.error("Topic is required.");
      return;
    }
    if (!payload.term) {
      toast.error("Term is required.");
      return;
    }
    if (!payload.unitTitle) {
      toast.error("Unit title is required.");
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await api.put("/admin/lesson-progress", payload);
      const saved = data?.lesson;
      if (!saved?.id) throw new Error("Invalid save response.");

      toast.success("Lesson progress saved.");

      await api
        .get("/admin/lesson-progress", {
          params: {
            classId: selectedClassId || undefined,
            subjectId: selectedSubjectId || undefined,
          },
        })
        .then(({ data: refresh }) => {
          setLessons(Array.isArray(refresh?.lessons) ? refresh.lessons : []);
        });
    } catch (err) {
      console.error("Failed to save lesson progress", err);
      toast.error(err?.response?.data?.error || "Failed to save lesson progress.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSystemSettings = async () => {
    setIsSavingSystem(true);
    try {
      await api.put("/admin/system-settings", {
        academicYear: String(systemSettings.academicYear || "").trim(),
        terms: String(systemSettings.terms || "").trim(),
        gradingScale: String(systemSettings.gradingScale || "").trim(),
        rolePermissions: String(systemSettings.rolePermissions || "").trim(),
      });
      toast.success("System settings saved.");
    } catch (err) {
      console.error("Failed to save system settings", err);
      toast.error(
        err?.response?.data?.error || "Failed to save system settings.",
      );
    } finally {
      setIsSavingSystem(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Academic Management
            </h1>
            <p className="text-sm font-bold text-slate-400">
              Curriculum lesson tracker and system-level academic configuration.
            </p>
          </div>

          <button
            onClick={saveLessonProgress}
            disabled={isSaving}
            className="px-6 py-4 bg-[#2D70FD] text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all active:scale-95 disabled:opacity-60"
          >
            <Save size={16} className="inline -mt-0.5 mr-2" />
            {isSaving ? "Saving..." : "Save Progress"}
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-black text-blue-700 uppercase tracking-wider">
              Curriculum Structure Rule
            </p>
            <p className="text-sm font-bold text-blue-800 mt-1">
              Term {"->"} Unit {"->"} Topic. A unit cannot be marked complete without a completed end-unit assessment.
            </p>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Class
                </p>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    handleFormChange("classId", e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  <option value="">Select class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `${c.gradeLevel} ${c.className}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Subject
                </p>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    handleFormChange("subjectId", e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Teacher (Optional)
                </p>
                <select
                  value={form.teacherId}
                  onChange={(e) => handleFormChange("teacherId", e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto">
              <button
                type="button"
                onClick={() => {
                  setIsRefreshing(true);
                  api
                    .get("/admin/lesson-progress", {
                      params: {
                        classId: selectedClassId || undefined,
                        subjectId: selectedSubjectId || undefined,
                      },
                    })
                    .then(({ data }) => {
                      setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
                    })
                    .catch((err) => {
                      console.error("Refresh failed", err);
                      toast.error("Refresh failed.");
                    })
                    .finally(() => setIsRefreshing(false));
                }}
                className="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 disabled:opacity-60 shrink-0"
                disabled={isRefreshing}
              >
                <RefreshCcw size={14} className="inline -mt-0.5 mr-2" />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>

              <div className="relative w-full xl:w-80 group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#2D70FD]"
                  size={18}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search topics..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-[#2D70FD] focus:bg-white transition-all font-bold text-sm text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Field
              label="Unit Title"
              value={form.unitTitle}
              onChange={(v) => handleFormChange("unitTitle", v)}
              placeholder="Example: Unit 2 - Fractions"
            />
            <Field
              label="Lesson Number (Optional)"
              value={form.lessonNumber}
              onChange={(v) => handleFormChange("lessonNumber", v)}
              placeholder="Example: 4"
              inputMode="numeric"
            />
            <Field
              label="Topic"
              value={form.topic}
              onChange={(v) => handleFormChange("topic", v)}
              placeholder="Example: Equivalent fractions"
            />
            <Field
              label="Effective Date"
              type="date"
              value={form.effectiveDate}
              onChange={(v) => handleFormChange("effectiveDate", v)}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Field
              label="Page From (Optional)"
              value={form.pageFrom}
              onChange={(v) => handleFormChange("pageFrom", v)}
              placeholder="Example: 12"
              inputMode="numeric"
            />
            <Field
              label="Page To (Optional)"
              value={form.pageTo}
              onChange={(v) => handleFormChange("pageTo", v)}
              placeholder="Example: 17"
              inputMode="numeric"
            />
            <Field
              label="Term"
              value={form.term}
              onChange={(v) => handleFormChange("term", v)}
              placeholder="Example: Term 1"
            />
            <Field
              label="Week Number (Optional)"
              value={form.weekNumber}
              onChange={(v) => handleFormChange("weekNumber", v)}
              placeholder="Example: 6"
              inputMode="numeric"
            />
          </div>

          <div className="mt-4">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(form.unitCompleted)}
                onChange={(e) => handleFormChange("unitCompleted", e.target.checked)}
                className="h-4 w-4 accent-[#2D70FD]"
              />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                Mark Unit Complete
              </span>
            </label>
            {form.unitCompleted ? (
              <p className="mt-2 text-xs font-bold text-amber-700 flex items-center gap-1">
                <AlertCircle size={14} />
                Requires at least one completed end-unit assessment for this class and subject.
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Notes (Optional)
            </p>
            <textarea
              value={form.notes}
              onChange={(e) => handleFormChange("notes", e.target.value)}
              rows={3}
              placeholder="Notes for the teacher or class..."
              className="mt-2 w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-sm font-bold text-slate-500">
              {selectedClass?.label || "Choose a class"}{" "}
              {selectedSubject?.name ? `| ${selectedSubject.name}` : ""}
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest">
              <CheckCircle2 size={16} />
              Lesson tracker ready
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">System Settings</h2>
              <p className="text-sm font-bold text-slate-400 mt-1">
                Academic year setup, terms, grading scale, and role permissions.
              </p>
            </div>
            <button
              onClick={saveSystemSettings}
              disabled={isSavingSystem}
              className="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest disabled:opacity-60"
            >
              <Lock size={14} className="inline -mt-0.5 mr-2" />
              {isSavingSystem ? "Saving..." : "Save System Settings"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Academic Year Setup"
              value={systemSettings.academicYear}
              onChange={(v) =>
                setSystemSettings((prev) => ({ ...prev, academicYear: v }))
              }
              placeholder="Example: 2026 - 2027"
            />
            <Field
              label="Terms"
              value={systemSettings.terms}
              onChange={(v) =>
                setSystemSettings((prev) => ({ ...prev, terms: v }))
              }
              placeholder="Example: Term 1, Term 2, Term 3"
            />
            <Field
              label="Grading Scale"
              value={systemSettings.gradingScale}
              onChange={(v) =>
                setSystemSettings((prev) => ({ ...prev, gradingScale: v }))
              }
              placeholder="Example: A:80-100, B:70-79..."
            />
            <Field
              label="Role Permissions"
              value={systemSettings.rolePermissions}
              onChange={(v) =>
                setSystemSettings((prev) => ({ ...prev, rolePermissions: v }))
              }
              placeholder="Define role permissions"
            />
          </div>
        </div>

        {filteredLessons.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100">
              <h2 className="text-xl font-black text-slate-900">
                Lesson Progress Entries
              </h2>
              <p className="text-sm font-bold text-slate-400 mt-1">
                Click an entry to edit its progress.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Class
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Subject
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Topic
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Teacher
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Unit Status
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Pages
                    </th>
                    <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                      Updated
                    </th>
                    <th className="px-8 py-5 text-right pr-12">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLessons.map((lesson) => (
                    <tr
                      key={lesson.id}
                      className="hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="px-8 py-6 text-sm font-black text-slate-800">
                        {(lesson.gradeLevel || "--") + " " + (lesson.className || "--")}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-600">
                        {lesson.subject || "--"}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-600">
                        {lesson.topic || "--"}
                        {lesson.unitTitle ? (
                          <div className="text-[11px] font-bold text-slate-400 mt-1">
                            {lesson.unitTitle}
                            {lesson.lessonNumber ? ` | Lesson ${lesson.lessonNumber}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-500">
                        {lesson.teacher || "--"}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-500">
                        {lesson.unitCompleted ? (
                          <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-500">
                        {lesson.pageFrom || lesson.pageTo
                          ? `${lesson.pageFrom || "--"}-${lesson.pageTo || "--"}`
                          : "--"}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-400">
                        {formatShortDateTime(lesson.updatedAt)}
                      </td>
                      <td className="px-8 py-6 text-right pr-12">
                        <button
                          onClick={() => handleEditLesson(lesson)}
                          className="p-3 bg-white border border-slate-100 text-[#2D70FD] rounded-xl hover:bg-blue-50 transition-all shadow-sm"
                          aria-label="Edit lesson"
                        >
                          <Pencil size={18} />
                        </button>
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
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <input
      type={type}
      value={value}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
    />
  </div>
);

export default AdminSettings;
