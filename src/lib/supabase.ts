import { createClient, type Session } from '@supabase/supabase-js'
import type { WorkspaceState } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export type CloudStatus =
  | 'disabled'
  | 'checking'
  | 'signed-out'
  | 'syncing'
  | 'synced'
  | 'error'

export interface CloudWorkspaceRow {
  user_id: string
  state: WorkspaceState
  updated_at: string
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null

export type SupabaseSession = Session

export async function fetchCloudWorkspace(userId: string) {
  if (!supabase) throw new Error('Supabase non configurato')

  const { data, error } = await supabase
    .from('workspaces')
    .select('user_id,state,updated_at')
    .eq('user_id', userId)
    .maybeSingle<CloudWorkspaceRow>()

  if (error) throw error
  return data
}

export async function saveCloudWorkspace(userId: string, state: WorkspaceState) {
  if (!supabase) throw new Error('Supabase non configurato')

  const { error } = await supabase.from('workspaces').upsert({
    user_id: userId,
    state,
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Supabase non configurato')

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  })

  if (error) throw error
}

export async function signOutCloud() {
  if (!supabase) throw new Error('Supabase non configurato')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
