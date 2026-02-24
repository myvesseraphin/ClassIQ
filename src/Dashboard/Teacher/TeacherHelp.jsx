import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle,
  ClipboardCheck,
  Target,
  FileText,
  Brain,
  Calendar,
  Bell,
  ShieldCheck,
  Mail,
} from "lucide-react";

const TeacherHelp = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: "qa-assessments",
      title: "Generate Diagnostic Assessment",
      desc: "Create end-unit assessments for a class or student.",
      route: "/teacher/assessments",
      icon: ClipboardCheck,
    },
    {
      id: "qa-weak-areas",
      title: "Review Weak Areas",
      desc: "See AI-flagged gaps and plan interventions.",
      route: "/teacher/weak-areas",
      icon: Target,
    },
    {
      id: "qa-plp",
      title: "Open PLP Generator",
      desc: "Create printable personalized learning plans.",
      route: "/teacher/plp",
      icon: FileText,
    },
    {
      id: "qa-exercises",
      title: "Create Exercises",
      desc: "Auto-generate exercises linked to weak topics.",
      route: "/teacher/exercises",
      icon: Brain,
    },
    {
      id: "qa-outline",
      title: "Build Daily Outline",
      desc: "Align lessons with curriculum and timetable.",
      route: "/teacher/outline",
      icon: Calendar,
    },
  ];

  const faqs = [
    {
      id: "faq-1",
      question: "How does ClassIQ identify weak areasv",
      answer:
        "The system analyzes marks, attendance, and behavior data to highlight skills that need intervention.",
    },
    {
      id: "faq-2",
      question: "Can I print PLPs and exercisesv",
      answer:
        "Yes. Generated PLPs and exercises are designed to be printable for student use.",
    },
    {
      id: "faq-3",
      question: "What is teaching impact analyticsv",
      answer:
        "It shows class performance trends and how teaching strategies affect outcomes.",
    },
    {
      id: "faq-4",
      question: "How do I create a daily course outlinev",
      answer:
        "Go to Daily Outline and select a class and subject to generate a lesson plan based on the curriculum.",
    },
  ];

  return (
    <div className="space-y-10 font-sans text-slate-900">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <HelpCircle size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Teacher Help</h1>
          <p className="text-slate-500 font-medium">
            Guidance for diagnostics, planning, and classroom insights.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-slate-900">
            <Bell size={18} className="text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-widest">
              Notifications
            </h3>
          </div>
          <p className="text-sm text-slate-500">
            Get updates on new assessment results, weak-area alerts, and system tips.
          </p>
          <button
            onClick={() => navigate("/teacher/notifications")}
            className="text-xs font-black uppercase tracking-widest text-blue-600"
          >
            Open Notifications
          </button>
        </div>

        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-slate-900">
            <ShieldCheck size={18} className="text-blue-600" />
            <h3 className="text-sm font-black uppercase tracking-widest">
              Account Security
            </h3>
          </div>
          <p className="text-sm text-slate-500">
            Keep your account secure and never share verification codes.
          </p>
          <button
            onClick={() => navigate("/teacher/profile")}
            className="text-xs font-black uppercase tracking-widest text-blue-600"
          >
            Update Profile
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={18} className="text-blue-600" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => navigate(action.route)}
                className="text-left bg-slate-50/60 border border-slate-100 rounded-2xl p-5 hover:bg-blue-50/50 hover:border-blue-100 transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-blue-600">
                    <Icon size={18} />
                  </span>
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">
                    {action.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-500">{action.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <HelpCircle size={18} className="text-blue-600" />
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
            Common Questions
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.id}
              className="group border border-slate-100 rounded-2xl bg-slate-50/60 overflow-hidden"
            >
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">{item.question}</h3>
                <span className="text-slate-400 text-xs font-black uppercase tracking-widest group-open:rotate-180 transition-transform">
                  v
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm text-slate-500 border-t border-slate-100">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Need more helpv
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Contact support and include a screenshot if possible.
          </p>
        </div>
        <a
          href="mailto:support@classiq.app"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest"
        >
          <Mail size={16} />
          Email Support
        </a>
      </div>
    </div>
  );
};

export default TeacherHelp;
