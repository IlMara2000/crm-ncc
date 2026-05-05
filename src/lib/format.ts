const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
})

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const dateLineFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const shortDateFormatter = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
})

export function formatMoney(value: number) {
  return currencyFormatter.format(value)
}

export function formatDateLabel(iso: string) {
  return dateFormatter.format(new Date(iso))
}

export function formatDateLine(date: Date) {
  return dateLineFormatter.format(date)
}

export function formatShortDate(iso: string) {
  return shortDateFormatter.format(new Date(iso))
}

export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso))
}

export function toDateInputValue(date: Date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function combineLocalDateAndTime(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString()
}

export function isSameDay(iso: string, date: Date) {
  const left = new Date(iso)
  return (
    left.getFullYear() === date.getFullYear() &&
    left.getMonth() === date.getMonth() &&
    left.getDate() === date.getDate()
  )
}

export function minutesFromMidnight(iso: string) {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

export function durationLabel(start: string, end: string) {
  const minutes = Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000),
  )
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder} min`
  if (remainder === 0) return `${hours} h`
  return `${hours} h ${remainder} min`
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}
