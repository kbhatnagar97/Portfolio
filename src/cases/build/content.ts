import profileJson from '../../content/profile.json';
import { isKind, isPurpose } from './terms';
import type { ICase, IOffer, IOverview } from './types';

// Build time only. Checks one content file and returns what is wrong with it; the caller decides what fails the build.

export interface IProblems {
  errors: string[];
  warnings: string[];
}

// check.mjs fails any title tag over 65 characters, and the case pages add this suffix
export const TITLE_SUFFIX = ` | ${profileJson.name}`;
const TITLE_MAX = 65;
const DESCRIPTION_MAX = 160;

const DASH = /[–—]/;
const SPACED_HYPHEN = /\s-\s/;
const EMOJI = /\p{Extended_Pictographic}/u;
const COMPOUND = /[A-Za-z]-[A-Za-z]/;
const HEX = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// a link in content opens a page, a site or a mail draft, never a script
const SAFE_URL = /^(https?:\/\/|\/|#|mailto:)/;
const HYPE = [
  'revolutionary', 'seamless', 'cutting edge', 'game changer', 'world class', 'unlock', 'empower', 'leverage', 'supercharge',
  'effortless', 'innovative', 'robust', 'best in class', 'clean', 'modern', 'sleek', 'elegant', 'minimalist', 'polished',
  'refined', 'sophisticated', 'delightful', 'stunning', 'beautiful', 'premium', 'intuitive', 'user friendly',
];
const HYPE_RE = new RegExp(`\\b(${HYPE.join('|')})\\b`, 'i');
// product names that hold a word from the list above
const PRODUCT_NAMES = /Power Automate Premium/g;
// strings under these keys are identifiers, paths or colours, so hyphens and digits in them are not prose
const CODE_KEYS = new Set(['slug', 'id', 'src', 'srcset', 'sizes', 'href', 'url', 'source', 'kind', 'accent', 'project', 'purposes', 'published']);
// a proper name may still need a hyphen, so a compound in these fields only warns
const PROSE = /^(title|kicker|client|industry|role|status|seoTitle|description|deck|summary\[\d+\]|impact\[\d+\]\.(label|note)|offer\.\w+)$/;
const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
// drawings print their dates in capitals, so the month matches in any case
const DATE_TEXT = new RegExp(`\\b\\d{1,2} (${MONTHS})[a-z]*( \\d{4})?\\b|\\b\\d{1,2}:\\d{2}\\b`, 'gi');
// a [kind:source] marker becomes that source's chip on the page (parts.withChips)
const MARKER = /\[([A-Za-z]+):([A-Za-z0-9]+)\]/g;
// gaps print in every build and sit in a public file, so they name what is missing in plain words, nothing more
const GAP_WORDS = /\b(consent|legal|lawyers?|nda|contracts?|employers?|sign ?off|signed off|prices?|pricing|fees?|invoices?|accounts?|domains?|trademarks?)\b/i;

// #region Walking
// list is the array a leaf sits in, when it sits in one
type TLeaf = { path: string; key: string; value: unknown; holder: Record<string, unknown>; list?: unknown[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// every leaf with its JSON path, so a problem names the exact field
const leaves = (v: unknown, path = '', key = '', holder: Record<string, unknown> = {}, out: TLeaf[] = [], list?: unknown[]): TLeaf[] => {
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, key, holder, out, v));
  else if (isObject(v)) for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, k, v, out);
  else out.push({ path, key, value: v, holder, list });
  return out;
};

// figures in prose, minus years, dates, clock times, labels like V1 and step numbers like 03, so the number warning only
// flags real figures
const figures = (s: string) =>
  (s.replace(DATE_TEXT, ' ').match(/(?<![\w.])\d[\d,.]*/g) ?? [])
    .map((n) => n.replace(/[.,]+$/, '').replace(/,/g, ''))
    .filter((n) => n && !/^(19|20)\d\d$/.test(n) && !/^0\d$/.test(n));

const isCiteList = (v: unknown) => Array.isArray(v) && v.some((x) => isObject(x) && typeof x.source === 'string');

// a leaf's numbers are sourced when its object names a source, a cite or prov list or one for that field, when it is part
// of a text array that carries chips, or when it holds a marker
const isSourced = (l: TLeaf) => {
  const h = l.holder;
  const named = typeof h.source === 'string' || (Array.isArray(h.source) && h.source.length > 0);
  return (
    named ||
    isCiteList(h.cite) ||
    isCiteList(h.prov) ||
    isCiteList(h[`${l.key}Cite`]) ||
    isCiteList(h[`${l.key}Prov`]) ||
    isCiteList(l.list) ||
    (typeof l.value === 'string' && [...l.value.matchAll(MARKER)].length > 0)
  );
};
// #endregion

// #region Shape
type TCheck = (v: unknown) => boolean;
const str: TCheck = (v) => typeof v === 'string';
const bool: TCheck = (v) => typeof v === 'boolean';
const num: TCheck = (v) => typeof v === 'number' && Number.isFinite(v);
const list = (each: TCheck): TCheck => (v) => Array.isArray(v) && v.every(each);
const shape =
  (fields: Record<string, TCheck>, optional: Record<string, TCheck> = {}): TCheck =>
  (v) =>
    isObject(v) &&
    Object.entries(fields).every(([k, f]) => f(v[k])) &&
    Object.entries(optional).every(([k, f]) => v[k] === undefined || f(v[k]));

const CASE_FIELDS: Record<string, TCheck> = {
  slug: str,
  draft: bool,
  title: str,
  kicker: str,
  client: str,
  industry: str,
  anonymised: bool,
  role: str,
  year: str,
  published: str,
  status: str,
  accent: str,
  purposes: list(isPurpose),
  seoTitle: str,
  description: str,
  deck: str,
  summary: list(str),
  impact: list(shape({ value: str, label: str, kind: isKind, source: str }, { note: str })),
  poster: shape({ src: str, alt: str, width: num, height: num }, { webp: str }),
  stack: list(str),
  links: list(shape({ label: str, href: str })),
  offer: shape({ who: str, gets: str, needs: str, setup: str }, { also: str }),
  sources: list(shape({ id: str, text: str }, { url: str })),
  gaps: list(str),
  blocks: isObject,
};
const CASE_OPTIONAL: Record<string, TCheck> = { flagship: bool, project: str, credits: list(shape({ text: str }, { url: str })) };
const OVERVIEW_FIELDS: Record<string, TCheck> = {
  draft: bool,
  title: str,
  kicker: str,
  deck: str,
  seoTitle: str,
  description: str,
  lede: list(str),
  how: list(shape({ step: str, text: str })),
  cta: shape({ text: str, subject: str }),
  home: shape({ index: str, title: str, line: str, cta: str }),
  gaps: list(str),
};

const shapeErrors = (v: unknown, fields: Record<string, TCheck>, optional: Record<string, TCheck> = {}) =>
  isObject(v)
    ? [
        ...Object.entries(fields).flatMap(([k, f]) => (f(v[k]) ? [] : [`${k}: missing or the wrong type`])),
        ...Object.entries(optional).flatMap(([k, f]) => (v[k] === undefined || f(v[k]) ? [] : [`${k}: the wrong type`])),
      ]
    : ['the file is not a JSON object'];
// #endregion

// #region Public repo rule
// every content file is public: no local path, no private notes folder, and none of the private names, which stay out of
// this repo even as hashes; select.ts reads them from a git ignored file and passes them in
// a site path such as /home/about/ is fine; these are the shapes a path on a laptop takes
const LOCAL = /\/Users\/|\/private\/(tmp|var)\/|\/var\/folders\/|~\/|[A-Za-z]:\\|file:\/\/|\.agent\b/;

// cyrb53, a small 53 bit string hash, so the local list can hold a name without spelling it out
export const privateHash = (s: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// one, two and three word runs, so a name is found whether spaces, hyphens or dots join its words
const runs = (s: string) => {
  const w = words(s);
  return w.flatMap((_, i) => [1, 2, 3].filter((n) => i + n <= w.length).map((n) => w.slice(i, i + n).join(' ')));
};

// the private names file is a JSON list; each entry is a name of one to three words, or a name already put through privateHash
const isPrivateEntry = (x: unknown) => Number.isSafeInteger(x) || (typeof x === 'string' && words(x).length > 0 && words(x).length <= 3);

export const privateNames = (list: unknown): Set<number> => {
  if (!Array.isArray(list) || !list.every(isPrivateEntry))
    throw new Error('case-pages: the private names file must be a JSON list of names of one to three words, or privateHash numbers');
  return new Set(list.map((x: string | number) => (typeof x === 'number' ? x : privateHash(words(x).join(' ')))));
};

const publicProblems = (data: unknown, names: ReadonlySet<number>, p: IProblems) => {
  for (const { path, value } of leaves(data)) {
    if (typeof value !== 'string') continue;
    if (LOCAL.test(value)) p.errors.push(`${path}: a local file path or a private notes folder; content files are public, so describe the evidence instead`);
    if (runs(value).some((r) => names.has(privateHash(r)))) p.errors.push(`${path}: a private name; content files are public`);
  }
};
// #endregion

// #region Copy rules, shared by the cases and the overview
const copyProblems = (data: Record<string, unknown>, p: IProblems) => {
  for (const { path, key, value } of leaves(data)) {
    if (typeof value !== 'string') continue;
    if (DASH.test(value)) p.errors.push(`${path}: an en or em dash; use a comma, a colon or two sentences`);
    if (SPACED_HYPHEN.test(value)) p.errors.push(`${path}: a spaced hyphen used as a dash`);
    if (EMOJI.test(value)) p.errors.push(`${path}: an emoji`);
    if ((key === 'href' || key === 'url') && value && !SAFE_URL.test(value)) p.errors.push(`${path}: "${value}" is not an http, https, mailto or site link`);
    if (CODE_KEYS.has(key)) continue;
    const hype = value.replace(PRODUCT_NAMES, '').match(HYPE_RE)?.[0];
    if (hype) p.warnings.push(`${path}: "${hype}" is on the banned word list; show the evidence instead`);
    if (PROSE.test(path) && COMPOUND.test(value)) p.warnings.push(`${path}: a hyphenated compound; write "pre launch" or rephrase, unless it is a name`);
  }
};

const gapProblems = (gaps: string[], p: IProblems) =>
  gaps.forEach((g, i) => {
    const word = g.match(GAP_WORDS)?.[0];
    if (word) p.errors.push(`gaps[${i}]: "${word}" does not belong in a public gap; say only what is missing, in neutral words`);
  });

const lengthProblems = (title: string, description: string, p: IProblems) => {
  if (title.length > TITLE_MAX) p.errors.push(`seoTitle: the title tag "${title}" is ${title.length} characters, over ${TITLE_MAX}`);
  if (description.length > DESCRIPTION_MAX) p.errors.push(`description: ${description.length} characters, over ${DESCRIPTION_MAX}`);
};
// #endregion

// #region Cases
const SHOWN = ['title', 'kicker', 'client', 'industry', 'role', 'year', 'published', 'status', 'seoTitle', 'description', 'deck'] as const;
const OFFER = ['who', 'gets', 'needs', 'setup'] as const satisfies readonly (keyof IOffer)[];

// a marker must name a kind and a listed source, and sit where the page prints it as text
const markerProblems = (data: unknown, ids: string[], p: IProblems) => {
  for (const { path, key, value } of leaves(data)) {
    if (typeof value !== 'string') continue;
    for (const [m, kind, source] of value.matchAll(MARKER)) {
      if (!isKind(kind)) p.errors.push(`${path}: the marker ${m} names no known kind`);
      else if (!ids.includes(source)) p.errors.push(`${path}: the marker ${m} cites "${source}", which sources does not list`);
      if (!/^(blocks|offer)\b/.test(path) || key === 'alt') p.errors.push(`${path}: the marker ${m} would print as text here; markers become chips only in blocks and the offer, never in alt text`);
    }
  }
};

export const validateCase = (data: unknown, file: string, projectIds: Set<string>, names: ReadonlySet<number>): IProblems => {
  const p: IProblems = { errors: shapeErrors(data, CASE_FIELDS, CASE_OPTIONAL), warnings: [] };
  if (p.errors.length || !isObject(data)) return p;
  const c = data as unknown as ICase;
  const media = `/case-studies/${c.slug}/media/`;
  const ids = c.sources.map((s) => s.id);

  // integrity holds for drafts too, so mistakes surface while a case is being written
  if (c.slug !== file) p.errors.push(`slug: "${c.slug}" does not match the file name ${file}.json`);
  if (!HEX.test(c.accent)) p.errors.push(`accent: "${c.accent}" is not a #rrggbb colour`);
  if (c.published && !ISO_DATE.test(c.published)) p.errors.push(`published: "${c.published}" is not a YYYY-MM-DD date`);
  if (new Set(c.purposes).size !== c.purposes.length) p.errors.push('purposes: an id is listed twice');
  for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) p.errors.push(`sources: the id "${id}" is used twice`);
  if (c.anonymised && c.links.length) p.errors.push('links: an anonymised case links nowhere');
  if (c.anonymised && c.project) p.errors.push('project: an anonymised case must not point at a project page');
  if (c.project && !projectIds.has(c.project)) p.errors.push(`project: "${c.project}" is not an id in src/content/projects.json`);
  for (const { path, key, value } of leaves(data)) {
    if (typeof value !== 'string') continue;
    if (key === 'source' && !ids.includes(value)) p.errors.push(`${path}: cites "${value}", which sources does not list`);
    const paths = key === 'src' || key === 'webp' ? [value] : key === 'srcset' ? value.split(',').map((x) => x.trim().split(/\s+/)[0]) : [];
    for (const u of paths.filter((x) => x && !x.startsWith(media))) p.errors.push(`${path}: "${u}" must live under ${media}, in public${media}`);
  }
  markerProblems(data, ids, p);
  copyProblems(data, p);
  publicProblems(data, names, p);
  gapProblems(c.gaps, p);
  lengthProblems(`${c.seoTitle}${TITLE_SUFFIX}`, c.description, p);

  // a case leaves draft only when every field a page shows is filled
  if (!c.draft) {
    for (const k of SHOWN) if (!c[k].trim()) p.errors.push(`${k}: empty`);
    for (const k of OFFER) if (!c.offer[k].trim()) p.errors.push(`offer.${k}: empty`);
    if (c.summary.length < 2 || c.summary.length > 4) p.errors.push(`summary: ${c.summary.length} paragraphs, it takes 2 to 4`);
    if (c.impact.length < 2 || c.impact.length > 4) p.errors.push(`impact: ${c.impact.length} numbers, it takes 2 to 4`);
    if (!c.purposes.length) p.errors.push('purposes: name at least one');
    if (!c.stack.length) p.errors.push('stack: empty');
    if (!c.poster.src || !c.poster.alt.trim()) p.errors.push('poster: needs a src and an alt text');
    if (c.poster.width !== 1280 || c.poster.height !== 800) p.errors.push(`poster: ${c.poster.width}x${c.poster.height}, posters are 1280x800`);
  }

  // a figure in the story should be one of the sourced ones
  const all = leaves(data).filter((l) => !CODE_KEYS.has(l.key) && (typeof l.value === 'string' || typeof l.value === 'number'));
  const sourced = new Set(all.filter(isSourced).flatMap((l) => figures(String(l.value))));
  const story = leaves({ deck: c.deck, summary: c.summary, blocks: c.blocks }).filter((l) => typeof l.value === 'string' && !CODE_KEYS.has(l.key) && !isSourced(l));
  for (const l of story)
    for (const n of figures(String(l.value)))
      if (!sourced.has(n)) p.warnings.push(`${l.path}: the figure ${n} is not in any sourced metric; cite it or say how it was found`);
  return p;
};
// #endregion

// #region The overview
export const validateOverview = (data: unknown, names: ReadonlySet<number>): IProblems => {
  const p: IProblems = { errors: shapeErrors(data, OVERVIEW_FIELDS), warnings: [] };
  if (p.errors.length || !isObject(data)) return p;
  const o = data as unknown as IOverview;
  copyProblems(data, p);
  publicProblems(data, names, p);
  gapProblems(o.gaps, p);
  // the overview title already names him, so it takes no suffix
  lengthProblems(o.seoTitle, o.description, p);
  if (!o.draft) {
    for (const k of ['title', 'deck', 'seoTitle', 'description'] as const) if (!o[k].trim()) p.errors.push(`${k}: empty`);
    if (o.how.length !== 4) p.errors.push(`how: ${o.how.length} steps, How I work has 4`);
    if (!o.lede.length) p.errors.push('lede: empty');
  }
  return p;
};
// #endregion
