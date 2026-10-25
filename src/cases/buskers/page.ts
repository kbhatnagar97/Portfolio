import { hero } from '../build/parts';
import type { TCaseRender } from '../build/types';
import type { IBlocks } from './blocks';
import { addresses, counts, doors, learned, running, saved, turnChapter } from './page-chapters';
import { stageBlock } from './page-stage';

// Buskers: old stage, new stage. The shell adds the offer, the sources and the pager after these chapters.

// the turn marker travels its L in four counts of the world's beat
const TURN_COUNTS = 4;

const render: TCaseRender = (c) => {
  const b = c.blocks as unknown as IBlocks;
  return [
    hero(c, b.index),
    stageBlock(c, b.stage),
    saved(c, b.saved),
    turnChapter(c, b.turn, TURN_COUNTS * b.stage.race.countMs),
    addresses(c, b.addresses),
    doors(c, b.doors),
    running(c, b.running),
    counts(c, b.counts),
    learned(c, b.learned),
  ].join('\n');
};

export default render;
