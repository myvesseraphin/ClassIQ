import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  Filter,
  Lightbulb,
  Loader2,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../api/client";
import EmptyState from "../../Component/EmptyState";
import TeacherPageSkeleton from "../../Component/TeacherPageSkeleton";

const norm = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const classLabel = (item) =>
  `${item?.level || ""} ${item?.classGroup || ""}`.trim() || "Class";

const toTips = (text) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const parsePercent = (value) => {
  const n = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const isActivePlanStatus = (value) => {
  const status = norm(value);
  if (!status) return false;
  if (
    status.includes("complete") ||
    status.includes("closed") ||
    status.includes("done") ||
    status.includes("archive")
  ) {
    return false;
  }
  return true;
};

const TeacherPLP = () => {
  const [loading, setLoading] = useState(true);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [weakAreas, setWeakAreas] = useState([]);
  const [students, setStudents] = useState([]);
  const [overview, setOverview] = useState(null);
  const [classBundleLoading, setClassBundleLoading] = useState(false);
  const [classBundleLoaded, setClassBundleLoaded] = useState(false);
  const [classBundleStudents, setClassBundleStudents] = useState([]);
  const [classBundlePlans, setClassBundlePlans] = useState([]);
  const [classBundleStats, setClassBundleStats] = useState(null);

  const [subjectFilter, setSubjectFilter] = useState("All");
  const [classQuery, setClassQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);

  const [studentFilter, setStudentFilter] = useState("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [exportingPlanId, setExportingPlanId] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [classRes, plpRes, weakRes, studentRes] =
          await Promise.allSettled([
            api.get("/teacher/record-marks/classes"),
            api.get("/teacher/plp"),
            api.get("/teacher/weak-areas"),
            api.get("/teacher/students"),
          ]);

        if (!active) return;

        if (classRes.status !== "fulfilled") {
          throw classRes.reason;
        }

        setClasses(
          Array.isArray(classRes.value?.data?.classes)
            ? classRes.value.data.classes
            : [],
        );
        setPlans(
          plpRes.status === "fulfilled" &&
            Array.isArray(plpRes.value?.data?.plans)
            ? plpRes.value.data.plans
            : [],
        );
        setWeakAreas(
          weakRes.status === "fulfilled" &&
            Array.isArray(weakRes.value?.data?.weakAreas)
            ? weakRes.value.data.weakAreas
            : [],
        );
        setStudents(
          studentRes.status === "fulfilled" &&
            Array.isArray(studentRes.value?.data?.students)
            ? studentRes.value.data.students
            : [],
        );

        if (plpRes.status === "rejected") {
          console.warn("PLP list fallback: /teacher/plp failed", plpRes.reason);
        }
        if (weakRes.status === "rejected") {
          console.warn(
            "Weak areas fallback: /teacher/weak-areas failed",
            weakRes.reason,
          );
        }
        if (studentRes.status === "rejected") {
          console.warn(
            "Students fallback: /teacher/students failed",
            studentRes.reason,
          );
        }
      } catch (error) {
        console.error("Failed to load learning plans", error);
        toast.error("Failed to load learning plans.");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClass?.id) return;
    setSelectedStudent(null);
    setSelectedPlanId("");
    setOverview(null);
    setStudentFilter("all");
    setStudentQuery("");
  }, [selectedClass?.id]);

  useEffect(() => {
    if (!selectedClass?.id) {
      setClassBundleLoading(false);
      setClassBundleLoaded(false);
      setClassBundleStudents([]);
      setClassBundlePlans([]);
      setClassBundleStats(null);
      return;
    }

    let active = true;
    setClassBundleLoading(true);
    setClassBundleLoaded(false);
    setClassBundleStudents([]);
    setClassBundlePlans([]);
    setClassBundleStats(null);

    api
      .get("/teacher/plp/class", {
        params: { assignmentId: selectedClass.id },
      })
      .then(({ data }) => {
        if (!active) return;
        setClassBundleStudents(
          Array.isArray(data?.students) ? data.students : [],
        );
        setClassBundlePlans(Array.isArray(data?.plans) ? data.plans : []);
        setClassBundleStats(data?.stats || null);
        setClassBundleLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load class PLP data", error);
        toast.error("Failed to load class learning plan data.");
        setClassBundleLoaded(false);
      })
      .finally(() => {
        if (active) setClassBundleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClass?.id]);

  useEffect(() => {
    if (!selectedStudent?.id) return;

    let active = true;
    setIsOverviewLoading(true);

    const loadOverview = async () => {
      try {
        const { data } = await api.get(
          `/teacher/students/${selectedStudent.id}/overview`,
        );
        if (!active) return;
        setOverview(data || null);
      } catch (error) {
        console.error("Failed to load student overview", error);
        toast.error("Failed to load student overview.");
      } finally {
        if (active) setIsOverviewLoading(false);
      }
    };

    loadOverview();

    return () => {
      active = false;
    };
  }, [selectedStudent?.id]);

  useEffect(() => {
    setSelectedPlanId("");
  }, [selectedStudent?.id]);

  const subjects = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(classes.map((item) => item.courseName).filter(Boolean)),
      ),
    ],
    [classes],
  );

  useEffect(() => {
    if (!subjects.includes(subjectFilter)) setSubjectFilter("All");
  }, [subjectFilter, subjects]);

  const filteredClasses = useMemo(() => {
    const q = norm(classQuery);
    return classes.filter((item) => {
      if (
        subjectFilter !== "All" &&
        norm(item.courseName) !== norm(subjectFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return `${item.courseName || ""} ${item.level || ""} ${item.classGroup || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [classQuery, classes, subjectFilter]);

  const overallStats = useMemo(
    () => ({
      classes: classes.length,
      students: classes.reduce(
        (sum, item) => sum + (Number(item.studentsCount) || 0),
        0,
      ),
      plans: plans.length,
    }),
    [classes, plans.length],
  );

  const classStudents = useMemo(() => {
    if (classBundleLoaded) {
      return Array.isArray(classBundleStudents) ? classBundleStudents : [];
    }
    if (!selectedClass) return [];
    return students
      .filter(
        (student) =>
          norm(student.className) === norm(selectedClass.classGroup) &&
          norm(student.gradeLevel) === norm(selectedClass.level),
      )
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [classBundleLoaded, classBundleStudents, selectedClass, students]);

  const weakAreaByStudent = useMemo(() => {
    const scopedBySubject = weakAreas.filter((item) => {
      if (!selectedClass?.courseName) return true;
      return norm(item?.subject) === norm(selectedClass.courseName);
    });
    const map = new Map();
    scopedBySubject.forEach((item) => {
      const studentId = item?.student?.id || item?.studentId;
      const value = normalizeText(item?.weakArea || item?.topic);
      if (!studentId || !value || map.has(studentId)) return;
      map.set(studentId, value);
    });
    return map;
  }, [selectedClass?.courseName, weakAreas]);

  const studentRows = useMemo(() => {
    if (classBundleLoaded) {
      return classStudents.map((student, index) => ({
        student,
        studentNo: Number(student.studentNo) || index + 1,
        hasPlan: Boolean(student.hasPlan),
        totalPlans: Number(student.totalPlans) || 0,
        activePlans: Number(student.activePlans) || 0,
        avgProgress: Number(student.avgProgress) || 0,
        weakArea: student.weakArea || "--",
      }));
    }

    const planStats = new Map();
    plans.forEach((plan) => {
      const studentId = plan?.student?.id || plan?.studentId;
      if (!studentId) return;
      const current = planStats.get(studentId) || {
        totalPlans: 0,
        activePlans: 0,
        progressSum: 0,
      };
      current.totalPlans += 1;
      if (isActivePlanStatus(plan.status)) current.activePlans += 1;
      current.progressSum += Number(plan.progress) || 0;
      planStats.set(studentId, current);
    });

    return classStudents.map((student, index) => {
      const stats = planStats.get(student.id) || {
        totalPlans: 0,
        activePlans: 0,
        progressSum: 0,
      };
      const avgProgress = stats.totalPlans
        ? Math.round(stats.progressSum / stats.totalPlans)
        : 0;
      return {
        student,
        studentNo: Number(student.studentNo) || index + 1,
        hasPlan: stats.totalPlans > 0,
        totalPlans: stats.totalPlans,
        activePlans: stats.activePlans,
        avgProgress,
        weakArea: weakAreaByStudent.get(student.id) || student.weakArea || "--",
      };
    });
  }, [classBundleLoaded, classStudents, plans, weakAreaByStudent]);

  const filteredRows = useMemo(() => {
    const q = norm(studentQuery);
    return studentRows.filter((row) => {
      if (studentFilter === "with_plans" && !row.hasPlan) return false;
      if (studentFilter === "without_plans" && row.hasPlan) return false;
      if (!q) return true;
      const studentCode = row.student.studentNumber || row.student.id || "";
      return `${row.student.name || ""} ${studentCode} ${row.student.email || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [studentFilter, studentQuery, studentRows]);

  const classStats = useMemo(() => {
    if (classBundleLoaded && classBundleStats) {
      return {
        total: Number(classBundleStats.students) || 0,
        withPlans: Number(classBundleStats.withPlans) || 0,
        avgProgress: Number(classBundleStats.avgProgress) || 0,
      };
    }
    const total = studentRows.length;
    const withPlans = studentRows.filter((row) => row.hasPlan).length;
    const avgProgress = withPlans
      ? Math.round(
          studentRows
            .filter((row) => row.hasPlan)
            .reduce((sum, row) => sum + row.avgProgress, 0) / withPlans,
        )
      : 0;
    return { total, withPlans, avgProgress };
  }, [classBundleLoaded, classBundleStats, studentRows]);

  const studentPlans = useMemo(() => {
    if (!selectedStudent?.id) return [];
    const fromOverview = Array.isArray(overview?.plp) ? overview.plp : [];
    if (fromOverview.length) return fromOverview;
    const planSource = classBundleLoaded ? classBundlePlans : plans;
    return planSource.filter(
      (plan) =>
        (plan?.student?.id || plan?.studentId || "") === selectedStudent.id,
    );
  }, [
    classBundleLoaded,
    classBundlePlans,
    overview,
    plans,
    selectedStudent?.id,
  ]);

  const filteredPlans = useMemo(() => studentPlans, [studentPlans]);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setSelectedPlanId("");
      return;
    }
    if (!filteredPlans.length) {
      setSelectedPlanId("");
      return;
    }
    setSelectedPlanId((previous) => {
      if (!previous) return "";
      const stillExists = filteredPlans.some(
        (plan) => String(plan.id || "") === String(previous),
      );
      return stillExists ? previous : "";
    });
  }, [filteredPlans, selectedStudent?.id]);

  const selectedPlan = useMemo(() => {
    if (!filteredPlans.length) return null;
    if (!selectedPlanId) return null;
    return (
      filteredPlans.find(
        (plan) => String(plan.id || "") === String(selectedPlanId || ""),
      ) || null
    );
  }, [filteredPlans, selectedPlanId]);

  const weakAreaItems = useMemo(() => {
    if (!selectedStudent?.id) return [];
    const scoped = weakAreas.filter(
      (item) => item?.student?.id === selectedStudent.id,
    );
    if (selectedClass?.courseName) {
      const subjectScoped = scoped.filter(
        (item) => norm(item.subject) === norm(selectedClass.courseName),
      );
      if (subjectScoped.length) return subjectScoped;
    }
    if (scoped.length) return scoped;
    const fallback = overview?.student?.weakness || selectedStudent?.weakArea;
    if (!fallback) return [];
    return [
      {
        weakArea: fallback,
        subject: selectedClass?.courseName || "Subject",
        occurrences: 1,
        lastSeen: overview?.summary?.lastAssessmentDate || null,
      },
    ];
  }, [overview, selectedClass?.courseName, selectedStudent, weakAreas]);

  const primaryWeakArea =
    weakAreaItems[0]?.weakArea ||
    overview?.student?.weakness ||
    selectedStudent?.weakArea ||
    "No weak area flagged";

  const recommendations = useMemo(() => {
    const tips = [];
    studentPlans.forEach((plan) => {
      toTips(plan.feedback).forEach((tip) => {
        if (!tips.includes(tip)) tips.push(tip);
      });
    });
    if (!tips.length && primaryWeakArea !== "No weak area flagged") {
      tips.push(`Give targeted practice on ${primaryWeakArea}`);
      tips.push("Use short daily review sessions with worked examples");
      tips.push("Track progress weekly and adjust support quickly");
    }
    if (!tips.length) {
      tips.push("Maintain weekly formative checks for continuous feedback");
      tips.push("Keep practice balanced between revision and new content");
    }
    return tips.slice(0, 5);
  }, [primaryWeakArea, studentPlans]);

  const selectedPlanAdvice = useMemo(() => {
    if (!selectedPlan) return recommendations.slice(0, 4);
    const planTips = toTips(selectedPlan.feedback);
    if (planTips.length > 0) return planTips.slice(0, 4);
    return recommendations.slice(0, 4);
  }, [recommendations, selectedPlan]);

  const selectedPlanSpecialDetails = useMemo(() => {
    if (!selectedPlan) return [];
    const lines = toTips(selectedPlan.feedback);
    if (!lines.length) return [];
    const priorityPattern =
      /mastery signal|primary weak area|likely misconceptions|support priorities|learner profile|next checkpoint|recommended actions|observed strengths/i;
    const priority = lines.filter((line) => priorityPattern.test(line));
    const secondary = lines.filter((line) => !priorityPattern.test(line));
    const merged = [...priority, ...secondary];
    return Array.from(new Set(merged)).slice(0, 12);
  }, [selectedPlan]);

  const selectedPlanWeakArea = useMemo(() => {
    if (!selectedPlan) return primaryWeakArea;
    const selectedSubject = norm(selectedClass?.courseName || "");
    const matched = weakAreaItems.find((item) => {
      const itemSubject = norm(item?.subject || "");
      return selectedSubject && itemSubject === selectedSubject;
    });
    return (
      matched?.weakArea ||
      weakAreaItems[0]?.weakArea ||
      primaryWeakArea ||
      "No weak area flagged"
    );
  }, [primaryWeakArea, selectedClass?.courseName, selectedPlan, weakAreaItems]);

  const summary = useMemo(() => {
    const total = studentPlans.length;
    const activeCount = studentPlans.filter((plan) =>
      isActivePlanStatus(plan.status),
    ).length;
    const avgProgress = total
      ? Math.round(
          studentPlans.reduce(
            (sum, plan) => sum + (Number(plan.progress) || 0),
            0,
          ) / total,
        )
      : 0;

    const gradeSamples = classStudents
      .map((student) => parsePercent(student.avgGrade))
      .filter((value) => value !== null);
    const classAvgGrade = gradeSamples.length
      ? `${Math.round(gradeSamples.reduce((sum, value) => sum + value, 0) / gradeSamples.length)}%`
      : "--";

    return {
      total,
      activeCount,
      avgProgress,
      avgGrade:
        overview?.summary?.avgGrade ||
        selectedStudent?.avgGrade ||
        classAvgGrade ||
        "--",
      completionRate: overview?.summary?.completionRate || "--",
      totalAssessments: overview?.summary?.totalAssessments || 0,
    };
  }, [classStudents, overview, selectedStudent, studentPlans]);

  const closeClass = () => {
    setSelectedClass(null);
    setSelectedStudent(null);
    setOverview(null);
    setClassBundleLoading(false);
    setClassBundleLoaded(false);
    setClassBundleStudents([]);
    setClassBundlePlans([]);
    setClassBundleStats(null);
    setSelectedPlanId("");
    setStudentFilter("all");
    setStudentQuery("");
  };

  const resolveFilename = (headerValue, fallback = "plp-report.pdf") => {
    const value = String(headerValue || "");
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]).replace(/["']/g, "");
    }
    const basicMatch = value.match(/filename="?([^"]+)"?/i);
    return basicMatch?.[1] || fallback;
  };

  const handleExportPlan = async (plan = selectedPlan) => {
    const planId = String(plan?.id || "");
    if (!planId) {
      toast.error("Select a plan version first.");
      return;
    }

    try {
      setExportingPlanId(planId);
      const response = await api.get(`/teacher/plp/${planId}/export`, {
        responseType: "blob",
      });
      const safeName = (plan?.name || "plp")
        .replace(/[^a-z0-9-_]+/gi, "_")
        .slice(0, 60);
      const filename = resolveFilename(
        response.headers?.["content-disposition"],
        `${safeName || "plp"}_learning_plan.pdf`,
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export learning plan", error);
      toast.error("Failed to export learning plan.");
    } finally {
      setExportingPlanId("");
    }
  };

  if (loading) return <TeacherPageSkeleton variant="plp" />;

  if (!selectedClass) {
    return (
      <div className="w-full h-full font-sans animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Learning Plans
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={<BookOpen size={20} />}
              label="Classes"
              value={overallStats.classes}
            />
            <StatCard
              icon={<Users size={20} />}
              label="Students"
              value={overallStats.students}
            />
            <StatCard
              icon={<FileText size={20} />}
              label="Plans"
              value={overallStats.plans}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400">
                <Filter size={18} />
              </div>
              {subjects.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => setSubjectFilter(subject)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap ${
                    subjectFilter === subject
                      ? "bg-[#2D70FD] text-white shadow-lg shadow-blue-100"
                      : "bg-white text-slate-500 border border-slate-200 hover:border-blue-100"
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-96">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={20}
              />
              <input
                type="text"
                value={classQuery}
                onChange={(event) => setClassQuery(event.target.value)}
                placeholder="Search class..."
                className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700 shadow-sm"
              />
            </div>
          </div>

          {classes.length === 0 || filteredClasses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredClasses.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:border-blue-200 transition-all shadow-sm"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                      <BookOpen size={28} />
                    </div>
                    <div className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                      {item.level || "--"}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    {item.courseName || "Subject"}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mb-5">
                    {classLabel(item)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedClass(item)}
                    className="w-full py-4 bg-[#2D70FD] text-white rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#1E5CE0]"
                  >
                    <ArrowUpRight size={18} />
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedClass && !selectedStudent) {
    return (
      <div className="w-full h-full font-sans animate-in fade-in duration-500">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <button
                type="button"
                onClick={closeClass}
                className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:border-blue-200 hover:text-[#2D70FD]"
                aria-label="Back to class list"
              >
                <ChevronLeft size={16} />
              </button>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Learning Plans
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={<Users size={20} />}
              label="Students"
              value={classStats.total}
            />
            <StatCard
              icon={<CheckCircle2 size={20} />}
              label="With Plans"
              value={classStats.withPlans}
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Avg Progress"
              value={`${classStats.avgProgress}%`}
            />
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
                {["all", "with_plans", "without_plans"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStudentFilter(value)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest ${
                      studentFilter === value
                        ? "bg-[#2D70FD] text-white"
                        : "bg-white border border-slate-200 text-slate-500 hover:border-blue-200"
                    }`}
                  >
                    {value === "all"
                      ? "all"
                      : value === "with_plans"
                        ? "with plans"
                        : "without plans"}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-80">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="Search student..."
                  className="w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl outline-none focus:border-[#2D70FD] text-sm font-semibold text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-xl font-black text-slate-900">Students</h3>
                <p className="text-sm font-medium text-slate-500">
                  {selectedClass.courseName || "Subject"} -{" "}
                  {classLabel(selectedClass)}
                </p>
              </div>
              {classBundleLoading ? (
                <Loader2 size={20} className="animate-spin text-[#2D70FD]" />
              ) : null}
            </div>

            {classBundleLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-16 rounded-2xl bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredRows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {filteredRows.map((row) => {
                  const studentCode =
                    row.student.studentNumber || row.student.id || "--";
                  const isActiveStudent =
                    String(selectedStudent?.id || "") ===
                    String(row.student.id || "");
                  return (
                    <div
                      key={row.student.id}
                      className={`grid grid-cols-1 lg:grid-cols-[1.3fr_0.8fr_1fr_auto] gap-3 lg:items-center rounded-2xl border px-4 py-4 transition-colors ${
                        isActiveStudent
                          ? "border-blue-200 bg-blue-50/40"
                          : "border-slate-100 bg-slate-50/60"
                      }`}
                    >
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(row.student)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-[#2D70FD] truncate"
                        >
                          {row.student.name || "Student"}
                        </button>
                        <p className="text-xs font-medium text-slate-400 truncate">
                          {`Student No ${row.studentNo || "--"} | ID ${studentCode}`}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-widest ${
                          row.hasPlan
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.hasPlan ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Activity size={13} />
                        )}
                        {row.hasPlan ? "Has plans" : "No plan"}
                      </span>
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {row.totalPlans} plans
                        <span className="text-slate-400"> | </span>
                        {row.avgProgress}%
                        <span className="text-slate-400"> | </span>
                        {row.weakArea || "--"}
                      </p>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(row.student)}
                          className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-[#2D70FD] inline-flex items-center justify-center hover:bg-blue-50"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedStudent ? (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(null)}
                        className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:border-blue-200 hover:text-[#2D70FD]"
                        aria-label="Clear selected student"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportPlan(selectedPlan)}
                    disabled={!selectedPlan || Boolean(exportingPlanId)}
                    className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-4 hover:bg-[#1E5CE0] text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Download size={18} />
                    {exportingPlanId === String(selectedPlan?.id || "")
                      ? "Downloading..."
                      : "Download report"}
                  </button>
                </div>
              </div>

              {isOverviewLoading && !overview ? (
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-56 rounded-[2rem] bg-slate-100 animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              ) : studentPlans.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                      {filteredPlans.map((plan) => {
                        const isSelected =
                          String(selectedPlan?.id || "") ===
                          String(plan.id || "");
                        return (
                          <div
                            key={plan.id}
                            className={`bg-white border rounded-[2.5rem] p-8 transition-all shadow-sm h-full flex flex-col ${
                              isSelected
                                ? "border-[#2D70FD] ring-2 ring-blue-100"
                                : "border-slate-100 hover:border-blue-200"
                            }`}
                          >
                            <div className="flex justify-between items-start mb-6">
                              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                                <Target size={24} />
                              </div>
                              <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                                {plan.status || "Active"}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-1 line-clamp-2 min-h-[3.2rem] break-words">
                              {plan.name || "Learning Plan Version"}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 mb-4 truncate">
                              {plan.category ||
                                selectedClass.courseName ||
                                "Assessment"}
                            </p>
                            <p className="text-xs font-medium text-slate-400 mb-6">
                              Last assessment: {plan.lastAssessment || "--"}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPlanId(String(plan.id || ""))
                              }
                              className={`mt-auto w-full py-4 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 ${
                                isSelected
                                  ? "bg-blue-50 text-[#2D70FD] border border-blue-100"
                                  : "bg-[#2D70FD] text-white hover:bg-[#1E5CE0]"
                              }`}
                            >
                              <ArrowUpRight size={18} />
                              {isSelected ? "Opened" : "Open Version"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {selectedPlan ? (
                    <div className="space-y-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Selected Plan Details
                      </p>
                      <div className="bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-xl font-semibold text-slate-900 line-clamp-2 break-words">
                              {selectedPlan.name || "Learning Plan"}
                            </h3>
                          </div>
                        </div>
                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                              Progress
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {selectedPlan.progress || 0}%
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                              Last Assessment
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {selectedPlan.lastAssessment || "--"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                              Average Grade
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-800">
                              {summary.avgGrade}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                              Coverage
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm">
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-blue-50 text-[#2D70FD] rounded-xl flex items-center justify-center">
                              <AlertTriangle size={18} />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800">
                              Weakness Focus
                            </h4>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-sm font-semibold text-slate-800 break-words">
                              {selectedPlanWeakArea}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[2rem] p-7 shadow-sm">
                          <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-blue-50 text-[#2D70FD] rounded-xl flex items-center justify-center">
                              <Lightbulb size={18} />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-800">
                              Action Steps
                            </h4>
                          </div>
                          {selectedPlanSpecialDetails.length > 0 ? (
                            <div className="mb-4 space-y-2">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                AI Special Details
                              </p>
                              {selectedPlanSpecialDetails.map((detail, index) => (
                                <div
                                  key={`${detail}-${index}`}
                                  className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
                                >
                                  <p className="text-xs font-medium text-slate-700 leading-relaxed">
                                    {detail}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="space-y-3">
                            {selectedPlanAdvice.map((item, index) => (
                              <div
                                key={`${item}-${index}`}
                                className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 flex items-start gap-3"
                              >
                                <div className="w-7 h-7 rounded-full bg-[#2D70FD] text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </div>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                                  {item}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isOverviewLoading && !overview) {
    return <TeacherPageSkeleton variant="plp" />;
  }

  const studentName = selectedStudent?.name || "Student";
  const studentNumber =
    selectedStudent?.studentNumber || selectedStudent?.id || "--";
  const noPlans = studentPlans.length === 0;

  if (selectedPlan) {
    return (
      <div className="w-full h-full animate-in fade-in duration-500 font-sans">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanId("")}
                  className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:border-blue-200 hover:text-[#2D70FD]"
                  aria-label="Back to plan versions"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                {selectedPlan.name || "Learning Plan"}
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {studentName} | ID {studentNumber}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleExportPlan(selectedPlan)}
              disabled={Boolean(exportingPlanId)}
              className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-4 hover:bg-[#1E5CE0] text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {exportingPlanId === String(selectedPlan?.id || "")
                ? "Downloading..."
                : "Download report"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard
              icon={<Target size={20} />}
              label="Progress"
              value={`${selectedPlan.progress || 0}%`}
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Average Grade"
              value={summary.avgGrade}
            />
            <StatCard
              icon={<BookOpen size={20} />}
              label="Last Assessment"
              value={selectedPlan.lastAssessment || "--"}
            />
            <StatCard
              icon={<FileText size={20} />}
              label="Coverage"
              value={`${summary.totalAssessments}`}
              hint="assessments"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm xl:col-span-3">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-2xl flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Weakness Focus
                  </p>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Priority Area
                  </h3>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800 break-words">
                  {selectedPlanWeakArea}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {weakAreaItems.slice(0, 3).map((item, index) => (
                  <div
                    key={`${item.weakArea}-${index}`}
                    className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-slate-700 break-words">
                      {item.weakArea}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {item.subject || "Subject"} | {item.lastSeen || "--"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm xl:col-span-5 min-h-[30rem]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-2xl flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    AI Insight
                  </p>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Special Details
                  </h3>
                </div>
              </div>
              <p className="mb-3 text-xs font-medium text-slate-400">
                {selectedPlanSpecialDetails.length} insights
              </p>
              {selectedPlanSpecialDetails.length > 0 ? (
                <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                  {selectedPlanSpecialDetails.map((detail, index) => (
                    <div
                      key={`${detail}-${index}`}
                      className="px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70"
                    >
                      <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                        {detail}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-4">
                  <p className="text-sm font-medium text-slate-500">
                    No AI details for this version yet.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm xl:col-span-4">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-50 text-[#2D70FD] rounded-2xl flex items-center justify-center">
                  <Lightbulb size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                    Advice
                  </p>
                  <h3 className="text-lg font-semibold text-slate-800">
                    Recommended Actions
                  </h3>
                </div>
              </div>
              <div className="space-y-3">
                {selectedPlanAdvice.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#2D70FD] text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-black">Personalized Learning Plan</h1>
          <div className="text-sm">
            <div>Student: {studentName}</div>
            <div>Student Number: {studentNumber}</div>
            <div>
              Class: {selectedClass.classGroup || "--"} -{" "}
              {selectedClass.level || "--"}
            </div>
            <div>Subject: {selectedClass.courseName || "Course"}</div>
            <div>Average Grade: {summary.avgGrade}</div>
            <div>Completion Rate: {summary.completionRate}</div>
            <div>Primary Weak Area: {primaryWeakArea}</div>
          </div>

          <h2 className="text-lg font-black">Learning Plans</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b py-2">Plan</th>
                <th className="border-b py-2">Category</th>
                <th className="border-b py-2">Status</th>
                <th className="border-b py-2">Progress</th>
                <th className="border-b py-2">Last Assessment</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr key={plan.id}>
                  <td className="py-2 border-b">{plan.name}</td>
                  <td className="py-2 border-b">{plan.category || "--"}</td>
                  <td className="py-2 border-b">{plan.status || "--"}</td>
                  <td className="py-2 border-b">{plan.progress || 0}%</td>
                  <td className="py-2 border-b">
                    {plan.lastAssessment || "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-lg font-black">Weak Areas</h2>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b py-2">Weak Area</th>
                <th className="border-b py-2">Subject</th>
                <th className="border-b py-2">Occurrences</th>
                <th className="border-b py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {weakAreaItems.map((item, index) => (
                <tr key={`${item.weakArea}-${index}`}>
                  <td className="py-2 border-b">{item.weakArea}</td>
                  <td className="py-2 border-b">{item.subject || "--"}</td>
                  <td className="py-2 border-b">{item.occurrences || 0}</td>
                  <td className="py-2 border-b">{item.lastSeen || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-lg font-black">How To Overcome</h2>
          <ol className="list-decimal pl-5 text-sm space-y-2">
            {recommendations.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="print-hidden">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-500 inline-flex items-center justify-center hover:border-blue-200 hover:text-[#2D70FD]"
                  aria-label="Back to student list"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
                Learning Plan
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleExportPlan(selectedPlan)}
                disabled={!selectedPlan || Boolean(exportingPlanId)}
                className="h-12 rounded-2xl bg-[#2D70FD] text-white inline-flex items-center justify-center gap-2 px-4 hover:bg-[#1E5CE0] text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                {exportingPlanId === String(selectedPlan?.id || "")
                  ? "Downloading..."
                  : "Download report"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              icon={<User size={20} />}
              label="Student"
              value={studentName}
              hint={studentNumber}
            />
            <StatCard
              icon={<TrendingUp size={20} />}
              label="Average Grade"
              value={summary.avgGrade}
            />
            <StatCard
              icon={<Sparkles size={20} />}
              label="Plans"
              value={`${summary.activeCount}/${summary.total}`}
            />
          </div>

          {noPlans ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredPlans.map((plan) => {
                  return (
                    <div
                      key={plan.id}
                      className="bg-white border border-slate-100 rounded-[2.5rem] p-8 transition-all shadow-sm h-full flex flex-col hover:border-blue-200"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-50 text-[#2D70FD]">
                          <Target size={24} />
                        </div>
                        <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                          {plan.status || "Active"}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-1 line-clamp-2 min-h-[3.2rem] break-words">
                        {plan.name || "Learning Plan Version"}
                      </h3>
                      <p className="text-sm font-medium text-slate-500 mb-1 truncate">
                        {plan.category || selectedClass.courseName || "Assessment"}
                      </p>
                      <p className="text-xs font-medium text-slate-400 mb-6">
                        Last assessment: {plan.lastAssessment || "--"}
                      </p>

                      <button
                        type="button"
                        onClick={() => setSelectedPlanId(String(plan.id || ""))}
                        className="mt-auto w-full py-4 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-2 bg-[#2D70FD] text-white hover:bg-[#1E5CE0]"
                      >
                        <ArrowUpRight size={18} />
                        Open Details
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, hint }) => (
  <div className="w-full max-w-[24rem] mx-auto bg-white border border-slate-100 p-6 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-center shadow-sm min-h-[9.5rem]">
    <div className="w-12 h-12 rounded-xl inline-flex items-center justify-center bg-blue-50 text-[#2D70FD] shrink-0">
      {icon}
    </div>
    <div className="min-w-0 w-full">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p
        title={
          typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined
        }
        className="text-lg md:text-xl font-bold text-slate-800 leading-tight whitespace-normal break-words [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
      >
        {value}
      </p>
      {hint ? (
        <p
          title={
            typeof hint === "string" || typeof hint === "number"
              ? String(hint)
              : undefined
          }
          className="text-xs font-medium text-slate-400 mt-1 whitespace-normal break-words leading-snug [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden"
        >
          {hint}
        </p>
      ) : null}
    </div>
  </div>
);

export default TeacherPLP;
