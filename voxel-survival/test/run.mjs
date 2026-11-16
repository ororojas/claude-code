#!/usr/bin/env node
/**
 * Test runner. Executes each suite in its own process and reports a summary.
 *
 * The headless suites need nothing but Node; the browser suite needs Playwright
 * and skips itself cleanly when it is unavailable.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const SUITES = [
  ['world', 'world.mjs'],
  ['physics', 'physics.mjs'],
  ['browser', 'browser.mjs'],
];

function run(file) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [resolve(HERE, file)], { stdio: 'inherit' });
    child.on('close', (code) => done(code ?? 1));
  });
}

let failed = 0;
for (const [name, file] of SUITES) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
  const code = await run(file);
  if (code !== 0) failed++;
}

console.log(failed === 0 ? '\n✓ all suites passed\n' : `\n✗ ${failed} suite(s) failed\n`);
process.exit(failed === 0 ? 0 : 1);
