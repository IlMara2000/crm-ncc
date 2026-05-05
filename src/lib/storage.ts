import { seedWorkspace } from '../data/seed'
import type { WorkspaceState } from './types'

const STORAGE_KEY = 'sceva-ncc-crm-state-v1'

function createSeedWorkspaceState(): WorkspaceState {
  return {
    ...JSON.parse(JSON.stringify(seedWorkspace)),
    updatedAt: new Date().toISOString(),
  } as WorkspaceState
}

export function normalizeWorkspaceState(value: Partial<WorkspaceState>): WorkspaceState {
  const seed = createSeedWorkspaceState()

  return {
    ...seed,
    ...value,
    customers: value.customers ?? seed.customers,
    vehicles: (value.vehicles ?? seed.vehicles).map((vehicle) => {
      const seedVehicle = seed.vehicles.find((item) => item.id === vehicle.id)
      return {
        ...vehicle,
        notes: vehicle.notes ?? '',
        nccPermitUntil: vehicle.nccPermitUntil ?? seedVehicle?.nccPermitUntil ?? seed.updatedAt,
      }
    }),
    services: value.services ?? seed.services,
    invoices: value.invoices ?? seed.invoices,
    quotes: value.quotes ?? seed.quotes,
    expenses: value.expenses ?? seed.expenses,
    integrations: value.integrations ?? seed.integrations,
    settings: value.settings ?? seed.settings,
    updatedAt: value.updatedAt ?? seed.updatedAt,
  }
}

export function loadWorkspaceState(): WorkspaceState {
  if (typeof window === 'undefined') return createSeedWorkspaceState()

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (!stored) return createSeedWorkspaceState()

  try {
    return normalizeWorkspaceState(JSON.parse(stored) as Partial<WorkspaceState>)
  } catch {
    return createSeedWorkspaceState()
  }
}

export function hasStoredWorkspaceState() {
  if (typeof window === 'undefined') return false
  return Boolean(window.localStorage.getItem(STORAGE_KEY))
}

export function saveWorkspaceState(state: WorkspaceState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function resetWorkspaceState() {
  window.localStorage.removeItem(STORAGE_KEY)
  return createSeedWorkspaceState()
}
