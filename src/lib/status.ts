import type { InvoiceStatus, IntegrationStatus, QuoteStatus, ServiceStatus } from './types'

export const serviceLabels: Record<ServiceStatus, string> = {
  confirmed: 'Confermato',
  pending: 'Da confermare',
  active: 'In corso',
  completed: 'Completato',
}

export const invoiceLabels: Record<InvoiceStatus, string> = {
  'to-issue': 'Da emettere',
  sent: 'Inviata',
  paid: 'Pagata',
}

export const integrationLabels: Record<IntegrationStatus, string> = {
  ready: 'Pronto',
  connected: 'Connesso',
  attention: 'Da configurare',
}

export const quoteLabels: Record<QuoteStatus, string> = {
  draft: 'Bozza',
  sent: 'Inviato',
  accepted: 'Accettato',
  expired: 'Scaduto',
}

export function serviceStatusLabel(status: ServiceStatus) {
  return serviceLabels[status]
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  return invoiceLabels[status]
}

export function integrationStatusLabel(status: IntegrationStatus) {
  return integrationLabels[status]
}

export function quoteStatusLabel(status: QuoteStatus) {
  return quoteLabels[status]
}
