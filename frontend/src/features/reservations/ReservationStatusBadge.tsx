import { useTranslation } from 'react-i18next';
import { Clock, CheckCircle2, FileCheck, XCircle, UserX } from 'lucide-react';
import type { ReservationStatus } from '@hosni/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';

const config: Record<ReservationStatus, { tone: 'success' | 'warning' | 'info' | 'error' | 'neutral'; Icon: typeof Clock }> = {
  PENDING: { tone: 'warning', Icon: Clock },
  CONFIRMED: { tone: 'info', Icon: CheckCircle2 },
  CONVERTED: { tone: 'success', Icon: FileCheck },
  CANCELLED: { tone: 'neutral', Icon: XCircle },
  NO_SHOW: { tone: 'error', Icon: UserX },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const { t } = useTranslation();
  const { tone, Icon } = config[status];
  return <StatusBadge tone={tone} label={t(`reservations.status_${status}`)} icon={<Icon size={12} aria-hidden />} />;
}
