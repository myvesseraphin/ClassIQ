import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Route,
  Target,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";

const AdminCurriculum = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [
          { data: classData },
          { data: subjectData },
          { data: teacherData },
          { data: curriculumData },
        ] = await Promise.all([
          api.get("/admin/classes"),
          api.get("/admin/subjects"),
          api.get("/admin/teachers"),
          api.get("/admin/curriculum"),
        ]);
        if (!active) return;
        setClasses(Array.isArray(classData?.classes) ? classData.classes : []);
        setSubjects(Array.isArray(subjectData?.subjects) ? subjectData.subjects : []);
        setTeachers(Array.isArray(teacherData?.teachers) ? teacherData.teachers : []);
        setCurriculum(
          Array.isArray(curriculumData?.tree) ? curriculumData.tree : [],
        );
      } catch (err) {
        console.error("Failed to load curriculum overview", err);
        toast.error("Failed to load curriculum overview.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredTree = useMemo(() => {
    return curriculum
      .filter((node) =>
        selectedClassId ? String(node.classId) === String(selectedClassId) : true,
      )
      .filter((node) =>
        selectedSubjectId
          ? String(node.subjectId) === String(selectedSubjectId)
          : true,
      )
      .map((node) => {
        const units = Array.isArray(node.units) ? node.units : [];
        const teacherFilteredUnits = units.filter((unit) =>
          selectedTeacherId ? String(unit.teacherId) === String(selectedTeacherId) : true,
        );
        return { ...node, units: teacherFilteredUnits };
      })
      .filter((node) => node.units.length > 0);
  }, [curriculum, selectedClassId, selectedSubjectId, selectedTeacherId]);

  const totals = useMemo(() => {
    const units = filteredTree.flatMap((item) => item.units || []);
    const delayedUnits = units.filter((u) => Boolean(u.isDelayed)).length;
    const completion = units.length
      ? Math.round(
          units.reduce((sum, u) => sum + (Number(u.completionPct) || 0), 0) /
            units.length,
        )
      : 0;
    return { delayedUnits, completion, units: units.length };
  }, [filteredTree]);

  if (isLoading) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (filteredTree.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Curriculum Oversight
          </h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            Structured tracking by term, unit, topic, and teacher.
          </p>
        </div>

        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField
            label="Class"
            value={selectedClassId}
            onChange={setSelectedClassId}
            options={classes.map((item) => ({
              value: item.id,
              label: item.label || `${item.gradeLevel || ""} ${item.className || ""}`.trim(),
            }))}
          />
          <SelectField
            label="Subject"
            value={selectedSubjectId}
            onChange={setSelectedSubjectId}
            options={subjects.map((item) => ({ value: item.id, label: item.name }))}
          />
          <SelectField
            label="Teacher Drill-down"
            value={selectedTeacherId}
            onChange={setSelectedTeacherId}
            options={teachers.map((item) => ({ value: item.id, label: item.name }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            label="Average Unit Completion"
            value={`${totals.completion}%`}
            icon={<Target size={18} />}
            tone="blue"
          />
          <MetricCard
            label="Delayed Units"
            value={totals.delayedUnits}
            icon={<AlertTriangle size={18} />}
            tone="amber"
          />
          <MetricCard
            label="Tracked Units"
            value={totals.units}
            icon={<Route size={18} />}
            tone="slate"
          />
        </div>

        <div className="space-y-6">
          {filteredTree.map((branch) => (
            <div
              key={`${branch.classId}-${branch.subjectId}`}
              className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {branch.className || "Class"} | {branch.subjectName || "Subject"}
                  </p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Curriculum Tree: Term {"->"} Unit {"->"} Topic
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-blue-50 text-[#2D70FD] text-[10px] font-black uppercase tracking-widest">
                  {branch.termName || "Current Term"}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {(branch.units || []).map((unit) => (
                  <div key={unit.id} className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          Unit {unit.unitNumber || "--"}: {unit.unitTitle || "Untitled"}
                        </p>
                        <p className="text-xs font-bold text-slate-500 mt-1">
                          Teacher: {unit.teacherName || "--"} | Assessment Completion:{" "}
                          {Number(unit.assessmentCompletionPct) || 0}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unit.isDelayed ? (
                          <span className="px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest">
                            Delayed
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest">
                            On Track
                          </span>
                        )}
                        <span className="text-xs font-black text-slate-500">
                          {Number(unit.completionPct) || 0}% Complete
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${unit.isDelayed ? "bg-amber-500" : "bg-blue-600"}`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(unit.completionPct) || 0))}%` }}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(Array.isArray(unit.topics) ? unit.topics : []).map((topic) => (
                        <div
                          key={topic.id || `${unit.id}-${topic.title}`}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                        >
                          <p className="text-xs font-bold text-slate-700 truncate">
                            <ChevronRight size={12} className="inline -mt-0.5 mr-1" />
                            {topic.title || "Topic"}
                          </p>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            {Number(topic.assessmentCompletionPct) || 0}% assessed
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SelectField = ({ label, value, onChange, options }) => (
  <div className="space-y-2">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
      {label}
    </p>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white font-bold text-slate-700 outline-none focus:border-[#2D70FD]"
    >
      <option value="">All</option>
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  </div>
);

const MetricCard = ({ label, value, icon, tone }) => {
  const toneClass =
    tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : tone === "slate"
        ? "bg-slate-100 text-slate-600"
        : "bg-blue-50 text-[#2D70FD]";
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${toneClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
};

export default AdminCurriculum;
