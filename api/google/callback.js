import {
  exchangeGoogleCode,
  sanitizeReturnTo,
  storeGoogleTokens,
  verifyGoogleState,
} from '../_lib/googleCalendar.js'
import { appendQuery, getRequestOrigin, sendRedirect } from '../_lib/http.js'
import { getAdminSupabase } from '../_lib/supabaseAdmin.js'

function failureRedirect(req, state, reason) {
  try {
    const payload = verifyGoogleState(state)
    return appendQuery(payload.returnTo || sanitizeReturnTo(req), {
      calendar: 'error',
      reason,
    })
  } catch {
    return appendQuery(`${getRequestOrigin(req)}/`, {
      calendar: 'error',
      reason,
    })
  }
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', getRequestOrigin(req))
  const code = requestUrl.searchParams.get('code')
  const state = requestUrl.searchParams.get('state')
  const oauthError = requestUrl.searchParams.get('error')

  if (oauthError) {
    sendRedirect(res, failureRedirect(req, state, oauthError))
    return
  }

  try {
    if (!code) throw new Error('codice OAuth mancante')
    const payload = verifyGoogleState(state)
    const tokens = await exchangeGoogleCode(code)
    await storeGoogleTokens(getAdminSupabase(), payload.userId, tokens)
    sendRedirect(
      res,
      appendQuery(payload.returnTo || sanitizeReturnTo(req), {
        calendar: 'connected',
      }),
    )
  } catch (error) {
    console.error(error)
    sendRedirect(res, failureRedirect(req, state, 'callback_failed'))
  }
}
