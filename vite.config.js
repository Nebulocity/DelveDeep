import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const branch = (git('branch', '--show-current') || 'detached')
  .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
const commit = git('rev-parse', '--short=8', 'HEAD') || 'unknown';
const buildName = branch + '-' + commit;

export default defineConfig({
  define: { __DELVE_DEEP_BUILD_ID__: JSON.stringify(randomUUID()) },
  plugins: [{
    name: 'delve-build-name',
    transformIndexHtml(html) {
      return html.replace('__DELVE_DEEP_BUILD_NAME__', buildName);
    }
  }]
});
