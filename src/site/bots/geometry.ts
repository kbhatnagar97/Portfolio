import type { ICrew, TCrewNode } from '../data';

// #region Types
export type TFloor = { y: number; g0: number; g1: number };
export type TStation = { i: number; node: TCrewNode; f: number; x: number; y: number; dir: 1 | -1 };
export type TPropKind = 'shredder' | 'tray' | 'bench';
export type TProp = { kind: TPropKind; node: TCrewNode; st: number; x: number; y: number; f: number; dir: 1 | -1; shown: number };

export type TLayout = {
  compact: boolean;
  W: number;
  H: number;
  F: number;
  C: number;
  pitch: number;
  floors: TFloor[];
  stations: TStation[];
  props: TProp[];
  station: Record<string, number>;
  prop: Record<string, number>;
};
// #endregion

// #region Route
export const PROP_SCALE = 0.8;
export const HATCH = 22;

// The run's main line, then the first choice's hops; a revisit (inbox learn to sheet) stays one station.
export const routeOf = (flow: ICrew) => {
  const ids = flow.run.map((s) => s.node);
  flow.run[flow.run.length - 1].ask?.choices[0].route.forEach((h) => ids.push(h.node));
  return ids.filter((id, i) => ids.indexOf(id) === i);
};
// #endregion

// #region Layout
export const sizeOf = (N: number, compact: boolean) => {
  const F = compact ? Math.ceil(N / 4) : 2;
  // the bottom band holds a two line caption clear of the last floor's labels
  return { W: compact ? 320 : 480, H: compact ? F * 100 + 86 : 280, F };
};

export const layoutFor = (flow: ICrew, compact: boolean): TLayout => {
  const route = routeOf(flow);
  const N = route.length;
  const { W, H, F } = sizeOf(N, compact);
  const C = Math.ceil(N / F);
  const pitch = W / C;
  const floorY = (f: number) => (compact ? 120 + f * 100 : 124 + f * 100);
  const floors: TFloor[] = [];
  for (let f = 0; f < F; f++) {
    const last = f === F - 1;
    floors.push({ y: floorY(f), g0: last ? Infinity : f % 2 ? 0 : W - HATCH, g1: last ? -Infinity : f % 2 ? HATCH : W });
  }
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const station: Record<string, number> = {};
  const stations = route.map((id, i): TStation => {
    const f = Math.floor(i / C);
    const col = f % 2 ? C - 1 - (i % C) : i % C;
    station[id] = i;
    return { i, node: byId.get(id)!, f, x: (col + 0.5) * pitch, y: floors[f].y, dir: f % 2 ? -1 : 1 };
  });

  const props: TProp[] = [];
  const prop: Record<string, number> = {};
  const add = (kind: TPropKind, id: string, s: TStation, x: number, y: number) => {
    const node = byId.get(id);
    if (!node || id in prop || id in station) return;
    prop[id] = props.length;
    props.push({ kind, node, st: s.i, x, y, f: s.f, dir: s.dir, shown: 0 });
  };
  flow.run.forEach((step) => {
    const s = stations[station[step.node]];
    let trays = 0;
    step.branches?.forEach((b) => {
      if (byId.get(b.to)?.kind === 'drop') add('shredder', b.to, s, s.x - 0.34 * pitch * s.dir, s.y);
      else add('tray', b.to, s, s.x + (trays++ ? -0.3 : 0.3) * pitch * s.dir, s.y - 60);
    });
  });
  stations.forEach((s) => {
    const via = s.node.fallback?.via;
    if (!via) return;
    const taken = props.some((p) => p.kind === 'shredder' && p.st === s.i);
    add('bench', via, s, s.x + (taken ? 0.34 : -0.34) * pitch * s.dir, s.y);
  });
  return { compact, W, H, F, C, pitch, floors, stations, props, station, prop };
};

export const floorOf = (L: TLayout, y: number) => {
  for (let i = 0; i < L.F; i++) if (L.floors[i].y >= y - 2) return i;
  return L.F - 1;
};
// #endregion
