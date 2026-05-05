import type { Customer, Service, Vehicle } from './types'

function toIcsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildServiceDescription(
  service: Service,
  customer?: Customer,
  vehicle?: Vehicle,
) {
  return [
    `Cliente: ${customer?.name ?? 'Cliente non trovato'}`,
    `Telefono: ${customer?.phone ?? '-'}`,
    `Servizio: ${service.serviceType}`,
    `Passeggeri: ${service.passengers}`,
    `Mezzo: ${vehicle ? `${vehicle.name} (${vehicle.plate})` : '-'}`,
    service.flight ? `Volo/treno: ${service.flight}` : '',
    service.notes ? `Note: ${service.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function getGoogleCalendarInsertPayload(
  service: Service,
  customer?: Customer,
  vehicle?: Vehicle,
) {
  return {
    summary: `${service.code} - ${service.title}`,
    location: service.pickup,
    description: buildServiceDescription(service, customer, vehicle),
    start: {
      dateTime: service.start,
      timeZone: 'Europe/Rome',
    },
    end: {
      dateTime: service.end,
      timeZone: 'Europe/Rome',
    },
    extendedProperties: {
      private: {
        scevaServiceId: service.id,
        customerId: service.customerId,
        vehicleId: service.vehicleId,
      },
    },
  }
}

export function buildIcsForServices(
  services: Service[],
  customers: Customer[],
  vehicles: Vehicle[],
) {
  const stamp = toIcsDate(new Date().toISOString())
  const events = services.map((service) => {
    const customer = customers.find((item) => item.id === service.customerId)
    const vehicle = vehicles.find((item) => item.id === service.vehicleId)
    const description = buildServiceDescription(service, customer, vehicle)

    return [
      'BEGIN:VEVENT',
      `UID:${service.id}@sceva.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsDate(service.start)}`,
      `DTEND:${toIcsDate(service.end)}`,
      `SUMMARY:${escapeIcs(`${service.code} - ${service.title}`)}`,
      `LOCATION:${escapeIcs(service.pickup)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `CATEGORIES:${escapeIcs(service.status)}`,
      'END:VEVENT',
    ].join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SCEVA//NCC CRM//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
