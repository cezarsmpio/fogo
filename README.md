# fogo

> Yet another node.js framework, but simpler.

### Install

```
npm install fogo --save
```

### Why? Why? Why?

`fogo`, means `fire` in Portuguese 🤷‍♀️. It is basically a wrapper for the [node.js http module](https://nodejs.org/api/http.html#http_class_http_server).

Sometimes `Express`, which is a good framework, is too much for your needs or too heavy because of its tons of dependencies, especially if you do microservices or have a lot of CI/CD going on.

Only use `fogo` if you want to have direct access to the `http` module provided by node.js but without crying when dealing with routes.

`fogo` does not support middlewares. You don't need it.

What `fogo` is good for:

-   microservices
-   simple and small json apis
-   mvps

What `fogo` is not good for:

-   applications using template engines
-   huge applications

An alternative to `fogo` is [`micro`](https://github.com/zeit/micro) in case you need more support from the community.

### Usage

```js
const fogo = require('fogo');

const handlers = {
    '/': (req, res, url) => {
        res.writeHead(200); // Pure node.js!

        res.end('Hello world!'); // you see?!?
    },
    '/products/:id': {
        get: async (req, res, url, params) => {
            try {
                await validateRequest(req, schema); // Why middlewares? :)
                const { id } = params;
                const product = getProductFromDB(id);

                res.writeHead(200);
                res.end(JSON.stringify(product));
            } catch (err) {
                res.writeHead(404);
                res.end('Ops, this product does not exist.');
            }
        }
    },
    '/customers': {
        post: async (req, res) => {
            try {
                await validateRequest(req, schema); // Why middlewares? :)
                const body = await json(req);
                const customer = await createCustomer(body.customer);

                res.writeHead(201);
                res.setHeader('X-Foo', 'bar');

                res.end('Customer created');
            } catch (err) {
                res.writeHead(403);

                res.end(
                    JSON.stringify({
                        statusCode: 403,
                        message: 'Something crazy just happened!'
                    })
                );
            }
        }
    },
    '/*': (req, res) => {
        res.writeHead(404);
        res.end('Not found, sorry ¯\_(ツ)_/¯');
    }
};

const server = fogo.createServer(handlers, requestListener);

// server is http.Server class with a helper, easy peasy!
server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(3000, () => {
    console.log('Listening on localhost:3000!');
});
```

### API

Coming soon.