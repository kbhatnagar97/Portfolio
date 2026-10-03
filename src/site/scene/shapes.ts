// Procedural point clouds the particles morph between, in SHAPE id order (waypoints.ts). Every shape has exactly `n` points.
type TVec = [number, number, number];
type TSegment = [TVec, TVec];

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const gauss = (r: () => number) =>
  Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());

const rotate = (p: TVec, rx: number, ry: number): TVec => {
  const [x, y, z] = p;
  const y1 = y * Math.cos(rx) - z * Math.sin(rx);
  const z1 = y * Math.sin(rx) + z * Math.cos(rx);
  return [x * Math.cos(ry) + z1 * Math.sin(ry), y1, -x * Math.sin(ry) + z1 * Math.cos(ry)];
};

const onSphere = (r: () => number, radius: number): TVec => {
  const u = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(a) * radius, u * radius, s * Math.sin(a) * radius];
};

const latLon = (lat: number, lon: number, radius: number): TVec => {
  const c = Math.cos(lat);
  return [c * Math.cos(lon) * radius, Math.sin(lat) * radius, c * Math.sin(lon) * radius];
};

// Distributes points along segments in proportion to their length.
const alongSegments = (r: () => number, segs: TSegment[], jitter = 0.012) => {
  const lengths = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  const total = lengths.reduce((s, l) => s + l, 0);
  return (): TVec => {
    let pick = r() * total;
    let i = 0;
    while (pick > lengths[i] && i < segs.length - 1) pick -= lengths[i++];
    const [a, b] = segs[i];
    const t = r();
    return [
      a[0] + (b[0] - a[0]) * t + gauss(r) * jitter,
      a[1] + (b[1] - a[1]) * t + gauss(r) * jitter,
      a[2] + (b[2] - a[2]) * t + gauss(r) * jitter,
    ];
  };
};

const rectSegs = (x: number, y: number, w: number, h: number, z: number): TSegment[] => [
  [[x, y, z], [x + w, y, z]],
  [[x + w, y, z], [x + w, y + h, z]],
  [[x + w, y + h, z], [x, y + h, z]],
  [[x, y + h, z], [x, y, z]],
];

const orb = (r: () => number): TVec => {
  if (r() < 0.78) {
    const p = onSphere(r, 1.3 * (1 + gauss(r) * 0.015));
    return p;
  }
  const a = r() * Math.PI * 2;
  const rad = 1.85 + r() * 0.45;
  return rotate([Math.cos(a) * rad, gauss(r) * 0.02, Math.sin(a) * rad], 1.2, 0.35);
};

const interfaceSegs: TSegment[] = [
  ...rectSegs(-1.6, -1.05, 3.2, 2.1, 0),
  [[-1.6, 0.8, 0], [1.6, 0.8, 0]],
  ...rectSegs(-1.48, -0.93, 0.62, 1.6, 0.18),
  [[-1.38, 0.45, 0.18], [-0.98, 0.45, 0.18]],
  [[-1.38, 0.25, 0.18], [-1.05, 0.25, 0.18]],
  [[-1.38, 0.05, 0.18], [-1.02, 0.05, 0.18]],
  ...rectSegs(-0.72, 0.12, 2.2, 0.56, 0.32),
  [[-0.6, 0.5, 0.32], [0.5, 0.5, 0.32]],
  [[-0.6, 0.34, 0.32], [0.1, 0.34, 0.32]],
  ...rectSegs(0.95, 0.22, 0.42, 0.14, 0.32),
  ...rectSegs(-0.72, -0.93, 0.66, 0.9, 0.46),
  ...rectSegs(0.05, -0.93, 0.66, 0.9, 0.46),
  ...rectSegs(0.82, -0.93, 0.66, 0.9, 0.46),
];

const globeLines = (() => {
  const segs: TSegment[] = [];
  const R = 1.32;
  const step = Math.PI / 24;
  for (const lat of [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180)) {
    for (let lon = 0; lon < Math.PI * 2; lon += step) segs.push([latLon(lat, lon, R), latLon(lat, lon + step, R)]);
  }
  for (let m = 0; m < 12; m++) {
    const lon = (m / 12) * Math.PI * 2;
    for (let lat = -Math.PI / 2; lat < Math.PI / 2; lat += step) segs.push([latLon(lat, lon, R), latLon(lat + step, lon, R)]);
  }
  return segs;
})();

// Great circle arcs lifted off the surface, like flight paths.
const globeArcs = (() => {
  const pairs: [number, number, number, number][] = [
    [28, 77, 51, -0.1],
    [40, -74, 35, 139],
    [1, 103, -33, 151],
    [19, 72, 25, 55],
    [48, 2, 37, -122],
    [-23, -46, 30, 31],
  ];
  const d2r = Math.PI / 180;
  const segs: TSegment[] = [];
  for (const [la1, lo1, la2, lo2] of pairs) {
    const a = latLon(la1 * d2r, lo1 * d2r, 1);
    const b = latLon(la2 * d2r, lo2 * d2r, 1);
    const steps = 24;
    let prev: TVec | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const v: TVec = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      const len = Math.hypot(...v);
      const lift = 1.32 + Math.sin(Math.PI * t) * 0.35;
      const p: TVec = [(v[0] / len) * lift, (v[1] / len) * lift, (v[2] / len) * lift];
      if (prev) segs.push([prev, p]);
      prev = p;
    }
  }
  return segs;
})();

const network = (() => {
  const layers = [3, 5, 5, 2];
  const xs = [-1.65, -0.55, 0.55, 1.65];
  const r = rng(7);
  const nodes: TVec[][] = layers.map((n, li) =>
    Array.from({ length: n }, (_, i) => [xs[li], n === 1 ? 0 : -1.05 + (2.1 * i) / (n - 1), (r() - 0.5) * 0.6] as TVec),
  );
  const edges: TSegment[] = [];
  for (let l = 0; l < nodes.length - 1; l++) {
    for (const a of nodes[l]) for (const b of nodes[l + 1]) edges.push([a, b]);
  }
  return { nodes: nodes.flat(), edges };
})();

const stackSegs = (() => {
  const segs: TSegment[] = [];
  const s = 1.05;
  for (const y of [-0.9, -0.3, 0.3, 0.9]) {
    segs.push(
      [[-s, y, -s], [s, y, -s]],
      [[s, y, -s], [s, y, s]],
      [[s, y, s], [-s, y, s]],
      [[-s, y, s], [-s, y, -s]],
    );
  }
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) segs.push([[x, -0.9, z], [x, 0.9, z]]);
  return segs;
})();

export interface IShapeSet {
  positions: Float32Array[];
  rand: Float32Array;
  gold: Float32Array;
}

export const buildShapes = (n: number): IShapeSet => {
  const r = rng(42);
  const iface = alongSegments(r, interfaceSegs);
  const lines = alongSegments(r, globeLines, 0.008);
  const arcs = alongSegments(r, globeArcs, 0.006);
  const edges = alongSegments(r, network.edges, 0.004);
  const stack = alongSegments(r, stackSegs, 0.006);

  const makers: (() => TVec)[] = [
    () => orb(r),
    () => {
      if (r() < 0.82) return iface();
      // sparse fill inside the hero card and content cards
      return [-0.72 + r() * 2.2, 0.12 + r() * 0.56, 0.32 + gauss(r) * 0.01];
    },
    () => {
      const k = r();
      if (k < 0.5) return lines();
      if (k < 0.68) return arcs();
      return onSphere(r, 1.32);
    },
    () => {
      if (r() < 0.32) {
        const c = network.nodes[Math.floor(r() * network.nodes.length)];
        return [c[0] + gauss(r) * 0.06, c[1] + gauss(r) * 0.06, c[2] + gauss(r) * 0.06];
      }
      return edges();
    },
    () => {
      const p: TVec =
        r() < 0.55
          ? stack()
          : [(r() * 2 - 1) * 1.0, [-0.9, -0.3, 0.3, 0.9][Math.floor(r() * 4)], (r() * 2 - 1) * 1.0];
      return rotate(p, 0.5, 0.75);
    },
    () => [(r() * 2 - 1) * 9, (r() * 2 - 1) * 5.5, -8 + r() * 9.5],
    () => {
      const a = r() * Math.PI * 2;
      const halo = r() < 0.25;
      const rad = halo ? 2.6 + Math.abs(gauss(r)) * 0.7 : 2.4 + gauss(r) * 0.05;
      return [Math.cos(a) * rad, Math.sin(a) * rad, gauss(r) * (halo ? 0.25 : 0.05)];
    },
  ];

  const positions = makers.map((make) => {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set(make(), i * 3);
    return arr;
  });

  const rand = new Float32Array(n);
  const gold = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rand[i] = r();
    gold[i] = r() < 0.16 ? 1 : 0;
  }
  return { positions, rand, gold };
};
