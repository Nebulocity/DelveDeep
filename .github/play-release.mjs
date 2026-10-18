// Runs only in GitHub Actions. No publishing credentials enter the game bundle.
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { join } from 'node:path';

const env = process.env;
const packageName = 'com.waywardkobold.app';
const required = (name) => {
  if (!env[name]) throw new Error(`Configure ${name} in the google-play-internal GitHub environment.`);
  return env[name];
};
const temporaryPath = (name) => join(required('RUNNER_TEMP'), name);
const output = (file, values) => appendFileSync(required(file),
  Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));

function prepare() {
  const branch = required('SOURCE_BRANCH');
  if (branch !== 'main' || env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Google Play releases must run from main.');
  }
  if (!['Build only', 'Publish internal'].includes(env.RELEASE_MODE)) throw new Error('Unknown release mode.');
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version) || lock.version !== version || lock.packages[''].version !== version) {
    throw new Error('Use a numeric package version with matching root lockfile versions.');
  }
  const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
  const gradle = readFileSync('android/app/build.gradle', 'utf8');
  if (config.appId !== packageName || !/applicationId\s*(?:=\s*)?["']com\.waywardkobold\.app["']/.test(gradle)) {
    throw new Error('The Android package must remain com.waywardkobold.app.');
  }

  // Each run reserves 100 codes. Reruns have distinct codes without repository edits.
  const numbers = ['PLAY_VERSION_CODE_BASE', 'GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT'].map((name) => {
    const value = required(name);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`${name} must be an integer.`);
    return Number(value);
  });
  const [base, run, attempt] = numbers;
  const code = base + run * 100 + attempt;
  if (base < 1 || run < 1 || attempt < 1 || attempt >= 100 || !Number.isSafeInteger(code) || code > 2100000000) {
    throw new Error('Invalid version-code allocation. Use attempts 1 through 99 and a code below the Android limit.');
  }
  if (env.RELEASE_MODE === 'Publish internal') {

    // Never accept production, open testing, or a list of tracks from configuration.
    if (!['internal', 'qa'].includes(required('PLAY_INTERNAL_TRACK'))) {
      throw new Error('PLAY_INTERNAL_TRACK must be the confirmed internal track identifier (internal or qa).');
    }
    const notes = (env.RELEASE_NOTES || '').trim();
    if (!notes || [...notes].length > 500) throw new Error('Publishing requires release notes of 1 to 500 characters.');
    mkdirSync(temporaryPath('delve-play-notes'), { recursive: true });
    writeFileSync(join(temporaryPath('delve-play-notes'), 'whatsnew-en-US'), notes);
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  output('GITHUB_ENV', { APP_VERSION_CODE: code, RELEASE_VERSION: version, RELEASE_COMMIT: commit });
  output('GITHUB_OUTPUT', { version, code, commit });
}

function signing() {
  const encoded = required('DELVE_UPLOAD_KEYSTORE_BASE64').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Upload keystore secret must contain base64 data.');
  const path = temporaryPath('delve-upload.jks');
  writeFileSync(path, Buffer.from(encoded, 'base64'), { mode: 0o600 });
  output('GITHUB_ENV', { DELVE_UPLOAD_STORE_FILE: path });
}

async function playPreflight() {
  const rawCredentials = required('PLAY_SERVICE_ACCOUNT_JSON');
  let credentials;
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    throw new Error('PLAY_SERVICE_ACCOUNT_JSON must contain a complete service account JSON key.');
  }
  if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
    throw new Error('Google credentials must be a service account with an email and private key.');
  }
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const assertion = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  })}`;
  const signer = createSign('RSA-SHA256');
  signer.update(assertion);
  const signature = signer.sign(credentials.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${assertion}.${signature}` }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}). Check the service account key.`);
  const { access_token: token } = await response.json();
  if (!token) throw new Error('Google returned no access token.');
  process.stdout.write(`::add-mask::${token}\n`);
  const root = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/edits`;
  const request = async (url, method = 'GET') => {
    const result = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}),
      signal: AbortSignal.timeout(30000)
    });
    if (!result.ok) {
      const body = await result.json().catch(() => ({}));
      throw new Error(`Play API failed (${result.status}): ${body.error?.message || 'Check app permissions and Play Console requirements.'}`);
    }
    const text = await result.text();
    return text ? JSON.parse(text) : null;
  };
  const edit = await request(root, 'POST');
  try {
    const { tracks = [] } = await request(`${root}/${edit.id}/tracks`);
    if (!tracks.some(({ track }) => track === env.PLAY_INTERNAL_TRACK)) {
      throw new Error('Configured internal track was not returned by Play. Confirm its identifier before publishing.');
    }

    // A rerun of an older workflow can have a lower code than a newer completed run.
    // Check every active track; Google also rejects codes already used by other uploads.
    const codes = tracks.flatMap(({ releases = [] }) => releases.flatMap(({ versionCodes = [] }) => versionCodes.map(Number)));
    if (Number(env.APP_VERSION_CODE) <= Math.max(0, ...codes)) {
      throw new Error('Stale Android version code. Start a new workflow run; do not rerun an older release.');
    }
  } finally {

    // This temporary edit only reads track state. The upload action owns its own edit.
    await request(`${root}/${edit.id}`, 'DELETE');
  }
}

function summary() {
  let result = 'Build only; nothing submitted to Google Play.';
  if (env.RELEASE_JOB_STATUS !== 'success') {
    result = 'Run failed or was cancelled. Inspect the failed step and Play Console before retrying; an interrupted upload may have committed.';
  } else if (env.PUBLISH_OUTCOME === 'success') {
    result = 'Internal release submitted. Confirm processing, review requirements, and tester availability in Play Console.';
  }
  appendFileSync(required('GITHUB_STEP_SUMMARY'), [
    '## Google Play internal release', '',
    `- Branch: ${env.SOURCE_BRANCH || 'unavailable'}`,
    `- Commit: ${env.RELEASE_COMMIT || 'unavailable'}`,
    `- Version: ${env.RELEASE_VERSION || 'unavailable'}`,
    `- Android version code: ${env.APP_VERSION_CODE || 'unavailable'}`,
    `- Mode: ${env.RELEASE_MODE || 'unavailable'}`,
    `- Result: ${result}`, '',
    'A successful upload does not confirm the update is already available on devices.', ''
  ].join('\n'));
}

try {
  const command = process.argv[2];
  if (command === 'prepare') prepare();
  else if (command === 'signing') signing();
  else if (command === 'play-preflight') await playPreflight();
  else if (command === 'summary') summary();
  else if (command === 'cleanup') {
    rmSync(temporaryPath('delve-upload.jks'), { force: true });
    rmSync(temporaryPath('delve-play-notes'), { recursive: true, force: true });
  } else throw new Error('Unknown release helper command.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
