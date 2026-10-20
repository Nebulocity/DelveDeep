import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { sourceInventory } from './source-inventory.js';
import { writeHandoff } from './handoff.js';

const root = path.resolve(process.env.DELVE_QA_REPORT_ROOT ?? 'output/qa/overnight-ui-audit');
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export default class AuditReporter {
  results = [];
  onTestEnd(test, result) {
    this.results.push({ title: test.title, project: test.parent.project()?.name, status: result.status,
      duration: result.duration, errors: result.errors.map(e => e.message),
      attachments: result.attachments.filter(a => a.path).map(a => ({ name: a.name, path: path.relative(root, a.path).replaceAll('\\', '/') })) });
    this.save('running');
  }
  onEnd(result) { this.save(result.status); }
  save(status) {
    mkdirSync(root, { recursive: true });
    const recordsDir = path.join(root, 'records');
    const records = existsSync(recordsDir) ? readdirSync(recordsDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(path.join(recordsDir, f), 'utf8'))) : [];
    for (const record of records) {
      const result = this.results.find(r => r.title === record.title && r.project === record.project);
      if (result) record.status = result.status;
    }
    const summary = { status, generatedAt: new Date().toISOString(), results: this.results };
    if (status !== 'running') writeHandoff(root, summary, records);
    writeFileSync(path.join(root, 'execution.json'), JSON.stringify(summary, null, 2));
    writeFileSync(path.join(root, 'inventory.json'), JSON.stringify(records.map(record => ({
      ...record, captures: record.captures.map(({ data, ...capture }) => ({ ...capture,
        controls: data.objects.length, inventory: capture.screenshot.replace(/\.png$/, '.json') }))
    })), null, 2));
    writeFileSync(path.join(root, 'source-inventory.json'), JSON.stringify(sourceInventory(), null, 2));
    const coverage = records.flatMap(record => record.captures.flatMap(capture => capture.data.objects.map(object => ({
      project: record.project, scene: capture.scene, state: capture.state, id: object.id, name: object.name, label: object.label,
      enabled: object.enabled, visible: object.visible, reachableProbes: object.probes?.filter(p => p.topmost).length ?? 0,
      clicked: records.filter(r => r.project === record.project).some(r => (r.interactions ?? []).some(action => action.scene === capture.scene && (action.label === object.name || action.label === object.label))),
      testStatus: record.status
    }))));
    writeFileSync(path.join(root, 'coverage.json'), JSON.stringify(coverage, null, 2));
    const cards = records.flatMap(record => record.captures.map(capture => `<article data-scene="${esc(capture.scene)}"><h3>${esc(capture.scene)} · ${esc(capture.state)}</h3><p>${esc(record.project)} · ${esc(record.status)} · ${capture.data.objects.length} controls</p><a href="${esc(capture.screenshot)}"><img loading="lazy" src="${esc(capture.screenshot)}"></a><p><a href="${esc(capture.screenshot.replace(/\.png$/, '.json'))}">Control inventory, geometry and warnings</a></p></article>`)).join('');
    writeFileSync(path.join(root, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Delve Deep UI audit</title><style>body{background:#14171c;color:#eee;font:16px system-ui;margin:24px}a{color:#ffd580}header{position:sticky;top:0;background:#14171c;padding:12px;z-index:1}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px}article{background:#242830;padding:16px}img{width:100%}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto}.failed,.timedOut{color:#ff8e88}td,th{padding:8px;text-align:left}</style><header><h1>Delve Deep UI audit</h1><p>Execution: ${esc(status)}. Screenshots require human visual approval. DPR is recorded; gallery captures use CSS resolution.</p><a href="execution.json">Execution JSON</a> · <a href="inventory.json">Full runtime inventory</a> · <a href="handoff.html">Findings and handoff</a><p><input placeholder="Filter scene or state" oninput="document.querySelectorAll('article').forEach(a=>a.hidden=!a.textContent.toLowerCase().includes(this.value.toLowerCase()))"></p></header><details><summary>Execution results</summary><table><tr><th>Project</th><th>Test</th><th>Status</th><th>Details</th></tr>${this.results.map(r => `<tr class="${esc(r.status)}"><td>${esc(r.project)}</td><td>${esc(r.title)}</td><td>${esc(r.status)}</td><td>${r.attachments.map(a => `<a href="${esc(a.path)}">${esc(a.name)}</a>`).join(' ')}<pre>${esc(r.errors.join('\n'))}</pre></td></tr>`).join('')}</table></details><main>${cards}</main>`);
  }
}
