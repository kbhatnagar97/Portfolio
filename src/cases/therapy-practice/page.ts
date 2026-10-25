import { esc } from '../../html/core';
import { chapter, figure, hero, prov, stage, turn, versions } from '../build/parts';
import type { ICase, TCaseRender } from '../build/types';
import type {
  IBlocks,
  IDraftBlock,
  IFoldRow,
  IGatewayBlock,
  IGuideRow,
  ILastingBlock,
  ILearnedBlock,
  ISetupBlock,
  IStageBlock,
  IStep,
  IVersionsBlock,
  TRich,
} from './blocks';
import { isFigure, marked, rich, richLines } from './rich';

// Build time only. The therapy practice story: one breath of a booking path, then six chapters at a 640px measure.

// #region Sizes and tempo handed to the kit
const DRAFT_SIZES = '(min-width: 720px) 640px, 92vw';
// the wide track is 1120px from a 1220px viewport; under that it is the viewport less the gutters
const VIEWER_SIZES = '(min-width: 1220px) 1120px, 92vw';
// the world's crossfade between captures and the turn's fade
const CROSSFADE_MS = 300;
const TURN_MS = 700;
// #endregion

// #region Stage: the path a client takes
const step = (c: ICase, s: IStep, last: boolean) => `<li class="path__step">
<span class="path__node" aria-hidden="true"><span class="path__on${last ? ' path__on--booked' : ''}"></span></span>
${last ? '' : '<span class="path__seg" aria-hidden="true"><span class="path__fill"></span></span>\n'}<p class="path__label">${esc(s.label)}</p>
<p class="path__text">${rich(c, s.text)}</p>
</li>`;

// the list carries every word and the CSS draws its end state, so the stage needs no storyboard and no steps of its own
const stageBlock = (c: ICase, s: IStageBlock) =>
  stage(c, {
    title: s.h2,
    intro: s.intro,
    frame: `<ol class="path" data-path>
${s.steps.map((x, i) => step(c, x, i === s.steps.length - 1)).join('\n')}
</ol>`,
    steps: [],
  });
// #endregion

// #region Her draft
const draft = (c: ICase, d: IDraftBlock) =>
  chapter(
    d.id,
    d.h2,
    `<p class="lede">${esc(d.lede)}</p>
${d.p.map((x) => `<p>${rich(c, x)}</p>`).join('\n')}
${figure({ ...d.figure, sizes: DRAFT_SIZES })}`,
  );
// #endregion

// #region No gateway
// the turn without its marker: the new way only fades in; the worked sum and its note sit under the grid
const gateway = (c: ICase, g: IGatewayBlock) => {
  const t = g.turn;
  const math = richLines(g.math).map((line) => `<li>${rich(c, line)}</li>`);
  return turn(
    c,
    { title: g.h2, expected: t.expected, cost: t.cost, costMetric: [t.costMetric, ...t.moreMetrics], line: t.line, built: t.built },
    { id: g.id, ms: TURN_MS, marker: false, after: `<ol class="gateway__math">${math.join('')}</ol>\n<p class="gateway__note">${rich(c, g.note)}</p>` },
  );
};
// #endregion

// #region Her setup
// the tag says where a struck row went, so the strike is never the only signal
const foldRow = (r: IFoldRow) =>
  `<li class="fold__row${r.struck ? ' fold__row--struck' : ''}"><span class="fold__do">${esc(r.do)}${r.struck ? '<span class="sr-only"> (left her list)</span>' : ''}</span><span class="fold__tag">${esc(r.tag)}</span></li>`;

const guideRow = (r: IGuideRow) =>
  `<li><span class="setup__n" aria-hidden="true">${esc(r.n)}</span><span class="setup__do">${esc(r.do)}</span><span class="setup__who">${esc(r.who)}</span></li>`;

const fold = (c: ICase, f: ISetupBlock['fold']) => `<figure class="fold w-wide">
<figcaption class="fold__cap">${rich(c, f.caption)}</figcaption>
<div class="fold__side"><h3 class="fold__title">${esc(f.before.title)}</h3><ul class="fold__rows">
${f.before.rows.map(foldRow).join('\n')}
</ul></div>
<div class="fold__side"><h3 class="fold__title">${esc(f.after.title)}</h3><ol class="setup__list">
${f.after.rows.map(guideRow).join('\n')}
</ol><p class="fold__mine">${esc(f.after.mine)}</p></div>
</figure>`;

// the page's one hero figure: the sum of the fold, its first number set at hero size
const total = (c: ICase, sum: TRich) => {
  const [first, ...rest] = typeof sum === 'string' ? [sum] : sum;
  if (!isFigure(first)) throw new Error(`case-pages: ${c.slug}: blocks.setup.sum must open with a number`);
  // the value stands on its own line, so the full stop that ended its sentence is not repeated
  const label = rest[0] === '. ' ? rest.slice(1) : rest;
  return `<p class="metric metric--hero setup__total"><span class="metric__value">${esc(first.n)}</span> ${prov(c, first)} <span class="metric__label">${rich(c, label)}</span></p>`;
};

// the day the checklist became the script and the links, one moment per line
const when = (c: ICase, timeline: TRich) => {
  const moments = richLines(timeline).map((line) => `<li>${rich(c, line)}</li>`);
  return `<ol class="setup__when">${moments.join('')}</ol>`;
};

const setupBlock = (c: ICase, s: ISetupBlock) =>
  chapter(
    s.id,
    s.h2,
    `<p class="lede">${rich(c, s.lede)}</p>
${fold(c, s.fold)}
${total(c, s.sum)}
${s.p.map((x) => `<p>${rich(c, x)}</p>`).join('\n')}
${when(c, s.timeline)}
<p class="setup__back">${esc(s.back)}</p>`,
  );
// #endregion

// #region Versions
// the viewer's chip names the time and the commit; a narrow tab shows only the version and its day
const versionsBlock = (c: ICase, v: IVersionsBlock) =>
  chapter(
    v.id,
    v.h2,
    `<p class="lede">${rich(c, v.lede)}</p>
${versions(
  c,
  v.items.map((x) => ({
    label: x.label,
    date: `${x.date}, ${x.time} · ${x.ref}`,
    tab: `${x.label} · ${x.date}`,
    change: x.change,
    why: marked(x.why),
    img: x.img,
    srcset: x.srcset,
    sizes: VIEWER_SIZES,
    thumb: x.thumb,
  })),
  { id: 'captures', cut: CROSSFADE_MS },
)}
<p class="fig__credit w-wide">${esc(v.credit)}</p>`,
  );
// #endregion

// #region Built to last, and the lesson
const lasting = (c: ICase, l: ILastingBlock) =>
  chapter(
    l.id,
    l.h2,
    `<p class="lede">${rich(c, l.lede)}</p>
<dl class="lasting">
${l.rows.map((r) => `<div><dt>${esc(r.k)}</dt><dd>${rich(c, r.v)}</dd></div>`).join('\n')}
</dl>`,
  );

const learned = (l: ILearnedBlock) => chapter(l.id, l.h2, l.p.map((x) => `<p>${esc(x)}</p>`).join('\n'));
// #endregion

const render: TCaseRender = (c) => {
  const b = c.blocks as unknown as IBlocks;
  const index = [b.draft, b.gateway, b.setup, b.versions, b.lasting, b.learned].map((x) => ({ id: x.id, label: x.index }));
  return `${hero(c, index)}
${stageBlock(c, b.stage)}
${draft(c, b.draft)}
${gateway(c, b.gateway)}
${setupBlock(c, b.setup)}
${versionsBlock(c, b.versions)}
${lasting(c, b.lasting)}
${learned(b.learned)}`;
};

export default render;
