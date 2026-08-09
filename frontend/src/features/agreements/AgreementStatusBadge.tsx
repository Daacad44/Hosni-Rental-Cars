import { useTranslation } from 'react-i18next';
import { FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { AgreementStatus } from '@hosni/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';

const config: Record<AgreementStatus, { tone: 'info' | 'error' | 'success'; Icon: typeof FileText }> = {
  OPEN: { tone: 'info', Icon: FileText },
  OVERDUE: { tone: 'error', Icon: AlertTriangle },
  CLOSED: { tone: 'success', Icon: CheckCircle2 },
};

export function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
  const { t } = useTranslation();
  const { tone, Icon } = config[status];
  return <StatusBadge tone={tone} label={t(`agreements.status_${status}`)} icon={<Icon size={12} aria-hidden />} />;
}
