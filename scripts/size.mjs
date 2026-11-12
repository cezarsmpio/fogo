import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const SIZE_BUDGETS = [
  { file: 'dist/index.js', gzipBytes: 2_048 },
  { file: 'dist/index.cjs', gzipBytes: 2_048 },
  { file: 'dist/index.d.ts', gzipBytes: 1_024 },
];

let failed = false;

for (const { file, gzipBytes } of SIZE_BUDGETS) {
  const contents = await readFile(file);
  const compressedBytes = gzipSync(contents, { level: 9 }).byteLength;
  const status = compressedBytes <= gzipBytes ? 'ok' : 'over budget';

  console.log(
    `${file}: ${contents.byteLength} B raw, ${compressedBytes} B gzip (budget ${gzipBytes} B) - ${status}`,
  );

  if (compressedBytes > gzipBytes) failed = true;
}

if (failed) process.exitCode = 1;
