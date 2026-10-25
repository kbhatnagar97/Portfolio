import type { ICalcInput, IImage, IVideo, TBadge, TKind } from '../build/types';
import type { ICalcModel } from './model';

// The shapes of this case's own blocks in src/content/cases/post-aura.json. Types only: nothing here ships.

// #region Text
// source lists the sources behind a sentence for the claims ledger (the kit checks each id); only prov chips print
export interface IText {
  t: string;
  source: string[];
}

export interface IProv {
  kind: TKind;
  source: string;
}

export interface IParagraph {
  sentences: IText[];
  prov: IProv[];
}

// a number inside a card, printed with its chip
export interface IFact {
  t: string;
  kind: TKind;
  source: string;
}
// #endregion

// #region The stage
export type TTrack = 'marker' | 'research' | 'website' | 'search' | 'product';

export interface IShot {
  type: 'image';
  img: IImage & { srcset?: string };
  caption: string;
  credit?: string;
  badge?: TBadge;
}

export interface IPanelFrame {
  type: 'panel';
  panel: TPanelId;
}

export interface IClip {
  id: string;
  track: TTrack;
  label: string;
  date: string;
  readout: string;
  title: string;
  line?: IText;
  change?: IText;
  why?: IText;
  note?: IText;
  figures?: IFact[];
  // the version's own test address
  href?: string;
  // the search layer runs under every version, from one clip to another
  span?: [string, string];
  frame: IShot | IPanelFrame;
  // V5 cuts to its cull scene at the card's midpoint
  frame2?: IShot;
}

export interface IBeat {
  id: string;
  slate: string;
  h3: string;
  text: IParagraph;
  clips: IClip[];
}

export interface ITrackRow {
  id: Exclude<TTrack, 'marker'>;
  label: string;
  total: string;
}

export interface IPanels {
  brief: { badge: TBadge; title: string; lines: string[]; sections: string[]; flags: { at: string; t: string }[] };
  search: { badge: TBadge; title: string; rows: string[]; files: string[] };
  r1: { title: string; tag: string; stats: string[]; list: string[]; peopleLabel: string; people: string[] };
  r2: { badge: TBadge; title: string; tag: string; stats: string[]; list: string[]; arc: string };
  r3: { title: string; tag: string; stats: string[]; peopleLabel: string; people: string[]; verdictLabel: string; verdict: string };
  t1: { badge: TBadge; title: string; steps: { k: string; v: string }[] };
  t3: { badge: TBadge; title: string; flow: string[]; note: string };
  t4: { badge: TBadge; title: string; rules: string[]; counts: string[] };
  t6: { badge: TBadge; title: string; when: string; tiles: { k: string; v: string; note?: string }[]; lines: string[] };
}

export type TPanelId = keyof IPanels;

export interface IStageBlock {
  id: string;
  h2: string;
  intro: string;
  tracks: ITrackRow[];
  ruler: { in: string; out: string; days: string[] };
  readoutOut: string;
  beats: IBeat[];
  end: { figure: string; sentence: IText; kind: TKind; source: string; totals: IFact[]; site: string };
  panels: IPanels;
}
// #endregion

// #region Chapters
export interface IChapterBase {
  id: string;
  h2: string;
  slate?: string;
}

export interface IBrief extends IChapterBase {
  frame: { type: 'findings'; title: string; headers: [string, string]; rows: { found: IText; changed: IText }[]; caption: IText; prov: IProv[] };
  lede: IText;
  body: IParagraph[];
}

export interface IChapterShot {
  type: 'image';
  width?: 'wide';
  img: IImage & { srcset?: string };
  caption: IText;
  credit?: string;
}

export interface ISearch extends IChapterBase {
  frame: IChapterShot;
  lede: IText;
  body: IParagraph[];
  tiles: ITile[];
  body2: IParagraph[];
}

export interface ITurnBlock extends IChapterBase {
  turn: {
    expected: IText;
    cost: IParagraph;
    line: string;
    built: IParagraph;
  };
}

export interface IPathFigure {
  id: string;
  title: string;
  badge: string;
  path: string[];
  frames: IImage[];
  framesAlt: string;
  fromLabels: { path: string; frames: string };
  fields: { label: string; value: string; from: 'path' | 'frames' }[];
  keywordsLabel: string;
  keywords: string[];
  caption: IText;
  prov: IProv[];
  credit: string;
}

export interface ITile {
  value: string;
  label: string;
  kind: TKind;
  source: string;
}

export interface ITagger extends IChapterBase {
  frame: Pick<IVideo, 'src' | 'poster' | 'duration' | 'sound' | 'size'> & {
    type: 'video';
    caption: IText;
    // a line that carries a number also carries its chip
    text: ({ t: string; line: string } & Partial<IProv>)[];
  };
  lede: IText;
  figure: IPathFigure;
  body: IParagraph[];
  tiles: ITile[];
  tilesNote: IText;
  body2: IParagraph[];
  // the kit counts the steps itself; total carries the rest of the summary line
  setup: { total: ITile; steps: { action: string; who: string; note?: string }[]; back: string };
  limits: { h3: string } & IParagraph;
}

export interface IMath extends IChapterBase {
  frame: IChapterShot;
  lede: IText;
  body: IParagraph[];
  calc: ICalcModel & {
    id: string;
    title: string;
    inputs: ICalcInput[];
    defaults: { figure: string; sentence: string };
    mathDefaults: string[];
    leavesOut: IText[];
    orderError: string;
    source: string;
  };
}

export interface ILearned extends IChapterBase {
  body: IParagraph[];
}
// #endregion

export interface IBlocks {
  index: { href: string; label: string }[];
  stage: IStageBlock;
  'the-brief': IBrief;
  search: ISearch;
  'tags-that-travel': ITurnBlock;
  'the-tagger': ITagger;
  'the-math': IMath;
  learned: ILearned;
}
