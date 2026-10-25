import { calculator, chapter, dataBlock, hero, metricTile, milestones, setup, stage, turn } from '../build/parts';
import type { ICalc, ICase, IMetric, TCaseRender } from '../build/types';
import { esc } from '../../html/core';
import { anatomy, projectList, reach, recordFigure, refused, stackTable } from './figures';
import { hoursModel } from './model';
import type { IHoursCopy } from './model';
import { sheetDefs } from './sheet';
import { stageData, stageFrame, stageStoryboard } from './stage-markup';
import type { IBlocks, IRecordRow } from './types';

// Build time only. Drawing Ledger's story: the hero, the demo stage, then six chapters laid out like a drawing sheet,
// notes on the left and drawings on the right. Copy comes from the content file; the shell turns its [kind:source]
// markers into chips.

// #region Helpers
const p = (text: string, cls?: string) => `<p${cls ? ` class="${cls}"` : ''}>${esc(text)}</p>`;
const h3 = (id: string, text: string) => `<h3 id="${esc(id)}">${esc(text)}</h3>`;

// notes left, drawing right from 1100px: the aside spans every text row beside it and stays in view while they pass
const split = (items: string[], aside: string, before = items.length) =>
  `<div class="dt-split" style="--rows:${items.length}">${[...items.slice(0, before), aside, ...items.slice(before)].join('\n')}</div>`;

const tile = (c: ICase, m: IMetric) => (m.note ? `<div class="dt-tile">${metricTile(c, m)}<p class="metric__note">${esc(m.note)}</p></div>` : metricTile(c, m));
// #endregion

// #region Chapters
const drawingDecides = (b: IBlocks) => {
  const ch = b['the-drawing-decides'];
  const [f1, f2] = ch.figures;
  const text = [p(ch.lede, 'lede'), p(ch.paras[0]), p(ch.line, 'dt-line'), p(ch.paras[1]), p(ch.paras[2]), p(ch.paras[3])];
  // under 1100px the anatomy sits after the second paragraph, where the reading needs it
  return chapter('the-drawing-decides', ch.h2, `${split(text, anatomy(f1, b.stage), 4)}\n${refused(f2)}`);
};

const issuesStay = (b: IBlocks) => {
  const ch = b['every-issue-stays'];
  return chapter('every-issue-stays', ch.h2, [p(ch.lede, 'lede'), ...ch.paras.map((x) => p(x)), recordFigure(ch.figures[0])].join('\n'));
};

const theTurn = (c: ICase, b: IBlocks) => {
  const t = b['the-turn'];
  return turn(c, { title: t.h2, expected: t.expected, cost: t.cost, costMetric: t.costMetric, line: t.line, built: t.built, ruledOut: t.ruledOut }, { ms: 900 });
};

const hoursCalculator = (c: ICase, b: IBlocks) => {
  const k = b['five-jobs'].calc;
  const spec: ICalc = {
    id: k.id,
    title: k.title,
    inputs: k.inputs.map(({ id, label, unit, min, max, step, sliderStep, value, kind, help, error, source }) => ({ id, label, unit, min, max, step, sliderStep, value, kind, help, error, source })),
    leavesOut: k.leavesOut,
    source: k.source,
    figureUnit: k.figureUnit,
  };
  const copy: IHoursCopy = { sentence: k.sentence, math: k.math };
  const r = hoursModel(copy)(Object.fromEntries(k.inputs.map((x) => [x.id, x.value])), false);
  // the content file states the build time result too; if the model and the copy ever disagree, the build stops
  if (r.figure !== k.defaults.figure || r.sentence !== k.defaults.sentence || r.math.join('|') !== k.defaults.math.join('|'))
    throw new Error(`case-pages: ${c.slug}: the hours model gives "${r.figure}", "${r.sentence}", which the content's defaults do not match`);
  return `${calculator(c, spec, r)}\n${dataBlock(copy, `${c.slug}-calc`)}`;
};

const fiveJobs = (c: ICase, b: IBlocks) => {
  const ch = b['five-jobs'];
  const j = ch.jobs;
  const lists = `<div class="dt-duties w-wide">
<div class="dt-duties__col"><h3>${esc(j.title)}</h3><ol class="dt-duties__list dt-duties__list--engine">${j.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
<div class="dt-duties__col"><h3>${esc(j.leftTitle)}</h3><ol class="dt-duties__list">${j.left.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
</div>`;
  return chapter('five-jobs', ch.h2, [p(ch.lede, 'lede'), ...ch.paras.map((x) => p(x)), lists, p(ch.after[0]), hoursCalculator(c, b), p(ch.after[1])].join('\n'));
};

const safeToLeave = (c: ICase, b: IBlocks) => {
  const ch = b['safe-to-leave-running'];
  const [touch, yes, fails, know, path] = ch.sections;
  const tiles = `<div class="metrics dt-tiles">${touch.tiles.map((m) => tile(c, m)).join('')}</div>`;
  const failTable = `<div class="dt-fails w-wide">${stackTable('dt-fails__t', fails.headers, fails.rows, esc)}</div>`;
  const story = milestones(
    c,
    path.milestones.map((m) => ({ when: `${m.label} · ${m.title}`, change: m.change, why: m.why })),
  );
  return chapter(
    'safe-to-leave-running',
    ch.h2,
    [
      p(ch.lede, 'lede'),
      h3(touch.id, touch.h3),
      split([...touch.paras.map((x) => p(x)), tiles], reach(touch.figure)),
      h3(yes.id, yes.h3),
      ...yes.paras.map((x) => p(x)),
      h3(fails.id, fails.h3),
      p(fails.intro),
      failTable,
      p(fails.after),
      h3(know.id, know.h3),
      ...know.paras.map((x) => p(x)),
      h3(path.id, path.h3),
      p(path.intro),
      story,
    ].join('\n'),
    { cls: 'dt-sections' },
  );
};

const switchedOn = (c: ICase, b: IBlocks) => {
  const ch = b['switched-on'];
  const [runsOn, notYet, learned] = ch.sections;
  const math = `<details class="dt-math"><summary>${esc(runsOn.mathTitle)}</summary><ol class="dt-math__lines">${runsOn.math.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>${p(runsOn.mathNote, 'dt-math__note')}</details>`;
  return chapter(
    'switched-on',
    ch.h2,
    [
      p(ch.lede, 'lede'),
      setup(c, { sum: ch.setup.sum, steps: ch.setup.steps, back: ch.setup.back }),
      p(ch.setup.extra),
      projectList(ch.figure),
      h3(runsOn.id, runsOn.h3),
      ...runsOn.paras.map((x) => p(x)),
      `<div class="dt-runs">${metricTile(c, runsOn.tile)}${math}</div>`,
      p(runsOn.upkeep),
      h3(notYet.id, notYet.h3),
      `<ul class="dt-limits">${notYet.list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
      h3(learned.id, learned.h3),
      ...learned.paras.map((x) => p(x)),
    ].join('\n'),
    { cls: 'dt-sections' },
  );
};
// #endregion

// #region The page
const render: TCaseRender = (c) => {
  const b = c.blocks as unknown as IBlocks;
  const s = b.stage;
  const rows: IRecordRow[] = s.transmittal.rows.map((r) => ({ ...r, state: 'current' }));
  const revoked = b['every-issue-stays'].figures[0].rows.find((r) => r.state === 'revoked')?.status ?? 'Revoked';
  const index = b.order
    .filter((id) => id !== 'stage')
    .map((id) => ({ id, label: (b[id as keyof IBlocks] as { nav: string }).nav }));
  const demo = stage(c, {
    title: s.h2,
    intro: s.intro,
    mode: 'reader',
    frame: stageFrame(s, rows),
    storyboard: stageStoryboard(s, rows, revoked),
    steps: s.steps.map(esc),
    caption: s.caption,
  });
  return [hero(c, index), sheetDefs(), demo, stageData(c, s, rows, revoked), drawingDecides(b), issuesStay(b), theTurn(c, b), fiveJobs(c, b), safeToLeave(c, b), switchedOn(c, b)].join('\n');
};

export default render;
// #endregion
