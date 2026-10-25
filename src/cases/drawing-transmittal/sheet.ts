import { esc } from '../../html/core';
import type { IStageBlock, ITitleBlock } from './types';

// Build time only. The sample drawing sheet as inline SVG on a 528 by 376 grid of 8 units: a plan, a revision table
// and a title block. Every value the scan reads carries data-f, so the stage script can swap samples and fly them out.

// #region Geometry, in sheet units
export const SHEET = { w: 528, h: 376 };
// the scan reads the revision table and the title block, left to right
export const SCAN = { x: 312, w: 200, y: 208, h: 152 };
const TB = { x: 312, y: 248, value: 376, rule: 370, row: 16 };
const REV = { y: 208, cols: [318, 344, 412] };
// rows of the title block under the practice name, top edges
const ROWS = { job: 280, code: 296, title: 312, sheet: 328, issued: 344 };
// the five values the scan highlights; x and width in sheet units
export const WASHES = [
  { f: 'rev', x: 314, y: REV.y + 18.5, w: 196 },
  { f: 'code', x: TB.value - 3, y: ROWS.code + 2.5, w: 135 },
  { f: 'title', x: TB.value - 3, y: ROWS.title + 2.5, w: 135 },
  { f: 'sheet', x: TB.value - 3, y: ROWS.sheet + 2.5, w: 135 },
  { f: 'issued', x: TB.value - 3, y: ROWS.issued + 2.5, w: 135 },
] as const;
const GRID_X = [80, 144, 208, 272];
const GRID_Y = [96, 160, 224];
// #endregion

// #region Drawing
// a revision cloud: semicircles bulging outward, drawn clockwise around a box
const cloud = (x: number, y: number, w: number, h: number, step = 8) => {
  const r = step / 2;
  const arcs = (n: number, dx: number, dy: number) => Array.from({ length: n }, () => `a${r} ${r} 0 0 1 ${dx} ${dy}`).join('');
  return `M${x} ${y}${arcs(w / step, step, 0)}${arcs(h / step, 0, step)}${arcs(w / step, -step, 0)}${arcs(h / step, 0, -step)}z`;
};

// the plan never changes between samples, so it is drawn once and every sheet on the page uses it
const plan = () => {
  const grid = [...GRID_X.map((x) => `M${x} 36V264`), ...GRID_Y.map((y) => `M36 ${y}H304`)].join('');
  const bubbles = [
    ...GRID_X.map((x, i) => `<circle class="sh-bub" cx="${x}" cy="24" r="8"/><text class="sh-bt" x="${x}" y="26.8">${'ABCD'[i]}</text>`),
    ...GRID_Y.map((y, i) => `<circle class="sh-bub" cx="24" cy="${y}" r="8"/><text class="sh-bt" x="24" y="${y + 2.8}">${i + 1}</text>`),
  ].join('');
  const columns = [GRID_Y[0], GRID_Y[2]].flatMap((y) => GRID_X.map((x) => `M${x - 4} ${y}a4 4 0 1 0 8 0a4 4 0 1 0-8 0`)).join('');
  const treads = [56, 62, 68, 74, 80, 86].map((y) => `M216 ${y}H264`).join('');
  return `<g id="dt-plan">
<rect class="sh-b" x="8.5" y="8.5" width="511" height="359"/>
<path class="sh-g" d="${grid}"/>${bubbles}
<path class="sh-w" d="M152 248H48V48H296V248H200"/>
<path class="sh-p" d="M120 48V112M120 136V160H48M176 160H296M120 136H144M120 112A24 24 0 0 1 144 136M152 248V224M200 248V224M152 224A24 24 0 0 1 176 248M200 224A24 24 0 0 0 176 248M216 52h48v40h-48z${treads}M240 88V60M236 64l4-4 4 4"/>
<path class="sh-col" d="${columns}"/>
<g class="sh-n"><circle cx="492" cy="44" r="10"/><path d="M492 35l5 16-5-4-5 4z"/></g>
<path class="sh-note" d="M320 32H440M320 44H480M320 56H408M320 68H464M48 300H144M48 296V304M72 296V304M96 296V304M144 296V304"/>
</g>`;
};

// outside the stage's frame and storyboard, so it stays defined whichever of the two is showing
export const sheetDefs = () => `<svg class="dt-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${plan()}</defs></svg>`;

const titleBlock = (s: IStageBlock, t: ITitleBlock) => {
  const L = s.sheet.labels;
  const row = (y: number, label: string, f: string, value: string) =>
    `<text class="sh-l" x="${TB.x + 6}" y="${y + 10}">${esc(label)}</text><text class="sh-v" x="${TB.value}" y="${y + 11}" data-f="${f}">${esc(value)}</text>`;
  const rules = [ROWS.job, ROWS.code, ROWS.title, ROWS.sheet, ROWS.issued].map((y) => `M${TB.x} ${y}H512`).join('');
  return `<rect class="sh-tb" x="${TB.x}" y="${TB.y}" width="200" height="112"/><path class="sh-tr" d="${rules}M${TB.rule} ${ROWS.job}V360"/>
<text class="sh-v sh-v--firm" x="${TB.x + 6}" y="${TB.y + 20}">${esc(s.sheet.practice)}</text>
${row(ROWS.job, L.job, 'job', s.sheet.job)}
${row(ROWS.code, L.code, 'code', t.code)}
${row(ROWS.title, L.title, 'title', t.title)}
${row(ROWS.sheet, L.sheet, 'sheet', t.sheet)}
${row(ROWS.issued, L.issued, 'issued', t.issued)}`;
};

const revisionTable = (s: IStageBlock, t: ITitleBlock) => {
  const [rev, date, change] = t.revisions[0] ?? ['', '', ''];
  const head = s.sheet.labels.revTable.map((h, i) => `<text class="sh-l" x="${REV.cols[i]}" y="${REV.y + 10}">${esc(h)}</text>`).join('');
  return `<rect class="sh-tb" x="${TB.x}" y="${REV.y}" width="200" height="32"/><path class="sh-tr" d="M${TB.x} ${REV.y + 16}H512"/>${head}
<text class="sh-v" x="${REV.cols[0]}" y="${REV.y + 27}" data-f="rev">${esc(rev)}</text><text class="sh-v" x="${REV.cols[1]}" y="${REV.y + 27}" data-f="revDate">${esc(date)}</text><text class="sh-v" x="${REV.cols[2]}" y="${REV.y + 27}" data-f="change">${esc(change)}</text>`;
};

const washes = (cls: string) =>
  WASHES.map((w) => `<rect class="${cls}" data-w="${w.f}" x="${w.x}" y="${w.y}" width="${w.w}" height="11"/>`).join('');
// #endregion

// live: the stage's sheet, with the scan, washes and revision cloud it animates; story: the storyboard still, fields boxed
export const sheetSvg = (s: IStageBlock, t: ITitleBlock, mode: 'live' | 'story') => {
  const cloudOn = mode === 'story' && t.revisions.length ? ' is-on' : '';
  const live =
    mode === 'live'
      ? `<clipPath id="dt-scan-clip"><rect x="${SCAN.x}" y="${SCAN.y}" width="${SCAN.w}" height="${SCAN.h}"/></clipPath>
<g clip-path="url(#dt-scan-clip)"><g class="sh-scan"><rect class="sh-band" x="${SCAN.x - 24}" y="${SCAN.y}" width="24" height="${SCAN.h}"/><rect class="sh-bar" x="${SCAN.x - 1}" y="${SCAN.y}" width="2" height="${SCAN.h}"/></g></g>`
      : washes('sh-box');
  return `<svg class="dt-sheet" viewBox="0 0 ${SHEET.w} ${SHEET.h}" width="${SHEET.w}" height="${SHEET.h}" aria-hidden="true" focusable="false">
<use href="#dt-plan"/>
<path class="sh-cloud${cloudOn}" d="${cloud(136, 232, 80, 32)}"/>
${mode === 'live' ? washes('sh-wash') : ''}
${revisionTable(s, t)}
${titleBlock(s, t)}
${live}
</svg>`;
};
