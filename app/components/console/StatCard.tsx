'use client';

import type { ReactNode } from 'react';

export type StatCardTone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

const TONE: Record<StatCardTone, { icon: string; badge?: string }> = {
  primary: { icon: 'text-primary bg-primary/10' },
  secondary: { icon: 'text-secondary bg-secondary-container/30' },
  tertiary: { icon: 'text-tertiary bg-tertiary/10' },
  neutral: { icon: 'text-on-surfaceVariant bg-surface-containerHigh' },
};

type Props = {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatCardTone;
  hint?: string;
  badge?: ReactNode;
  className?: string;
};

/** 後台共用 KPI 卡（Academic Precision） */
export default function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  badge,
  className = '',
}: Props) {
  const t = TONE[tone];
  return (
    <div
      className={`bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant hover:shadow-elevate hover:-translate-y-0.5 transition-all duration-200 ${className}`}
    >
      <div className="flex justify-between items-start mb-4 gap-2">
        {icon ? <div className={`p-2 rounded-lg ${t.icon}`}>{icon}</div> : <span />}
        {badge ??
          (hint ? (
            <span className="bg-surface-containerHigh text-on-surfaceVariant text-[10px] px-2 py-1 rounded-full font-mono uppercase tracking-wider">
              {hint}
            </span>
          ) : null)}
      </div>
      <p className="text-on-surfaceVariant font-mono text-xs uppercase tracking-wider mb-1">{label}</p>
      <div className="font-mono text-3xl md:text-4xl font-bold text-on-surface tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}
