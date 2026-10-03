import type { IAutomation, TFlowKind } from './data';

export type TPoint = { x: number; y: number };

// Node box and board size in board units; the board is scaled to fit the screen.
export const NW = 210;
export const NH = 86;
const WIDE = { w: 1500, h: 840 };
// room kept right of and below the outermost nodes; a flow with more columns or rows than the default board widens it
const PAD = { x: 120, y: 100 };
const COL = 240;
const ROW = 150;
const STRIP_COL = 260;
// headroom so bypass edges that bow over the top row stay on the board
const STRIP_TOP = 60;

// wide: the hand placed board. stack: two columns read top to bottom. strip: the stack turned on its side for landscape phones.
export type TLayout = 'wide' | 'stack' | 'strip';

export const KIND_LABEL: Record<TFlowKind, string> = {
  trigger: 'Trigger',
  source: 'Collect',
  ai: 'AI model',
  rule: 'Rules',
  human: 'Human',
  output: 'Output',
  drop: 'Discard',
};

export const layoutOf = (flow: IAutomation, m: TLayout) => {
  const pos: Record<string, TPoint> = {};
  let rows = 0;
  flow.nodes.forEach((n) => {
    if (m === 'stack') pos[n.id] = { x: COL / 2 + n.m[0] * COL, y: ROW / 2 + n.m[1] * ROW };
    else if (m === 'strip') pos[n.id] = { x: STRIP_COL / 2 + n.m[1] * STRIP_COL, y: STRIP_TOP + ROW / 2 + n.m[0] * ROW };
    else pos[n.id] = { x: n.at[0], y: n.at[1] };
    rows = Math.max(rows, n.m[1] + 1);
  });
  if (m === 'stack') return { pos, w: COL * 2, h: rows * ROW };
  if (m === 'strip') return { pos, w: rows * STRIP_COL, h: STRIP_TOP + ROW * 2 };
  return {
    pos,
    w: Math.max(WIDE.w, ...flow.nodes.map((n) => n.at[0] + PAD.x)),
    h: Math.max(WIDE.h, ...flow.nodes.map((n) => n.at[1] + PAD.y)),
  };
};

// an edge that spans more than one row of a compact board runs down the gutter between the columns (stack) or rows (strip), never under a node
const GUTTER_TURN = 30;
const gutterPath = (a: TPoint, b: TPoint, m: TLayout) => {
  if (m === 'stack') {
    const g = COL;
    const s = Math.sign(b.y - a.y);
    return `M${a.x},${a.y} Q${g},${a.y} ${g},${a.y + s * GUTTER_TURN} L${g},${b.y - s * GUTTER_TURN} Q${g},${b.y} ${b.x},${b.y}`;
  }
  const g = STRIP_TOP + ROW;
  const s = Math.sign(b.x - a.x);
  return `M${a.x},${a.y} Q${a.x},${g} ${a.x + s * GUTTER_TURN},${g} L${b.x - s * GUTTER_TURN},${g} Q${b.x},${g} ${b.x},${b.y}`;
};

export const edgePath = (a: TPoint, b: TPoint, m: TLayout, kind?: string) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if ((m === 'stack' && Math.abs(dy) > ROW * 1.5) || (m === 'strip' && Math.abs(dx) > STRIP_COL * 1.5)) return gutterPath(a, b, m);
  // a bypass edge that runs along a row bows upward so it never hides under the node it skips
  if ((kind === 'fallback' || kind === 'skip') && Math.abs(dy) < 40) {
    const lift = Math.min(160, Math.abs(dx) * 0.4);
    return `M${a.x},${a.y} C${a.x + dx * 0.2},${a.y - lift} ${b.x - dx * 0.2},${b.y - lift} ${b.x},${b.y}`;
  }
  // a long diagonal that changes rows turns in the gap between the rows, not along the source row
  const diagonal = Math.abs(dy) >= ROW && Math.abs(dx) > COL * 1.1;
  if (Math.abs(dx) >= Math.abs(dy) && !diagonal) return `M${a.x},${a.y} C${a.x + dx / 2},${a.y} ${b.x - dx / 2},${b.y} ${b.x},${b.y}`;
  return `M${a.x},${a.y} C${a.x},${a.y + dy / 2} ${b.x},${b.y - dy / 2} ${b.x},${b.y}`;
};

export const edgeKind = (flow: IAutomation, from: string, to: string) => flow.edges.find(([a, b]) => a === from && b === to)?.[2];

// #region Bot species
export type TItem = 'story' | 'job' | 'mail' | 'chart' | 'ping' | 'crate';
// Part centres in the assembled pose; the canvas crew and the lab courier both draw from these.
export const BOT = {
  chassis: { x: 0, y: -12, d: 'M-5.5-6h11a3.5 3.5 0 0 1 3.5 3.5v5a3.5 3.5 0 0 1-3.5 3.5h-11a3.5 3.5 0 0 1-3.5-3.5v-5a3.5 3.5 0 0 1 3.5-3.5z' },
  stripe: { x: 0, y: -12, d: 'M-9 2.5h18v1.5h-18z' },
  head: { x: 0, y: -25.5, d: 'M-4-5h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z' },
  visor: { x: 1, y: -25.75, d: 'M-3.25-1.25h6.5a1.25 1.25 0 0 1 0 2.5h-6.5a1.25 1.25 0 0 1 0-2.5z' },
  neck: { x1: 0, y1: -18, x2: 0, y2: -20.5 },
  antenna: { x1: 0, y1: -30.5, x2: 0, y2: -37, tip: 1.6, glow: 3.5 },
  wheel: { r: 3.5, x: 6, y: -3.5 },
  arm: { sx: 5, sy: -14, len: 8, hand: 1.8 },
  pupil: { r: 0.9, dx: 2, slide: 1.5 },
  height: 40,
  width: 20,
} as const;
export const ITEM: Record<TItem, { w: number; h: number; d: string }> = {
  story: { w: 10, h: 12, d: 'M-5-6h10v12h-10zM-3-3h6M-3 0h6M-3 3h4' },
  job: { w: 12, h: 9, d: 'M-6-3h12v7.5h-12zM-2-3v-1.5h4v1.5' },
  mail: { w: 12, h: 8, d: 'M-6-4h12v8h-12zM-6-4l6 4.5 6-4.5' },
  chart: { w: 12, h: 10, d: 'M-6-5h12v10h-12zM-4 2.5l2.5-3 2 2 3.5-4' },
  ping: { w: 10, h: 11, d: 'M-4 3v-3.5a4 4 0 0 1 8 0v3.5l1.5 1.5h-11zM-1.5 5h3' },
  crate: { w: 10, h: 10, d: 'M-5-5h10v10h-10zM-5-5l10 10M5-5l-10 10' },
};
const ITEM_BY_FLOW: Record<string, TItem> = {
  'linkedin-newsroom': 'story',
  'first-to-apply': 'job',
  'inbox-triage': 'mail',
  'trading-lab': 'chart',
  'claude-watchdog': 'ping',
};
export const itemOf = (flow: Pick<IAutomation, 'id'>): TItem => ITEM_BY_FLOW[flow.id] ?? 'crate';
// #endregion
