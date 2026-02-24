import React from "react";
import { Facebook, Twitter, Linkedin } from "lucide-react";
import logo from "../../assets/logo.png";

const Footer = () => {
  return (
    <footer className="relative bg-white pt-16 pb-12 overflow-hidden font-sans">
      <div
        className="w-full h-6 opacity-[0.03] mb-12"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 L20 0 L40 20' fill='none' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E")`,
          backgroundSize: "32px 16px",
        }}
      ></div>

      <div className="max-w-7xl mx-auto px-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 mb-24">
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex items-center gap-3 self-start">
              <img
                src={logo}
                alt="ClassIQ Logo"
                className="h-9 w-auto object-contain"
              />
              <span className="text-2xl font-black tracking-tighter text-slate-900">
                ClassIQ
              </span>
            </div>

            <p className="text-slate-500 font-medium leading-relaxed text-[15px] max-w-sm">
              Advanced Performance Analysis and Productivity Tracking for the
              modern educational landscape in Rwanda.
            </p>

            <div className="flex gap-4 mt-2">
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-[#2D70FD] hover:bg-blue-50 transition-all duration-300"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-[#2D70FD] hover:bg-blue-50 transition-all duration-300"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-[#2D70FD] hover:bg-blue-50 transition-all duration-300"
              >
                <Facebook size={18} />
              </a>
            </div>
          </div>

          <div className="hidden lg:block lg:col-span-2"></div>
          <div className="lg:col-span-3 flex flex-col items-center text-center">
            <h4 className="text-slate-900 font-black mb-8 uppercase tracking-[0.25em] text-[11px]">
              Platform
            </h4>
            <ul className="flex flex-col gap-5 text-slate-500 font-bold text-[14px]">
              <li>
                <a
                  href="#hero"
                  className="hover:text-[#2D70FD] transition-colors duration-300"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#impact"
                  className="hover:text-[#2D70FD] transition-colors duration-300"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="hover:text-[#2D70FD] transition-colors duration-300"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#team"
                  className="hover:text-[#2D70FD] transition-colors duration-300"
                >
                  Our Team
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-slate-400 text-[12px] font-bold tracking-tight">
            © 2026 ClassIQ. All rights reserved.
          </p>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            <span className="cursor-default hover:text-slate-400 transition-colors">
              Data-Driven
            </span>
            <span className="cursor-default hover:text-slate-400 transition-colors">
              Success
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

