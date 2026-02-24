import React from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import ManziImg from "../../assets/Seraphin.jpeg";
import SergeImg from "../../assets/Serge.png";
import AlbertImg from "../../assets/Albert.jpeg";
import ChasteImg from "../../assets/Chaste.png";
import IsabelleImg from "../../assets/Isabelle.png";

const Team = () => {
  const team = [
    {
      name: "MANZI SHIMWA Yves Seraphin",
      role: "Frontend Enginner",
      image: ManziImg,
      linkedin: "#",
      github: "#",
    },
    {
      name: "ABIJURU Serge",
      role: "Database Analyst",
      image: SergeImg,
      linkedin: "#",
      github: "#",
    },
    {
      name: "UWUMUREMYI Albert",
      role: "Backend Engineer",
      image: AlbertImg,
      linkedin: "#",
      github: "#",
    },
    {
      name: "GANZA MUGANAMFURA Chaste",
      role: "AI Engineer",
      image: ChasteImg,
      linkedin: "#",
      github: "#",
    },
    {
      name: "UTUJE Cadeau Isabelle",
      role: "QA Tester",
      image: IsabelleImg,
      linkedin: "#",
      github: "#",
    },
  ];

  return (
    <section
      id="team"
      className="py-24 bg-white font-sans relative overflow-hidden"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#f1f5f9_0%,transparent_50%)]"></div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
            Meet the <span className="text-[#2D70FD]">Team</span>
          </h2>
          <div className="w-12 h-1.5 bg-[#2D70FD] mx-auto rounded-full mb-6"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {team.map((member, index) => (
            <div key={index} className="group flex flex-col items-center">
              <div className="w-26 h-26 md:w-26 md:h26 rounded-full overflow-hidden mb-6 bg-slate-100 border-4 border-white shadow-lg transition-all duration-500 group-hover:shadow-2xl group-hover:scale-105">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-1 leading-tight">
                  {member.name}
                </h3>
                <p className="text-slate-500 text-xs font-bold tracking-widest mb-4 text-[15px]">
                  {member.role}
                </p>
                <div className="flex items-center justify-center gap-3 transition-all duration-300">
                  <a
                    href={member.linkedin}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-[#2D70FD] hover:text-white transition-all"
                  >
                    <Linkedin size={20} />
                  </a>
                  <a
                    href={member.github}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <Github size={20} />
                  </a>
                  <a
                    href={`mailto:#`}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-green-500 hover:text-white transition-all"
                  >
                    <Mail size={20} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Team;

