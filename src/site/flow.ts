import type { IAutomation, TFlowKind } from './data';

export type TPoint = { x: number; y: number };

// Node box and board size in board units; the board is scaled to fit the screen.
export const NW = 210;
export const NH = 86;
const WIDE = { w: 1500, h: 840 };
const COL = 300;
const ROW = 150;

export const KIND_LABEL: Record<TFlowKind, string> = {
  trigger: 'Trigger',
  source: 'Collect',
  ai: 'AI model',
  rule: 'Rules',
  human: 'Human',
  output: 'Output',
  drop: 'Discard',
};

// Wide screens use the hand placed board, narrow ones a two column stack read top to bottom.
export const layoutOf = (flow: IAutomation, compact: boolean) => {
  const pos: Record<string, TPoint> = {};
  let rows = 0;
  flow.nodes.forEach((n) => {
    if (compact) {
      pos[n.id] = { x: COL / 2 + n.m[0] * COL, y: ROW / 2 + n.m[1] * ROW };
      rows = Math.max(rows, n.m[1] + 1);
    } else pos[n.id] = { x: n.at[0], y: n.at[1] };
  });
  return { pos, w: compact ? COL * 2 : WIDE.w, h: compact ? rows * ROW : WIDE.h };
};

export const edgePath = (a: TPoint, b: TPoint, kind?: string) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // a bypass edge that runs along a row bows upward so it never hides under the node it skips
  if ((kind === 'fallback' || kind === 'skip') && Math.abs(dy) < 40) {
    const lift = Math.min(160, Math.abs(dx) * 0.4);
    return `M${a.x},${a.y} C${a.x + dx * 0.2},${a.y - lift} ${b.x - dx * 0.2},${b.y - lift} ${b.x},${b.y}`;
  }
  if (Math.abs(dx) >= Math.abs(dy)) return `M${a.x},${a.y} C${a.x + dx / 2},${a.y} ${b.x - dx / 2},${b.y} ${b.x},${b.y}`;
  return `M${a.x},${a.y} C${a.x},${a.y + dy / 2} ${b.x},${b.y - dy / 2} ${b.x},${b.y}`;
};

export const edgeKind = (flow: IAutomation, from: string, to: string) => flow.edges.find(([a, b]) => a === from && b === to)?.[2];

// The run's main route as one path, for the looping packets on the section cards.
export const mainRoute = (flow: IAutomation, pos: Record<string, TPoint>) => {
  const ids = flow.run.map((s) => s.node);
  const last = flow.run[flow.run.length - 1].ask?.choices[0].route.map((h) => h.node) ?? [];
  const route = [...ids, ...last];
  return route
    .slice(1)
    .map((id, i) => edgePath(pos[route[i]], pos[id], edgeKind(flow, route[i], id)))
    .join(' ');
};
