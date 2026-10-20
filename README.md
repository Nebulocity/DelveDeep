Google Play internal releases
============================

`0.1.11` is the development branch: pushes deploy it to GitHub Pages for browser
testing. `main` is the Google Play release branch: merge approved development
changes there before releasing. Merging into main does not publish to Google.

The manual **Google Play internal release** workflow builds only `main` and can
submit it to the existing internal testing track. It does not run on push or
publish to production. The default mode is **Build only**.
Only run either mode when release packaging is intended. The workflow runs no game
tests, browser checks, or screenshots.

### One-time account and GitHub setup

1. In Google Cloud, create or select a project, enable the **Google Play Android
   Developer API**, and create a service account. Create a JSON key for this account.
   In Play Console **Users and permissions**, invite its service account email with
   access to Delve Deep only. Grant **View app information (read-only)** and
   **Release apps to testing tracks**. Do not grant production publishing, financial,
   or account administrator access. Keep the existing internal tester list.
2. Confirm the highest version code ever uploaded for `com.waywardkobold.app`,
   including drafts and other tracks, in Play Console's app bundle explorer. Confirm
   the internal track's API identifier using the Play tracks API or existing account
   configuration. Set the exact identifier, normally `internal`; `qa` is accepted
   for accounts exposing that identifier. The workflow checks that it exists and
   refuses other tracks. Do not configure internal app sharing as a testing track.
3. In this repository's GitHub **Settings > Environments**, create
   `google-play-internal`. Add these environment secrets:

   | Secret | Value |
   | --- | --- |
   | `DELVE_UPLOAD_KEYSTORE_BASE64` | Base64 contents of the existing permanent upload keystore |
   | `DELVE_UPLOAD_STORE_PASSWORD` | Its store password |
   | `DELVE_UPLOAD_KEY_ALIAS` | Its private-key alias |
   | `DELVE_UPLOAD_KEY_PASSWORD` | Its private-key password |
   | `PLAY_SERVICE_ACCOUNT_JSON` | Complete Google service account JSON key |

   Reuse the key for the current Play release. Never use the Android debug key or
   create a replacement upload key for this workflow. Enter secrets directly into
   GitHub; do not put them in chat, source, release notes, or command arguments.
   On Windows, this copies the existing keystore as base64 to the clipboard without
   printing it; replace the example path, paste into the secret, then clear the clipboard:

   ```powershell
   Set-Clipboard -Value ([Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\private\DelveDeep-upload.jks')))
   # After pasting into GitHub:
   Set-Clipboard -Value ''
   ```

4. In the same environment add variables `PLAY_INTERNAL_TRACK` with the confirmed
   identifier and `PLAY_VERSION_CODE_BASE` with a fixed positive integer greater
   than every previously uploaded version code. For example, use `1000` only after
   confirming all existing codes are below 1000. There is intentionally no fallback
   baseline. Restrict this environment to `main`. Restrict the existing `github-pages`
   environment to `0.1.11`. Both workflows also enforce their branch in their job
   conditions. Release builds execute main's code on the runner that handles the
   upload signing key; merge only reviewed changes into main.
5. Put `.github/workflows/google-play-internal.yml` and `.github/play-release.mjs`
   on `main`, the repository default branch. This makes GitHub expose the manual
   workflow button; installing automation does not require merging unfinished town
   UI. Keep the same automation files on the development branch so future merges
   preserve them. Main must have matching package and root lockfile versions, plus
   the existing environment-based signing and Gradle version-code support.

### Releasing 0.1.11 and later updates

1. Finish the town UI in its current task. Review and commit the intended code and
   all runtime assets, then push `0.1.11`. Its `package.json` version and both root
   version entries in `package-lock.json` must be `0.1.11`. Pushes update Pages for
   development testing. Once approved, merge those finished changes into `main`.
2. Open **Actions > Google Play internal release > Run workflow**. Select `main`
   and **Build only**. This signs and packages an AAB without contacting Google. Inspect
   the job summary and downloadable artifact, including its package, version,
   version code, and upload signing certificate. An AAB is not directly installable.
3. When ready to distribute, run it again with **Publish internal** and concise
   English release notes, at most 500 characters. For example, after the features
   are complete: "Updated town hub, service screens, and shop navigation."
   Each run builds the exact main commit captured when the workflow was started.
   Compare the publish summary's commit with the reviewed build. Keep main unchanged
   between review and publication; publish mode rebuilds that release commit.
4. Confirm the new release in Play Console. A successful submission may still need
   processing, review, or account actions before testers can obtain it. Update the
   existing Play-installed app on the phone and review launch, landscape town UI,
   navigation, shops, haptics, and saving/relaunching. Observe existing save behavior;
   this automation adds no save migration or backup.

Version codes are `PLAY_VERSION_CODE_BASE + github.run_number * 100 + github.run_attempt`.
Attempts 1 through 99 are supported; build-only runs consume their numbers too.
The human-readable version comes from main's package.json, independently of its
branch name. It stays `0.1.11` until the next deliberate package version change.
The baseline must stay fixed and the workflow file must retain its name so its run
sequence continues. After renaming/replacing the workflow or making a manual Play
upload, recheck the highest code and deliberately advance the baseline if needed.
Never decrease it. Local builds still use `android/gradle.properties`; choose an
unused code above Play's highest upload if distributing manually after CI releases.

Only one release job runs at a time. GitHub concurrency is not a FIFO queue and can
replace an older pending run. Before uploading, the workflow checks active track
codes and rejects stale runs; Play rejects previously used codes as well. Start a
new run for the current release if an old rerun is stale. If a submission fails or
is interrupted, inspect Play Console before retrying because it may have committed.
No automatic upload retry or review-bypass fallback is configured. Signed bundles
are retained as Actions artifacts for 14 days; temporary signing files and notes
are removed on job completion. Forced runner termination relies on disposal of the
GitHub-hosted runner. Account secrets remain in GitHub until rotated or removed.

Setup references: [Google API access](https://developers.google.com/android-publisher/getting_started),
[manual GitHub workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow),
and the [upload action](https://github.com/r0adkll/upload-google-play).

Delve Deep UI Explorer v3
========================

Replace only tests/visual/ui-explorer.spec.js with the file supplied.
Keep your existing devBridge.js, gallery generator, and all existing reports.

From E:\Programming\DelveDeep in PowerShell:

$env:UI_EXPLORE_SCENES = 'AdventurersHallScene'
$env:UI_EXPLORE_ACTIONS = '1'
$env:UI_EXPLORE_MAX_ACTIONS = '4'
$env:UI_EXPLORE_START_AT = '0'
npm run test:visual -- ui-explorer.spec.js --workers=1

The new queue prioritizes tabs and informational actions over selecting every adventurer.
Run batches with UI_EXPLORE_START_AT of 4, 8, 12, etc. (these indices refer to the NEW v3 queue).

Afterward:
node scripts/build-ui-gallery.mjs
Start-Process output\qa\ui-explorer\index.html

The report at output/qa/ui-explorer/AdventurersHallScene/report.json now includes
v3Queue, attempts, and branches with controls discovered after each interaction.
Existing screenshots are retained. Exploration uses a fresh page per attempt.

CAUTION: These are screenshots of attempted interactions, not verified UI outcomes.
The tool does not reliably identify scrolling, Phaser masking, covered controls,
or all dynamic states. Keep using a disposable development save.

Production asset URLs
====================

GitHub Pages and Capacitor ship Vite's `dist/` output, not the source asset folders.
Reference runtime artwork, audio and video through explicit imports or a literal
`new URL(..., import.meta.url)` expression so Vite can include and rewrite them.
For filenames selected from data, use a template literal with a fixed directory:

```js
new URL(`../assets/effects/ranger/${name}-flight.png`, import.meta.url).href
```

Keep this expression in the module that defines the relative asset path. Do not
concatenate strings or pass a computed path variable to `new URL`; those forms
can work on the development server while leaving missing assets in production.
Use exact filename capitalization because GitHub Pages paths are case-sensitive.

## Playable class identities and selection sprites

Malrek is a Sanguinist, Selenne a Dawnpriest, Sylva a Grovekeeper, Nadira an
Arcanist, Valtheris a Spellbinder and Zareth an Umbramancer. These names are also
the keys used by class definitions, equipment restrictions and ability permissions.
Class-specific ability IDs use the corresponding lowercase name. Order and
institution names remain valid lore. Development saves using retired names are
unsupported; no aliases or migrations are provided.

`ui/SelectedCharacterIdle.js` shares selection-screen idle playback. Heroes,
Abilities and Equipment animate the selected adventurer; Party Select animates
selected party members; Delve Overview and the world-map character gallery animate
the chosen map representative. Unselected entries hold their first south-facing
idle frame. Scroll masks suspend offscreen playback. Destruction, scene suspension
and app visibility events release or suspend playback without changing combat.

See [character selection implementation](docs/CHARACTER_SELECTION.md) for details.
