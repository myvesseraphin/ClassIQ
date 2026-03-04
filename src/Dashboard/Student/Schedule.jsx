import React, { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, Clock, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/client";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const hourFromTime = (value) => {
  const hour = Number(String(value || "0").split(":")[0]);
  return Number.isFinite(hour) ? hour : 0;
};

const durationHours = (startTime, endTime) =>
  Math.max(1, hourFromTime(endTime) - hourFromTime(startTime));

const colorByTitle = (value) => {
  const palette = [
    "bg-blue-100 border-blue-300",
    "bg-emerald-100 border-emerald-300",
    "bg-amber-100 border-amber-300",
    "bg-rose-100 border-rose-300",
  ];
  const seed = String(value || "")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
};

const Schedule = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [classMeta, setClassMeta] = useState(null);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [teachingHours, setTeachingHours] = useState({
    todayHours: 0,
    weeklyHours: 0,
  });

  const loadTimetable = async () => {
    try {
      const { data } = await api.get("/student/class-timetable");
      setClasses(Array.isArray(data?.classes) ? data.classes : []);
      setClassMeta(data?.classMeta || null);
      setCurrentLesson(data?.currentLesson || null);
      setTeachingHours({
        todayHours: Number(data?.teachingHours?.todayHours) || 0,
        weeklyHours: Number(data?.teachingHours?.weeklyHours) || 0,
      });
    } catch (err) {
      console.error("Failed to load class timetable", err);
      toast.error(err?.response?.data?.error || "Failed to load class timetable.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTimetable();
    const timer = window.setInterval(loadTimetable, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });
  }, [classes]);

  const startHour = 7;
  const endHour = 20;
  const hourSlots = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="max-w-full">
        <div className="px-6 py-8 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/student")}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={24} className="text-slate-600" />
              </button>
              <div>
                <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                  <Calendar size={32} className="text-blue-600" />
                  Class Timetable
                </h1>
                <p className="text-slate-600 text-sm font-bold mt-1">
                  {classMeta?.gradeLevel ? `${classMeta.gradeLevel} ` : ""}
                  {classMeta?.className || "Class"} | Real-time lesson tracker
                </p>
              </div>
            </div>
          </div>
        </div>

        <main className="p-6 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={<Clock size={16} />}
              label="Today's Class Hours"
              value={`${teachingHours.todayHours}h`}
            />
            <StatCard
              icon={<Calendar size={16} />}
              label="Weekly Class Hours"
              value={`${teachingHours.weeklyHours}h`}
            />
            <StatCard
              icon={<Users size={16} />}
              label="Current Lesson"
              value={currentLesson?.title || "No class in progress"}
            />
          </section>

          {currentLesson ? (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                Live Now
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {currentLesson.title}
              </p>
              <p className="text-sm font-bold text-slate-600">
                {currentLesson.startTime}-{currentLesson.endTime}
                {currentLesson.room ? ` | ${currentLesson.room}` : ""}
                {currentLesson.instructor ? ` | ${currentLesson.instructor}` : ""}
                {typeof currentLesson.remainingMinutes === "number"
                  ? ` | ${currentLesson.remainingMinutes} min left`
                  : ""}
              </p>
            </section>
          ) : null}

          <section className="flex-1 overflow-auto no-scrollbar bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="min-w-[980px]">
              <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                <div className="grid grid-cols-[88px_repeat(7,minmax(120px,1fr))]">
                  <div className="p-3 border-r border-slate-100" />
                  {DAY_LABELS.map((label) => (
                    <div
                      key={label}
                      className="text-center p-3 border-r border-slate-100 last:border-r-0"
                    >
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                {hourSlots.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[88px_repeat(7,minmax(120px,1fr))] border-b border-slate-100"
                  >
                    <div className="text-right pr-3 py-2 text-xs font-black text-slate-500 border-r border-slate-100">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                    </div>
                    {DAY_LABELS.map((_, dayIdx) => (
                      <div
                        key={dayIdx}
                        className="relative min-h-[72px] border-r border-slate-100 last:border-r-0"
                      >
                        {sortedClasses
                          .filter(
                            (item) =>
                              item.day === dayIdx &&
                              hourFromTime(item.startTime) === hour,
                          )
                          .map((item) => (
                            <article
                              key={item.id}
                              className={`absolute inset-x-1 top-1 rounded-xl border-2 p-2 text-xs text-slate-900 ${colorByTitle(item.title)} shadow-sm`}
                              style={{
                                height: `calc(${durationHours(item.startTime, item.endTime) * 100}% + ${(durationHours(item.startTime, item.endTime) - 1) * 8}px)`,
                              }}
                            >
                              <p className="font-black line-clamp-2">{item.title}</p>
                              <p className="text-[10px] opacity-80">
                                {item.startTime} - {item.endTime}
                              </p>
                              {item.room ? (
                                <p className="text-[10px] opacity-75 line-clamp-1 flex items-center gap-1">
                                  <MapPin size={10} /> {item.room}
                                </p>
                              ) : null}
                              {item.instructor ? (
                                <p className="text-[10px] opacity-75 line-clamp-1">
                                  {item.instructor}
                                </p>
                              ) : null}
                            </article>
                          ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {!isLoading && sortedClasses.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-slate-500">
                No class timetable available yet.
              </div>
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 inline-flex items-center gap-1">
      {icon}
      {label}
    </p>
    <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
  </div>
);

export default Schedule;
