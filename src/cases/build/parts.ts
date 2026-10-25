import profileJson from '../../content/profile.json';
import { esc, SITE } from '../../html/core';
import { KIND_MEANS, KINDS, PURPOSES } from './terms';
import type {
  IChapterLink,
  ICalc,
  ICalcResult,
  ICase,
  ICompare,
  ICompareSide,
  IFigure,
  IImage,
  IMetric,
  IMilestone,
  IPair,
  IPairSide,
  IPoster,
  IProv,
  ISetup,
  IStage,
  IStoryFrame,
  ITurn,
  ITurnOptions,
  IVersion,
  IVideo,
  TBadge,
  TKind,
  TProse,
  TPurpose,
  TWidth,
} from './types';

// Build time only. Each partial returns the complete no JavaScript state of one component; src/cases/shared adds behaviour.

const P = profileJson;

// #region Glyphs
const svg = (box: string, body: string, cls = 'glyph') =>
  `<svg class="${cls}" viewBox="${box}" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

const PURPOSE_GLYPHS: Record<TPurpose, string> = {
  'saves-time': '<circle cx="6" cy="6" r="4.75"/><path d="M6 3.5V6l1.75 1.25"/>',
  'saves-money': '<ellipse cx="6" cy="3" rx="4.25" ry="1.6"/><path d="M1.75 3v2.5c0 .9 1.9 1.6 4.25 1.6s4.25-.7 4.25-1.6V3"/><path d="M1.75 5.5V8c0 .9 1.9 1.6 4.25 1.6s4.25-.7 4.25-1.6V5.5"/>',
  'grows-reach': '<path d="M1.5 9.5l3-3 2 2 4-4.5"/><path d="M8 4h2.5v2.5"/>',
  'opens-reach': '<circle cx="6" cy="6" r="1.1" fill="currentColor" stroke="none"/><path d="M3.88 3.88a3 3 0 0 0 0 4.24M8.12 3.88a3 3 0 0 1 0 4.24M2.29 2.29a5.25 5.25 0 0 0 0 7.42M9.71 2.29a5.25 5.25 0 0 1 0 7.42"/>',
  'reduces-risk': '<path d="M6 1.25 10 2.75v3.1c0 2.4-1.7 4.2-4 4.9-2.3-.7-4-2.5-4-4.9v-3.1z"/>',
};
export const purposeGlyph = (id: TPurpose) => svg('0 0 12 12', PURPOSE_GLYPHS[id]);

const OUT = svg('0 0 12 12', '<path d="M4 8 8.5 3.5M5 3.5h3.5V7"/>', 'glyph glyph--out');
const ARROW = svg('0 0 12 12', '<path d="M2 6h8M7 3l3 3-3 3"/>', 'glyph glyph--arrow');
const PLAY = svg('0 0 12 12', '<path d="M3.5 2.25v7.5L9.75 6z" fill="currentColor"/>', 'glyph glyph--play');
const GRIP = svg('0 0 20 12', '<path d="M7 2.5 3.5 6 7 9.5M13 2.5 16.5 6 13 9.5"/>', 'glyph glyph--grip');
// #endregion

// #region Basics
const WIDTH: Record<TWidth, string> = { read: '', wide: ' w-wide', bleed: ' w-bleed' };

const fail = (c: ICase | undefined, what: string): never => {
  throw new Error(`case-pages: ${c ? `${c.slug}: ` : ''}${what}`);
};

// a chip's number is its source's place in c.sources, so the chip and the list can never disagree
export const sourceNo = (c: ICase, id: string) => {
  const i = c.sources.findIndex((s) => s.id === id);
  return i < 0 ? fail(c, `cites source "${id}", which its sources list does not have`) : i + 1;
};

// every number carries one: kind in words, a shape, its numbered source; overview cards pass the case page as base
export const prov = (c: ICase, m: { kind: TKind; source: string }, base = '') => {
  const n = sourceNo(c, m.source);
  return `<a class="prov prov--${m.kind}" href="${esc(base)}#src-${n}">${KINDS[m.kind]}<span class="prov__n"><span class="sr-only">, source </span>${n}</span></a>`;
};

// the same chip without a source, for an example input whose default is not case data
export const provLabel = (kind: TKind) => `<span class="prov prov--${kind}">${KINDS[kind]}</span>`;

export const chips = (c: ICase, list: IProv[] = []) => list.map((p) => prov(c, p)).join(' ');

// a [kind:source] marker in a case's copy becomes the chip for that source, where it sits; scripts are left as they are.
// Punctuation right after a marker stays on the chip's line, so no line ever starts with a comma or a full stop.
const MARKER = /(<script\b[\s\S]*?<\/script>)|\[(measured|reported|modelled|example):([A-Za-z0-9]+)\]([.,;:!?)]*)/g;
export const withChips = (c: ICase, html: string) =>
  html.replace(MARKER, (all: string, script: string | undefined, kind: TKind, source: string, tail: string, at: number) => {
    if (script) return script;
    // a chip is markup, so a marker that ended up inside a tag (an alt text, an aria label) would break the page
    if (html.lastIndexOf('<', at) > html.lastIndexOf('>', at)) fail(c, `the marker ${all} sits inside a tag; markers belong in visible text`);
    const chip = prov(c, { kind, source });
    return tail ? `<span class="prov-hold">${chip}${tail}</span>` : chip;
  });

// a sentence from the content file, escaped, with the chips of the numbers it carries after it
const proseOf = (p: TProse) => (typeof p === 'string' ? { text: p, prov: [] } : { text: p.text, prov: p.prov ?? [] });
export const prose = (c: ICase, p: TProse) => {
  const x = proseOf(p);
  return `${esc(x.text)}${x.prov.length ? ` ${chips(c, x.prov)}` : ''}`;
};

export const badge = (text: TBadge) => `<span class="badge">${esc(text)}</span>`;

// the dot is filled only for a status that reads Live; it never pulses
export const caseStatus = (text: string) =>
  `<p class="case-status${/^Live\b/.test(text) ? ' case-status--live' : ''}"><span class="case-status__dot" aria-hidden="true"></span>${esc(text)}</p>`;

const ORDER = Object.keys(PURPOSES) as TPurpose[];

// on case pages each chip links to the overview with that filter; inside a card they are plain labels
export const purposes = (ids: TPurpose[], o: { links?: boolean; small?: boolean } = {}) => {
  const shown = ORDER.filter((p) => ids.includes(p));
  if (!shown.length) return '';
  const chip = (p: TPurpose) =>
    o.links === false
      ? `<span class="purpose">${purposeGlyph(p)}${esc(PURPOSES[p])}</span>`
      : `<a class="purpose" href="/case-studies/#for-${p}">${purposeGlyph(p)}${esc(PURPOSES[p])}</a>`;
  return `<ul class="purposes${o.small ? ' purposes--small' : ''}" aria-label="What this work does">${shown.map((p) => `<li>${chip(p)}</li>`).join('')}</ul>`;
};

export const readout = (text: string) => `<p class="stage__readout" aria-hidden="true">${esc(text)}</p>`;

// runtime data for a case script, the playground's pattern: JSON in the page, read with readData()
export const dataBlock = (value: unknown, id = 'case-data') =>
  `<script type="application/json" id="${esc(id)}">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`;

const img = (i: IImage, o: { cls?: string; srcset?: string; sizes?: string; eager?: boolean } = {}) =>
  `<img${o.cls ? ` class="${o.cls}"` : ''} src="${esc(i.src)}"${o.srcset ? ` srcset="${esc(o.srcset)}"` : ''}${o.sizes ? ` sizes="${esc(o.sizes)}"` : ''} width="${i.width}" height="${i.height}" alt="${esc(i.alt)}"${o.eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async" />`;

// a card's poster: the WebP twin where there is one, the JPG that og:image uses everywhere else
export const posterImg = (p: IPoster) =>
  p.webp ? `<picture><source type="image/webp" srcset="${esc(p.webp)}" />${img(p)}</picture>` : img(p);

const figcaption = (caption: string, credit?: string) =>
  `<figcaption><span class="fig__cap">${esc(caption)}</span>${credit ? ` <span class="fig__credit">${esc(credit)}</span>` : ''}</figcaption>`;

const bare = (u: string) => u.replace(/^[a-z]+:\/\/(www\.)?/, '');
const host = (u: string) => (u.startsWith('/') ? `${bare(SITE)}${u}` : bare(u).split('/')[0]);
const outLink = (u: string) =>
  `<a class="sources__link" href="${esc(u)}"${u.startsWith('/') ? '' : ' rel="noopener"'}>${esc(host(u))}${OUT}<span class="sr-only">, opens the source</span></a>`;
// #endregion

// #region Hero and chapters
const chapterIndex = (index: IChapterLink[]) =>
  `<nav class="case-index" aria-label="In this case"><ol>${[...index, { id: 'get-this', label: 'Get this' }]
    .map((x) => `<li><a href="#${esc(x.id)}">${esc(x.label)}</a></li>`)
    .join('')}</ol></nav>`;

// the work's own site under its status, so a reader can open it from the first screen
const siteLink = (c: ICase) => {
  const l = c.links[0];
  return l ? `<p class="case-link"><a class="pill pill--out" href="${esc(l.href)}"${l.href.startsWith('/') ? '' : ' rel="noopener"'}><span>${esc(l.label)}</span></a></p>\n` : '';
};

// the page's one h1; the kicker sits in the meta row under the deck, never above the title
export const hero = (c: ICase, index: IChapterLink[] = []) => {
  const meta = [c.kicker, c.industry, c.role, c.year].filter((x) => x.trim());
  return `<header class="case-hero w-wide">
<div class="case-hero__main">
<h1 class="title">${esc(c.title)}</h1>
${c.deck ? `<p class="deck">${esc(c.deck)}</p>\n` : ''}${c.status ? `${caseStatus(c.status)}\n` : ''}${siteLink(c)}${meta.length ? `<p class="case-meta">${meta.map((x) => `<span>${esc(x)}</span>`).join('')}</p>\n` : ''}${purposes(c.purposes)}
</div>
${ledger(c)}
${chapterIndex(index)}
</header>`;
};

export const chapter = (id: string, title: string, body: string, o: { cls?: string } = {}) => `<section class="ch${o.cls ? ` ${esc(o.cls)}` : ''}" id="${esc(id)}" aria-labelledby="${esc(id)}-h">
<h2 id="${esc(id)}-h">${esc(title)}</h2>
${body}
</section>`;

// the one signature sequence of a page, directly after the hero; a stage without steps has nothing to announce
export const stage = (c: ICase, s: IStage) => {
  const steps = s.steps.length ? `<ol class="stage__steps">\n${s.steps.map((x) => `<li>${x}</li>`).join('\n')}\n</ol>\n` : '';
  return `<section class="stage stage--${c.slug}" id="stage" aria-labelledby="stage-h" data-stage="${s.mode ?? 'static'}">
<div class="stage__head"><h2 id="stage-h">${esc(s.title)}</h2>${s.intro ? `<p class="stage__intro">${esc(s.intro)}</p>` : ''}</div>
<div class="stage__frame w-max">
${s.frame}
</div>
${s.storyboard ? `${s.storyboard}\n` : ''}${steps}${s.caption ? `<p class="stage__caption">${esc(s.caption)}</p>\n` : ''}${steps ? '<p class="stage__status" role="status"></p>\n' : ''}${s.after ? `${s.after}\n` : ''}</section>`;
};

// the stage's end state, every number visible: what readers without JS, with reduced motion and on paper get
export const storyboard = (frames: IStoryFrame[]) => `<ol class="storyboard w-wide">
${frames.map((f) => `<li class="storyboard__frame"><p class="storyboard__label">${esc(f.label)}${f.when ? ` · ${esc(f.when)}` : ''}</p>${f.html}</li>`).join('\n')}
</ol>`;
// #endregion

// #region Metrics
const line = (m: IMetric) => `<span class="metric__value">${esc(m.value)}</span> <span class="metric__label">${esc(m.label)}</span>`;

export const ledger = (c: ICase) =>
  c.impact.length
    ? `<ul class="ledger" aria-label="What changed, and how each number was found">
${c.impact
  .map((m) => `<li class="metric metric--row"><p class="metric__line">${line(m)}</p>${prov(c, m)}${m.note ? `<p class="metric__note">${esc(m.note)}</p>` : ''}</li>`)
  .join('\n')}
</ul>`
    : '';

export const metricTile = (c: ICase, m: IMetric) => `<p class="metric metric--tile">${line(m)} ${prov(c, m)}</p>`;

// one to three tiles side by side from 900px, stacked below
export const metricTiles = (c: ICase, ms: IMetric[]) => `<div class="metrics w-wide">${ms.map((m) => metricTile(c, m)).join('')}</div>`;

// exactly one per page, beside the mechanism that earned it (a calculator's live result counts as one)
export const heroFigure = (c: ICase, m: IMetric) => `<p class="metric metric--hero">${line(m)} ${prov(c, m)}</p>`;

// the before and after of one measure on one axis; o.grow lets the bars grow once in view (one motion per page)
export const pair = (c: ICase, p: IPair, o: { grow?: boolean } = {}) => {
  const row = (s: IPairSide, after: boolean) => {
    if (!(s.v >= 0 && s.v <= 1)) fail(c, `pair "${p.caption}": a bar length of ${s.v} is outside 0 to 1`);
    return `<div class="pair__row${after ? ' pair__row--after' : ''}"><span class="pair__k">${esc(s.label ?? (after ? 'After' : 'Before'))}</span><span class="pair__track"><span class="pair__bar" style="--v:${s.v}"></span><span class="pair__v">${esc(s.value)}</span></span></div>`;
  };
  return `<figure class="pair"${o.grow ? ' data-grow' : ''}>
<figcaption>${esc(p.caption)}</figcaption>
${row(p.before, false)}
${row(p.after, true)}
${prov(c, p)}
</figure>`;
};

// the HTML always holds the final value, so readers without JS, crawlers and the llms files get the real number
export const counter = (to: number, o: { from: number; decimals?: number; prefix?: string; suffix?: string }) => {
  const d = o.decimals ?? 0;
  const text = `${o.prefix ?? ''}${to.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${o.suffix ?? ''}`;
  return `<span class="count" data-count="${to}" data-from="${o.from}"${d ? ` data-decimals="${d}"` : ''}${o.prefix ? ` data-prefix="${esc(o.prefix)}"` : ''}${o.suffix ? ` data-suffix="${esc(o.suffix)}"` : ''}>${esc(text)}</span>`;
};
// #endregion

// #region Figures and video
export const figure = (f: IFigure) => `<figure class="fig${WIDTH[f.width ?? 'wide']}">
<div class="fig__media">${img(f.img, f)}${f.badge ? badge(f.badge) : ''}</div>
${figcaption(f.caption, f.credit)}
</figure>`;

const seconds = (t: string) => t.split(':').reduce((a, b) => a * 60 + Number(b), 0);
const videoId = (src: string) => `vid-${(src.split('/').pop() ?? 'clip').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

// click to play: no video element in the HTML, the facade is a real link to the file
const clip = (c: ICase, v: IVideo) => {
  if (!v.text?.length) fail(c, `${v.src}: a video needs its text beside it (text lines with timecodes)`);
  const s = seconds(v.duration);
  const label = s < 60 ? `Play the ${s} second clip` : `Play the ${v.duration} clip`;
  // the line and its chip share one box, so the chip wraps with the words instead of beside them
  const line = (x: NonNullable<IVideo['text']>[number]) =>
    `<li><span class="vid__t">${esc(x.t)}</span> <span class="vid__line">${esc(x.line)}${x.kind ? ` ${prov(c, { kind: x.kind, source: x.source ?? '' })}` : ''}</span></li>`;
  return `<figure class="vid w-wide" data-video>
<div class="vid__media"><a class="vid__open" href="${esc(v.src)}" data-w="${v.poster.width}" data-h="${v.poster.height}">${img(v.poster, { cls: 'vid__poster' })}<span class="vid__play">${PLAY}${esc(label)}</span><span class="vid__meta">${esc(v.duration)} · ${v.sound ? 'with sound' : 'no sound'} · ${esc(v.size)}</span></a></div>
${figcaption(v.caption, v.credit)}
<ol class="vid__text" id="${videoId(v.src)}-text">
${(v.text ?? []).map(line).join('\n')}
</ol>
</figure>`;
};

// a silent loop over its own still: readers without JS see the still, the script adds sources near the viewport
const loop = (c: ICase, v: IVideo) => {
  if (v.sound || seconds(v.duration) > 10) fail(c, `${v.src}: a loop is silent and 10 seconds at most`);
  return `<figure class="vid vid--loop w-wide" data-loop>
<div class="vid__media">${img(v.poster, { cls: 'vid__still' })}<video class="vid__loop" muted loop playsinline preload="none" data-src="${esc(v.src)}" data-poster="${esc(v.poster.src)}" width="${v.poster.width}" height="${v.poster.height}" aria-hidden="true"></video><button class="vid__toggle" type="button" hidden>Pause the loop</button></div>
${figcaption(v.caption, v.credit)}
</figure>`;
};

export const video = (c: ICase, v: IVideo) => (v.loop ? loop(c, v) : clip(c, v));
// #endregion

// #region Compare
const side = (x: ICompareSide, cls: string, eager: boolean) =>
  `<picture class="${cls}">${x.phone ? `<source media="(max-width: 699px)" srcset="${esc(x.phone.src)}" width="${x.phone.width}" height="${x.phone.height}" />` : ''}${img(x, { srcset: x.srcset, sizes: x.sizes, eager })}</picture>`;

const sideLabel = (x: ICompareSide, dated: boolean) => `${esc(x.label)}${dated ? `<span class="cmp__when"> · ${esc(x.captured)}</span>` : ''}`;

// {v} is the before side's share of the frame, {w} the after side's; compare.ts fills the same template as the handle moves
const fillValueText = (template: string, v: number) => template.replace('{v}', String(v)).replace('{w}', String(100 - v));

// before left of the handle, after right; the start state is drawn in CSS, so the frame is right before any script runs
export const compare = (c: ICase, s: ICompare) => {
  const start = s.start ?? 50;
  const words = s.valueText ?? `{v} percent ${s.before.label}, {w} percent ${s.after.label}`;
  const ratio = `--cmp-ratio:${s.after.width} / ${s.after.height}${s.after.phone ? `;--cmp-ratio-phone:${s.after.phone.width} / ${s.after.phone.height}` : ''}`;
  const credit = `${s.before.label} captured ${s.before.captured}; ${s.after.label} captured ${s.after.captured}${s.credit ? `. ${s.credit}` : ''}`;
  return `<figure class="cmp${WIDTH[s.width ?? 'bleed']}" data-compare data-start="${start}" data-valuetext="${esc(words)}" style="--start:${start};${ratio}">
<div class="cmp__frame">
${side(s.after, 'cmp__after', !!s.eager)}
<div class="cmp__clip"><div class="cmp__inner">${side(s.before, 'cmp__before', !!s.eager)}</div></div>
<span class="cmp__label cmp__label--before">${sideLabel(s.before, !!s.dated)}</span>
<span class="cmp__label cmp__label--after">${sideLabel(s.after, !!s.dated)}</span>
<input class="cmp__range" type="range" min="0" max="100" step="1" value="${start}" aria-label="${esc(s.label)}" aria-valuetext="${esc(fillValueText(words, start))}" disabled />
<div class="cmp__handle" aria-hidden="true"><span class="cmp__grip">${GRIP}</span><span class="cmp__wait">Loading comparison</span></div>
</div>
${s.under ? `${s.under}\n` : ''}<figcaption>${s.badge ? `${badge(s.badge)} ` : ''}<span class="fig__cap">${esc(s.caption)}${s.prov?.length ? ` ${chips(c, s.prov)}` : ''}</span> <span class="fig__credit">${esc(credit)}</span></figcaption>
</figure>`;
};
// #endregion

// #region Calculator
// a default off its own step would load as an invalid field, since the browser checks the step too
const onStep = (v: number, min: number, step: number) => {
  const n = (v - min) / step;
  return Math.abs(n - Math.round(n)) < 1e-9;
};

// r is the case model's result for the defaults: what readers without JS see, and what the live script starts from
export const calculator = (c: ICase, k: ICalc, r: ICalcResult) => {
  if (k.inputs.length > 4) fail(c, `calculator ${k.id}: ${k.inputs.length} inputs, it takes 4 at most`);
  const ids = k.inputs.map((x) => `${k.id}-${x.id}`);
  const fields = k.inputs.map((x, i) => {
    if (x.value < x.min || x.value > x.max) fail(c, `calculator ${k.id}: ${x.id} starts at ${x.value}, outside ${x.min} to ${x.max}`);
    if (!onStep(x.value, x.min, x.step)) fail(c, `calculator ${k.id}: ${x.id} starts at ${x.value}, off its step of ${x.step}`);
    if (x.kind === 'measured' && !x.source) fail(c, `calculator ${k.id}: ${x.id} is measured, so it needs a source`);
    const id = ids[i];
    const fill = ((x.value - x.min) / (x.max - x.min || 1)) * 100;
    return `<div class="calc__field" data-default="${x.value}">
<label for="${id}">${esc(x.label)}</label>
<span class="calc__kind">${x.source ? prov(c, { kind: x.kind, source: x.source }) : provLabel(x.kind)}<span class="prov prov--yours" hidden>Your number</span></span>
<div class="calc__ctl">
<input type="range" id="${id}-r" aria-label="${esc(`${x.label}, slider`)}" min="${x.min}" max="${x.max}" step="${x.sliderStep ?? x.step}" value="${x.value}" style="--fill:${Math.round(fill * 10) / 10}%" disabled />
<input type="number" id="${id}" name="${esc(x.id)}" inputmode="decimal" min="${x.min}" max="${x.max}" step="${x.step}" value="${x.value}" aria-describedby="${id}-help" disabled />
<span class="calc__unit">${esc(x.unit)}</span>
</div>
<p class="calc__help" id="${id}-help">${esc(x.help)}</p>
<p class="calc__error" id="${id}-err"${x.error ? ` data-message="${esc(x.error)}"` : ''} hidden></p>
</div>`;
  });
  return `<form class="calc w-wide" id="${esc(k.id)}" aria-labelledby="${esc(k.id)}-h" novalidate data-calc>
<h3 id="${esc(k.id)}-h">${esc(k.title)}</h3>
<div class="calc__fields">
${fields.join('\n')}
</div>
<div class="calc__out">
<p class="calc__figure" aria-hidden="true"${k.figureUnit ? ` data-unit="${esc(k.figureUnit)}"` : ''}>${esc(r.figure)}</p>
<output class="calc__sentence" for="${ids.join(' ')}" aria-live="polite">${esc(r.sentence)}</output>
${prov(c, { kind: 'modelled', source: k.source })}
<p class="calc__stale" hidden>Showing the last valid result.</p>
</div>
<details class="calc__math"><summary>Show the math</summary><ol class="calc__lines">${r.math.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>
${k.leavesOut.length ? `<div class="calc__leaves"><h4>What this leaves out</h4><ul>${k.leavesOut.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>\n` : ''}<div class="calc__foot"><button type="button" class="pill calc__reset">Reset to examples</button><p>Runs in your browser. Nothing is sent.</p><p class="calc__nojs">Turn on JavaScript to change the inputs.</p></div>
</form>`;
};
// #endregion

// #region Versions and milestones
// the list is also the phone, no JavaScript and reduced motion form; from 700px a script turns it into tabs.
// A thumb joins the capture's srcset as its smallest width, so each tab picks it through its own sizes.
const versionImg = (v: IVersion) => {
  if (!v.img) return '';
  const thumb = v.thumb ? `${v.thumb.src} ${v.thumb.width}w` : '';
  const srcset = [thumb, v.srcset ?? ''].filter(Boolean).join(', ');
  return img(v.img, { srcset: srcset || undefined, sizes: v.sizes });
};

export const versions = (c: ICase, list: IVersion[], o: { id?: string; cut?: number } = {}) => {
  const id = o.id ?? 'versions';
  return `<div class="versions w-wide" id="${esc(id)}" data-versions${o.cut ? ` data-cut="${o.cut}"` : ''}>
<ol class="versions__list">
${list
  .map(
    (v, i) => `<li class="versions__item" id="${esc(id)}-${i + 1}"${v.tab ? ` data-tab="${esc(v.tab)}"` : ''}>${versionImg(v)}<p class="versions__meta">${esc(v.label)} · ${esc(v.date)}</p><p class="versions__change">${esc(v.change)}</p><p class="versions__why">${prose(c, v.why)}</p>${
      v.weight ? `<p class="versions__weight">${esc(v.weight.value)} ${esc(v.weight.label)} ${prov(c, v.weight)}</p>` : ''
    }</li>`,
  )
  .join('\n')}
</ol>
</div>`;
};

// text first: the last milestone is the latest and takes the accent; a ref sits between the reason and its chips
export const milestones = (c: ICase, list: IMilestone[]) => `<ol class="milestones">
${list
  .map((m, i) => {
    const why = proseOf(m.why);
    return `<li class="milestone${i === list.length - 1 ? ' milestone--latest' : ''}"><p class="milestone__when">${esc(m.when)}${m.time ? `<span class="milestone__time">${esc(m.time)}</span>` : ''}</p><div class="milestone__body">${
      m.name ? `<p class="milestone__name">${esc(m.name)}</p>` : ''
    }<p class="milestone__change">${esc(m.change)}</p><p class="milestone__why">${esc(why.text)}${m.ref ? ` <span class="milestone__ref">${esc(m.ref)}</span>` : ''}${why.prov.length ? ` ${chips(c, why.prov)}` : ''}</p></div></li>`;
  })
  .join('\n')}
</ol>`;
// #endregion

// #region Turn and setup
// one tile beside the cost, or several side by side
const costTiles = (c: ICase, m: ITurn['costMetric']) => {
  if (!m) return '';
  const list = Array.isArray(m) ? m : [m];
  return list.length > 1 ? `<div class="metrics">${list.map((x) => metricTile(c, x)).join('')}</div>` : metricTile(c, list[0]);
};

// what everyone expected and its cost, the turn line, what I built; the L is drawn in CSS so it exists without JS
export const turn = (c: ICase, t: ITurn, o: ITurnOptions = {}) => {
  const id = o.id ?? 'the-turn';
  const ruled = t.ruledOut?.length
    ? `<ul class="turn__ruled">${t.ruledOut
        .map((r) => `<li><span class="turn__name">${esc(r.name)}<span class="turn__strike" aria-hidden="true"></span></span> ${esc(r.reason)} ${prov(c, r)}</li>`)
        .join('')}</ul>\n`
    : '';
  const built = (Array.isArray(t.built) ? t.built : [t.built]).map((p) => `<p>${prose(c, p)}</p>`).join('\n');
  return `<section class="ch turn" id="${esc(id)}" aria-labelledby="${esc(id)}-h" data-turn data-turn-ms="${o.ms ?? 1200}"${o.steps ? ` data-turn-steps="${o.steps}"` : ''}${o.marker === false ? ' data-turn-marker="none"' : ''}>
<h2 id="${esc(id)}-h">${esc(t.title)}</h2>
${o.head ? `${o.head}\n` : ''}<div class="turn__grid w-wide">
<div class="turn__old turn__old--expected"><h3>The obvious way</h3><p>${prose(c, t.expected)}</p>
${ruled}</div>
<div class="turn__old turn__old--cost"><h3>What it would cost</h3><p>${prose(c, t.cost)}</p>${costTiles(c, t.costMetric)}</div>
<p class="turn__line">${esc(t.line)}</p>
<div class="turn__new"><h3>What I built</h3>${built}</div>
<div class="turn__path" aria-hidden="true"><span class="turn__marker"></span></div>
</div>
${o.after ? `${o.after}\n` : ''}</section>`;
};

// who, how long and how that is known stay together, so a chip never wraps away from its time
const setupMeta = (c: ICase, x: ISetup['steps'][number]) =>
  `<span class="setup__meta"><span class="setup__who">${esc(x.who)}</span>${x.time ? `<span class="setup__time">${esc(x.time)}</span>` : ''}${
    x.kind ? prov(c, { kind: x.kind, source: x.source ?? '' }) : ''
  }</span>`;

// ease shown as smallness: who does each step, how long when sourced, and the way back
export const setup = (c: ICase, s: ISetup, o: { wide?: boolean } = {}) => {
  const n = s.steps.length;
  const sum = s.sum ?? `${n} ${n === 1 ? 'step' : 'steps'}.`;
  const was = s.was
    ? `<div class="setup__was"><p class="label">${esc(s.was.label)}</p><ul class="setup__old">${s.was.items
        .map((x) => (x.struck ? `<li class="setup__struck">${esc(x.text)}<span class="sr-only"> (removed)</span></li>` : `<li>${esc(x.text)}</li>`))
        .join('')}</ul></div>\n`
    : '';
  return `<div class="setup${s.was ? ' setup--folded' : ''}${s.was || o.wide ? ' w-wide' : ''}">
<p class="setup__sum">${prose(c, sum)}${s.total ? ` ${esc(s.total.value)} ${esc(s.total.label)} ${prov(c, s.total)}` : ''}</p>
${was}<ol class="setup__list">
${s.steps
  .map(
    (x, i) =>
      `<li${x.lit ? ' class="setup__lit"' : ''}><span class="setup__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="setup__do">${prose(c, x.action)}</span>${setupMeta(c, x)}${x.note ? `<p class="setup__note">${esc(x.note)}</p>` : ''}</li>`,
  )
  .join('\n')}
</ol>
<p class="setup__back">The way back: ${prose(c, s.back)}</p>
</div>`;
};
// #endregion

// #region Closing: offer, sources, pager
// the overview's enquiry line uses this too, so every enquiry reaches the one public address in profile.json
export const enquiryHref = (subject: string) =>
  `mailto:${P.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${P.name.split(' ')[0]},\r\n\r\nMy business:\r\nWhat I want to change:\r\n`)}`;

// the sellable model and a way to ask; never a price, a plan name, a discount or a form
export const offer = (c: ICase) => `<section class="offer w-wide" id="get-this" aria-labelledby="offer-h">
<h2 id="offer-h">Get this for your business</h2>
<dl class="offer__spec">
<div><dt>Who it is for</dt><dd>${esc(c.offer.who)}</dd></div>
<div><dt>What you get</dt><dd>${esc(c.offer.gets)}</dd></div>
<div><dt>What you need</dt><dd>${esc(c.offer.needs)}</dd></div>
<div><dt>Setup</dt><dd>${esc(c.offer.setup)}</dd></div>
</dl>
${c.offer.also ? `<p class="offer__also">${esc(c.offer.also)}</p>\n` : ''}<div class="offer__act">
<a class="pill pill--solid offer__cta" href="${esc(enquiryHref(`Case study enquiry: ${c.title}`))}">Email me about this</a>
<p class="offer__addr">${esc(P.email)}</p>
</div>
<p class="offer__note">No prices here. I scope each setup after I hear how your work runs today.</p>
</section>`;

export const sources = (c: ICase) => `<section class="sources w-wide" id="sources" aria-labelledby="sources-h">
<h2 id="sources-h">How these numbers were measured</h2>
<dl class="sources__key">
${(Object.keys(KINDS) as TKind[]).map((k) => `<div><dt>${provLabel(k)}</dt><dd>${esc(KIND_MEANS[k])}</dd></div>`).join('\n')}
</dl>
<ol class="sources__list">
${c.sources.map((s, i) => `<li id="src-${i + 1}"><span class="sources__n">${i + 1}</span><p>${esc(s.text)}${s.url ? ` ${outLink(s.url)}` : ''}</p></li>`).join('\n')}
</ol>
${
  c.credits?.length
    ? `<h3>Credits</h3>
<ul class="credits">
${c.credits.map((x) => `<li>${esc(x.text)}${x.url ? ` ${outLink(x.url)}` : ''}</li>`).join('\n')}
</ul>
`
    : ''
}</section>`;

// registry order, wrapping around; two cases show only the other one, so no link appears twice
export const pager = (c: ICase, cases: ICase[]) => {
  const i = cases.findIndex((x) => x.slug === c.slug);
  const n = cases.length;
  const link = (x: ICase, rel: 'prev' | 'next') =>
    `<a href="/case-studies/${x.slug}/" rel="${rel}" style="--a:${esc(x.accent)}"><small>${rel === 'prev' ? 'Previous case' : 'Next case'}</small><strong>${esc(x.title)}</strong><span class="pager__deck">${esc(x.deck)}</span>${ARROW}</a>`;
  const links = i < 0 || n < 2 ? [] : n === 2 ? [link(cases[(i + 1) % n], 'next')] : [link(cases[(i - 1 + n) % n], 'prev'), link(cases[(i + 1) % n], 'next')];
  return `<nav class="pager pager--case" aria-label="More case studies">
${links.map((x) => `${x}\n`).join('')}<a class="pager__all" href="/case-studies/">All case studies</a>
</nav>`;
};
// #endregion
