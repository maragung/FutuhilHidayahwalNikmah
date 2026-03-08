'use client';

/**
 * Reusable skeleton loader components for the admin dashboard.
 * Shows shimmer placeholders while data is being fetched.
 */

export function SkeletonBox({ className = '', width, height }) {
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  return (
    <div
      className={`skeleton-shimmer rounded bg-gray-200 ${className}`}
      style={style}
    />
  );
}

export function SkeletonTableRow({ cols = 5 }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBox className="h-4 rounded" width={i === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <SkeletonBox className="h-3 rounded" width="70%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-6 space-y-4">
      <SkeletonBox className="h-5 rounded w-1/3" />
      <SkeletonBox className="h-8 rounded w-1/2" />
      <SkeletonBox className="h-3 rounded w-2/3" />
    </div>
  );
}

export function SkeletonSummaryCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="card p-4 flex items-center gap-4">
      <SkeletonBox className="rounded-full" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-4 rounded w-2/5" />
        <SkeletonBox className="h-3 rounded w-3/5" />
      </div>
      <SkeletonBox className="h-4 rounded w-20" />
    </div>
  );
}

export function SkeletonList({ count = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      <SkeletonSummaryCards count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonTable rows={5} cols={4} />
        <SkeletonTable rows={5} cols={3} />
      </div>
    </div>
  );
}

export function SkeletonForm({ fields = 5 }) {
  return (
    <div className="card p-6 space-y-6">
      <SkeletonBox className="h-6 rounded w-1/4" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBox className="h-4 rounded w-1/6" />
          <SkeletonBox className="h-10 rounded w-full" />
        </div>
      ))}
      <div className="flex gap-3 justify-end">
        <SkeletonBox className="h-10 rounded" width={100} />
        <SkeletonBox className="h-10 rounded" width={120} />
      </div>
    </div>
  );
}
