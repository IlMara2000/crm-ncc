export type View =
  | 'dashboard'
  | 'agenda'
  | 'services'
  | 'quotes'
  | 'customers'
  | 'vehicles'
  | 'invoices'
  | 'data'
  | 'integrations'

export type ServiceStatus = 'confirmed' | 'pending' | 'active' | 'completed'

export type InvoiceStatus = 'to-issue' | 'sent' | 'paid'

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'expired'

export type CustomerKind = 'private' | 'business' | 'hotel' | 'agency'

export type IntegrationStatus = 'ready' | 'connected' | 'attention'

export type ExpenseCategory =
  | 'fuel'
  | 'tolls'
  | 'parking'
  | 'maintenance'
  | 'wash'
  | 'other'

export interface Customer {
  id: string
  name: string
  kind: CustomerKind
  phone: string
  email: string
  company?: string
  vatNumber?: string
  address?: string
  preferredPickup?: string
  notes: string
  tags: string[]
}

export interface Vehicle {
  id: string
  name: string
  plate: string
  capacity: number
  status: 'available' | 'service' | 'maintenance'
  insuranceUntil: string
  revisionUntil: string
  nccPermitUntil: string
  notes: string
}

export interface ServiceSyncState {
  googleEventId?: string
  appleEventUid?: string
  lastSyncedAt?: string
}

export interface Service {
  id: string
  code: string
  customerId: string
  title: string
  pickup: string
  dropoff: string
  start: string
  end: string
  passengers: number
  vehicleId: string
  driver: string
  status: ServiceStatus
  serviceType: string
  price: number
  paymentMethod: string
  invoiceStatus: InvoiceStatus
  source: 'manual' | 'web' | 'agency' | 'whatsapp'
  flight?: string
  notes: string
  sync: ServiceSyncState
}

export interface Invoice {
  id: string
  number: string
  customerId: string
  serviceIds: string[]
  issuedAt?: string
  dueAt: string
  status: InvoiceStatus
  net: number
  vatRate: number
  gross: number
  paymentMethod: string
  externalId?: string
}

export interface Quote {
  id: string
  number: string
  customerId: string
  title: string
  pickup: string
  dropoff: string
  serviceDate: string
  passengers: number
  vehicleId: string
  serviceType: string
  net: number
  vatRate: number
  gross: number
  status: QuoteStatus
  validUntil: string
  notes: string
  convertedServiceId?: string
}

export interface Expense {
  id: string
  date: string
  category: ExpenseCategory
  description: string
  amount: number
  vehicleId?: string
  serviceId?: string
}

export interface OperatorSettings {
  businessName: string
  operatorName: string
  phone: string
  email: string
  vatNumber: string
  address: string
  defaultVatRate: number
}

export interface IntegrationConfig {
  id: 'google-calendar' | 'apple-calendar' | 'invoicing' | 'payments'
  name: string
  status: IntegrationStatus
  description: string
  lastSync?: string
}

export interface WorkspaceState {
  customers: Customer[]
  vehicles: Vehicle[]
  services: Service[]
  invoices: Invoice[]
  quotes: Quote[]
  expenses: Expense[]
  integrations: IntegrationConfig[]
  settings: OperatorSettings
  updatedAt: string
}

export interface ServiceDraft {
  customerId: string
  title: string
  pickup: string
  dropoff: string
  date: string
  startTime: string
  endTime: string
  passengers: number
  vehicleId: string
  serviceType: string
  price: number
  paymentMethod: string
  flight: string
  notes: string
}

export interface CustomerDraft {
  name: string
  kind: CustomerKind
  phone: string
  email: string
  company: string
  vatNumber: string
  address: string
  preferredPickup: string
  notes: string
  tags: string
}

export interface QuoteDraft {
  customerId: string
  title: string
  pickup: string
  dropoff: string
  serviceDate: string
  passengers: number
  vehicleId: string
  serviceType: string
  gross: number
  validUntil: string
  notes: string
}

export interface VehicleDraft {
  name: string
  plate: string
  capacity: number
  insuranceUntil: string
  revisionUntil: string
  nccPermitUntil: string
  notes: string
}
