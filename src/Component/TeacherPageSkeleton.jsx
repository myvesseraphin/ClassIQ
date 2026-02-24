import React from "react";

const S = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />
);

const StatCard = () => (
  <div className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-4 shadow-sm">
    <S className="w-12 h-12 rounded-2xl" />
    <div className="space-y-2">
      <S className="h-3 w-20 rounded-full" />
      <S className="h-7 w-16" />
      <S className="h-3 w-24 rounded-full" />
    </div>
  </div>
);

const FilterChipRow = ({ count = 6, withIcon = false }) => (
  <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-hide">
    {withIcon ? <S className="w-11 h-11 rounded-xl shrink-0" /> : null}
    {Array.from({ length: count }).map((_, i) => (
      <S key={i} className="h-10 w-24 rounded-xl shrink-0" />
    ))}
  </div>
);

const ListRows = ({ count = 6, height = "h-16" }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <S key={i} className={`${height} w-full`} />
    ))}
  </div>
);

const TeacherClassPickerSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-7">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-2">
          <S className="h-10 w-56" />
          <S className="h-4 w-64 rounded-full" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 flex items-center gap-2 shadow-sm"
            >
              <S className="w-8 h-8 rounded-lg" />
              <div className="space-y-1.5">
                <S className="h-2.5 w-12 rounded-full" />
                <S className="h-4 w-14 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <S key={i} className="h-9 w-20 rounded-xl shrink-0" />
          ))}
        </div>
        <S className="h-10 w-full lg:w-80 rounded-xl" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <S className="w-11 h-11 rounded-xl" />
              <S className="h-5 w-14 rounded-full" />
            </div>
            <S className="h-6 w-40 mt-4" />
            <S className="h-4 w-28 rounded-full mt-2" />
            <div className="mt-5 grid grid-cols-2 gap-2">
              <S className="h-9 w-full rounded-xl" />
              <S className="h-9 w-full rounded-xl" />
              <S className="h-9 w-full rounded-xl" />
              <S className="h-9 w-full rounded-xl" />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <S className="h-3 w-20 rounded-full" />
              <S className="h-4 w-4 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherHomeSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
      <div className="min-w-0">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="space-y-2">
            <S className="h-10 w-64" />
            <S className="h-4 w-36 rounded-full" />
          </div>

          <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <S className="h-4 w-40 rounded-full" />
              <S className="h-8 w-28 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-2xl bg-slate-50 border border-slate-100 p-4"
                >
                  <S className="w-12 h-12 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <S className="h-3 w-16 rounded-full" />
                    <S className="h-8 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <S className="h-[320px] w-full rounded-[2.5rem]" />
            </div>
            <div className="lg:col-span-4">
              <S className="h-[320px] w-full rounded-[2.5rem]" />
            </div>
          </div>

          <S className="h-28 w-full rounded-[2.5rem]" />

          <div className="xl:hidden space-y-4">
            <S className="h-60 w-full rounded-[2rem]" />
            <S className="h-52 w-full rounded-[2rem]" />
            <S className="h-52 w-full rounded-[2rem]" />
          </div>
        </div>
      </div>

      <aside className="hidden xl:block bg-white border-l border-slate-100 p-5">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <S className="w-24 h-24 rounded-full mx-auto" />
            <S className="h-7 w-40 mx-auto" />
            <S className="h-3 w-24 rounded-full mx-auto" />
          </div>
          <S className="h-72 w-full rounded-[2rem]" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <S key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <S className="h-20 w-full rounded-xl" />
            <S className="h-20 w-full rounded-xl" />
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const TeacherAssessmentsSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <S className="h-10 w-60" />
          <S className="h-4 w-44 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <S className="h-12 w-36 rounded-2xl" />
          <S className="h-12 w-32 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={5} withIcon />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <S className="w-14 h-14 rounded-2xl" />
              <S className="h-5 w-14 rounded-lg" />
            </div>
            <S className="h-5 w-2/3 mt-5" />
            <S className="h-4 w-1/3 rounded-full mt-2" />
            <div className="grid grid-cols-2 gap-2 mt-5">
              <S className="h-8 w-full rounded-xl" />
              <S className="h-8 w-full rounded-xl" />
            </div>
            <div className="mt-6">
              <S className="h-12 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <S className="h-7 w-28" />
          <S className="h-5 w-5 rounded-md" />
        </div>
        <ListRows count={6} height="h-14" />
      </div>
    </div>
  </div>
);

const TeacherStudentSelectionSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <S className="h-20 w-full lg:w-[520px]" />
        <S className="h-10 w-28 rounded-xl" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <S className="h-10 w-72" />
          <S className="h-4 w-80 rounded-full" />
        </div>
        <S className="h-14 w-full md:w-96" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <S className="w-12 h-12 rounded-2xl" />
                <div className="space-y-2">
                  <S className="h-3 w-20 rounded-full" />
                  <S className="h-5 w-32" />
                </div>
              </div>
              <S className="h-4 w-10 rounded-full" />
            </div>
            <div className="flex items-center justify-between">
              <S className="h-3 w-20 rounded-full" />
              <S className="h-3 w-16 rounded-full" />
            </div>
            <S className="h-3 w-36 rounded-full mt-4" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherExercisesSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <S className="h-10 w-72" />
          <S className="h-4 w-56 rounded-full" />
          <div className="flex gap-2">
            <S className="h-10 w-24 rounded-xl" />
            <S className="h-10 w-32 rounded-xl" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <S className="h-12 w-36 rounded-[1.5rem]" />
          <S className="h-12 w-40 rounded-[1.5rem]" />
          <div className="flex items-center gap-2 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
            <S className="h-9 w-9 rounded-xl" />
            <S className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={5} />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-start">
              <S className="w-14 h-14 rounded-2xl" />
              <S className="h-6 w-20 rounded-lg" />
            </div>
            <S className="h-6 w-4/5" />
            <S className="h-4 w-2/3 rounded-full" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <S className="h-12 rounded-2xl" />
              <S className="h-12 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherOutlineSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <S className="h-10 w-72" />
          <S className="h-4 w-52 rounded-full" />
        </div>
        <S className="h-12 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <S className="h-56 w-full xl:col-span-2" />
        <S className="h-56 w-full" />
      </div>
      <div className="space-y-6">
        <S className="h-56 w-full rounded-[2.5rem]" />
        <S className="h-56 w-full rounded-[2.5rem]" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <S className="h-72 w-full rounded-[2.5rem]" />
        <S className="h-72 w-full rounded-[2.5rem]" />
      </div>
    </div>
  </div>
);

const TeacherPLPSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2">
          <S className="h-10 w-72" />
          <S className="h-4 w-56 rounded-full" />
        </div>
        <div className="flex items-center gap-3">
          <S className="h-12 w-36 rounded-2xl" />
          <S className="h-12 w-32 rounded-2xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={5} withIcon />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-start">
              <S className="w-14 h-14 rounded-2xl" />
              <S className="h-5 w-14 rounded-lg" />
            </div>
            <S className="h-5 w-2/3" />
            <S className="h-4 w-1/3 rounded-full" />
            <div className="grid grid-cols-2 gap-2">
              <S className="h-8 w-full rounded-xl" />
              <S className="h-8 w-full rounded-xl" />
            </div>
            <S className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-3">
              <S className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <S className="h-3 w-24 rounded-full" />
                <S className="h-5 w-32" />
              </div>
            </div>
            <S className="h-12 w-full rounded-2xl" />
            <S className="h-12 w-full rounded-2xl" />
            <S className="h-12 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherRecordMarksSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <S className="h-4 w-20 rounded-full" />
          <S className="h-10 w-64" />
          <S className="h-4 w-56 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <S className="h-14 w-28 rounded-2xl" />
          <S className="h-12 w-36 rounded-2xl" />
          <S className="h-12 w-32 rounded-2xl" />
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
        <ListRows count={9} height="h-16" />
      </div>
    </div>
  </div>
);

const TeacherRecordMarksDetailsSkeleton = () => (
  <div className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10 bg-slate-50">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <S className="h-28 w-full" />
      <S className="h-28 w-full" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <S key={i} className="h-24 w-full" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <S className="h-72 w-full" />
      <S className="h-72 w-full" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <S className="h-80 w-full" />
      <S className="h-80 w-full" />
    </div>
    <S className="h-80 w-full" />
  </div>
);

const TeacherAnalyticsSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <S className="h-10 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <S className="h-[340px] w-full rounded-[2.5rem]" />
        <S className="h-[340px] w-full rounded-[2.5rem]" />
      </div>
    </div>
  </div>
);

const TeacherReportsSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <S className="h-10 w-60" />
          <S className="h-4 w-64 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <S className="h-10 w-24 rounded-xl" />
          <S className="h-10 w-28 rounded-xl" />
          <S className="h-10 w-28 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm">
          <ListRows count={8} height="h-16" />
        </div>
        <div className="space-y-6">
          <S className="h-64 w-full rounded-[2.5rem]" />
          <S className="h-64 w-full rounded-[2.5rem]" />
        </div>
      </div>
    </div>
  </div>
);

const TeacherResourcesSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <S className="h-10 w-72" />
        <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
          <S className="h-10 w-28 rounded-xl" />
          <S className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={6} withIcon />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-5"
          >
            <div className="flex justify-between items-start">
              <S className="w-14 h-14 rounded-2xl" />
              <S className="h-6 w-20 rounded-lg" />
            </div>
            <S className="h-6 w-5/6" />
            <S className="h-4 w-2/3 rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <S className="h-12 rounded-2xl" />
              <S className="h-12 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherWeakAreasSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <S className="h-20 w-full lg:w-[520px]" />
        <S className="h-12 w-24 rounded-xl" />
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <S className="h-10 w-72" />
        <S className="h-14 w-full md:w-96" />
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <S key={i} className="h-56 w-full rounded-[2.5rem]" />
        ))}
      </div>
    </div>
  </div>
);

const TeacherNotificationsSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <S className="w-10 h-10 rounded-xl" />
          <S className="w-12 h-12 rounded-2xl" />
          <div className="space-y-2">
            <S className="h-10 w-56" />
            <S className="h-4 w-48 rounded-full" />
          </div>
        </div>
        <S className="h-10 w-28 rounded-2xl" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-2xl border border-slate-100 flex items-start justify-between"
          >
            <div className="flex items-start gap-4 flex-1">
              <S className="w-12 h-12 rounded-lg" />
              <div className="space-y-2 flex-1">
                <S className="h-5 w-64" />
                <S className="h-4 w-full rounded-full" />
                <S className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <S className="h-9 w-24 rounded-2xl" />
              <S className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TeacherProfileSkeleton = () => (
  <div className="min-h-screen bg-slate-50 font-sans pb-40 relative">
    <header className="max-w-4xl mx-auto pt-10 px-6 flex items-center justify-between">
      <S className="h-12 w-36 rounded-2xl" />
    </header>

    <main className="max-w-4xl mx-auto mt-12 px-6">
      <div className="flex items-center justify-center mb-12">
        <S className="h-16 w-[340px] rounded-[2.5rem]" />
      </div>
      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
          <div className="flex flex-col items-center text-center space-y-6">
            <S className="w-36 h-36 rounded-full" />
            <S className="h-8 w-72" />
            <div className="flex items-center gap-2">
              <S className="h-6 w-24 rounded-full" />
              <S className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-3"
            >
              <S className="h-3 w-24 rounded-full" />
              <S className="h-7 w-40" />
            </div>
          ))}
        </div>
      </div>
    </main>
  </div>
);

const GenericSkeleton = () => (
  <section
    className="w-full min-h-[65vh] rounded-[2rem] border border-slate-100 bg-white/80 p-6 md:p-8"
    aria-label="Loading content"
  >
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <S className="h-3 w-28 rounded-full" />
          <S className="h-10 w-56 max-w-[72vw]" />
        </div>
        <div className="flex gap-3">
          <S className="h-11 w-24 rounded-xl" />
          <S className="h-11 w-24 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>
      <ListRows count={6} height="h-16" />
    </div>
  </section>
);

const TeacherPageSkeleton = ({ variant = "generic" }) => {
  if (variant === "home") return <TeacherHomeSkeleton />;
  if (variant === "classPicker") return <TeacherClassPickerSkeleton />;
  if (variant === "assessments") return <TeacherAssessmentsSkeleton />;
  if (variant === "studentSelect") return <TeacherStudentSelectionSkeleton />;
  if (variant === "exercises") return <TeacherExercisesSkeleton />;
  if (variant === "outline") return <TeacherOutlineSkeleton />;
  if (variant === "plp") return <TeacherPLPSkeleton />;
  if (variant === "recordMarks") return <TeacherRecordMarksSkeleton />;
  if (variant === "recordMarksDetails")
    return <TeacherRecordMarksDetailsSkeleton />;
  if (variant === "analytics") return <TeacherAnalyticsSkeleton />;
  if (variant === "reports") return <TeacherReportsSkeleton />;
  if (variant === "resources") return <TeacherResourcesSkeleton />;
  if (variant === "weakAreas") return <TeacherWeakAreasSkeleton />;
  if (variant === "notifications") return <TeacherNotificationsSkeleton />;
  if (variant === "profile") return <TeacherProfileSkeleton />;
  return <GenericSkeleton />;
};

export default TeacherPageSkeleton;
