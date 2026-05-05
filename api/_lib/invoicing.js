import { HttpError } from './http.js'

function dateOnly(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10)
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
  )
}

function invoiceItemFromService(service, vatRate, vatId) {
  const gross = roundMoney(service.price)
  const net = roundMoney(gross / (1 + vatRate / 100))
  return {
    code: service.code,
    name: service.title || `Servizio NCC ${service.code}`,
    description: `${service.pickup || ''}${service.dropoff ? ` -> ${service.dropoff}` : ''}`.trim(),
    net_price: net,
    category: 'NCC',
    discount: 0,
    qty: 1,
    vat: {
      id: vatId,
    },
  }
}

export function buildFattureInCloudDocument({ customer, invoice, services, settings }) {
  if (!customer) throw new HttpError(400, 'Cliente fattura mancante')
  if (!invoice) throw new HttpError(400, 'Fattura mancante')

  const vatRate = Number(invoice.vatRate || settings?.defaultVatRate || 22)
  const vatId = Number(process.env.FATTURE_IN_CLOUD_VAT_ID || 0)
  const items =
    Array.isArray(services) && services.length > 0
      ? services.map((service) => invoiceItemFromService(service, vatRate, vatId))
      : [
          {
            code: invoice.number,
            name: `Servizi NCC ${invoice.number}`,
            net_price: roundMoney(invoice.net),
            category: 'NCC',
            discount: 0,
            qty: 1,
            vat: { id: vatId },
          },
        ]

  return {
    data: {
      type: 'invoice',
      entity: compactObject({
        name: customer.company || customer.name,
        vat_number: customer.vatNumber,
        address_street: customer.address,
        country: 'Italia',
        email: customer.email,
        phone: customer.phone,
      }),
      date: dateOnly(invoice.issuedAt),
      subject: `NCC CRM ${invoice.number}`,
      visible_subject: `Servizi NCC ${invoice.number}`,
      currency: {
        id: 'EUR',
      },
      language: {
        code: 'it',
        name: 'italiano',
      },
      items_list: items,
      payments_list: [
        {
          amount: roundMoney(invoice.gross),
          due_date: dateOnly(invoice.dueAt),
          status: invoice.status === 'paid' ? 'paid' : 'not_paid',
        },
      ],
      notes: settings?.businessName ? `Documento generato da ${settings.businessName}` : undefined,
    },
  }
}

export async function createIssuedDocument(payload) {
  const token = process.env.FATTURE_IN_CLOUD_TOKEN
  const companyId = process.env.FATTURE_IN_CLOUD_COMPANY_ID
  const provider = process.env.INVOICING_PROVIDER || 'fatture-in-cloud'

  if (provider !== 'fatture-in-cloud') {
    throw new HttpError(501, `Provider fatturazione non supportato: ${provider}`)
  }

  if (!token || !companyId) {
    throw new HttpError(
      501,
      'Fatturazione esterna non configurata: servono FATTURE_IN_CLOUD_TOKEN e FATTURE_IN_CLOUD_COMPANY_ID su Vercel',
    )
  }

  const body = buildFattureInCloudDocument(payload)
  const response = await fetch(
    `https://api-v2.fattureincloud.it/c/${encodeURIComponent(companyId)}/issued_documents`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new HttpError(response.status, 'Provider fatturazione ha rifiutato la fattura', data)
  }

  return {
    provider,
    request: body,
    response: data,
    externalId: data?.data?.id ? String(data.data.id) : undefined,
    number: data?.data?.number,
  }
}
