import test from 'node:test';
import assert from 'node:assert/strict';
import { addComparison, deadlineStatus, escapeHTML, filterPrograms, parseStoredIds, programsToCSV, safeIdList, safeURL, sortPrograms, storeIds } from '../src/core.mjs';

const records = [
  { id: 'de-a', university: 'Alpha University', country: 'Germany', program: 'Cybersecurity', degree: 'Masters', annual_tuition: { amount: 0, currency: 'EUR' }, deadline: { date: null }, language: { ielts_overall: 7 }, scholarships: [{ name: 'Award' }] },
  { id: 'uk-b', university: 'Beta University', country: 'UK', program: 'Information Security', degree: 'Masters', annual_tuition: { amount: 12000, currency: 'GBP' }, deadline: { date: '2027-03-01' }, language: { ielts_overall: null }, scholarships: [] },
  { id: 'ca-c', university: 'Gamma College', country: 'Canada', program: 'Cyber Defence', degree: 'PhD', annual_tuition: { amount: null, currency: 'CAD' }, deadline: { date: '2026-01-01' }, language: { ielts_overall: 6.5 }, scholarships: [{ name: 'Fellowship' }] },
  { id: 'nl-d', university: 'Delta Institute', country: 'Netherlands', program: 'Secure Systems', degree: 'Masters', annual_tuition: { amount: 9000, currency: 'EUR' }, deadline: { date: '2027-06-01' }, language: { ielts_overall: 6.5 }, scholarships: [] }
];

test('filters search, country, degree, scholarships and shortlist without altering source', () => {
  assert.deepEqual(filterPrograms(records, { search: 'cyber' }).map(p => p.id), ['de-a', 'ca-c']);
  assert.deepEqual(filterPrograms(records, { country: 'UK', degree: 'Masters' }).map(p => p.id), ['uk-b']);
  assert.deepEqual(filterPrograms(records, { scholarshipsOnly: true, shortlistOnly: true, shortlistedIds: ['ca-c'] }).map(p => p.id), ['ca-c']);
  assert.equal(records.length, 4);
});

test('budget compares only selected original currency and excludes unknown amount', () => {
  assert.deepEqual(filterPrograms(records, { currency: 'EUR', maxBudget: '10000' }).map(p => p.id), ['de-a', 'nl-d']);
  assert.deepEqual(filterPrograms(records, { currency: 'GBP', maxBudget: '15000' }).map(p => p.id), ['uk-b']);
  assert.deepEqual(filterPrograms(records, { currency: 'CAD', maxBudget: '999999' }), []);
  assert.equal(filterPrograms(records, { currency: 'EUR', maxBudget: '' }).length, 4);
});

test('IELTS ceiling excludes unknown score and minima above the supplied score', () => {
  assert.deepEqual(filterPrograms(records, { ielts: '6.5' }).map(p => p.id), ['ca-c', 'nl-d']);
  assert.deepEqual(filterPrograms(records, { ielts: '7' }).map(p => p.id), ['de-a', 'ca-c', 'nl-d']);
});

test('sorting uses deadline dates and groups tuition by currency', () => {
  assert.deepEqual(sortPrograms(records, 'deadline').map(p => p.id), ['ca-c', 'uk-b', 'nl-d', 'de-a']);
  const sorted = sortPrograms(records, 'tuition');
  assert.deepEqual(sorted.map(p => p.annual_tuition.currency), ['CAD', 'EUR', 'EUR', 'GBP']);
});

test('deadline status is calendar-based in UTC, with unknown and expired states', () => {
  const now = new Date('2026-11-15T23:30:00-08:00');
  assert.deepEqual(deadlineStatus(null, now), { kind: 'unknown', label: 'Check official site', days: null });
  assert.equal(deadlineStatus('2026-11-15', now).kind, 'closed');
  assert.equal(deadlineStatus('2026-11-16', now).days, 0);
  assert.equal(deadlineStatus('2027-01-01', now).days, 46);
  assert.equal(deadlineStatus('2027-02-30', now).kind, 'unknown');
});

test('comparison allows at most three unique records and reports full state', () => {
  let state = [];
  for (const id of ['de-a', 'uk-b', 'ca-c']) state = addComparison(state, id).ids;
  assert.deepEqual(state, ['de-a', 'uk-b', 'ca-c']);
  assert.deepEqual(addComparison(state, 'nl-d'), { ids: state, added: false, reason: 'limit' });
  assert.equal(addComparison(state, 'de-a').reason, 'already-added');
});

test('storage IDs are validated, deduplicated and resilient to denied storage', () => {
  assert.deepEqual(safeIdList(['de-a', '__proto__', 'de-a', 42], ['de-a', 'uk-b']), ['de-a']);
  assert.deepEqual(parseStoredIds({ getItem: () => '{bad' }, 'x', ['de-a']), []);
  assert.deepEqual(parseStoredIds({ getItem: () => '["de-a","attacker"]' }, 'x', ['de-a']), ['de-a']);
  const denied = { setItem() { throw new Error('denied'); } };
  assert.deepEqual(storeIds(denied, 'x', ['de-a', 'bad'], ['de-a']), ['de-a']);
  assert.deepEqual(parseStoredIds({ getItem() { throw new Error('denied'); } }, 'x', ['de-a']), []);
});

test('HTML and URL helpers prevent markup and non-HTTPS destinations', () => {
  assert.equal(escapeHTML(`<img src=x onerror='x'>`), '&lt;img src=x onerror=&#39;x&#39;&gt;');
  assert.equal(safeURL('javascript:alert(1)'), null);
  assert.equal(safeURL('http://example.com'), null);
  assert.equal(safeURL('https://example.com/path'), 'https://example.com/path');
});

test('CSV includes BOM, flattened research fields, quoting, newlines and formula mitigation', () => {
  const csv = programsToCSV([{
    id: 'safe-id', university: '=HYPERLINK("x")', country: 'UK', program: 'A, B\nC', degree: 'Masters',
    annual_tuition: { amount: 12000, currency: 'GBP', fee_year: '2027', basis: 'published_annual', notes: 'Fee, notes', source_url: 'https://example.org/fees' },
    deadline: { date: null, cycle: 'Fall\n2027', notes: 'Unknown', source_url: null },
    language: { ielts_overall: null, notes: 'No score', source_url: null }, scholarships: [{ name: 'Award', eligibility: 'Conditional', url: 'https://example.org/award' }],
    scholarships_note: 'Not guaranteed', required_documents: ['Transcript', 'CV'], gre: { status: 'unknown', notes: 'No statement', source_url: null },
    program_url: 'https://example.org', verification_notes: 'Check sources', sources: [{ title: 'Official', url: 'https://example.org', fields: ['program'] }], last_verified: '2026-11-15'
  }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.match(csv, /"A, B\nC"/);
  assert.match(csv, /"Fee, notes"/);
  assert.match(csv, /"2027"/);
  assert.match(csv, /"Sources"/);
});

test('research snapshot derives only from reviewed record dates, never today', async () => {
  const { researchDateRange } = await import('../src/core.mjs');
  assert.equal(researchDateRange([{last_verified:'2026-11-15'}]), '2026-11-15');
  assert.equal(researchDateRange([{last_verified:'2026-11-15'},{last_verified:'2026-10-01'}]), '2026-10-01–2026-11-15');
  assert.equal(researchDateRange([]), 'Review date not recorded');
});

test('source URLs may not carry credentials', () => {
  assert.equal(safeURL('https://user:password@example.com/'), null);
  assert.equal(safeURL('https://example.com/program'), 'https://example.com/program');
});
