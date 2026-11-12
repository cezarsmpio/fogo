import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, test } from 'vitest';
import { createServer } from '../src/index';

type RequestListener = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

function createRequestListener(): RequestListener {
  const server = createServer({
    '/health': (_req, res) => {
      res.end('ok');
    },
    '/users/:id': (_req, res) => {
      res.end('user');
    },
  });

  return server.listeners('request')[0] as RequestListener;
}

const listener = createRequestListener();
const request = {
  url: '/users/42?fields=name',
  method: 'GET',
  headers: {},
} as IncomingMessage;
const response = {
  headersSent: false,
  writableEnded: false,
  setHeader() {},
  writeHead() {},
  end() {},
} as unknown as ServerResponse;

const benchOptions = { time: 1_000, warmupTime: 250 };

describe('request dispatch', () => {
  test('request handling', async ({ bench }) => {
    await bench.compare(
      bench('static route request', async () => {
        request.url = '/health';
        await listener(request, response);
      }),
      bench('dynamic route request with query', async () => {
        request.url = '/users/42?fields=name';
        await listener(request, response);
      }),
      benchOptions,
    );
  });
});
