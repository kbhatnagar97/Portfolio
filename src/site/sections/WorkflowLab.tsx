import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { gsap, lockScroll, reducedMotion } from '../smooth';
import { BOT, ITEM, KIND_LABEL, NH, NW, edgeKind, edgePath, itemOf, layoutOf, type TItem, type TLayout, type TPoint } from '../flow';
import type { IAutomation, IFlowChoice, IFlowStep } from '../data';
import '../lab.scss';

const MISSIONS = [
  { id: 'run', label: 'Run the pipeline', xp: 100 },
  { id: 'decide', label: 'Make the human call', xp: 100 },
  { id: 'chaos', label: 'Knock an AI node offline, then run it', xp: 200 },
  { id: 'drag', label: 'Rewire the board: drag a node', xp: 50 },
  { id: 'inspect', label: 'Inspect every stage', xp: 150 },
] as const;
type TMission = (typeof MISSIONS)[number]['id'];
const MAX_XP = MISSIONS.reduce((n, m) => n + m.xp, 0);
const RANKS: [number, string][] = [
  [0, 'Visitor'],
  [100, 'Operator'],
  [250, 'Engineer'],
  [450, 'Architect'],
  [MAX_XP, 'Stark level'],
];

interface IPacket {
  id: number;
  from: string;
  to: string;
  tone: string;
  done: () => void;
}

interface ILog {
  id: number;
  t: string;
  text: string;
  tone?: string;
}

type TAsk = NonNullable<IFlowStep['ask']> & { node: string };

let seq = 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// #region Layout mode
// portrait tablets get the stack too: the wide board would shrink node text under 10px there
const Q_COMPACT = '(max-width: 720px), (max-height: 560px), (max-width: 900px) and (orientation: portrait)';
const Q_STRIP = '(max-height: 560px) and (orientation: landscape)';
const subscribeMode = (cb: () => void) => {
  const qs = [Q_COMPACT, Q_STRIP].map((q) => matchMedia(q));
  qs.forEach((q) => q.addEventListener('change', cb));
  return () => qs.forEach((q) => q.removeEventListener('change', cb));
};
const modeNow = (): TLayout => (matchMedia(Q_STRIP).matches ? 'strip' : matchMedia(Q_COMPACT).matches ? 'stack' : 'wide');
// #endregion

// #region Bot
const PARTS = ['chassis', 'head', 'wheelL', 'wheelR', 'arm', 'antenna'] as const;
type TPart = (typeof PARTS)[number];
const ARM_HOME: [number, number] = [BOT.arm.sx + 3, BOT.arm.sy + 3];
const HOME: Record<TPart, [number, number]> = {
  chassis: [BOT.chassis.x, BOT.chassis.y],
  head: [BOT.head.x, BOT.head.y],
  wheelL: [-BOT.wheel.x, BOT.wheel.y],
  wheelR: [BOT.wheel.x, BOT.wheel.y],
  arm: ARM_HOME,
  antenna: [0, (BOT.antenna.y1 + BOT.antenna.y2) / 2],
};
const STALK = (BOT.antenna.y1 - BOT.antenna.y2) / 2;

// Each part is drawn about its own centre, so a broken part tumbles about itself.
const botPart = (part: TPart, halo = false) => {
  switch (part) {
    case 'chassis':
      return (
        <>
          <path className='lab__bot-shell' d={BOT.chassis.d} />
          <path className='lab__bot-stripe' d={BOT.stripe.d} />
        </>
      );
    case 'head':
      return (
        <>
          <line className='lab__bot-limb' y1={BOT.neck.y1 - BOT.head.y} y2={BOT.neck.y2 - BOT.head.y} />
          <path className='lab__bot-head' d={BOT.head.d} />
          <g transform={`translate(${BOT.visor.x - BOT.head.x} ${BOT.visor.y - BOT.head.y})`}>
            <path className='lab__bot-visor' d={BOT.visor.d} />
          </g>
          <circle className='lab__bot-pupil' r={BOT.pupil.r} cx={BOT.visor.x - BOT.pupil.dx + BOT.pupil.slide * 0.6} cy={BOT.visor.y - BOT.head.y} />
          <circle className='lab__bot-pupil' r={BOT.pupil.r} cx={BOT.visor.x + BOT.pupil.dx + BOT.pupil.slide * 0.6} cy={BOT.visor.y - BOT.head.y} />
          {halo && <circle className='lab__bot-halo' r='11' />}
        </>
      );
    case 'wheelL':
    case 'wheelR':
      return (
        <>
          <circle className='lab__bot-wheel' r={BOT.wheel.r} />
          <line className='lab__bot-spoke' y1={-BOT.wheel.r} y2={BOT.wheel.r} />
        </>
      );
    case 'arm':
      return (
        <>
          <line className='lab__bot-limb' x1='-1' y1={-BOT.arm.len / 2} x2='1' y2={BOT.arm.len / 2} />
          <circle className='lab__bot-tip' r={BOT.arm.hand} cx='1' cy={BOT.arm.len / 2} />
        </>
      );
    case 'antenna':
      return (
        <>
          <line className='lab__bot-stalk' y1={STALK} y2={-STALK} />
          <circle className='lab__bot-glow' r={BOT.antenna.glow} cy={-STALK} />
          <circle className='lab__bot-tip' r={BOT.antenna.tip} cy={-STALK} />
        </>
      );
  }
};
// #endregion

// #region Courier
const CS = 1.8;
// The packet is a courier bot carrying the flow's item; it reads the edge path every frame, so it follows a node being dragged.
const Packet = ({ d, tone, item, onDone }: { d: string; tone: string; item: TItem; onDone: () => void }) => {
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGGElement>(null);
  const bot = useRef<SVGGElement>(null);
  const body = useRef<SVGGElement>(null);

  useEffect(() => {
    const p = path.current;
    const g = dot.current;
    const b = bot.current;
    const bd = body.current;
    if (!p || !g || !b || !bd) return;
    const o = { t: 0 };
    const t0 = performance.now();
    let lx = NaN;
    let ly = 0;
    let dir = 1;
    let dist = 0;
    const tween = gsap.to(o, {
      t: 1,
      duration: reducedMotion() ? 0.05 : 0.8,
      ease: 'power1.inOut',
      onUpdate: () => {
        const pt = p.getPointAtLength(o.t * p.getTotalLength());
        if (!Number.isNaN(lx)) {
          const dx = pt.x - lx;
          dist += Math.hypot(dx, pt.y - ly);
          const s = dx < 0 ? -1 : 1;
          if (Math.abs(dx) >= 0.01 && s !== dir) {
            dir = s;
            b.setAttribute('transform', `scale(${CS * s} ${CS})`);
          }
        }
        lx = pt.x;
        ly = pt.y;
        g.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
        bd.setAttribute('transform', `translate(0 ${Math.sin(((performance.now() - t0) / 1000) * Math.PI * 6) * 1.2})`);
        b.style.setProperty('--spin', `${dist / (BOT.wheel.r * CS)}rad`);
      },
      onComplete: onDone,
    });
    return () => {
      tween.kill();
    };
  }, [onDone]);

  const [ax, ay] = ARM_HOME;
  return (
    <>
      <path ref={path} d={d} fill='none' stroke='none' />
      <g ref={dot} className={`lab__packet lab__packet--${tone}`}>
        <circle r='18' className='lab__packet-halo' transform='scale(1 0.3)' />
        <g ref={bot} className='lab__courier' transform={`scale(${CS} ${CS})`}>
          {(['wheelL', 'wheelR'] as const).map((w) => (
            <g key={w} transform={`translate(${HOME[w][0]} ${HOME[w][1]})`}>
              {botPart(w)}
            </g>
          ))}
          <g ref={body}>
            {(['chassis', 'head', 'antenna'] as const).map((w) => (
              <g key={w} transform={`translate(${HOME[w][0]} ${HOME[w][1]})`}>
                {botPart(w)}
              </g>
            ))}
            <polyline className='lab__bot-limb' points={`${ax - 3},${ay - 3} ${ax + 4},${ay - 10} ${ax - 1},-40`} />
            <path className='lab__courier-item' d={ITEM[item].d} transform='translate(0 -46)' />
            <circle className='lab__bot-tip' r={BOT.arm.hand} cx={ax - 1} cy='-40' />
          </g>
        </g>
      </g>
    </>
  );
};
// #endregion

// #region Resident
const RS = 1.4;
const rand = (n: number) => (Math.random() * 2 - 1) * n;
const H = 1 / 120;
const G = 1200;
// half extents in bot units, so a part rests on its real edge rather than on a circle
const EXT: Record<TPart, [number, number]> = { chassis: [9, 6], head: [7, 5], wheelL: [3.5, 3.5], wheelR: [3.5, 3.5], arm: [2, 5.5], antenna: [2.5, 5] };
const LIE: Record<TPart, [number, number, number]> = {
  chassis: [-2, -9.5, 84],
  head: [14, -6.5, -25],
  wheelL: [-16, -3.5, 0],
  wheelR: [24, -3.5, 0],
  arm: [6, -2, 90],
  antenna: [-12, -2.5, 70],
};
const KICK: Record<TPart, () => [number, number, number]> = {
  chassis: () => [rand(60), -140, rand(4)],
  head: () => [rand(120), -260 + rand(60), rand(12)],
  wheelL: () => [-90 - Math.random() * 60, -60, 0],
  wheelR: () => [90 + Math.random() * 60, -60, 0],
  arm: () => [rand(180), -180, rand(10)],
  antenna: () => [rand(150), -320, rand(15)],
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface IBody {
  x: number;
  y: number;
  px: number;
  py: number;
  a: number;
  spin: number;
  hw: number;
  hh: number;
}

// A Thinker standing on a node that has a fallback; knocking the node offline breaks it into parts that fall on the node.
const Resident = ({ down }: { down: boolean }) => {
  const parts = useRef<(SVGGElement | null)[]>([]);
  const sparks = useRef<(SVGLineElement | null)[]>([]);
  const bodies = useRef<IBody[]>(PARTS.map((p) => ({ x: HOME[p][0] * RS, y: HOME[p][1] * RS, px: 0, py: 0, a: 0, spin: 0, hw: EXT[p][0] * RS, hh: EXT[p][1] * RS })));
  const first = useRef(true);

  useEffect(() => {
    const B = bodies.current;
    const draw = () => B.forEach((b, i) => parts.current[i]?.setAttribute('transform', `translate(${b.x} ${b.y}) rotate(${(b.a * 180) / Math.PI}) scale(${RS})`));
    const wasFirst = first.current;
    first.current = false;
    if (wasFirst && !down) return;

    if (reducedMotion() || wasFirst) {
      PARTS.forEach((p, i) => {
        const [x, y, deg] = down ? LIE[p] : [...HOME[p], 0];
        Object.assign(B[i], { x: x * RS, y: y * RS, a: (deg * Math.PI) / 180 });
      });
      draw();
      return;
    }

    if (!down) {
      const tweens = B.map((b, i) => {
        b.a = wrap(b.a);
        const [hx, hy] = HOME[PARTS[i]];
        return gsap.fromTo(b, { x: b.x, y: b.y, a: b.a }, { x: hx * RS, y: hy * RS, a: 0, duration: 0.5, delay: i * 0.06, ease: 'back.out(2)', onUpdate: draw });
      });
      const visor = parts.current[PARTS.indexOf('head')]?.querySelector('.lab__bot-visor');
      if (visor) tweens.push(gsap.fromTo(visor, { opacity: 0 }, { opacity: 1, duration: 0.08, repeat: 1, repeatDelay: 0.08, delay: 0.85 }));
      return () => tweens.forEach((t) => t.kill());
    }

    PARTS.forEach((p, i) => {
      const [vx, vy, spin] = KICK[p]();
      const b = B[i];
      b.px = b.x - vx * H;
      b.py = b.y - vy * H;
      b.spin = spin;
    });
    const [cx, cy] = [HOME.chassis[0] * RS, HOME.chassis[1] * RS];
    const fx = sparks.current.map((l, i) => {
      const ang = (i / 4) * Math.PI * 2 + rand(0.5);
      return gsap.fromTo(
        l,
        { attr: { x1: cx, y1: cy, x2: cx, y2: cy }, opacity: 1 },
        { attr: { x1: cx + Math.cos(ang) * 14, y1: cy + Math.sin(ang) * 14, x2: cx + Math.cos(ang) * 30, y2: cy + Math.sin(ang) * 30 }, opacity: 0, duration: 0.25, ease: 'power2.out' },
      );
    });
    const left = -(NW - 44);
    let acc = 0;
    let life = 1.6;
    const step = () => {
      B.forEach((b) => {
        const vx = (b.x - b.px) * 0.999;
        const vy = (b.y - b.py) * 0.999 + G * H * H;
        b.px = b.x;
        b.py = b.y;
        b.x += vx;
        b.y += vy;
        b.a += b.spin * H;
        b.spin *= 0.98;
        const s = Math.abs(Math.sin(b.a));
        const c = Math.abs(Math.cos(b.a));
        const ey = b.hw * s + b.hh * c;
        const ex = b.hw * c + b.hh * s;
        if (b.y + ey > 0) {
          const vyn = b.y - b.py;
          b.y = -ey;
          b.py = b.y + vyn * 0.35;
          // wheels roll away, everything else scrapes to a stop
          const vxt = (b.x - b.px) * (b.hw === b.hh ? 0.99 : 0.85);
          b.px = b.x - vxt;
          if (b.hw === b.hh) b.spin += (vxt / H / b.hw - b.spin) * 0.6;
          else {
            // flat parts settle on a face instead of balancing on a corner
            const off = b.hw < b.hh ? Math.PI / 2 : 0;
            b.a += (off + Math.round((b.a - off) / Math.PI) * Math.PI - b.a) * 0.15;
            b.spin *= 0.8;
          }
        }
        if (b.x - ex < left || b.x + ex > 44) {
          const vxn = b.x - b.px;
          b.x = clamp(b.x, left + ex, 44 - ex);
          b.px = b.x + vxn * 0.35;
        }
      });
      for (let i = 0; i < B.length; i++)
        for (let j = i + 1; j < B.length; j++) {
          const a = B[i];
          const b = B[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.hw + a.hh + b.hw + b.hh) / 2;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const push = (min - d) / d / 2;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
    };
    const tick = (_t: number, dtMs: number) => {
      const dt = Math.min(dtMs / 1000, 0.1);
      acc += dt;
      life -= dt;
      for (let n = 0; acc >= H && n < 6; n++, acc -= H) step();
      if (acc >= H) acc = 0;
      draw();
      if (life <= 0) gsap.ticker.remove(tick);
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      fx.forEach((t) => t.kill());
    };
  }, [down]);

  return (
    <svg className={`lab__resident ${down ? 'is-down' : ''}`} aria-hidden='true' overflow='visible' width='1' height='1'>
      <g className='lab__resident-crew'>
        {PARTS.map((p, i) => (
          <g
            key={p}
            ref={(el) => {
              parts.current[i] = el;
            }}
            transform={`translate(${HOME[p][0] * RS} ${HOME[p][1] * RS}) scale(${RS})`}
          >
            {botPart(p, true)}
          </g>
        ))}
      </g>
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          ref={(el) => {
            sparks.current[i] = el;
          }}
          className='lab__resident-spark'
          x1='0'
          y1='0'
          x2='0'
          y2='0'
        />
      ))}
    </svg>
  );
};
// #endregion

const WorkflowLab = ({ flow, onClose }: { flow: IAutomation; onClose: () => void }) => {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const origin = useRef({ x: innerWidth / 2, y: innerHeight / 2 });
  const bar = useRef<HTMLElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  const mode = useSyncExternalStore(subscribeMode, modeNow);
  const compact = mode !== 'wide';
  const board = useMemo(() => layoutOf(flow, mode), [flow, mode]);
  const byId = useMemo(() => Object.fromEntries(flow.nodes.map((n) => [n.id, n])), [flow]);
  const item = itemOf(flow);

  const [pos, setPos] = useState<Record<string, TPoint>>(board.pos);
  // a layout switch (rotation, resize) drops drag offsets, they belong to the old layout
  const [posBoard, setPosBoard] = useState(board);
  if (posBoard !== board) {
    setPosBoard(board);
    setPos(board.pos);
  }
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [selected, setSelected] = useState<string>();
  const [inspected, setInspected] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState<Set<string>>(new Set());
  const [hot, setHot] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [packets, setPackets] = useState<IPacket[]>([]);
  const [logs, setLogs] = useState<ILog[]>([]);
  const [ask, setAsk] = useState<TAsk>();
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState(0);
  const [done, setDone] = useState<Set<TMission>>(new Set());
  const [toast, setToast] = useState<{ id: number; title: string; xp?: number }>();
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const token = useRef(0);
  const pending = useRef(new Set<() => void>());
  const answer = useRef<(c?: IFlowChoice) => void>(undefined);
  const t0 = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const posRef = useRef(pos);
  posRef.current = pos;
  const layoutRef = useRef({ mode, board });
  layoutRef.current = { mode, board };
  const lastUser = useRef(-1e9);
  const cam = useRef<gsap.core.Tween>(undefined);

  const xp = MISSIONS.filter((m) => done.has(m.id)).reduce((n, m) => n + m.xp, 0);
  const rank = [...RANKS].reverse().find(([min]) => xp >= min)?.[1] ?? RANKS[0][1];
  const cleared = done.size === MISSIONS.length;

  // #region View
  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    cam.current?.kill();
    const { width: w, height: h } = el.getBoundingClientRect();
    if (mode === 'wide') {
      const aw = w - 112;
      const ah = h - 96 - 214;
      const k = Math.min(aw / board.w, ah / board.h, 1.1);
      setView({ k, x: 56 + (aw - board.w * k) / 2, y: 96 + Math.max(0, (ah - board.h * k) / 2) });
      return;
    }
    // measured, because the bar wraps and the dock grows with the ask on small screens
    const t = (bar.current?.offsetHeight ?? 60) + 6;
    const b = h - (dock.current?.offsetTop ?? h) + 6;
    const aw = w - 24;
    const ah = h - t - b;
    if (mode === 'strip') {
      const k = Math.min(ah / board.h, 1);
      setView({ k, x: 12, y: t + Math.max(0, (ah - board.h * k) / 2) });
    } else {
      const k = Math.min(aw / board.w, 1.25);
      setView({ k, x: 12 + (aw - board.w * k) / 2, y: t });
    }
  }, [board, mode]);

  // The part of the screen not covered by the bar, the dock, the inspector or the ask, in viewport px.
  const openBand = () => {
    const r = viewport.current!.getBoundingClientRect();
    const band = { t: bar.current ? bar.current.getBoundingClientRect().bottom - r.top : 0, b: r.height, l: 0, r: r.width };
    [dock.current, sheet.current, askRef.current].forEach((el) => {
      if (!el) return;
      const e = el.getBoundingClientRect();
      if (!e.width) return;
      // only the landscape ask floats at the side; everywhere else it sits in the dock
      if (e.width > r.width * 0.6 || (el === askRef.current && layoutRef.current.mode !== 'strip')) band.b = Math.min(band.b, e.top - r.top);
      else band.r = Math.min(band.r, e.left - r.left);
    });
    return band;
  };

  // Pan so the node the run is heading to sits in the open part of the screen; wide boards only move for the ask or the inspector.
  const follow = (id: string, force = false) => {
    const { mode: m, board: b } = layoutRef.current;
    const p = posRef.current[id];
    if ((m === 'wide' && !force) || !p || !viewport.current || (!force && performance.now() - lastUser.current < 3000)) return;
    const v = viewRef.current;
    const band = openBand();
    const hw = (NW / 2) * v.k;
    const hh = (NH / 2) * v.k;
    const sx = v.x + p.x * v.k;
    const sy = v.y + p.y * v.k;
    let { x, y } = v;
    if (sx - hw < band.l || sx + hw > band.r) {
      const tx = band.l + (band.r - band.l) * (m === 'strip' ? 0.35 : 0.5) - p.x * v.k;
      x = clamp(tx, Math.min(band.r - b.w * v.k - 12, band.l + 12), Math.max(band.l + 12, v.x));
    }
    // the resident bot stands on top of the node, so leave headroom above it
    if (sy - hh - 60 * v.k < band.t || sy + hh > band.b) {
      const ty = band.t + (band.b - band.t) * 0.4 - p.y * v.k;
      y = clamp(ty, Math.min(band.b - b.h * v.k - 12, band.t + 12), Math.max(band.t + 12, v.y));
    }
    if (x === v.x && y === v.y) return;
    cam.current?.kill();
    if (reducedMotion()) return setView({ ...v, x, y });
    const o = { x: v.x, y: v.y };
    cam.current = gsap.to(o, { x, y, duration: 0.5, ease: 'power2.out', onUpdate: () => setView((cur) => ({ ...cur, x: o.x, y: o.y })) });
  };

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    lastUser.current = performance.now();
    cam.current?.kill();
    setView((v) => {
      const k = clamp(v.k * factor, 0.3, 2.2);
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  }, []);

  useLayoutEffect(() => {
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, [fit]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    // native listener: React's wheel handler is passive, and ctrl plus wheel must not zoom the whole page
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lastUser.current = performance.now();
      cam.current?.kill();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);
  // #endregion

  // #region Missions
  const complete = useCallback((m: TMission) => setDone((d) => (d.has(m) ? d : new Set(d).add(m))), []);
  const seen = useRef(new Set<TMission>());
  useEffect(() => {
    const fresh = MISSIONS.find((m) => done.has(m.id) && !seen.current.has(m.id));
    if (!fresh) return;
    seen.current = new Set(done);
    setToast(
      done.size === MISSIONS.length
        ? { id: ++seq, title: 'Full clearance. Stark level unlocked', xp: fresh.xp }
        : { id: ++seq, title: fresh.label, xp: fresh.xp },
    );
  }, [done]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (inspected.size === flow.nodes.length) complete('inspect');
  }, [inspected, flow.nodes.length, complete]);

  const inspect = (id?: string) => {
    setSelected(id);
    if (id) setInspected((s) => (s.has(id) ? s : new Set(s).add(id)));
  };
  // #endregion

  // #region Engine
  const log = (text: string, tone?: string) =>
    setLogs((l) => [...l.slice(-60), { id: ++seq, t: ((performance.now() - t0.current) / 1000).toFixed(2).padStart(5, '0'), text, tone }]);

  const flash = (id: string) => {
    setVisited((v) => new Set(v).add(id));
    setHot((h) => new Set(h).add(id));
    setTimeout(
      () =>
        setHot((h) => {
          const n = new Set(h);
          n.delete(id);
          return n;
        }),
      900,
    );
  };

  const travel = (from: string, to: string, tone = 'go') =>
    new Promise<void>((resolve) => {
      const id = ++seq;
      const finish = () => {
        pending.current.delete(finish);
        setPackets((p) => p.filter((x) => x.id !== id));
        resolve();
      };
      pending.current.add(finish);
      setPackets((p) => [...p, { id, from, to, tone, done: finish }]);
    });

  const hop = (from: string, to: string, tone?: string) => {
    follow(to);
    return travel(from, to, tone);
  };

  const stop = useCallback(() => {
    token.current++;
    pending.current.forEach((f) => f());
    answer.current?.();
    answer.current = undefined;
    setAsk(undefined);
    setPackets([]);
    setRunning(false);
  }, []);

  const run = async () => {
    if (running) return;
    const me = ++token.current;
    const alive = () => token.current === me;
    t0.current = performance.now();
    setRunning(true);
    setVisited(new Set());
    setLogs([]);
    log(`Run ${runs + 1} started`, 'sys');
    let cur: string | undefined;
    let chaos = false;

    for (const step of flow.run) {
      const node = byId[step.node];
      if (offlineRef.current.has(step.node) && node.fallback) {
        chaos = true;
        if (node.fallback.via) {
          if (cur) await hop(cur, node.fallback.via, 'alt');
          if (!alive()) return;
          flash(node.fallback.via);
          cur = node.fallback.via;
        }
        log(node.fallback.log, 'alt');
        continue;
      }
      if (cur) await hop(cur, step.node, edgeKind(flow, cur, step.node) === 'fallback' ? 'alt' : 'go');
      else follow(step.node);
      if (!alive()) return;
      flash(step.node);
      log(step.log);
      const from = step.node;
      step.branches?.forEach((b) =>
        travel(from, b.to, b.tone ?? 'drop').then(() => {
          if (!alive()) return;
          flash(b.to);
          log(b.log, b.tone ?? 'drop');
        }),
      );
      cur = step.node;

      if (step.ask) {
        setAsk({ ...step.ask, node: step.node });
        const choice = await new Promise<IFlowChoice | undefined>((r) => (answer.current = r));
        answer.current = undefined;
        setAsk(undefined);
        if (!alive() || !choice) return;
        complete('decide');
        log(choice.log, choice.tone);
        for (const h of choice.route) {
          await hop(cur, h.node);
          if (!alive()) return;
          flash(h.node);
          log(h.log, 'ok');
          cur = h.node;
        }
        break;
      }
      await sleep(reducedMotion() ? 0 : 260);
      if (!alive()) return;
    }

    await sleep(400);
    if (!alive()) return;
    log(chaos ? 'Run complete. The fallback held' : 'Run complete', 'sys');
    setRuns((n) => n + 1);
    complete('run');
    if (chaos) complete('chaos');
    setRunning(false);
  };

  const reset = () => {
    stop();
    setPos(board.pos);
    setVisited(new Set());
    setOffline(new Set());
    setLogs([]);
    fit();
  };

  const toggleOffline = (id: string) =>
    setOffline((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // #endregion

  // #region Gestures
  const gesture = useRef<{ kind: 'node' | 'pan' | 'pinch'; id?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; d0?: number; k0?: number }>(undefined);
  const pointers = useRef(new Map<number, TPoint>());

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    cam.current?.kill();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', sx: 0, sy: 0, ox: 0, oy: 0, moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y), k0: viewRef.current.k };
      return;
    }
    const id = (e.target as Element).closest<HTMLElement>('[data-node]')?.dataset.node;
    const p = id ? pos[id] : viewRef.current;
    gesture.current = { kind: id ? 'node' : 'pan', id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const r = e.currentTarget.getBoundingClientRect();
      lastUser.current = performance.now();
      const factor = (g.k0! * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0! / viewRef.current.k;
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, factor);
      return;
    }
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    g.moved = true;
    if (g.kind === 'pan') {
      lastUser.current = performance.now();
      setView((v) => ({ ...v, x: g.ox + dx, y: g.oy + dy }));
    }
    else if (g.id) {
      const k = viewRef.current.k;
      const id = g.id;
      setPos((p) => ({ ...p, [id]: { x: clamp(g.ox + dx / k, NW / 2, board.w - NW / 2), y: clamp(g.oy + dy / k, NH / 2, board.h - NH / 2) } }));
    }
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    gesture.current = undefined;
    if (g?.kind === 'pan' && !g.moved && e.type === 'pointerup') inspect(undefined);
    if (!g || g.kind !== 'node' || !g.id) return;
    if (g.moved) complete('drag');
    else inspect(selected === g.id ? undefined : g.id);
  };

  const onNodeKey = (e: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    const step = e.shiftKey ? 60 : 20;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    setPos((p) => ({ ...p, [id]: { x: clamp(p[id].x + d[0], NW / 2, board.w - NW / 2), y: clamp(p[id].y + d[1], NH / 2, board.h - NH / 2) } }));
    complete('drag');
  };

  // pointer capture on the board swallows mouse clicks, so this only answers the keyboard
  const onNodeClick = (e: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    if (e.detail === 0) inspect(selected === id ? undefined : id);
  };
  // #endregion

  // #region Open and close
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    stop();
    const el = root.current;
    if (!el || reducedMotion()) return onClose();
    const { x, y } = origin.current;
    gsap.to(el, { clipPath: `circle(0px at ${x}px ${y}px)`, duration: 0.6, ease: 'expo.in', onComplete: onClose });
  }, [onClose, stop]);

  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const r = opener?.getBoundingClientRect();
    // Safari never focuses a clicked button, so activeElement can be the body far above the viewport
    if (r && r.width && opener !== document.body && r.bottom > 0 && r.top < innerHeight) origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lockScroll(true);
    root.current?.querySelector<HTMLElement>('.lab__run')?.focus({ preventScroll: true });

    const el = root.current;
    let ctx: gsap.Context | undefined;
    if (el && !reducedMotion()) {
      const { x, y } = origin.current;
      ctx = gsap.context(() => {
        gsap
          .timeline()
          .fromTo(el, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px at ${x}px ${y}px)`, duration: 1, ease: 'expo.inOut' })
          .from('.lab__boot p', { opacity: 0, x: -12, duration: 0.3, stagger: 0.16 }, 0.35)
          .to('.lab__boot', { opacity: 0, duration: 0.4 }, 1.35)
          .from('.lab__reactor', { scale: 0.2, opacity: 0, duration: 1.4, ease: 'expo.out' }, 0.4)
          .from('.lab__edge-base', { strokeDashoffset: 1, duration: 1, ease: 'power2.inOut', stagger: 0.04 }, 1.1)
          .fromTo('.lab__node', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.6)', stagger: 0.05, clearProps: 'opacity,scale,transform' }, 1.05)
          .from('.lab__bar, .lab__dock', { opacity: 0, y: (i) => (i ? 24 : -24), duration: 0.6, ease: 'power3.out' }, 1.2);
      }, el);
    }
    return () => {
      ctx?.revert();
      lockScroll(false);
      opener?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === 'Escape') {
        if (selected) inspect(undefined);
        else if (missionsOpen) setMissionsOpen(false);
        else close();
      }
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault();
        run();
      }
      if (e.key === 'Tab' && root.current) {
        const focusable = [...root.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter((el) => el.getClientRects().length);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  useEffect(() => () => stop(), [stop]);

  useEffect(() => () => void cam.current?.kill(), []);

  // the asking node and the inspected node must never sit under the prompt or the sheet
  useEffect(() => {
    const id = ask?.node ?? selected;
    if (!id) return;
    const raf = requestAnimationFrame(() => follow(id, true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follow reads refs; rerun only when the target changes
  }, [ask, selected]);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [logs]);
  // #endregion

  // #region Render
  const node = selected ? byId[selected] : undefined;
  const aiNodes = flow.nodes.filter((n) => n.fallback);

  const renderEdges = () =>
    flow.edges.map(([a, b, kind]) => {
      const d = edgePath(pos[a], pos[b], kind);
      const dead = offline.has(a) || offline.has(b);
      const live = visited.has(a) && visited.has(b);
      return (
        <g key={`${a}-${b}`} className={`lab__edge lab__edge--${kind ?? 'main'} ${dead ? 'is-dead' : ''} ${live ? 'is-live' : ''}`}>
          <path className='lab__edge-base' d={d} pathLength={1} />
          <path className='lab__edge-flow' d={d} />
        </g>
      );
    });

  const renderNodes = () =>
    flow.nodes.map((n, i) => {
      const p = pos[n.id];
      const state = [
        hot.has(n.id) && 'is-hot',
        visited.has(n.id) && 'is-visited',
        offline.has(n.id) && 'is-offline',
        selected === n.id && 'is-selected',
        ask?.node === n.id && 'is-asking',
      ]
        .filter(Boolean)
        .join(' ');
      return (
        <button
          key={n.id}
          type='button'
          data-node={n.id}
          className={`lab__node lab__node--${n.kind} ${state}`}
          style={{ left: p.x - NW / 2, top: p.y - NH / 2, width: NW, height: NH }}
          aria-label={`${n.label}, ${KIND_LABEL[n.kind]}. ${n.sub}.${offline.has(n.id) ? ' Offline.' : ''} Enter to inspect, arrow keys to move.`}
          aria-pressed={selected === n.id}
          onClick={(e) => onNodeClick(e, n.id)}
          onKeyDown={(e) => onNodeKey(e, n.id)}
        >
          <span className='lab__node-kind'>
            <span className='lab__led' aria-hidden='true' />
            {String(i + 1).padStart(2, '0')} · {KIND_LABEL[n.kind]}
          </span>
          <span className='lab__node-label'>{n.label}</span>
          <span className='lab__node-sub'>{offline.has(n.id) ? 'Offline' : n.sub}</span>
          {inspected.has(n.id) && <span className='lab__node-seen' aria-hidden='true' />}
          {n.fallback && <Resident down={offline.has(n.id)} />}
        </button>
      );
    });

  const renderInspector = () =>
    node && (
      <aside ref={sheet} className='lab__inspector' aria-label={`${node.label} details`} data-lenis-prevent>
        <header>
          <p className='lab__mono'>
            Stage {flow.nodes.indexOf(node) + 1} of {flow.nodes.length} · {KIND_LABEL[node.kind]}
          </p>
          <button type='button' className='lab__icon' onClick={() => inspect(undefined)} aria-label='Close details'>
            ×
          </button>
        </header>
        <h3>{node.label}</h3>
        <p className='lab__inspector-sub'>{node.sub}</p>
        <p>{node.body}</p>
        {node.fallback && (
          <div className='lab__chaos'>
            <p className='lab__mono'>Chaos test</p>
            <p>{node.fallback.via ? `If this goes down, ${byId[node.fallback.via].label} takes over.` : 'If this goes down, the run skips it and still publishes.'}</p>
            <button type='button' className={`lab__btn ${offline.has(node.id) ? 'is-on' : ''}`} onClick={() => toggleOffline(node.id)}>
              {offline.has(node.id) ? 'Bring it back online' : 'Knock it offline'}
            </button>
          </div>
        )}
        <div className='lab__links'>
          {flow.edges
            .filter(([a]) => a === node.id)
            .map(([, b]) => (
              <button key={b} type='button' onClick={() => inspect(b)}>
                → {byId[b].label}
              </button>
            ))}
        </div>
      </aside>
    );

  const renderMissions = () => (
    <div className='lab__missions' id='lab-missions' hidden={!missionsOpen} data-lenis-prevent>
      <p className='lab__mono'>
        Clearance · {rank} · {xp} / {MAX_XP} XP
      </p>
      <div className='lab__xp' aria-hidden='true'>
        <span style={{ transform: `scaleX(${xp / MAX_XP})` }} />
      </div>
      <ul>
        {MISSIONS.map((m) => (
          <li key={m.id} className={done.has(m.id) ? 'is-done' : ''}>
            <span className='lab__tick' aria-hidden='true' />
            <span>
              {m.label}
              {m.id === 'inspect' && !done.has(m.id) && ` (${inspected.size}/${flow.nodes.length})`}
              {m.id === 'chaos' && !done.has(m.id) && aiNodes.length > 0 && `: try ${aiNodes.map((n) => n.label).join(' or ')}`}
            </span>
            <span className='lab__mono'>{done.has(m.id) ? 'Done' : `+${m.xp}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderDock = () => (
    <div ref={dock} className='lab__dock'>
      <div className='lab__controls'>
        <button type='button' className='lab__run' onClick={run} disabled={running}>
          <span className='lab__run-core' aria-hidden='true' />
          {running ? 'Running' : runs ? 'Run it again' : 'Run the pipeline'}
        </button>
        <div className='lab__tools' role='group' aria-label='Board'>
          <button type='button' className='lab__icon' onClick={() => zoomAt(innerWidth / 2, innerHeight / 2, 1 / 1.25)} aria-label='Zoom out'>
            −
          </button>
          <button type='button' className='lab__icon lab__icon--wide' onClick={fit}>
            Fit
          </button>
          <button type='button' className='lab__icon' onClick={() => zoomAt(innerWidth / 2, innerHeight / 2, 1.25)} aria-label='Zoom in'>
            +
          </button>
          <button type='button' className='lab__icon lab__icon--wide' onClick={reset}>
            Reset
          </button>
          <button type='button' className='lab__icon lab__icon--wide lab__logbtn' aria-expanded={logOpen} aria-controls='lab-log' onClick={() => setLogOpen((o) => !o)}>
            Log
          </button>
        </div>
        <p className='lab__hint'>{compact ? 'Drag nodes or the board. Pinch to zoom.' : 'Drag nodes. Drag the board to pan, ctrl scroll to zoom. Space runs.'}</p>
      </div>
      {ask && (
        <div ref={askRef} className='lab__ask' role='alertdialog' aria-labelledby='lab-ask'>
          <p className='lab__mono'>Incoming · {byId[ask.node].label}</p>
          <p id='lab-ask'>{ask.prompt}</p>
          <div>
            {ask.choices.map((c, i) => (
              <button key={c.label} type='button' className={`lab__btn ${i === 0 ? 'is-primary' : ''}`} onClick={() => answer.current?.(c)} autoFocus={i === 0}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div ref={consoleRef} id='lab-log' className={`lab__console ${logOpen ? 'is-open' : ''}`} role='log' aria-live='polite' aria-label='Run log' data-lenis-prevent>
        {logs.length === 0 && <p className='lab__console-idle'>Standing by. Hit run and watch the data move.</p>}
        {logs.map((l) => (
          <p key={l.id} className={l.tone ? `is-${l.tone}` : ''}>
            <span>T+{l.t}</span>
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );

  return createPortal(
    <div
      ref={root}
      className={`lab lab--${mode} ${compact ? 'lab--compact' : ''} ${cleared ? 'is-cleared' : ''} ${running ? 'is-running' : ''}`}
      role='dialog'
      aria-modal='true'
      aria-labelledby='lab-title'
      style={{ '--accent': flow.accent, '--gx': `${view.x}px`, '--gy': `${view.y}px`, '--gs': `${40 * view.k}px` } as CSSProperties}
    >
      <div className='lab__grid' aria-hidden='true' />
      <svg className='lab__reactor' viewBox='-200 -200 400 400' aria-hidden='true'>
        <circle r='190' className='r1' />
        <circle r='150' className='r2' />
        <circle r='112' className='r3' />
        <circle r='70' className='r4' />
        <circle r='26' className='r5' />
      </svg>
      <div className='lab__scan' aria-hidden='true' />

      <div ref={viewport} className='lab__viewport' onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className='lab__stage' style={{ width: board.w, height: board.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className='lab__wires' width={board.w} height={board.h} aria-hidden='true'>
            {renderEdges()}
          </svg>
          {renderNodes()}
          <svg className='lab__wires' width={board.w} height={board.h} aria-hidden='true'>
            {packets.map((p) => (
              <Packet key={p.id} d={edgePath(pos[p.from], pos[p.to], edgeKind(flow, p.from, p.to))} tone={p.tone} item={item} onDone={p.done} />
            ))}
          </svg>
        </div>
      </div>

      <header ref={bar} className='lab__bar'>
        <div className='lab__title'>
          <p className='lab__mono'>
            <span className='lab__led lab__led--live' aria-hidden='true' /> Workflow lab · live {flow.cadence}
          </p>
          <h2 id='lab-title'>{flow.name}</h2>
        </div>
        <dl className='lab__stats'>
          {flow.stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value.toLocaleString('en-IN')}</dd>
            </div>
          ))}
        </dl>
        <div className='lab__actions'>
          <button type='button' className='lab__chip' aria-expanded={missionsOpen} aria-controls='lab-missions' onClick={() => setMissionsOpen((o) => !o)}>
            Missions {done.size}/{MISSIONS.length} <span>{xp} XP</span>
          </button>
          {flow.writeup && (
            <a className='lab__chip lab__chip--link' href={flow.writeup} target='_blank' rel='noopener noreferrer'>
              Write-up <span aria-hidden='true'>↗</span>
            </a>
          )}
          <button type='button' className='lab__icon lab__close' onClick={close} aria-label='Close workflow lab'>
            ×
          </button>
        </div>
        {renderMissions()}
      </header>

      {renderInspector()}

      {renderDock()}

      {toast && (
        <div key={toast.id} className='lab__toast' role='status'>
          <span className='lab__mono'>{cleared ? 'All missions' : 'Mission complete'}</span>
          {toast.title}
          {toast.xp && <b>+{toast.xp} XP</b>}
        </div>
      )}

      <div className='lab__boot' aria-hidden='true'>
        <p>Linking {flow.nodes.length} stages</p>
        <p>Calibrating {flow.edges.length} data lines</p>
        <p>{flow.name} online</p>
      </div>
      <div className='lab__frame' aria-hidden='true' />
    </div>,
    document.body,
  );
  // #endregion
};

export default WorkflowLab;
