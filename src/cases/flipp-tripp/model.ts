import type { ILeafPose, TPhase } from './blocks';

// Pure maths shared by page.ts (the first frame in the HTML) and the stage module (every frame after it). No DOM, no Node.

// #region One flip at time t
export interface IFlipTiming {
  leafMs: number;
  stepMs: number;
  shade: number;
}

export interface IFlipPose {
  step: 1 | 2;
  // milliseconds into the current step
  u: number;
  phase: TPhase;
  prev: string;
  next: string;
  top: string;
  bottom: string;
  fold?: ILeafPose;
  land?: ILeafPose;
  // the moving flap in the side view, degrees about the hinge: the fold turns from up, the landing leaf from down
  side: { leaf: 'fold' | 'land'; deg: number };
}

// t runs over one example flip of two steps: from, through one random glyph, to
export const flipAt = (t: number, glyphs: [string, string, string], o: IFlipTiming, ease: (x: number) => number): IFlipPose => {
  const step = t <= o.stepMs ? 1 : 2;
  const u = step === 1 ? t : t - o.stepMs;
  const prev = glyphs[step - 1];
  const next = glyphs[step];
  const base = { step, u, prev, next } as const;
  if (u <= 0) return { ...base, phase: 'rest', top: prev, bottom: prev, side: { leaf: 'fold', deg: 0 } };
  if (u >= o.stepMs) return { ...base, phase: 'landed', top: next, bottom: next, side: { leaf: 'land', deg: 0 } };
  if (u < o.leafMs) {
    const k = u / o.leafMs;
    return { ...base, phase: 'fold', top: next, bottom: prev, fold: { glyph: prev, deg: -90 * k, shade: o.shade * k }, side: { leaf: 'fold', deg: 90 * k } };
  }
  if (u === o.leafMs) return { ...base, phase: 'edge', top: next, bottom: prev, side: { leaf: 'fold', deg: 90 } };
  const q = (u - o.leafMs) / o.leafMs;
  const deg = 90 * (1 - ease(q));
  return { ...base, phase: 'land', top: next, bottom: prev, land: { glyph: next, deg, shade: o.shade * (1 - q) }, side: { leaf: 'land', deg: -deg } };
};

export const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (m, k: string) => String(values[k] ?? m));

// a readout keeps two lines, so a longer phase or a new timing never rewraps it, and nothing under it moves
const SEP = ' · ';
const breakAt = (text: string, at: number) => (at < 0 ? text : `${text.slice(0, at)}\n${text.slice(at + SEP.length)}`);

export const readoutText = (p: IFlipPose, o: { template: string; slow: string; phases: Record<TPhase, string> }, slow: boolean) => {
  const text = fill(o.template, { step: p.step, ms: Math.round(p.u), phase: o.phases[p.phase] });
  return `${breakAt(text, text.lastIndexOf(SEP))}${slow ? `${SEP}${o.slow}` : ''}`;
};

// the reader's flip: what it times on the first line, the timing on the second; before a flip only the first
export const boardReadout = (template: string, timing?: { first: number; still: number }) => {
  const text = fill(template, timing ?? {});
  const at = text.indexOf(SEP);
  return timing ? breakAt(text, at) : text.slice(0, at < 0 ? undefined : at);
};

export const valueText = (t: number, p: IFlipPose, o: Record<TPhase, string>) => fill(o[p.phase], { t, step: p.step, next: p.next, prev: p.prev, glyph: p.next });

// the step text whose range holds t: rest, fold, land, then the press and settle
export const stepIndex = (t: number, ranges: { from: number; to: number }[]) => ranges.findIndex((r) => t >= r.from && t <= r.to);
// #endregion

// #region The board's words
export const normalise = (text: string) => text.trim().replace(/\s+/g, ' ').toUpperCase();

// glyphs the board cannot show, each once, at most three
export const offenders = (text: string, pool: string) => [...new Set([...text].filter((ch) => ch !== ' ' && !pool.includes(ch)))].slice(0, 3);

export const quoteList = (chars: string[]) => {
  const q = chars.map((ch) => `“${ch}”`);
  return q.length < 2 ? q.join('') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
};

// two rows of cols, breaking at the last space that fits; a single long word breaks hard; undefined needs a third row
export const rowsFor = (text: string, cols: number): [string, string] | undefined => {
  if (text.length <= cols) return [text, ''];
  const i = text.lastIndexOf(' ', cols);
  if (i > 0 && text.length - i - 1 <= cols) return [text.slice(0, i), text.slice(i + 1)];
  if (!text.slice(0, cols + 1).includes(' ') && text.length <= 2 * cols) return [text.slice(0, cols), text.slice(cols)];
  return undefined;
};

export const centre = (row: string, cols: number) => {
  const left = Math.floor((cols - row.length) / 2);
  return `${' '.repeat(left)}${row}${' '.repeat(cols - row.length - left)}`;
};

export const sentenceCase = (rows: string[]) => {
  const s = rows.filter(Boolean).join(' ').toLowerCase();
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
};

// #endregion
