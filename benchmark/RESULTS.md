# Benchmark results

Command:

```sh
npm run bench
```

Environment: Node.js 26.13.0, Linux x64, Vitest 2.1.9. Numbers are operations per second
(`hz`), so higher is better. Benchmarks are host-dependent; the committed suite is the source of
truth.

## Baseline and optimized

| Benchmark | Baseline | Optimized | Speedup |
| --- | ---: | ---: | ---: |
| Static route among 100 routes | 98,397 | 851,103 | 8.65x |
| Dynamic route among 100 routes | 83,239 | 319,848 | 3.84x |
| Optional parameter | 114,852 | 399,922 | 3.48x |
| Optional parameter omitted | 161,154 | 743,033 | 4.61x |
| Wildcard route | 119,841 | 187,452 | 1.56x |
| No matching route | 169,191 | 449,939 | 2.66x |
| Static request dispatch | 90,213 | 117,176 | 1.30x |
| Dynamic request dispatch with query | 52,045 | 57,118 | 1.10x |

The baseline was measured before the static-route lookup, static-prefix grouping, lazy query
parsing, and reduced path decoding changes.

## Bundle baseline

| Metric | Before (`tsup`, unminified) | Current (`tsdown`, minified) |
| --- | ---: | ---: |
| ESM JavaScript | 5.95 kB | 3.76 kB |
| CommonJS JavaScript | 5.97 kB | 3.83 kB |
| ESM gzip | not recorded | 1.73 kB |
| CommonJS gzip | not recorded | 1.77 kB |
| npm package tarball | 11.4 kB | 7.2 kB |
| Unpacked package | 57.4 kB | 22.6 kB |

The current build is minified, tree-shaken, and ships without source maps. `npm run check:size`
enforces the gzip budgets.
