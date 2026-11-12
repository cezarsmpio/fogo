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
| Static route among 100 routes | 98,397 | 642,596 | 6.53x |
| Dynamic route among 100 routes | 83,239 | 203,256 | 2.44x |
| Optional parameter | 114,852 | 444,757 | 3.87x |
| Optional parameter omitted | 161,154 | 873,090 | 5.42x |
| Wildcard route | 119,841 | 354,918 | 2.96x |
| No matching route | 169,191 | 692,135 | 4.09x |
| Static request dispatch | 90,213 | 148,940 | 1.65x |
| Dynamic request dispatch with query | 52,045 | 107,139 | 2.06x |

The baseline was measured on this branch before the static-route lookup, static-prefix grouping,
lazy query parsing, raw-path routing, and reduced path decoding changes. The branch used tsup at
the time of the baseline measurement; `master` itself still used `tsc`.

## Bundle baseline

| Metric | Before (`tsup`, unminified) | Current (`tsdown`, minified) |
| --- | ---: | ---: |
| ESM JavaScript | 5.95 kB | 4.78 kB |
| CommonJS JavaScript | 5.97 kB | 4.85 kB |
| ESM gzip | not recorded | 2.01 kB |
| CommonJS gzip | not recorded | 2.04 kB |
| npm package tarball | 11.4 kB | 8.6 kB |
| Unpacked package | 57.4 kB | 27.4 kB |

The current build is minified, tree-shaken, and ships without source maps.
