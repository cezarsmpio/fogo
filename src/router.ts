export type RouteParams = Record<string, string>;

type PatternSegment =
  | { type: 'static'; value: string }
  | { type: 'param'; name: string; optional: boolean }
  | { type: 'wildcard'; name: string };

export interface CompiledRoute {
  readonly path: string;
  readonly segments: readonly PatternSegment[];
}

export interface RouteMatch {
  readonly route: CompiledRoute;
  readonly params: RouteParams;
}

const PARAM_PATTERN = /^:([A-Za-z0-9_]+)(\?)?$/;
const WILDCARD_PATTERN = /^\*([A-Za-z0-9_]*)$/;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function splitPath(pathname: string): string[] {
  if (pathname === '/' || pathname === '') return [];

  const normalized = pathname.replace(/\/+$/, '');
  if (normalized === '') return [];

  return normalized.split('/').slice(1).map(decodeSegment);
}

/**
 * Compile a route pattern into an immutable representation.
 *
 * Supported syntax:
 * - `/users/:id` - required parameter
 * - `/users/:id?` - optional parameter
 * - `/files/*path` - wildcard matching the rest of the path
 */
export function compilePath(path: string): CompiledRoute {
  if (typeof path !== 'string' || path.length === 0) {
    throw new TypeError('Route path must be a non-empty string');
  }

  if (!path.startsWith('/')) {
    throw new TypeError(`Route path must start with "/": ${path}`);
  }

  const rawSegments = path === '/' ? [] : path.replace(/\/+$/, '').split('/').slice(1);

  const segments: PatternSegment[] = rawSegments.map((segment) => {
    const param = PARAM_PATTERN.exec(segment);
    if (param) {
      return {
        type: 'param',
        name: param[1] as string,
        optional: param[2] === '?',
      };
    }

    const wildcard = WILDCARD_PATTERN.exec(segment);
    if (wildcard) {
      return {
        type: 'wildcard',
        name: wildcard[1] || 'wildcard',
      };
    }

    return { type: 'static', value: decodeSegment(segment) };
  });

  const wildcardIndex = segments.findIndex((segment) => segment.type === 'wildcard');
  if (wildcardIndex !== -1 && wildcardIndex !== segments.length - 1) {
    throw new TypeError(`Wildcard must be the last segment: ${path}`);
  }

  return { path, segments };
}

function matchSegments(
  segments: readonly PatternSegment[],
  pathSegments: readonly string[],
  segmentIndex: number,
  pathIndex: number,
  params: RouteParams,
): RouteParams | null {
  if (segmentIndex === segments.length) {
    return pathIndex === pathSegments.length ? params : null;
  }

  const segment = segments[segmentIndex] as PatternSegment;

  if (segment.type === 'static') {
    if (pathSegments[pathIndex] !== segment.value) return null;
    return matchSegments(segments, pathSegments, segmentIndex + 1, pathIndex + 1, params);
  }

  if (segment.type === 'param') {
    const value = pathSegments[pathIndex];

    if (value !== undefined && value !== '') {
      const matched = matchSegments(segments, pathSegments, segmentIndex + 1, pathIndex + 1, {
        ...params,
        [segment.name]: value,
      });

      if (matched) return matched;
    }

    if (segment.optional) {
      return matchSegments(segments, pathSegments, segmentIndex + 1, pathIndex, params);
    }

    return null;
  }

  const rest = pathSegments.slice(pathIndex).join('/');
  return { ...params, [segment.name]: rest };
}

/**
 * A small, dependency-free router backed by compiled route patterns.
 */
export class Router {
  readonly #routes: CompiledRoute[] = [];

  add(path: string): CompiledRoute {
    const route = compilePath(path);
    this.#routes.push(route);
    return route;
  }

  find(pathname: string): RouteMatch | null {
    const pathSegments = splitPath(pathname);

    for (const route of this.#routes) {
      const params = matchSegments(route.segments, pathSegments, 0, 0, {});
      if (params) return { route, params };
    }

    return null;
  }

  get size(): number {
    return this.#routes.length;
  }
}
