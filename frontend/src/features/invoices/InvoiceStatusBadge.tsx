import { useTranslation } from 'react-i18next';
import { FileText, Send, CircleDollarSign, CheckCircle2, Ban } from 'lucide-react';
import type { InvoiceStatus } from '@hosni/shared';
import { StatusBadge } from '../../components/ui/StatusBadge';

const config: Record<InvoiceStatus, { tone: 'neutral' | 'info' | 'warning' | 'success' | 'error'; Icon: typeof FileText }> = {
  DRAFT: { tone: 'neutral', Icon: FileText },
  ISSUED: { tone: 'info', Icon: Send },
  PARTIAL: { tone: 'warning', Icon: CircleDollarSign },
  PAID: { tone: 'success', Icon: CheckCircle2 },
  VOID: { tone: 'error', Icon: Ban },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  const { tone, Icon } = config[status];
  return <StatusBadge tone={tone} label={t(`invoices.status_${status}`)} icon={<Icon size={12} aria-hidden />} />;
}
