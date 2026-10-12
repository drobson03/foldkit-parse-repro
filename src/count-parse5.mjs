// Preload (`node --import ./src/count-parse5.mjs`): redirects foldkit's `parse5`
// import to a wrapper that counts and times every parse/parseFragment call,
// attributing each to the foldkit function that made it.
import { registerHooks } from 'node:module'

const WRAPPER = new URL('./parse5-wrapper.mjs', import.meta.url).href

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'parse5' && context.parentURL?.includes('/foldkit/dist/')) {
      return { url: WRAPPER, shortCircuit: true }
    }
    return next(specifier, context)
  },
})
