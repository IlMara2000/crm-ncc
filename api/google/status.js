import { requireMethod, sendError, sendJson } from '../_lib/http.js'
import { getAdminSupabase, requireUser } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  try {
    requireMethod(req, 'GET')
    const { user } = await requireUser(req)
    const { data, error } = await getAdminSupabase()
      .from('google_calendar_tokens')
      .select('expires_at,updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    sendJson(res, 200, {
      ok: true,
      connected: Boolean(data),
      expiresAt: data?.expires_at,
      updatedAt: data?.updated_at,
    })
  } catch (error) {
    sendError(res, error)
  }
}
