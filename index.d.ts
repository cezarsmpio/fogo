import http from 'http';
import url from 'url';

export as namespace fogo;

type FogoRequestListener = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url?: url.UrlWithParsedQuery,
  params?: object
) => void;

type FogoNotFoundRequestListener = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url?: url.UrlWithParsedQuery,
  error?: Error
) => void;

interface FogoMethod {
  [method: string]: FogoRequestListener;
}

interface FogoHandler {
  [routePath: string]: FogoRequestListener | FogoMethod;
}

export function createServer(
  handlers: FogoHandler,
  notFound: FogoNotFoundRequestListener
): http.Server;
