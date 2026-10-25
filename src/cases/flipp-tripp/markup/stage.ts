import { esc } from '../../../html/core';
import { badge, chips, dataBlock, figure, metricTiles, readout, stage, storyboard } from '../../build/parts';
import type { ICase } from '../../build/types';
import { EASE } from '../../shared/ease';
import type { IBoardBlock, ICutBlock, ILeafPose, ILoadAxis, IMeasuredBlock, IPressAxis, IStageBlock, IStageData } from '../blocks';
import { boardReadout, centre, flipAt, normalise, readoutText, rowsFor, valueText } from '../model';
import { boardRowsHtml, glyphAttr, tileHtml } from '../tiles';
import { linked, prose } from './common';

// Build time only. The stage in three parts: one flap taken apart, a board the reader types on, and the review build measured.

// a chapter's body is at most 912px wide from 1100px; below that a figure spans the screen
export const FIGURE_SIZES = '(width >= 1100px) 912px, 100vw';
// the press frames stay at read width, so seven rows of tiles never outgrow the screen
const FRAMES_SIZES = '(width >= 768px) 720px, 100vw';

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const pct = (v: number, max: number) => `${round((v / max) * 100, 2)}%`;

// #region Part 1: one flip, taken apart
// a posed leaf carries its transform; an unposed one waits hidden for the slider
const leaf = (kind: 'fold' | 'land', pose?: ILeafPose) =>
  pose
    ? `<span class="ft-leaf ft-leaf--${kind}" data-g="${glyphAttr(pose.glyph)}" style="transform:rotateX(${round(pose.deg)}deg)"><span class="ft-shade" style="opacity:${round(pose.shade, 2)}"></span></span>`
    : `<span class="ft-leaf ft-leaf--${kind}" hidden><span class="ft-shade"></span></span>`;

// the tile seen edge on: its face, the hinge, the moving flap and which side the reader looks from
const sideView = (deg: number, labels: ICutBlock['labels']) => `<div class="ft-side" aria-hidden="true">
<svg viewBox="0 0 220 336" width="220" height="336" fill="none" stroke-linecap="round" stroke-linejoin="round" focusable="false">
<line class="ft-side__face" x1="28" y1="24" x2="28" y2="312" stroke-width="2"/>
<g class="ft-side__leaf" data-leaf="fold" transform="rotate(${round(deg)} 28 168)" stroke-width="3"><line x1="28" y1="168" x2="28" y2="24"/></g>
<g class="ft-side__leaf" data-leaf="land" transform="rotate(0 28 168)" stroke-width="3" visibility="hidden"><line x1="28" y1="168" x2="28" y2="312"/></g>
<circle class="ft-side__hinge" cx="28" cy="168" r="3"/>
<path class="ft-side__eye" d="M216 252h-28m8-8-8 8 8 8" stroke-width="1.5"/>
</svg>
<span class="ft-side__you">${esc(labels.viewer)}</span>
<span class="ft-side__name">${esc(labels.side)}</span>
</div>`;

const CALLOUTS = ['topLeaf', 'bottomLeaf', 'fold', 'shade'] as const;

const pool = (cut: ICutBlock, glyphs: string) => {
  const { example: e, labels: l } = cut;
  const mark = (g: string) => (g === e.from ? ' class="is-from"' : g === e.via ? ' class="is-random"' : g === e.to ? ' class="is-to"' : '');
  return `<div class="ft-pool" aria-hidden="true">
<p class="ft-pool__name">${esc(l.pool)}</p>
<ol class="ft-pool__cells">${[...glyphs].map((g) => `<li${mark(g)}>${esc(g)}</li>`).join('')}</ol>
<ul class="ft-pool__key"><li class="is-from">${esc(`${l.from} ${e.from}`)}</li><li class="is-random">${esc(`${l.random} ${e.via}`)}</li><li class="is-to">${esc(`${l.to} ${e.to}`)}</li></ul>
</div>`;
};

// readers without JavaScript, and print, get the flip as four still frames
const storyFrames = (c: ICase, cut: ICutBlock) => `${storyboard(
  cut.storyboard.frames.map((f) => ({
    label: f.label,
    html: `<div class="ft-mini" aria-hidden="true">${tileHtml(f.topHalf, { bottom: f.bottomHalf, leaves: `${f.fold ? leaf('fold', f.fold) : ''}${f.land ? leaf('land', f.land) : ''}` })}</div><p>${esc(f.text)}</p>`,
  })),
)}
<p class="ft-cap ft-cut__story-cap">${prose(c, cut.storyboard.caption, cut.storyboard.prov)}</p>`;

// the controls follow the drawing, Play right under the slider, so on a phone the tile and what moves it share one screen; the pool comes last
const cutAway = (c: ICase, s: IStageBlock) => {
  const { cut } = s;
  const t = cut.slider.value;
  const pose = flipAt(t, [cut.example.from, cut.example.via, cut.example.to], s.tempo, EASE);
  const front = tileHtml(pose.top, { bottom: pose.bottom, leaves: `${leaf('fold', pose.fold)}${leaf('land', pose.land)}`, cls: 'ft-tile--big' });
  return `<div class="ft-cut">
<h3 id="ft-cut-h">${esc(cut.heading)}</h3>
<p class="ft-cut__example">${prose(c, cut.example.text, cut.example.prov)}</p>
<div class="ft-cut__live">
<div class="ft-view">
<p class="ft-view__badges">${badge(cut.badge)}<span class="badge ft-view__speed" hidden>${esc(cut.play.badge)}</span></p>
<div class="ft-front" aria-hidden="true">${front}${CALLOUTS.map((_, i) => `<span class="ft-callout ft-callout--${i + 1}">${i + 1}</span>`).join('')}</div>
${sideView(pose.side.deg, cut.labels)}
<ol class="ft-key" aria-hidden="true">${CALLOUTS.map((k, i) => `<li><span class="ft-callout">${i + 1}</span>${esc(cut.labels[k])}</li>`).join('')}</ol>
</div>
<div class="ft-cut__ctl">
${readout(readoutText(pose, cut.readout, false))}
<input class="ft-range" type="range" id="ft-step" min="${cut.slider.min}" max="${cut.slider.max}" step="${cut.slider.step}" value="${t}" aria-labelledby="ft-cut-h" aria-describedby="ft-step-help" aria-valuetext="${esc(valueText(t, pose, cut.valueText))}" disabled />
<p class="ft-scale" aria-hidden="true"><span>${cut.slider.min}</span><span>${s.tempo.stepMs}</span><span>${cut.slider.max} ms</span></p>
<button class="pill ft-play" type="button" disabled>${esc(cut.play.label)}</button>
<p class="ft-help" id="ft-step-help">${prose(c, cut.slider.help.text, cut.slider.help.prov)}</p>
</div>
${pool(cut, s.tempo.glyphs)}
<p class="ft-error" hidden>${esc(cut.loadError)}</p>
</div>
${storyFrames(c, cut)}
<p class="ft-nojs">${esc(cut.slider.noJs)}</p>
</div>`;
};
// #endregion

// #region Part 2: type a word
// both boards ship, one per width, so the first paint never waits for the script to pick a column count
const boardFor = (text: string, cols: number) => {
  const rows = rowsFor(normalise(text), cols) ?? ['', ''];
  return `<div class="ft-board ft-board--${cols}" data-cols="${cols}">${boardRowsHtml(rows.map((r) => centre(r, cols)))}</div>`;
};

const typeBoard = (c: ICase, b: IBoardBlock) => `<div class="ft-panel ft-type w-max">
<h3>${esc(b.heading)}</h3>
<form class="ft-form" novalidate>
<label for="ft-word">${esc(b.label)}</label>
<div class="ft-form__row">
<input id="ft-word" name="word" type="text" value="${esc(b.value)}" maxlength="${b.rows * b.columns}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-describedby="ft-word-help ft-word-err" disabled />
<button class="pill pill--solid ft-flip" type="submit" disabled>${esc(b.button)}</button>
</div>
<p class="ft-help" id="ft-word-help"><span class="ft-wide">${esc(b.help)}</span><span class="ft-narrow">${esc(b.helpPhone)}</span></p>
<p class="ft-form__error" id="ft-word-err" role="alert" hidden></p>
</form>
<div class="ft-type__view">
<div class="ft-housing" aria-hidden="true">${boardFor(b.value, b.columns)}${boardFor(b.value, b.columnsPhone)}</div>
${readout(boardReadout(b.readout))}
</div>
<p class="ft-status" role="status"></p>
<p class="ft-cap">${prose(c, b.caption.text, b.caption.prov)}</p>
<p class="ft-nojs">${esc(b.noJs)}</p>
</div>`;
// #endregion

// #region Part 3: measured on the review build
// each label sits above or below the axis, starting, ending or centred on its mark, so neighbours never share a line
type TSide = 'above' | 'below';
type TAlign = 'start' | 'end' | 'mid';
interface IKey {
  x: string;
  side: TSide;
  align: TAlign;
  html: string;
  // marks are numbered for the phone list; bands and reference lines show their swatch instead
  n?: number;
  swatch?: 'band' | 'still' | 'ref';
}

const key = (k: IKey) =>
  `<li class="ft-axis__key ft-axis__key--${k.side} ft-axis__key--${k.align}" style="--x:${k.x}">${
    k.n ? `<span class="ft-axis__n" aria-hidden="true">${k.n}</span>` : `<span class="ft-axis__sw ft-axis__sw--${k.swatch}" aria-hidden="true"></span>`
  }${k.html}</li>`;

const markText = (label: string, value: string) => `${esc(label)} <span class="ft-axis__v">${esc(value)}</span>`;

// a tick every `every` up to the axis end; the first and last align inward so neither leaves the chart, the last names the unit
const ticks = (max: number, every: number, unit: string) => {
  const last = Math.floor(max / every) * every;
  const list: string[] = [];
  for (let v = 0; v <= last; v += every) {
    const edge = v === 0 ? ' ft-axis__tick--start' : v === last ? ' ft-axis__tick--end' : '';
    list.push(`<span class="ft-axis__tick${edge}" style="--x:${pct(v, max)}">${v}${v === last ? `<span class="ft-axis__unit"> ${esc(unit)}</span>` : ''}</span>`);
  }
  return list.join('');
};

const axis = (title: string, plot: string, keys: IKey[], caption: string) => `<figure class="ft-axis">
<h4 class="ft-axis__title">${esc(title)}</h4>
<div class="ft-axis__chart">
<div class="ft-axis__plot" aria-hidden="true">${plot}</div>
<ol class="ft-axis__keys">${keys.map(key).join('')}</ol>
</div>
<figcaption>${caption}</figcaption>
</figure>`;

// press, first new flap, last new flap, still: 0 and 46 ms sit on opposite sides, 622 ms and the cap too
const PRESS_KEYS: [TSide, TAlign][] = [
  ['below', 'start'],
  ['above', 'start'],
  ['above', 'end'],
  ['below', 'end'],
];

const pressAxis = (c: ICase, a: IPressAxis) => {
  const first = a.marks[1];
  const still = a.marks[a.marks.length - 1];
  const plot = `<span class="ft-axis__line"></span><span class="ft-axis__band" style="--a:${pct(first.at, a.max)};--b:${pct(still.at, a.max)}"></span><span class="ft-axis__ref" style="--x:${pct(a.cap.at, a.max)}"></span>${a.marks
    .map((m, i) => `<span class="ft-axis__dot" style="--x:${pct(m.at, a.max)}">${i + 1}</span>`)
    .join('')}${ticks(a.max, a.tick, a.unit)}`;
  const keys = [
    ...a.marks.map((m, i): IKey => ({ x: pct(m.at, a.max), side: PRESS_KEYS[i][0], align: PRESS_KEYS[i][1], html: markText(m.label, m.value), n: i + 1 })),
    { x: pct(a.cap.at, a.max), side: 'above', align: 'end', html: markText(a.cap.label, a.cap.value), swatch: 'ref' } satisfies IKey,
  ];
  return axis(a.title, plot, keys, prose(c, a.caption.text, a.caption.prov));
};

const loadAxis = (c: ICase, a: ILoadAxis) => {
  const [settle, still] = a.bands;
  const band = (b: typeof settle, cls = '') => `<span class="ft-axis__band${cls}" style="--a:${pct(b.from, a.max)};--b:${pct(b.to, a.max)}"></span>`;
  const plot = `<span class="ft-axis__line"></span>${band(settle)}${band(still, ' ft-axis__band--still')}<span class="ft-axis__ref" style="--x:${pct(a.threshold.at, a.max)}"></span>${ticks(a.max, a.tick, a.unit)}`;
  const keys: IKey[] = [
    { x: pct(settle.from, a.max), side: 'above', align: 'start', html: markText(settle.label, settle.value), swatch: 'band' },
    { x: pct((still.from + still.to) / 2, a.max), side: 'above', align: 'mid', html: markText(still.label, still.value), swatch: 'still' },
    { x: pct(a.threshold.at, a.max), side: 'below', align: 'mid', html: markText(a.threshold.label, a.threshold.value), swatch: 'ref' },
  ];
  return axis(a.title, plot, keys, prose(c, a.caption.text, a.caption.prov));
};

const measured = (c: ICase, m: IMeasuredBlock) => `<div class="ft-ms w-wide">
<h3>${esc(m.heading)}</h3>
<p>${linked(m.intro.text, c.links[0] ? [{ text: 'review build', href: c.links[0].href }] : [])} ${chips(c, m.intro.prov)}</p>
${figure({ img: m.frames.img, srcset: m.frames.srcset, sizes: FRAMES_SIZES, caption: m.frames.caption, credit: m.frames.credit, width: 'read' })}
${pressAxis(c, m.press)}
${loadAxis(c, m.load)}
<figure class="ft-privacy">
${metricTiles(c, m.privacy.tiles)}
<figcaption>${prose(c, m.privacy.caption.text, m.privacy.caption.prov)}</figcaption>
</figure>
</div>`;
// #endregion

// only what the controls write; copy that only the HTML shows stays out of the data block
const stageData = ({ tempo, cut, board: b }: IStageBlock): IStageData => ({
  tempo,
  cut: {
    example: { from: cut.example.from, via: cut.example.via, to: cut.example.to },
    slider: { min: cut.slider.min, max: cut.slider.max, step: cut.slider.step, page: cut.slider.page },
    play: { label: cut.play.label, pause: cut.play.pause, factor: cut.play.factor },
    readout: cut.readout,
    valueText: cut.valueText,
    steps: cut.steps.map(({ from, to }) => ({ from, to })),
  },
  board: { rows: b.rows, columns: b.columns, columnsPhone: b.columnsPhone, phoneBelow: b.phoneBelow, value: b.value, errors: b.errors, announce: b.announce, same: b.same, narrowed: b.narrowed, readout: b.readout },
});

// the kit's stage holds one frame and its steps; this stage's other two parts follow inside the same section
export const stageHtml = (c: ICase, s: IStageBlock) =>
  stage(c, {
    title: s.heading,
    intro: s.intro,
    mode: 'static',
    frame: cutAway(c, s),
    steps: s.cut.steps.map((x) => prose(c, x.text, x.prov)),
    after: `${typeBoard(c, s.board)}\n${measured(c, s.measured)}\n${dataBlock(stageData(s), 'ft-data')}`,
  });
