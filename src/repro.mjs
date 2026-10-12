import { readFileSync } from 'node:fs'
import { Effect } from 'effect'
import { renderToString, renderDocument } from 'foldkit/experimental/server'
import { performance } from 'node:perf_hooks'

// A Tailwind-ish page: lots of long class strings plus inline SVG icons.
const cls =
  'flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
const icon = h =>
  h.svg([h.ViewBox('0 0 24 24'), h.Class('size-5 shrink-0 text-slate-400')], [
    h.path([h.D('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z')]),
  ])

const ROWS = Number(process.env.ROWS ?? 90)

const config = {
  routing: {},
  init: url => ({ model: { path: url.pathname } }),
  view: (model, h) => ({
    title: 'Repro',
    body: h.div([h.Class('min-h-screen bg-slate-100')], [
      h.main([h.Class('mx-auto max-w-5xl space-y-3 p-8')],
        Array.from({ length: ROWS }, (_, i) =>
          h.div([h.Class(cls)], [
            icon(h),
            h.span([h.Class('truncate font-semibold tracking-tight')], [`Item ${i} on ${model.path}`]),
            h.span([h.Class('ml-auto inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700')], ['ok']),
          ]),
        ),
      ),
    ]),
  }),
}

// Time the app's own view (vnode construction) for comparison.
let tView = 0
const view = config.view
config.view = (model, h) => {
  const t = performance.now()
  try { return view(model, h) } finally { if (stats.enabled) tView += performance.now() - t }
}

const assets = { entryScript: '/assets/entry.js', stylesheets: ['/assets/app.css'], modulePreloads: [] }
const stats = globalThis.__parse5Stats ?? { calls: [] }

const renderOnce = () => Effect.runSync(renderToString(config, { url: 'http://localhost/items', buildId: 'repro' }))

// Warm up
for (let i = 0; i < 10; i++) renderDocument(renderOnce(), assets)

const N = Number(process.env.N ?? 40)
let tRender = 0, tDocument = 0, htmlBytes = 0
stats.calls.length = 0
stats.enabled = true
for (let i = 0; i < N; i++) {
  const a = performance.now()
  stats.phase = 'renderToString'
  const rendered = renderOnce()
  stats.phase = 'renderDocument'
  const b = performance.now()
  renderDocument(rendered, assets)
  const c = performance.now()
  tRender += b - a
  tDocument += c - b
  htmlBytes = rendered.html.length
}
stats.enabled = false

const per = x => (x / N).toFixed(1)
const parseMs = stats.calls.reduce((s, c) => s + c.ms, 0)

console.log(`foldkit ${JSON.parse(readFileSync(new URL('../node_modules/foldkit/package.json', import.meta.url))).version}, node ${process.version}`)
console.log(`rendered.html: ${(htmlBytes / 1024).toFixed(1)} KB, ${N} requests\n`)
console.log(`per request:`)
console.log(`  app view        ${per(tView)} ms`)
console.log(`  renderToString  ${per(tRender)} ms`)
console.log(`  renderDocument  ${per(tDocument)} ms`)
for (const phase of ['renderToString', 'renderDocument']) {
  const cs = stats.calls.filter(c => c.phase === phase)
  console.log(`  parse5 in ${phase.padEnd(15)} ${per(cs.length)} calls, ${per(cs.reduce((s, c) => s + c.ms, 0))} ms`)
}
console.log(`  parse5 calls    ${per(stats.calls.length)}  (${per(parseMs)} ms inside parse5)`)

const groups = new Map()
for (const c of stats.calls) {
  const k = `${c.phase.padEnd(15)} ${c.fn.padEnd(14)} ${c.caller}`
  const g = groups.get(k) ?? { n: 0, ms: 0, bytes: c.bytes }
  g.n++, g.ms += c.ms
  groups.set(k, g)
}
console.log(`\nparse5 calls per request, by caller:`)
for (const [k, g] of [...groups].sort((a, b) => a[0].localeCompare(b[0]) || b[1].ms - a[1].ms))
  console.log(`  ${String(g.n / N).padStart(3)}x  ${per(g.ms).padStart(6)} ms  ${String(g.bytes).padStart(7)} B  ${k}`)
