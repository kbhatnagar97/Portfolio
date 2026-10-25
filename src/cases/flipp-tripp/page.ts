import { hero } from '../build/parts';
import type { TCaseRender } from '../build/types';
import type { IBlocks } from './blocks';
import { chapterHtml, turnHtml } from './markup/chapters';
import { stageHtml } from './markup/stage';

// Build time: the hero, the stage (also this page's Learn chapter, so the index lists it) and the chapters, in content order.
const render: TCaseRender = (c) => {
  const b = c.blocks as unknown as IBlocks;
  const index = b.order.map((id) => ({ id: b[id].id, label: b[id].nav }));
  const blocks = b.order.map((id) => (id === 'stage' ? stageHtml(c, b.stage) : id === 'the-turn' ? turnHtml(c, b[id]) : chapterHtml(c, b[id])));
  return `${hero(c, index)}\n${blocks.join('\n')}`;
};

export default render;
