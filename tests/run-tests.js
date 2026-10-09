// Run each maintained Node check in its own process so storage and fixtures cannot leak
// between checks. Browser checks have their own npm run test:visual command.

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const testRoot = new URL('./', import.meta.url);
const checks = readdirSync(testRoot).filter(name => name.endsWith('.test.js')).sort();
let failed = 0;

for (const name of checks) {

  // Reuse the Node executable that launched this runner. No shell or platform-specific
  // wildcard expansion is needed, and a stuck check stops after 30 seconds.
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(name, testRoot))], {
    cwd: projectRoot, encoding: 'utf8', timeout: 30000
  });
  if (result.status === 0) {
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.error(`FAIL ${name}\n${result.error?.message ?? ''}${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} Node checks passed.`);
process.exitCode = failed ? 1 : 0;
