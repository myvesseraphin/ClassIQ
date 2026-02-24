import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  Download,
  FileText,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherClassPicker from "../../Component/TeacherClassPicker";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const TeacherReports = () => {
  const [selectedClass, setSelectedClass] = useState(null);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedClass?.id) return;
    let active = true;
    setIsLoading(true);
    setReport(null);

    const loadReport = async () => {
      try {
        const { data } = await api.get(`/teacher/reports/${selectedClass.id}`);
        if (!active) return;
        setReport(data || null);
      } catch (err) {
        console.error("Failed to load class report", err);
        toast.error("Failed to load class report.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadReport();
    return () => {
      active = false;
    };
  }, [selectedClass?.id]);

  const exportCsv = () => {
    if (!report?.students?.length) {
      toast.info("No student rows to export.");
      return;
    }

    const columns = [
      "student_number",
      "student_name",
      "avg_grade",
      "completion_rate",
      "risk_band",
      "weak_area",
      "possible_reason",
      "next_action",
      "behavior_signal",
      "last_assessment_date",
    ];
    const lines = [columns.join(",")];

    report.students.forEach((row) => {
      const values = [
        row.studentNumber || "",
        row.name || "",
        row.avgGrade || "",
        row.completionRate || "",
        row.riskBand || "",
        row.weakArea || "",
        row.possibleReason || "",
        row.nextAction || "",
        row.behaviorSignal || "",
        row.lastAssessmentDate || "",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      lines.push(values.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `class-report-${selectedClass.classGroup || "class"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const summaryCards = useMemo(() => {
    const summary = report?.summary || {};
    const classInfo = report?.classInfo || {};
    return [
      {
        label: "Class Size",
        value: classInfo.students || 0,
        icon: <Users size={20} />,
        tone: "blue",
        note: `${classInfo.classGroup || "--"} | ${classInfo.level || "--"}`,
      },
      {
        label: "Average Grade",
        value: summary.avgGrade || "--",
        icon: <BookOpen size={20} />,
        tone: "blue",
        note: summary.completionRate || "0%",
      },
      {
        label: "High Support",
        value: summary.highRiskCount || 0,
        icon: <FileText size={20} />,
        tone: "blue",
        note: "Need intervention",
      },
      {
        label: "On Track",
        value: summary.lowRiskCount || 0,
        icon: <BookOpen size={20} />,
        tone: "green",
        note: "Stable performance",
      },
    ];
  }, [report]);

  if (!selectedClass) {
    return (
      <TeacherClassPicker
        title="Class Reports"
        subtitle="Select a class to view full performance and behavior report."
        actionLabel="Open report"
        onSelect={setSelectedClass}
      />
    );
  }

  if (isLoading) {
    return <TeacherPageSkeleton variant="reports" />;
  }

  if (!report) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <style>{`
        .print-only { display: none; }
        @media print {
          body { background: #fff; }
          .print-only { display: block; }
          .print-hidden { display: none !important; }
        }
      `}</style>

      <div className="print-only">
        <div className="p-8 space-y-6">
          <h1 className="text-2xl font-black">Class Performance Report</h1>
          <div className="text-sm">
            <div>Subject: {report.classInfo?.courseName || "Course"}</div>
            <div>
              Class: {report.classInfo?.classGroup || "--"} -{" "}
              {report.classInfo?.level || "--"}
            </div>
            <div>Students: {report.classInfo?.students || 0}</div>
            <div>Average Grade: {report.summary?.avgGrade || "--"}</div>
            <div>Completion: {report.summary?.completionRate || "0%"}</div>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b py-2">Student</th>
                <th className="border-b py-2">Grade</th>
                <th className="border-b py-2">Completion</th>
                <th className="border-b py-2">Weak Area</th>
                <th className="border-b py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(report.students || []).map((student) => (
                <tr key={student.id}>
                  <td className="py-2 border-b">
                    {student.name} ({student.studentNumber || "--"})
                  </td>
                  <td className="py-2 border-b">{student.avgGrade || "--"}</td>
                  <td className="py-2 border-b">
                    {student.completionRate || "0%"}
                  </td>
                  <td className="py-2 border-b">{student.weakArea || "--"}</td>
                  <td className="py-2 border-b">{student.nextAction || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="print-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Class Report
              </h1>
              <p className="text-sm font-bold text-slate-400">
                {report.classInfo?.courseName || "Course"} |{" "}
                {report.classInfo?.classGroup || "--"} |{" "}
                {report.classInfo?.level || "--"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedClass(null)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors flex items-center gap-2"
              >
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={exportCsv}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors flex items-center gap-2"
              >
                <Download size={14} />
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-[#2D70FD] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm"
              >
                Print report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                note={card.note}
                icon={card.icon}
                tone={card.tone}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center">
                      Grade
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase text-center">
                      Completion
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">
                      Weak Area
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase">
                      Next Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(report.students || []).map((student) => (
                    <tr key={student.id} className="hover:bg-blue-50/20">
                      <td className="px-6 py-5">
                        <p className="font-black text-slate-800 text-sm">
                          {student.name}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">
                          {student.studentNumber || "--"}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-center font-black text-slate-800">
                        {student.avgGrade || "--"}
                      </td>
                      <td className="px-6 py-5 text-center font-black text-slate-800">
                        {student.completionRate || "0%"}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-600">
                        {student.weakArea || "--"}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-600">
                        {student.nextAction || "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-4">
                  Top Weak Areas
                </h3>
                {!report.weakAreas?.length ? (
                  <p className="text-sm text-slate-400">No weak areas yet.</p>
                ) : (
                  <div className="space-y-3">
                    {report.weakAreas.map((item) => (
                      <div
                        key={item.weakArea}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <p className="font-black text-slate-800 text-sm">
                          {item.weakArea}
                        </p>
                        <p className="text-xs font-bold text-slate-500 mt-1">
                          {item.count} records
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
                <h3 className="text-lg font-black text-slate-800 mb-4">
                  Recommendations
                </h3>
                <div className="space-y-3">
                  {(report.recommendations || []).map((tip, index) => (
                    <div
                      key={`${tip}-${index}`}
                      className="p-4 rounded-2xl bg-blue-50 border border-blue-100"
                    >
                      <p className="text-sm font-semibold text-slate-700">
                        {index + 1}. {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {report.students?.length === 0 ? <EmptyState /> : null}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, note, icon, tone = "blue" }) => {
  const iconClasses =
    tone === "green"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm">
      <div
        className={`w-12 h-12 ${iconClasses} rounded-2xl flex items-center justify-center`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {label}
        </p>
        <p className="text-2xl font-black text-slate-800 leading-none mt-1">
          {value}
        </p>
        <p className="text-xs font-bold text-slate-400 mt-1">{note}</p>
      </div>
    </div>
  );
};

export default TeacherReports;


