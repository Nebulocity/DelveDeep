// Vite serves the source during development and builds the shipped web bundle. We embed a
// unique build ID for the existing fresh-save policy, and a readable branch/commit label
// for the splash. JSON.stringify turns an injected value into valid JavaScript source. Git
// metadata can be absent in an exported source folder.

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

    // We handle transform index html here, keeping this operation in one place for its
    // callers.
    transformIndexHtml(html) {
      return html.replace('__DELVE_DEEP_BUILD_NAME__', buildName);
    }
  }]
});
