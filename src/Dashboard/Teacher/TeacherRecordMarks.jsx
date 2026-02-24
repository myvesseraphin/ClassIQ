import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  X,
  FileText,
  Trophy,
  CheckCircle2,
  Activity,
  Download,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { resolveMediaUrl } from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherClassPicker from "../../Component/TeacherClassPicker";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const TeacherRecordMarks = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(assignmentId));
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (!assignmentId) {
      setClassInfo(null);
      setStudents([]);
      setSelectedStudent(null);
      setDetails(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    const loadClass = async () => {
      try {
        const { data } = await api.get(
          `/teacher/record-marks/classes/${assignmentId}`,
        );
        if (!active) return;
        setClassInfo(data.classInfo || null);
        setStudents(Array.isArray(data.students) ? data.students : []);
      } catch (err) {
        console.error("Failed to load class record", err);
        toast.error("Failed to load class record.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadClass();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    let active = true;
    setDetails(null);
    setDetailsLoading(true);
    api
      .get(`/teacher/students/${selectedStudent.id}/overview`)
      .then(({ data }) => {
        if (active) setDetails(data);
      })
      .catch((err) => {
        console.error("Failed to load student overview", err);
        toast.error("Failed to load student overview.");
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedStudent?.id]);

  const closeDetails = () => {
    setSelectedStudent(null);
    setDetails(null);
  };

  const reloadClass = async () => {
    if (!assignmentId) return;
    try {
      const { data } = await api.get(`/teacher/record-marks/classes/${assignmentId}`);
      setClassInfo(data.classInfo || null);
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (err) {
      console.error("Failed to refresh class record", err);
      toast.error("Failed to refresh class record.");
    }
  };

  if (!assignmentId) {
    return (
      <TeacherClassPicker
        title="Marks Recording"
        actionLabel="Open"
        onSelect={(item) =>
          navigate(`/teacher/record-marks/${encodeURIComponent(item.id)}`)
        }
      />
    );
  }

  if (isLoading) {
    return <TeacherPageSkeleton variant="recordMarks" />;
  }

  if (!classInfo) {
    return (
      <div className="flex min-h-[55vh] w-full items-center justify-center bg-slate-50 rounded-[2rem]">
        <p className="text-sm font-bold text-slate-400">Class not found.</p>
      </div>
    );
  }

  const maxMarks = classInfo.maxMarks || 20;

  const formatMark = (value) => {
    if (value === null || value === undefined) return "--";
    return `${value}/${maxMarks}`;
  };

  const exportMarksCsv = () => {
    if (!students.length) {
      toast.info("No students to export.");
      return;
    }
    const rows = ["student_id,student_number,name,end_unit,end_term"];
    students.forEach((student) => {
      const values = [
        student.id || "",
        student.studentNumber || "",
        student.name || "",
        student.endUnit ?? "",
        student.endTerm ?? "",
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`);
      rows.push(values.join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `marks-${classInfo.classGroup || "class"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const parseCsvRows = (csvText) => {
    const lines = String(csvText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];

    const parseLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
    const getValue = (row, keyList) => {
      for (const key of keyList) {
        const idx = headers.indexOf(key);
        if (idx !== -1 && row[idx] !== undefined) return row[idx];
      }
      return "";
    };

    return lines.slice(1).map((line) => {
      const row = parseLine(line);
      return {
        studentId: getValue(row, ["student_id", "studentid", "id"]),
        studentNumber: getValue(row, ["student_number", "studentnumber"]),
        endUnit: getValue(row, ["end_unit", "endunit", "unit"]),
        endTerm: getValue(row, ["end_term", "endterm", "term"]),
      };
    });
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const text = await file.text();
    const rows = parseCsvRows(text);
    if (!rows.length) {
      toast.error("CSV has no data rows.");
      setImportRows([]);
      return;
    }
    setImportRows(rows);
  };

  const importMarks = async () => {
    if (!importRows.length) {
      toast.error("No import rows.");
      return;
    }
    setIsImporting(true);
    try {
      const { data } = await api.post("/teacher/record-marks/import", {
        assignmentId,
        maxMarks,
        rows: importRows,
      });
      await reloadClass();
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName("");
      toast.success(
        `Imported ${data?.updatedCount || 0} rows. Skipped ${data?.skippedCount || 0}.`,
      );
    } catch (err) {
      console.error("Failed to import marks", err);
      toast.error("Failed to import marks.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <button
              onClick={() => navigate("/teacher/record-marks")}
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-700"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Marks Recording
            </h1>
            <p className="text-sm font-bold text-slate-400">
              {classInfo.courseName} - {classInfo.classGroup} - {classInfo.level}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Maximum Marks
              </p>
              <p className="text-lg font-black text-slate-800">{maxMarks}</p>
            </div>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors inline-flex items-center gap-2"
            >
              <Upload size={15} />
              Import marks
            </button>
            <button
              onClick={exportMarksCsv}
              className="px-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:border-blue-200 hover:text-[#2D70FD] transition-colors inline-flex items-center gap-2"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    No
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Student Number
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase">
                    Student Names
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase text-center">
                    End of Unit
                    <div className="text-[10px] font-bold text-slate-300 mt-1">
                      Max: {maxMarks}
                    </div>
                  </th>
                  <th className="px-8 py-5 text-xs font-black text-slate-400 tracking-tight uppercase text-center">
                    End of Term
                    <div className="text-[10px] font-bold text-slate-300 mt-1">
                      Max: {maxMarks}
                    </div>
                  </th>
                  <th className="px-8 py-5 text-right pr-12">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((student, index) => {
                  const hasUnit = student.endUnit !== null && student.endUnit !== undefined;
                  const hasTerm = student.endTerm !== null && student.endTerm !== undefined;
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="px-8 py-6 text-sm font-black text-slate-700">
                        {index + 1}
                      </td>
                      <td className="px-8 py-6 text-sm font-bold text-slate-600">
                        {student.studentNumber || "--"}
                      </td>
                      <td className="px-8 py-6 font-black text-slate-800">
                        {student.name}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-black text-slate-800">
                            {formatMark(student.endUnit)}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${hasUnit ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                          >
                            {hasUnit ? "Recorded" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-black text-slate-800">
                            {formatMark(student.endTerm)}
                          </span>
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${hasTerm ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                          >
                            {hasTerm ? "Recorded" : "Pending"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right pr-12">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() =>
                              navigate(
                                `/teacher/assessments?assignmentId=${assignmentId}&studentId=${student.id}&mode=scan`,
                              )
                            }
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:border-blue-200 hover:text-[#2D70FD] transition-colors"
                          >
                            <Upload size={14} /> Scan
                          </button>
                          <button
                            onClick={() => setSelectedStudent(student)}
                            className="px-4 py-2 bg-[#2D70FD] text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
                          >
                            <Eye size={14} /> View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={() => setShowImportModal(false)}
          />
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Bulk Upload
                </p>
                <h2 className="text-2xl font-black text-slate-800">
                  Import Marks CSV
                </h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50 text-blue-700 font-black text-sm cursor-pointer">
                <Upload size={16} />
                {importFileName || "Choose CSV file"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>
              <p className="text-xs font-semibold text-slate-500">
                Required headers: <code>student_id</code> or{" "}
                <code>student_number</code>, plus <code>end_unit</code> and/or{" "}
                <code>end_term</code>.
              </p>
              {importRows.length > 0 ? (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/60">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">
                          Student
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">
                          End Unit
                        </th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">
                          End Term
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {importRows.slice(0, 8).map((row, idx) => (
                        <tr key={`${row.studentId || row.studentNumber || idx}-${idx}`}>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {row.studentNumber || row.studentId || "--"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {row.endUnit || "--"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {row.endTerm || "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-3 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={importMarks}
                disabled={isImporting}
                className="px-4 py-3 bg-[#2D70FD] text-white rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
              >
                {isImporting ? "Importing..." : "Import marks"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-md"
            onClick={closeDetails}
          />
          <div className="relative bg-white w-full h-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100">
                  <img
                    src={
                      resolveMediaUrl(selectedStudent.avatarUrl) ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedStudent.name || "Student",
                      )}`
                    }
                    alt={selectedStudent.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        selectedStudent.name || "Student",
                      )}`;
                    }}
                  />
                </div>
                <div>
                  <h2 className="font-black text-slate-800 text-2xl tracking-tight">
                    {selectedStudent.name}
                  </h2>
                  <p className="text-sm font-bold text-slate-400">
                    {selectedStudent.studentNumber || "--"}
                  </p>
                </div>
              </div>
              <button
                onClick={closeDetails}
                className="p-4 bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {detailsLoading ? (
              <TeacherPageSkeleton variant="recordMarksDetails" />
            ) : details ? (
              <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10 bg-slate-50">
                {(() => {
                  const safeScores = (details.scores || []).filter((score) =>
                    Number.isFinite(score.val),
                  );
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                          {
                            label: "End of Unit",
                            value: formatMark(selectedStudent.endUnit),
                            color: "text-blue-600",
                            bg: "bg-blue-50",
                          },
                          {
                            label: "End of Term",
                            value: formatMark(selectedStudent.endTerm),
                            color: "text-emerald-600",
                            bg: "bg-emerald-50",
                          },
                        ].map((card) => (
                          <div
                            key={card.label}
                            className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center justify-between shadow-sm"
                          >
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {card.label}
                              </p>
                              <p className="text-2xl font-black text-slate-800">
                                {card.value}
                              </p>
                            </div>
                            <div
                              className={`w-12 h-12 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center font-black`}
                            >
                              {card.value === "--" ? "--" : card.value.split("/")[0]}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                          {
                            label: "Assessments",
                            value: details.summary?.totalAssessments || 0,
                            icon: <FileText size={20} />,
                            color: "text-blue-600",
                            bg: "bg-blue-50",
                          },
                          {
                            label: "Avg Grade",
                            value: details.summary?.avgGrade || "--",
                            icon: <Trophy size={20} />,
                            color: "text-emerald-600",
                            bg: "bg-emerald-50",
                          },
                          {
                            label: "Completion",
                            value: details.summary?.completionRate || "0%",
                            icon: <CheckCircle2 size={20} />,
                            color: "text-emerald-600",
                            bg: "bg-emerald-50",
                          },
                          {
                            label: "Weakness",
                            value: details.student?.weakness || "--",
                            icon: <Activity size={20} />,
                            color: "text-rose-600",
                            bg: "bg-rose-50",
                          },
                        ].map((card, i) => (
                          <div
                            key={i}
                            className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm"
                          >
                            <div
                              className={`w-12 h-12 ${card.bg} ${card.color} rounded-2xl flex items-center justify-center`}
                            >
                              {card.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {card.label}
                              </p>
                              <p className="text-lg font-black text-slate-800 truncate">
                                {card.value}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 mb-6">
                            Term Progress
                          </h3>
                          <div className="relative h-44 w-full">
                            <svg
                              viewBox="0 0 400 100"
                              className="w-full h-full overflow-visible"
                            >
                              <defs>
                                <linearGradient
                                  id="teacherLine"
                                  x1="0"
                                  y1="0"
                                  x2="1"
                                  y2="0"
                                >
                                  <stop offset="0%" stopColor="#EDF3FF" />
                                  <stop offset="100%" stopColor="#2D70FD" />
                                </linearGradient>
                              </defs>
                              {safeScores.length > 0 && (
                                <path
                                  d={safeScores
                                    .map((s, i) => {
                                      const x = 50 + i * 100;
                                      const y = 80 - (s.val - 60) * 2;
                                      return `${i === 0 ? "M" : "L"} ${x},${y}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="url(#teacherLine)"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                              )}
                              {safeScores.map((s, i) => {
                                const x = 50 + i * 100;
                                const y = 80 - (s.val - 60) * 2;
                                return (
                                  <g key={i}>
                                    <circle
                                      cx={x}
                                      cy={y}
                                      r="6"
                                      fill="#2D70FD"
                                      stroke="white"
                                      strokeWidth="2"
                                    />
                                    <text
                                      x={x}
                                      y="115"
                                      textAnchor="middle"
                                      className="text-[10px] font-bold fill-slate-400 uppercase"
                                    >
                                      Term {s.term_id}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                            {safeScores.length === 0 && (
                              <p className="text-sm text-slate-400 text-center">
                                No term scores available.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 mb-6">
                            Student Snapshot
                          </h3>
                          <div className="space-y-4 text-sm font-bold text-slate-600">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Grade
                              </span>
                              <span>{details.student?.gradeLevel || "--"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Class
                              </span>
                              <span>{details.student?.className || "--"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Program
                              </span>
                              <span>{details.student?.program || "--"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Subjects
                              </span>
                              <span>
                                {details.student?.subjects?.length
                                  ? details.student?.subjects?.join(", ")
                                  : "--"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Ranking
                              </span>
                              <span>{details.student?.ranking || "--"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 uppercase tracking-widest text-[10px]">
                                Last Assessment
                              </span>
                              <span>{details.summary?.lastAssessmentDate || "--"}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 mb-6">
                            Recent Assessments
                          </h3>
                          <div className="space-y-4">
                            {(details.assessments || []).length === 0 ? (
                              <p className="text-sm text-slate-400">
                                No assessments yet.
                              </p>
                            ) : (
                              details.assessments.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl"
                                >
                                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <FileText size={18} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-black text-slate-800 text-sm">
                                      {item.title}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {item.subject} - {item.date || "--"}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-black text-slate-800 text-sm">
                                      {item.grade || "--"}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {item.status}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                          <h3 className="text-lg font-black text-slate-800 mb-6">
                            Recent Exercises
                          </h3>
                          <div className="space-y-4">
                            {(details.exercises || []).length === 0 ? (
                              <p className="text-sm text-slate-400">
                                No exercises yet.
                              </p>
                            ) : (
                              details.exercises.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl"
                                >
                                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                                    <BookOpen size={18} />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-black text-slate-800 text-sm">
                                      {item.name}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {item.subject} - {item.questionCount || 0} Qs
                                    </p>
                                    {item.score !== null &&
                                    item.score !== undefined ? (
                                      <p className="text-[11px] font-black text-slate-700 mt-2">
                                        Score: {item.score}
                                      </p>
                                    ) : (
                                      <p className="text-[11px] font-bold text-slate-300 mt-2">
                                        Score: --
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {item.date || "--"}
                                    </p>
                                    {item.status && (
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                        {item.status.replace("_", " ")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
                        <h3 className="text-lg font-black text-slate-800 mb-6">
                          PLP and Growth Plan
                        </h3>
                        <div className="space-y-4">
                          {(details.plp || []).length === 0 ? (
                            <p className="text-sm text-slate-400">
                              No PLP records yet.
                            </p>
                          ) : (
                            details.plp.map((plan) => (
                              <div
                                key={plan.id}
                                className="p-4 bg-slate-50 rounded-2xl border border-slate-100"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="font-black text-slate-800 text-sm">
                                      {plan.name || "Learning Plan"}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {plan.subjectCode || plan.category || "Plan"}
                                    </p>
                                  </div>
                                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                    {plan.status || "Active"}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#2D70FD]"
                                      style={{ width: `${plan.progress || 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-black text-slate-600">
                                    {plan.progress || 0}%
                                  </span>
                                </div>
                                {plan.feedback && (
                                  <p className="mt-3 text-xs text-slate-500 font-medium">
                                    {plan.feedback}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">
                No student overview data.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherRecordMarks;
