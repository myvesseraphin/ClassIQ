import React from "react";

const EmptyState = ({
  title = "No records found.",
  message = "",
}) => {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl py-14 px-6 flex flex-col items-center justify-center text-center">
      <svg
        className="w-14 h-14 text-slate-500"
        viewBox="0 0 79 74"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M131 604 c-20 -25 -21 -40 -21 -215 0 -122 4 -197 12 -214 18 -40 62 -47 285 -43 164 2 205 6 217 18 8 8 26 59 41 113 28 105 27 150 -5 167 -10 5 -21 26 -24 45 -12 65 -32 75 -145 75 l-99 0 -32 40 -32 40 -88 0 c-84 0 -90 -1 -109 -26z m187 -36 c47 -58 46 -58 150 -58 101 0 122 -7 122 -42 0 -16 -11 -18 -129 -18 -70 0 -142 -5 -159 -11 -52 -18 -107 -149 -62 -149 5 0 24 25 41 55 l31 55 159 0 c138 0 160 -2 166 -16 6 -17 -22 -155 -39 -187 -8 -16 -27 -17 -221 -15 l-212 3 -3 194 c-2 149 1 196 10 203 7 4 39 8 71 8 47 0 60 -4 75 -22z" transform="translate(0,74) scale(0.1,-0.1)" />
      </svg>
      <p className="mt-3 text-sm font-medium text-slate-500">{title}</p>
      {message ? (
        <p className="text-xs font-medium text-slate-400 mt-2 max-w-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
};

export default EmptyState;
