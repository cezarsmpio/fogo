import { createServer } from './dist/index.js';

const handlers = {
  '/': {
    get: (_req, res) => {
      res.end('OK!');
    },
  },
  '/params/:test': async (_req, res, url, params) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ pathname: url.pathname, query: url.query, params }));
  },
  '/welcome': (_req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<h1>Hello, World!</h1>');
  },
};

const server = createServer(handlers, (_req, res) => {
  res.writeHead(404);
  res.end('It is hard to tell, but we can not find your page :/');
});

const port = Number(process.env.NODE_PORT ?? 3000);

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
