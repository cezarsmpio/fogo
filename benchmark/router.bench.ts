import { describe, test } from 'vitest';
import { Router } from '../src/router';

function createRouter(routeCount: number): Router {
  const router = new Router();

  router.add('/health');

  for (let index = 0; index < routeCount; index += 1) {
    router.add(`/items/${index}/:id`);
  }

  router.add('/files/*path');
  router.add('/search/:term?');
  router.add('/users/:id/:name?');

  return router;
}

const router = createRouter(100);
const staticRouter = (() => {
  const instance = new Router();

  for (let index = 0; index < 100; index += 1) {
    instance.add(`/static/${index}`);
  }

  return instance;
})();

const benchOptions = { time: 1_000, warmupTime: 250 };

describe('router lookup', () => {
  test('route matching', async ({ bench }) => {
    await bench.compare(
      bench('static route among 100 routes', () => {
        staticRouter.find('/static/99');
      }),
      bench('dynamic route among 100 routes', () => {
        router.find('/items/99/abc');
      }),
      bench('optional parameter', () => {
        router.find('/search/fogo');
      }),
      bench('optional parameter omitted', () => {
        router.find('/search');
      }),
      bench('wildcard route', () => {
        router.find('/files/docs/2026/report.pdf');
      }),
      bench('no match', () => {
        router.find('/missing/path');
      }),
      benchOptions,
    );
  });
});
