const fogo = require('./index');

const handlers = {
  '/': {
    post: (req, res) => {
      res.end('OK!');
    }
  },
  '/params/:test': async (req, res, url, params) => {
    res.end(JSON.stringify({ url, params }));
  },
  '/welcome': (req, res) => {
    res.setHeader('content-type', 'text/html');

    res.end('<h1>Hello, World!</h1>');
  }
};

const server = fogo.createServer(handlers, (req, res) => {
  res.writeHead(404);
  res.end('It is hard to tell, but we can not find your page :/');
});

server.listen(3000, () => {
  console.log('Listening on localhost:3000');
});
