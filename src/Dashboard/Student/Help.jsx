import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HelpCircle,
  BookOpen,
  FileCheck,
  ClipboardList,
  Calendar,
  Bell,
  UserCircle,
  Search,
  Mail,
  ShieldCheck,
} from "lucide-react";

const Help = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: "qa-courses",
      title: "Go to My Courses",
      desc: "See the subjects you are enrolled in.",
      route: "/student/my-courses",
      icon: BookOpen,
    },
    {
      id: "qa-exercises",
      title: "Open Exercises",
      desc: "Practice and submit your work.",
      route: "/student/exercise",
      icon: ClipboardList,
    },
    {
      id: "qa-assessments",
      title: "View Assessments",
      desc: "Check marks, status, and feedback.",
      route: "/student/assessments",
      icon: FileCheck,
    },
    {
      id: "qa-resources",
      title: "Browse Resources",
      desc: "Find materials for your level.",
      route: "/student/resources",
      icon: Search,
    },
    {
      id: "qa-schedule",
      title: "Check Schedule",
      desc: "See upcoming classes.",
      route: "/student/schedule",
      icon: Calendar,
    },
    {
      id: "qa-profile",
      title: "Update Profile",
      desc: "Change your photo and settings.",
      route: "/student/profile",
      icon: UserCircle,
    },
  ];

  const faqs = [
    {
      id: "faq-1",
      question: "Why do I see no data on some pages?",
      answer:
        "Most sections are powered by your enrollment. If you are not enrolled in a subject, exercises and assessments will be empty.",
    },
    {
      id: "faq-2",
      question: "Why can I only take an exercise once?",
      answer:
        "To keep grading consistent, each exercise allows one submission. Contact support if you need a reset.",
    },
    {
      id: "faq-3",
      question: "Why is my resource list empty?",
      answer:
        "Resources are filtered by your level and subjects. Ask an admin to upload resources for your class.",
    },
    {
      id: "faq-4",
      question: "How do I reset my password?",
      answer:
        "Use the Forgot Password flow on the login screen and follow the code sent to your email.",
    },
  ];

  return (
    <div className="space-y-10 font-sans text-slate-900">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <HelpCircle size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Help Center</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"></div>
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
                  ▼
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
          <h2 className="text-lg font-black text-slate-900">Need more help?</h2>
          <p className="text-sm text-slate-500 mt-2">
            Reach out to support and include a screenshot if possible.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="mailto:support@classiq.app"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest"
          >
            <Mail size={16} />
            Email Support
          </a>
        </div>
      </div>
    </div>
  );
};

export default Help;
