import { esc } from '../../html/core';
import { compare, pair, stage } from '../build/parts';
import type { ICase } from '../build/types';
import type { ICompareBlock, IRace, IRaceSide, IStageBlock, TView } from './blocks';
import { cited, para } from './page-copy';

// Build time only. The stage: the old and new home page under one handle, then the weight counted in blocks.

// #region Compare views
const VIEWS: TView[] = ['desktop', 'phone'];

// one kit compare per screen; the desktop labels carry their dates, a phone frame has no room for them beside the handle
const pane = (c: ICase, k: ICompareBlock, view: TView) => {
  // each screen has its own pane, so the desktop compare carries no phone source of its own
  const [before, after] = [k.before, k.after].map(({ phone, ...desktop }) => (view === 'phone' ? phone : desktop));
  return `<div class="views__pane views__pane--${view}" data-view="${view}">
${compare(c, {
  label: k.rangeLabel,
  before,
  after,
  start: k.start,
  caption: k.caption[view],
  prov: k.cite,
  badge: k.badge,
  dated: view === 'desktop',
  valueText: k.valueText,
  width: 'read',
  // the floor light under the frame follows the handle
  under: '<div class="pool" aria-hidden="true"><span class="pool__light" data-cmp-follow></span></div>',
})}
</div>`;
};

const views = (c: ICase, s: IStageBlock) => `<div class="views">
<fieldset class="views__switch">
<legend class="views__legend">${esc(s.views.legend)}</legend>
<div class="views__opts">
${VIEWS.map((v) => `<input class="views__radio sr-only" type="radio" name="screen" id="screen-${v}" value="${v}" /><label for="screen-${v}">${esc(s.views[v])}</label>`).join('\n')}
</div>
</fieldset>
${VIEWS.map((v) => pane(c, s.compare, v)).join('\n')}
</div>`;
// #endregion

// #region The weight race
// the phrase is eight counts: a row of blocks lands on each count, the requests land as dots after the last row
const COUNTS = 8;

// whole blocks, then the last one drawn to its share of a block
const cells = (bytes: number, size: number) => {
  const whole = Math.floor(bytes / size);
  const part = bytes / size - whole;
  const list = Array.from({ length: whole }, () => '<span class="race__cell"></span>');
  if (part > 0) list.push(`<span class="race__cell race__cell--part"><span style="transform:scaleX(${part.toFixed(2)})"></span></span>`);
  return list;
};

const column = (side: IRaceSide, r: IRace, cls: 'old' | 'new') => {
  const list = cells(side.bytes, r.blockBytes);
  const rows = Array.from({ length: Math.ceil(list.length / r.perCount) }, (_, i) => `<span class="race__row">${list.slice(i * r.perCount, (i + 1) * r.perCount).join('')}</span>`);
  return `<div class="race__col race__col--${cls}">
<div class="race__stack">${rows.join('')}</div>
<span class="race__floor"></span>
<p class="race__label">${esc(side.label)}<span class="race__value">${esc(side.display)}</span></p>
<div class="race__dots">${'<span></span>'.repeat(side.requests)}</div>
</div>`;
};

const race = (c: ICase, r: IRace) => {
  const [before, after] = r.scrolled.rows;
  const digits = Array.from({ length: COUNTS }, (_, i) => `<span class="race__digit">${i + 1}</span>`).join(' ');
  // both floors sit level, under the taller stack
  const rows = Math.max(...[r.old, r.new].map((x) => Math.ceil(cells(x.bytes, r.blockBytes).length / r.perCount)));
  return `<figure class="race w-wide" aria-labelledby="race-h" data-count-ms="${r.countMs}">
<div class="race__text">
<h3 id="race-h">${esc(r.h3)}</h3>
<p class="race__intro">${cited(c, r.intro, r.introCite)}</p>
</div>
<div class="race__stage">
<div class="race__cols" aria-hidden="true" style="--rows:${rows};--per:${r.perCount}">
${column(r.old, r, 'old')}
${column(r.new, r, 'new')}
</div>
<p class="stage__readout race__readout" aria-hidden="true">${esc(r.readoutLabel)} ${digits}</p>
<button class="race__replay" type="button">${esc(r.replay)}</button>
</div>
<div class="race__facts">
${para(c, r.summary, 'race__sum')}
${pair(c, { caption: r.scrolled.caption, before: { label: before.k, value: before.value, v: before.v }, after: { label: after.k, value: after.value, v: after.v }, ...r.scrolled.cite[0] })}
<p class="race__note">${esc(r.scrolled.note)}</p>
${para(c, r.caveat, 'race__caveat')}
</div>
</figure>`;
};
// #endregion

// the kit's stage: the beat texts are what to look for in the compare, and the race follows inside the section
export const stageBlock = (c: ICase, s: IStageBlock) =>
  stage(c, {
    title: s.h2,
    intro: s.intro,
    frame: `${views(c, s)}\n<p class="label look__label">${esc(s.lookFor.label)}</p>`,
    steps: s.lookFor.items.map((x) => `<span class="look__term">${esc(x.term)}</span> ${cited(c, x.text, x.cite)}`),
    after: race(c, s.race),
  });
