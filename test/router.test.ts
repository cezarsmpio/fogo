import { describe, expect, it } from 'vitest';
import { compilePath, Router } from '../src/router';

describe('compilePath', () => {
  it('rejects empty paths', () => {
    expect(() => compilePath('')).toThrow(TypeError);
  });

  it('rejects paths that do not start with a slash', () => {
    expect(() => compilePath('users')).toThrow(/must start with/);
  });

  it('rejects wildcards that are not the final segment', () => {
    expect(() => compilePath('/files/*path/edit')).toThrow(/Wildcard must be the last/);
  });

  it('rejects empty segments and ambiguous separators', () => {
    expect(() => compilePath('//')).toThrow(/Invalid route path/);
    expect(() => compilePath('/a//b')).toThrow(/Invalid route path/);
    expect(() => compilePath('/a//')).toThrow(/Invalid route path/);
    expect(() => compilePath('/a\\b')).toThrow(/Invalid route path/);
    expect(() => compilePath('/a#b')).toThrow(/Invalid route path/);
  });

  it('rejects unsupported parameter and wildcard syntax', () => {
    expect(() => compilePath('/users/:id([0-9]+)')).toThrow(/Unsupported route syntax/);
    expect(() => compilePath('/files/:path*')).toThrow(/Unsupported route syntax/);
    expect(() => compilePath('/files/*path*')).toThrow(/Unsupported route syntax/);
  });

  it('normalizes a single trailing slash', () => {
    const route = compilePath('/users/');

    expect(route.path).toBe('/users/');
    expect(route.key).toBe('/users');
  });

  it('keeps the original path', () => {
    expect(compilePath('/users/:id').path).toBe('/users/:id');
  });

  it('treats routes as case-sensitive', () => {
    expect(compilePath('/Users/:id').key).toBe('/Users/:id');
    expect(compilePath('/Users/:id').key).not.toBe(compilePath('/users/:id').key);
  });
});

describe('Router', () => {
  it('matches static routes', () => {
    const router = new Router();
    router.add('/health');

    expect(router.find('/health')?.params).toEqual({});
    expect(router.find('/health/')?.params).toEqual({});
  });

  it('matches the root route', () => {
    const router = new Router();
    router.add('/');

    expect(router.find('/')?.route.path).toBe('/');
    expect(router.find('/other')).toBeNull();
  });

  it('extracts required parameters', () => {
    const router = new Router();
    router.add('/users/:id');

    expect(router.find('/users/42')?.params).toEqual({ id: '42' });
    expect(router.find('/users')).toBeNull();
    expect(router.find('/users/')).toBeNull();
  });

  it('extracts optional parameters', () => {
    const router = new Router();
    router.add('/users/:id/:name?');

    expect(router.find('/users/42')?.params).toEqual({ id: '42' });
    expect(router.find('/users/42/cezar')?.params).toEqual({
      id: '42',
      name: 'cezar',
    });
  });

  it('allows optional parameters before static segments', () => {
    const router = new Router();
    router.add('/api/:version?/health');

    expect(router.find('/api/health')?.params).toEqual({});
    expect(router.find('/api/v2/health')?.params).toEqual({ version: 'v2' });
  });

  it('decodes URL-encoded path segments and parameters', () => {
    const router = new Router();
    router.add('/hello world/:name');

    expect(router.find('/hello%20world/cezar%20sampaio')?.params).toEqual({
      name: 'cezar sampaio',
    });
  });

  it('keeps malformed percent escapes as-is', () => {
    const router = new Router();
    router.add('/files/:name');

    expect(router.find('/files/%E0%A4%A')?.params).toEqual({ name: '%E0%A4%A' });
  });

  it('matches wildcard routes', () => {
    const router = new Router();
    router.add('/files/*path');

    expect(router.find('/files/a/b%20c')?.params).toEqual({ path: 'a/b c' });
    expect(router.find('/files')?.params).toEqual({ path: '' });
  });

  it('supports the legacy unnamed wildcard parameter', () => {
    const router = new Router();
    router.add('/assets/*');

    expect(router.find('/assets/logo.svg')?.params).toEqual({ '0': 'logo.svg' });
  });

  it('keeps encoded slashes inside a single path segment', () => {
    const router = new Router();
    router.add('/a/b');

    expect(router.find('/a%2Fb')).toBeNull();

    const encodedRouter = new Router();
    encodedRouter.add('/a%2Fb');

    expect(encodedRouter.find('/a/b')).toBeNull();
    expect(encodedRouter.find('/a%2Fb')?.route.path).toBe('/a%2Fb');
  });

  it('is case-sensitive', () => {
    const router = new Router();
    router.add('/Users/:id');

    expect(router.find('/users/42')).toBeNull();
    expect(router.find('/Users/42')?.params).toEqual({ id: '42' });
  });

  it('normalizes a path that consists only of slashes', () => {
    const router = new Router();
    router.add('/x');

    expect(router.find('///')).toBeNull();
  });

  it('returns the first matching route', () => {
    const router = new Router();
    router.add('/users/:id');
    router.add('/users/me');

    expect(router.find('/users/me')?.route.path).toBe('/users/:id');
  });

  it('groups routes that share a static prefix', () => {
    const router = new Router();
    router.add('/users/:id');
    router.add('/users/:name');

    expect(router.find('/users/fogo')?.route.path).toBe('/users/:id');
  });

  it('uses the static fast path when the static route comes first', () => {
    const router = new Router();
    const staticRoute = router.add('/users/me');
    router.add('/users/:id');

    expect(router.find('/users/me')?.route).toBe(staticRoute);
    expect(router.find('/users/42')?.params).toEqual({ id: '42' });
  });

  it('rejects duplicate routes after normalization', () => {
    const router = new Router();
    router.add('/duplicate');

    expect(() => router.add('/duplicate')).toThrow(/Duplicate route path/);
    expect(() => router.add('/duplicate/')).toThrow(/Duplicate route path/);
  });

  it('rejects invalid pathnames passed to find', () => {
    const router = new Router();
    router.add('/a');

    expect(router.find('//a')).toBeNull();
    expect(router.find('/a//b')).toBeNull();
    expect(router.find('/a\\b')).toBeNull();
    expect(router.find('/a#b')).toBeNull();
  });

  it('falls back to ordered matching when a dynamic route comes first', () => {
    const router = new Router();
    router.add('/:section/:id');
    router.add('/users/:id');

    expect(router.find('/users/42')?.route.path).toBe('/:section/:id');
  });

  it('matches a root route after a dynamic route', () => {
    const router = new Router();
    router.add('/:id');
    router.add('/');

    expect(router.find('/')?.route.path).toBe('/');
  });

  it('returns no match for the root path when no route is registered', () => {
    const router = new Router();

    expect(router.find('/')).toBeNull();
  });

  it('rejects paths with extra segments', () => {
    const router = new Router();
    router.add('/users/:id');

    expect(router.find('/users/42/extra')).toBeNull();
  });

  it('reports the number of registered routes', () => {
    const router = new Router();
    router.add('/a');
    router.add('/b');

    expect(router.size).toBe(2);
  });
});
