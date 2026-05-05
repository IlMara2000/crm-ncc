import { buildGoogleAuthorizationUrl } from '../_lib/googleCalendar.js'
import { readJson, requireMethod, sendError, sendJson } from '../_lib/http.js'
import { requireUser } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST')
    const { user } = await requireUser(req)
    const body = await readJson(req)
    const url = buildGoogleAuthorizationUrl(req, user.id, body.returnTo)
    sendJson(res, 200, { ok: true, url })
  } catch (error) {
    sendError(res, error)
  }
}
