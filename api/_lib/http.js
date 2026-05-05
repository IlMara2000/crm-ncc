export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export function requireMethod(req, method) {
  if (req.method !== method) {
    throw new HttpError(405, `Metodo ${req.method} non supportato`)
  }
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body)

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim()
  return rawBody ? JSON.parse(rawBody) : {}
}

export function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export function sendRedirect(res, location) {
  res.statusCode = 302
  res.setHeader('location', location)
  res.end()
}

export function sendError(res, error) {
  if (error instanceof HttpError) {
    sendJson(res, error.status, {
      ok: false,
      message: error.message,
      details: error.details,
    })
    return
  }

  console.error(error)
  sendJson(res, 500, {
    ok: false,
    message: 'Errore interno del backend NCC CRM',
  })
}

export function getRequestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

export function appendQuery(url, params) {
  const nextUrl = new URL(url)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) nextUrl.searchParams.set(key, String(value))
  })
  return nextUrl.toString()
}
