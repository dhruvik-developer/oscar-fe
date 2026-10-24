/**
 * Skeleton — CRM-styled content placeholder loading element.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, className = '', style = {} }) {
  return (
    <div
      className={`skeleton-loader ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export default Skeleton;
