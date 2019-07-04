import { IncomingMessage, ServerResponse } from 'http';
import { UrlWithParsedQuery } from 'url';

export type HandlerListener = (
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: UrlWithParsedQuery,
  params: Object
) => any;

export type ErrorListener = (
  req: IncomingMessage,
  res: ServerResponse,
  parsedUrl: UrlWithParsedQuery,
  error: Error
) => any;

export interface HandlerMethod {
  [method: string]: HandlerListener;
}

export interface Handler {
  [path: string]: HandlerListener | HandlerMethod;
}
