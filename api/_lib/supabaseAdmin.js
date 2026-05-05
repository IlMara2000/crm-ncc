import { createClient } from '@supabase/supabase-js'
import { HttpError } from './http.js'

let publicClient
let adminClient

function supabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
}

function supabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
}

function missingConfig(name) {
  throw new HttpError(503, `Variabile server mancante: ${name}`)
}

export function getPublicSupabase() {
  if (publicClient) return publicClient
  const url = supabaseUrl()
  const anonKey = supabaseAnonKey()
  if (!url) missingConfig('SUPABASE_URL o VITE_SUPABASE_URL')
  if (!anonKey) missingConfig('SUPABASE_ANON_KEY o VITE_SUPABASE_ANON_KEY')
  publicClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return publicClient
}

export function getAdminSupabase() {
  if (adminClient) return adminClient
  const url = supabaseUrl()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) missingConfig('SUPABASE_URL o VITE_SUPABASE_URL')
  if (!serviceRoleKey) missingConfig('SUPABASE_SERVICE_ROLE_KEY')
  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return adminClient
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header || typeof header !== 'string') {
    throw new HttpError(401, 'Sessione Supabase mancante')
  }

  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError(401, 'Header Authorization non valido')
  }

  return token
}

export async function requireUser(req) {
  const token = getBearerToken(req)
  const supabase = getPublicSupabase()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    throw new HttpError(401, 'Sessione Supabase scaduta o non valida')
  }

  return { user: data.user, accessToken: token }
}
