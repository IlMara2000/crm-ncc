import {
  CalendarDays,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Database,
  Download,
  FileDown,
  FileText,
  Fuel,
  LayoutDashboard,
  Link2,
  MapPin,
  Monitor,
  Moon,
  Plane,
  Plus,
  Printer,
  ReceiptText,
  Route,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { ServiceForm } from './components/ServiceForm'
import {
  StatusBadge,
} from './components/StatusBadge'
import {
  buildIcsForServices,
  downloadIcs,
  getGoogleCalendarInsertPayload,
} from './lib/calendar'
import {
  createGoogleCalendarEvent,
  createProviderInvoice,
  requestGoogleAuthorizationUrl,
} from './lib/backend'
import {
  combineLocalDateAndTime,
  createId,
  durationLabel,
  formatDateLabel,
  formatDateLine,
  formatMoney,
  formatShortDate,
  formatTime,
  isSameDay,
  minutesFromMidnight,
  toDateInputValue,
} from './lib/format'
import {
  hasStoredWorkspaceState,
  loadWorkspaceState,
  normalizeWorkspaceState,
  resetWorkspaceState,
  saveWorkspaceState,
} from './lib/storage'
import {
  fetchCloudWorkspace,
  isSupabaseConfigured,
  saveCloudWorkspace,
  sendMagicLink,
  signOutCloud,
  supabase,
  type CloudStatus,
  type SupabaseSession,
} from './lib/supabase'
import {
  integrationStatusLabel,
  invoiceStatusLabel,
  quoteStatusLabel,
  serviceStatusLabel,
} from './lib/status'
import type {
  Customer,
  CustomerDraft,
  Expense,
  ExpenseCategory,
  ExpenseDraft,
  Invoice,
  OperatorSettings,
  Quote,
  QuoteDraft,
  QuoteStatus,
  Service,
  ServiceDraft,
  ServiceStatus,
  Vehicle,
  VehicleDraft,
  View,
  WorkspaceState,
} from './lib/types'

const navItems: Array<{ view: View; label: string; icon: LucideIcon }> = [
  { view: 'dashboard', label: 'Cruscotto', icon: LayoutDashboard },
  { view: 'agenda', label: 'Agenda', icon: CalendarDays },
  { view: 'services', label: 'Servizi', icon: Route },
  { view: 'quotes', label: 'Preventivi', icon: FileText },
  { view: 'customers', label: 'Clienti', icon: UsersRound },
  { view: 'vehicles', label: 'Mezzi', icon: Car },
  { view: 'invoices', label: 'Fatture', icon: ReceiptText },
  { view: 'data', label: 'Dati', icon: Database },
  { view: 'integrations', label: 'Integrazioni', icon: Link2 },
  { view: 'settings', label: 'Impostazioni', icon: Settings2 },
]

type ThemePreference = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'ncc-crm-theme-preference-v1'

const themeOptions: Array<{
  value: ThemePreference
  label: string
  detail: string
  icon: LucideIcon
}> = [
  {
    value: 'light',
    label: 'Chiaro',
    detail: 'Sfondo luminoso e contrasto morbido per il lavoro diurno.',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Scuro',
    detail: 'Superfici scure e testo chiaro per ridurre la fatica visiva.',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Predefinito dispositivo',
    detail: 'Segue automaticamente il tema impostato su browser o sistema.',
    icon: Monitor,
  },
]

function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => loadWorkspaceState())
  const [now] = useState(() => new Date())
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    readThemePreference(),
  )
  const [isServiceFormOpen, setServiceFormOpen] = useState(false)
  const [isClearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(toDateInputValue())
  const [cloudSession, setCloudSession] = useState<SupabaseSession | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(
    isSupabaseConfigured ? 'checking' : 'disabled',
  )
  const [cloudEmail, setCloudEmail] = useState('')
  const [isCloudHydrated, setCloudHydrated] = useState(false)
  const workspaceRef = useRef(workspace)
  const cloudSaveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    document.documentElement.dataset.theme = themePreference
    document.documentElement.style.colorScheme =
      themePreference === 'system' ? 'light dark' : themePreference
    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference)
  }, [themePreference])

  useEffect(() => {
    workspaceRef.current = workspace
    saveWorkspaceState(workspace)

    if (!cloudSession || !isCloudHydrated) return undefined

    if (cloudSaveTimer.current) window.clearTimeout(cloudSaveTimer.current)
    cloudSaveTimer.current = window.setTimeout(() => {
      setCloudStatus('syncing')
      void saveCloudWorkspace(cloudSession.user.id, workspace)
        .then(() => setCloudStatus('synced'))
        .catch(() => setCloudStatus('error'))
    }, 900)

    return () => {
      if (cloudSaveTimer.current) window.clearTimeout(cloudSaveTimer.current)
    }
  }, [workspace, cloudSession, isCloudHydrated])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const calendarStatus = params.get('calendar')
    if (!calendarStatus) return

    if (calendarStatus === 'connected') {
      window.setTimeout(() => {
        const syncedAt = new Date().toISOString()
        setWorkspace((current) => ({
          ...current,
          integrations: current.integrations.map((integration) =>
            integration.id === 'google-calendar'
              ? { ...integration, status: 'connected', lastSync: syncedAt }
              : integration,
          ),
          updatedAt: syncedAt,
        }))
        setToast('Google Calendar collegato.')
      }, 0)
    } else {
      window.setTimeout(() => setToast('Collegamento Google Calendar non completato.'), 0)
    }

    params.delete('calendar')
    params.delete('reason')
    const query = params.toString()
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', cleanUrl)
  }, [])

  useEffect(() => {
    if (!supabase) {
      window.setTimeout(() => setCloudStatus('disabled'), 0)
      return undefined
    }

    let isMounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setCloudSession(data.session)
      setCloudStatus(data.session ? 'syncing' : 'signed-out')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudHydrated(false)
      setCloudSession(session)
      setCloudStatus(session ? 'syncing' : 'signed-out')
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!cloudSession) {
      window.setTimeout(() => setCloudHydrated(false), 0)
      return undefined
    }

    let isCancelled = false

    void fetchCloudWorkspace(cloudSession.user.id)
      .then((remote) => {
        if (isCancelled) return

        if (!remote) {
          return saveCloudWorkspace(cloudSession.user.id, workspaceRef.current).then(() => {
            if (isCancelled) return
            setCloudHydrated(true)
            setCloudStatus('synced')
          })
        }

        const remoteState = normalizeWorkspaceState(remote.state)
        const hasLocalState = hasStoredWorkspaceState()
        const localTime = new Date(workspaceRef.current.updatedAt).getTime()
        const remoteTime = new Date(remoteState.updatedAt || remote.updated_at).getTime()

        if (!hasLocalState || remoteTime >= localTime) {
          setWorkspace(remoteState)
          setCloudHydrated(true)
          setCloudStatus('synced')
          return undefined
        }

        return saveCloudWorkspace(cloudSession.user.id, workspaceRef.current).then(() => {
          if (isCancelled) return
          setCloudHydrated(true)
          setCloudStatus('synced')
        })
      })
      .catch(() => {
        if (isCancelled) return
        setCloudHydrated(false)
        setCloudStatus('error')
      })

    return () => {
      isCancelled = true
    }
  }, [cloudSession])

  const sortedServices = useMemo(
    () =>
      [...workspace.services].sort(
        (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
      ),
    [workspace.services],
  )

  const selectedDay = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [selectedDate])
  const canCreateService = workspace.customers.length > 0 && workspace.vehicles.length > 0
  const serviceCreationTitle = canCreateService
    ? 'Crea un nuovo servizio'
    : workspace.customers.length === 0
      ? 'Aggiungi il primo cliente per creare un servizio'
      : 'Aggiungi il primo mezzo per creare un servizio'

  function requestServiceCreation() {
    if (workspace.customers.length === 0) {
      setActiveView('customers')
      setToast('Aggiungi il primo cliente, poi potrai creare il servizio.')
      return
    }

    if (workspace.vehicles.length === 0) {
      setActiveView('vehicles')
      setToast('Aggiungi il primo mezzo, poi potrai creare il servizio.')
      return
    }

    setServiceFormOpen(true)
  }

  function addService(draft: ServiceDraft) {
    setWorkspace((current) => {
      const service: Service = {
        id: createId('srv'),
        code: getNextServiceCode(current.services),
        customerId: draft.customerId,
        title: draft.title,
        pickup: draft.pickup,
        dropoff: draft.dropoff,
        start: combineLocalDateAndTime(draft.date, draft.startTime),
        end: combineLocalDateAndTime(draft.date, draft.endTime),
        passengers: draft.passengers,
        vehicleId: draft.vehicleId,
        driver: current.settings.operatorName,
        status: 'pending',
        serviceType: draft.serviceType,
        price: draft.price,
        paymentMethod: draft.paymentMethod,
        invoiceStatus: 'to-issue',
        source: 'manual',
        flight: draft.flight || undefined,
        notes: draft.notes,
        sync: {},
      }

      return {
        ...current,
        services: [...current.services, service],
        updatedAt: new Date().toISOString(),
      }
    })
    setServiceFormOpen(false)
    setToast('Servizio creato e pronto per calendario/fatturazione.')
  }

  function updateServiceStatus(serviceId: string, status: ServiceStatus) {
    setWorkspace((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === serviceId ? { ...service, status } : service,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function addCustomer(draft: CustomerDraft) {
    const id = createId('cust')
    const fallbackTag = customerKindLabel(draft.kind).toLowerCase()
    const tags = draft.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const customer: Customer = {
      id,
      name: draft.name.trim(),
      kind: draft.kind,
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      company: draft.company.trim() || undefined,
      vatNumber: draft.vatNumber.trim() || undefined,
      address: draft.address.trim() || undefined,
      preferredPickup: draft.preferredPickup.trim() || undefined,
      notes: draft.notes.trim(),
      tags: tags.length > 0 ? tags : [fallbackTag],
    }

    setWorkspace((current) => ({
      ...current,
      customers: [customer, ...current.customers],
      updatedAt: new Date().toISOString(),
    }))
    setToast('Cliente creato in rubrica locale.')
    return id
  }

  function addQuote(draft: QuoteDraft) {
    setWorkspace((current) => {
      const gross = roundMoney(Number(draft.gross))
      const vatRate = current.settings.defaultVatRate
      const quote: Quote = {
        id: createId('quote'),
        number: getNextDocumentNumber(current.quotes, 'PREV-2026', 0),
        customerId: draft.customerId,
        title: draft.title.trim(),
        pickup: draft.pickup.trim(),
        dropoff: draft.dropoff.trim(),
        serviceDate: new Date(draft.serviceDate).toISOString(),
        passengers: Number(draft.passengers),
        vehicleId: draft.vehicleId,
        serviceType: draft.serviceType.trim(),
        net: roundMoney(gross / (1 + vatRate / 100)),
        vatRate,
        gross,
        status: 'draft',
        validUntil: new Date(draft.validUntil).toISOString(),
        notes: draft.notes.trim(),
      }

      return {
        ...current,
        quotes: [quote, ...current.quotes],
        updatedAt: new Date().toISOString(),
      }
    })
    setToast('Preventivo creato. Puoi stamparlo o convertirlo in servizio.')
  }

  function updateQuoteStatus(quoteId: string, status: QuoteStatus) {
    setWorkspace((current) => ({
      ...current,
      quotes: current.quotes.map((quote) =>
        quote.id === quoteId ? { ...quote, status } : quote,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function convertQuoteToService(quote: Quote) {
    if (quote.convertedServiceId) {
      setToast('Questo preventivo e gia collegato a un servizio.')
      return
    }

    setWorkspace((current) => {
      const end = new Date(quote.serviceDate)
      end.setMinutes(end.getMinutes() + 90)
      const service: Service = {
        id: createId('srv'),
        code: getNextServiceCode(current.services),
        customerId: quote.customerId,
        title: quote.title,
        pickup: quote.pickup,
        dropoff: quote.dropoff,
        start: quote.serviceDate,
        end: end.toISOString(),
        passengers: quote.passengers,
        vehicleId: quote.vehicleId,
        driver: current.settings.operatorName,
        status: 'confirmed',
        serviceType: quote.serviceType,
        price: quote.gross,
        paymentMethod: '',
        invoiceStatus: 'to-issue',
        source: 'manual',
        notes: `Creato da ${quote.number}. ${quote.notes}`,
        sync: {},
      }

      return {
        ...current,
        services: [...current.services, service],
        quotes: current.quotes.map((item) =>
          item.id === quote.id
            ? { ...item, status: 'accepted', convertedServiceId: service.id }
            : item,
        ),
        updatedAt: new Date().toISOString(),
      }
    })
    setToast('Preventivo accettato e trasformato in servizio.')
  }

  function updateVehicleStatus(vehicleId: string, status: Vehicle['status']) {
    setWorkspace((current) => ({
      ...current,
      vehicles: current.vehicles.map((vehicle) =>
        vehicle.id === vehicleId ? { ...vehicle, status } : vehicle,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function addVehicle(draft: VehicleDraft) {
    const vehicle: Vehicle = {
      id: createId('veh'),
      name: draft.name.trim(),
      plate: draft.plate.trim().toUpperCase(),
      capacity: Number(draft.capacity),
      status: 'available',
      insuranceUntil: combineLocalDateAndTime(draft.insuranceUntil, '09:00'),
      revisionUntil: combineLocalDateAndTime(draft.revisionUntil, '09:00'),
      nccPermitUntil: combineLocalDateAndTime(draft.nccPermitUntil, '09:00'),
      notes: draft.notes.trim(),
    }

    setWorkspace((current) => ({
      ...current,
      vehicles: [vehicle, ...current.vehicles],
      updatedAt: new Date().toISOString(),
    }))
    setToast('Mezzo aggiunto al parco NCC.')
  }

  function addExpense(draft: ExpenseDraft) {
    const expense: Expense = {
      id: createId('exp'),
      date: combineLocalDateAndTime(draft.date, '12:00'),
      category: draft.category,
      description: draft.description.trim(),
      amount: roundMoney(Number(draft.amount)),
      vehicleId: draft.vehicleId || undefined,
      serviceId: draft.serviceId || undefined,
    }

    setWorkspace((current) => ({
      ...current,
      expenses: [expense, ...current.expenses],
      updatedAt: new Date().toISOString(),
    }))
    setToast('Spesa registrata e collegata al mezzo.')
  }

  function createInvoiceFromService(service: Service) {
    if (service.invoiceStatus !== 'to-issue') {
      setToast('La fattura risulta gia gestita per questo servizio.')
      return
    }

    setWorkspace((current) => {
      const gross = service.price
      const vatRate = current.settings.defaultVatRate
      const net = Math.round((gross / (1 + vatRate / 100)) * 100) / 100
      const invoice: Invoice = {
        id: createId('inv'),
        number: getNextDocumentNumber(current.invoices, 'FAT-2026', 0),
        customerId: service.customerId,
        serviceIds: [service.id],
        issuedAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
        net,
        vatRate,
        gross,
        paymentMethod: service.paymentMethod,
      }

      return {
        ...current,
        invoices: [invoice, ...current.invoices],
        services: current.services.map((item) =>
          item.id === service.id ? { ...item, invoiceStatus: 'sent' } : item,
        ),
        updatedAt: new Date().toISOString(),
      }
    })
    setToast('Fattura generata. Puoi stamparla, copiarne la richiesta pagamento o inviarla al provider.')
  }

  function markInvoicePaid(invoiceId: string) {
    setWorkspace((current) => {
      const invoice = current.invoices.find((item) => item.id === invoiceId)
      const linkedServiceIds = invoice?.serviceIds ?? []

      return {
        ...current,
        invoices: current.invoices.map((item) =>
          item.id === invoiceId ? { ...item, status: 'paid' } : item,
        ),
        services: current.services.map((service) =>
          linkedServiceIds.includes(service.id)
            ? { ...service, invoiceStatus: 'paid' }
            : service,
        ),
        updatedAt: new Date().toISOString(),
      }
    })
    setToast('Pagamento registrato.')
  }

  function requestClearWorkspace() {
    setClearConfirmOpen(true)
  }

  function clearWorkspaceData() {
    setWorkspace(resetWorkspaceState())
    setClearConfirmOpen(false)
    setToast('Archivio svuotato e pronto per dati reali.')
  }

  function updateSettings(settings: OperatorSettings) {
    const updatedAt = new Date().toISOString()
    setWorkspace((current) => ({
      ...current,
      settings: {
        ...settings,
        businessName: settings.businessName.trim() || 'NCC CRM',
        operatorName: settings.operatorName.trim(),
        phone: settings.phone.trim(),
        email: settings.email.trim(),
        vatNumber: settings.vatNumber.trim(),
        address: settings.address.trim(),
        defaultVatRate: Number(settings.defaultVatRate),
      },
      updatedAt,
    }))
    setToast('Dati operatore aggiornati.')
  }

  function exportAllIcs() {
    const content = buildIcsForServices(
      workspace.services,
      workspace.customers,
      workspace.vehicles,
    )
    downloadIcs('ncc-crm-servizi.ics', content)
    setToast('Calendario ICS esportato.')
  }

  function exportServiceIcs(service: Service) {
    const content = buildIcsForServices([service], workspace.customers, workspace.vehicles)
    downloadIcs(`${service.code.toLowerCase()}.ics`, content)
    setToast('File calendario del servizio esportato.')
  }

  function connectGoogleCalendar() {
    void requestGoogleAuthorizationUrl(window.location.href)
      .then((url) => {
        window.location.assign(url)
      })
      .catch((error: Error) => setToast(error.message))
  }

  function syncServiceToGoogle(service: Service) {
    const customer = workspace.customers.find((item) => item.id === service.customerId)
    const vehicle = workspace.vehicles.find((item) => item.id === service.vehicleId)
    const payload = getGoogleCalendarInsertPayload(service, customer, vehicle)

    void createGoogleCalendarEvent(payload)
      .then((result) => {
        const syncedAt = new Date().toISOString()
        setWorkspace((current) => ({
          ...current,
          services: current.services.map((item) =>
            item.id === service.id
              ? {
                  ...item,
                  sync: {
                    ...item.sync,
                    googleEventId: result.eventId,
                    lastSyncedAt: syncedAt,
                  },
                }
              : item,
          ),
          integrations: current.integrations.map((integration) =>
            integration.id === 'google-calendar'
              ? { ...integration, status: 'connected', lastSync: syncedAt }
              : integration,
          ),
          updatedAt: syncedAt,
        }))
        setToast('Evento creato su Google Calendar.')
      })
      .catch((error: Error) => setToast(error.message))
  }

  function copyGooglePayload(service: Service) {
    const customer = workspace.customers.find((item) => item.id === service.customerId)
    const vehicle = workspace.vehicles.find((item) => item.id === service.vehicleId)
    const payload = JSON.stringify(
      getGoogleCalendarInsertPayload(service, customer, vehicle),
      null,
      2,
    )

    if (!navigator.clipboard) {
      setToast('Clipboard non disponibile in questo browser.')
      return
    }

    void navigator.clipboard
      .writeText(payload)
      .then(() => setToast('Payload Google Calendar copiato.'))
      .catch(() => setToast('Non riesco a copiare il payload.'))
  }

  function sendInvoiceToProvider(invoice: Invoice) {
    const customer = getCustomer(workspace, invoice.customerId)
    const invoiceServices = workspace.services.filter((service) =>
      invoice.serviceIds.includes(service.id),
    )

    void createProviderInvoice({
      invoice,
      customer,
      services: invoiceServices,
      settings: workspace.settings,
    })
      .then((result) => {
        const syncedAt = new Date().toISOString()
        const externalId = result.externalId || (result.number ? String(result.number) : undefined)
        setWorkspace((current) => ({
          ...current,
          invoices: current.invoices.map((item) =>
            item.id === invoice.id
              ? {
                  ...item,
                  externalId,
                  status: item.status === 'paid' ? 'paid' : 'sent',
                }
              : item,
          ),
          services: current.services.map((service) =>
            invoice.serviceIds.includes(service.id)
              ? { ...service, invoiceStatus: service.invoiceStatus === 'paid' ? 'paid' : 'sent' }
              : service,
          ),
          integrations: current.integrations.map((integration) =>
            integration.id === 'invoicing'
              ? { ...integration, status: 'connected', lastSync: syncedAt }
              : integration,
          ),
          updatedAt: syncedAt,
        }))
        setToast(`Fattura inviata al provider ${result.provider}.`)
      })
      .catch((error: Error) => setToast(error.message))
  }

  function copyPaymentRequest(invoice: Invoice) {
    if (!navigator.clipboard) {
      setToast('Clipboard non disponibile in questo browser.')
      return
    }

    const customer = getCustomer(workspace, invoice.customerId)
    const invoiceServices = workspace.services.filter((service) =>
      invoice.serviceIds.includes(service.id),
    )
    const routes = invoiceServices
      .map((service) => `${formatShortDate(service.start)} ${service.pickup} -> ${service.dropoff}`)
      .join('\n')
    const message = [
      `${workspace.settings.businessName || 'NCC CRM'}`,
      `Richiesta pagamento fattura ${invoice.number}`,
      customer ? `Cliente: ${customer.name}` : '',
      `Totale: ${formatMoney(invoice.gross)}`,
      `Scadenza: ${formatShortDate(invoice.dueAt)}`,
      invoice.paymentMethod ? `Metodo: ${invoice.paymentMethod}` : '',
      routes ? `Servizi:\n${routes}` : '',
      'Grazie.',
    ]
      .filter(Boolean)
      .join('\n')

    void navigator.clipboard
      .writeText(message)
      .then(() => {
        const syncedAt = new Date().toISOString()
        setWorkspace((current) => ({
          ...current,
          integrations: current.integrations.map((integration) =>
            integration.id === 'payments'
              ? { ...integration, status: 'connected', lastSync: syncedAt }
              : integration,
          ),
          updatedAt: syncedAt,
        }))
        setToast('Richiesta pagamento copiata.')
      })
      .catch(() => setToast('Non riesco a copiare la richiesta pagamento.'))
  }

  function exportBackup() {
    downloadTextFile(
      `ncc-crm-backup-${toDateInputValue()}.json`,
      JSON.stringify(workspace, null, 2),
      'application/json',
    )
    setToast('Backup JSON esportato.')
  }

  function exportServicesCsv() {
    const rows = [
      [
        'Codice',
        'Data',
        'Ora',
        'Cliente',
        'Da',
        'A',
        'Stato',
        'Fattura',
        'Totale lordo',
      ],
      ...sortedServices.map((service) => {
        const customer = getCustomer(workspace, service.customerId)
        return [
          service.code,
          formatShortDate(service.start),
          formatTime(service.start),
          customer?.name ?? 'Cliente non trovato',
          service.pickup,
          service.dropoff,
          serviceStatusLabel(service.status),
          invoiceStatusLabel(service.invoiceStatus),
          String(service.price),
        ]
      }),
    ]
    downloadTextFile(
      `ncc-crm-servizi-${toDateInputValue()}.csv`,
      rows.map((row) => row.map(csvCell).join(',')).join('\n'),
      'text/csv;charset=utf-8',
    )
    setToast('Archivio servizi CSV esportato.')
  }

  function importBackup(file: File) {
    void file
      .text()
      .then((content) => {
        const parsed = JSON.parse(content) as Partial<WorkspaceState>
        setWorkspace(normalizeWorkspaceState(parsed))
        setToast('Backup importato correttamente.')
      })
      .catch(() => setToast('Backup non valido o non leggibile.'))
  }

  function requestCloudLogin(email: string) {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setToast('Inserisci una email per ricevere il link di accesso.')
      return
    }

    setCloudStatus('checking')
    void sendMagicLink(trimmedEmail)
      .then(() => setToast('Link di accesso Supabase inviato via email.'))
      .then(() => setCloudStatus('signed-out'))
      .catch(() => {
        setCloudStatus('error')
        setToast('Non riesco a inviare il link Supabase. Controlla Auth e URL progetto.')
      })
  }

  function disconnectCloud() {
    setCloudStatus('checking')
    void signOutCloud()
      .then(() => {
        setCloudHydrated(false)
        setCloudStatus('signed-out')
        setToast('Account cloud scollegato da questo browser.')
      })
      .catch(() => {
        setCloudStatus('error')
        setToast('Non riesco a scollegare Supabase.')
      })
  }

  function printQuote(quote: Quote) {
    const customer = getCustomer(workspace, quote.customerId)
    const vehicle = workspace.vehicles.find((item) => item.id === quote.vehicleId)
    openPrintWindow(
      `Preventivo ${quote.number}`,
      `
        <h1>Preventivo ${escapeHtml(quote.number)}</h1>
        <p class="muted">${escapeHtml(workspace.settings.businessName)} - ${escapeHtml(workspace.settings.vatNumber)}</p>
        <section>
          <h2>Cliente</h2>
          <p>${escapeHtml(customer?.name ?? 'Cliente non trovato')}</p>
          <p>${escapeHtml(customer?.email ?? '')} ${escapeHtml(customer?.phone ?? '')}</p>
        </section>
        <section>
          <h2>Servizio</h2>
          <p><strong>${escapeHtml(quote.title)}</strong></p>
          <p>${escapeHtml(quote.pickup)} -> ${escapeHtml(quote.dropoff)}</p>
          <p>${formatShortDate(quote.serviceDate)} alle ${formatTime(quote.serviceDate)} - ${quote.passengers} passeggeri - ${escapeHtml(vehicle?.name ?? 'Mezzo da assegnare')}</p>
        </section>
        <table>
          <tr><th>Imponibile</th><td>${formatMoney(quote.net)}</td></tr>
          <tr><th>IVA ${quote.vatRate}%</th><td>${formatMoney(quote.gross - quote.net)}</td></tr>
          <tr><th>Totale</th><td><strong>${formatMoney(quote.gross)}</strong></td></tr>
        </table>
        <p class="muted">Valido fino al ${formatShortDate(quote.validUntil)}. ${escapeHtml(quote.notes)}</p>
      `,
    )
  }

  function printInvoice(invoice: Invoice) {
    const customer = getCustomer(workspace, invoice.customerId)
    const invoiceServices = workspace.services.filter((service) =>
      invoice.serviceIds.includes(service.id),
    )
    openPrintWindow(
      `Fattura ${invoice.number}`,
      `
        <h1>Fattura ${escapeHtml(invoice.number)}</h1>
        <p class="muted">${escapeHtml(workspace.settings.businessName)} - ${escapeHtml(workspace.settings.vatNumber)}</p>
        <section>
          <h2>Cliente</h2>
          <p>${escapeHtml(customer?.name ?? 'Cliente non trovato')}</p>
          <p>${escapeHtml(customer?.vatNumber ?? customer?.email ?? '')}</p>
        </section>
        <table>
          <thead><tr><th>Servizio</th><th>Data</th><th>Importo</th></tr></thead>
          <tbody>
            ${invoiceServices
              .map(
                (service) =>
                  `<tr><td>${escapeHtml(service.title)}</td><td>${formatShortDate(service.start)}</td><td>${formatMoney(service.price)}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <table>
          <tr><th>Imponibile</th><td>${formatMoney(invoice.net)}</td></tr>
          <tr><th>IVA ${invoice.vatRate}%</th><td>${formatMoney(invoice.gross - invoice.net)}</td></tr>
          <tr><th>Totale</th><td><strong>${formatMoney(invoice.gross)}</strong></td></tr>
        </table>
        <p class="muted">Scadenza ${formatShortDate(invoice.dueAt)} - Metodo ${escapeHtml(invoice.paymentMethod)}</p>
      `,
    )
  }

  function openPrintWindow(title: string, body: string) {
    const printWindow = window.open('', '_blank', 'width=900,height=720')
    if (!printWindow) {
      setToast('Il browser ha bloccato la finestra di stampa.')
      return
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="it">
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #1f2b28; margin: 40px; line-height: 1.45; }
            h1 { margin: 0 0 6px; font-size: 28px; }
            h2 { font-size: 15px; margin: 22px 0 6px; }
            p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th, td { border: 1px solid #d9dfd8; padding: 10px; text-align: left; }
            th { background: #f4f6f2; }
            .muted { color: #64716d; }
          </style>
        </head>
        <body>${body}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  }

  const activeContent =
    activeView === 'dashboard' ? (
      <DashboardView
        now={now}
        state={workspace}
        services={sortedServices}
        onCreateInvoice={createInvoiceFromService}
        onDownloadIcs={exportServiceIcs}
        onExportAll={exportAllIcs}
        onStatusChange={updateServiceStatus}
        onSyncGoogle={syncServiceToGoogle}
      />
    ) : activeView === 'agenda' ? (
      <AgendaView
        selectedDate={selectedDate}
        selectedDay={selectedDay}
        services={sortedServices}
        state={workspace}
        onCreateInvoice={createInvoiceFromService}
        onDateChange={setSelectedDate}
        onDownloadIcs={exportServiceIcs}
        onStatusChange={updateServiceStatus}
        onSyncGoogle={syncServiceToGoogle}
      />
    ) : activeView === 'services' ? (
      <ServicesView
        services={sortedServices}
        state={workspace}
        onCopyGooglePayload={copyGooglePayload}
        onCreateInvoice={createInvoiceFromService}
        onDownloadIcs={exportServiceIcs}
        onStatusChange={updateServiceStatus}
        onSyncGoogle={syncServiceToGoogle}
      />
    ) : activeView === 'quotes' ? (
      <QuotesView
        state={workspace}
        onAddQuote={addQuote}
        onConvertQuote={convertQuoteToService}
        onPrintQuote={printQuote}
        onUpdateQuoteStatus={updateQuoteStatus}
      />
    ) : activeView === 'customers' ? (
      <CustomersView state={workspace} services={sortedServices} onAddCustomer={addCustomer} />
    ) : activeView === 'vehicles' ? (
      <VehiclesView
        state={workspace}
        services={sortedServices}
        onAddExpense={addExpense}
        onAddVehicle={addVehicle}
        onVehicleStatusChange={updateVehicleStatus}
      />
    ) : activeView === 'invoices' ? (
      <InvoicesView
        state={workspace}
        onCopyPaymentRequest={copyPaymentRequest}
        onMarkPaid={markInvoicePaid}
        onPrintInvoice={printInvoice}
        onSendInvoice={sendInvoiceToProvider}
      />
    ) : activeView === 'data' ? (
      <DataView
        key={settingsKey(workspace.settings)}
        cloudEmail={cloudEmail}
        cloudStatus={cloudStatus}
        cloudUserEmail={cloudSession?.user.email ?? ''}
        state={workspace}
        onCloudEmailChange={setCloudEmail}
        onExportBackup={exportBackup}
        onExportServicesCsv={exportServicesCsv}
        onImportBackup={importBackup}
        onRequestCloudLogin={requestCloudLogin}
        onUpdateSettings={updateSettings}
        onClearWorkspace={requestClearWorkspace}
        onSignOutCloud={disconnectCloud}
      />
    ) : activeView === 'integrations' ? (
      <IntegrationsView
        now={now}
        state={workspace}
        services={sortedServices}
        onConnectGoogleCalendar={connectGoogleCalendar}
        onCopyGooglePayload={copyGooglePayload}
        onExportAll={exportAllIcs}
        onOpenData={() => setActiveView('data')}
        onOpenInvoices={() => setActiveView('invoices')}
        onSyncGoogle={syncServiceToGoogle}
      />
    ) : (
      <SettingsView
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
      />
    )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <div className="brand">
            <div className="brand-mark">N</div>
            <div>
              <strong>NCC CRM</strong>
              <span>Gestionale operativo</span>
            </div>
          </div>

          <button
            className={
              activeView === 'settings' ? 'mobile-settings-button active' : 'mobile-settings-button'
            }
            type="button"
            aria-label="Impostazioni"
            onClick={() => setActiveView('settings')}
          >
            <Settings2 size={19} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Navigazione principale">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activeView === item.view ? 'nav-item active' : 'nav-item'}
                key={item.view}
                type="button"
                onClick={() => setActiveView(item.view)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>REALINDI DEN SYSTEMS</strong>
            <span>&copy; 2026</span>
          </div>
        </div>
      </aside>

      <nav className="mobile-tabbar" aria-label="Navigazione mobile">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={activeView === item.view ? 'nav-item active' : 'nav-item'}
              key={item.view}
              type="button"
              aria-current={activeView === item.view ? 'page' : undefined}
              onClick={() => setActiveView(item.view)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <main className="main-surface">
        <header className="topbar">
          <div>
            <p className="eyebrow">Oggi operativo</p>
            <h1>{formatDateLine(now)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" type="button" onClick={requestClearWorkspace}>
              Svuota dati
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={requestServiceCreation}
              title={serviceCreationTitle}
            >
              <Plus size={17} />
              Nuovo servizio
            </button>
          </div>
        </header>

        {activeContent}
      </main>

      {activeView !== 'settings' ? (
        <button
          className="mobile-fab"
          type="button"
          aria-label={serviceCreationTitle}
          onClick={requestServiceCreation}
          title={serviceCreationTitle}
        >
          <Plus size={22} />
        </button>
      ) : null}

      {isServiceFormOpen ? (
        <ServiceForm
          customers={workspace.customers}
          vehicles={workspace.vehicles}
          onClose={() => setServiceFormOpen(false)}
          onSubmit={addService}
        />
      ) : null}

      {isClearConfirmOpen ? (
        <ClearWorkspaceDialog
          onCancel={() => setClearConfirmOpen(false)}
          onConfirm={clearWorkspaceData}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}

function ClearWorkspaceDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-workspace-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Conferma richiesta</p>
            <h2 id="clear-workspace-title">Svuotare archivio locale?</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-body">
          <p>
            Questa azione rimuove clienti, servizi, mezzi, preventivi e fatture salvati in questo
            browser. Prima di procedere esporta un backup se devi conservare i dati.
          </p>
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onCancel}>
              Annulla
            </button>
            <button className="secondary-button danger-action" type="button" onClick={onConfirm}>
              Svuota archivio
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

interface WorkspaceProps {
  state: WorkspaceState
  services: Service[]
}

interface ServiceActions {
  onCreateInvoice: (service: Service) => void
  onDownloadIcs: (service: Service) => void
  onStatusChange: (serviceId: string, status: ServiceStatus) => void
  onSyncGoogle: (service: Service) => void
}

function DashboardView({
  now,
  state,
  services,
  onCreateInvoice,
  onDownloadIcs,
  onExportAll,
  onStatusChange,
  onSyncGoogle,
}: WorkspaceProps &
  ServiceActions & {
    now: Date
    onExportAll: () => void
  }) {
  const nowMs = now.getTime()
  const today = now
  const todayServices = services.filter((service) => isSameDay(service.start, today))
  const upcoming = services.find((service) => new Date(service.end).getTime() >= nowMs)
  const openInvoices = state.invoices.filter((invoice) => invoice.status !== 'paid')
  const weekRevenue = services
    .filter((service) => {
      const start = new Date(service.start).getTime()
      return (
        start >= nowMs - 24 * 60 * 60 * 1000 &&
        start <= nowMs + 7 * 24 * 60 * 60 * 1000
      )
    })
    .reduce((sum, service) => sum + service.price, 0)
  const confirmedRate =
    services.length > 0
      ? Math.round(
          (services.filter((service) => service.status === 'confirmed').length /
            services.length) *
            100,
        )
      : 0

  return (
    <section className="view-stack">
      <div className="dashboard-primary">
        <NextServiceCard state={state} service={upcoming} />
        <section className="panel timeline-panel">
          <PanelHeader
            icon={CalendarDays}
            title="Agenda di oggi"
            actionLabel="Esporta ICS"
            onAction={onExportAll}
          />
          <DayTimeline services={todayServices} state={state} />
        </section>
        <SideOperationsPanel state={state} />
      </div>

      <div className="stats-grid">
        <StatCard
          icon={Clock3}
          label="Servizi oggi"
          value={`${todayServices.length}`}
          detail={`${todayServices.filter((service) => service.status === 'confirmed').length} confermati`}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Valore prossimi 7 giorni"
          value={formatMoney(weekRevenue)}
          detail="lordo stimato"
        />
        <StatCard
          icon={ReceiptText}
          label="Fatture aperte"
          value={`${openInvoices.length}`}
          detail={formatMoney(openInvoices.reduce((sum, invoice) => sum + invoice.gross, 0))}
        />
        <StatCard
          icon={CheckCircle2}
          label="Conferme"
          value={`${confirmedRate}%`}
          detail="servizi confermati"
        />
      </div>

      <section className="panel">
        <PanelHeader icon={Route} title="Servizi in evidenza" />
        <ServicesTable
          compact
          services={services.slice(0, 5)}
          state={state}
          onCreateInvoice={onCreateInvoice}
          onDownloadIcs={onDownloadIcs}
          onStatusChange={onStatusChange}
          onSyncGoogle={onSyncGoogle}
        />
      </section>
    </section>
  )
}

function AgendaView({
  selectedDate,
  selectedDay,
  services,
  state,
  onCreateInvoice,
  onDateChange,
  onDownloadIcs,
  onStatusChange,
  onSyncGoogle,
}: WorkspaceProps &
  ServiceActions & {
    selectedDate: string
    selectedDay: Date
    onDateChange: (date: string) => void
  }) {
  const dayServices = services.filter((service) => isSameDay(service.start, selectedDay))

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Agenda servizi</h2>
          <p>Vista giorno con blocchi sincronizzabili su calendario.</p>
        </div>
        <input
          className="date-control"
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>

      <div className="agenda-layout">
        <section className="panel timeline-panel">
          <PanelHeader icon={CalendarDays} title={formatDateLabel(selectedDay.toISOString())} />
          <DayTimeline services={dayServices} state={state} />
        </section>

        <section className="panel">
          <PanelHeader icon={Route} title="Servizi del giorno" />
          <ServicesTable
            services={dayServices}
            state={state}
            onCreateInvoice={onCreateInvoice}
            onDownloadIcs={onDownloadIcs}
            onStatusChange={onStatusChange}
            onSyncGoogle={onSyncGoogle}
          />
        </section>
      </div>
    </section>
  )
}

function ServicesView({
  services,
  state,
  onCopyGooglePayload,
  onCreateInvoice,
  onDownloadIcs,
  onStatusChange,
  onSyncGoogle,
}: WorkspaceProps &
  ServiceActions & {
    onCopyGooglePayload: (service: Service) => void
  }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ServiceStatus | 'all'>('all')
  const filtered = services.filter((service) => {
    const customer = getCustomer(state, service.customerId)
    const text = `${service.code} ${service.title} ${service.pickup} ${service.dropoff} ${customer?.name}`
      .toLowerCase()
      .trim()
    return (
      text.includes(query.toLowerCase().trim()) &&
      (statusFilter === 'all' || service.status === statusFilter)
    )
  })

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Servizi e prenotazioni</h2>
          <p>Da qui una corsa puo diventare evento calendario e poi fattura.</p>
        </div>
        <div className="toolbar-controls">
          <label className="search-control">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca cliente, luogo, codice"
            />
          </label>
          <select
            className="date-control"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ServiceStatus | 'all')}
          >
            <option value="all">Tutti gli stati</option>
            <option value="confirmed">Confermati</option>
            <option value="pending">Da confermare</option>
            <option value="active">In corso</option>
            <option value="completed">Completati</option>
          </select>
        </div>
      </div>

      <section className="panel">
        <ServicesTable
          services={filtered}
          state={state}
          onCreateInvoice={onCreateInvoice}
          onDownloadIcs={onDownloadIcs}
          onStatusChange={onStatusChange}
          onSyncGoogle={onSyncGoogle}
          onCopyGooglePayload={onCopyGooglePayload}
        />
      </section>
    </section>
  )
}

function QuotesView({
  state,
  onAddQuote,
  onConvertQuote,
  onPrintQuote,
  onUpdateQuoteStatus,
}: {
  state: WorkspaceState
  onAddQuote: (draft: QuoteDraft) => void
  onConvertQuote: (quote: Quote) => void
  onPrintQuote: (quote: Quote) => void
  onUpdateQuoteStatus: (quoteId: string, status: QuoteStatus) => void
}) {
  const [draft, setDraft] = useState<QuoteDraft>(() => createEmptyQuoteDraft(state))
  const acceptedTotal = state.quotes
    .filter((quote) => quote.status === 'accepted')
    .reduce((sum, quote) => sum + quote.gross, 0)
  const openTotal = state.quotes
    .filter((quote) => quote.status === 'draft' || quote.status === 'sent')
    .reduce((sum, quote) => sum + quote.gross, 0)
  const canCreateQuote = state.customers.length > 0 && state.vehicles.length > 0

  function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAddQuote({
      ...draft,
      gross: Number(draft.gross),
      passengers: Number(draft.passengers),
    })
    setDraft(createEmptyQuoteDraft(state))
  }

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Preventivi</h2>
          <p>Offerte rapide, stampabili e trasformabili in servizi confermati.</p>
        </div>
      </div>

      <div className="stats-grid compact-stats">
        <StatCard icon={FileText} label="Preventivi" value={`${state.quotes.length}`} detail="archivio locale" />
        <StatCard icon={Send} label="Aperti" value={formatMoney(openTotal)} detail="bozze e inviati" />
        <StatCard icon={CheckCircle2} label="Accettati" value={formatMoney(acceptedTotal)} detail="valore confermato" />
      </div>

      <div className="quote-layout">
        <section className="panel">
          <PanelHeader icon={Plus} title="Nuovo preventivo" />
          {!canCreateQuote ? (
            <p className="empty-copy">Inserisci almeno un cliente e un mezzo prima di creare preventivi.</p>
          ) : null}
          <form className="compact-form" onSubmit={submitQuote}>
            <label>
              Cliente
              <select
                value={draft.customerId}
                onChange={(event) => setDraft({ ...draft, customerId: event.target.value })}
                required
              >
                {state.customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Titolo
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Titolo del servizio"
                required
              />
            </label>

            <div className="form-row">
              <label>
                Da
                <input
                  value={draft.pickup}
                  onChange={(event) => setDraft({ ...draft, pickup: event.target.value })}
                  required
                />
              </label>
              <label>
                A
                <input
                  value={draft.dropoff}
                  onChange={(event) => setDraft({ ...draft, dropoff: event.target.value })}
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Data servizio
                <input
                  type="datetime-local"
                  value={draft.serviceDate}
                  onChange={(event) => setDraft({ ...draft, serviceDate: event.target.value })}
                  required
                />
              </label>
              <label>
                Valido fino
                <input
                  type="datetime-local"
                  value={draft.validUntil}
                  onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}
                  required
                />
              </label>
              <label>
                Passeggeri
                <input
                  min={1}
                  type="number"
                  value={draft.passengers}
                  onChange={(event) => setDraft({ ...draft, passengers: Number(event.target.value) })}
                  required
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Mezzo
                <select
                  value={draft.vehicleId}
                  onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })}
                  required
                >
                  {state.vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo servizio
                <input
                  value={draft.serviceType}
                  onChange={(event) => setDraft({ ...draft, serviceType: event.target.value })}
                  required
                />
              </label>
              <label>
                Totale lordo
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={draft.gross}
                  onChange={(event) => setDraft({ ...draft, gross: Number(event.target.value) })}
                  required
                />
              </label>
            </div>

            <label>
              Note
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>

            <div className="modal-actions">
              <button className="primary-button" type="submit" disabled={!canCreateQuote}>
                <Plus size={16} />
                Crea preventivo
              </button>
            </div>
          </form>
        </section>

        <section className="panel quote-list-panel">
          <PanelHeader icon={FileText} title="Archivio preventivi" />
          <div className="quote-list">
            {state.quotes.length === 0 ? (
              <p className="empty-copy compact-empty">Nessun preventivo salvato. Crea il primo preventivo dal modulo.</p>
            ) : null}
            {state.quotes.map((quote) => {
              const customer = getCustomer(state, quote.customerId)
              const vehicle = state.vehicles.find((item) => item.id === quote.vehicleId)
              return (
                <article className="quote-card" key={quote.id}>
                  <div className="quote-card-top">
                    <div>
                      <strong>{quote.number}</strong>
                      <span>{customer?.name ?? 'Cliente non trovato'}</span>
                    </div>
                    <StatusBadge type="quote" value={quote.status} />
                  </div>
                  <h3>{quote.title}</h3>
                  <p>
                    {quote.pickup}
                    {' -> '}
                    {quote.dropoff}
                  </p>
                  <div className="quote-meta">
                    <span>{formatShortDate(quote.serviceDate)} {formatTime(quote.serviceDate)}</span>
                    <span>{vehicle?.name ?? 'Mezzo da assegnare'}</span>
                    <strong>{formatMoney(quote.gross)}</strong>
                  </div>
                  <div className="quote-actions">
                    <select
                      className="status-select"
                      value={quote.status}
                      aria-label={`Stato ${quote.number}`}
                      onChange={(event) =>
                        onUpdateQuoteStatus(quote.id, event.target.value as QuoteStatus)
                      }
                    >
                      <option value="draft">{quoteStatusLabel('draft')}</option>
                      <option value="sent">{quoteStatusLabel('sent')}</option>
                      <option value="accepted">{quoteStatusLabel('accepted')}</option>
                      <option value="expired">{quoteStatusLabel('expired')}</option>
                    </select>
                    <button className="table-action" type="button" onClick={() => onPrintQuote(quote)} title="Stampa preventivo">
                      <Printer size={15} />
                    </button>
                    <button
                      className="table-action"
                      type="button"
                      disabled={Boolean(quote.convertedServiceId)}
                      onClick={() => onConvertQuote(quote)}
                      title="Trasforma in servizio"
                    >
                      <Route size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </section>
  )
}

function CustomersView({
  state,
  services,
  onAddCustomer,
}: WorkspaceProps & {
  onAddCustomer: (draft: CustomerDraft) => string
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(state.customers[0]?.id ?? '')
  const [draft, setDraft] = useState<CustomerDraft>(() => createEmptyCustomerDraft())
  const selectedCustomer = state.customers.find((customer) => customer.id === selectedCustomerId)
  const customerServices = services.filter((service) => service.customerId === selectedCustomerId)
  const customerInvoices = state.invoices.filter((invoice) => invoice.customerId === selectedCustomerId)
  const gross = customerServices.reduce((sum, service) => sum + service.price, 0)

  function submitCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const customerId = onAddCustomer(draft)
    setSelectedCustomerId(customerId)
    setDraft(createEmptyCustomerDraft())
  }

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Clienti</h2>
          <p>Anagrafica snella, storico corse e dati utili alla fatturazione.</p>
        </div>
      </div>

      <div className="customer-layout">
        <section className="panel customer-list-panel">
          <PanelHeader icon={UsersRound} title="Rubrica" />
          <div className="customer-list">
            {state.customers.map((customer) => (
              <button
                className={customer.id === selectedCustomerId ? 'customer-row active' : 'customer-row'}
                key={customer.id}
                type="button"
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <span>{customer.name}</span>
                <small>{customer.tags.join(' / ')}</small>
              </button>
            ))}
          </div>

          <form className="compact-form customer-create-form" onSubmit={submitCustomer}>
            <h3>Nuovo cliente</h3>
            <label>
              Nome
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                required
              />
            </label>
            <label>
              Tipo
              <select
                value={draft.kind}
                onChange={(event) =>
                  setDraft({ ...draft, kind: event.target.value as Customer['kind'] })
                }
              >
                <option value="private">Privato</option>
                <option value="business">Azienda</option>
                <option value="hotel">Hotel</option>
                <option value="agency">Agenzia</option>
              </select>
            </label>
            <label>
              Telefono
              <input
                value={draft.phone}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                required
              />
            </label>
            <label>
              Azienda
              <input
                value={draft.company}
                onChange={(event) => setDraft({ ...draft, company: event.target.value })}
              />
            </label>
            <label>
              P. IVA
              <input
                value={draft.vatNumber}
                onChange={(event) => setDraft({ ...draft, vatNumber: event.target.value })}
              />
            </label>
            <label>
              Indirizzo
              <input
                value={draft.address}
                onChange={(event) => setDraft({ ...draft, address: event.target.value })}
              />
            </label>
            <label>
              Pickup preferito
              <input
                value={draft.preferredPickup}
                onChange={(event) => setDraft({ ...draft, preferredPickup: event.target.value })}
              />
            </label>
            <label>
              Tag
              <input
                value={draft.tags}
                onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
                placeholder="Tag separati da virgola"
              />
            </label>
            <label>
              Note
              <textarea
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </label>
            <button className="secondary-button" type="submit">
              <UserPlus size={16} />
              Aggiungi
            </button>
          </form>
        </section>

        <section className="panel customer-detail">
          {selectedCustomer ? (
            <>
              <div className="customer-heading">
                <div className="avatar">
                  <UserRound size={22} />
                </div>
                <div>
                  <h2>{selectedCustomer.name}</h2>
                  <p>{selectedCustomer.company ?? customerKindLabel(selectedCustomer.kind)}</p>
                </div>
              </div>

              <div className="detail-grid">
                <DetailItem label="Telefono" value={selectedCustomer.phone} />
                <DetailItem label="Email" value={selectedCustomer.email} />
                <DetailItem label="Partita IVA" value={selectedCustomer.vatNumber ?? 'Non presente'} />
                <DetailItem label="Indirizzo" value={selectedCustomer.address ?? 'Non presente'} />
                <DetailItem label="Pickup preferito" value={selectedCustomer.preferredPickup ?? 'Da chiedere'} />
                <DetailItem label="Note" value={selectedCustomer.notes} />
              </div>

              <div className="stats-grid compact-stats">
                <StatCard icon={Route} label="Servizi" value={`${customerServices.length}`} detail="storico cliente" />
                <StatCard icon={CircleDollarSign} label="Valore" value={formatMoney(gross)} detail="lordo corse" />
                <StatCard icon={ReceiptText} label="Fatture" value={`${customerInvoices.length}`} detail="collegate" />
              </div>

              <section className="nested-section">
                <h3>Ultimi servizi</h3>
                <div className="mini-list">
                  {customerServices.map((service) => (
                    <div className="mini-row" key={service.id}>
                      <span>{service.code}</span>
                      <strong>{service.title}</strong>
                      <small>{formatShortDate(service.start)}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </section>
      </div>
    </section>
  )
}

function VehiclesView({
  onAddExpense,
  onAddVehicle,
  services,
  state,
  onVehicleStatusChange,
}: {
  onAddExpense: (draft: ExpenseDraft) => void
  onAddVehicle: (draft: VehicleDraft) => void
  services: Service[]
  state: WorkspaceState
  onVehicleStatusChange: (vehicleId: string, status: Vehicle['status']) => void
}) {
  const [draft, setDraft] = useState<VehicleDraft>(() => createEmptyVehicleDraft())
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() =>
    createEmptyExpenseDraft(state),
  )
  const expensesTotal = state.expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const availableVehicles = state.vehicles.filter((vehicle) => vehicle.status === 'available')
  const canRegisterExpense = state.vehicles.length > 0
  const nextDeadline = state.vehicles
    .flatMap((vehicle) => [
      { vehicle, label: 'Assicurazione', date: vehicle.insuranceUntil },
      { vehicle, label: 'Revisione', date: vehicle.revisionUntil },
      { vehicle, label: 'Autorizzazione NCC', date: vehicle.nccPermitUntil },
    ])
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())[0]

  function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAddVehicle(draft)
    setDraft(createEmptyVehicleDraft())
  }

  function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canRegisterExpense || Number(expenseDraft.amount) <= 0) return
    const vehicleId = state.vehicles.some((vehicle) => vehicle.id === expenseDraft.vehicleId)
      ? expenseDraft.vehicleId
      : state.vehicles[0]?.id ?? ''
    const serviceId = services.some((service) => service.id === expenseDraft.serviceId)
      ? expenseDraft.serviceId
      : ''
    onAddExpense({
      ...expenseDraft,
      amount: Number(expenseDraft.amount),
      vehicleId,
      serviceId,
    })
    setExpenseDraft(createEmptyExpenseDraft(state))
  }

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Mezzi e scadenze</h2>
          <p>Parco auto, manutenzioni e costi collegabili ai servizi.</p>
        </div>
      </div>

      <div className="stats-grid compact-stats">
        <StatCard icon={Car} label="Disponibili" value={`${availableVehicles.length}/${state.vehicles.length}`} detail="mezzi pronti" />
        <StatCard icon={Fuel} label="Costi registrati" value={formatMoney(expensesTotal)} detail="spese operative" />
        <StatCard
          icon={ShieldCheck}
          label="Prossima scadenza"
          value={nextDeadline ? formatShortDate(nextDeadline.date) : '-'}
          detail={nextDeadline ? `${nextDeadline.label} ${nextDeadline.vehicle.plate}` : 'nessuna scadenza'}
        />
      </div>

      <section className="panel">
        <PanelHeader icon={Plus} title="Nuovo mezzo" />
        <form className="compact-form" onSubmit={submitVehicle}>
          <div className="form-row">
            <label>
              Nome mezzo
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Nome mezzo"
                required
              />
            </label>
            <label>
              Targa
              <input
                value={draft.plate}
                onChange={(event) => setDraft({ ...draft, plate: event.target.value })}
                placeholder="Targa"
                required
              />
            </label>
            <label>
              Posti
              <input
                min={1}
                type="number"
                value={draft.capacity}
                onChange={(event) => setDraft({ ...draft, capacity: Number(event.target.value) })}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Assicurazione
              <input
                type="date"
                value={draft.insuranceUntil}
                onChange={(event) => setDraft({ ...draft, insuranceUntil: event.target.value })}
                required
              />
            </label>
            <label>
              Revisione
              <input
                type="date"
                value={draft.revisionUntil}
                onChange={(event) => setDraft({ ...draft, revisionUntil: event.target.value })}
                required
              />
            </label>
            <label>
              Autorizzazione NCC
              <input
                type="date"
                value={draft.nccPermitUntil}
                onChange={(event) => setDraft({ ...draft, nccPermitUntil: event.target.value })}
                required
              />
            </label>
          </div>
          <label>
            Note mezzo
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <div className="modal-actions">
            <button className="primary-button" type="submit">
              <Plus size={16} />
              Aggiungi mezzo
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <PanelHeader icon={Fuel} title="Nuova spesa" />
        {!canRegisterExpense ? (
          <p className="empty-copy compact-empty">Inserisci almeno un mezzo prima di registrare spese.</p>
        ) : null}
        <form className="compact-form" onSubmit={submitExpense}>
          <div className="form-row">
            <label>
              Mezzo
              <select
                value={expenseDraft.vehicleId}
                onChange={(event) =>
                  setExpenseDraft({ ...expenseDraft, vehicleId: event.target.value })
                }
                required
              >
                <option value="" disabled>
                  Seleziona mezzo
                </option>
                {state.vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} - {vehicle.plate}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={expenseDraft.category}
                onChange={(event) =>
                  setExpenseDraft({
                    ...expenseDraft,
                    category: event.target.value as ExpenseCategory,
                  })
                }
              >
                <option value="fuel">Carburante</option>
                <option value="tolls">Pedaggi</option>
                <option value="parking">Parcheggio</option>
                <option value="maintenance">Manutenzione</option>
                <option value="wash">Lavaggio</option>
                <option value="other">Altro</option>
              </select>
            </label>
            <label>
              Data
              <input
                type="date"
                value={expenseDraft.date}
                onChange={(event) => setExpenseDraft({ ...expenseDraft, date: event.target.value })}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              Importo
              <input
                min={0.01}
                step="0.01"
                type="number"
                value={expenseDraft.amount}
                onChange={(event) =>
                  setExpenseDraft({ ...expenseDraft, amount: Number(event.target.value) })
                }
                required
              />
            </label>
            <label>
              Servizio collegato
              <select
                value={expenseDraft.serviceId}
                onChange={(event) =>
                  setExpenseDraft({ ...expenseDraft, serviceId: event.target.value })
                }
              >
                <option value="">Nessun servizio</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.code} - {service.title || formatShortDate(service.start)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Descrizione
            <input
              value={expenseDraft.description}
              onChange={(event) =>
                setExpenseDraft({ ...expenseDraft, description: event.target.value })
              }
              required
            />
          </label>
          <div className="modal-actions">
            <button className="primary-button" type="submit" disabled={!canRegisterExpense}>
              <Plus size={16} />
              Registra spesa
            </button>
          </div>
        </form>
      </section>

      <div className="vehicle-grid">
        {state.vehicles.length === 0 ? (
          <section className="panel empty-state">
            <PanelHeader icon={Car} title="Parco mezzi" />
            <p>Non ci sono mezzi inseriti. Aggiungi il primo mezzo per creare servizi.</p>
          </section>
        ) : null}
        {state.vehicles.map((vehicle) => {
          const vehicleExpenses = state.expenses.filter((expense) => expense.vehicleId === vehicle.id)
          const vehicleExpenseTotal = vehicleExpenses.reduce((sum, expense) => sum + expense.amount, 0)
          const deadlines = [
            { label: 'Assicurazione', date: vehicle.insuranceUntil },
            { label: 'Revisione', date: vehicle.revisionUntil },
            { label: 'Autorizzazione NCC', date: vehicle.nccPermitUntil },
          ]

          return (
            <section className="panel vehicle-card" key={vehicle.id}>
              <div className="vehicle-card-head">
                <div>
                  <h2>{vehicle.name}</h2>
                  <p>{vehicle.plate} - {vehicle.capacity} posti</p>
                  <small>{vehicleStatusLabel(vehicle.status)}</small>
                </div>
                <select
                  className="status-select"
                  value={vehicle.status}
                  aria-label={`Stato ${vehicle.name}`}
                  onChange={(event) =>
                    onVehicleStatusChange(vehicle.id, event.target.value as Vehicle['status'])
                  }
                >
                  <option value="available">Disponibile</option>
                  <option value="service">In servizio</option>
                  <option value="maintenance">Manutenzione</option>
                </select>
              </div>

              <p>{vehicle.notes}</p>

              <div className="deadline-list">
                {deadlines.map((deadline) => {
                  const days = daysUntil(deadline.date)
                  return (
                    <div className={days <= 30 ? 'deadline-row urgent' : 'deadline-row'} key={deadline.label}>
                      <span>{deadline.label}</span>
                      <strong>{formatShortDate(deadline.date)}</strong>
                      <small>{days >= 0 ? `${days} giorni` : 'scaduta'}</small>
                    </div>
                  )
                })}
              </div>

              <div className="expense-block">
                <div className="expense-summary">
                  <span>Spese mezzo</span>
                  <strong>{formatMoney(vehicleExpenseTotal)}</strong>
                </div>
                <div className="mini-list">
                  {vehicleExpenses.map((expense) => (
                    <div className="mini-row" key={expense.id}>
                      <span>{expenseCategoryLabel(expense.category)}</span>
                      <strong>{expense.description}</strong>
                      <small>{formatShortDate(expense.date)} - {formatMoney(expense.amount)}</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function DataView({
  cloudEmail,
  cloudStatus,
  cloudUserEmail,
  state,
  onCloudEmailChange,
  onExportBackup,
  onExportServicesCsv,
  onImportBackup,
  onRequestCloudLogin,
  onUpdateSettings,
  onClearWorkspace,
  onSignOutCloud,
}: {
  cloudEmail: string
  cloudStatus: CloudStatus
  cloudUserEmail: string
  state: WorkspaceState
  onCloudEmailChange: (email: string) => void
  onExportBackup: () => void
  onExportServicesCsv: () => void
  onImportBackup: (file: File) => void
  onRequestCloudLogin: (email: string) => void
  onUpdateSettings: (settings: OperatorSettings) => void
  onClearWorkspace: () => void
  onSignOutCloud: () => void
}) {
  const [settingsDraft, setSettingsDraft] = useState<OperatorSettings>(state.settings)
  const storedSize = formatBytes(new Blob([JSON.stringify(state)]).size)
  const isCloudConnected = Boolean(cloudUserEmail)

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onUpdateSettings({
      ...settingsDraft,
      defaultVatRate: Number(settingsDraft.defaultVatRate),
    })
  }

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Dati e impostazioni</h2>
          <p>Backup, esportazioni e controlli locali prima del backend online.</p>
        </div>
      </div>

      <div className="stats-grid compact-stats">
        <StatCard icon={Database} label="Archivio locale" value={storedSize} detail="stimato nel browser" />
        <StatCard icon={Route} label="Servizi" value={`${state.services.length}`} detail="prenotazioni salvate" />
        <StatCard icon={UsersRound} label="Clienti" value={`${state.customers.length}`} detail="rubrica locale" />
      </div>

      <div className="data-grid">
        <section className="panel cloud-panel">
          <PanelHeader icon={Database} title="Cloud Supabase" />
          <div className="cloud-status-row">
            <span>{cloudStatusLabel(cloudStatus)}</span>
            {isCloudConnected ? <strong>{cloudUserEmail}</strong> : null}
          </div>
          {isCloudConnected ? (
            <button className="ghost-button" type="button" onClick={onSignOutCloud}>
              Scollega cloud
            </button>
          ) : (
            <form
              className="compact-form"
              onSubmit={(event) => {
                event.preventDefault()
                onRequestCloudLogin(cloudEmail)
              }}
            >
              <label>
                Email operatore
                <input
                  type="email"
                  value={cloudEmail}
                  onChange={(event) => onCloudEmailChange(event.target.value)}
                  placeholder="nome@email.it"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={cloudStatus === 'disabled' || cloudStatus === 'checking'}
              >
                Invia link accesso
              </button>
            </form>
          )}
          <p>
            Il salvataggio cloud usa Supabase Auth e una riga protetta da RLS per ogni utente.
          </p>
        </section>

        <section className="panel">
          <PanelHeader icon={FileDown} title="Export e backup" />
          <div className="data-actions">
            <button className="primary-button" type="button" onClick={onExportBackup}>
              <FileDown size={16} />
              Backup JSON
            </button>
            <button className="secondary-button" type="button" onClick={onExportServicesCsv}>
              <Download size={16} />
              Servizi CSV
            </button>
            <label className="ghost-button import-button">
              <Upload size={16} />
              Importa backup
              <input
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0]
                  if (file) onImportBackup(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <PanelHeader icon={Settings2} title="Intestazione operatore" />
          <form className="compact-form" onSubmit={submitSettings}>
            <div className="form-row">
              <label>
                Nome attivita
                <input
                  value={settingsDraft.businessName}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, businessName: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                Operatore
                <input
                  value={settingsDraft.operatorName}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, operatorName: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Telefono
                <input
                  value={settingsDraft.phone}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, phone: event.target.value })
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={settingsDraft.email}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, email: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Partita IVA
                <input
                  value={settingsDraft.vatNumber}
                  onChange={(event) =>
                    setSettingsDraft({ ...settingsDraft, vatNumber: event.target.value })
                  }
                />
              </label>
              <label>
                IVA default
                <input
                  min={0}
                  step="0.1"
                  type="number"
                  value={settingsDraft.defaultVatRate}
                  onChange={(event) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      defaultVatRate: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label>
              Indirizzo
              <input
                value={settingsDraft.address}
                onChange={(event) =>
                  setSettingsDraft({ ...settingsDraft, address: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button className="primary-button" type="submit">
                <Settings2 size={16} />
                Salva impostazioni
              </button>
            </div>
          </form>
        </section>

        <section className="panel danger-panel">
          <PanelHeader icon={Wrench} title="Archivio locale" />
          <p>
            I dati sono salvati nel browser e sincronizzabili con Supabase quando il cloud e
            configurato. Lo svuotamento torna a un archivio neutro senza dati precompilati.
          </p>
          <button className="ghost-button" type="button" onClick={onClearWorkspace}>
            Svuota archivio
          </button>
        </section>
      </div>
    </section>
  )
}

function SettingsView({
  themePreference,
  onThemePreferenceChange,
}: {
  themePreference: ThemePreference
  onThemePreferenceChange: (preference: ThemePreference) => void
}) {
  const activeTheme =
    themeOptions.find((option) => option.value === themePreference) ?? themeOptions[2]

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Impostazioni</h2>
          <p>Preferenze generali dell'interfaccia NCC CRM.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel theme-panel">
          <PanelHeader icon={Settings2} title="Tema generale" />
          <div className="theme-grid" role="group" aria-label="Tema generale dell'app">
            {themeOptions.map((option) => {
              const Icon = option.icon
              const isActive = option.value === themePreference

              return (
                <button
                  className="theme-option"
                  type="button"
                  key={option.value}
                  aria-pressed={isActive}
                  onClick={() => onThemePreferenceChange(option.value)}
                >
                  <span className="theme-option-icon">
                    <Icon size={20} />
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="panel theme-panel">
          <PanelHeader icon={ShieldCheck} title="Tema attivo" />
          <div className="theme-summary">
            <div>
              <span>Preferenza salvata</span>
              <strong>{activeTheme.label}</strong>
            </div>
            <div className="theme-preview" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
          <p className="empty-copy">
            La scelta resta memorizzata in questo browser e viene applicata a cruscotto, agenda,
            modali, tabelle e navigazione mobile.
          </p>
        </section>
      </div>
    </section>
  )
}

function InvoicesView({
  state,
  onCopyPaymentRequest,
  onMarkPaid,
  onPrintInvoice,
  onSendInvoice,
}: {
  state: WorkspaceState
  onCopyPaymentRequest: (invoice: Invoice) => void
  onMarkPaid: (invoiceId: string) => void
  onPrintInvoice: (invoice: Invoice) => void
  onSendInvoice: (invoice: Invoice) => void
}) {
  const openTotal = state.invoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + invoice.gross, 0)
  const paidTotal = state.invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.gross, 0)

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Fatturazione</h2>
          <p>Controllo rapido tra corse da emettere, inviate e pagate.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={ReceiptText} label="Da incassare" value={formatMoney(openTotal)} detail="fatture aperte" />
        <StatCard icon={CheckCircle2} label="Incassato" value={formatMoney(paidTotal)} detail="fatture pagate" />
        <StatCard icon={FileText} label="Documenti" value={`${state.invoices.length}`} detail="archivio locale" />
      </div>

      <section className="panel">
        <div className="invoice-list">
          {state.invoices.length === 0 ? (
            <p className="empty-copy compact-empty">Nessuna fattura presente. Generala da un servizio confermato.</p>
          ) : null}
          {state.invoices.map((invoice) => {
            const customer = getCustomer(state, invoice.customerId)
            return (
              <article className="invoice-row" key={invoice.id}>
                <div>
                  <strong>{invoice.number}</strong>
                  <span>{customer?.name ?? 'Cliente non trovato'}</span>
                  {invoice.externalId ? <small>Provider {invoice.externalId}</small> : null}
                </div>
                <div>
                  <small>Scadenza</small>
                  <span>{formatShortDate(invoice.dueAt)}</span>
                </div>
                <div>
                  <small>Totale</small>
                  <strong>{formatMoney(invoice.gross)}</strong>
                </div>
                <StatusBadge type="invoice" value={invoice.status} />
                <div className="document-actions">
                  <button
                    className="table-action"
                    type="button"
                    onClick={() => onPrintInvoice(invoice)}
                    title="Stampa fattura"
                  >
                    <Printer size={16} />
                  </button>
                  <button
                    className="table-action"
                    type="button"
                    disabled={Boolean(invoice.externalId)}
                    onClick={() => onSendInvoice(invoice)}
                    title={
                      invoice.externalId
                        ? 'Fattura gia inviata al provider'
                        : 'Invia al provider fatturazione'
                    }
                  >
                    <Send size={16} />
                  </button>
                  <button
                    className="table-action"
                    type="button"
                    disabled={invoice.status === 'paid'}
                    onClick={() => onCopyPaymentRequest(invoice)}
                    title="Copia richiesta pagamento"
                  >
                    <CircleDollarSign size={16} />
                  </button>
                  <button
                    className="table-action"
                    type="button"
                    disabled={invoice.status === 'paid'}
                    onClick={() => onMarkPaid(invoice.id)}
                    title="Segna pagata"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}

function IntegrationsView({
  now,
  state,
  services,
  onConnectGoogleCalendar,
  onCopyGooglePayload,
  onExportAll,
  onOpenData,
  onOpenInvoices,
  onSyncGoogle,
}: WorkspaceProps & {
  now: Date
  onConnectGoogleCalendar: () => void
  onCopyGooglePayload: (service: Service) => void
  onExportAll: () => void
  onOpenData: () => void
  onOpenInvoices: () => void
  onSyncGoogle: (service: Service) => void
}) {
  const nextService =
    services.find((service) => new Date(service.end).getTime() >= now.getTime()) ?? services[0]

  return (
    <section className="view-stack">
      <div className="section-toolbar">
        <div>
          <h2>Integrazioni</h2>
          <p>Collegamenti operativi per calendario, pagamenti e fatturazione esterna.</p>
        </div>
      </div>

      <div className="integration-grid">
        {state.integrations.map((integration) => (
          <section className="panel integration-card" key={integration.id}>
            <div className="integration-topline">
              <div className="integration-icon">
                {integration.id === 'apple-calendar' ? (
                  <Smartphone size={20} />
                ) : integration.id === 'invoicing' ? (
                  <FileText size={20} />
                ) : integration.id === 'payments' ? (
                  <CircleDollarSign size={20} />
                ) : (
                  <CalendarDays size={20} />
                )}
              </div>
              <StatusBadge type="integration" value={integration.status} />
            </div>
            <h3>{integration.name}</h3>
            <p>{integration.description}</p>
            <small>
              Stato tecnico: {integrationStatusLabel(integration.status)}
              {integration.lastSync ? `, ultimo sync ${formatShortDate(integration.lastSync)}` : ''}
            </small>
          </section>
        ))}
      </div>

      <section className="panel integration-workbench">
        <PanelHeader icon={Link2} title="Ponte calendario pronto" />
        <div className="workbench-grid">
          <div>
            <h3>Google Calendar</h3>
            <p>
              OAuth server-side pronto: collega l account Google e invia i servizi direttamente
              sul calendario dell operatore.
            </p>
            <div className="workbench-actions">
              <button className="primary-button" type="button" onClick={onConnectGoogleCalendar}>
                <Link2 size={16} />
                Collega Google
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!nextService}
                onClick={() => nextService && onSyncGoogle(nextService)}
              >
                <CalendarDays size={16} />
                Sincronizza servizio
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={!nextService}
                onClick={() => nextService && onCopyGooglePayload(nextService)}
              >
                <Copy size={16} />
                Copia payload
              </button>
            </div>
          </div>

          <div>
            <h3>Apple Calendar / ICS</h3>
            <p>
              Apple Calendar importa file e feed iCalendar. Qui puoi gia scaricare un calendario
              completo dei servizi NCC CRM.
            </p>
            <button className="secondary-button" type="button" onClick={onExportAll}>
              <Download size={16} />
              Scarica calendario
            </button>
          </div>

          <div>
            <h3>Fatturazione elettronica</h3>
            <p>
              Endpoint backend pronto per inviare le fatture a Fatture in Cloud quando token e
              company ID sono presenti su Vercel.
            </p>
            <button className="secondary-button" type="button" onClick={onOpenInvoices}>
              <ReceiptText size={16} />
              Apri fatture
            </button>
          </div>

          <div>
            <h3>Pagamenti</h3>
            <p>
              Ogni fattura aperta genera subito una richiesta pagamento copiabile per WhatsApp,
              email o POS, con stato incasso aggiornabile.
            </p>
            <div className="workbench-actions">
              <button className="secondary-button" type="button" onClick={onOpenInvoices}>
                <CircleDollarSign size={16} />
                Richieste pagamento
              </button>
              <button className="ghost-button" type="button" onClick={onOpenData}>
                <Settings2 size={16} />
                Dati intestazione
              </button>
            </div>
          </div>
        </div>
      </section>
    </section>
  )
}

function NextServiceCard({
  state,
  service,
}: {
  state: WorkspaceState
  service?: Service
}) {
  if (!service) {
    return (
      <section className="panel next-service empty-state">
        <PanelHeader icon={Route} title="Prossimo servizio" />
        <p>Nessun servizio programmato.</p>
      </section>
    )
  }

  const customer = getCustomer(state, service.customerId)
  const vehicle = state.vehicles.find((item) => item.id === service.vehicleId)

  return (
    <section className="panel next-service">
      <PanelHeader icon={Plane} title="Prossimo servizio" />
      <div className="next-time">
        <strong>{formatTime(service.start)}</strong>
        <span>{durationLabel(service.start, service.end)}</span>
      </div>
      <h2>{service.title}</h2>
      <div className="route-line">
        <MapPin size={17} />
        <span>
          {service.pickup}
          {' -> '}
          {service.dropoff}
        </span>
      </div>
      <div className="next-meta">
        <span>{customer?.name ?? 'Cliente non trovato'}</span>
        <span>{vehicle?.name ?? 'Mezzo non assegnato'}</span>
        <span>{formatMoney(service.price)}</span>
      </div>
      <StatusBadge type="service" value={service.status} />
    </section>
  )
}

function SideOperationsPanel({ state }: { state: WorkspaceState }) {
  const nextVehicleDeadline = [...state.vehicles].sort(
    (left, right) =>
      new Date(left.insuranceUntil).getTime() - new Date(right.insuranceUntil).getTime(),
  )[0]
  const dueInvoices = state.invoices.filter((invoice) => invoice.status !== 'paid')

  return (
    <aside className="side-panel">
      <section className="panel">
        <PanelHeader icon={ReceiptText} title="Fatture" />
        <div className="mini-list">
          {dueInvoices.map((invoice) => (
            <div className="mini-row" key={invoice.id}>
              <span>{invoice.number}</span>
              <strong>{formatMoney(invoice.gross)}</strong>
              <small>{invoiceStatusLabel(invoice.status)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader icon={Car} title="Mezzi" />
        {nextVehicleDeadline ? (
          <div className="vehicle-row">
            <strong>{nextVehicleDeadline.name}</strong>
            <span>{nextVehicleDeadline.plate}</span>
            <small>Assicurazione {formatShortDate(nextVehicleDeadline.insuranceUntil)}</small>
          </div>
        ) : (
          <p className="empty-copy">Nessun mezzo inserito.</p>
        )}
      </section>

      <section className="panel">
        <PanelHeader icon={Link2} title="Sync" />
        <div className="sync-list">
          {state.integrations.slice(0, 2).map((integration) => (
            <div className="sync-row" key={integration.id}>
              <span>{integration.name}</span>
              <StatusBadge type="integration" value={integration.status} />
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}

function ServicesTable({
  compact,
  services,
  state,
  onCopyGooglePayload,
  onCreateInvoice,
  onDownloadIcs,
  onStatusChange,
  onSyncGoogle,
}: WorkspaceProps &
  ServiceActions & {
    compact?: boolean
    onCopyGooglePayload?: (service: Service) => void
  }) {
  if (services.length === 0) {
    return <p className="empty-copy">Nessun servizio trovato per questi filtri.</p>
  }

  return (
    <div className="table-scroll">
      <table className={compact ? 'service-table compact' : 'service-table'}>
        <thead>
          <tr>
            <th>Ora</th>
            <th>Cliente</th>
            <th>Tratta</th>
            <th>Stato</th>
            <th>Fattura</th>
            <th>Totale</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => {
            const customer = getCustomer(state, service.customerId)
            return (
              <tr key={service.id}>
                <td data-label="Ora">
                  <strong>{formatTime(service.start)}</strong>
                  <span>{formatShortDate(service.start)}</span>
                </td>
                <td data-label="Cliente">
                  <strong>{customer?.name ?? 'Cliente non trovato'}</strong>
                  <span>{service.code}</span>
                </td>
                <td data-label="Tratta">
                  <strong>{service.pickup}</strong>
                  <span>{service.dropoff}</span>
                </td>
                <td data-label="Stato">
                  <select
                    className="status-select"
                    value={service.status}
                    aria-label={`Stato ${service.code}`}
                    onChange={(event) =>
                      onStatusChange(service.id, event.target.value as ServiceStatus)
                    }
                  >
                    <option value="pending">{serviceStatusLabel('pending')}</option>
                    <option value="confirmed">{serviceStatusLabel('confirmed')}</option>
                    <option value="active">{serviceStatusLabel('active')}</option>
                    <option value="completed">{serviceStatusLabel('completed')}</option>
                  </select>
                </td>
                <td data-label="Fattura">
                  <StatusBadge type="invoice" value={service.invoiceStatus} />
                </td>
                <td data-label="Totale">
                  <strong>{formatMoney(service.price)}</strong>
                </td>
                <td data-label="Azioni">
                  <div className="table-actions">
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => onDownloadIcs(service)}
                      title="Scarica evento ICS"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className="table-action"
                      type="button"
                      disabled={service.invoiceStatus !== 'to-issue'}
                      onClick={() => onCreateInvoice(service)}
                      title="Genera fattura"
                    >
                      <ReceiptText size={15} />
                    </button>
                    {onCopyGooglePayload ? (
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => onCopyGooglePayload(service)}
                        title="Copia payload Google Calendar"
                      >
                        <Copy size={15} />
                      </button>
                    ) : null}
                    <button
                      className="table-action"
                      type="button"
                      disabled={Boolean(service.sync.googleEventId)}
                      onClick={() => onSyncGoogle(service)}
                      title={
                        service.sync.googleEventId
                          ? 'Evento Google gia creato'
                          : 'Crea evento su Google Calendar'
                      }
                    >
                      <CalendarDays size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DayTimeline({ services, state }: WorkspaceProps) {
  if (services.length === 0) {
    return <p className="empty-copy compact-empty">Nessun servizio in agenda.</p>
  }

  const hours = Array.from({ length: 17 }, (_, index) => index + 6)
  const dayStart = 6 * 60
  const totalMinutes = 17 * 60

  return (
    <div className="day-timeline">
      <div className="time-axis">
        {hours.map((hour) => (
          <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
        ))}
      </div>
      <div className="timeline-canvas">
        {hours.map((hour) => (
          <div className="timeline-line" key={hour} />
        ))}
        {services.map((service) => {
          const customer = getCustomer(state, service.customerId)
          const top = ((minutesFromMidnight(service.start) - dayStart) / totalMinutes) * 100
          const height =
            ((minutesFromMidnight(service.end) - minutesFromMidnight(service.start)) /
              totalMinutes) *
            100

          return (
            <article
              className={`timeline-event timeline-${service.status}`}
              key={service.id}
              style={{
                top: `${Math.max(0, Math.min(95, top))}%`,
                minHeight: `${Math.max(44, height * 5.8)}px`,
              }}
            >
              <strong>{formatTime(service.start)} · {customer?.name}</strong>
              <span>{service.pickup}</span>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({
  detail,
  icon: Icon,
  label,
  value,
}: {
  detail: string
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <section className="stat-card">
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  )
}

function PanelHeader({
  actionLabel,
  icon: Icon,
  onAction,
  title,
}: {
  actionLabel?: string
  icon: LucideIcon
  onAction?: () => void
  title: string
}) {
  return (
    <div className="panel-header">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      {actionLabel && onAction ? (
        <button className="text-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value || 'Non impostato'}</strong>
    </div>
  )
}

function getCustomer(state: WorkspaceState, customerId: string): Customer | undefined {
  return state.customers.find((customer) => customer.id === customerId)
}

function customerKindLabel(kind: Customer['kind']) {
  const labels: Record<Customer['kind'], string> = {
    agency: 'Agenzia',
    business: 'Azienda',
    hotel: 'Hotel',
    private: 'Privato',
  }
  return labels[kind]
}

function createEmptyCustomerDraft(): CustomerDraft {
  return {
    name: '',
    kind: 'private',
    phone: '',
    email: '',
    company: '',
    vatNumber: '',
    address: '',
    preferredPickup: '',
    notes: '',
    tags: '',
  }
}

function createEmptyQuoteDraft(state: WorkspaceState): QuoteDraft {
  const serviceDate = new Date()
  serviceDate.setDate(serviceDate.getDate() + 2)
  serviceDate.setHours(9, 0, 0, 0)

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 1)
  validUntil.setHours(23, 59, 0, 0)

  return {
    customerId: state.customers[0]?.id ?? '',
    title: '',
    pickup: '',
    dropoff: '',
    serviceDate: toDateTimeInputValue(serviceDate),
    passengers: 1,
    vehicleId: state.vehicles[0]?.id ?? '',
    serviceType: '',
    gross: 0,
    validUntil: toDateTimeInputValue(validUntil),
    notes: '',
  }
}

function createEmptyVehicleDraft(): VehicleDraft {
  return {
    name: '',
    plate: '',
    capacity: 4,
    insuranceUntil: futureDateInput(30),
    revisionUntil: futureDateInput(180),
    nccPermitUntil: futureDateInput(365),
    notes: '',
  }
}

function createEmptyExpenseDraft(state: WorkspaceState): ExpenseDraft {
  return {
    date: toDateInputValue(),
    category: 'fuel',
    description: '',
    amount: 0,
    vehicleId: state.vehicles[0]?.id ?? '',
    serviceId: '',
  }
}

function futureDateInput(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function toDateTimeInputValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function getNextDocumentNumber(items: Array<{ number: string }>, prefix: string, fallback: number) {
  const next = items.reduce((max, item) => {
    const parsed = Number(item.number.split('-').at(-1))
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max
  }, fallback) + 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

function getNextServiceCode(services: Service[]) {
  const next = services.reduce((max, service) => {
    const parsed = Number(service.code.split('-').at(-1))
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max
  }, 0) + 1
  return `NCC-${String(next).padStart(4, '0')}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

function vehicleStatusLabel(status: Vehicle['status']) {
  const labels: Record<Vehicle['status'], string> = {
    available: 'Disponibile',
    maintenance: 'Manutenzione',
    service: 'In servizio',
  }
  return labels[status]
}

function expenseCategoryLabel(category: ExpenseCategory) {
  const labels: Record<ExpenseCategory, string> = {
    fuel: 'Carburante',
    maintenance: 'Manutenzione',
    other: 'Altro',
    parking: 'Parcheggio',
    tolls: 'Pedaggi',
    wash: 'Lavaggio',
  }
  return labels[category]
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}

function cloudStatusLabel(status: CloudStatus) {
  const labels: Record<CloudStatus, string> = {
    checking: 'Controllo accesso',
    disabled: 'Supabase non configurato',
    error: 'Errore sync',
    'signed-out': 'Non collegato',
    synced: 'Sincronizzato',
    syncing: 'Sincronizzazione',
  }
  return labels[status]
}

function settingsKey(settings: OperatorSettings) {
  return [
    settings.businessName,
    settings.operatorName,
    settings.phone,
    settings.email,
    settings.vatNumber,
    settings.address,
    settings.defaultVatRate,
  ].join('|')
}

export default App
