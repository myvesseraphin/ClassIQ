import React, { useState } from "react";
import { Calendar, Plus, X, Clock, MapPin, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/client";

const Schedule = () => {
  const navigate = useNavigate();
  const getCurrentWeekStart = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  };
  const [currentWeekStart] = useState(getCurrentWeekStart());
  const [showAddClass, setShowAddClass] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classData, setClassData] = useState({
    day: 0,
    startTime: "08:00",
    endTime: "09:00",
    title: "",
    room: "",
    instructor: "",
  });

  React.useEffect(() => {
    let isMounted = true;
    const loadSchedule = async () => {
      try {
        const { data } = await api.get("/student/schedule");
        if (isMounted && Array.isArray(data?.classes)) {
          setClasses(data.classes);
        }
      } catch (err) {
        console.error("Failed to load schedule", err);
        toast.error("Failed to load schedule.");
      }
    };
    loadSchedule();
    return () => {
      isMounted = false;
    };
  }, []);

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const timeHours = Array.from({ length: 10 }, (_, i) => i + 8);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(currentWeekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getTimePosition = (timeStr) => {
    const [hours] = timeStr.split(":").map(Number);
    return hours - 8;
  };

  const getDuration = (startStr, endStr) => {
    const [startHour] = startStr.split(":").map(Number);
    const [endHour] = endStr.split(":").map(Number);
    return endHour - startHour;
  };

  const getColorBySubject = (title) => {
    const colors = [
      "bg-blue-100 border-blue-300",
      "bg-green-100 border-green-300",
    ];
    const index = title.charCodeAt(0) % 2;
    return colors[index];
  };

  const addClass = async () => {
    if (!classData.title || !classData.startTime || !classData.endTime) {
      alert("Please fill in all required fields");
      return;
    }
    try {
      const payload = {
        ...classData,
        day: parseInt(classData.day),
      };
      const { data } = await api.post("/student/schedule", payload);
      setClasses((prev) => [...prev, data.class]);
      setClassData({
        day: 0,
        startTime: "08:00",
        endTime: "09:00",
        title: "",
        room: "",
        instructor: "",
      });
      setShowAddClass(false);
    } catch (err) {
      console.error("Failed to add class", err);
      toast.error("Failed to add class.");
    }
  };

  const deleteClass = async (id) => {
    try {
      await api.delete(`/student/schedule/${id}`);
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to delete class", err);
      toast.error("Failed to delete class.");
    }
  };

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
                  My Schedule
                </h1>
                <p className="text-slate-600 text-sm font-bold mt-1">
                  {currentWeekStart.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  - Week View
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddClass(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors active:scale-95"
            >
              <Plus size={20} />
              Add Class
            </button>
          </div>
        </div>

        <main className="p-6">
          <div className="flex flex-col gap-6">
            <div className="flex-1 overflow-auto no-scrollbar bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="min-w-full">
                <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                  <div className="flex">
                    <div className="w-24 min-w-fit border-r border-slate-100 p-2"></div>
                    {weekDates.map((date, idx) => (
                      <div
                        key={idx}
                        className="flex-1 min-w-32 text-center p-3 border-r border-slate-100 last:border-r-0"
                      >
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                          {daysOfWeek[idx]}
                        </p>
                        <p className="text-lg font-black text-slate-900">
                          {date.getDate()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  {timeHours.map((hour) => (
                    <div key={hour} className="flex border-b border-slate-100">
                      <div className="w-24 min-w-fit text-right pr-3 py-2 text-xs font-black text-slate-500 border-r border-slate-100">
                        {hour > 12
                          ? `${hour - 12} PM`
                          : hour === 12
                            ? "12 PM"
                            : `${hour} AM`}
                      </div>
                      {weekDates.map((date, dayIdx) => (
                        <div
                          key={dayIdx}
                          className="flex-1 min-w-32 h-20 border-r border-slate-100 relative last:border-r-0 bg-white hover:bg-slate-50 transition-colors"
                        >
                          {classes
                            .filter(
                              (c) =>
                                c.day === dayIdx &&
                                getTimePosition(c.startTime) === hour - 8,
                            )
                            .map((cls) => {
                              const duration = getDuration(
                                cls.startTime,
                                cls.endTime,
                              );
                              return (
                                <div
                                  key={cls.id}
                                  className={`absolute inset-x-1 rounded-lg p-2 ${getColorBySubject(cls.title)} border-2 text-xs font-bold text-slate-900 overflow-hidden group cursor-pointer hover:shadow-lg transition-all`}
                                  style={{
                                    top: "2px",
                                    height: `calc(${duration * 100}% + ${(duration - 1) * 20}px)`,
                                  }}
                                >
                                  <p className="font-black line-clamp-2">
                                    {cls.title}
                                  </p>
                                  <p className="text-[10px] opacity-75 line-clamp-1">
                                    {cls.startTime}
                                  </p>
                                  <button
                                    onClick={() => deleteClass(cls.id)}
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-200 rounded text-slate-600 hover:text-red-700"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showAddClass && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-black/20 backdrop-blur-sm">
          <div className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-slate-900">
                  Add Class
                </h2>
                <button
                  onClick={() => setShowAddClass(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Day of Week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={classData.day}
                    onChange={(e) =>
                      setClassData({
                        ...classData,
                        day: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Class
                  </label>
                  <input
                    type="text"
                    value={classData.title}
                    onChange={(e) =>
                      setClassData({ ...classData, title: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={classData.startTime}
                    onChange={(e) =>
                      setClassData({ ...classData, startTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={classData.endTime}
                    onChange={(e) =>
                      setClassData({ ...classData, endTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Room
                  </label>
                  <input
                    type="text"
                    value={classData.room}
                    onChange={(e) =>
                      setClassData({ ...classData, room: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-2">
                    Instructor
                  </label>
                  <input
                    type="text"
                    value={classData.instructor}
                    onChange={(e) =>
                      setClassData({ ...classData, instructor: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddClass(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-black text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addClass}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors active:scale-95"
                >
                  Add Class
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
