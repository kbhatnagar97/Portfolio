import { setTheme } from './themes';
import { music } from './music';
import { sfx } from './sfx';
import { applyTheme, buildBus, dbg, guarded, loops, voices, type IBus } from './core';
import { KEY, LOUD_KEY, adopt, hasParked, read, registerUnlock, session } from './early';

export { applyTheme, buildBus, coarse, db, debugEvent, type IBus } from './core';

export type TMode = 'all' | 'sfx' | 'off';

const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // private mode: the mode lasts for this visit only
  }
};
// #region Lifecycle
let mode: TMode = (['all', 'sfx', 'off'] as const).find((m) => m === read(KEY)) ?? 'all';
let ctx: AudioContext | undefined;
let bus: IBus | undefined;
let phase: 'shut' | 'open' | 'closing' = 'shut';
let themeId = 'inbox-triage';
let teardown = 0;
let closedAt = -Infinity;
let failsafe = 0;
let resumePending = false;
let suspending = false;
let unavailable = false;
if (dbg) {
  dbg.state = () => ctx?.state ?? 'none';
  dbg.mode = () => mode;
  dbg.theme = () => themeId;
}
// per page session; the 2nd and later opens use the short boot
export let opens = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

// synchronously inside a click, keydown or pointerup
export function unlock() {
  if (mode === 'off') return;
  clearTimeout(teardown);
  session(read(LOUD_KEY) === '1' ? 'playback' : 'ambient');
  if (!ctx) {
    try {
      ctx = adopt() ?? new AudioContext({ latencyHint: 'interactive' });
    } catch {
      unavailable = true;
      emit();
      return;
    }
    if (dbg) dbg.constructed++;
    bus = buildBus(ctx);
    // turning sound on inside an open lab builds the bus after open() has run
    if (phase !== 'shut') applyTheme(bus, themeId);
    ctx.onstatechange = onState;
    // the lab threw before mounting
    failsafe = window.setTimeout(() => phase === 'shut' && shut(), 3000);
  }
  // a suspend still in flight would land after this resume and leave the lab silent
  if (ctx.state !== 'running' || suspending) {
    resumePending = true;
    // one silent sample wakes iOS below 17
    const b = ctx.createBufferSource();
    b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    b.connect(ctx.destination);
    b.start();
    void ctx
      .resume()
      .catch(() => undefined)
      .finally(() => {
        resumePending = false;
        emit();
      });
    arm();
  }
}

// first line of the mount layout effect; idempotent
export function open(id: string) {
  clearTimeout(teardown);
  clearTimeout(failsafe);
  // a StrictMode remount reopens in the same task; a real reopen during teardown is a new session
  if (phase === 'shut' || (phase === 'closing' && performance.now() - closedAt > 50)) {
    opens++;
    music.resetSession();
  }
  themeId = id;
  setTheme(id);
  phase = 'open';
  addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', onHide);
  addEventListener('pageshow', onShow);
  // the opener click ran before this chunk loaded and left its context parked
  if (!ctx && hasParked()) unlock();
  if (!ctx || !bus) return;
  applyTheme(bus, id);
  ramp(bus.master.gain, 1, 0.03);
  if (ctx.state !== 'running') arm();
}

// after the close SFX is played; idempotent; SFX still play while closing
export function close(fade = 0.6) {
  if (phase !== 'open') return;
  phase = 'closing';
  closedAt = performance.now();
  music.stop(fade);
  loops.killAll();
  // covers the irisClose thunk tail
  const tail = Math.max(fade, 0.12) + 0.3;
  if (ctx && bus) {
    const p = bus.master.gain;
    const t = ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(1, t);
    p.setTargetAtTime(0, t + tail, 0.03);
  }
  teardown = window.setTimeout(shut, (tail + 0.25) * 1000);
}

function shut() {
  phase = 'shut';
  removeEventListener('visibilitychange', onVis);
  removeEventListener('pagehide', onHide);
  removeEventListener('pageshow', onShow);
  disarm();
  music.stop(0);
  voices.killAll();
  loops.killAll();
  const c = ctx;
  ctx = bus = undefined;
  resumePending = false;
  suspending = false;
  void c
    ?.close()
    .catch(() => undefined)
    .finally(() => {
      if (dbg) dbg.closed++;
      session('auto');
    });
  emit();
}

// toggle click or M keydown, both gestures
export function setMode(m: TMode) {
  const was = mode;
  mode = m;
  write(KEY, m);
  emit();
  if (m === 'off') {
    music.pause(0.015);
    if (ctx && bus) {
      ramp(bus.master.gain, 0, 0.015);
      const c = ctx;
      setTimeout(() => {
        if (mode !== 'off' || c.state !== 'running') return;
        suspending = true;
        void c
          .suspend()
          .catch(() => undefined)
          .then(() => {
            suspending = false;
            if (mode === 'off') session('auto');
            // sound came back on while the suspend was in flight
            else if (c === ctx && phase === 'open') unlock();
          });
      }, 150);
    }
    return;
  }
  if (was === 'off') write(LOUD_KEY, '1');
  unlock();
  if (phase !== 'open' || !ctx || !bus) return;
  ramp(bus.master.gain, 1, 0.03);
  if (m === 'all') music.resumeOrStart(themeId);
  else music.pause(0.3);
  if (was === 'off') sfx.play('toggleOn');
}

function onVis() {
  if (!ctx || phase !== 'open') return;
  if (document.hidden) {
    music.pauseTimer();
    void ctx.suspend();
  } else if (mode !== 'off') {
    void ctx.resume().catch(() => undefined);
    music.resumeTimer();
    if (ctx.state !== 'running') arm();
  }
}
// never close here: bfcache may bring the page back
function onHide() {
  if (!ctx) return;
  music.pauseTimer();
  void ctx.suspend();
}
function onShow(e: PageTransitionEvent) {
  if (!e.persisted || phase !== 'open' || mode === 'off') return;
  music.resumeTimer();
  arm();
}
function onState() {
  if (ctx?.state === 'running') {
    resumePending = false;
    disarm();
    emit();
  } else if (phase === 'open' && mode !== 'off' && !document.hidden) arm();
}

// iOS resumes only inside a gesture, so retry on the events that count (never touchstart)
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
const retry = () => {
  if (phase === 'open' && mode !== 'off') unlock();
};
function arm() {
  GESTURES.forEach((e) => addEventListener(e, retry, { capture: true }));
}
function disarm() {
  GESTURES.forEach((e) => removeEventListener(e, retry, { capture: true }));
}

// cancelAndHoldAtTime is not in Firefox
export function ramp(p: AudioParam, v: number, tc: number, c: BaseAudioContext | undefined = ctx) {
  if (!c || !Number.isFinite(v)) return;
  const t = c.currentTime;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(v, t, tc);
}
// #endregion

export const audio = guarded({
  unlock,
  open,
  close,
  setMode,
  cycle: () => setMode(mode === 'all' ? 'sfx' : mode === 'sfx' ? 'off' : 'all'),
  get mode() {
    return mode;
  },
  // one primitive for useSyncExternalStore
  snapshot: (): TMode | 'na' => (unavailable ? 'na' : mode),
  // sfx may schedule while open or closing; a node scheduled while resume is pending plays when it resumes
  get ctx() {
    return ctx && phase !== 'shut' && mode !== 'off' && (ctx.state === 'running' || resumePending) ? ctx : undefined;
  },
  get musicOn() {
    return phase === 'open' && mode === 'all' && !!ctx;
  },
  get bus() {
    return bus;
  },
  get themeId() {
    return themeId;
  },
  get opens() {
    return opens;
  },
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
}, { snapshot: () => 'na', subscribe: () => () => undefined });

registerUnlock(() => audio.unlock());
