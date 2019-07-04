const supertest = require('supertest');
const http = require('http');
const fogo = require('./index');

let server;
let request;

const handlers = {
  '/': (req, res) => {
    res.writeHead(200);
    res.end();
  },
  '/methods': {
    get: (req, res) => {
      res.writeHead(200);
      res.end('get');
    },
    post: (req, res) => {
      res.writeHead(200);
      res.end('post');
    },
    patch: (req, res) => {
      res.writeHead(200);
      res.end('patch');
    },
    put: (req, res) => {
      res.writeHead(200);
      res.end('put');
    },
    delete: (req, res) => {
      res.writeHead(200);
      res.end('delete');
    }
  },
  '/params/:id/:name?': (req, res, url, params) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ...params }));
  },
  '/headers': (req, res) => {
    res.setHeader('x-id', '123');
    res.end();
  },
  '/url': (req, res, url) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ ...url }));
  },
  '/error': () => {
    throw new Error('mocked error');
  }
};

beforeAll(() => {
  server = fogo.createServer(handlers);
  request = supertest(server);

  server.listen();
});

afterAll(() => server.close());

describe('createServer', () => {
  it('should be an instance of http.Server', () => {
    expect(fogo.createServer() instanceof http.Server).toBe(true);
  });

  it('should listen to request events', async done => {
    const customServer = fogo.createServer();

    customServer.on('request', () => {
      done();
    });

    customServer.listen();

    await supertest(customServer).get('/');

    customServer.close();
  });

  it('should listen to close connection events', done => {
    const customServer = fogo.createServer();

    customServer.on('close', () => {
      done();
    });

    customServer.listen();

    customServer.close();
  });

  it('should invoke a callback when the server starts', done => {
    const customServer = fogo.createServer();

    customServer.listen(() => {
      customServer.close();

      setTimeout(done, 10);
    });
  });
});

describe('unique route for all http methods', () => {
  it('should receive a get request', async () => {
    const result = await request.get('/');

    expect(result.status).toBe(200);
  });

  it('should receive a post request', async () => {
    const result = await request.post('/');

    expect(result.status).toBe(200);
  });

  it('should receive a patch request', async () => {
    const result = await request.patch('/');

    expect(result.status).toBe(200);
  });

  it('should receive a delete request', async () => {
    const result = await request.delete('/');

    expect(result.status).toBe(200);
  });
});

describe('same route handling different http methods', () => {
  it('should handle a get request', async () => {
    const result = await request.get('/methods');

    expect(result.status).toBe(200);
    expect(result.text).toBe('get');
  });

  it('should handle a post request', async () => {
    const result = await request.post('/methods');

    expect(result.status).toBe(200);
    expect(result.text).toBe('post');
  });

  it('should handle a patch request', async () => {
    const result = await request.patch('/methods');

    expect(result.status).toBe(200);
    expect(result.text).toBe('patch');
  });

  it('should handle a put request', async () => {
    const result = await request.put('/methods');

    expect(result.status).toBe(200);
    expect(result.text).toBe('put');
  });

  it('should handle a delete request', async () => {
    const result = await request.delete('/methods');

    expect(result.status).toBe(200);
    expect(result.text).toBe('delete');
  });
});

describe('not found requests - default handler', () => {
  it('should return status code 404 when a route does not exist', async () => {
    const result = await request.get('/not-found-route');

    expect(result.status).toBe(404);
  });

  it('should return a not found message when a route does not exist', async () => {
    const result = await request.get('/not-found-route');

    expect(result.text).toBe(http.STATUS_CODES[404]);
  });

  it('should return 404 if a http method does not exist in an existent route', async () => {
    const result = await request.options('/methods');

    expect(result.status).toBe(404);
    expect(result.text).toBe(http.STATUS_CODES[404]);
  });
});

describe('not found requests - custom handler', () => {
  let customServer;
  let customRequest;

  beforeAll(() => {
    customServer = fogo.createServer(handlers, (req, res) => {
      res.writeHead(404);
      res.end(http.STATUS_CODES[404]);
    });

    customRequest = supertest(customServer);
  });

  afterAll(() => customServer.close());

  it('should return status code 404 when a route does not exist', async () => {
    const result = await customRequest.get('/not-found-route');

    expect(result.status).toBe(404);
  });

  it('should return a custom message when a route does not exist', async () => {
    const result = await customRequest.get('/not-found-route');

    expect(result.text).toBe(http.STATUS_CODES[404]);
  });

  it('should return a custom error if a http method does not exist in an existent route', async () => {
    const result = await customRequest.options('/methods');

    expect(result.status).toBe(404);
    expect(result.text).toBe(http.STATUS_CODES[404]);
  });
});

describe('dynamic routes', () => {
  it('should return all params', async () => {
    const result = await request.get('/params/123/bar');
    const { id, name } = result.body;

    expect(id).toBe('123');
    expect(name).toBe('bar');
  });

  it('should accept requests without passing optional parameters', async () => {
    const result = await request.get('/params/123');

    expect(result.body.id).toBe('123');
  });

  it('should accept requests with the last bar', async () => {
    const result = await request.get('/params/123/');

    expect(result.body.id).toBe('123');
  });

  it('should not return optional parameters when not passing them', async () => {
    const result = await request.get('/params/123');

    expect(result.body.name).toBe(undefined);
  });
});

describe('url', () => {
  it('should receive the pathname', async () => {
    const result = await request.get('/url?id=123&name=fogo');
    const { pathname } = result.body;

    expect(pathname).toBe('/url');
  });

  it('should receive search parameters', async () => {
    const result = await request.get('/url?id=123&name=fogo');
    const { search } = result.body;

    expect(search).toBe('?id=123&name=fogo');
  });

  it('should receive all query string parameters parsed', async () => {
    const result = await request.get('/url?id=123&name=fogo');
    const { query } = result.body;

    expect(query.id).toBe('123');
    expect(query.name).toBe('fogo');
  });
});

describe('headers', () => {
  it('should receive a custom header', async () => {
    const result = await request.get('/headers');

    expect(result.header['x-id']).toBe('123');
  });
});

describe('error handler - default handler', () => {
  it('should return status code 501 when an error happens', async () => {
    const result = await request.get('/error');

    expect(result.status).toBe(500);
  });

  it('should read the error message', async () => {
    const result = await request.get('/error');

    expect(result.text).toBe(http.STATUS_CODES[500]);
  });
});

describe('error handler - custom handler', () => {
  let customServer;
  let customRequest;

  beforeAll(() => {
    customServer = fogo.createServer(
      handlers,
      (req, res) => {
        res.writeHead(404);
        res.end(http.STATUS_CODES[404]);
      },
      (req, res, url, err) => {
        res.writeHead(501);
        res.end(`custom error + ${err.message}`);
      }
    );

    customRequest = supertest(customServer);
  });

  afterAll(() => customServer.close());

  it('should return status code 501 when an error happens', async () => {
    const result = await customRequest.get('/error');

    expect(result.status).toBe(501);
  });

  it('should read the error message', async () => {
    const result = await customRequest.get('/error');

    expect(result.text).toBe('custom error + mocked error');
  });
});
