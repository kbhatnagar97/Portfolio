import { esc } from '../../html/core';
import { prov } from '../build/parts';
import type { ICase } from '../build/types';
import type { IRichFigure, TRich, TRichPart } from './blocks';

// Build time only. Rich text from the content file: every number is followed by its provenance chip.

export const isFigure = (p: TRichPart | undefined): p is IRichFigure => typeof p === 'object' && 'n' in p;

// punctuation right after a chip stays on the chip's line, so no line ever starts with a comma or a full stop
const TAIL = /^[.,;:!?)]+/;

export const rich = (c: ICase, r: TRich) => {
  if (typeof r === 'string') return esc(r);
  let html = '';
  // characters at the start of the next string that were already set beside a chip
  let taken = 0;
  r.forEach((p, i) => {
    if (typeof p === 'string') {
      html += esc(p.slice(taken));
      taken = 0;
      return;
    }
    const next = r[i + 1];
    const tail = typeof next === 'string' ? (TAIL.exec(next)?.[0] ?? '') : '';
    const chip = tail ? `<span class="prov-hold">${prov(c, p)}${esc(tail)}</span>` : prov(c, p);
    html += isFigure(p) ? `${esc(p.n)} ${chip}` : ` ${chip}`;
    taken = tail.length;
  });
  return html;
};

// the same text as one string with [kind:source] markers, for a kit partial that takes plain prose; the shell turns
// each marker into its chip where it sits
export const marked = (r: TRich) =>
  typeof r === 'string' ? r : r.map((p) => (typeof p === 'string' ? p : `${isFigure(p) ? `${p.n} ` : ' '}[${p.kind}:${p.source}]`)).join('');

// a worked sum in the content marks the end of each step with " · ", so it can be set one step per line
export const richLines = (r: TRich, sep = ' · '): TRichPart[][] => {
  const lines: TRichPart[][] = [[]];
  for (const p of typeof r === 'string' ? [r] : r) {
    if (typeof p !== 'string') {
      lines[lines.length - 1].push(p);
      continue;
    }
    p.split(sep).forEach((s, i) => {
      if (i) lines.push([]);
      if (s) lines[lines.length - 1].push(s);
    });
  }
  return lines;
};
