import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * A query string value. Repeated keys are represented as an array.
 */
export type QueryValue = string | string[];

/**
 * Parsed query string, mirroring `node:querystring` semantics.
 */
export type Query = Record<string, QueryValue>;

/**
 * The URL object passed to every handler.
 *
 * It is a WHATWG `URL` instance with an extra `query` property for
 * backwards-compatible access to parsed query string values.
 */
export type ParsedUrl = URL & { query: Query };

/**
 * Route parameters extracted from the request path.
 */
export type Params = Record<string, string>;

/**
 * A route handler.
 */
export type HandlerListener = (
  req: IncomingMessage,
  res: ServerResponse,
  url: ParsedUrl,
  params: Params,
) => void | Promise<void>;

/**
 * Called when no route matches, or when a route does not handle the
 * request method. Also used for application errors.
 */
export type ErrorListener = (
  req: IncomingMessage,
  res: ServerResponse,
  url: ParsedUrl,
  error: Error,
) => void | Promise<void>;

/**
 * Handlers keyed by lowercase HTTP method (for example `get` or `post`).
 */
export interface HandlerMethod {
  [method: string]: HandlerListener;
}

/**
 * Route handlers keyed by path pattern.
 */
export interface Handler {
  [path: string]: HandlerListener | HandlerMethod;
}
