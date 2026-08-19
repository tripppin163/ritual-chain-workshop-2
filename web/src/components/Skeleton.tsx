/** Placeholder blocks that hold the layout while the first read lands. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface ${className}`} aria-hidden />;
}

export function MarketCardSkeleton() {
  return (
    <div className="border border-hairline bg-elevated/60 p-5" aria-hidden>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-5 h-2 w-full" />
      <div className="mt-5 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
