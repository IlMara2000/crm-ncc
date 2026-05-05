import { createIssuedDocument } from '../_lib/invoicing.js'
import { readJson, requireMethod, sendError, sendJson } from '../_lib/http.js'
import { getAdminSupabase, requireUser } from '../_lib/supabaseAdmin.js'

async function logInvoiceExport(userId, invoiceId, result) {
  try {
    const { error } = await getAdminSupabase().from('invoice_exports').insert({
      user_id: userId,
      invoice_id: invoiceId,
      provider: result.provider,
      provider_document_id: result.externalId,
      provider_response: result.response,
    })
    if (error) console.error(error)
  } catch (error) {
    console.error(error)
  }
}

export default async function handler(req, res) {
  try {
    requireMethod(req, 'POST')
    const { user } = await requireUser(req)
    const body = await readJson(req)
    const result = await createIssuedDocument(body)
    await logInvoiceExport(user.id, body.invoice?.id, result)

    sendJson(res, 200, {
      ok: true,
      provider: result.provider,
      externalId: result.externalId,
      number: result.number,
      response: result.response,
    })
  } catch (error) {
    sendError(res, error)
  }
}
