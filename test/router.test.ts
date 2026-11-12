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

  it('keeps the original path', () => {
    expect(compilePath('/users/:id').path).toBe('/users/:id');
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

  it('supports a default wildcard name', () => {
    const router = new Router();
    router.add('/assets/*');

    expect(router.find('/assets/logo.svg')?.params).toEqual({ wildcard: 'logo.svg' });
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

  it('reports the number of registered routes', () => {
    const router = new Router();
    router.add('/a');
    router.add('/b');

    expect(router.size).toBe(2);
  });
});
