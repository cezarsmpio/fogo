# fogo 🔥

> Yet another node.js framework, but simpler.

[![Build Status](https://travis-ci.com/cezarsmpio/fogo.svg?branch=master)](https://travis-ci.com/cezarsmpio/fogo)
[![npm download](https://img.shields.io/npm/dm/fogo.svg)](https://www.npmjs.com/package/fogo)
[![GitHub issues](https://img.shields.io/github/issues/cezarsmpio/fogo.svg)](https://github.com/cezarsmpio/fogo/issues)
[![minified + gzip](https://badgen.net/bundlephobia/minzip/fogo)](https://bundlephobia.com/result?p=fogo)
[![MIT license](https://img.shields.io/badge/License-MIT-blue.svg)](https://lbesson.mit-license.org/)
[![npm version](https://img.shields.io/npm/v/fogo.svg)](https://www.npmjs.com/package/fogo)
[![GitHub contributors](https://img.shields.io/github/contributors/cezarsmpio/fogo.svg)](https://GitHub.com/cezarsmpio/fogo/graphs/contributors/)
[![GitHub stars](https://img.shields.io/github/stars/cezarsmpio/fogo.svg?style=social&label=Star)](https://github.com/cezarsmpio/fogo)

### Install

```
npm install fogo --save
```

`fogo` supports only node 8+ because of `async`/`await`.

### Why? Why? Why?

`fogo`, means `fire` in Portuguese 🤷‍♀️. It is basically a wrapper for the [node.js http module](https://nodejs.org/api/http.html#http_class_http_server).

Sometimes `Express`, which is a good framework, is too much for your needs or too heavy because of its tons of dependencies, especially if you do microservices or have a lot of CI/CD going on.

Only use `fogo` if you want to use the `http` module provided by node.js but without dealing with routes.

`fogo` does not support middlewares. You _really_ don't need it.

What `fogo` is good for:

-   microservices
-   restful/json apis

What `fogo` is not good for:

-   applications using template engines
-   monolithic applications

An alternative to `fogo` is [`micro`](https://github.com/zeit/micro).

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
                const product = await getProductFromDB(params.id);

                res.writeHead(200);
                res.end(JSON.stringify(product));
            } catch (err) {
                res.writeHead(404);
                res.end('Oops, this product does not exist.');
            }
        }
    },
    '/customers': {
        post: async (req, res) => {
            try {
                await validateRequest(req, schema); // Why middlewares? :)
                const body = await json(req);
                const customer = await createCustomer(body.customer);

                res.setHeader('x-foo', 'bar');
                res.writeHead(201);
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
    }
};

const notFoundHandler = (req, res) => {
    res.writeHead(404);
    res.end('Not found, sorry!');
};

const server = fogo.createServer(handlers, notFoundHandler);

// server is just a wrapper for the http.Server class
server.on('clientError', (err, socket) => {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(3000, () => {
    console.log('Running at localhost:3000!');
});
```

## API

### `createServer`

```js
const server = fogo.createServer(handlers, notFoundListener, errorHandler);
```

Since `fogo.createServer` returns a [`http.Server`](https://nodejs.org/api/http.html#http_class_http_server) class, you should be able to use all its methods. Please, check out the documentation for more information.

It creates a server that you can listen to. It accepts two arguments:

#### `handlers`: object - required

An object containing your handlers for each route with/without specifying the http method. Specify a function if you want that route to listen to all http methods.

```js
const handlers = {
    '/': (req, res, url, params) => {
        res.end();
    },
    '/welcome': {
        get: (req, res, url, params) => {
            res.end();
        },
        post: (req, res, url, params) => {
            res.end();
        }
    }
};
```

Arguments received:

-   `req`: [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
-   `res`: [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse)
-   `url?`: [url.UrlWithParsedQuery](https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
-   `params?`: object

#### `notFoundListener`: function

If none of you handle has the requested route, this callback is called.

`fogo` provides a default one.

```js
function defaultNotFound(req, res) {
    res.writeHead(404);
    res.end(http.STATUS_CODES[404]);
}
```

The response will look like:

```
Not Found
```

Arguments received:

-   `req`: [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
-   `res`: [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse)
-   `url?`: [url.UrlWithParsedQuery](https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
-   `error?`: Error

#### `errorHandler`: function

It's called when an exception is thrown on the request.

`fogo` provides a default one.

```js
function defaultErrorHandler(req, res, parsedUrl, err) {
    console.log(err);

    res.writeHead(500);
    res.end(http.STATUS_CODES[500]);
}
```

The response will look like:

```
Internal Server Error
```

Arguments received:

-   `req`: [http.IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
-   `res`: [http.ServerResponse](https://nodejs.org/api/http.html#http_class_http_serverresponse)
-   `url?`: [url.UrlWithParsedQuery](https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost)
-   `error?`: Error

---

Made with ❤️ enjoy it!
