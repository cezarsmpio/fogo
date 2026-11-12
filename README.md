# fogo 🔥

> Yet another node.js framework, but simpler.

[![CI](https://github.com/cezarsmpio/fogo/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/cezarsmpio/fogo/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/fogo.svg)](https://www.npmjs.com/package/fogo)
[![npm version](https://img.shields.io/npm/v/fogo.svg)](https://www.npmjs.com/package/fogo)
[![node](https://img.shields.io/node/v/fogo.svg)](https://nodejs.org)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

`fogo` means _fire_ in Portuguese. It is a tiny, dependency-free router and server wrapper around the
[Node.js `http` module](https://nodejs.org/api/http.html).

Use it when you want the raw `http` module without writing route matching yourself. It is a good fit
for microservices and JSON/REST APIs. It is not a full application framework: there are no
middlewares, template engines, or hidden abstractions.

- Zero runtime dependencies
- TypeScript-first, with bundled type declarations
- Async/await friendly handlers
- Static, dynamic (`:param`), optional (`:param?`), and wildcard (`*rest`) routes
- Fast static-route lookup and static-prefix grouping for dynamic routes
- 100% test coverage, including 100% branch coverage
- Minified ESM and CommonJS builds from [tsdown](https://tsdown.dev)
- Works with both ESM `import` and CommonJS `require`
- Node.js 18+, tested on Node 18, 20, 22, 24, and 26 (Node 26 is the default)

## Install

```sh
npm install fogo
```

## Quick start

ESM:

```js
import { createServer } from 'fogo';

const handlers = {
  '/': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Hello world!');
  },
  '/products/:id': {
    get: async (req, res, url, params) => {
      const product = await getProductFromDB(params.id);

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(product));
    },
  },
  '/files/*path': (req, res, url, params) => {
    res.end(`Serving ${params.path}`);
  },
};

const notFoundHandler = (req, res) => {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found, sorry!');
};

const server = createServer(handlers, notFoundHandler);

server.listen(3000, () => {
  console.log('Running at http://localhost:3000');
});
```

CommonJS:

```js
const { createServer } = require('fogo');
```

`createServer` returns a real [`http.Server`](https://nodejs.org/api/http.html#class-httpserver),
so all of its events and methods are available.

## API

### `createServer(handlers?, notFoundListener?, errorHandler?)`

Creates and returns an `http.Server`.

#### `handlers`

An object mapping route patterns to handlers. A handler can be:

- a function, which receives every HTTP method; or
- an object keyed by lowercase HTTP method (`get`, `post`, `put`, `patch`, `delete`, `head`, ...).

```js
const handlers = {
  '/': (req, res) => res.end(),
  '/welcome': {
    get: (req, res) => res.end('GET'),
    post: (req, res) => res.end('POST'),
  },
};
```

Every handler receives:

| Argument | Type | Description |
| --- | --- | --- |
| `req` | [`http.IncomingMessage`](https://nodejs.org/api/http.html#class-httpincomingmessage) | The request. |
| `res` | [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse) | The response. |
| `url` | `URL & { query: Query }` | WHATWG URL with parsed query values. |
| `params` | `Record<string, string>` | Route parameters. |

`url.query` mirrors `node:querystring` behavior: a repeated key becomes an array, and a key without
a value becomes an empty string.

```js
'/search': (req, res, url) => {
  // GET /search?tag=node&tag=web&empty=
  url.pathname; // '/search'
  url.search; // '?tag=node&tag=web&empty='
  url.query; // { tag: ['node', 'web'], empty: '' }
  url.searchParams.get('tag'); // 'node'
  res.end();
};
```

Handlers may be `async`; returned promises are awaited. If a handler throws or rejects, the error
handler is called.

#### `notFoundListener`

Called when no route matches the path, or when a route exists but does not handle the request method.
The default returns `404` with the plain-text body `Not Found`.

```js
function notFoundListener(req, res, url, error) {
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: error.message }));
}
```

The `error` argument is a `NotFoundError` with `statusCode = 404`.

#### `errorHandler`

Called when a handler throws or rejects. The default logs the error with `console.error` and returns
`500` with the plain-text body `Internal Server Error`. If the response headers have already been
sent, the default handler simply ends the response.

```js
function errorHandler(req, res, url, error) {
  req.log?.error(error);

  if (res.headersSent) {
    res.end();
    return;
  }

  res.writeHead(500, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Internal Server Error' }));
}
```

### Route patterns

| Pattern | Matches | Params |
| --- | --- | --- |
| `/` | `/` | `{}` |
| `/health` | `/health`, `/health/` | `{}` |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/users/:id/:name?` | `/users/42`, `/users/42/cezar` | `{ id: '42', name?: 'cezar' }` |
| `/files/*path` | `/files/a/b.txt` | `{ path: 'a/b.txt' }` |

Routes are matched in insertion order. URI-encoded path segments and parameters are decoded.

## Performance

The router uses a direct lookup for exact static paths and groups dynamic routes by static prefix.
Query strings are parsed lazily and cached on first access.

Run the benchmark suite with:

```sh
npm run bench
```

Representative Node.js 26 results (higher is better):

| Benchmark | Before optimization | Current |
| --- | ---: | ---: |
| Static route among 100 routes | 98,397 ops/s | 851,103 ops/s |
| Dynamic route among 100 routes | 83,239 ops/s | 319,848 ops/s |
| Optional parameter | 114,852 ops/s | 399,922 ops/s |
| Optional parameter omitted | 161,154 ops/s | 743,033 ops/s |
| Wildcard route | 119,841 ops/s | 187,452 ops/s |
| No matching route | 169,191 ops/s | 449,939 ops/s |
| Static request dispatch | 90,213 ops/s | 117,176 ops/s |
| Dynamic request dispatch with query | 52,045 ops/s | 57,118 ops/s |

Benchmarks are host-dependent. The committed suite in `benchmark/` is the source of truth.

## Bundle size

The published package contains minified ESM and CommonJS builds plus declarations, with no source
maps. The gzipped JavaScript entry points are under 2 KB each.

## Migrating from 1.x

Version 2 is a modernized major release:

- Requires Node.js 18 or newer.
- Ships ESM and CommonJS builds with an `exports` map.
- Uses the WHATWG `URL` API instead of the deprecated `url.parse`.
  `url.pathname`, `url.search`, and `url.query` still work; `url.query` keeps the old
  `node:querystring` shape.
- Removed the `path-match` dependency; routing is built in.
- `HEAD` requests fall back to the `GET` handler when no `head` handler exists.
- Handlers always receive a params object, even for static routes.
- Not-found detection uses a typed `NotFoundError` instead of matching an error message string.

## Development

Node.js 26 is the default development version (see `.nvmrc`). The test suite also runs on Node 18,
20, 22, 24, and 26 in CI.

```sh
npm install
npm run check         # lint and format check (Biome)
npm run typecheck     # TypeScript, no emit
npm test              # Vitest
npm run test:coverage # Vitest with 100% coverage thresholds
npm run build         # minified ESM + CJS + declarations (tsdown)
npm run test:package  # smoke-test the built ESM and CommonJS entry points
npm run check:package # validate package exports/types (publint + attw)
npm run bench         # run the router and request dispatch benchmarks
```

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/). Commits must
follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `fix: ...` publishes a patch
- `feat: ...` publishes a minor
- `feat!: ...` or a `BREAKING CHANGE:` footer publishes a major

Pushing to `main` (or `master`) runs the Release workflow, which tests, builds, publishes to npm
with provenance, writes `CHANGELOG.md`, and creates a GitHub release.

Publishing uses npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) with OIDC, so no
long-lived `NPM_TOKEN` is stored. The workflow requests `id-token: write`, and the trusted publisher
entry for this repository must exist on npmjs.com:

```sh
# Run locally once while logged in to npm with 2FA enabled.
npm trust github fogo \
  --file release.yml \
  --repo cezarsmpio/fogo \
  --allow-publish
```

`GITHUB_TOKEN` is provided by GitHub Actions. Once the trusted publisher is configured, the Release
workflow publishes the next semantic-release version to npm with provenance.

## License

[MIT](./LICENSE)
