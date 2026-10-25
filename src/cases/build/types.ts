// The content schema every case file follows, and the shapes the HTML partials take. Types only: nothing here ships.

export type TKind = 'measured' | 'reported' | 'modelled' | 'example';
export type TPurpose = 'saves-time' | 'saves-money' | 'grows-reach' | 'opens-reach' | 'reduces-risk';
export type TWidth = 'read' | 'wide' | 'bleed';
export type TBadge = 'Sample data' | 'Recreated for this page' | 'Illustration, not a screenshot' | 'Demo speed' | 'Stock footage' | 'Blurred for privacy';

// #region Content files (src/content/cases/*.json)
// text says how and when the number was found: tool, conditions, runs, date
export interface ISource {
  id: string;
  text: string;
  url?: string;
}

// one provenance chip: how a number was found, and which source says so
export interface IProv {
  kind: TKind;
  source: string;
}

// a sentence and the chips of the numbers it carries, which print after it
export interface IProse {
  text: string;
  prov?: IProv[];
}

export type TProse = string | IProse;

// value is display text ("12 days"); label continues it into one sentence that carries the baseline
export interface IMetric {
  value: string;
  label: string;
  kind: TKind;
  source: string;
  note?: string;
}

export interface IImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// og:image and the sitemap keep the JPG; cards show the lighter WebP twin when there is one
export interface IPoster extends IImage {
  webp?: string;
}

export interface ILink {
  label: string;
  href: string;
}

export interface ICredit {
  text: string;
  url?: string;
}

// the sellable model: never a price
export interface IOffer {
  who: string;
  gets: string;
  needs: string;
  setup: string;
  // one closing line under the spec, for a second thing this page can be asked about
  also?: string;
}

export interface ICase {
  slug: string;
  draft: boolean;
  flagship?: boolean;
  title: string;
  kicker: string;
  // for the anonymised case a description, never the name
  client: string;
  industry: string;
  anonymised: boolean;
  role: string;
  year: string;
  published: string;
  status: string;
  accent: string;
  purposes: TPurpose[];
  seoTitle: string;
  description: string;
  deck: string;
  summary: string[];
  impact: IMetric[];
  poster: IPoster;
  stack: string[];
  // links[0] is the work's own site; the hero links it, and the JSON-LD names it only once the status reads Live
  links: ILink[];
  offer: IOffer;
  // the matching id in src/content/projects.json, for the cross links
  project?: string;
  credits?: ICredit[];
  sources: ISource[];
  // facts not supplied yet: never rendered, printed by the build
  gaps: string[];
  // case specific content, typed by that case's own page.ts
  blocks: Record<string, unknown>;
}

export interface IOverview {
  draft: boolean;
  title: string;
  kicker: string;
  deck: string;
  seoTitle: string;
  description: string;
  lede: string[];
  how: { step: string; text: string }[];
  cta: { text: string; subject: string };
  home: { index: string; title: string; line: string; cta: string };
  gaps: string[];
}
// #endregion

// #region Component specs (the arguments of parts.ts)
export interface IChapterLink {
  id: string;
  label: string;
}

export interface IFigure {
  img: IImage;
  caption: string;
  credit?: string;
  badge?: TBadge;
  width?: TWidth;
  srcset?: string;
  sizes?: string;
  // the stage image that is the page's LCP candidate
  eager?: boolean;
}

export interface IPairSide {
  value: string;
  // bar length, 0 to 1, on the pair's one axis
  v: number;
  label?: string;
}

export interface IPair {
  caption: string;
  before: IPairSide;
  after: IPairSide;
  kind: TKind;
  source: string;
}

export interface ICompareSide extends IImage {
  label: string;
  captured: string;
  srcset?: string;
  sizes?: string;
  // shown under 700px wide
  phone?: IImage;
}

export interface ICompare {
  // the range input's accessible name
  label: string;
  before: ICompareSide;
  after: ICompareSide;
  start?: number;
  caption: string;
  // chips after the caption, a badge before it
  prov?: IProv[];
  badge?: TBadge;
  credit?: string;
  eager?: boolean;
  // each label also shows its capture date
  dated?: boolean;
  // the range's spoken value: {v} is the before side's share, {w} the after side's; by default it names the labels
  valueText?: string;
  // bleed by default; a compare inside a case's own layout takes that layout's width
  width?: TWidth;
  // markup under the frame; an element in it marked data-cmp-follow moves with the handle
  under?: string;
}

export interface ICalcInput {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  // the slider may move in coarser steps than the number field accepts
  sliderStep?: number;
  value: number;
  kind: 'example' | 'measured';
  help: string;
  // what the field says when its value is empty, out of range or off its step
  error?: string;
  source?: string;
}

export interface ICalc {
  id: string;
  title: string;
  inputs: ICalcInput[];
  leavesOut: string[];
  // where the model and its assumptions are explained
  source: string;
  // a line under the figure that says per what, so a monthly figure never reads as a total
  figureUnit?: string;
}

// what a case's model.ts returns, at build time for the defaults and in the browser for the reader's numbers
export interface ICalcResult {
  figure: string;
  sentence: string;
  math: string[];
}

export interface IVersion {
  label: string;
  // printed after the label in the list and on the viewer: the date, and a time or a commit when there is one
  date: string;
  change: string;
  why: TProse;
  img?: IImage;
  srcset?: string;
  sizes?: string;
  // a small copy for the tab; without it the tab shows the capture itself
  thumb?: { src: string; width: number; height: number };
  // the tab's short name; the viewer's chip keeps the full label and date
  tab?: string;
  weight?: IMetric;
}

export interface IMilestone {
  // the small mono line: a date, a day number, a version
  when: string;
  time?: string;
  // a name over the change, for a list whose when line holds only dates
  name?: string;
  change: string;
  why: TProse;
  // a commit or another identifier the reader can trace
  ref?: string;
}

export interface IRuledOut {
  name: string;
  reason: string;
  kind: TKind;
  source: string;
}

export interface ITurn {
  title: string;
  expected: TProse;
  cost: TProse;
  // one tile, or several side by side
  costMetric?: IMetric | IMetric[];
  line: string;
  // one paragraph, or several
  built: TProse | TProse[];
  ruledOut?: IRuledOut[];
}

export interface ITurnOptions {
  id?: string;
  // the world's tempo: post-aura 1200, drawing-transmittal 900, buskers 2000, flipp-tripp 1100, therapy-practice 700
  ms?: number;
  // flipp-tripp moves in 12 discrete steps
  steps?: number;
  // therapy-practice keeps the L static and only fades the new column in
  marker?: boolean;
  // markup after the h2 (a date slate, a row label) and after the grid, inside the section
  head?: string;
  after?: string;
}

export interface ISetupStep {
  action: TProse;
  who: string;
  time?: string;
  // how the time is known: its chip sits beside it
  kind?: TKind;
  source?: string;
  note?: string;
  // the one lit row of the list, such as the launch
  lit?: boolean;
}

export interface ISetup {
  steps: ISetupStep[];
  // a written summary in place of the counted "N steps."
  sum?: TProse;
  total?: IMetric;
  // printed after "The way back: "
  back: TProse;
  // the folded variant: the old checklist beside the new steps
  was?: { label: string; items: { text: string; struck?: boolean }[] };
}

export interface IVideo {
  src: string;
  poster: IImage;
  // m:ss
  duration: string;
  sound: boolean;
  size: string;
  caption: string;
  credit?: string;
  // a line that carries a number also carries its chip
  text?: ({ t: string; line: string } & Partial<IProv>)[];
  loop?: boolean;
}

export interface IStoryFrame {
  label: string;
  when?: string;
  // markup built in page.ts, every content string already escaped
  html: string;
}

// auto plays by itself (reduced motion gets the storyboard), reader stays live under reduced motion, static needs no JS
export type TStageMode = 'auto' | 'reader' | 'static';

export interface IStage {
  title: string;
  intro?: string;
  frame: string;
  storyboard?: string;
  // an empty list renders no steps and no status line: the frame itself is the list
  steps: string[];
  // one line after the steps, read with and without JavaScript
  caption?: string;
  // markup after the status line, inside the section, for a stage in several parts
  after?: string;
  mode?: TStageMode;
}
// #endregion

// #region Build
// only what a home card shows ships to the home: the flagship's three proofs, one for the others
export interface ICaseCard {
  slug: string;
  title: string;
  kicker: string;
  industry: string;
  year: string;
  accent: string;
  flagship: boolean;
  line: string;
  status: string;
  impact: { value: string; label: string; kind: TKind; note?: string }[];
  poster: IPoster;
}

export type TCaseRender = (c: ICase) => string;
export type TOverviewRender = (o: IOverview, cases: ICase[]) => string;

export interface IEntryAssets {
  js: string;
  css: string[];
  preload: string[];
}
// #endregion
