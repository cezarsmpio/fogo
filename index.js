const http = require('http');
const url = require('url');
const pathMatch = require('path-match')();

function defaultNotFound(req, res) {
  res.writeHead(404);
  res.end(http.STATUS_CODES[404]);
}

function createServer(handlers = {}, notFound = defaultNotFound) {
  const server = http.createServer();

  server.on('request', async function(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const method = req.method.toLowerCase();
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
      return await notFound(req, res, parsedUrl, err);
    }
  });

  return server;
}

module.exports = { createServer };
