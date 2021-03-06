import { IncomingMessage, ServerResponse } from 'http';
import { UrlWithParsedQuery } from 'url';
import { Handler, ErrorListener } from './types';

const http = require('http');
const url = require('url');
const pathMatch = require('path-match')();

function defaultNotFoundHandler(
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: UrlWithParsedQuery,
  err: Error
): any {
  res.writeHead(404);
  res.end(http.STATUS_CODES[404]);
}

function defaultErrorHandler(
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: UrlWithParsedQuery,
  err: Error
): any {
  console.log(err);

  res.writeHead(500);
  res.end(http.STATUS_CODES[500]);
}

function createServer(
  handlers: Handler = {},
  notFoundListener: ErrorListener = defaultNotFoundHandler,
  errorHandler: ErrorListener = defaultErrorHandler
) {
  const server = http.createServer();

  server.on('request', async function(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    const parsedUrl = url.parse(req.url || '', true);
    const method = (req.method || 'GET').toLowerCase();
    const route = Object.keys(handlers).find(path => {
      return pathMatch(path)(parsedUrl.pathname);
    });

    try {
      if (!route) {
        throw new Error(http.STATUS_CODES[404]);
      }

      const handle = handlers[route];
      const params = pathMatch(route)(parsedUrl.pathname);

      // handles all http methods
      if (typeof handle === 'function') {
        return await handle(req, res, parsedUrl, params);
      }

      // handles specific http method
      if (handle[method]) {
        return await handle[method](req, res, parsedUrl, params);
      }

      throw new Error(http.STATUS_CODES[404]);
    } catch (err) {
      if (err.message === http.STATUS_CODES[404]) {
        return await notFoundListener(req, res, parsedUrl, err);
      }

      return await errorHandler(req, res, parsedUrl, err);
    }
  });

  return server;
}

export { createServer };
