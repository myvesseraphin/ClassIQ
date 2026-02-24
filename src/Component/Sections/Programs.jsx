import React from "react";
import reb from "../../assets/REB.png";
import nesa from "../../assets/NESA.png";
import rtB from "../../assets/RTB.png";

const SupportedPrograms = () => {
  const programs = [
    { name: "REB", logo: reb },
    { name: "NESA", logo: nesa },
    { name: "RTB", logo: rtB },
  ];

  return (
    <section id="programs" className="w-full bg-slate-50/80 pb-20 pt-10">
      <div className="max-w-7xl mx-auto px-10">
        <div className="text-center mb-12">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
            We support various{" "}
            <span className="text-[#2D70FD]">education programs</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          {programs.map((program, index) => (
            <div key={index} className="flex items-center justify-center">
              <img
                src={program.logo}
                alt={program.name}
                className="h-15 md:h-20 w-auto object-contain transition-transform hover:scale-110"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SupportedPrograms;

