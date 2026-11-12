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
- Node.js 18+ at runtime; CI covers Node 18, 20, 22, 24, and 26 (Node 26 is the default)

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

Routes are matched in insertion order and are case-sensitive. URI-encoded path segments and
parameters are decoded. An encoded slash (`%2F`) stays inside its segment instead of becoming a path
separator. Unsupported parameter syntax, such as `:id(\\d+)` or `:path*`, throws a `TypeError` when
the server is created. An unnamed wildcard (`*`) exposes its value as parameter `0`.

Incoming request targets are validated before routing. Dot segments, backslashes, repeated slashes,
encoded traversal, malformed percent escapes, and non-origin-form targets receive `400 Bad Request`
instead of being normalized into a different route.

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
| Static route among 100 routes | 98,397 ops/s | 642,596 ops/s |
| Dynamic route among 100 routes | 83,239 ops/s | 203,256 ops/s |
| Optional parameter | 114,852 ops/s | 444,757 ops/s |
| Optional parameter omitted | 161,154 ops/s | 873,090 ops/s |
| Wildcard route | 119,841 ops/s | 354,918 ops/s |
| No matching route | 169,191 ops/s | 692,135 ops/s |
| Static request dispatch | 90,213 ops/s | 148,940 ops/s |
| Dynamic request dispatch with query | 52,045 ops/s | 107,139 ops/s |

Benchmarks are host-dependent. The committed suite in `benchmark/` is the source of truth.

## Bundle size

The published package contains minified ESM and CommonJS builds plus declarations, with no source
maps. The gzipped JavaScript entry points are about 2 KB each.

## Migrating from 1.x

Version 2 is a modernized major release:

- Requires Node.js 18 or newer.
- Ships ESM and CommonJS builds with an `exports` map.
- Uses the WHATWG `URL` API instead of the deprecated `url.parse`.
  `url.pathname`, `url.search`, and `url.query` still work; `url.query` keeps the old
  `node:querystring` shape and is now a cached, read-only getter.
- `url.path` is no longer available. `url.href` and `url.host` now describe the absolute URL built
  from the fixed `http://localhost` base rather than the raw request target.
- Removed the `path-match` dependency; routing is built in.
- Routes are case-sensitive. Regex parameters and `:name*` patterns are not supported and throw
  instead of silently becoming static text.
- An unnamed wildcard (`*`) keeps the legacy parameter key `0`.
- Incoming targets with dot segments, backslashes, repeated slashes, encoded traversal, or malformed
  escapes return `400 Bad Request` instead of being normalized into a different route.
- Duplicate routes after trailing-slash normalization throw when the server is created.
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

Releases are automated with [semantic-release](https://semantic-release.gitbook.io/). Commits and
pull request titles must follow the [Conventional Commits](https://www.conventionalcommits.org/)
format. The commit analyzer uses the `conventionalcommits` preset, so both `feat!:` and a
`BREAKING CHANGE:` footer are recognized:

- `fix: ...` publishes a patch
- `feat: ...` publishes a minor
- `feat!: ...` or a `BREAKING CHANGE:` footer publishes a major

The repository merge settings use the pull request title as the merge subject. This keeps automated
releases working when a PR is merged or squashed from the GitHub UI.

Pull requests run the reusable Test workflow through CI. Pushing to `main` (or `master`) runs the
same Test workflow inside the Release workflow; only after the Node 18-26 matrix and package checks
pass does semantic-release publish to npm with provenance, write `CHANGELOG.md`, and create a GitHub
release. The publish job installs dependencies without lifecycle scripts.

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
