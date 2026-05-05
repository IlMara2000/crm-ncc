import type { InvoiceStatus, IntegrationStatus, QuoteStatus, ServiceStatus } from '../lib/types'
import { integrationLabels, invoiceLabels, quoteLabels, serviceLabels } from '../lib/status'

interface StatusBadgeProps {
  type: 'service' | 'invoice' | 'integration' | 'quote'
  value: ServiceStatus | InvoiceStatus | IntegrationStatus | QuoteStatus
}

export function StatusBadge({ type, value }: StatusBadgeProps) {
  const label =
    type === 'service'
      ? serviceLabels[value as ServiceStatus]
      : type === 'invoice'
        ? invoiceLabels[value as InvoiceStatus]
        : type === 'quote'
          ? quoteLabels[value as QuoteStatus]
          : integrationLabels[value as IntegrationStatus]

  return <span className={`status status-${value}`}>{label}</span>
}
