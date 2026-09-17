import React from 'react';

// ─── Skeleton Primitives ────────────────────────────────────────────────────

interface SkeletonLineProps {
  width?: string;
  height?: string;
  className?: string;
}

export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width = '100%',
  height = '12px',
  className = '',
}) => (
  <div
    className={`rounded-md shimmer ${className}`}
    style={{ width, height }}
  />
);

interface SkeletonCardProps {
  className?: string;
  children?: React.ReactNode;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ className = '', children }) => (
  <div className={`hud-panel rounded-xl p-5 border border-white/5 space-y-3 animate-fade-in ${className}`}>
    {children || (
      <>
        <SkeletonLine width="40%" height="14px" />
        <SkeletonLine width="70%" height="10px" />
        <SkeletonLine width="55%" height="10px" />
        <div className="pt-2">
          <SkeletonLine width="30%" height="28px" className="rounded-lg" />
        </div>
      </>
    )}
  </div>
);

export const SkeletonChart: React.FC<{ height?: number; className?: string }> = ({
  height = 200,
  className = '',
}) => (
  <div className={`hud-panel rounded-xl p-5 border border-white/5 animate-fade-in ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <SkeletonLine width="120px" height="14px" />
      <SkeletonLine width="80px" height="10px" />
    </div>
    <div className="relative overflow-hidden rounded-lg" style={{ height }}>
      {/* Wave pattern to suggest a chart */}
      <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skeleton-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
        </defs>
        <path
          d="M0 70 Q50 40 100 55 T200 45 T300 60 T400 50 L400 100 L0 100 Z"
          fill="url(#skeleton-grad)"
          className="animate-pulse"
        />
        <path
          d="M0 70 Q50 40 100 55 T200 45 T300 60 T400 50"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    </div>
  </div>
);

// ─── Composite Skeleton Layouts ─────────────────────────────────────────────

export const SkeletonStatRow: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => (
      <SkeletonCard key={i}>
        <SkeletonLine width="50%" height="10px" />
        <SkeletonLine width="40%" height="24px" className="rounded-lg" />
        <SkeletonLine width="65%" height="8px" />
      </SkeletonCard>
    ))}
  </div>
);

export const SkeletonListItem: React.FC = () => (
  <div className="hud-panel rounded-xl p-4 border border-white/5 flex items-center gap-4 animate-fade-in">
    <div className="w-8 h-8 rounded-lg shimmer shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonLine width="60%" height="12px" />
      <SkeletonLine width="35%" height="9px" />
    </div>
    <SkeletonLine width="64px" height="24px" className="rounded-lg shrink-0" />
  </div>
);

export const SkeletonPageFallback: React.FC = () => (
  <div className="space-y-6 pb-12 animate-fade-in">
    <SkeletonStatRow />
    <SkeletonChart height={240} />
    <div className="space-y-3">
      <SkeletonListItem />
      <SkeletonListItem />
      <SkeletonListItem />
    </div>
  </div>
);
