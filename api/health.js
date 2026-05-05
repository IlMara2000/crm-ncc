import { sendJson } from './_lib/http.js'

export default function handler(_req, res) {
  sendJson(res, 200, {
    ok: true,
    app: 'NCC CRM',
    checks: {
      supabase: Boolean(
        (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
          (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
      ),
      supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      googleCalendar: Boolean(
        process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REDIRECT_URI,
      ),
      invoicing: Boolean(
        process.env.FATTURE_IN_CLOUD_TOKEN && process.env.FATTURE_IN_CLOUD_COMPANY_ID,
      ),
    },
  })
}
