import type { WorkspaceState } from '../lib/types'

export const seedWorkspace: WorkspaceState = {
  customers: [],
  vehicles: [],
  services: [],
  invoices: [],
  quotes: [],
  expenses: [],
  integrations: [
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      status: 'ready',
      description: 'OAuth + Calendar API per creare e aggiornare eventi servizio.',
    },
    {
      id: 'apple-calendar',
      name: 'Apple Calendar',
      status: 'ready',
      description: 'Feed iCalendar/ICS compatibile con Apple Calendar e altri calendari.',
    },
    {
      id: 'invoicing',
      name: 'Fatturazione elettronica',
      status: 'attention',
      description: 'API server-side per provider di fatturazione elettronica.',
    },
    {
      id: 'payments',
      name: 'Pagamenti',
      status: 'ready',
      description: 'Richieste pagamento copiabili dalle fatture e pronte per provider online.',
    },
  ],
  settings: {
    businessName: 'NCC CRM',
    operatorName: '',
    phone: '',
    email: '',
    vatNumber: '',
    address: '',
    defaultVatRate: 22,
  },
  updatedAt: new Date().toISOString(),
}
