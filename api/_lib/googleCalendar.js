import crypto from 'node:crypto'
import { HttpError, getRequestOrigin } from './http.js'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const STATE_MAX_AGE_MS = 30 * 60 * 1000

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!clientId) throw new HttpError(503, 'Variabile server mancante: GOOGLE_CLIENT_ID')
  if (!clientSecret) throw new HttpError(503, 'Variabile server mancante: GOOGLE_CLIENT_SECRET')
  if (!redirectUri) throw new HttpError(503, 'Variabile server mancante: GOOGLE_REDIRECT_URI')
  if (!stateSecret) throw new HttpError(503, 'Variabile server mancante: GOOGLE_OAUTH_STATE_SECRET')

  return { clientId, clientSecret, redirectUri, stateSecret }
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url')
}

function signedState(payload) {
  const { stateSecret } = getGoogleConfig()
  const body = base64UrlJson({
    ...payload,
    nonce: crypto.randomBytes(16).toString('base64url'),
    createdAt: Date.now(),
  })
  return `${body}.${sign(body, stateSecret)}`
}

export function verifyGoogleState(state) {
  const { stateSecret } = getGoogleConfig()
  const [body, signature] = String(state || '').split('.')
  if (!body || !signature) throw new HttpError(400, 'State OAuth mancante o non valido')

  const expected = sign(body, stateSecret)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    throw new HttpError(400, 'State OAuth non verificato')
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  if (!payload.createdAt || Date.now() - payload.createdAt > STATE_MAX_AGE_MS) {
    throw new HttpError(400, 'State OAuth scaduto')
  }

  return payload
}

function allowedReturnOrigins(req) {
  const values = [
    getRequestOrigin(req),
    process.env.APP_ORIGIN,
    process.env.VITE_APP_ORIGIN,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ]
  return new Set(values.filter(Boolean))
}

export function sanitizeReturnTo(req, rawReturnTo) {
  const origin = getRequestOrigin(req)
  const fallback = `${origin}/`
  if (!rawReturnTo) return fallback

  try {
    const candidate = new URL(rawReturnTo, origin)
    if (!allowedReturnOrigins(req).has(candidate.origin)) return fallback
    return candidate.toString()
  } catch {
    return fallback
  }
}

export function buildGoogleAuthorizationUrl(req, userId, returnTo) {
  const { clientId, redirectUri } = getGoogleConfig()
  const state = signedState({
    userId,
    returnTo: sanitizeReturnTo(req, returnTo),
  })
  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: clientId,
    include_granted_scopes: 'true',
    prompt: 'consent',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeGoogleCode(code) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  return requestGoogleToken(body)
}

export async function refreshGoogleAccessToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleConfig()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  return requestGoogleToken(body)
}

async function requestGoogleToken(body) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpError(response.status, 'Google OAuth ha rifiutato la richiesta', payload)
  }

  return payload
}

function tokenExpiry(tokens) {
  const seconds = Math.max(60, Number(tokens.expires_in || 3600) - 60)
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export async function storeGoogleTokens(supabase, userId, tokens) {
  const { data: existing } = await supabase
    .from('google_calendar_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const refreshToken = tokens.refresh_token || existing?.refresh_token
  if (!tokens.access_token || !refreshToken) {
    throw new HttpError(
      400,
      'Google non ha restituito un refresh token. Revoca il consenso e riprova il collegamento.',
    )
  }

  const { error } = await supabase.from('google_calendar_tokens').upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: refreshToken,
    expires_at: tokenExpiry(tokens),
    scope: tokens.scope,
    token_type: tokens.token_type || 'Bearer',
    updated_at: new Date().toISOString(),
  })

  if (error) throw new HttpError(500, 'Non riesco a salvare i token Google', error)
}

export async function getValidGoogleAccessToken(supabase, userId) {
  const { data, error } = await supabase
    .from('google_calendar_tokens')
    .select('access_token,refresh_token,expires_at,scope,token_type')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new HttpError(500, 'Non riesco a leggere il collegamento Google', error)
  if (!data) throw new HttpError(409, 'Google Calendar non e ancora collegato')

  const expiresAt = new Date(data.expires_at).getTime()
  if (expiresAt > Date.now() + 60_000) return data.access_token

  const refreshed = await refreshGoogleAccessToken(data.refresh_token)
  const { error: updateError } = await supabase
    .from('google_calendar_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token || data.refresh_token,
      expires_at: tokenExpiry(refreshed),
      scope: refreshed.scope || data.scope,
      token_type: refreshed.token_type || data.token_type || 'Bearer',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) throw new HttpError(500, 'Non riesco ad aggiornare il token Google', updateError)
  return refreshed.access_token
}

export async function insertCalendarEvent(accessToken, event, calendarId = 'primary') {
  if (!event?.start || !event?.end || !event.summary) {
    throw new HttpError(400, 'Evento calendario incompleto')
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  )
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpError(response.status, 'Google Calendar non ha creato l evento', payload)
  }

  return payload
}
