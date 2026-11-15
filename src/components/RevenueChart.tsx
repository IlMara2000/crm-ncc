import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney } from '../lib/format'
import type { Service } from '../lib/types'

type RevenuePoint = {
  label: string
  fullLabel: string
  revenue: number
  rides: number
}

type ChartTooltipProps = {
  active?: boolean
  label?: string | number
  payload?: readonly { payload?: RevenuePoint }[]
}

function shortMoney(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k €`
  return `${Math.round(value)} €`
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function RevenueChart({
  services,
  now,
  days = 14,
}: {
  services: Service[]
  now: Date
  days?: number
}) {
  const points = useMemo<RevenuePoint[]>(() => {
    const buckets = new Map<string, RevenuePoint>()

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index)
      buckets.set(dayKey(date), {
        label: `${`${date.getDate()}`.padStart(2, '0')}/${`${date.getMonth() + 1}`.padStart(2, '0')}`,
        fullLabel: date.toLocaleDateString('it-IT', {
          weekday: 'short',
          day: '2-digit',
          month: 'long',
        }),
        revenue: 0,
        rides: 0,
      })
    }

    for (const service of services) {
      const start = new Date(service.start)
      const bucket = buckets.get(dayKey(start))
      if (!bucket) continue
      bucket.revenue += service.price
      bucket.rides += 1
    }

    return [...buckets.values()]
  }, [days, now, services])

  const total = points.reduce((sum, point) => sum + point.revenue, 0)
  const average = total / points.length
  const best = points.reduce(
    (top, point) => (point.revenue > top.revenue ? point : top),
    points[0] ?? { label: '-', fullLabel: '-', revenue: 0, rides: 0 },
  )

  return (
    <motion.section
      className="panel chart-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="panel-header">
        <div>
          <TrendingUp size={18} />
          <h2>Andamento incassi</h2>
        </div>
        <span className="chart-range">Ultimi {days} giorni</span>
      </div>

      <div className="chart-figures">
        <div>
          <span>Totale periodo</span>
          <strong>{formatMoney(total)}</strong>
        </div>
        <div>
          <span>Media giornaliera</span>
          <strong>{formatMoney(average)}</strong>
        </div>
        <div>
          <span>Giorno migliore</span>
          <strong>{formatMoney(best.revenue)}</strong>
          <small>{best.rides > 0 ? `${best.rides} servizi` : 'nessun servizio'}</small>
        </div>
      </div>

      {total === 0 ? (
        <p className="chart-empty">
          Nessun servizio con incasso negli ultimi {days} giorni: il grafico si popola appena
          registri una corsa.
        </p>
      ) : (
        <div className="chart-wrap" role="img" aria-label={`Incassi degli ultimi ${days} giorni`}>
          <ResponsiveContainer width="100%" height={216}>
            <LineChart data={points} margin={{ top: 8, right: 10, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="revenueLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--blue)" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={54}
                tick={{ fill: 'var(--muted)', fontSize: 11 }}
                tickFormatter={shortMoney}
              />
              <Tooltip
                cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, label, payload }: ChartTooltipProps) => {
                  const point = payload?.[0]?.payload
                  if (!active || !point) return null
                  return (
                    <div className="chart-tooltip">
                      <span>{point.fullLabel ?? label}</span>
                      <strong>{formatMoney(point.revenue)}</strong>
                      <small>{point.rides === 1 ? '1 servizio' : `${point.rides} servizi`}</small>
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Incassi"
                stroke="url(#revenueLine)"
                strokeWidth={2.6}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: 'var(--accent)',
                  stroke: 'var(--surface)',
                  strokeWidth: 2,
                }}
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.section>
  )
}
