import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Il pannello del grafico è lazy: senza hint il browser scopre il chunk solo
// dopo aver eseguito il bundle. Su reti lente però il download in parallelo
// ruba banda ai chunk critici, quindi il preload parte solo se la connessione
// lo regge. Lo script inline viene emesso a parse-time, così il fetch è
// parallelo all'entry come un modulepreload statico.
function preloadChartChunk(): Plugin {
  return {
    name: 'preload-chart-chunk',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const chunk = Object.values(ctx.bundle ?? {}).find(
          (output) => output.type === 'chunk' && output.name.includes('RevenueChart'),
        )
        if (!chunk || chunk.type !== 'chunk') return html

        const source = `(function () {
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  // Safari e Firefox non espongono la Network Information API: senza dati sulla
  // connessione non anticipiamo il download.
  if (!connection) return
  if (connection.saveData) return
  var type = connection.effectiveType || ''
  if (type === 'slow-2g' || type === '2g' || type === '3g') return
  var link = document.createElement('link')
  link.rel = 'modulepreload'
  link.crossOrigin = ''
  link.href = '/${chunk.fileName}'
  document.head.appendChild(link)
})()`

        return {
          html,
          tags: [{ tag: 'script', children: source, injectTo: 'head-prepend' }],
        }
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadChartChunk()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 40 },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/, priority: 30 },
            {
              name: 'motion',
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 20,
            },
            { name: 'icons', test: /node_modules[\\/]lucide-react[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
