import React from "react";
import LandingNavbar from "../Component/LandingNavbar";
import Hero from "../Component/Sections/Hero";
import Programs from "../Component/Sections/Programs";
import Features from "../Component/Sections/Features";
import Impact from "../Component/Sections/Impact";
import Team from "../Component/Sections/Team";
import Footer from "../Component/Sections/Footer";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      {}
      <main className="pt-32 md:pt-44">
        <Hero />
        <Programs />
        <Features />
        <Impact />
        <Team />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
