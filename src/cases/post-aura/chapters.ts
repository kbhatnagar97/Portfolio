import { esc } from '../../html/core';
import { calculator, chapter, dataBlock, figure, metricTiles, setup, turn, video } from '../build/parts';
import type { ICase } from '../build/types';
import type { IBrief, IChapterShot, ILearned, IMath, ISearch, ITagger, ITurnBlock } from './blocks';
import { findings, pathFigure } from './figures';
import { framed, para, paragraph, slate, text } from './markup';
import { tagging } from './model';

// Build time only. The chapters after the stage, in the world's rhythm: one wide frame with its date slate,
// then the reading column.

const FRAME_SIZES = '(min-width: 1180px) 1120px, calc(100vw - 32px)';

const shot = (f: IChapterShot) => figure({ img: f.img, srcset: f.img.srcset, sizes: FRAME_SIZES, caption: f.caption.t, credit: f.credit });

export const briefChapter = (c: ICase, b: IBrief) =>
  chapter(
    b.id,
    b.h2,
    `${findings(c, b.frame, b.slate ?? '')}
${text(b.lede, 'lede')}
${b.body.map((p) => para(c, p)).join('\n')}`,
  );

export const searchChapter = (c: ICase, b: ISearch) =>
  chapter(
    b.id,
    b.h2,
    `${framed(b.slate ?? '', shot(b.frame))}
${text(b.lede, 'lede')}
${b.body.map((p) => para(c, p)).join('\n')}
${metricTiles(c, b.tiles)}
${b.body2.map((p) => para(c, p)).join('\n')}`,
  );

// the world's tempo for the turn's marker; the slate leads the grid as the date of the turn
export const turnChapter = (c: ICase, b: ITurnBlock) =>
  turn(
    c,
    { title: b.h2, expected: b.turn.expected.t, cost: paragraph(b.turn.cost), line: b.turn.line, built: paragraph(b.turn.built) },
    { id: b.id, ms: 1200, head: slate(b.slate ?? '') },
  );

export const taggerChapter = (c: ICase, b: ITagger) =>
  chapter(
    b.id,
    b.h2,
    `${framed(b.slate ?? '', video(c, { ...b.frame, caption: b.frame.caption.t }))}
${text(b.lede, 'lede')}
${b.body.map((p) => para(c, p)).join('\n')}
${pathFigure(c, b.figure)}
${metricTiles(c, b.tiles)}
${text(b.tilesNote, 'tiles-note')}
${b.body2.map((p) => para(c, p)).join('\n')}
${setup(c, b.setup)}
<h3>${esc(b.limits.h3)}</h3>
${para(c, b.limits)}`,
  );

export const mathChapter = (c: ICase, b: IMath) => {
  const k = b.calc;
  const result = tagging(k)(Object.fromEntries(k.inputs.map((x) => [x.id, x.value])), false);
  // the defaults are printed in the content file too; a drift between them and the model stops the build
  if (result.figure !== k.defaults.figure || result.sentence !== k.defaults.sentence || result.math.join('\n') !== k.mathDefaults.join('\n'))
    throw new Error('case-pages: post-aura: the calculator defaults in the content file no longer match model.ts');
  const model = { constants: k.constants, figure: k.figure, figureSingle: k.figureSingle, sentence: k.sentence, math: k.math };
  return chapter(
    b.id,
    b.h2,
    `${framed(b.slate ?? '', shot(b.frame))}
${text(b.lede, 'lede')}
${b.body.map((p) => para(c, p)).join('\n')}
${calculator(c, { id: k.id, title: k.title, inputs: k.inputs, leavesOut: k.leavesOut.map((x) => x.t), source: k.source }, result)}
${dataBlock({ model, orderError: k.orderError }, 'calc-model')}`,
  );
};

export const learnedChapter = (c: ICase, b: ILearned) => chapter(b.id, b.h2, b.body.map((p) => para(c, p)).join('\n'));
