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

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const navLinks = [
    { name: "Home", href: "#hero" },
    { name: "Programs", href: "#programs" },
    { name: "Features", href: "#features" },
    { name: "About", href: "#impact" },
    { name: "Team", href: "#team" },
  ];

  const handleNavLinkClick = (href) => {
    setIsMenuOpen(false);
    const target = document.querySelector(href);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 w-full z-[100] transition-all duration-500 ${
        isScrolled
          ? "bg-white/90 backdrop-blur-xl py-3 md:py-4 shadow-sm border-b border-slate-100"
          : "bg-transparent py-4 md:py-8"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/")}
        >
          <img
            src={logo}
            alt="ClassIQ"
            className="w-10 h-10 md:w-12 md:h-12 object-contain"
          />
          <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter">
            ClassIQ
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-10">
          <div className="flex items-center gap-10 text-[16px] font-medium text-slate-600">
            {navLinks.map((link) => (
              <button
                key={link.name}
                className="hover:text-black transition-colors"
                onClick={() => handleNavLinkClick(link.href)}
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/login")}
              className="px-7 py-3 rounded-full font-bold text-[15px] text-slate-900 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200/50"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/library-login")}
              className="px-7 py-3 rounded-full font-bold text-[15px] text-white bg-black hover:bg-slate-900 transition-all"
            >
              Library
            </button>
          </div>
        </div>
        <button
          className="lg:hidden p-2.5 text-slate-600 rounded-xl border border-slate-200/70 bg-white/90"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {isMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 top-[72px] bg-slate-900/35 backdrop-blur-[1px]"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="lg:hidden fixed top-[78px] left-4 right-4 max-h-[calc(100vh-92px)] overflow-y-auto rounded-3xl border border-slate-100 bg-white shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-top-4">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  className="w-full text-left px-4 py-3 rounded-xl text-base font-bold text-slate-900 hover:bg-blue-50 hover:text-[#2D70FD] transition-colors"
                  onClick={() => handleNavLinkClick(link.href)}
                >
                  {link.name}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate("/login");
                }}
                className="w-full bg-slate-100 py-3.5 rounded-full font-bold text-slate-900"
              >
                Log In
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate("/library-login");
                }}
                className="w-full bg-black text-white py-3.5 rounded-full font-bold"
              >
                Library
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default LandingNavbar;
