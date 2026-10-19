import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream, writeFileSync, copyFileSync, cpSync, existsSync } from 'node:fs';
import path from 'node:path';

// One supervised run, with one restart only when Vite itself fails. Assertion failures
// never retry. Playwright separately bounds each test and its complete execution.
const root = path.resolve('output/qa/overnight-ui-audit');
const run = path.join(root, 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(run, { recursive: true });
for (const file of ['execution.json', 'inventory.json', 'coverage.json']) {
  if (existsSync(path.join(root, file))) copyFileSync(path.join(root, file), path.join(run, `previous-${file}`));
}
if (existsSync(path.join(root, 'test-results'))) cpSync(path.join(root, 'test-results'), path.join(run, 'previous-test-results'), { recursive: true });
let exitCode = 1;
for (let attempt = 0; attempt < 2; attempt++) {
  const log = createWriteStream(path.join(run, `attempt-${attempt + 1}.log`));
  let outputTail = '';
  const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'tests/visual/audit.config.js', ...process.argv.slice(2)],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const output = chunk => {
    log.write(chunk);
    process.stdout.write(chunk);
    outputTail = (outputTail + chunk.toString()).slice(-15000);
  };
  child.stdout.on('data', output);
  child.stderr.on('data', output);
  const timer = setTimeout(() => {
    writeFileSync(path.join(run, 'watchdog.json'), JSON.stringify({ pid: child.pid, reason: '125 minute process ceiling' }));
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    else child.kill('SIGTERM');
  }, 125 * 60000);
  exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  clearTimeout(timer);
  log.end();
  if (!exitCode || !/\[WebServer\].*(?:exited|crashed)|Process from config.webServer was not able to start/s.test(outputTail)) break;
}
writeFileSync(path.join(run, 'supervisor.json'), JSON.stringify({ exitCode, completedAt: new Date().toISOString() }, null, 2));
process.exitCode = exitCode;
