import React from "react";
import {
  BarChart2,
  Search,
  LineChart,
  Calendar,
  FileCheck,
  UserCheck,
} from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "Performance Analysis",
      desc: "Transform raw school data into deep-dive diagnostics and actionable intelligence.",
      icon: <BarChart2 className="text-[#1877F2]" />,
    },
    {
      title: "Weakness Detection",
      desc: "AI-driven identification of student-specific weak topics to bridge learning gaps immediately.",
      icon: <Search className="text-[#1877F2]" />,
    },
    {
      title: "Productivity Tracking",
      desc: "Monitor real-time curriculum coverage and teacher progress against school goals.",
      icon: <LineChart className="text-[#1877F2]" />,
    },
    {
      title: "Course Scheduling",
      desc: "Systematically create and manage subject timetables for all classes with ease.",
      icon: <Calendar className="text-[#1877F2]" />,
    },
    {
      title: "Grade Reports",
      desc: "Automated academic reports generated instantly from teacher data inputs.",
      icon: <FileCheck className="text-[#1877F2]" />,
    },
    {
      title: "Attendance Tracking",
      desc: "Digital attendance marking with comprehensive system-wide overview reports.",
      icon: <UserCheck className="text-[#1877F2]" />,
    },
  ];

  return (
    <section id="features" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 animate-fade-in">
          <p className="text-[#1877F2] font-bold uppercase tracking-widest text-sm mb-4">
            Features
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
            Our Features & Services
          </h2>
          <div className="w-16 h-1 bg-[#1877F2] mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex flex-col items-center bg-white p-12 rounded-2xl border border-slate-100 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-2xl hover:-translate-y-3 group animate-fade-up"
              style={{
                animationDelay: `${i * 150}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="mb-10 w-24 h-24 flex items-center justify-center bg-blue-50 rounded-full transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                {React.cloneElement(f.icon, { size: 40, strokeWidth: 1.5 })}
              </div>

              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-4 transition-colors duration-300 group-hover:text-[#1877F2]">
                  {f.title}
                </h3>
                <p className="text-slate-500 font-medium leading-relaxed text-base transition-colors duration-300 group-hover:text-slate-600">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 1s ease-out;
        }
        .animate-fade-up {
          animation: fadeUp 0.8s ease-out;
        }
      `}</style>
    </section>
  );
};

export default Features;
