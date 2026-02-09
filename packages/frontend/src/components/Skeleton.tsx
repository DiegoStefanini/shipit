export function Skeleton({ width, height }: { width?: string; height?: string }) {
  return (
    <div
      className="skeleton"
      style={{ width: width ?? '100%', height: height ?? '20px' }}
    />
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className="card skeleton-card">
      <Skeleton width="60%" height="20px" />
      <Skeleton width="40%" height="14px" />
      <Skeleton width="80%" height="14px" />
      <div style={{ marginTop: 12 }}>
        <Skeleton width="50%" height="12px" />
      </div>
    </div>
  )
}
