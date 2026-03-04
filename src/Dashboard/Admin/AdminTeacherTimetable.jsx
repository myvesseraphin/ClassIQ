import React, { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Calendar,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";

const DAY_OPTIONS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

const HOUR_START = 7;
const HOUR_END = 20;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

const getHourFromTime = (value) => {
  const parts = String(value || "").split(":");
  const hour = Number(parts[0]);
  return Number.isFinite(hour) ? hour : 0;
};

const getDurationHours = (start, end) => {
  const startHour = getHourFromTime(start);
  const endHour = getHourFromTime(end);
  return Math.max(1, endHour - startHour);
};

const getColorByTitle = (title) => {
  const palette = [
    "bg-blue-100 border-blue-300",
    "bg-emerald-100 border-emerald-300",
    "bg-amber-100 border-amber-300",
    "bg-rose-100 border-rose-300",
  ];
  const seed = String(title || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
};

const templateCsv = [
  "day,startTime,endTime,title,room,instructor",
  "Mon,08:00,09:00,Mathematics,Room A,Teacher Name",
  "Tue,10:00,11:00,English,Room B,Teacher Name",
].join("\n");

const AdminTeacherTimetable = () => {
  const [teachers, setTeachers] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [teachingHours, setTeachingHours] = useState({
    weeklyHours: 0,
    todayHours: 0,
  });
  const [currentClass, setCurrentClass] = useState(null);
  const [nextClassToday, setNextClassToday] = useState(null);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [isSavingClass, setIsSavingClass] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [generationSummary, setGenerationSummary] = useState(null);
  const [autoForm, setAutoForm] = useState({
    mode: "ai",
    replaceExisting: true,
    includeSaturday: false,
    includeSunday: false,
    dayStartTime: "08:00",
    slotMinutes: 50,
    gapMinutes: 10,
    slotsPerDay: 6,
    sessionsPerAssignment: 2,
  });

  const [classForm, setClassForm] = useState({
    day: 0,
    startTime: "08:00",
    endTime: "09:00",
    title: "",
    room: "",
    instructor: "",
    classId: "",
    subjectId: "",
  });

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });
  }, [classes]);

  const fetchTeachers = async () => {
    setIsLoadingTeachers(true);
    try {
      const [{ data }, { data: classData }, { data: subjectData }] = await Promise.all([
        api.get("/admin/teachers"),
        api.get("/admin/classes"),
        api.get("/admin/subjects"),
      ]);
      const list = Array.isArray(data?.teachers) ? data.teachers : [];
      setTeachers(list);
      setClassOptions(Array.isArray(classData?.classes) ? classData.classes : []);
      setSubjectOptions(Array.isArray(subjectData?.subjects) ? subjectData.subjects : []);
      if (list.length > 0) {
        setSelectedTeacherId((prev) => prev || list[0].id);
      }
    } catch (error) {
      console.error("Failed to load teachers", error);
      toast.error("Failed to load teachers.");
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const fetchTeacherSchedule = async (teacherId) => {
    if (!teacherId) {
      setSelectedTeacher(null);
      setClasses([]);
      return;
    }
    setIsLoadingSchedule(true);
    try {
      const { data } = await api.get("/admin/teacher-schedule", {
        params: { teacherId },
      });
      setSelectedTeacher(data?.teacher || null);
      setClasses(Array.isArray(data?.classes) ? data.classes : []);
      setTeachingHours({
        weeklyHours: Number(data?.teachingHours?.weeklyHours) || 0,
        todayHours: Number(data?.teachingHours?.todayHours) || 0,
      });
      setCurrentClass(data?.currentClass || null);
      setNextClassToday(data?.nextClassToday || null);
    } catch (error) {
      console.error("Failed to load teacher timetable", error);
      toast.error("Failed to load teacher timetable.");
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (!selectedTeacherId) return;
    fetchTeacherSchedule(selectedTeacherId);
  }, [selectedTeacherId]);

  useEffect(() => {
    if (!selectedTeacherId) return undefined;
    const timer = window.setInterval(() => {
      fetchTeacherSchedule(selectedTeacherId);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [selectedTeacherId]);

  const handleAddClass = async () => {
    if (!selectedTeacherId) {
      toast.error("Select a teacher first.");
      return;
    }
    if (!classForm.title.trim()) {
      toast.error("Class title is required.");
      return;
    }

    setIsSavingClass(true);
    try {
      await api.post("/admin/teacher-schedule", {
        teacherId: selectedTeacherId,
        day: classForm.day,
        startTime: classForm.startTime,
        endTime: classForm.endTime,
        title: classForm.title.trim(),
        room: classForm.room.trim() || undefined,
        instructor:
          classForm.instructor.trim() ||
          selectedTeacher?.name ||
          undefined,
        classId: classForm.classId || undefined,
        subjectId: classForm.subjectId || undefined,
      });
      await fetchTeacherSchedule(selectedTeacherId);
      setShowAddClass(false);
      setClassForm({
        day: 0,
        startTime: "08:00",
        endTime: "09:00",
        title: "",
        room: "",
        instructor: "",
        classId: "",
        subjectId: "",
      });
      toast.success("Class added to teacher timetable.");
    } catch (error) {
      console.error("Failed to add timetable class", error);
      toast.error(error?.response?.data?.error || "Failed to add class.");
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDeleteClass = async (classId) => {
    if (!selectedTeacherId) return;
    try {
      await api.delete(`/admin/teacher-schedule/${classId}`, {
        params: { teacherId: selectedTeacherId },
      });
      setClasses((prev) => prev.filter((item) => item.id !== classId));
    } catch (error) {
      console.error("Failed to delete class", error);
      toast.error(error?.response?.data?.error || "Failed to delete class.");
    }
  };

  const handleImport = async () => {
    if (!selectedTeacherId) {
      toast.error("Select a teacher first.");
      return;
    }
    if (!importFile) {
      toast.error("Choose an Excel, CSV, or image file.");
      return;
    }

    const formData = new FormData();
    formData.append("teacherId", selectedTeacherId);
    formData.append("replaceExisting", replaceExisting ? "true" : "false");
    formData.append("file", importFile);

    setIsImporting(true);
    try {
      const { data } = await api.post("/admin/teacher-schedule/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await fetchTeacherSchedule(selectedTeacherId);
      const importedCount = Number(data?.importedCount) || 0;
      const skippedCount = Array.isArray(data?.skipped) ? data.skipped.length : 0;
      toast.success(
        `Imported ${importedCount} class${importedCount === 1 ? "" : "es"}${skippedCount ? ` (${skippedCount} skipped)` : ""}.`,
      );
      setImportFile(null);
      setFileInputKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to import timetable", error);
      toast.error(error?.response?.data?.error || "Failed to import timetable.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerateForAllTeachers = async () => {
    setIsGeneratingAll(true);
    try {
      const { data } = await api.post("/admin/teacher-schedule/auto-generate", {
        mode: autoForm.mode,
        replaceExisting: autoForm.replaceExisting,
        includeSaturday: autoForm.includeSaturday,
        includeSunday: autoForm.includeSunday,
        dayStartTime: autoForm.dayStartTime,
        slotMinutes: Number(autoForm.slotMinutes),
        gapMinutes: Number(autoForm.gapMinutes),
        slotsPerDay: Number(autoForm.slotsPerDay),
        sessionsPerAssignment: Number(autoForm.sessionsPerAssignment),
      });
      setGenerationSummary(data || null);
      toast.success(
        `Generated ${Number(data?.generatedCount) || 0} lesson slots for ${Number(data?.teacherCount) || 0} teacher(s).`,
      );
      await fetchTeacherSchedule(selectedTeacherId);
    } catch (error) {
      console.error("Failed to auto-generate timetables", error);
      toast.error(
        error?.response?.data?.error || "Failed to auto-generate timetables.",
      );
    } finally {
      setIsGeneratingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Calendar className="text-[#2D70FD]" size={30} />
              Teacher Timetable
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">
              Manage teacher schedules and import weekly timetable files quickly.
            </p>
          </div>
          <button
            onClick={() => setShowAddClass(true)}
            disabled={!selectedTeacherId}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#2D70FD] text-white font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Class
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Teacher
            </span>
            <select
              value={selectedTeacherId}
              onChange={(event) => setSelectedTeacherId(event.target.value)}
              disabled={isLoadingTeachers}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            >
              <option value="">
                {isLoadingTeachers ? "Loading teachers..." : "Select teacher"}
              </option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name || teacher.email}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => fetchTeacherSchedule(selectedTeacherId)}
            disabled={!selectedTeacherId || isLoadingSchedule}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingSchedule ? <Loader2 size={16} className="animate-spin" /> : null}
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <StatCard label="Weekly Teaching Hours" value={`${teachingHours.weeklyHours}h`} />
          <StatCard label="Today's Teaching Hours" value={`${teachingHours.todayHours}h`} />
          <StatCard
            label="Current Class"
            value={currentClass?.title || "No class in progress"}
            note={currentClass ? `${currentClass.startTime}-${currentClass.endTime}` : ""}
          />
          <StatCard
            label="Next Class"
            value={nextClassToday?.title || "No more class today"}
            note={nextClassToday ? `${nextClassToday.startTime}-${nextClassToday.endTime}` : ""}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="text-[#2D70FD]" size={18} />
              Auto-Generate Timetable (All Teachers)
            </h2>
            <p className="text-sm font-semibold text-slate-500">
              Admin can still add classes manually, or generate weekly schedules for all teachers and lessons at once.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Generation Mode
            </span>
            <select
              value={autoForm.mode}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, mode: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            >
              <option value="ai">AI-assisted (recommended)</option>
              <option value="rules">Rule-based</option>
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Day Start
            </span>
            <input
              type="time"
              value={autoForm.dayStartTime}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, dayStartTime: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Slots / Day
            </span>
            <input
              type="number"
              min={1}
              max={12}
              value={autoForm.slotsPerDay}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, slotsPerDay: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Slot Minutes
            </span>
            <input
              type="number"
              min={30}
              max={180}
              value={autoForm.slotMinutes}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, slotMinutes: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Gap Minutes
            </span>
            <input
              type="number"
              min={0}
              max={60}
              value={autoForm.gapMinutes}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, gapMinutes: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Sessions / Assignment
            </span>
            <input
              type="number"
              min={1}
              max={6}
              value={autoForm.sessionsPerAssignment}
              onChange={(event) =>
                setAutoForm((prev) => ({
                  ...prev,
                  sessionsPerAssignment: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={autoForm.replaceExisting}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, replaceExisting: event.target.checked }))
              }
              className="h-4 w-4 accent-[#2D70FD]"
            />
            Replace existing timetable
          </label>
          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={autoForm.includeSaturday}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, includeSaturday: event.target.checked }))
              }
              className="h-4 w-4 accent-[#2D70FD]"
            />
            Include Saturday
          </label>
          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={autoForm.includeSunday}
              onChange={(event) =>
                setAutoForm((prev) => ({ ...prev, includeSunday: event.target.checked }))
              }
              className="h-4 w-4 accent-[#2D70FD]"
            />
            Include Sunday
          </label>
          <button
            onClick={handleGenerateForAllTeachers}
            disabled={isGeneratingAll}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#2D70FD] text-white font-black disabled:opacity-60"
          >
            {isGeneratingAll ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Bot size={16} />
            )}
            Generate for All Teachers
          </button>
        </div>

        {generationSummary ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-black text-slate-800">
              Generated {Number(generationSummary.generatedCount) || 0} entries for{" "}
              {Number(generationSummary.teacherCount) || 0} teacher(s).
            </p>
            <p className="text-slate-600 font-semibold mt-1">
              AI schedules: {Number(generationSummary.aiGeneratedTeachers) || 0} | Rule-based fallback:{" "}
              {Number(generationSummary.fallbackGeneratedTeachers) || 0}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">Import Timetable</h2>
            <p className="text-sm font-semibold text-slate-500">
              Upload `.xlsx`, `.xls`, `.csv`, or timetable image (`.png`, `.jpg`, `.webp`).
            </p>
          </div>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
            download="teacher-timetable-template.csv"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#2D70FD]"
          >
            <Download size={16} />
            Download Template
          </a>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="space-y-2 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              File
            </span>
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,.xls,.xlsx,.xlsm,image/png,image/jpeg,image/webp"
              onChange={(event) => setImportFile(event.target.files?.[0] || null)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-black"
            />
          </label>
          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="h-4 w-4 accent-[#2D70FD]"
            />
            Replace existing timetable
          </label>
          <button
            onClick={handleImport}
            disabled={!selectedTeacherId || !importFile || isImporting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm overflow-auto">
        <div className="min-w-[960px]">
          <div className="grid grid-cols-[88px_repeat(7,minmax(120px,1fr))] border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="p-3 text-xs font-black uppercase text-slate-500">Time</div>
            {DAY_OPTIONS.map((day) => (
              <div
                key={day.value}
                className="p-3 text-center text-xs font-black uppercase tracking-wider text-slate-500 border-l border-slate-200"
              >
                {day.label.slice(0, 3)}
              </div>
            ))}
          </div>

          {isLoadingSchedule ? (
            <div className="py-12 text-center text-sm font-bold text-slate-500">
              Loading timetable...
            </div>
          ) : (
            HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[88px_repeat(7,minmax(120px,1fr))] border-b border-slate-100"
              >
                <div className="p-3 text-xs font-black text-slate-500">
                  {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                </div>
                {DAY_OPTIONS.map((day) => (
                  <div
                    key={day.value}
                    className="relative min-h-[72px] border-l border-slate-100 p-1"
                  >
                    {sortedClasses
                      .filter(
                        (item) =>
                          item.day === day.value &&
                          getHourFromTime(item.startTime) === hour,
                      )
                      .map((item) => {
                        const duration = getDurationHours(item.startTime, item.endTime);
                        return (
                          <article
                            key={item.id}
                            className={`absolute inset-x-1 top-1 rounded-xl border-2 p-2 text-xs text-slate-900 ${getColorByTitle(item.title)} group shadow-sm`}
                            style={{
                              height: `calc(${duration * 100}% + ${(duration - 1) * 8}px)`,
                            }}
                          >
                            <p className="font-black line-clamp-2">{item.title}</p>
                            <p className="text-[10px] font-bold opacity-80">
                              {item.startTime} - {item.endTime}
                            </p>
                            {item.room ? (
                              <p className="text-[10px] opacity-75 line-clamp-1">{item.room}</p>
                            ) : null}
                            {item.className ? (
                              <p className="text-[10px] opacity-75 line-clamp-1">
                                {item.gradeLevel ? `${item.gradeLevel} ` : ""}
                                {item.className}
                              </p>
                            ) : null}
                            <button
                              onClick={() => handleDeleteClass(item.id)}
                              className="absolute right-1 top-1 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-200"
                              title="Delete class"
                            >
                              <Trash2 size={12} className="text-red-700" />
                            </button>
                          </article>
                        );
                      })}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {!isLoadingSchedule && sortedClasses.length === 0 ? (
          <div className="py-8 text-center text-sm font-bold text-slate-500">
            {selectedTeacherId
              ? "No timetable entries yet. Add one manually or import a file."
              : "Select a teacher to start."}
          </div>
        ) : null}
      </section>

      {showAddClass ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-black text-slate-900">Add Timetable Class</h3>

            <label className="space-y-2 block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Day
              </span>
              <select
                value={classForm.day}
                onChange={(event) =>
                  setClassForm((prev) => ({
                    ...prev,
                    day: Number(event.target.value),
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
              >
                {DAY_OPTIONS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Start Time
                </span>
                <input
                  type="time"
                  value={classForm.startTime}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      startTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  End Time
                </span>
                <input
                  type="time"
                  value={classForm.endTime}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      endTime: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                />
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Class Title
              </span>
              <input
                type="text"
                value={classForm.title}
                onChange={(event) =>
                  setClassForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Mathematics S4A"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Room
                </span>
                <input
                  type="text"
                  value={classForm.room}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      room: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Instructor
                </span>
                <input
                  type="text"
                  value={classForm.instructor}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      instructor: event.target.value,
                    }))
                  }
                  placeholder={selectedTeacher?.name || "Optional"}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Class
                </span>
                <select
                  value={classForm.classId}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      classId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  <option value="">Optional</option>
                  {classOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label || `${item.gradeLevel || ""} ${item.className || ""}`.trim()}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Subject
                </span>
                <select
                  value={classForm.subjectId}
                  onChange={(event) =>
                    setClassForm((prev) => ({
                      ...prev,
                      subjectId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
                >
                  <option value="">Optional</option>
                  {subjectOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddClass(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddClass}
                disabled={isSavingClass}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D70FD] text-sm font-black text-white disabled:opacity-60"
              >
                {isSavingClass ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Class
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const StatCard = ({ label, value, note }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
      {label}
    </p>
    <p className="mt-1 text-sm font-black text-slate-800">{value}</p>
    {note ? <p className="text-[10px] font-bold text-slate-500 mt-1">{note}</p> : null}
  </div>
);

export default AdminTeacherTimetable;
