import { gsap, ScrollTrigger } from '../shared/motion';

// The edit's motion, loaded a screen before the stage. Pinned: the scroll is the playhead, one
// path through every lane card, and every cut a pure function of the slot under it, so scrolling up rewinds it
// exactly. On phones and short screens: the lane passes a line at 40% of the screen. Reduced motion: the HTML.

// #region Reading the markup
// keep in step with $pinned in case.scss
const PINNED = '(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)';
const FOLLOW = '(prefers-reduced-motion: no-preference) and ((max-width: 899px) or (max-height: 639px))';
const LINE = 0.45;
const SLOTS = 16;

interface IState {
  slot: number;
  frame: string;
  readout: string;
  card?: HTMLElement;
}

interface ICard {
  el: HTMLElement;
  kind: 'beat' | 'clip' | 'end';
  slot: number;
  frame: string;
  frame2?: string;
  readout: string;
}

interface IEdit {
  stage: HTMLElement;
  track: HTMLElement;
  edit: HTMLElement;
  area: HTMLElement;
  playhead: HTMLElement;
  readout: HTMLElement;
  caption: HTMLElement;
  now: HTMLElement;
  frames: Map<string, HTMLElement>;
  // the line under the viewer for each frame, and the end state's for leaving a mode
  captions: Map<string, string>;
  endCaption: string;
  clips: { el: HTMLElement; from: number; to: number; track: string }[];
  rows: { el: HTMLElement; track: string }[];
  cards: ICard[];
  start: IState;
  out: IState;
  cut: number;
}

// the HTML keeps each capture once, in its lane card; the viewer's frames get their own copy here, with the viewer's
// sizes, so a frame's picture is ready before its cut (only the end frame ships with one, for readers without JS)
const fillFrames = (stage: HTMLElement) => {
  const sizes = stage.querySelector<HTMLElement>('.edit__viewer')?.dataset.sizes ?? '100vw';
  for (const card of stage.querySelectorAll<HTMLElement>('.lane__clips > .clip')) {
    const pictures = [...card.querySelectorAll<HTMLImageElement>('.clip__fig img')];
    [card.dataset.frame, card.dataset.frame2].forEach((id, i) => {
      const frame = id ? stage.querySelector<HTMLElement>(`.frame[data-frame="${id}"]`) : null;
      const from = pictures[i];
      if (!frame || !from || frame.querySelector('img')) return;
      // a fresh element with lazy set first: a hidden frame's picture loads only once the frame is near
      const pic = Object.assign(document.createElement('img'), { loading: 'lazy', decoding: 'async', alt: '', width: from.width, height: from.height });
      if (from.srcset) {
        pic.sizes = sizes;
        pic.srcset = from.srcset;
      }
      pic.src = from.getAttribute('src') ?? '';
      frame.prepend(pic);
    });
  }
};

const read = (stage: HTMLElement): IEdit | undefined => {
  const q = (s: string) => stage.querySelector<HTMLElement>(s);
  const [track, edit, area, playhead, readout, caption, now] = ['.edit-track', '.edit', '.tracks__area', '.tracks__playhead', '.edit__timeline > .stage__readout', '.edit__caption', '.edit__now'].map(q);
  const end = q('.stage__end');
  if (!track || !edit || !area || !playhead || !readout || !caption || !now || !end) return undefined;
  const frames = new Map([...stage.querySelectorAll<HTMLElement>('.frame')].map((f) => [f.dataset.frame ?? '', f]));
  // the lane's cards in reading order: a beat's head anchors the playhead at its first slot, the end card at OUT
  const cardOf = (el: HTMLElement): ICard => {
    if (el === end) return { el, kind: 'end', slot: SLOTS, frame: '', readout: readout.textContent ?? '' };
    if (el.classList.contains('beat__head')) return { el, kind: 'beat', slot: Number(el.parentElement?.dataset.first), frame: '', readout: '' };
    const d = el.dataset;
    return { el, kind: 'clip', slot: Number(d.slot), frame: d.frame ?? '', frame2: d.frame2, readout: d.readout ?? '' };
  };
  const cards = [...stage.querySelectorAll<HTMLElement>('.beat__head, .lane__clips > .clip, .stage__end')].map(cardOf);
  const clipsOnTracks = [...stage.querySelectorAll<HTMLElement>('.tracks__clip')].map((el) => ({
    el,
    from: Number(el.dataset.from),
    // a clip runs to its own slot unless it spans several, as the search layer does
    to: Number(el.dataset.to ?? el.dataset.from),
    track: el.closest<HTMLElement>('.tracks__row')?.dataset.track ?? '',
  }));
  const endFrame = [...frames.values()].find((f) => f.hasAttribute('data-end'))?.dataset.frame ?? '';
  const first = cards.find((k) => k.kind === 'clip');
  // a frame is named by its card: the clip's title, then the credit of the picture on screen when it has one
  const captions = new Map<string, string>();
  for (const k of cards.filter((x) => x.kind === 'clip')) {
    const title = k.el.querySelector('.clip__title')?.textContent ?? '';
    // the card's figures are the frame's picture then the second frame's (stage-markup.ts guarantees the order)
    const credits = [...k.el.querySelectorAll('.clip__fig')].map((f) => f.querySelector('.fig__credit')?.textContent ?? '');
    const named = (credit = '') => (credit ? `${title} · ${credit}` : title);
    captions.set(k.frame, named(credits[0]));
    if (k.frame2) captions.set(k.frame2, named(credits[1]));
  }
  return {
    stage,
    track,
    edit,
    area,
    playhead,
    readout,
    caption,
    now,
    frames,
    captions,
    endCaption: caption.textContent ?? '',
    clips: clipsOnTracks,
    rows: [...stage.querySelectorAll<HTMLElement>('.tracks__row[data-track]')].map((el) => ({ el, track: el.dataset.track ?? '' })),
    cards,
    // before the first card reaches the line: the playhead at IN, the brief on screen, every clip still ahead
    start: { slot: -1, frame: first?.frame ?? endFrame, readout: now.textContent ?? '' },
    out: { slot: SLOTS, frame: endFrame, readout: readout.textContent ?? '' },
    cut: parseFloat(getComputedStyle(stage).getPropertyValue('--cut')) || 120,
  };
};
// #endregion

// #region The viewer: cuts of --cut on top of the outgoing frame, the next two frames loading underneath
const viewer = (e: IEdit) => {
  const order = [...e.frames.keys()];
  const endFrame = e.frames.get(e.out.frame);
  let shown = endFrame;
  let fade: Animation | undefined;

  const cut = (id: string) => {
    const next = e.frames.get(id);
    if (!next || next === shown) return;
    const prev = shown;
    shown = next;
    const i = order.indexOf(id);
    const ahead = order.slice(i + 1, i + 3).map((k) => e.frames.get(k));
    for (const f of e.frames.values()) {
      const keep = f === next || f === prev || ahead.includes(f);
      f.hidden = !keep;
      f.classList.toggle('is-next', keep && f !== next && f !== prev);
      f.classList.toggle('is-on', f === next);
      f.classList.toggle('is-prev', f === prev);
    }
    // a frame not decoded when its slot arrives is shown anyway; the cut never waits
    for (const f of [next, ...ahead]) void f?.querySelector('img')?.decode().catch(() => undefined);
    e.caption.textContent = e.captions.get(id) ?? '';
    fade?.cancel();
    fade = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: e.cut, easing: 'linear' });
    fade.onfinish = () => {
      if (!prev || prev === shown) return;
      prev.classList.remove('is-prev');
      prev.hidden = !prev.classList.contains('is-next');
    };
  };

  const reset = () => {
    fade?.cancel();
    for (const f of e.frames.values()) {
      f.hidden = f !== endFrame;
      f.classList.remove('is-next', 'is-on', 'is-prev');
    }
    shown = endFrame;
  };

  return { cut, reset };
};
// #endregion

// #region Pinned: one continuous path for the playhead, sampled by scroll
interface IAnchor {
  s: number;
  x: number;
}

// piecewise linear between the cards' crossing points; a hold is two anchors with one x (the V5 midpoint)
const sample = (a: IAnchor[], s: number) => {
  if (s <= a[0].s) return a[0].x;
  const last = a[a.length - 1];
  if (s >= last.s) return last.x;
  let lo = 0;
  let hi = a.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (a[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const span = a[hi].s - a[lo].s;
  return span > 0 ? a[lo].x + ((s - a[lo].s) / span) * (a[hi].x - a[lo].x) : a[hi].x;
};

const lastCrossed = (states: { s: number }[], s: number) => {
  let k = -1;
  for (let i = 0; i < states.length && states[i].s <= s; i++) k = i;
  return k;
};

const show = (e: IEdit, s: IState, cut: (id: string) => void) => {
  cut(s.frame);
  e.readout.textContent = s.readout;
  for (const c of e.clips) {
    c.el.classList.toggle('is-ahead', s.slot < c.from);
    c.el.classList.toggle('is-current', s.slot >= c.from && s.slot <= c.to);
  }
  for (const r of e.rows) r.el.classList.toggle('is-lit', e.clips.some((c) => c.track === r.track && s.slot >= c.from && s.slot <= c.to));
  e.edit.classList.toggle('is-out', s.slot >= SLOTS);
  for (const k of e.cards) k.el.classList.toggle('is-current', k.el === s.card);
};

const pin = (e: IEdit) => {
  const v = viewer(e);
  let anchors: IAnchor[] = [];
  let states: { s: number; state: IState }[] = [];
  let current = -2;

  // on every refresh: each card's crossing point, where its top meets the reading line at 45% of the screen
  const measure = () => {
    const line = innerHeight * LINE;
    const w = e.area.clientWidth / SLOTS;
    const at = (el: Element) => el.getBoundingClientRect().top + scrollY - line;
    anchors = [];
    states = [];
    for (const k of e.cards) {
      const s = at(k.el);
      if (k.kind === 'beat') anchors.push({ s, x: k.slot * w });
      if (k.kind === 'end') {
        anchors.push({ s, x: SLOTS * w });
        states.push({ s, state: e.out });
      }
      if (k.kind !== 'clip') continue;
      anchors.push({ s, x: (k.slot + 0.5) * w });
      states.push({ s, state: { slot: k.slot, frame: k.frame, readout: k.readout, card: k.el } });
      if (!k.frame2) continue;
      const mid = s + k.el.offsetHeight / 2;
      anchors.push({ s: mid, x: (k.slot + 0.5) * w });
      states.push({ s: mid, state: { slot: k.slot, frame: k.frame2, readout: k.readout, card: k.el } });
    }
    current = -2;
  };

  const render = (scroll: number) => {
    e.playhead.style.transform = `translate3d(${sample(anchors, scroll).toFixed(2)}px, 0, 0)`;
    const k = lastCrossed(states, scroll);
    if (k === current) return;
    current = k;
    show(e, k < 0 ? e.start : states[k].state, v.cut);
  };

  e.edit.classList.add('is-live');
  // measured here too: before the page's first refresh the trigger may not have asked for its start yet
  measure();
  const trigger = ScrollTrigger.create({
    trigger: e.track,
    start: () => {
      measure();
      return anchors[0].s;
    },
    end: () => anchors[anchors.length - 1].s,
    onUpdate: (self) => render(self.scroll()),
    onRefresh: (self) => render(self.scroll()),
    onToggle: (self) => {
      e.playhead.style.willChange = self.isActive ? 'transform' : '';
    },
  });
  render(scrollY);

  // leaving the pinned query: back to the HTML's end state, which the stacked layout reads as an overview
  return () => {
    trigger.kill();
    v.reset();
    e.readout.textContent = e.out.readout;
    e.caption.textContent = e.endCaption;
    e.edit.classList.remove('is-live', 'is-out');
    for (const c of e.clips) c.el.classList.remove('is-ahead', 'is-current');
    for (const r of e.rows) r.el.classList.remove('is-lit');
    for (const k of e.cards) k.el.classList.remove('is-current');
    e.playhead.style.removeProperty('transform');
    e.playhead.style.removeProperty('will-change');
  };
};
// #endregion

// #region Following: an observer band at 40% marks the card crossing it
const headerHeight = () => {
  const top = document.querySelector<HTMLElement>('.top');
  return top && getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0;
};

const follow = (e: IEdit) => {
  let on: HTMLElement | undefined;
  const mark = (el: HTMLElement, card?: ICard) => {
    if (el === on) return;
    on?.classList.remove('is-current');
    on = card?.kind === 'clip' ? el : undefined;
    on?.classList.add('is-current');
    e.now.textContent = card?.readout ?? '';
  };
  const byEl = new Map(e.cards.map((k) => [k.el, k]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const x of entries) if (x.isIntersecting) mark(x.target as HTMLElement, byEl.get(x.target as HTMLElement));
    },
    { rootMargin: '-40% 0px -60% 0px' },
  );
  for (const k of e.cards) if (k.kind !== 'beat') io.observe(k.el);

  // the readout sticks under the site header, whose height changes where its links wrap
  const head = () => e.stage.style.setProperty('--head', `${headerHeight()}px`);
  head();
  addEventListener('resize', head, { passive: true });
  e.stage.classList.add('is-following');

  return () => {
    io.disconnect();
    removeEventListener('resize', head);
    on?.classList.remove('is-current');
    e.now.textContent = e.start.readout;
    e.stage.classList.remove('is-following');
    e.stage.style.removeProperty('--head');
  };
};
// #endregion

export const start = (stage: HTMLElement) => {
  fillFrames(stage);
  const e = read(stage);
  if (!e) return;
  // one context per mode: a rotation, a zoom or a preference change tears the old one down before the next starts
  gsap.matchMedia().add({ pinned: PINNED, follow: FOLLOW }, (ctx) => {
    if (ctx.conditions?.pinned) return pin(e);
    if (ctx.conditions?.follow) return follow(e);
    return undefined;
  });
};
