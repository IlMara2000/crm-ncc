import { getValidGoogleAccessToken, insertCalendarEvent } from '../_lib/googleCalendar.js'
import { readJson, requireMethod, sendError, sendJson } from '../_lib/http.js'
import { getAdminSupabase, requireUser } from '../_lib/supabaseAdmin.js'

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST')
    const { user } = await requireUser(req)
    const body = await readJson(req)
    const accessToken = await getValidGoogleAccessToken(getAdminSupabase(), user.id)
    const event = await insertCalendarEvent(
      accessToken,
      body.event,
      body.calendarId || process.env.GOOGLE_CALENDAR_ID || 'primary',
    )

    sendJson(res, 200, {
      ok: true,
      eventId: event.id,
      htmlLink: event.htmlLink,
      event,
    })
  } catch (error) {
    sendError(res, error)
  }
}
