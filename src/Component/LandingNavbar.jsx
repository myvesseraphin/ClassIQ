import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "../assets/logo.png";
const LandingNavbar = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "#hero" },
    { name: "Programs", href: "#programs" },
    { name: "Features", href: "#features" },
    { name: "About", href: "#impact" },
    { name: "Team", href: "#team" },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl py-5 shadow-sm border-b border-slate-100"
          : "bg-transparent py-10"
      }`}
    >
      <div className="max-w-7xl mx-auto px-10 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <img src={logo} alt="ClassIQ" className="w-12 h-12 object-contain" />
          <span className="text-3xl font-black text-slate-900 tracking-tighter">
            ClassIQ
          </span>
        </div>
        <div className="hidden md:flex items-center gap-12">
          <div className="flex items-center gap-10 text-[16px] font-medium text-slate-600">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="hover:text-black transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/login")}
              className="px-8 py-3 rounded-full font-bold text-[15px] text-slate-900 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200/50"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/library-login")}
              className="px-8 py-3 rounded-full font-bold text-[15px] text-white bg-black hover:bg-slate-900 transition-all"
            >
              Library
            </button>
          </div>
        </div>
        <button
          className="md:hidden p-2 text-slate-600"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 p-10 flex flex-col gap-8 animate-in slide-in-from-top-4">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-lg font-bold text-slate-900"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <div className="flex flex-col gap-4">
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-slate-100 py-4 rounded-full font-bold"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/library-login")}
              className="w-full bg-black text-white py-4 rounded-full font-bold"
            >
              Library
            </button>
            <button
              onClick={() => navigate("/login")}
              className="bg-[#2D70FD] text-white px-9 py-3.5 rounded-full font-bold text-[15px] hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
              Get started
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default LandingNavbar;
