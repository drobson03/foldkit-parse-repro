import * as real from 'parse5'
import { performance } from 'node:perf_hooks'

export * from 'parse5'

export const stats = (globalThis.__parse5Stats ??= { calls: [], enabled: false })

// Name the foldkit check that asked for the parse: the nearest named foldkit
// frame, plus the nearest `assert*` frame above it when that's different.
const callerOf = () => {
  const frames = new Error().stack
    .split('\n')
    .slice(3)
    .map(l => l.match(/at (?:([\w$.]+) )?\(?.*\/foldkit\/dist\/experimental\/server\/(\w+)\.js:(\d+)/))
    .filter(m => m && m[1] && m[1] !== 'Array.some')
    .map(m => ({ name: m[1].replace(/^Object\./, ''), loc: `${m[2]}.js:${m[3]}` }))
  const [first] = frames
  const check = frames.find(f => /assert|runtimeIdOf/.test(f.name))
  const label = `${first.name} (${first.loc})`
  return check && check !== first ? `${check.name} -> ${label}` : label
}

const wrap = (name, fn) => (...args) => {
  if (!stats.enabled) return fn(...args)
  const input = name === 'parse' ? args[0] : args[args.length === 1 || typeof args[0] === 'string' ? 0 : 1]
  const t0 = performance.now()
  const out = fn(...args)
  stats.calls.push({ phase: stats.phase, fn: name, caller: callerOf(), bytes: input.length, ms: performance.now() - t0 })
  return out
}

export const parse = wrap('parse', real.parse)
export const parseFragment = wrap('parseFragment', real.parseFragment)
