import React from "react";
import { Monitor, ShieldCheck, BookOpen, Users } from "lucide-react";
import MockupImage from "../../assets/Student.png";

const Impact = () => {
  const points = [
    {
      text: "Teachers only focus on teaching while everything else is digitized seamlessly",
      icon: <Monitor size={20} />,
    },
    {
      text: "Schools' Admins are able to access every recorded data with analytics at their fingertips",
      icon: <ShieldCheck size={20} />,
    },
    {
      text: "Students access learning materials and do some quizzes and assignments on the platform",
      icon: <BookOpen size={20} />,
    },
    {
      text: "Parents can monitor their children's performance live and communicate with schools",
      icon: <Users size={20} />,
    },
  ];

  return (
    <section
      id="impact"
      className="pt-32 pb-48 bg-white relative overflow-hidden font-sans"
    >
      <div className="absolute top-0 left-0 w-full h-[2px] bg-slate-100 overflow-hidden">
        <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-[#1877F2] to-transparent animate-border-beam"></div>
      </div>
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0]">
        <svg
          className="relative block w-[calc(100%+1.3px)] h-[60px]"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5,73.84-4.36,147.54,16.88,218.2,35.26,69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            fill="#F1F5F9"
            className="animate-wave-slow"
          ></path>
        </svg>
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(#1877F2 1.5px, transparent 1.5px)`,
            backgroundSize: "38px 38px",
          }}
        ></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,white_90%)]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-10 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-24">
          <div className="flex-[1.2] w-full relative flex justify-center lg:justify-start">
            <div className="relative animate-float transition-all duration-1000 ease-in-out hover:scale-[1.03]">
              <img
                src={MockupImage}
                alt="ClassIQ Dashboard"
                className="w-full max-w-[650px] h-auto drop-shadow-[0_40px_60px_rgba(24,119,242,0.15)] rounded-2xl"
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-blue-500/10 blur-[140px] rounded-full -z-10"></div>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 mb-8 leading-[1.1]">
              What We Do
            </h2>
            <p className="text-slate-500 text-[18px] font-medium leading-relaxed mb-12 max-w-lg">
              <span className="text-slate-500 font-bold">
                Software As Service
              </span>{" "}
              provided as a 'school information management system' with a
              tripartite user base.
            </p>

            <div className="grid gap-y-10">
              {points.map((point, index) => (
                <div key={index} className="flex items-start gap-6 group">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-white text-[#1877F2] rounded-2xl border border-slate-100 group-hover:bg-[#1877F2] group-hover:text-white group-hover:border-[#1877F2] group-hover:shadow-lg transition-all duration-500 shadow-sm">
                    {point.icon}
                  </div>
                  <div className="pt-1">
                    <p className="text-slate-500 text-[18px] font-medium leading-relaxed group-hover:text-slate-900 transition-colors duration-300">
                      {point.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-[0]">
        <svg
          className="relative block w-[calc(120%+1.3px)] h-[80px] animate-wave-move"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            fill="#F1F5F9"
          ></path>
        </svg>
      </div>

      <style>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        @keyframes borderBeam {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
        @keyframes waveMove {
          0% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-5%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-border-beam {
          animation: borderBeam 4s infinite linear;
        }
        .animate-wave-move {
          animation: waveMove 10s ease-in-out infinite;
        }
        .animate-wave-slow {
          animation: waveMove 15s ease-in-out infinite reverse;
        }
      `}</style>
    </section>
  );
};

export default Impact;

