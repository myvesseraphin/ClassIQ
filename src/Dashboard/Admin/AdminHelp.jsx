import React from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  HelpCircle,
  Mail,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";

const AdminHelp = () => {
  const navigate = useNavigate();

  const quickActions = [
    {
      id: "qa-users",
      title: "Manage Users",
      desc: "Search users, change roles, and verify accounts.",
      route: "/admin/users",
      icon: Users,
    },
    {
      id: "qa-requests",
      title: "Review Access Requests",
      desc: "Approve or reject incoming access requests.",
      route: "/admin/requests",
      icon: UserCheck,
    },
    {
      id: "qa-resources",
      title: "Audit Curriculum Resources",
      desc: "Review linked class-subject-unit-topic files and usage stats.",
      route: "/admin/resources",
      icon: BookOpen,
    },
    {
      id: "qa-curriculum",
      title: "Curriculum Oversight",
      desc: "Inspect term > unit > topic completion and delayed units.",
      route: "/admin/curriculum",
      icon: Shield,
    },
    {
      id: "qa-settings",
      title: "Academic Management",
      desc: "Set unit, topic, pages, and teacher per class + subject.",
      route: "/admin/academic-management",
      icon: Shield,
    },
    {
      id: "qa-reports",
      title: "Export Reports",
      desc: "Download snapshots for stakeholders and audits.",
      route: "/admin/reports",
      icon: FileText,
    },
  ];

  const faqs = [
    {
      id: "faq-1",
      question: "How do I approve an access request?",
      answer:
        "Open Access Requests, click a request, then select Approve. Approved requests will appear in the list as approved.",
    },
    {
      id: "faq-2",
      question: "How do I change a user's role?",
      answer:
        "Go to Users, search for the person, open their profile, then choose a role (Student, Teacher, Admin) and save.",
    },
    {
      id: "faq-3",
      question: "Can I delete a resource from storage?",
      answer:
        "Yes. In Curriculum Resources, delete will remove the database record and attempt to remove the file from storage if configured.",
    },
    {
      id: "faq-4",
      question: "How does the lesson tracker help exercise generation?",
      answer:
        "Lesson tracker entries define the current topic and pages for each class and subject, so AI can generate exercises from the right lesson context.",
    },
  ];

  return (
    <div className="space-y-10 font-sans text-slate-900 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2D70FD] flex items-center justify-center">
          <HelpCircle size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">Admin Help</h1>
          <p className="text-slate-500 font-medium">
            Guidance for access control, users, resources, and lesson tracking.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <FileText size={18} className="text-[#2D70FD]" />
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
                  <span className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-[#2D70FD]">
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
          <HelpCircle size={18} className="text-[#2D70FD]" />
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
          <h2 className="text-lg font-black text-slate-900">Need support?</h2>
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

export default AdminHelp;
