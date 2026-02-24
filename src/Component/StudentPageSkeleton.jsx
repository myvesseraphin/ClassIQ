import React from "react";

const S = ({ className = "" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />
);

const StatCard = () => (
  <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center gap-5 shadow-sm">
    <S className="w-14 h-14" />
    <div className="space-y-2">
      <S className="h-3 w-20 rounded-full" />
      <S className="h-7 w-24" />
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

const ListRows = ({ count = 6, height = "h-20" }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <S key={i} className={`${height} w-full`} />
    ))}
  </div>
);

const AssessmentSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <S className="h-10 w-72" />
        <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
          <S className="w-9 h-9 rounded-xl" />
          <S className="w-9 h-9 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCard key={i} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={6} />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm p-6">
        <ListRows count={7} height="h-20" />
      </div>
    </div>
  </div>
);

const AssignmentsSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <S className="h-10 w-72" />
        <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
          <S className="w-9 h-9 rounded-xl" />
          <S className="w-9 h-9 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[2rem] border border-slate-100 bg-white p-6 space-y-3 shadow-sm"
          >
            <S className="h-3 w-16 rounded-full" />
            <S className="h-8 w-20" />
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <FilterChipRow count={6} />
        <S className="h-14 w-full lg:w-96" />
      </div>

      <div className="flex gap-2">
        <S className="h-9 w-24 rounded-xl" />
        <S className="h-9 w-28 rounded-xl" />
        <S className="h-9 w-24 rounded-xl" />
      </div>

      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm p-6">
        <ListRows count={7} height="h-24" />
      </div>
    </div>
  </div>
);

const ExerciseSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden font-sans select-none">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <S className="h-10 w-52" />
            <div className="flex items-center gap-4">
              <S className="h-14 w-44 rounded-[1.5rem]" />
              <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
                <S className="w-9 h-9 rounded-xl" />
                <S className="w-9 h-9 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="w-full space-y-3">
              <FilterChipRow count={6} />
              <S className="h-20 w-full" />
            </div>
            <S className="h-14 w-full lg:w-96" />
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm h-full flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <S className="w-14 h-14 rounded-2xl" />
                  <S className="h-6 w-24 rounded-lg" />
                </div>
                <S className="h-6 w-4/5 mb-2" />
                <S className="h-4 w-2/3 rounded-full mb-6" />
                <div className="mt-auto grid grid-cols-2 gap-3">
                  <S className="h-12 rounded-2xl" />
                  <S className="h-12 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const LibraryDashboardSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <S className="h-10 w-64" />
              <S className="h-4 w-72 rounded-full" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 rounded-[2rem] p-6 space-y-3"
              >
                <S className="h-3 w-28 rounded-full" />
                <S className="h-8 w-20" />
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <S className="h-7 w-52" />
              <S className="h-4 w-16 rounded-full" />
            </div>
            <ListRows count={4} height="h-20" />
          </div>
        </div>
      </main>
    </div>
  </div>
);

const LibraryResourcesSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <S className="h-10 w-64" />
              <S className="h-4 w-80 rounded-full" />
            </div>
            <S className="h-14 w-52 rounded-[1.5rem]" />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <FilterChipRow count={6} />
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
                <S className="h-4 w-3/4 rounded-full" />
                <div className="flex gap-2">
                  <S className="h-12 flex-1 rounded-2xl" />
                  <S className="h-12 w-12 rounded-2xl" />
                  <S className="h-12 w-12 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const ResourcesSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <S className="h-10 w-64" />
            <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
              <S className="h-10 w-24 rounded-xl" />
              <S className="h-10 w-24 rounded-xl" />
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
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 overflow-hidden"
              >
                <div className="flex justify-between items-start mb-6">
                  <S className="w-14 h-14 rounded-2xl" />
                  <S className="h-6 w-20 rounded-lg" />
                </div>
                <S className="h-6 w-4/5 mb-2" />
                <S className="h-4 w-1/2 rounded-full mb-8" />
                <div className="grid grid-cols-2 gap-3">
                  <S className="h-12 rounded-2xl" />
                  <S className="h-12 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const CoursesSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <S className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <S className="h-10 w-52" />
                <S className="h-4 w-56 rounded-full" />
              </div>
            </div>
            <S className="h-12 w-56 rounded-2xl" />
          </div>

          <S className="h-16 w-full" />

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 p-6 rounded-[2rem] flex items-center gap-5 shadow-sm"
              >
                <S className="w-14 h-14 rounded-2xl" />
                <div className="space-y-2">
                  <S className="h-3 w-24 rounded-full" />
                  <S className="h-7 w-16" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <FilterChipRow count={4} withIcon />
            <S className="h-14 w-full lg:w-96" />
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <S className="h-6 w-24 rounded-lg" />
                  <S className="h-3 w-12 rounded-full" />
                </div>
                <S className="h-6 w-4/5" />
                <S className="h-3 w-24 rounded-full" />
                <S className="h-4 w-40 rounded-full" />
                <div className="flex items-center justify-between pt-2">
                  <S className="h-3 w-24 rounded-full" />
                  <S className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const NotificationsSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <S className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <S className="h-10 w-56" />
                <S className="h-4 w-48 rounded-full" />
              </div>
            </div>
            <S className="h-10 w-36 rounded-2xl" />
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
      </main>
    </div>
  </div>
);

const TasksSkeleton = () => (
  <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
    <div className="flex-1 flex flex-col min-w-0 relative">
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <S className="w-12 h-12 rounded-2xl" />
              <S className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <S className="h-10 w-36" />
                <S className="h-4 w-56 rounded-full" />
              </div>
            </div>
            <S className="h-12 w-36 rounded-xl" />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            <S className="h-10 w-32 rounded-full" />
            <S className="h-10 w-28 rounded-full" />
            <S className="h-10 w-32 rounded-full" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="bg-white border border-slate-100 rounded-2xl p-6"
              >
                <div className="flex items-start gap-4">
                  <S className="w-6 h-6 rounded-full mt-1" />
                  <div className="flex-1 space-y-3">
                    <S className="h-6 w-2/3" />
                    <div className="flex gap-3">
                      <S className="h-7 w-28 rounded-lg" />
                      <S className="h-5 w-36 rounded-full" />
                    </div>
                  </div>
                  <S className="w-9 h-9 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  </div>
);

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-[#F8FAFC] font-sans pb-40 relative">
    <header className="max-w-4xl mx-auto pt-10 px-6 flex items-center justify-between">
      <S className="h-12 w-36 rounded-2xl" />
      <S className="h-12 w-40 rounded-2xl" />
    </header>

    <main className="max-w-4xl mx-auto mt-12 px-6">
      <div className="flex items-center justify-center mb-12">
        <S className="h-16 w-[340px] rounded-[2.5rem]" />
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-blue-50/50">
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-50/30 rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-3"
            >
              <S className="h-3 w-24 rounded-full" />
              <S className="h-7 w-40" />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm space-y-8">
          <S className="h-6 w-48 rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <S className="h-16 w-full" />
            <S className="h-16 w-full" />
          </div>
        </div>
      </div>
    </main>
  </div>
);

const PLPSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="max-w-7xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <S className="h-10 w-80" />
        <div className="flex items-center gap-3 bg-white border-2 border-slate-100 p-1.5 rounded-2xl shadow-sm">
          <S className="w-9 h-9 rounded-xl" />
          <S className="w-9 h-9 rounded-xl" />
        </div>
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
            <S className="w-14 h-14 rounded-2xl mb-6" />
            <S className="h-6 w-3/4 mb-4" />
            <div className="grid grid-cols-2 gap-3 mt-8">
              <S className="h-12 rounded-2xl" />
              <S className="h-12 rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const HomeSkeleton = () => (
  <div className="w-full h-full font-sans">
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
      <div className="min-w-0">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
            <S className="h-12 flex-1 max-w-md" />
            <S className="h-12 w-12 rounded-2xl self-end sm:self-auto" />
          </div>

          <div className="space-y-2">
            <S className="h-10 w-72" />
            <S className="h-4 w-40 rounded-full" />
          </div>

          <section className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <S className="h-4 w-40 rounded-full" />
              <S className="h-8 w-28 rounded-xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-2xl bg-slate-50 border border-slate-100 p-4"
                >
                  <S className="w-12 h-12 rounded-2xl" />
                  <div className="space-y-2 flex-1">
                    <S className="h-3 w-16 rounded-full" />
                    <S className="h-8 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <S className="h-[340px] w-full rounded-[2.5rem]" />
            </div>
            <div className="lg:col-span-4">
              <S className="h-[340px] w-full rounded-[2.5rem]" />
            </div>
          </div>

          <S className="h-32 w-full rounded-[2.5rem]" />
          <S className="h-32 w-full rounded-[2.5rem]" />
        </div>
      </div>

      <aside className="bg-white border border-slate-100 rounded-[2.5rem] p-6 md:p-8 shadow-sm xl:rounded-none xl:border-l xl:border-r-0 xl:border-t-0 xl:border-b-0 xl:p-5 xl:shadow-none">
        <div className="space-y-10">
          <div className="text-center space-y-4">
            <S className="w-24 h-24 rounded-full mx-auto" />
            <div className="space-y-2">
              <S className="h-7 w-44 mx-auto" />
              <S className="h-3 w-28 rounded-full mx-auto" />
              <S className="h-3 w-36 rounded-full mx-auto" />
            </div>
          </div>

          <S className="h-72 w-full rounded-[2rem]" />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <S className="h-4 w-24 rounded-full" />
              <S className="h-8 w-8 rounded-full" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <S key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <S className="h-4 w-16 rounded-full" />
                <S className="h-3 w-12 rounded-full" />
              </div>
              <ListRows count={3} height="h-16" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <S className="h-20 w-full rounded-xl" />
                <S className="h-20 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
);

const GenericSkeleton = ({
  headerActions = 2,
  statCards = 3,
  contentRows = 5,
  sideBlocks = 3,
  splitLayout = true,
  className = "",
}) => (
  <section
    className={`w-full min-h-[65vh] rounded-[2rem] border border-slate-100 bg-white/80 p-6 md:p-8 ${className}`}
    aria-label="Loading content"
  >
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <S className="h-3 w-28 rounded-full" />
          <S className="h-10 w-56 max-w-[72vw]" />
        </div>
        {headerActions > 0 ? (
          <div className="flex gap-3">
            {Array.from({ length: headerActions }).map((_, i) => (
              <S key={i} className="h-11 w-24 rounded-xl" />
            ))}
          </div>
        ) : null}
      </div>

      {statCards > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: statCards }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3"
            >
              <S className="h-3 w-20 rounded-full" />
              <S className="h-8 w-24" />
              <S className="h-3 w-32 rounded-full" />
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={`grid gap-6 ${splitLayout ? "lg:grid-cols-[1.6fr_1fr]" : "grid-cols-1"}`}
      >
        <div className="space-y-4">
          {Array.from({ length: Math.max(2, contentRows) }).map((_, i) => (
            <S key={i} className={`${i === 0 ? "h-36" : "h-16"} w-full`} />
          ))}
        </div>
        {splitLayout ? (
          <div className="space-y-4">
            {Array.from({ length: Math.max(2, sideBlocks) }).map((_, i) => (
              <S key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  </section>
);

const StudentPageSkeleton = ({ variant = "generic", ...props }) => {
  if (variant === "home") return <HomeSkeleton />;
  if (variant === "assessment") return <AssessmentSkeleton />;
  if (variant === "assignments") return <AssignmentsSkeleton />;
  if (variant === "exercise") return <ExerciseSkeleton />;
  if (variant === "libraryDashboard") return <LibraryDashboardSkeleton />;
  if (variant === "libraryResources") return <LibraryResourcesSkeleton />;
  if (variant === "resources") return <ResourcesSkeleton />;
  if (variant === "courses") return <CoursesSkeleton />;
  if (variant === "notifications") return <NotificationsSkeleton />;
  if (variant === "tasks") return <TasksSkeleton />;
  if (variant === "profile") return <ProfileSkeleton />;
  if (variant === "plp") return <PLPSkeleton />;
  return <GenericSkeleton {...props} />;
};

export default StudentPageSkeleton;
