import React from "react";

const AdminPlaceholder = ({ title, description }) => {
  return (
    <div className="w-full h-full animate-in fade-in duration-500 font-sans">
      <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-[2.5rem] p-10 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-slate-500 font-medium">{description}</p>
      </div>
    </div>
  );
};

export default AdminPlaceholder;
