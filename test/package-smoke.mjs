import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer as createServerEsm, NotFoundError } from 'fogo';

const require = createRequire(import.meta.url);
const cjs = require('fogo');

assert.equal(typeof createServerEsm, 'function', 'ESM build must export createServer');
assert.equal(typeof cjs.createServer, 'function', 'CommonJS build must export createServer');
assert.equal(
  new cjs.NotFoundError().name,
  'NotFoundError',
  'CommonJS build must export NotFoundError',
);
assert.equal(new NotFoundError().name, 'NotFoundError', 'ESM build must export NotFoundError');

const server = createServerEsm({
  '/hello/:name': (_req, res, url, params) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ name: params.name, query: url.query }));
  },
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const address = server.address();
assert.ok(address && typeof address === 'object', 'server must have a TCP address');

try {
  const response = await fetch(`http://127.0.0.1:${address.port}/hello/fogo?lang=pt`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { name: 'fogo', query: { lang: 'pt' } });
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

console.log('ESM and CommonJS package builds are working.');
