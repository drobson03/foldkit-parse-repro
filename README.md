# foldkit SSR: rendered HTML parsed ~23× per request

Minimal reproduction for: *Server rendering parses the rendered HTML ~23 times per
request (~85ms CPU for a 50KB page)*. Uses foldkit 0.167.0 on Node 24.

No Vite or dev server is involved. `src/repro.mjs` calls
`Server.renderToString` and then `Server.renderDocument` directly for a routing
app whose view renders ~50KB of Tailwind-style markup with inline SVGs, which is
the same path `@foldkit/vite-plugin`'s SSR uses for each request.

```sh
npm install
npm run repro                 # count and time every parse5 call, by foldkit caller
ROWS=180 npm run repro        # ~105KB page: cost scales linearly
npm run profile               # plain `node --cpu-prof`, no instrumentation -> prof/*.cpuprofile
```

`src/count-parse5.mjs` is a `node --import` hook that swaps foldkit's `parse5`
import for `src/parse5-wrapper.mjs`. That wrapper counts and times each `parse` and
`parseFragment` call and records which foldkit check made it. foldkit itself is
not modified.

## Output (Node 24.21.0, foldkit 0.167.0)

```
foldkit 0.167.0, node v24.21.0
rendered.html: 52.4 KB, 40 requests

per request:
  app view        0.9 ms
  renderToString  43.2 ms
  renderDocument  48.5 ms
  parse5 in renderToString  11.0 calls, 36.9 ms
  parse5 in renderDocument  15.0 calls, 42.2 ms
  parse5 calls    26.0  (79.1 ms inside parse5)

parse5 calls per request, by caller:
    2x     7.2 ms    53801 B  renderDocument  parse          __assertNoDocumentStructureEscape -> escapesDocumentStructure (server.js:461)
    2x     6.5 ms    53758 B  renderDocument  parse          assertInjectionIsFaithful -> renderedShapes (template.js:190)
    2x     0.4 ms      325 B  renderDocument  parse          assertInjectionIsFaithful (template.js:240)
    2x     6.6 ms    53997 B  renderDocument  parse          assertInjectionIsFaithful (template.js:262)
    1x     0.3 ms      325 B  renderDocument  parse          injectIntoTemplate (template.js:484)
    2x     6.6 ms    53688 B  renderDocument  parseFragment  __assertNoDeclarativeShadowRoot (server.js:401)
    2x     6.5 ms    53688 B  renderDocument  parseFragment  __assertNoLiveBaseElement (server.js:436)
    2x     8.2 ms    53688 B  renderDocument  parseFragment  runtimeIdOf -> runtimeIdInMode (template.js:366)
    2x     6.6 ms    53801 B  renderToString  parse          __assertNoDocumentStructureEscape -> escapesDocumentStructure (server.js:461)
    2x     6.3 ms    53688 B  renderToString  parseFragment  __assertNoDeclarativeShadowRoot (server.js:401)
    2x     7.0 ms    53688 B  renderToString  parseFragment  __assertNoLiveBaseElement (server.js:436)
    1x     3.2 ms    53688 B  renderToString  parseFragment  assertNoscriptModesAgree (server.js:356)
    1x     3.2 ms    53688 B  renderToString  parseFragment  assertNoscriptModesAgree (server.js:359)
    2x     7.3 ms    53720 B  renderToString  parseFragment  assertRootClosesCleanly -> closesCleanly (server.js:233)
    1x     3.3 ms    53688 B  renderToString  parseFragment  assertSingleStampedRoot -> parsedRootOf (server.js:647)
```

Every large line is a full parse of the ~52KB `rendered.html`, or of the page
that contains it. In the `renderDocument` group, `__assertNoDeclarativeShadowRoot`,
`__assertNoDocumentStructureEscape` and `__assertNoLiveBaseElement` repeat
checks that `renderToString` already ran on the identical string.
