import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const tones: Record<Tone, string> = {
  success: 'bg-surface-alt text-success border-success',
  warning: 'bg-surface-alt text-accent-600 border-accent-600',
  error: 'bg-surface-alt text-error border-error',
  info: 'bg-surface-alt text-info border-info',
  neutral: 'bg-surface-alt text-muted border-border',
};

/**
 * Status pill. Always carries a text label — colour never conveys status on
 * its own. An optional icon adds a non-colour signal.
 */
export function StatusBadge({
  tone,
  label,
  icon,
}: {
  tone: Tone;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {icon}
      {label}
    </span>
  );
}
