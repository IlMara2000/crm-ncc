import { TrendingUp } from 'lucide-react'

const bars = [38, 62, 45, 78, 54, 88, 66, 92, 74, 100, 58, 84, 70, 96]

export function ChartPanelSkeleton({ days = 14 }: { days?: number }) {
  return (
    <section
      className="panel chart-panel chart-skeleton-panel"
      role="status"
      aria-label="Caricamento grafico incassi"
    >
      <div className="panel-header">
        <div>
          <TrendingUp size={18} />
          <h2>Andamento incassi</h2>
        </div>
        <span className="chart-range">Ultimi {days} giorni</span>
      </div>

      <div className="chart-figures">
        {[0, 1, 2].map((index) => (
          <div key={index}>
            <span className="skeleton-line is-short" />
            <span className="skeleton-line is-strong" />
          </div>
        ))}
      </div>

      <div className="chart-skeleton" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={index} className="chart-skeleton-bar" style={{ height: `${height}%` }} />
        ))}
      </div>
    </section>
  )
}
