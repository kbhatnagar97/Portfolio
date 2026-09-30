import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { gsap, lockScroll, reducedMotion } from '../smooth';
import { KIND_LABEL, NH, NW, edgeKind, edgePath, layoutOf, type TPoint } from '../flow';
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

// #region Packet
// Reads the edge path every frame, so a packet follows its edge even while a node is being dragged.
const Packet = ({ d, tone, onDone }: { d: string; tone: string; onDone: () => void }) => {
  const path = useRef<SVGPathElement>(null);
  const dot = useRef<SVGGElement>(null);

  useEffect(() => {
    const p = path.current;
    const g = dot.current;
    if (!p || !g) return;
    const o = { t: 0 };
    const tween = gsap.to(o, {
      t: 1,
      duration: reducedMotion() ? 0.05 : 0.8,
      ease: 'power1.inOut',
      onUpdate: () => {
        const pt = p.getPointAtLength(o.t * p.getTotalLength());
        g.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
      },
      onComplete: onDone,
    });
    return () => {
      tween.kill();
    };
  }, [onDone]);

  return (
    <>
      <path ref={path} d={d} fill='none' stroke='none' />
      <g ref={dot} className={`lab__packet lab__packet--${tone}`}>
        <circle r='18' className='lab__packet-halo' />
        <circle r='6' />
      </g>
    </>
  );
};
// #endregion

const WorkflowLab = ({ flow, onClose }: { flow: IAutomation; onClose: () => void }) => {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const origin = useRef({ x: innerWidth / 2, y: innerHeight / 2 });
  const [compact] = useState(() => matchMedia('(max-width: 720px)').matches);
  const board = useMemo(() => layoutOf(flow, compact), [flow, compact]);
  const byId = useMemo(() => Object.fromEntries(flow.nodes.map((n) => [n.id, n])), [flow]);

  const [pos, setPos] = useState<Record<string, TPoint>>(board.pos);
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

  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const token = useRef(0);
  const pending = useRef(new Set<() => void>());
  const answer = useRef<(c?: IFlowChoice) => void>(undefined);
  const t0 = useRef(0);
  const consoleRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const xp = MISSIONS.filter((m) => done.has(m.id)).reduce((n, m) => n + m.xp, 0);
  const rank = [...RANKS].reverse().find(([min]) => xp >= min)?.[1] ?? RANKS[0][1];
  const cleared = done.size === MISSIONS.length;

  // #region View
  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const pad = compact ? { t: 76, b: 200, l: 12, r: 12 } : { t: 96, b: 214, l: 56, r: 56 };
    const aw = w - pad.l - pad.r;
    const ah = h - pad.t - pad.b;
    const k = compact ? Math.min(aw / board.w, 1) : Math.min(aw / board.w, ah / board.h, 1.1);
    setView({ k, x: pad.l + (aw - board.w * k) / 2, y: compact ? pad.t : pad.t + Math.max(0, (ah - board.h * k) / 2) });
  }, [board, compact]);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
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
          if (cur) await travel(cur, node.fallback.via, 'alt');
          if (!alive()) return;
          flash(node.fallback.via);
          cur = node.fallback.via;
        }
        log(node.fallback.log, 'alt');
        continue;
      }
      if (cur) await travel(cur, step.node, edgeKind(flow, cur, step.node) === 'fallback' ? 'alt' : 'go');
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
        for (const hop of choice.route) {
          await travel(cur, hop.node);
          if (!alive()) return;
          flash(hop.node);
          log(hop.log, 'ok');
          cur = hop.node;
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
      const factor = (g.k0! * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0! / viewRef.current.k;
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, factor);
      return;
    }
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    g.moved = true;
    if (g.kind === 'pan') setView((v) => ({ ...v, x: g.ox + dx, y: g.oy + dy }));
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
    if (r && r.width) origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    lockScroll(true);
    root.current?.querySelector<HTMLElement>('.lab__run')?.focus({ preventScroll: true });

    const el = root.current;
    let ctx: gsap.Context | undefined;
    if (el && !reducedMotion()) {
      const { x, y } = origin.current;
      ctx = gsap.context(() => {
        gsap
          .timeline()
          .fromTo(el, { clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${x}px ${y}px)`, duration: 1, ease: 'expo.inOut' })
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
        const focusable = [...root.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
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
        </button>
      );
    });

  const renderInspector = () =>
    node && (
      <aside className='lab__inspector' aria-label={`${node.label} details`}>
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
    <div className='lab__missions' id='lab-missions' hidden={!missionsOpen}>
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
    <div className='lab__dock'>
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
        </div>
        <p className='lab__hint'>{compact ? 'Drag nodes or the board. Pinch to zoom.' : 'Drag nodes. Drag the board to pan, ctrl scroll to zoom. Space runs.'}</p>
      </div>
      {ask && (
        <div className='lab__ask' role='alertdialog' aria-labelledby='lab-ask'>
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
      <div ref={consoleRef} className='lab__console' role='log' aria-live='polite' aria-label='Run log' data-lenis-prevent>
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
      className={`lab ${compact ? 'lab--compact' : ''} ${cleared ? 'is-cleared' : ''} ${running ? 'is-running' : ''}`}
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
            {packets.map((p) => (
              <Packet key={p.id} d={edgePath(pos[p.from], pos[p.to], edgeKind(flow, p.from, p.to))} tone={p.tone} onDone={p.done} />
            ))}
          </svg>
          {renderNodes()}
        </div>
      </div>

      <header className='lab__bar'>
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
