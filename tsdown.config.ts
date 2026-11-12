import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  dts: true,
  minify: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  outExtensions({ format }) {
    const isEsm = format === 'es';

    return {
      js: isEsm ? '.js' : '.cjs',
      dts: isEsm ? '.d.ts' : '.d.cts',
    };
  },
});
