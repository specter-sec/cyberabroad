import { CURRENCIES, addComparison, deadlineStatus, escapeHTML as e, filterPrograms, parseStoredIds, programsToCSV, researchDateRange, safeURL, sortPrograms, storeIds } from './core.mjs';

const $ = (s) => document.querySelector(s);
const els = { grid: $('#programs'), status: $('#live-status'), results: $('#result-count'), countries: $('#country'), currency: $('#currency'), compareDialog: $('#compare-dialog'), detailDialog: $('#detail-dialog'), compareTable: $('#compare-content'), detailContent: $('#detail-content') };
let programs = [], shortlist = [], comparisons = [];
let storage = null;
try { storage = window.localStorage; } catch { /* private browsing can deny access */ }
const getItem = (key) => { try { return storage?.getItem(key); } catch { return null; } };
const setItem = (key, value) => { try { storage?.setItem(key, value); } catch { /* graceful degradation */ } };
const today = new Date();
const dateISO = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);

function link(url, label, extra = '') {
  const safe = safeURL(url);
  return safe ? `<a href="${e(safe)}" target="_blank" rel="noopener noreferrer" ${extra}>${e(label)}</a>` : e(label);
}
function money(fee) {
  if (!fee || fee.amount == null) return 'Unknown';
  try { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(fee.amount)} ${fee.currency}`; }
  catch { return `${fee.amount} ${fee.currency ?? ''}`; }
}
function deadline(p) {
  const d = p.deadline ?? {};
  const s = deadlineStatus(d.date);
  return `<span class="deadline ${e(s.kind)}">${e(s.label)}</span><span class="micro">${e(d.cycle || 'Cycle not specified')}</span>`;
}
function card(p) {
  const saved = shortlist.includes(p.id), compared = comparisons.includes(p.id), fee = p.annual_tuition ?? {};
  return `<article class="program-card">
    <div class="card-top"><span class="eyebrow">${e(p.country)} <i>·</i> ${e(p.degree)}</span><button class="save-button ${saved ? 'saved' : ''}" type="button" data-save="${e(p.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Add'} ${e(p.university)} to shortlist">${saved ? 'Saved' : '＋ Shortlist'}</button></div>
    <h2>${e(p.university)}</h2><p class="program-name">${e(p.program)}</p>
    <div class="card-facts"><div><span class="fact-label">Annual tuition</span><strong>${e(money(fee))}</strong><span class="micro">${e(fee.fee_year || 'Fee year unknown')} · ${e(fee.basis || 'basis unknown').replaceAll('_',' ')}</span></div><div><span class="fact-label">Deadline</span>${deadline(p)}</div></div>
    <div class="card-meta"><span>IELTS overall <b>${p.language?.ielts_overall == null ? 'Unknown' : e(p.language.ielts_overall)}</b></span><span>${p.scholarships?.length ? `${p.scholarships.length} named funding ${p.scholarships.length === 1 ? 'opportunity' : 'opportunities'}` : 'No named scholarship listed'}</span></div>
    <div class="card-bottom"><label class="compare-check"><input type="checkbox" data-compare="${e(p.id)}" ${compared ? 'checked' : ''} aria-label="Compare ${e(p.university)}"> Compare</label><button class="text-button" data-detail="${e(p.id)}" type="button">Research details <span aria-hidden="true">↗</span></button></div>
  </article>`;
}
function compareCell(label, p) {
  if (label === 'Official program') return link(p.program_url, 'Official program page');
  if (label !== 'Research sources') {
    const safe = safeURL(label === 'Tuition source' ? p.annual_tuition?.source_url : label === 'Deadline source' ? p.deadline?.source_url : label === 'Language source' ? p.language?.source_url : label === 'GRE source' ? p.gre?.source_url : null);
    if (safe) return link(safe, 'Open source');
    const value = label === 'Tuition source' || label === 'Deadline source' || label === 'Language source' || label === 'GRE source' ? null : ({
      'University': p.university, 'Country': p.country, 'Program & degree': `${p.program} · ${p.degree}`,
      'Annual tuition': `${money(p.annual_tuition)} · ${p.annual_tuition?.fee_year || 'year unknown'} · ${(p.annual_tuition?.basis || 'unknown').replaceAll('_',' ')}`,
      'Tuition notes': p.annual_tuition?.notes, 'Deadline / cycle': `${p.deadline?.date || 'No verified date'} · ${p.deadline?.cycle || ''} · ${p.deadline?.notes || ''}`,
      'IELTS overall & notes': `${p.language?.ielts_overall ?? 'Unknown'} · ${p.language?.notes || ''}`,
      'Scholarships & eligibility': `${(p.scholarships || []).map(s => `${s.name}: ${s.eligibility}`).join('\n') || 'None listed'}\n${p.scholarships_note || ''}`,
      'Required documents': (p.required_documents || []).join('\n'), 'GRE': `${p.gre?.status || 'unknown'} · ${p.gre?.notes || ''}`,
      'Verification notes': p.verification_notes, 'Last verified': p.last_verified
    })[label];
    return e(value ?? 'Not stated').split('\n').join('<br>');
  }
  const refs = [
    ...(p.sources || []).map(s => [s.title, s.url, (s.fields || []).join(', ')]),
    ['Tuition', p.annual_tuition?.source_url, 'tuition'], ['Deadline', p.deadline?.source_url, 'deadline'],
    ['Language', p.language?.source_url, 'language'], ['GRE', p.gre?.source_url, 'gre'],
    ...(p.scholarships || []).map(s => [s.name, s.url, 'scholarship'])
  ];
  const seen = new Set();
  const items = refs.filter(([, url]) => { const safe = safeURL(url); if (!safe || seen.has(safe)) return false; seen.add(safe); return true; });
  return items.length ? `<ul>${items.map(([title, url, fields]) => `<li>${link(url, title)} <span class="micro">· ${e(fields || '')}</span></li>`).join('')}</ul>` : 'No sources listed.';
}
function render() {
  const filters = { search: $('#search').value, country: $('#country').value, degree: $('#degree').value, scholarshipsOnly: $('#scholarships-only').checked, shortlistOnly: $('#shortlist-only').checked, shortlistedIds: shortlist, currency: $('#currency').value, maxBudget: $('#max-budget').value, ielts: $('#ielts-max').value };
  const result = sortPrograms(filterPrograms(programs, filters), $('#sort').value);
  els.results.textContent = `${result.length} ${result.length === 1 ? 'program' : 'programs'}`;
  els.grid.innerHTML = result.length ? result.map(card).join('') : '<div class="empty-state"><span class="eyebrow">No matches</span><h2>Try widening your search.</h2><p>Reset a filter or check official sites for details marked unknown.</p></div>';
  const countries = [...new Set(programs.map((p) => p.country).filter(Boolean))].sort();
  const counts = [...new Set(programs.map((p) => p.country).filter(Boolean))].length;
  $('#snapshot').textContent = `${programs.length} sourced records · ${counts} countries · ${researchDateRange(programs)} source reviews`;
}
function openDetail(id) {
  const p = programs.find((x) => x.id === id); if (!p) return;
  const fee = p.annual_tuition ?? {}, d = p.deadline ?? {}, language = p.language ?? {}, gre = p.gre ?? {};
  const scholarships = (p.scholarships ?? []).map((s) => `<li><strong>${e(s.name)}</strong><p>${e(s.eligibility)}</p>${link(s.url, 'Scholarship information')}</li>`).join('') || '<li>No named opportunities recorded.</li>';
  const docs = (p.required_documents ?? []).map((x) => `<li>${e(x)}</li>`).join('');
  const sources = (p.sources ?? []).map((s) => `<li>${link(s.url, s.title)} <span class="micro">· ${e((s.fields ?? []).join(', '))}</span></li>`).join('');
  els.detailContent.innerHTML = `<p class="eyebrow">${e(p.country)} · ${e(p.degree)}</p><h2 id="detail-title">${e(p.university)}</h2><p class="program-name">${e(p.program)}</p>
    <p class="dialog-lead">${link(p.program_url, 'Official program page')}</p><div class="detail-grid">
    <section><h3>Tuition</h3><p class="detail-value">${e(money(fee))}</p><p><b>Fee year:</b> ${e(fee.fee_year || 'Not stated')}<br><b>Basis:</b> ${e(fee.basis || 'Unknown').replaceAll('_',' ')}</p><p>${e(fee.notes)}</p>${link(fee.source_url, 'Tuition source')}</section>
    <section><h3>Deadline & intake</h3><p class="detail-value">${deadline(p)}</p><p>${e(d.notes)}</p>${link(d.source_url, 'Deadline source')}</section>
    <section><h3>English language</h3><p><b>IELTS Academic overall:</b> ${language.ielts_overall == null ? 'Not verified' : e(language.ielts_overall)}</p><p>${e(language.notes)}</p>${link(language.source_url, 'Language source')}</section>
    <section><h3>Scholarships & funding</h3><ul>${scholarships}</ul><p>${e(p.scholarships_note)}</p></section>
    <section><h3>Documents</h3><ul>${docs || '<li>Not specified.</li>'}</ul></section>
    <section><h3>GRE</h3><p><b>Status:</b> ${e(gre.status || 'unknown').replaceAll('_',' ')}</p><p>${e(gre.notes)}</p>${link(gre.source_url, 'GRE source')}</section>
    <section class="wide"><h3>Verification notes</h3><p>${e(p.verification_notes)}</p><p class="micro">Last verified: ${e(p.last_verified || 'Not stated')}</p></section>
    <section class="wide"><h3>Research sources</h3><ul>${sources || '<li>No sources listed.</li>'}</ul></section></div>`;
  els.detailDialog.showModal();
}
function openCompare() {
  const rows = comparisons.map((id) => programs.find((p) => p.id === id)).filter(Boolean);
  if (!rows.length) { $('#compare-content').innerHTML = '<p>Select up to three programs on their cards to compare.</p>'; }
  else {
    const fields = [
      ['University', p => p.university], ['Country', p => p.country], ['Program & degree', p => `${p.program} · ${p.degree}`],
      ['Annual tuition', p => `${money(p.annual_tuition)} · ${p.annual_tuition?.fee_year || 'year unknown'} · ${(p.annual_tuition?.basis || 'unknown').replaceAll('_',' ')}`],
      ['Tuition notes', p => p.annual_tuition?.notes], ['Deadline / cycle', p => `${p.deadline?.date || 'No verified date'} · ${p.deadline?.cycle || ''} · ${p.deadline?.notes || ''}`],
      ['IELTS overall & notes', p => `${p.language?.ielts_overall ?? 'Unknown'} · ${p.language?.notes || ''}`],
      ['Scholarships & eligibility', p => `${(p.scholarships || []).map(s => `${s.name}: ${s.eligibility}`).join('\n') || 'None listed'}\n${p.scholarships_note || ''}`],
      ['Required documents', p => (p.required_documents || []).join('\n')], ['GRE', p => `${p.gre?.status || 'unknown'} · ${p.gre?.notes || ''}`],
      ['Verification notes', p => p.verification_notes], ['Last verified', p => p.last_verified], ['Official program', p => p.program_url],
      ['Tuition source', p => p.annual_tuition?.source_url], ['Deadline source', p => p.deadline?.source_url], ['Language source', p => p.language?.source_url], ['GRE source', p => p.gre?.source_url],
      ['Research sources', p => (p.sources || []).map(s => `${s.title}: ${s.url} [${(s.fields || []).join(', ')}]`).join('\n')]
    ];
    els.compareTable.innerHTML = `<div class="table-wrap"><table><caption>Side-by-side program research</caption><thead><tr><th scope="col">Field</th>${rows.map((p) => `<th scope="col">${e(p.university)}<button type="button" class="remove-compare" data-remove="${e(p.id)}" aria-label="Remove ${e(p.university)} from comparison">Remove</button></th>`).join('')}</tr></thead><tbody>${fields.map(([label]) => `<tr><th scope="row">${e(label)}</th>${rows.map((p) => `<td>${compareCell(label, p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  els.compareDialog.showModal();
}
function exportCSV() {
  const items = sortPrograms(filterPrograms(programs, { search: $('#search').value, country: $('#country').value, degree: $('#degree').value, scholarshipsOnly: $('#scholarships-only').checked, shortlistOnly: $('#shortlist-only').checked, shortlistedIds: shortlist, currency: $('#currency').value, maxBudget: $('#max-budget').value, ielts: $('#ielts-max').value }), $('#sort').value);
  const blob = new Blob([programsToCSV(items)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'cyberabroad-programs.csv'; a.click(); URL.revokeObjectURL(url); announce(`Exported ${items.length} filtered records as CSV.`);
}
function announce(message) { els.status.textContent = ''; requestAnimationFrame(() => { els.status.textContent = message; }); }
function persistShortlist() { shortlist = storeIds(storage, 'cyberabroad-shortlist', shortlist, programs.map(p => p.id)); }

for (const control of document.querySelectorAll('.filters input, .filters select')) control.addEventListener('input', render);
$('#reset').addEventListener('click', () => { $('#search').value=''; $('#country').value=''; $('#degree').value=''; $('#scholarships-only').checked=false; $('#shortlist-only').checked=false; $('#currency').value=''; $('#max-budget').value=''; $('#ielts-max').value=''; $('#sort').value='university'; render(); announce('Filters reset.'); });
$('#export').addEventListener('click', exportCSV);
$('#compare-open').addEventListener('click', openCompare);
$('#theme-toggle').addEventListener('click', () => { const dark = document.documentElement.classList.toggle('dark'); setItem('cyberabroad-theme', dark ? 'dark' : 'light'); $('#theme-toggle').setAttribute('aria-pressed', String(dark)); $('#theme-toggle').textContent = dark ? 'Light mode' : 'Dark mode'; });
$('#programs').addEventListener('click', (event) => {
  const save = event.target.closest('[data-save]'), detail = event.target.closest('[data-detail]');
  if (save) { const id=save.dataset.save; shortlist = shortlist.includes(id) ? shortlist.filter(x=>x!==id) : [...shortlist,id]; persistShortlist(); render(); announce(shortlist.includes(id) ? 'Added to shortlist.' : 'Removed from shortlist.'); }
  if (detail) openDetail(detail.dataset.detail);
});
$('#programs').addEventListener('change', (event) => {
  const box=event.target.closest('[data-compare]'); if (!box) return;
  if (box.checked) { const result=addComparison(comparisons, box.dataset.compare); if (!result.added) { box.checked=false; announce(result.reason==='limit' ? 'Comparison is limited to three programs. Remove one before adding another.' : 'That program is already in the comparison.'); } else { comparisons=result.ids; announce(`${comparisons.length} programs selected for comparison.`); } }
  else { comparisons=comparisons.filter(id=>id!==box.dataset.compare); announce(`${comparisons.length} programs selected for comparison.`); }
  $('#compare-open').textContent=`Compare (${comparisons.length})`;
});
$('#compare-content').addEventListener('click', (event) => { const b=event.target.closest('[data-remove]'); if (!b) return; comparisons=comparisons.filter(id=>id!==b.dataset.remove); $('#compare-open').textContent=`Compare (${comparisons.length})`; render(); openCompare(); announce('Program removed from comparison.'); });

if (getItem('cyberabroad-theme') === 'dark') { document.documentElement.classList.add('dark'); $('#theme-toggle').setAttribute('aria-pressed','true'); $('#theme-toggle').textContent='Light mode'; }
$('#today').textContent = dateISO;
try {
  const response = await fetch('./data/programs.json', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Expected an array of program records.');
  programs = data.filter(p => p && typeof p.id === 'string');
  if (!programs.length) throw new Error('No usable program records found.');
  shortlist = parseStoredIds(storage, 'cyberabroad-shortlist', programs.map(p => p.id));
  const countries=[...new Set(programs.map(p=>p.country).filter(Boolean))].sort();
  for (const country of countries) { const option=document.createElement('option'); option.value=country; option.textContent=country; els.countries.append(option); }
  const currencies=[...new Set(programs.map(p=>p.annual_tuition?.currency).filter(c=>CURRENCIES.includes(c)))].sort();
  for (const currency of currencies) { const option=document.createElement('option'); option.value=currency; option.textContent=currency; els.currency.append(option); }
  render();
  els.grid.setAttribute('aria-busy', 'false');
} catch (error) {
  els.grid.innerHTML = '<div class="error-state"><h2>Program data could not be loaded.</h2><p>Please try again later. The tracker loads its public dataset from the same site; no other service is contacted.</p></div>';
  els.grid.setAttribute('aria-busy', 'false');
  els.results.textContent = 'Unavailable';
  announce(`Could not load programs: ${error.message}`);
}
