import { useTranslation } from 'react-i18next';
import { CheckCircle2, CalendarClock, Car, Wrench, Ban } from 'lucide-react';
import type { VehicleStatus } from '@hosni/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';

const config: Record<VehicleStatus, { tone: 'success' | 'warning' | 'info' | 'error' | 'neutral'; Icon: typeof Car }> = {
  AVAILABLE: { tone: 'success', Icon: CheckCircle2 },
  RESERVED: { tone: 'info', Icon: CalendarClock },
  RENTED: { tone: 'warning', Icon: Car },
  MAINTENANCE: { tone: 'warning', Icon: Wrench },
  OUT_OF_SERVICE: { tone: 'error', Icon: Ban },
};

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const { t } = useTranslation();
  const { tone, Icon } = config[status];
  return <StatusBadge tone={tone} label={t(`fleet.status_${status}`)} icon={<Icon size={12} aria-hidden />} />;
}
