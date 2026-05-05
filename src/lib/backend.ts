import { supabase } from './supabase'
import type { Customer, Invoice, OperatorSettings, Service } from './types'

interface ApiErrorPayload {
  message?: string
  details?: unknown
}

export interface GoogleCalendarEventResponse {
  ok: true
  eventId?: string
  htmlLink?: string
}

export interface ProviderInvoiceResponse {
  ok: true
  provider: string
  externalId?: string
  number?: number | string
}

export interface ProviderInvoicePayload {
  invoice: Invoice
  customer?: Customer
  services: Service[]
  settings: OperatorSettings
}

async function getAuthHeaders() {
  if (!supabase) {
    throw new Error('Supabase non configurato: collega prima il cloud.')
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!data.session) {
    throw new Error('Accedi al cloud Supabase prima di usare integrazioni online.')
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`,
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload & {
    ok?: boolean
  }
  if (!response.ok) {
    throw new Error(payload.message || `Errore API ${response.status}`)
  }
  if (payload.ok !== true) {
    throw new Error('Backend non disponibile o risposta API non valida.')
  }
  return payload as T
}

export async function requestGoogleAuthorizationUrl(returnTo: string) {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/google/auth-url', {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ returnTo }),
  })
  const payload = await readApiResponse<{ ok: true; url: string }>(response)
  return payload.url
}

export async function createGoogleCalendarEvent(event: unknown) {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/google/create-event', {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ event }),
  })
  return readApiResponse<GoogleCalendarEventResponse>(response)
}

export async function createProviderInvoice(payload: ProviderInvoicePayload) {
  const headers = await getAuthHeaders()
  const response = await fetch('/api/invoicing/create-invoice', {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return readApiResponse<ProviderInvoiceResponse>(response)
}
