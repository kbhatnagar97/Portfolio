import type { IImage, IMetric, ISetupStep, TBadge, TKind } from '../build/types';

// The shape of this case's own blocks in src/content/cases/flipp-tripp.json. Types only: nothing here ships.

// #region Shared pieces
export interface IProv {
  kind: TKind;
  source: string;
}

export interface IProse {
  text: string;
  prov?: IProv[];
}

export interface IInlineLink {
  text: string;
  href: string;
}

export interface IFigureBlock {
  img: IImage;
  srcset?: string;
  caption: string;
  credit?: string;
}
// #endregion

// #region The stage
export interface ITempo {
  leafMs: number;
  stepMs: number;
  columnMs: number;
  rowMs: number;
  settleRandomMin: number;
  settleRandomMax: number;
  pressRandom: number;
  shade: number;
  glyphs: string;
  source: string;
}

export type TPhase = 'rest' | 'fold' | 'edge' | 'land' | 'landed';

export interface ILeafPose {
  glyph: string;
  deg: number;
  shade: number;
}

export interface IStoryFrameBlock {
  t: number;
  label: string;
  text: string;
  topHalf: string;
  bottomHalf: string;
  fold: ILeafPose | null;
  land: ILeafPose | null;
}

export interface ICutBlock {
  heading: string;
  badge: TBadge;
  example: { from: string; via: string; to: string; text: string; prov: IProv[] };
  labels: Record<'topLeaf' | 'bottomLeaf' | 'fold' | 'shade' | 'pool' | 'from' | 'random' | 'to' | 'side' | 'viewer', string>;
  slider: { label: string; min: number; max: number; step: number; page: number; value: number; help: IProse; noJs: string };
  play: { label: string; pause: string; badge: TBadge; factor: number };
  loadError: string;
  readout: { template: string; slow: string; phases: Record<TPhase, string> };
  valueText: Record<TPhase, string>;
  steps: { text: string; from: number; to: number; prov: IProv[] }[];
  storyboard: { caption: string; prov: IProv[]; frames: IStoryFrameBlock[] };
}

export interface IBoardBlock {
  heading: string;
  rows: number;
  columns: number;
  columnsPhone: number;
  phoneBelow: number;
  label: string;
  value: string;
  help: string;
  helpPhone: string;
  button: string;
  errors: { empty: string; glyphs: string; rows: string };
  announce: string;
  same: string;
  narrowed: string;
  readout: string;
  caption: IProse;
  noJs: string;
}

export interface IAxisMark {
  at: number;
  label: string;
  value: string;
}

export interface IAxisRef extends IAxisMark {
  kind: TKind;
  source: string;
}

export interface IPressAxis {
  title: string;
  unit: string;
  max: number;
  tick: number;
  marks: IAxisMark[];
  kind: TKind;
  source: string;
  cap: IAxisRef;
  caption: IProse;
}

export interface ILoadAxis {
  title: string;
  unit: string;
  max: number;
  tick: number;
  bands: { from: number; to: number; label: string; value: string }[];
  kind: TKind;
  source: string;
  threshold: IAxisRef;
  caption: IProse;
}

export interface IMeasuredBlock {
  heading: string;
  intro: IProse;
  frames: IFigureBlock;
  press: IPressAxis;
  load: ILoadAxis;
  privacy: { tiles: IMetric[]; caption: IProse };
}

export interface IStageBlock {
  id: string;
  nav: string;
  heading: string;
  intro: string;
  tempo: ITempo;
  cut: ICutBlock;
  board: IBoardBlock;
  measured: IMeasuredBlock;
}

// what the stage module reads from the page: the tempo and the copy its controls write, nothing only the HTML shows
export interface IStageData {
  tempo: ITempo;
  cut: {
    example: Pick<ICutBlock['example'], 'from' | 'via' | 'to'>;
    slider: Pick<ICutBlock['slider'], 'min' | 'max' | 'step' | 'page'>;
    play: Pick<ICutBlock['play'], 'label' | 'pause' | 'factor'>;
    readout: ICutBlock['readout'];
    valueText: ICutBlock['valueText'];
    steps: { from: number; to: number }[];
  };
  board: Pick<IBoardBlock, 'rows' | 'columns' | 'columnsPhone' | 'phoneBelow' | 'value' | 'errors' | 'announce' | 'same' | 'narrowed' | 'readout'>;
}
// #endregion

// #region Chapters
export interface IMilestoneItem {
  label: string;
  date: string;
  time?: string;
  change: string;
  why: string;
  ref?: string;
  prov: IProv[];
}

export interface IFinding {
  severity: string;
  what: string;
  cause: string;
  fix: string;
  kind: TKind;
  source: string;
}

export type TPart =
  | { type: 'p'; text: string; prov?: IProv[]; links?: IInlineLink[] }
  | { type: 'h3'; text: string }
  | { type: 'hero' }
  | { type: 'board'; caption: string; rows: IMetric[] }
  | { type: 'tiles'; items: IMetric[] }
  | { type: 'code'; text: string; badge: TBadge; caption: string }
  | ({ type: 'figure' } & IFigureBlock)
  | { type: 'milestones'; items: IMilestoneItem[] }
  | { type: 'scores'; columns: string[]; rows: { name: string; scores: string[]; note?: string }[]; caption: string; kind: TKind; source: string }
  | { type: 'findings'; items: IFinding[] }
  // sum replaces the kit's counted line; prov are the way back's chips
  | { type: 'setup'; sum: IProse & IProv; steps: ISetupStep[]; back: string; prov?: IProv[] }
  | { type: 'checks'; rows: { group: string; passed: number; total: number }[]; status: string; caption: string; kind: TKind; source: string };

export interface IChapterBlock {
  id: string;
  nav: string;
  label: string;
  heading: string;
  lede: { text: string };
  parts: TPart[];
}

export interface ITurnBlock {
  id: string;
  nav: string;
  label: string;
  heading: string;
  turn: { expected: string; cost: string; costMetric: IMetric; line: string; built: string; marker: { steps: number; durationMs: number } };
}

export type TChapterId = 'starting-point' | 'cannot-say-too-much' | 'found-at-launch' | 'judged-and-rebuilt' | 'going-live';

export type IBlocks = { order: ('stage' | 'the-turn' | TChapterId)[]; stage: IStageBlock; 'the-turn': ITurnBlock } & Record<TChapterId, IChapterBlock>;
// #endregion
