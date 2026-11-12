export type RouteParams = Record<string, string>;

type StaticSegment = { type: 'static'; value: string };
type PatternSegment =
  | StaticSegment
  | { type: 'param'; name: string; optional: boolean }
  | { type: 'wildcard'; name: string };

export interface CompiledRoute {
  readonly path: string;
  readonly key: string;
  readonly segments: readonly PatternSegment[];
  readonly staticPrefix: string;
  readonly staticPath: string | null;
}

export interface RouteMatch {
  readonly route: CompiledRoute;
  readonly params: RouteParams;
}

interface IndexedRoute {
  readonly route: CompiledRoute;
  readonly index: number;
}

const ROOT_PATH = '/';
const PARAM_PATTERN = /^:([A-Za-z0-9_]+)(\?)?$/;
const WILDCARD_PATTERN = /^\*([A-Za-z0-9_]*)$/;

function isStaticSegment(segment: PatternSegment): segment is StaticSegment {
  return segment.type === 'static';
}

function decodeSegment(segment: string): string {
  if (!segment.includes('%')) return segment;

  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizePatternPath(path: string): string {
  if (path === ROOT_PATH) return ROOT_PATH;

  if (path.includes('//') || path.includes('\\') || path.includes('#')) {
    throw new TypeError(`Invalid route path: ${path}`);
  }

  return path.endsWith(ROOT_PATH) ? path.slice(0, -1) : path;
}

function splitPath(pathname: string): string[] {
  if (pathname === ROOT_PATH || pathname === '') return [];

  const normalized = pathname.endsWith(ROOT_PATH) ? pathname.slice(0, -1) : pathname;
  return normalized.split(ROOT_PATH).slice(1);
}

function toPathKey(segments: readonly string[]): string {
  return segments.length === 0 ? ROOT_PATH : `${ROOT_PATH}${segments.join(ROOT_PATH)}`;
}

function toStaticPrefix(segments: readonly PatternSegment[]): string {
  if (segments.length === 0) return ROOT_PATH;

  const staticValues: string[] = [];

  for (const segment of segments) {
    if (!isStaticSegment(segment)) {
      return staticValues.length === 0 ? '' : toPathKey(staticValues);
    }

    staticValues.push(segment.value);
  }

  return toPathKey(staticValues);
}

/**
 * Compile a route pattern into an immutable representation.
 *
 * Supported syntax:
 * - `/users/:id` - required parameter
 * - `/users/:id?` - optional parameter
 * - `/files/*path` - wildcard matching the rest of the path
 * - `/files/*` - wildcard exposed as parameter `0`
 */
export function compilePath(path: string): CompiledRoute {
  if (typeof path !== 'string' || path.length === 0) {
    throw new TypeError('Route path must be a non-empty string');
  }

  if (!path.startsWith(ROOT_PATH)) {
    throw new TypeError(`Route path must start with "/": ${path}`);
  }

  const normalizedPath = normalizePatternPath(path);
  const rawSegments = normalizedPath === ROOT_PATH ? [] : normalizedPath.split(ROOT_PATH).slice(1);

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
        name: wildcard[1] || '0',
      };
    }

    if (segment.startsWith(':') || segment.startsWith('*')) {
      throw new TypeError(`Unsupported route syntax in "${path}": ${segment}`);
    }

    return { type: 'static', value: decodeSegment(segment) };
  });

  const wildcardIndex = segments.findIndex((segment) => segment.type === 'wildcard');
  if (wildcardIndex !== -1 && wildcardIndex !== segments.length - 1) {
    throw new TypeError(`Wildcard must be the last segment: ${path}`);
  }

  return {
    path,
    key: normalizedPath,
    segments,
    staticPrefix: toStaticPrefix(segments),
    staticPath: segments.every(isStaticSegment) ? normalizedPath : null,
  };
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

  const rest = pathSegments.slice(pathIndex).join(ROOT_PATH);
  return { ...params, [segment.name]: rest };
}

/**
 * A small, dependency-free router backed by compiled route patterns.
 *
 * Exact static routes use a direct lookup. Dynamic routes are grouped by
 * their static prefix so unrelated routes are skipped. The static fast path
 * is only used when no earlier dynamic route could match, preserving
 * insertion-order matching.
 */
export class Router {
  readonly #routes: IndexedRoute[] = [];
  readonly #staticRoutes = new Map<string, IndexedRoute>();
  readonly #routesByStaticPrefix = new Map<string, IndexedRoute[]>();
  readonly #routeKeys = new Set<string>();
  #firstNonStaticIndex = -1;

  add(path: string): CompiledRoute {
    const route = compilePath(path);

    if (this.#routeKeys.has(route.key)) {
      throw new TypeError(`Duplicate route path: ${path}`);
    }

    this.#routeKeys.add(route.key);

    const indexedRoute = { route, index: this.#routes.length };
    this.#routes.push(indexedRoute);

    const bucket = this.#routesByStaticPrefix.get(route.staticPrefix);
    if (bucket) {
      bucket.push(indexedRoute);
    } else {
      this.#routesByStaticPrefix.set(route.staticPrefix, [indexedRoute]);
    }

    if (route.staticPath === null) {
      if (this.#firstNonStaticIndex === -1) {
        this.#firstNonStaticIndex = indexedRoute.index;
      }
    } else if (!this.#staticRoutes.has(route.staticPath)) {
      this.#staticRoutes.set(route.staticPath, indexedRoute);
    }

    return route;
  }

  find(pathname: string): RouteMatch | null {
    if (pathname.includes('//') || pathname.includes('\\') || pathname.includes('#')) return null;

    const rawSegments = splitPath(pathname);
    const staticMatch = this.#staticRoutes.get(toPathKey(rawSegments));

    if (staticMatch && this.#isFirstPossibleMatch(staticMatch)) {
      return { route: staticMatch.route, params: {} };
    }

    const pathSegments = rawSegments.map(decodeSegment);

    for (const { route } of this.#candidatesFor(pathSegments)) {
      const params = matchSegments(route.segments, pathSegments, 0, 0, {});
      if (params) return { route, params };
    }

    return null;
  }

  get size(): number {
    return this.#routes.length;
  }

  #isFirstPossibleMatch(route: IndexedRoute): boolean {
    return this.#firstNonStaticIndex === -1 || route.index < this.#firstNonStaticIndex;
  }

  #candidatesFor(pathSegments: readonly string[]): readonly IndexedRoute[] {
    const buckets: IndexedRoute[][] = [];
    const dynamicBucket = this.#routesByStaticPrefix.get('');

    if (dynamicBucket) buckets.push(dynamicBucket);

    if (pathSegments.length === 0) {
      const rootBucket = this.#routesByStaticPrefix.get(ROOT_PATH);
      if (rootBucket) buckets.push(rootBucket);
    } else {
      let prefix = '';

      for (const segment of pathSegments) {
        prefix += `${ROOT_PATH}${segment}`;
        const bucket = this.#routesByStaticPrefix.get(prefix);
        if (bucket) buckets.push(bucket);
      }
    }

    if (buckets.length === 0) return [];
    if (buckets.length === 1) return buckets[0] as IndexedRoute[];

    return buckets.flat().sort((left, right) => left.index - right.index);
  }
}
