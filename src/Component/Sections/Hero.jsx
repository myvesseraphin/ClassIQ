import React from "react";
import computer from "../../assets/Math.png";
import phone from "../../assets/Google.png";

const Hero = () => {
  return (
    <section
      id="hero"
      className="relative w-full bg-white overflow-hidden pb-20 md:pb-32"
    >
      <div className="max-w-7xl mx-auto px-10 pt-20 md:pt-32 flex flex-col md:flex-row items-center gap-16 relative z-10">
        <div className="flex-1 text-left">
          <h1 className="text-6xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tighter mb-8">
            Data-Driven. <br />
            <span className="text-[#2D70FD]">Success </span>
          </h1>
          <p className="max-w-md text-lg text-slate-500 font-medium leading-relaxed mb-10">
            Everything you need to transform school data into actionable
            intelligence. All in one place.
          </p>
          <button className="bg-slate-900 text-white px-10 py-4 rounded-full font-bold text-[15px] hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-200">
            Get Started
          </button>
        </div>
        <div className="flex-1 relative w-full h-[400px] md:h-[500px]">
          <div className="absolute top-0 left-0 w-full h-full z-10">
            <img
              src={computer}
              alt="Laptop"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="absolute inset-0 z-15 pointer-events-none">
            <span
              className="particle"
              style={{
                top: "6%",
                left: "-6%",
                width: 12,
                height: 12,
                animationDelay: "0s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "20%",
                left: "-10%",
                width: 18,
                height: 18,
                animationDelay: "0.6s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "40%",
                left: "-4%",
                width: 10,
                height: 10,
                animationDelay: "1.2s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "-6%",
                left: "72%",
                width: 14,
                height: 14,
                animationDelay: "0.3s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "-10%",
                left: "88%",
                width: 10,
                height: 10,
                animationDelay: "1s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "60%",
                left: "102%",
                width: 20,
                height: 20,
                animationDelay: "0.4s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "72%",
                left: "110%",
                width: 12,
                height: 12,
                animationDelay: "0.8s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "50%",
                left: "95%",
                width: 16,
                height: 16,
                animationDelay: "1.6s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "92%",
                left: "10%",
                width: 14,
                height: 14,
                animationDelay: "0.9s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "82%",
                left: "36%",
                width: 10,
                height: 10,
                animationDelay: "1.4s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "48%",
                left: "60%",
                width: 8,
                height: 8,
                animationDelay: "2s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "28%",
                left: "84%",
                width: 12,
                height: 12,
                animationDelay: "1.1s",
              }}
            />
            <span
              className="particle"
              style={{
                top: "14%",
                left: "60%",
                width: 9,
                height: 9,
                animationDelay: "1.8s",
              }}
            />
          </div>

          <div className="absolute -bottom-12 -right-8 w-[38%] h-[70%] z-20 transition-transform hover:scale-105 duration-500">
            <img
              src={phone}
              alt="Phone"
              className="w-full h-full object-contain filter drop-shadow-2xl"
            />
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full overflow-hidden line-height-0">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-full h-[60px] md:h-[100px] fill-slate-50/80"
        >
          <path d="M0,0 C300,100 900,10 1200,80 L1200,120 L0,120 Z"></path>
        </svg>
      </div>
    </section>
  );
};

export default Hero;

