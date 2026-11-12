import { type IncomingMessage, Server, type ServerResponse, STATUS_CODES } from 'node:http';
import { connect } from 'node:net';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Handler, NotFoundError } from '../src/index';

const servers: Server[] = [];

function app(
  handlers: Handler = {},
  notFoundListener?: Parameters<typeof createServer>[1],
  errorHandler?: Parameters<typeof createServer>[2],
) {
  const server = createServer(handlers, notFoundListener, errorHandler);
  servers.push(server);
  return { server, request: request(server) };
}

const handlers: Handler = {
  '/': (_req, res) => {
    res.writeHead(200);
    res.end();
  },
  '/methods': {
    get: (_req, res) => {
      res.writeHead(200);
      res.end('get');
    },
    post: (_req, res) => {
      res.writeHead(200);
      res.end('post');
    },
    patch: (_req, res) => {
      res.writeHead(200);
      res.end('patch');
    },
    put: (_req, res) => {
      res.writeHead(200);
      res.end('put');
    },
    delete: (_req, res) => {
      res.writeHead(200);
      res.end('delete');
    },
  },
  '/params/:id/:name?': (_req, res, _url, params) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(params));
  },
  '/headers': (_req, res) => {
    res.setHeader('x-id', '123');
    res.end();
  },
  '/url': (_req, res, url) => {
    const query = url.query;
    const secondQuery = url.query;

    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(
      JSON.stringify({
        pathname: url.pathname,
        search: url.search,
        query,
        sameQueryInstance: query === secondQuery,
        isUrl: url instanceof URL,
      }),
    );
  },
  '/files/*path': (_req, res, _url, params) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(params));
  },
  '/error': () => {
    throw new Error('mocked error');
  },
  '/async-error': async () => {
    throw new Error('async mocked error');
  },
  '/after-headers': (_req, res) => {
    res.writeHead(200);
    res.end('partial');
    throw new Error('too late');
  },
  '/after-headers-open': (_req, res) => {
    res.writeHead(202);
    throw new Error('headers already sent');
  },
  '/throw-string': () => {
    throw 'plain failure';
  },
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  consoleError.mockRestore();

  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close(() => resolve());
        }),
    ),
  );
});

describe('createServer', () => {
  it('returns an instance of http.Server', () => {
    const { server } = app();
    expect(server).toBeInstanceOf(Server);
    expect(typeof server.listen).toBe('function');
  });

  it('still emits the standard request and close events', async () => {
    const { server, request: client } = app(handlers);

    await client.get('/');

    await new Promise<void>((resolve, reject) => {
      server.once('close', () => resolve());
      server.close((error) => {
        if (error) reject(error);
      });
    });
  });

  it('defaults a missing URL and method to GET /', async () => {
    const { server } = app({
      '/': (_req, res) => {
        res.writeHead(200);
        res.end('root');
      },
    });
    const listener = server.listeners('request')[0] as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => Promise<void>;
    const response = {
      headersSent: false,
      writableEnded: false,
      setHeader: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    await listener({ headers: {} } as IncomingMessage, response);

    expect(response.writeHead).toHaveBeenCalledWith(200);
    expect(response.end).toHaveBeenCalledWith('root');
  });

  it('creates NotFoundError with the default status and message', () => {
    const error = new NotFoundError();

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe(STATUS_CODES[404]);
    expect(error.name).toBe('NotFoundError');
  });

  it('invokes the listen callback', async () => {
    const { server } = app();

    await new Promise<void>((resolve, reject) => {
      server.listen(0, () => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    });
  });

  it('keeps serving requests after a handler throws', async () => {
    const { request: client } = app(handlers);

    await client.get('/error');
    const result = await client.get('/');

    expect(result.status).toBe(200);
  });
});

describe('routes', () => {
  it('handles every HTTP method for a function handler', async () => {
    const { request: client } = app(handlers);

    const responses = await Promise.all([
      client.get('/'),
      client.post('/'),
      client.patch('/'),
      client.delete('/'),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
  });

  it('dispatches method-specific handlers', async () => {
    const { request: client } = app(handlers);

    const responses = await Promise.all([
      client.get('/methods'),
      client.post('/methods'),
      client.patch('/methods'),
      client.put('/methods'),
      client.delete('/methods'),
    ]);

    expect(responses.map((response) => response.text)).toEqual([
      'get',
      'post',
      'patch',
      'put',
      'delete',
    ]);
  });

  it('falls back to the GET handler for HEAD requests', async () => {
    const { request: client } = app(handlers);
    const result = await client.head('/methods');

    expect(result.status).toBe(200);
    expect(result.text ?? '').toBe('');
  });

  it('returns 404 when the method is not handled on an existing route', async () => {
    const { request: client } = app(handlers);
    const result = await client.options('/methods');

    expect(result.status).toBe(404);
    expect(result.text).toBe(STATUS_CODES[404]);
  });

  it('returns 404 for unknown routes using the default listener', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/not-found-route');

    expect(result.status).toBe(404);
    expect(result.text).toBe(STATUS_CODES[404]);
    expect(result.headers['content-type']).toBe('text/plain; charset=utf-8');
  });

  it('uses a custom not found listener', async () => {
    const { request: client } = app(handlers, (_req, res) => {
      res.writeHead(404);
      res.end('custom not found');
    });

    const result = await client.get('/not-found-route');

    expect(result.status).toBe(404);
    expect(result.text).toBe('custom not found');
  });

  it('passes the NotFoundError to the not found listener', async () => {
    const { request: client } = app(handlers, (_req, res, _url, error) => {
      res.writeHead(404);
      res.end(`${error.name}:${(error as NotFoundError).statusCode}`);
    });

    const result = await client.get('/not-found-route');

    expect(result.text).toBe('NotFoundError:404');
  });
});

describe('dynamic routes', () => {
  it('returns all params', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/params/123/bar');

    expect(result.body).toEqual({ id: '123', name: 'bar' });
  });

  it('accepts requests without optional parameters', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/params/123');

    expect(result.body).toEqual({ id: '123' });
  });

  it('accepts a trailing slash', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/params/123/');

    expect(result.body).toEqual({ id: '123' });
  });

  it('decodes route parameters', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/params/hello%20world/cezar%20sampaio');

    expect(result.body).toEqual({
      id: 'hello world',
      name: 'cezar sampaio',
    });
  });

  it('matches wildcard routes', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/files/docs/2026/report.pdf');

    expect(result.body).toEqual({ path: 'docs/2026/report.pdf' });
  });
});

describe('request URL', () => {
  it('passes a WHATWG URL with the pathname and search string', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/url?id=123&name=fogo');

    expect(result.body).toMatchObject({
      pathname: '/url',
      search: '?id=123&name=fogo',
      isUrl: true,
    });
  });

  it('parses query string values', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/url?id=123&name=fogo');

    expect(result.body.query).toEqual({ id: '123', name: 'fogo' });
  });

  it('caches the parsed query object', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/url?id=123');

    expect(result.body.sameQueryInstance).toBe(true);
  });

  it('collects repeated query parameters into arrays', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/url?tag=node&tag=typescript&tag=web&empty=');

    expect(result.body.query).toEqual({
      tag: ['node', 'typescript', 'web'],
      empty: '',
    });
  });

  it('falls back to the root URL when the request target cannot be parsed', async () => {
    const { server } = app({
      '/': (_req, res) => {
        res.writeHead(200);
        res.end('root');
      },
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Expected the test server to have a TCP address');
    }

    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(address.port, '127.0.0.1', () => {
        socket.write(
          'GET http://[invalid/ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n',
        );
      });

      let data = '';

      socket.setTimeout(2_000, () => {
        socket.destroy();
        reject(new Error('Raw request timed out'));
      });
      socket.on('data', (chunk) => {
        data += chunk;
      });
      socket.on('end', () => resolve(data));
      socket.on('error', reject);
    });

    expect(response).toContain('200 OK');
    expect(response).toContain('root');
  });
});

describe('headers', () => {
  it('passes custom response headers through', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/headers');

    expect(result.headers['x-id']).toBe('123');
  });
});

describe('error handling', () => {
  it('returns 500 with the default handler when a handler throws', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/error');

    expect(result.status).toBe(500);
    expect(result.text).toBe(STATUS_CODES[500]);
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('returns 500 when an async handler rejects', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/async-error');

    expect(result.status).toBe(500);
    expect(result.text).toBe(STATUS_CODES[500]);
  });

  it('uses a custom error handler', async () => {
    const { request: client } = app(handlers, undefined, (_req, res, _url, error) => {
      res.writeHead(501);
      res.end(`custom error + ${error.message}`);
    });

    const result = await client.get('/error');

    expect(result.status).toBe(501);
    expect(result.text).toBe('custom error + mocked error');
  });

  it('does not write a second response when headers were already sent', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/after-headers');

    expect(result.status).toBe(200);
    expect(result.text).toBe('partial');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('ends an open response when headers were already sent', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/after-headers-open');

    expect(result.status).toBe(202);
    expect(result.text).toBe('');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('wraps non-Error throws in an Error', async () => {
    const { request: client } = app(handlers);
    const result = await client.get('/throw-string');

    expect(result.status).toBe(500);
    expect(result.text).toBe(STATUS_CODES[500]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'plain failure' }),
    );
  });

  it('does not crash when the error handler throws', async () => {
    const { request: client } = app(handlers, undefined, () => {
      throw new Error('error handler failed');
    });

    const result = await client.get('/error');

    expect(result.status).toBe(500);
    expect(result.text).toBe(STATUS_CODES[500]);
  });

  it('does not crash when the not found handler throws', async () => {
    const { request: client } = app(handlers, () => {
      throw new Error('not found handler failed');
    });

    const result = await client.get('/not-found-route');

    expect(result.status).toBe(500);
    expect(result.text).toBe(STATUS_CODES[500]);
  });
});
