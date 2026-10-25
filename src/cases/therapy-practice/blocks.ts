import type { IImage, IMetric, TKind, TWidth } from '../build/types';

// This case's own blocks. Types only: validateCase has already proven every source and media path in them.

// #region Rich text
// prose that holds a number is an array, so each number carries its chip; a part without n is a chip for the figures before it
export interface IRichFigure {
  n: string;
  kind: TKind;
  source: string;
}
export type TRichPart = string | IRichFigure | { kind: TKind; source: string };
export type TRich = string | TRichPart[];
// #endregion

// #region Blocks, in page order
interface IChapterBlock {
  id: string;
  // its label in the hero's chapter index
  index: string;
  h2: string;
}

export interface IStep {
  label: string;
  text: TRich;
}

export interface IStageBlock {
  h2: string;
  intro: string;
  steps: IStep[];
}

export interface IDraftBlock extends IChapterBlock {
  lede: string;
  p: TRich[];
  figure: { width: TWidth; img: IImage; srcset: string; caption: string; credit: string };
}

export interface IGatewayBlock extends IChapterBlock {
  turn: { expected: string; cost: string; costMetric: IMetric; moreMetrics: IMetric[]; line: string; built: string };
  math: TRich;
  note: TRich;
}

export interface IFoldRow {
  do: string;
  // where the row went: kept as a step, the script, a note, or me
  tag: string;
  struck: boolean;
}

export interface IGuideRow {
  n: string;
  do: string;
  who: string;
}

export interface ISetupBlock extends IChapterBlock {
  lede: TRich;
  fold: {
    caption: TRich;
    before: { title: string; rows: IFoldRow[] };
    after: { title: string; rows: IGuideRow[]; mine: string };
  };
  sum: TRich;
  p: TRich[];
  timeline: TRich;
  back: string;
}

export interface IShot {
  label: string;
  date: string;
  time: string;
  ref: string;
  change: string;
  why: TRich;
  // the largest capture; srcset lists every width of it
  img: IImage;
  srcset: string;
  thumb: { src: string; width: number; height: number };
}

export interface IVersionsBlock extends IChapterBlock {
  lede: TRich;
  items: IShot[];
  credit: string;
}

export interface ILastingBlock extends IChapterBlock {
  lede: TRich;
  rows: { k: string; v: TRich }[];
}

export interface ILearnedBlock extends IChapterBlock {
  p: string[];
}

export interface IBlocks {
  stage: IStageBlock;
  draft: IDraftBlock;
  gateway: IGatewayBlock;
  setup: ISetupBlock;
  versions: IVersionsBlock;
  lasting: ILastingBlock;
  learned: ILearnedBlock;
}
// #endregion
