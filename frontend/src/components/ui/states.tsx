import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

/** Skeleton rows shaped like table content — not a centred spinner. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 rounded bg-surface-alt" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <AlertTriangle className="text-error" size={32} aria-hidden />
      <div>
        <p className="font-semibold text-foreground">{t('common.errorTitle')}</p>
        <p className="text-sm text-muted">{message ?? t('common.errorBody')}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <Inbox className="text-muted" size={32} aria-hidden />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}
