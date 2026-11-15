export const CURRENCIES = ['EUR', 'CAD', 'GBP', 'SEK', 'AUD', 'MYR', 'TRY', 'USD'];

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function safeURL(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function researchDateRange(programs) {
  const dates = [...new Set(programs.map(p => p.last_verified).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (!dates.length) return 'Review date not recorded';
  return dates.length === 1 ? dates[0] : `${dates[0]}–${dates.at(-1)}`;
}

export function safeIdList(value, allowedIds) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(allowedIds);
  return [...new Set(value.filter((id) => typeof id === 'string' && allowed.has(id)))];
}

export function parseStoredIds(storage, key, allowedIds) {
  try { return safeIdList(JSON.parse(storage?.getItem(key) ?? '[]'), allowedIds); }
  catch { return []; }
}

export function storeIds(storage, key, ids, allowedIds) {
  const clean = safeIdList(ids, allowedIds);
  try { storage?.setItem(key, JSON.stringify(clean)); } catch { /* storage may be disabled or full */ }
  return clean;
}

export function deadlineStatus(date, now = new Date()) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { kind: 'unknown', label: 'Check official site', days: null };
  const due = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(due.valueOf()) || due.toISOString().slice(0, 10) !== date) return { kind: 'unknown', label: 'Check official site', days: null };
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Math.ceil((due - today) / 86400000);
  return days < 0 ? { kind: 'closed', label: `Closed · ${date}`, days } : { kind: 'upcoming', label: `${days} days · ${date}`, days };
}

export function filterPrograms(programs, filters = {}) {
  const q = String(filters.search ?? '').trim().toLocaleLowerCase();
  const max = filters.maxBudget === '' || filters.maxBudget == null ? null : Number(filters.maxBudget);
  const score = filters.ielts === '' || filters.ielts == null ? null : Number(filters.ielts);
  return programs.filter((p) => {
    if (q && ![p.university, p.program, p.country].some((v) => String(v ?? '').toLocaleLowerCase().includes(q))) return false;
    if (filters.country && p.country !== filters.country) return false;
    if (filters.degree && p.degree !== filters.degree) return false;
    if (filters.scholarshipsOnly && !(p.scholarships?.length)) return false;
    if (filters.shortlistOnly && !filters.shortlistedIds?.includes(p.id)) return false;
    if (max !== null && Number.isFinite(max)) {
      if (!filters.currency || p.annual_tuition?.currency !== filters.currency || p.annual_tuition?.amount == null || Number(p.annual_tuition.amount) > max) return false;
    }
    if (score !== null && Number.isFinite(score)) {
      const minimum = p.language?.ielts_overall;
      if (minimum == null || Number(minimum) > score) return false;
    }
    return true;
  });
}

export function sortPrograms(programs, mode = 'university') {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return [...programs].sort((a, b) => {
    if (mode === 'deadline') {
      const ad = a.deadline?.date ?? '9999-12-31', bd = b.deadline?.date ?? '9999-12-31';
      return ad.localeCompare(bd) || collator.compare(a.university ?? '', b.university ?? '');
    }
    if (mode === 'tuition') {
      return collator.compare(a.annual_tuition?.currency ?? '', b.annual_tuition?.currency ?? '') ||
        ((a.annual_tuition?.amount ?? Infinity) - (b.annual_tuition?.amount ?? Infinity)) || collator.compare(a.university ?? '', b.university ?? '');
    }
    return collator.compare(a.university ?? '', b.university ?? '') || collator.compare(a.program ?? '', b.program ?? '');
  });
}

export function addComparison(current, id, max = 3) {
  if (current.includes(id)) return { ids: current, added: false, reason: 'already-added' };
  if (current.length >= max) return { ids: current, added: false, reason: 'limit' };
  return { ids: [...current, id], added: true, reason: null };
}

const CSV_COLUMNS = [
  ['id','ID'],['university','University'],['country','Country'],['program','Program'],['degree','Degree'],
  ['annual_tuition.amount','Tuition amount'],['annual_tuition.currency','Currency'],['annual_tuition.fee_year','Fee year'],['annual_tuition.basis','Fee basis'],['annual_tuition.notes','Tuition notes'],['annual_tuition.source_url','Tuition source'],
  ['deadline.date','Deadline date'],['deadline.cycle','Deadline cycle'],['deadline.notes','Deadline notes'],['deadline.source_url','Deadline source'],
  ['language.ielts_overall','IELTS overall'],['language.notes','Language notes'],['language.source_url','Language source'],
  ['scholarships','Scholarships'],['scholarships_note','Scholarship notes'],['required_documents','Required documents'],['gre.status','GRE status'],['gre.notes','GRE notes'],['gre.source_url','GRE source'],
  ['program_url','Program URL'],['verification_notes','Verification notes'],['sources','Sources'],['last_verified','Last verified']
];

function getPath(obj, path) { return path.split('.').reduce((v, k) => v?.[k], obj); }
function csvCell(value) {
  let text = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function programsToCSV(programs) {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',');
  return '\uFEFF' + [header, ...programs.map((p) => CSV_COLUMNS.map(([path]) => csvCell(getPath(p, path))).join(','))].join('\r\n');
}
