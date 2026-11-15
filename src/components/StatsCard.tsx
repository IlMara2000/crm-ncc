import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { useEffect } from 'react'

export type StatsTone = 'teal' | 'amber' | 'blue' | 'violet'

type StatsCardProps = {
  detail: string
  icon: LucideIcon
  label: string
  value: string
  /** Numero da animare in ingresso; senza questo valore viene mostrata `value`. */
  countTo?: number
  formatValue?: (value: number) => string
  index?: number
  tone?: StatsTone
  /** Variazione percentuale rispetto al periodo precedente. */
  trend?: number
}

const defaultFormat = (current: number) => `${Math.round(current)}`

export function StatsCard({
  countTo,
  detail,
  formatValue,
  icon: Icon,
  index = 0,
  label,
  tone = 'teal',
  trend,
  value,
}: StatsCardProps) {
  const animated = useMotionValue(0)
  const display = useTransform(animated, (current) => (formatValue ?? defaultFormat)(current))
  const trendUp = (trend ?? 0) >= 0

  useEffect(() => {
    if (countTo == null) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animated.set(countTo)
      return
    }

    animated.set(0)
    const controls = animate(animated, countTo, {
      duration: 0.85,
      ease: [0.16, 1, 0.3, 1],
    })

    return () => controls.stop()
  }, [animated, countTo])

  return (
    <motion.section
      className="stat-card"
      data-tone={tone}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -5 }}
    >
      <div className="stat-card-top">
        <span className="stat-icon">
          <Icon size={18} />
        </span>
        {trend != null && trend !== 0 ? (
          <span className={trendUp ? 'stat-trend is-up' : 'stat-trend is-down'}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {`${trendUp ? '+' : ''}${trend}%`}
          </span>
        ) : null}
      </div>
      <p className="stat-label">{label}</p>
      {countTo == null ? (
        <strong className="stat-value">{value}</strong>
      ) : (
        <motion.strong className="stat-value">{display}</motion.strong>
      )}
      <small className="stat-detail">{detail}</small>
    </motion.section>
  )
}
