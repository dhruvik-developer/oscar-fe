import React from 'react';

export const PageLoadingSkeleton = () => {
  return (
    <div className="space-y-6 animate-pulse p-1">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4 lg:gap-0 pb-4 border-b border-slate-200">
        <div className="space-y-2 min-w-0 lg:min-w-auto">
          <div className="h-7 w-64 max-w-full lg:max-w-none bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-96 max-w-full lg:max-w-none bg-slate-100 rounded-md"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200 rounded-lg"></div>
          <div className="h-9 w-32 bg-primary/20 rounded-lg"></div>
        </div>
      </div>

      {/* KPI Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
            </div>
            <div className="h-7 w-32 bg-slate-300 rounded"></div>
            <div className="h-3 w-40 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div className="h-5 w-48 bg-slate-200 rounded"></div>
          <div className="h-8 w-60 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-none">
              <div className="h-4 w-24 bg-slate-200 rounded"></div>
              <div className="h-4 w-40 bg-slate-100 rounded"></div>
              <div className="h-4 w-20 bg-slate-200 rounded"></div>
              <div className="h-4 w-28 bg-slate-100 rounded"></div>
              <div className="h-4 w-16 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PageLoadingSkeleton;
