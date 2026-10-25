import type { IChapterLink, IImage, IMetric, TBadge, TKind } from '../build/types';

// The shapes of this case's own blocks in src/content/cases/buskers.json. Types only: nothing here ships.

// the stage's two screens
export type TView = 'desktop' | 'phone';

// #region Copy with chips
// cite renders a provenance chip; trace only records the source behind a sentence that carries no number
export interface ICite {
  kind: TKind;
  source: string;
}

export interface IPara {
  text: string;
  cite?: ICite[];
}

export type TSide = 'left' | 'right';
// #endregion

// #region Stage
export interface IShot extends IImage {
  srcset: string;
  sizes: string;
  label: string;
  captured: string;
}

export interface ICompareSide extends IShot {
  phone: IShot;
}

export interface ICompareBlock {
  start: number;
  rangeLabel: string;
  // "{v}" is the old site's share and "{w}" the new site's
  valueText: string;
  badge: TBadge;
  before: ICompareSide;
  after: ICompareSide;
  caption: Record<TView, string>;
  cite: ICite[];
}

export interface IRaceSide {
  label: string;
  bytes: number;
  requests: number;
  display: string;
}

export interface IRace {
  h3: string;
  intro: string;
  introCite: ICite[];
  blockBytes: number;
  perCount: number;
  countMs: number;
  readoutLabel: string;
  replay: string;
  old: IRaceSide;
  new: IRaceSide;
  summary: IPara;
  scrolled: { caption: string; rows: { k: string; value: string; v: number }[]; note: string; cite: ICite[] };
  caveat: IPara;
}

export interface IStageBlock {
  h2: string;
  intro: string;
  views: { legend: string } & Record<TView, string>;
  compare: ICompareBlock;
  lookFor: { label: string; items: ({ term: string } & IPara)[] };
  race: IRace;
}
// #endregion

// #region Chapters
export interface ISaved {
  h2: string;
  side: TSide;
  lede: string;
  paras: IPara[];
  figure: { img: IImage & { srcset: string; sizes: string }; caption: string; credit: string };
}

export interface ITurnBlock {
  h2: string;
  expected: string;
  cost: string;
  line: string;
  built: string;
  builtMore: string;
  builtCite: ICite[];
  builtMoreCite: ICite[];
}

export interface IRedirect {
  group: string;
  from: string;
  // a key of sections
  to: string;
}

export interface IChecker {
  h3: string;
  label: string;
  default: string;
  host: string;
  // "{section}" and "{anchor}" are filled from the address's landing
  result: string;
  open: string;
  all: string;
  head: [string, string];
  note: string;
  noJs: string;
  cite: ICite[];
  sections: Record<string, string>;
  groups: string[];
  redirects: IRedirect[];
}

export interface IAddresses {
  h2: string;
  side: TSide;
  lede: string;
  paras: IPara[];
  toy: IChecker;
}

export interface IDoors {
  h2: string;
  side: TSide;
  lede: string;
  paras: IPara[];
  message: { label: string; lines: string[]; note: string };
  doors: { caption: string; head: [string, string, string]; rows: { door: string; old: string; new: string; cite?: ICite[] }[] };
}

export interface IRunning {
  h2: string;
  side: TSide;
  lede: string;
  ledeCite: ICite[];
  tiles: IMetric[];
  paras: IPara[];
}

export interface ICount {
  action: string;
  who: string;
  time: string;
  note: string;
  cite?: ICite[];
  launch?: boolean;
}

export interface ICounts {
  h2: string;
  lede: string;
  sum: string;
  sumCite: ICite[];
  steps: ICount[];
  // printed after "The way back: "
  back: string;
  backCite: ICite[];
}

export interface IBlocks {
  index: IChapterLink[];
  stage: IStageBlock;
  saved: ISaved;
  turn: ITurnBlock;
  addresses: IAddresses;
  doors: IDoors;
  running: IRunning;
  counts: ICounts;
  learned: { h2: string } & IPara;
}
// #endregion
