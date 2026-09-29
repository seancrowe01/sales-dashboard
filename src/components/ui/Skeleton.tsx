interface SkeletonProps {
  className?: string
}

/** Shimmering placeholder block. Size it with className (h-*, w-*). */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Card-shaped skeleton used in grids during the first load. */
export function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 ${tall ? 'min-h-[320px]' : 'min-h-[118px]'}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-40" />
      {tall ? <Skeleton className="mt-6 h-40 w-full" /> : null}
    </div>
  )
}

/** Whole-page skeleton shown until the first dataset arrives. */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-live="polite" aria-label="Loading sales data">
      <div>
        <Skeleton className="mb-5 h-6 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
      <div>
        <Skeleton className="mb-5 h-6 w-56" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard tall />
          <SkeletonCard tall />
        </div>
      </div>
      <div>
        <Skeleton className="mb-5 h-6 w-48" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard tall />
          <SkeletonCard tall />
        </div>
      </div>
    </div>
  )
}
