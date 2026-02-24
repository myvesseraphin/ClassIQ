import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../api/client";
import EmptyState from "./EmptyState";
import TeacherPageSkeleton from "./TeacherPageSkeleton";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const formatClassName = (item) =>
  [item?.level, item?.classGroup].filter(Boolean).join(" ").trim() ||
  item?.classGroup ||
  item?.level ||
  "--";

const TeacherClassPicker = ({
  title = "Classes",
  actionLabel = "Open",
  onSelect,
}) => {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("All");

  useEffect(() => {
    let active = true;
    const loadClasses = async () => {
      try {
        const { data } = await api.get("/teacher/record-marks/classes");
        if (!active) return;
        setClasses(Array.isArray(data?.classes) ? data.classes : []);
      } catch (error) {
        console.error("Failed to load classes", error);
        toast.error("Failed to load classes.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadClasses();
    return () => {
      active = false;
    };
  }, []);

  const subjectOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(classes.map((item) => item.courseName).filter(Boolean)),
      ),
    ],
    [classes],
  );

  useEffect(() => {
    setSelectedSubject((prev) =>
      subjectOptions.includes(prev) ? prev : "All",
    );
  }, [subjectOptions]);

  const filtered = useMemo(() => {
    const query = normalizeText(searchQuery);
    const selectedSubjectKey = normalizeText(selectedSubject);
    return classes.filter((item) => {
      const itemSubject = normalizeText(item.courseName);
      const subjectMatch =
        selectedSubjectKey === "all" || itemSubject === selectedSubjectKey;
      if (!subjectMatch) return false;
      if (!query) return true;
      const label = `${item.courseName || ""} ${item.classGroup || ""} ${
        item.level || ""
      } ${item.combination || ""}`.toLowerCase();
      return label.includes(query);
    });
  }, [classes, searchQuery, selectedSubject]);

  const stats = useMemo(() => {
    const totalStudents = classes.reduce(
      (sum, item) => sum + (item.studentsCount || 0),
      0,
    );
    const totalExercises = classes.reduce(
      (sum, item) => sum + (item.exercisesCount || 0),
      0,
    );
    const totalAssessments = classes.reduce(
      (sum, item) => sum + (item.assessmentsCount || 0),
      0,
    );
    return {
      classes: classes.length,
      students: totalStudents,
      exercises: totalExercises,
      assessments: totalAssessments,
    };
  }, [classes]);

  if (isLoading) {
    return <TeacherPageSkeleton variant="classPicker" />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1 scrollbar-hide">
            {subjectOptions.map((subject) => (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                  selectedSubject === subject
                    ? "bg-[#2D70FD] text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200"
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search class..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
            />
          </div>
        </div>

        {classes.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item)}
                className="text-left bg-white border border-slate-100 rounded-[2.5rem] p-7 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2D70FD] flex items-center justify-center shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                    {item.level || "--"}
                  </span>
                </div>

                <p className="text-lg font-black text-slate-900 mt-4 truncate">
                  {item.courseName || "Course"}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-1 truncate">
                  {formatClassName(item)}
                </p>
                {item.combination ? (
                  <p className="text-[11px] font-bold text-slate-400 mt-1 truncate">
                    {item.combination}
                  </p>
                ) : null}
                <div className="mt-6">
                  <div className="w-full py-3 rounded-2xl bg-blue-50 text-[#2D70FD] font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2">
                    {actionLabel}
                    <ChevronRight size={16} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const StatPill = ({ label, value, icon }) => (
  <div className="bg-white border border-slate-100 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-sm">
    <span className="w-9 h-9 rounded-xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
      {icon}
    </span>
    <span className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="text-sm font-black text-slate-800 truncate">{value}</p>
    </span>
  </div>
);

const InfoChip = ({ icon, label }) => (
  <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-600 inline-flex items-center gap-1.5 min-w-0">
    <span className="text-slate-400 shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </div>
);

export default TeacherClassPicker;
