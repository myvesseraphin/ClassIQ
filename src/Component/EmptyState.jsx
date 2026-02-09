import React from "react";

const EmptyState = ({
  title = "No Data Found",
  message = "There is no data to show you right now",
}) => {
  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] px-6 py-16 flex flex-col items-center text-center shadow-sm">
      <svg
        className="w-40 h-auto mb-6"
        viewBox="0 0 140 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="8"
          y="18"
          width="88"
          height="64"
          rx="14"
          fill="#F8FAFC"
          stroke="#E2E8F0"
          strokeWidth="2"
        />
        <rect x="20" y="30" width="60" height="10" rx="5" fill="#E2E8F0" />
        <rect x="20" y="46" width="60" height="10" rx="5" fill="#E2E8F0" />
        <rect x="20" y="62" width="60" height="10" rx="5" fill="#E2E8F0" />
        <circle
          cx="106"
          cy="36"
          r="22"
          fill="#F8FAFC"
          stroke="#E2E8F0"
          strokeWidth="2"
        />
        <line
          x1="120"
          y1="52"
          x2="132"
          y2="66"
          stroke="#E2E8F0"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <h3 className="text-lg font-black text-slate-600">{title}</h3>
      <p className="text-sm font-bold text-slate-400 mt-2 max-w-xs">
        {message}
      </p>
    </div>
  );
};

export default EmptyState;
