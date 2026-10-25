import type { TCaseRender } from '../build/types';
import { hero } from '../build/parts';
import type { IBlocks } from './blocks';
import { briefChapter, learnedChapter, mathChapter, searchChapter, taggerChapter, turnChapter } from './chapters';
import { stageSection } from './stage-markup';

// Build time only. Post Aura's story: the hero, the edit, then the chapters; the shell adds the offer, sources and pager.

const render: TCaseRender = (c) => {
  const b = c.blocks as unknown as IBlocks;
  const index = b.index.map((x) => ({ id: x.href.slice(1), label: x.label }));
  return [
    hero(c, index),
    stageSection(c, b.stage),
    briefChapter(c, b['the-brief']),
    searchChapter(c, b.search),
    turnChapter(c, b['tags-that-travel']),
    taggerChapter(c, b['the-tagger']),
    mathChapter(c, b['the-math']),
    learnedChapter(c, b.learned),
  ].join('\n');
};

export default render;
