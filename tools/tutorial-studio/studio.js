import { tutorialAudioCatalog } from '../../game/TutorialAudio.js';
import { dialoguePortraitCatalog } from '../../data/dialoguePortraitCatalog.js';
import { STORY_LOCATIONS, storyLocation, storyLocationLabel } from '../../data/storyLocations.js';
import { storyLines, STORY_ACTIONS, storyPointScene } from '../../game/StoryPresentation.js';
import { getDelveById } from '../../data/delves.js';
import { clonePresentation, validatePresentation, PRESENTATION_VALIDATOR_VERSION, TUTORIAL_AUTHORITY, NARRATIVE_TYPES, AUDIO_EVENTS, EXIT_ANCHORS } from '../../game/TutorialPresentation.js';

const $ = id => document.getElementById(id);
const element = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children); return node;
};
const button = (text, action, disabled = false) => element('button', { type: 'button', text, disabled, onclick: action });
const clone = x => structuredClone(x);
const firstSelection = document => document.steps.find(step => step.storyPointId === document.storyPoints?.[0]?.id)?.id ?? document.steps[0].id;
let doc = clonePresentation(), saved = clone(doc), baseline = clone(doc), revision, token, serverValidatorVersion, draftLoaded = false;
let selected = firstSelection(doc), undo = [], redo = [], portraits = dialoguePortraitCatalog(), audio = tutorialAudioCatalog().map(({ url, ...asset }) => asset), targets = [], ready = false, playing = false, picking = false, interactive = false;
let livePanelPlacement = null;
let pickerLocation = null;
const pointFor = step => doc.storyPoints?.find(point => point.id === step?.storyPointId);
const allLines = point => doc.steps.filter(step => step.storyPointId === point.id);
const selectStep = step => { playing = false; selected = step.id; render(); show(); };
const stage = (type, data = {}) => $('preview-frame').contentWindow.postMessage({ studio: true, type, ...data }, location.origin);
const current = () => doc.steps.find(s => s.id === selected) ?? doc.steps[0];
const status = message => { $('stage-status').textContent = message; };
const recoveryKey = 'delve-deep-tutorial-studio-unsaved';
function preserveUnsavedDraft() {
  if (!draftLoaded) return;
  try {
    if (JSON.stringify(doc) === JSON.stringify(saved)) sessionStorage.removeItem(recoveryKey);
    else sessionStorage.setItem(recoveryKey, JSON.stringify({ document: doc, selected, revision }));
  } catch {
    status('Unsaved recovery could not be stored. Use Export JSON to keep a copy before refreshing.');
  }
}
window.addEventListener('beforeunload', preserveUnsavedDraft);
window.addEventListener('pagehide', preserveUnsavedDraft);

function syncModalState() {
  const blocked = !!document.querySelector('dialog[open]');
  const frame = $('preview-frame');

  // Block the iframe itself even when its game startup or message handler failed.
  frame.inert = blocked || !ready;
  frame.style.pointerEvents = blocked || !ready ? 'none' : 'auto';
  stage('modal', { value: blocked });
}
function notice(message) { $('notice-text').textContent = message; $('notice').showModal(); syncModalState(); }
for (const dialog of document.querySelectorAll('dialog')) {
  new MutationObserver(syncModalState).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  dialog.addEventListener('close', syncModalState);
}
$('preview-frame').addEventListener('load', () => { ready = false; syncModalState(); stage('catalog-request'); });
syncModalState();
$('notice').querySelector('button').onclick = () => $('notice').close();
const issues = () => validatePresentation(doc, { portraits, audio, targets: targets.filter(t => t.available).map(t => t.id) });
function mutate(change, { refresh = true } = {}) {
  const before = clone(doc);
  const beforeSelection = selected;
  change();
  const changed = JSON.stringify(before) !== JSON.stringify(doc);
  if (changed) {
    undo.push(before); if (undo.length > 60) undo.shift(); redo = [];
  }
  if (!changed && beforeSelection === selected) return;
  preserveUnsavedDraft();
  if (refresh) render(); show();
}
function show(playAudio = false) {
  livePanelPlacement = null;
  if (!ready) return;
  stage('show', { step: { ...clone(current()), exitAnchor: doc.exitAnchor }, point: clone(pointFor(current()) ?? null), locationId: pointFor(current())?.locationId, playAudio, playing });
}
async function api(path, data) {
  if (['save', 'publish'].includes(path)) {
    preserveUnsavedDraft();
    if (serverValidatorVersion !== PRESENTATION_VALIDATOR_VERSION)
      throw new Error('The running Studio server uses an older validator. Export JSON to keep your dialogue, stop Studio with Ctrl+C, run npm run tutorial:studio again, then refresh. Import your exported JSON if your edits are not restored.');
  }
  const response = await fetch('/__studio/api/' + path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio-Token': token }, body: JSON.stringify(data) } : undefined);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error + (result.issues ? '\n' + result.issues.map(i => i.message).join('\n') : ''));
  return result;
}
function download(name, value, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = element('a', { href: url, download: name }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function formField(label, value, update, opts = {}) {
  const input = opts.options ? element('select', { disabled: opts.disabled }, opts.options.map(o => {
    const [id, name] = Array.isArray(o) ? o : [o, o];
    return element('option', { value: id, text: name, selected: value === id });
  })) : element(opts.area ? 'textarea' : 'input', { value, ...(opts.area ? {} : { type: opts.type ?? 'text' }), disabled: opts.disabled,
    ...(opts.min !== undefined ? { min: opts.min, max: opts.max, step: opts.step ?? 1 } : {}) });
  input.setAttribute('aria-label', label);
  input.addEventListener(opts.event ?? 'change', () => update(opts.type === 'number' || opts.type === 'range' ? Number(input.value) : input.value));
  return element('label', {}, [element('span', { text: label }), input]);
}
function portraitSlider(label, key, { min = -100, max = 100, increment = 1, reset = 0, multiplier = false } = {}) {
  const step = current();
  const input = element('input', { type: 'range', min, max, step: increment, value: step[key] ?? reset });
  input.setAttribute('aria-label', label);
  const format = number => multiplier ? `${number.toFixed(2)}×` : `${number > 0 ? '+' : ''}${number}%`;
  const value = element('output', { text: format(Number(input.value)) });
  let before = null;
  const update = next => {
    before ??= clone(doc);
    step[key] = next;
    input.value = next;
    value.textContent = format(next);
    preserveUnsavedDraft();

    // Keep the current scene and dialogue playing while adjusting the portrait.
    stage('portrait-adjust', { stepId: step.id, key, value: next });
  };
  const commit = () => {
    if (before && JSON.stringify(before) !== JSON.stringify(doc)) {
      undo.push(before); if (undo.length > 60) undo.shift(); redo = [];
      renderToolbar(); renderDiagnostics();
    }
    before = null;
  };
  input.addEventListener('input', () => update(Number(input.value)));
  input.addEventListener('change', commit);
  return element('div', { class: `portrait-slider${multiplier ? '' : ' portrait-offset'}` }, [
    element('label', {}, [element('span', { text: label }), input]),
    element('div', { class: 'row' }, [value, button(`Reset to ${reset}`, () => { update(reset); commit(); })])
  ]);
}
function addNarrative(copy = null) {
  const base = current();
  const placement = clone(livePanelPlacement?.stepId === base.id ? livePanelPlacement.value : base.placement);
  const beat = { ...clone(base), locked: false, id: 'narrative-' + crypto.randomUUID(), type: 'dialogue', label: 'New dialogue', text: '',
    enabled: true, speaker: '', portraitId: '', portraitSide: 'none', targetIds: [], audio: [], entry: 'after-previous', completion: 'continue', pause: 'none', ...copy, placement };
  mutate(() => { doc.steps.splice(doc.steps.indexOf(base) + 1, 0, beat); selected = beat.id; });
}
function move(offset) {
  const s = current(), point = pointFor(s);
  if (point) {
    const lines = allLines(point), other = lines[lines.indexOf(s) + offset];
    if (!other) return;
    mutate(() => { const a = doc.steps.indexOf(s), b = doc.steps.indexOf(other); [doc.steps[a], doc.steps[b]] = [doc.steps[b], doc.steps[a]]; }); return;
  }
  const index = doc.steps.indexOf(s), other = doc.steps[index + offset];
  if (s.locked || !other || other.locked || other.anchor !== s.anchor) return notice('Narrative beats can move only within their checkpoint segment. Gameplay milestones cannot be bypassed.');
  mutate(() => { doc.steps.splice(index, 1); doc.steps.splice(index + offset, 0, s); });
}
function demo() {
  mutate(() => {
    doc = clone(baseline); doc.title = 'Disposable sample: Tavern conversation and wry intro seed';
    const append = (checkpointId, properties) => {
      const base = doc.steps.find(s => s.lessonId === 'pineshire-first-adventure' && s.checkpointId === checkpointId);
      const end = doc.steps.findLastIndex(s => s.anchor === base.id);
      const s = { ...clone(base), locked: false, id: 'sample-' + crypto.randomUUID(), type: 'dialogue', enabled: true,
        text: '', speaker: '', portraitId: '', portraitSide: 'none', completion: 'continue', entry: 'after-previous', pause: 'none', targetIds: [], audio: [], ...properties };
      doc.steps.splice(end + 1, 0, s); return s;
    };
    for (const text of ['Pineshire has a problem.', 'The caves have monsters.', 'The Tavern has heroes.', 'Whether those heroes are any good is another matter.'])
      append('welcome', { label: 'Wry intro draft (disabled)', text, enabled: false, type: 'cinematic' });
    const bartender = append('hire-garrick', { label: 'Sample: Tiko speaks', speaker: 'Tiko', portraitId: 'tiko', portraitSide: 'left', portraitMode: 'talk',
      text: '[Sample placeholder] Introduce the Tavern and its willing adventurers.', targetIds: ['tavern-character-garrick'],
      audio: [{ assetId: 'music-town', kind: 'music', trigger: 'onEnter', event: '', delayMs: 0, durationMs: 5000, volume: .25, fadeMs: 300, replay: 'once-per-beat' }] });
    append('hire-garrick', { label: 'Sample: Garrick replies', speaker: 'Garrick', portraitId: 'garrick', portraitSide: 'right',
      text: '[Sample placeholder] Garrick replies. Replace this line with your own dialogue.', targetIds: ['tavern-hire'] });
    append('boss-interrupt', { label: 'Sample: live boss cue planning', type: 'hint', text: '[Sample placeholder] Boss landing has no supported cue event. Select combat.mechanic.warning for a genuine live warning; preview does not create a boss or complete this lesson.' });
    selected = bartender.id;
  });
}
function exportStoryboard(html = false) {
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ordered = [...(doc.storyPoints ?? []).flatMap(point => allLines(point)), ...doc.steps.filter(s => !s.storyPointId)];
  const lines = ordered.map(s => html ? `<article><h2>${escape(s.label)} ${s.locked ? '· checkpoint' : ''}</h2><p>${escape(s.chapter)} · ${escape(s.scene)} · ${s.enabled ? 'enabled' : 'disabled'}</p><p><b>${escape(s.speaker || 'Narrator')}</b> · portrait ${escape(s.portraitId || 'none')} / ${s.portraitSide}</p><p class="copy">${escape(s.text)}</p><p>Spotlight: ${escape(s.targetIds.join(', ') || 'none')}</p><p>Completion: ${escape(s.completion)}. ${s.locked ? escape(TUTORIAL_AUTHORITY.find(a => a.id === s.id)?.gate ?? '') : 'Narrative Continue only.'}</p><p>Audio: ${escape(s.audio.map(a => `${a.assetId} · ${a.trigger} +${a.delayMs}ms`).join('; ') || 'none')}</p></article>` :
    `## ${s.label}${s.locked ? ' [checkpoint]' : ''}\n${s.chapter} / ${s.scene} / ${s.enabled ? 'enabled' : 'disabled'}\n\n${s.speaker || 'Narrator'} (${s.portraitId || 'no art'}, ${s.portraitSide}):\n${s.text}\n\nSpotlight: ${s.targetIds.join(', ') || 'none'}\nCompletion: ${s.completion}; audio: ${s.audio.map(a => a.assetId + ' on ' + a.trigger).join(', ') || 'none'}\n`).join('\n');
  if (html) download('tutorial-storyboard.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(doc.title)}</title><style>body{max-width:760px;margin:auto;padding:18px;background:#121a24;color:#efe5d3;font:16px/1.5 system-ui}article{border:1px solid #9c7c44;padding:16px;margin:18px 0}h1,h2{color:#ffdb86}.copy{white-space:pre-wrap}</style><h1>${escape(doc.title)}</h1><p>Draft only. Exit preference: ${doc.exitAnchor}. No published narrative changes.</p>${lines}`, 'text/html');
  else download('tutorial-storyboard.md', `# ${doc.title}\nDraft only; Exit preference ${doc.exitAnchor}.\n\n${lines}`, 'text/markdown');
}
function renderToolbar() {
  preserveUnsavedDraft();
  $('draft-state').textContent = JSON.stringify(doc) === JSON.stringify(saved) ? 'Draft matches saved copy · public narrative unchanged' : 'Unsaved draft changes';
  $('toolbar').replaceChildren(
    button('Undo', () => { redo.push(clone(doc)); doc = undo.pop(); selected = current().id; render(); show(); }, !undo.length),
    button('Redo', () => { undo.push(clone(doc)); doc = redo.pop(); selected = current().id; render(); show(); }, !redo.length),
    button('Revert', () => mutate(() => { doc = clone(saved); selected = firstSelection(doc); })),
    button('Save draft', async () => { try { const r = await api('save', { document: doc, revision }); revision = r.revision; saved = clone(doc); render(); status('Draft saved atomically with backup. The public tutorial is unchanged.'); } catch (e) { notice(e.message); } }),
    button('Apply to game', async () => { try { const r = await api('publish', { document: doc, revision }); revision = r.revision; saved = clone(doc); render(); status('Applied to game. Restart the game to load the updated story.'); } catch (e) { notice(e.message); } }),
    button('Validate', () => { $('diagnostics').parentElement.open = true; renderDiagnostics(); }),
    button('Import JSON', () => $('import-json').click()), button('Export JSON', () => download('tutorial-draft.json', JSON.stringify(doc, null, 2))),
    button('Storyboard', () => exportStoryboard(true)), button('Markdown', () => exportStoryboard(false)),
    button('Restore backup', async () => { try { const r = await api('restore-backup', {}); mutate(() => { doc = r.draft; saved = clone(doc); revision = r.revision; selected = firstSelection(doc); }); } catch (e) { notice(e.message); } })
  );
}
function renderLocationPicker(id = null) {
  pickerLocation = id;
  const location = storyLocation(id);
  $('location-path').replaceChildren(button('All locations', () => renderLocationPicker()),
    ...(location ? [element('p', { text: storyLocationLabel(id) })] : []));
  $('location-choices').replaceChildren(...STORY_LOCATIONS.filter(item => item.parentId === id).map(item =>
    button(item.label, () => renderLocationPicker(item.id))));
  $('location-add').disabled = !location;
}
$('add-story').onclick = () => { renderLocationPicker(); $('location-picker').showModal(); };
$('location-cancel').onclick = () => $('location-picker').close();
$('location-add').onclick = () => {
  const location = storyLocation(pickerLocation), base = current();
  if (!location) return;
  const placement = clone(livePanelPlacement?.value ?? base.placement);
  mutate(() => {
    doc.storyPoints ??= [];
    const point = { id: 'story-' + crypto.randomUUID(), label: storyLocationLabel(location.id), locationId: location.id,
      trigger: doc.storyPoints.length ? 'after-previous' : 'intro', exitFadeMs: 0, enabled: true };
    doc.storyPoints.push(point);
    const line = { ...clone(base), id: 'narrative-' + crypto.randomUUID(), storyPointId: point.id, anchor: point.id,
      lessonId: 'story', checkpointId: point.id, locked: false, label: 'New dialogue', chapter: point.label, scene: location.scene,
      type: 'dialogue', text: '', speaker: '', portraitId: '', portraitSide: 'none', targetIds: [], audio: [],
      enabled: true, entry: 'after-previous', completion: 'continue', pause: 'none', placement };
    doc.steps.push(line); selected = line.id;
  });
  $('location-picker').close();
};
function renderTimeline() {
  const filter = $('timeline-search').value.toLowerCase(), warnings = issues();
  const container = $('steps'); container.replaceChildren();
  const points = doc.storyPoints ?? [];
  const groups = [['Chronological', points], ['Region', points.filter(p => storyLocation(p.locationId)?.kind === 'region')],
    ['Town', points.filter(p => ['town', 'interior'].includes(storyLocation(p.locationId)?.kind))],
    ...STORY_LOCATIONS.filter(l => l.kind === 'delve').map(l => [l.label, points.filter(p => p.locationId === l.id)])];
  const lineButton = s => {
    const b = button(s.label, () => selectStep(s));
    b.className = 'step' + (s.id === selected ? ' active' : '') + (warnings.some(i => i.id === s.id) ? ' warning' : '');
    b.append(element('small', { text: s.locked ? 'Gameplay checkpoint' : s.enabled ? 'Dialogue' : 'Disabled dialogue' }));
    return b;
  };
  for (const [label, entries] of groups) {
    const section = element('details', { open: true }, [element('summary', { text: label })]);
    for (const point of entries) {
      const lines = allLines(point);
      if (![point.label, storyLocationLabel(point.locationId), ...lines.map(s => s.text + s.label)].some(t => t.toLowerCase().includes(filter))) continue;
      section.append(element('h3', { text: point.label + (point.enabled ? '' : ' (disabled)') }), ...lines.map(lineButton));
    }
    if (!entries.length) section.append(element('p', { class: 'hint', text: 'No story points yet.' }));
    container.append(section);
  }
  const gameplay = element('details', {}, [element('summary', { text: 'Tutorial gameplay checkpoints' })]);
  for (const s of doc.steps.filter(s => !s.storyPointId)) {
    if ([s.label, s.chapter, s.id].some(t => t.toLowerCase().includes(filter))) gameplay.append(lineButton(s));
  }
  container.append(gameplay);
}
function renderProperties() {
  const s = current(), form = $('properties'); form.replaceChildren();
  const change = key => value => mutate(() => { current()[key] = value; });
  const point = pointFor(s);
  if (point) {
    const editPoint = key => value => mutate(() => { point[key] = value; });
    const location = storyLocation(point.locationId);
    const delve = location?.kind === 'delve' ? getDelveById(location.delveId) : null;
    const syncPointScene = () => { for (const line of allLines(point)) line.scene = storyPointScene(point); };
    form.append(element('h2', { text: 'Story point' }),
      formField('Story point label', point.label, editPoint('label')),
      formField('Location', point.locationId, value => mutate(() => {
        point.locationId = value;
        if (point.trigger === 'wave-start' && storyLocation(value)?.kind !== 'delve') { point.trigger = 'scene-enter'; delete point.wave; }
        syncPointScene();
      }), { options: STORY_LOCATIONS.map(l => [l.id, storyLocationLabel(l.id)]) }),
      formField('Play when', point.trigger, value => mutate(() => {
        point.trigger = value;
        if (value === 'wave-start') { point.wave ??= 1; point.exitFadeMs = 0; }
        else delete point.wave;
        syncPointScene();
      }), { options: [['intro', 'Intro, before tutorial'], ['scene-enter', 'Player enters this location'], ['after-previous', 'Previous story point finishes'], ...(delve ? [['wave-start', 'Wave starts, after all enemies land']] : [])] }),
      ...(point.trigger === 'wave-start' ? [formField('Wave number', point.wave, editPoint('wave'), { type: 'number', min: 1, max: delve?.rooms ?? 100 }),
        element('p', { class: 'hint', text: 'Waits for this wave in a real battle, including queued enemies and landing animations. Pauses for all dialogue in this point, then resumes. Preview uses normal battle entry without skipping waves. Refresh Studio for a fresh disposable run if the wave has already passed. Use one point per wave; boss windup timing is separate.' })] : []),
      formField('Scene Exit', point.exitFadeMs, value => editPoint('exitFadeMs')(Number(value)), { disabled: point.trigger === 'wave-start', options: [[0, 'Immediate'], [500, '0.5s fade'], [1000, '1s fade'], [1500, '1.5s fade']] }),
      formField('Story point enabled', point.enabled ? 'yes' : 'no', v => editPoint('enabled')(v === 'yes'), { options: ['yes', 'no'] }),
      element('div', { class: 'row' }, [-1, 1].map(offset => button(offset < 0 ? 'Earlier point' : 'Later point', () => mutate(() => { const index = doc.storyPoints.indexOf(point), other = index + offset; if (other >= 0 && other < doc.storyPoints.length) [doc.storyPoints[index], doc.storyPoints[other]] = [doc.storyPoints[other], point]; })))),
      button('Delete story point', () => mutate(() => { doc.steps = doc.steps.filter(line => line.storyPointId !== point.id); doc.storyPoints.splice(doc.storyPoints.indexOf(point), 1); selected = doc.steps.find(line => line.storyPointId)?.id ?? doc.steps[0].id; })));
  }
  form.append(element('p', { text: s.id, class: 'hint' }),
    element('div', { class: 'row' }, [button('Add dialogue', () => addNarrative()), button('Duplicate', () => addNarrative({ ...clone(s), id: 'narrative-' + crypto.randomUUID(), locked: false, completion: 'continue', pause: 'none', entry: 'after-previous', type: 'dialogue', targetIds: [], label: s.label + ' copy' })),
      button('Delete', () => mutate(() => { doc.steps.splice(doc.steps.indexOf(s), 1); selected = point ? allLines(point)[0]?.id ?? doc.steps[0].id : s.anchor; }), s.locked || !!point && allLines(point).length === 1), button('↑', () => move(-1), s.locked), button('↓', () => move(1), s.locked)]),
    formField('Editor label', s.label, change('label')),
    formField('Chapter label', s.chapter, change('chapter')),
    formField('Step type', s.type, change('type'), { options: s.locked ? [s.type] : NARRATIVE_TYPES, disabled: s.locked }),
    formField('Enabled', s.enabled ? 'yes' : 'no', v => change('enabled')(v === 'yes'), { options: ['yes', 'no'], disabled: s.locked }),
    ...(point ? [formField('Advance when', s.completion, change('completion'), { options: [['continue', 'Tap dialogue'], ...Object.entries(STORY_ACTIONS).filter(([, action]) => !action.scene || action.scene === s.scene).map(([id, action]) => [id, action.label])] })] : []),
    formField('Dialogue / guidance', s.text, change('text'), { area: true }), formField('Speaker name', s.speaker, change('speaker')),
    formField('Find portrait', '', value => filterPortraits(value), { event: 'input' }),
    element('p', { class: 'hint', text: 'Search by name, then select a portrait from the library below. Selecting one makes it visible on the left unless you already chose a side.' }),
    button('Import portrait', () => { $('portrait-name').value = s.speaker || ''; $('portrait-import-status').textContent = ''; $('portrait-import').showModal(); }),
    formField('Portrait library', s.portraitId, value => mutate(() => { s.portraitId = value; if (value && s.portraitSide === 'none') s.portraitSide = 'left'; }), { options: [['', 'No portrait'], ...portraits.map(p => [p.id, p.label + (p.available ? '' : ' · unavailable')])] }),
    formField('Portrait side', s.portraitSide, change('portraitSide'), { options: ['none', 'left', 'right'] }),
    formField('Portrait playback', s.portraitMode, change('portraitMode'), { options: [['idle', 'Idle loop'], ['portrait', 'Still portrait'], ['talk', 'Speak 3 seconds, then idle'], ['special', 'Special clip, then idle']] }),
    portraitSlider('Scale (cropped within portrait slot)', 'portraitScale', { min: .5, max: 1.5, increment: .01, reset: 1, multiplier: true }),
    portraitSlider('Portrait frame size', 'portraitFrameScale', { min: .8, max: 1.25, increment: .01, reset: 1.1, multiplier: true }),
    portraitSlider('Portrait horizontal offset (%)', 'portraitOffsetX'),
    portraitSlider('Portrait vertical offset (%)', 'portraitOffsetY'),
    element('p', { class: 'hint', text: 'Frame size defaults to 1.1 (10% larger). Offsets move the artwork inside the frame: positive moves right/down; negative moves left/up. Zero centers it. Zoom with Scale if moving reveals empty space.' }),
    formField('Crop preference', s.crop, change('crop'), { options: ['contain', 'cover'] }),
    formField('Ornate panel', s.preset, change('preset'), { options: ['compact', 'wide'] }),
    formField('Panel placement preference', s.placement.anchor, value => mutate(() => { s.placement = { anchor: value, ...(value === 'preferred' ? { x: .5, y: .7 } : {}) }; }), { options: ['auto', ...EXIT_ANCHORS, 'preferred'] }),
    element('p', { class: 'hint', text: 'Add dialogue and Duplicate inherit this window’s displayed position. New story points inherit this position too. Placement can adjust to protect controls.' }),
    formField('External Exit button position', doc.exitAnchor, value => mutate(() => { doc.exitAnchor = value; }), { options: EXIT_ANCHORS }),
    formField('Dim strength', s.dimming, change('dimming'), { type: 'number', min: 0, max: .8, step: .05 }),
    formField('Fade ms', s.fadeMs, change('fadeMs'), { type: 'number', min: 0, max: 500, step: 10 }),
    formField('Entrance easing', s.easing, change('easing'), { options: ['sine', 'linear'] }),
    formField('Emphasis', s.emphasis, change('emphasis'), { options: ['normal', 'gold'] }),
    formField('Pause policy', s.pause, change('pause'), { disabled: s.locked || point?.trigger === 'wave-start', options: point?.trigger === 'wave-start' ? [[s.pause, 'Automatic: pause for this wave lesson']] : s.locked ? [s.pause] : ['none', 'narrative'] }),
    formField('Entry condition', s.entry, change('entry'), { disabled: s.locked || !!point, options: ['scene-ready', 'after-previous', ...AUDIO_EVENTS.map(e => 'event:' + e)] }),
    element('p', { class: 'hint', text: s.locked ? 'Gameplay authority, target grants, checkpoint order and pause ownership stay locked. Add narrative beats within this segment to change the storytelling.' : s.completion === 'continue' ? 'Tap the dialogue to advance.' : s.completion === 'click-spotlight' ? 'Pick a spotlight control below. Tapping any highlighted control performs its normal action and advances; dialogue taps do nothing. Decorative artwork cannot advance. Exit Tutorial remains available.' : 'Waits for the real hire and confirmation. Exit Tutorial remains available.' }),
    element('pre', { text: s.locked ? TUTORIAL_AUTHORITY.find(a => a.id === s.id)?.gate : s.completion === 'continue' ? 'Completion: tap dialogue' : 'Completion: ' + (STORY_ACTIONS[s.completion]?.label ?? s.completion) }),
    formField('Spotlight semantic IDs (comma separated)', s.targetIds.join(', '), v => change('targetIds')(v.split(',').map(t => t.trim()).filter(Boolean)), { disabled: s.locked }),
    button('Clear spotlight', () => change('targetIds')([]), s.locked)
  );
  for (const select of form.querySelectorAll('select')) if ([...select.options].some(o => o.text === 'No portrait')) select.dataset.portrait = '';
  const portraitResults = element('p', { class: 'hint', role: 'status' });
  form.querySelector('[data-portrait]').parentElement.after(portraitResults);
  function filterPortraits(value = '') {
    const query = value.trim().toLowerCase();
    const matches = portraits.filter(portrait => (portrait.label + ' ' + portrait.id).toLowerCase().includes(query));
    const select = form.querySelector('[data-portrait]');
    select.replaceChildren(element('option', { value: '', text: 'No portrait', selected: !s.portraitId }),
      ...matches.map(portrait => element('option', { value: portrait.id, selected: s.portraitId === portrait.id,
        text: portrait.label + (portrait.available ? '' : ' (preview artwork not loaded)') })));
    portraitResults.textContent = matches.length
      ? `${matches.length} portrait${matches.length === 1 ? '' : 's'} found. Select one from Portrait library.`
      : 'No matching portraits. Clear the search to see all registered artwork.';
  }
  filterPortraits();
  const fieldset = element('fieldset', {}, [element('legend', { text: 'Audio timeline' }),
    formField('Search audio library', '', value => { for (const option of form.querySelectorAll('[data-audio] option')) option.hidden = !option.text.toLowerCase().includes(value.toLowerCase()); }),
    element('div', { class: 'row' }, [button('Add cue', () => mutate(() => s.audio.push({ assetId: 'music-town', kind: 'music', trigger: 'onEnter', event: '', delayMs: 0, durationMs: 5000, volume: .4, fadeMs: 0, replay: 'once-per-beat' }))),
      button('Stop audio', () => stage('stop-audio')), button('Mute preview', () => stage('mute', { value: true })), button('Unmute preview', () => stage('mute', { value: false })), button('Import audio', () => $('import-audio').click())])]);
  s.audio.forEach((cue, index) => {
    const edit = key => value => mutate(() => { cue[key] = value; });
    const box = element('div', { class: 'cue' }, [formField('Registry audio asset', cue.assetId, edit('assetId'), { options: audio.map(a => [a.id, a.id + (a.available ? '' : ' · unavailable')]) }),
      formField('Cue type', cue.kind, edit('kind'), { options: ['sfx', 'ambience', 'music', 'voice'] }),
      formField('Trigger', cue.trigger, edit('trigger'), { options: ['onEnter', 'onAdvance', 'onLeave', 'afterMs', 'event'] }),
      formField('Real event', cue.event, edit('event'), { options: [['', 'Choose an event'], ...AUDIO_EVENTS, ['boss.landed', 'boss.landed · UNSUPPORTED']] }),
      formField('Delay ms', cue.delayMs, edit('delayMs'), { type: 'number', min: 0, max: 30000 }),
      formField('Max duration ms', cue.durationMs, edit('durationMs'), { type: 'number', min: 50, max: 120000 }),
      formField('Volume', cue.volume, edit('volume'), { type: 'number', min: 0, max: 1, step: .05 }),
      formField('Fade ms', cue.fadeMs, edit('fadeMs'), { type: 'number', min: 0, max: 3000 }),
      formField('Replay', cue.replay, edit('replay'), { options: ['once-per-beat', 'each-preview'] }),
      element('div', { class: 'row' }, [button('Play audio', () => stage('play-audio', { cue })), button('Remove cue', () => mutate(() => s.audio.splice(index, 1)))])]);
    box.querySelector('select').dataset.audio = ''; fieldset.append(box);
  });
  form.append(fieldset);
}
function renderTargets() {
  const filter = $('target-search').value.toLowerCase(); $('targets').replaceChildren(...targets.filter(t => t.id.toLowerCase().includes(filter)).map(t => {
    const b = button(t.id + (t.available ? '' : ' · unavailable'), () => {
      if (!t.available) return notice(t.reason);
      if (current().locked) return notice('This checkpoint has source-owned target grants. Add a narrative beat to choose another spotlight.');
      picking = false; stage('pick', { value: false }); $('pick').textContent = 'Pick spotlight target';
      mutate(() => { current().targetIds = [t.id]; });
    }); b.className = t.available ? '' : 'unavailable'; b.title = `${t.reason}${t.bounds ? '\n' + JSON.stringify(t.bounds) : ''}`; return b;
  }));
}
function renderDiagnostics() {
  const result = issues(); $('diagnostics').textContent = result.length ? result.map(i => `${i.level.toUpperCase()} ${i.id ?? ''}: ${i.message}`).join('\n') : 'Valid draft. Gameplay gates are unchanged. No missing assets referenced.';
  const storyChanges = JSON.stringify(doc.storyPoints ?? []) === JSON.stringify(saved.storyPoints ?? []) ? [] : ['Story point locations, order, triggers or scene exits changed.'];
  $('diff').textContent = storyChanges.concat(doc.steps.map(s => {
    const before = saved.steps.find(b => b.id === s.id);
    if (!before) return '+ ' + s.label + '\n' + s.text;
    const changed = Object.keys(s).filter(k => JSON.stringify(s[k]) !== JSON.stringify(before[k]));
    return changed.length ? '~ ' + s.label + ': ' + changed.join(', ') + (changed.includes('text') ? '\n- ' + before.text + '\n+ ' + s.text : '') : '';
  }).filter(Boolean)).concat(saved.steps.filter(s => !doc.steps.some(b => b.id === s.id)).map(s => '- ' + s.label)).join('\n\n') || 'No unsaved changes.';
}
function renderVariants() {
  $('variants').replaceChildren(...doc.variants.map((v, index) => formField(v.id + (v.editable ? '' : ' · system-generated template'), v.text,
    text => mutate(() => { doc.variants[index].text = text; }), { area: true, disabled: !v.editable })));
}
function render() { renderToolbar(); renderTimeline(); renderProperties(); renderTargets(); renderDiagnostics(); renderVariants(); }
$('timeline-search').oninput = renderTimeline; $('target-search').oninput = renderTargets;
$('properties').onsubmit = event => event.preventDefault();
$('portrait-cancel').onclick = () => $('portrait-import').close();
$('portrait-import-form').onsubmit = async event => {
  event.preventDefault();
  const submit = event.submitter, dialog = $('portrait-import');
  const stepId = current().id;
  try {
    const file = $('portrait-file').files[0], label = $('portrait-name').value.trim();
    if (!label || !file || file.type !== 'image/png' || file.size > 4000000) throw new Error('Enter a speaker name and choose a PNG under 4 MB.');
    submit.disabled = true; $('portrait-cancel').disabled = true;
    $('portrait-import-status').textContent = 'Importing portrait…';
    const image = await createImageBitmap(file);
    const validSize = image.width === image.height && image.width >= 32 && image.width <= 1024;
    image.close();
    if (!validSize) throw new Error('Choose a square portrait from 32 to 1024 pixels per side.');
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await api('import-portrait', { label, filename: file.name, mime: file.type, base64 });
    mutate(() => {
      const target = doc.steps.find(s => s.id === stepId);
      if (!target) return;
      target.portraitId = result.id; target.speaker = result.label; target.portraitMode = 'portrait';
      if (target.portraitSide === 'none') target.portraitSide = 'left';
    });
    dialog.close(); $('portrait-file').value = '';
    playing = false; ready = false; $('preview-frame').contentWindow.location.reload();
  } catch (error) { $('portrait-import-status').textContent = error.message; }
  finally { submit.disabled = false; $('portrait-cancel').disabled = false; }
};
$('sample').onclick = demo;
$('pick').onclick = () => { if (current().locked) return notice('Add a narrative beat first; this checkpoint target is locked to gameplay authority.'); picking = !picking; stage('pick', { value: picking }); $('pick').textContent = picking ? 'Click a real scene control…' : 'Pick spotlight target'; };
$('interact').onclick = () => { interactive = !interactive; stage('interact', { value: interactive }); $('interact').textContent = 'Interact with scene: ' + (interactive ? 'On' : 'Off'); };
$('preview').onclick = () => { if (!ready) return notice('The live preview is not ready yet. Check the status below the scene for loading errors. Your dialogue draft is kept.'); const errors = issues().filter(i => i.level === 'error'); if (errors.length) return notice(errors.map(i => i.message).join('\n')); playing = true; show(true); };
$('stop').onclick = () => { playing = false; stage('stop'); status('Preview stopped. Draft and game progress outside Studio are unchanged.'); };
$('import-json').onchange = async event => { try { const file = event.target.files[0]; if (!file || file.size > 1200000) throw new Error('Choose a JSON draft under 1.2 MB.'); const value = JSON.parse(await file.text()); const errors = validatePresentation(value, { portraits, audio }).filter(i => i.level === 'error'); if (errors.length) throw new Error(errors.map(i => i.message).join('\n')); mutate(() => { doc = value; selected = firstSelection(doc); }); } catch (e) { notice(e.message); } event.target.value = ''; };
$('import-audio').onchange = async event => { try {
  const file = event.target.files[0]; if (!file) return; if (file.size > 8000000) throw new Error('Audio must be under 8 MB.');
  const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
  const response = await api('import-audio', { filename: file.name, mime: file.type, kind: 'voice', base64: data }); notice(response.message); playing = false; ready = false; $('preview-frame').contentWindow.location.reload();
} catch (e) { notice(e.message); } event.target.value = ''; };
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== $('preview-frame').contentWindow || !event.data?.studio) return;
  const data = event.data;
  if (data.type === 'ready') { ready = true; portraits = [...new Map([...dialoguePortraitCatalog(), ...(data.portraits ?? [])].map(portrait => [portrait.id, portrait])).values()]; audio = [...new Map([...tutorialAudioCatalog().map(({ url, ...asset }) => asset), ...(data.audio ?? [])].map(asset => [asset.id, asset])).values()]; syncModalState(); render(); show(); }
  if (data.type === 'targets') { targets = data.targets; renderTargets(); renderDiagnostics(); }
  if (data.type === 'status') status(data.message);
  if (data.type === 'preview-error') { ready = false; playing = false; syncModalState(); status('Preview failed: ' + data.message); }
  if (data.type === 'layout' && data.stepId === current().id) {
    livePanelPlacement = data.resolvedPreference ? { stepId: data.stepId, value: data.resolvedPreference } : null;
    status(`${data.message} ${data.missing.length ? 'Unavailable targets: ' + data.missing.join(', ') : ''} Exit: ${Math.round(data.exit.x)}, ${Math.round(data.exit.y)}.`);
  }
  if (data.type === 'picked') { picking = false; stage('pick', { value: false }); $('pick').textContent = 'Pick spotlight target'; mutate(() => { current().targetIds = [data.target.id]; }); status('Assigned ' + data.target.id + ' at live bounds ' + JSON.stringify(data.target.bounds)); }
  if (data.type === 'placement' && data.stepId === current().id) mutate(() => { current().placement = data.placement; });
  if (data.type === 'stopped') { playing = false; status('Exited preview. No gameplay tutorial was skipped.'); }
  if (data.type === 'advance') {
    const point = pointFor(current());
    const lines = point ? storyLines(doc, point) : doc.steps.filter(s => s.anchor === current().anchor && s.enabled && !s.locked);
    const index = lines.indexOf(current());
    let next = lines[index + 1];
    if (!next && point) { const nextPoint = doc.storyPoints.slice(doc.storyPoints.indexOf(point) + 1).find(p => p.enabled && storyLines(doc, p).length); if (nextPoint?.trigger === 'after-previous' || playing && nextPoint?.trigger === 'wave-start') next = storyLines(doc, nextPoint)[0]; }
    if (index < 0 && !point) next = lines[0];
    if (playing && next) { const fadeMs = point && next.storyPointId !== point.id ? point.exitFadeMs : 0; stage('transition', { fadeMs, next: { ...clone(next), exitAnchor: doc.exitAnchor }, point: clone(pointFor(next) ?? null), locationId: pointFor(next)?.locationId }); selected = next.id; render(); }
    else if (next) { selected = next.id; render(); show(false); }
    else { playing = false; stage('finish', { fadeMs: point?.exitFadeMs ?? 0 }); status('End of this sequence. Gameplay checkpoints require their real actions.'); }
  }
});
function fit() {
  const [width, height] = $('viewport').value.split(',').map(Number);
  const available = $('stage').clientWidth, zoom = $('preview-zoom').value;
  const scale = zoom === 'fit' ? Math.min(1, available / width) : Number(zoom);

  // Keep full-size previews scrollable instead of shrinking them back to the column.
  $('stage').style.height = Math.min(height * scale + 20, Math.max(360, window.innerHeight * .72)) + 'px';
  Object.assign($('preview-surface').style, { width: width * scale + 'px', height: height * scale + 'px' });
  Object.assign($('preview-frame').style, { width: width + 'px', height: height + 'px', transform: `scale(${scale})` });
}
$('viewport').onchange = () => { $('stage').scrollTo(0, 0); fit(); };
$('preview-zoom').onchange = fit;
window.addEventListener('resize', fit);
new ResizeObserver(fit).observe($('stage')); fit();
try {
  const data = await api('bootstrap');
  token = data.token; revision = data.revision; serverValidatorVersion = data.validatorVersion;
  doc = data.draft; baseline = data.baseline; saved = clone(doc); selected = firstSelection(doc);
  let recovered = false;
  try {
    const snapshot = JSON.parse(sessionStorage.getItem(recoveryKey) ?? 'null');
    if (snapshot?.revision === revision && snapshot.document?.schemaVersion === doc.schemaVersion) {
      doc = snapshot.document; selected = snapshot.selected; recovered = true;
    }
  } catch {
    // Leave the saved draft accessible if tab recovery cannot be read.
  }
  draftLoaded = true;
  render(); show(); stage('catalog-request');
  if (serverValidatorVersion !== PRESENTATION_VALIDATOR_VERSION)
    status('Studio server needs restarting before saving. Export JSON first, then Ctrl+C and npm run tutorial:studio.');
  else if (recovered) status('Restored unsaved dialogue from this tab. Save draft when ready.');
}
catch (e) { notice(e.message); }

// A compact read-only inspection hook supports the scoped authoring acceptance checks.
window.tutorialStudio = { get document() { return clone(doc); }, get selection() { return selected; }, get ready() { return ready; }, get targets() { return clone(targets); } };
