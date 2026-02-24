import React from "react";

const TeacherPlaceholder = ({ title, subtitle, description, actions }) => {
  return (
    <div className="space-y-8 font-sans text-slate-900">
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {subtitle}
          </p>
        )}
      </div>
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
        <p className="text-slate-500 font-medium text-sm leading-relaxed">
          {description}
        </p>
        {actions && actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="px-6 py-3 rounded-2xl bg-[#2D70FD] text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-600 transition-all"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherPlaceholder;

