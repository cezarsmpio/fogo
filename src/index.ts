import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { Router } from './router';
import type {
  ErrorListener,
  Handler,
  HandlerListener,
  HandlerMethod,
  ParsedUrl,
  Query,
} from './types';

export type {
  ErrorListener,
  Handler,
  HandlerListener,
  HandlerMethod,
  Params,
  ParsedUrl,
  Query,
  QueryValue,
} from './types';

const BASE_URL = 'http://localhost';
const DEFAULT_PATH = '/';
const NOT_FOUND_STATUS = 404;
const NOT_FOUND_MESSAGE = 'Not Found';
const SERVER_ERROR_STATUS = 500;
const SERVER_ERROR_MESSAGE = 'Internal Server Error';

/**
 * Internal signal used to distinguish "route not found" from application
 * errors without relying on error message strings.
 */
export class NotFoundError extends Error {
  readonly statusCode = NOT_FOUND_STATUS;

  constructor(message = NOT_FOUND_MESSAGE) {
    super(message);
    this.name = 'NotFoundError';
  }
}

function parseQuery(searchParams: URLSearchParams): Query {
  const query = Object.create(null) as Query;

  for (const [key, value] of searchParams) {
    const current = query[key];

    if (current === undefined) {
      query[key] = value;
    } else if (Array.isArray(current)) {
      current.push(value);
    } else {
      query[key] = [current, value];
    }
  }

  return query;
}

function parseRequestUrl(req: IncomingMessage): ParsedUrl {
  const target = req.url ?? DEFAULT_PATH;
  let parsed: URL;

  try {
    // A fixed base keeps parsing deterministic and avoids trusting Host.
    parsed = new URL(target, BASE_URL);
  } catch {
    parsed = new URL(DEFAULT_PATH, BASE_URL);
  }

  let query: Query | undefined;

  Object.defineProperty(parsed, 'query', {
    configurable: true,
    enumerable: true,
    get() {
      query ??= parseQuery(parsed.searchParams);
      return query;
    },
  });

  return parsed as ParsedUrl;
}

function sendStatus(res: ServerResponse, statusCode: number, body: string): void {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function defaultNotFoundHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  _parsedUrl: ParsedUrl,
  _error: Error,
): void {
  sendStatus(res, NOT_FOUND_STATUS, NOT_FOUND_MESSAGE);
}

function defaultErrorHandler(
  _req: IncomingMessage,
  res: ServerResponse,
  _parsedUrl: ParsedUrl,
  error: Error,
): void {
  console.error(error);
  sendStatus(res, SERVER_ERROR_STATUS, SERVER_ERROR_MESSAGE);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function getMethodListener(handler: HandlerMethod, method: string): HandlerListener | undefined {
  if (Object.hasOwn(handler, method)) {
    return handler[method];
  }

  // HEAD has no body, so falling back to GET is safe and expected.
  if (method === 'head' && Object.hasOwn(handler, 'get')) {
    return handler.get;
  }

  return undefined;
}

/**
 * Create an `http.Server` with route handling.
 *
 * @param handlers Route handlers keyed by path pattern.
 * @param notFoundListener Called when no matching route or method is found.
 * @param errorHandler Called when a handler throws or rejects.
 */
export function createServer(
  handlers: Handler = {},
  notFoundListener: ErrorListener = defaultNotFoundHandler,
  errorHandler: ErrorListener = defaultErrorHandler,
): Server {
  const router = new Router();

  for (const path of Object.keys(handlers)) {
    router.add(path);
  }

  return createHttpServer(async (req, res) => {
    const parsedUrl = parseRequestUrl(req);
    const method = (req.method ?? 'GET').toLowerCase();

    try {
      const match = router.find(parsedUrl.pathname);

      if (!match) {
        throw new NotFoundError();
      }

      const handler = handlers[match.route.path];

      if (typeof handler === 'function') {
        await handler(req, res, parsedUrl, match.params);
        return;
      }

      if (handler && typeof handler === 'object') {
        const listener = getMethodListener(handler, method);

        if (listener) {
          await listener(req, res, parsedUrl, match.params);
          return;
        }
      }

      throw new NotFoundError();
    } catch (error) {
      const normalizedError = toError(error);

      try {
        if (normalizedError instanceof NotFoundError) {
          await notFoundListener(req, res, parsedUrl, normalizedError);
        } else {
          await errorHandler(req, res, parsedUrl, normalizedError);
        }
      } catch {
        // A failing error handler must not crash the process.
        sendStatus(res, SERVER_ERROR_STATUS, SERVER_ERROR_MESSAGE);
      }
    }
  });
}
