import type { IMetric, TBadge, TKind } from '../build/types';

// The shapes of this case's own blocks in src/content/cases/drawing-transmittal.json. Types only: nothing here ships.

// #region The demo's sample data
export type TSampleId = 'rev' | 'new' | 'bad';

// one transmittal row, as the table shows it
export interface IRow {
  no: string;
  title: string;
  dwg: string;
  status: string;
  issued: string;
  rev: string;
  revDate: string;
}

export type TRowState = 'current' | 'revoked' | 'removed';

export interface IRecordRow extends IRow {
  state: TRowState;
  note?: string;
}

export interface ITitleBlock {
  code: string;
  title: string;
  sheet: string;
  issued: string;
  // rev, date, change
  revisions: [string, string, string][];
}

export interface ISample {
  titleBlock: ITitleBlock;
  row?: IRow;
  revokes?: { dwg: string; rev: string };
  refuse?: string;
}

export interface IPickerOption {
  id: TSampleId;
  label: string;
  file: string;
  hint: string;
  checked?: boolean;
}

export type TStatus =
  | 'loading'
  | 'idle'
  | 'name'
  | 'scan'
  | 'match'
  | 'planRev'
  | 'planNew'
  | 'draft'
  | 'approved'
  | 'sent'
  | 'refused'
  | 'repeat'
  | 'reset';
// #endregion

// #region Blocks
export interface IStageBlock {
  h2: string;
  intro: string;
  badges: TBadge[];
  picker: { legend: string; options: IPickerOption[] };
  buttons: { drop: string; approve: string; reset: string };
  status: Record<TStatus, string>;
  readout: string;
  panels: { folder: string; approval: string; sent: string; draft: string; client: string };
  sheet: {
    practice: string;
    job: string;
    labels: { job: string; code: string; title: string; sheet: string; issued: string; revTable: [string, string, string] };
  };
  samples: Record<TSampleId, ISample>;
  transmittal: { caption: string; headers: string[]; rows: IRow[]; scrollLabel: string };
  approval: { heading: string; from: string; rowRev: string; rowNew: string; revokeNote: string; safe: string; reject: string; stamp: string };
  sent: { heading: string; note: string; to: string[] };
  jobs: { title: string; items: string[]; skipNew: string; leftTitle: string; left: string };
  steps: string[];
  caption: string;
  storyboard: { label: string; title: string; text: string }[];
}

interface ISheetFigure {
  id: string;
  sheet: string;
  rev: string;
  date: string;
  tag: string;
  badge: TBadge;
  title: string;
  caption: string;
}

export interface IAnatomyFigure extends ISheetFigure {
  file: string;
  parts: { text: string; label: string; role: string }[];
  rule: string;
}

export interface ITableFigure extends ISheetFigure {
  headers: string[];
  rows: string[][];
}

export interface IRecordFigure extends ISheetFigure {
  headers: string[];
  rows: IRecordRow[];
  legend: { mark: TRowState; text: string }[];
}

export interface IReachFigure extends ISheetFigure {
  groups: { label: string; squares?: number; lit?: number; litLabel?: string; note?: string; text?: string }[];
  alt: string;
}

export interface IListFigure extends ISheetFigure {
  headers: string[];
  row: string[];
  refusal: { input: string; message: string };
  scrollLabel: string;
}

export interface ICalcBlock {
  id: string;
  title: string;
  inputs: { id: string; label: string; unit: string; min: number; max: number; step: number; sliderStep: number; value: number; kind: 'example' | 'measured'; help: string; error: string; source: string }[];
  figureUnit: string;
  sentence: ICalcSentences;
  math: string[];
  leavesOut: string[];
  defaults: { figure: string; sentence: string; math: string[] };
  kind: TKind;
  source: string;
}

export interface ICalcSentences {
  example: string;
  yours: string;
  none: string;
  empty: string;
}

export interface ISetupStep {
  action: string;
  who: string;
  time?: string;
  note?: string;
  kind?: TKind;
  source: string;
}

interface IChapterBlock {
  nav: string;
  h2: string;
  lede: string;
}

export interface IBlocks {
  order: string[];
  stage: IStageBlock;
  'the-drawing-decides': IChapterBlock & { line: string; paras: string[]; figures: [IAnatomyFigure, ITableFigure] };
  'every-issue-stays': IChapterBlock & { paras: string[]; figures: [IRecordFigure] };
  'the-turn': {
    nav: string;
    h2: string;
    expected: string;
    ruledOut: { name: string; reason: string; kind: TKind; source: string }[];
    cost: string;
    costMetric: IMetric;
    line: string;
    built: string;
  };
  'five-jobs': IChapterBlock & {
    paras: string[];
    jobs: { title: string; items: string[]; leftTitle: string; left: string[] };
    after: [string, string];
    calc: ICalcBlock;
  };
  'safe-to-leave-running': IChapterBlock & {
    sections: [
      { id: string; h3: string; paras: string[]; tiles: IMetric[]; figure: IReachFigure },
      { id: string; h3: string; paras: string[] },
      { id: string; h3: string; intro: string; headers: [string, string]; rows: [string, string][]; after: string },
      { id: string; h3: string; paras: string[] },
      { id: string; h3: string; intro: string; milestones: { label: string; title: string; change: string; why: string }[] },
    ];
  };
  'switched-on': IChapterBlock & {
    setup: { sum: string; steps: ISetupStep[]; back: string; extra: string };
    figure: IListFigure;
    sections: [
      { id: string; h3: string; paras: string[]; tile: IMetric; mathTitle: string; math: string[]; mathNote: string; upkeep: string },
      { id: string; h3: string; list: string[] },
      { id: string; h3: string; paras: string[] },
    ];
  };
}
// #endregion

// #region What the stage script reads from the page (parts.dataBlock)
export interface IStageData {
  // the sample transmittal before any drop, as the frame's table shows it
  rows: IRecordRow[];
  samples: Record<TSampleId, ISample>;
  status: Record<TStatus, string>;
  readout: string;
  record: { draft: string; client: string };
  // the word a replaced row's Status cell takes
  revoked: string;
}
// #endregion
