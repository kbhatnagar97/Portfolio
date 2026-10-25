import { readData } from '../shared/data';
import { EASE, EASE_MOVE } from '../shared/ease';
import { gsap, reducedMotion } from '../shared/motion';
import { apply, counts, fill, plan } from './record';
import type { TPlan } from './record';
import type { IRecordRow, IStageData, TSampleId, TStatus } from './types';

// The stage demo: drop a sample sheet, watch the engine read it and draft the change, approve it.
// Every state is already in the frame's markup; this module swaps text, moves elements and adds the few marks a run
// leaves, on one GSAP timeline per press, so Start again can stop a run at any moment and restore the first frame.

// #region Timings, in seconds from a press; reduced motion holds each beat 300ms and fades
const RUN = {
  full: { parse: 0.24, scan: 0.56, match: 1.16, room: 1.4, lift: 1.64, roll: 2.2, link: 2.32, revoke: 2.44, strike: 2.68, draft: 2.8 },
  calm: { parse: 0.3, scan: 0.3, match: 0.6, room: 0.9, lift: 1.2, roll: 1.2, link: 1.2, revoke: 1.5, strike: 1.5, draft: 1.8 },
};
const PUBLISH = {
  full: { publish: 0.2, send: 0.44, ticks: 0.64, done: 0.8, settle: 1.04 },
  calm: { publish: 0.3, send: 0.6, ticks: 0.9, done: 1.2, settle: 1.5 },
};
const STAGGER = 0.04;
const TICK = 0.12;
const FADE = 0.15;
// a desk layer leaves in 130ms before the next one fades in (case.scss), so its content rises after that
const SWITCH = 0.13;
// #endregion

// #region Types and the frame's parts
type TTimeline = ReturnType<typeof gsap.timeline>;
type TTargets = Element | Element[] | NodeListOf<Element>;
type TAdd = Extract<TPlan, { kind: 'add' }>;
type TLayer = 'sheet' | 'approval' | 'sent';
type TCell = 'no' | 'title' | 'dwg' | 'status' | 'issued' | 'rev' | 'revDate';

// the row a draft adds, in the view that animates it and in the one that updates silently
interface IPending {
  id: TSampleId;
  moving: HTMLElement;
  still: HTMLElement;
  wash: HTMLElement;
}

const must = <T>(el: T | null | undefined, what: string): T => {
  if (el === null || el === undefined) throw new Error(`drawing-transmittal demo: ${what} is missing from the frame`);
  return el;
};

const find = (root: HTMLElement) => {
  const q = <T extends Element = HTMLElement>(sel: string) => must(root.querySelector<T>(sel), sel);
  const all = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];
  return {
    drop: q<HTMLButtonElement>('.dt-drop'),
    reset: q<HTMLButtonElement>('.dt-reset'),
    approve: q<HTMLButtonElement>('.dt-ap__go'),
    status: q('.dt-status'),
    readout: q('.stage__readout'),
    label: q('[data-record-label]'),
    radios: all<HTMLInputElement>('.dt-pick__radio'),
    layers: { sheet: q('[data-layer="sheet"]'), approval: q('[data-layer="approval"]'), sent: q('[data-layer="sent"]') },
    desk: q('.dt-desk'),
    record: q('.dt-record'),
    names: all('.dt-name'),
    paper: q('.dt-paper'),
    look: q('.dt-look'),
    scan: q<SVGGElement>('.sh-scan'),
    reach: q<SVGRectElement>('#dt-scan-clip rect'),
    cloud: q<SVGPathElement>('.sh-cloud'),
    washes: all<SVGRectElement>('.sh-wash'),
    field: (f: string) => q<SVGTextElement>(`.dt-sheet [data-f="${f}"]`),
    tbody: q<HTMLTableSectionElement>('.dt-table--live tbody'),
    register: q('.dt-register'),
    card: q<HTMLTemplateElement>('.dt-card-tpl'),
    jobs: all('.dt-job'),
    apFor: all('.dt-ap [data-for]'),
    apItems: all('.dt-ap > :not(.dt-ap__stamp)'),
    stamp: q('.dt-ap__stamp'),
    mail: all('.dt-mail > *'),
    mailTicks: all('.dt-mail__tick'),
    fly: q('.dt-fly'),
  };
};
// #endregion

// #region Rows and cards
const CELLS: TCell[] = ['no', 'title', 'dwg', 'status', 'issued', 'rev', 'revDate'];
const cellOf = (tr: HTMLTableRowElement, k: TCell) => tr.cells[CELLS.indexOf(k)];
const keyOf = (r: { dwg: string; rev: string }) => `${r.dwg} ${r.rev}`;
const isRow = (el: HTMLElement): el is HTMLTableRowElement => el instanceof HTMLTableRowElement;

// a value's place in a table row or a phone card; a card shows every value but the serial. The serial is its text
// span, never its cell: fading the first cell would make it a stacking context and trap the row's marks inside it
const slot = (view: HTMLElement, k: TCell): HTMLElement => {
  if (!isRow(view)) return must(view.querySelector<HTMLElement>(`[data-c="${k}"]`), `a card's ${k}`);
  return k === 'no' ? must(cellOf(view, k).querySelector<HTMLElement>('.dt-c__v'), 'a serial') : cellOf(view, k);
};
const slots = (view: HTMLElement) => (isRow(view) ? CELLS : CELLS.filter((k) => k !== 'no')).map((k) => slot(view, k));

const fillRow = (tr: HTMLTableRowElement, r: IRecordRow) => {
  tr.className = 'dt-row';
  tr.dataset.key = keyOf(r);
  for (const k of CELLS) {
    const td = cellOf(tr, k);
    (td.querySelector('.dt-c__v, .dt-dwg') ?? td).textContent = r[k];
  }
};

const fillCard = (li: HTMLElement, r: IRecordRow) => {
  li.dataset.key = keyOf(r);
  li.classList.toggle('is-revoked', r.state === 'revoked');
  for (const k of CELLS.filter((x) => x !== 'no')) slot(li, k).textContent = r[k];
  must(li.querySelector<HTMLElement>('.dt-card__rd'), 'a card date').hidden = !r.revDate;
};

const addMark = (parent: Element, cls: string) => {
  const el = document.createElement('span');
  el.className = cls;
  parent.prepend(el);
  return el;
};

// the text's own box, not the padded cell, so a flying value lands exactly where the cell shows it
const textBox = (el: Element) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getBoundingClientRect();
};

const svgX = (el: SVGTextElement | SVGRectElement) => (el instanceof SVGRectElement ? el.x.baseVal.value : el.x.baseVal.getItem(0).value);

// a value's glyph size on screen: SVG text scales with its sheet, HTML text is as its style says
const glyphSize = (el: Element) => {
  const size = parseFloat(getComputedStyle(el).fontSize);
  const svg = el instanceof SVGElement ? el.ownerSVGElement : null;
  return svg ? (size * svg.getBoundingClientRect().width) / svg.viewBox.baseVal.width : size;
};
// #endregion

export const start = (root: HTMLElement) => {
  const data = readData<IStageData>('drawing-transmittal-stage');
  if (!data) return;
  const ui = find(root);
  const ids = ui.radios.map((r) => r.value as TSampleId);
  const pristine = [...ui.tbody.rows].map((tr) => tr.cloneNode(true) as HTMLTableRowElement);
  // the stylesheet's tempo tokens, in seconds; the minifier may write 600ms as .6s, so the unit is read, not assumed
  const tempo = (name: string, fallback: number) => {
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return fallback;
    return raw.endsWith('ms') ? v / 1000 : v;
  };
  const MOVE = tempo('--move', 0.24);
  const SCAN = tempo('--scan', 0.6);
  const LAND = tempo('--land', 0.16);
  const LAYOUT = tempo('--dur-layout', 0.4);
  const STATE = tempo('--dur-state', 0.2);

  const state = {
    record: data.rows.map((r) => ({ ...r })),
    draft: undefined as IRecordRow[] | undefined,
    pending: undefined as IPending | undefined,
    published: new Set<TSampleId>(),
    look: new Set<TSampleId>(),
    phase: 'idle' as 'idle' | 'running' | 'draft' | 'publishing',
    tl: undefined as TTimeline | undefined,
  };

  // #region Small views
  const say = (s: TStatus) => {
    ui.status.textContent = data.status[s];
  };
  const tally = () => {
    ui.readout.textContent = fill(data.readout, counts(state.draft ?? state.record, state.look.size));
  };
  const busy = (on: boolean) => (on ? ui.drop.setAttribute('aria-disabled', 'true') : ui.drop.removeAttribute('aria-disabled'));
  const idle = () => {
    state.phase = 'idle';
    busy(false);
  };
  const picked = () => (ui.radios.find((r) => r.checked)?.value ?? 'rev') as TSampleId;
  // under 700px the cards are what the reader sees; the table below them updates without moving
  const onPhone = () => ui.register.offsetParent !== null;
  // the layers share one cell; an inactive one is inert, so it can be neither focused, clicked nor read
  const showLayer = (name: TLayer) => {
    for (const [k, el] of Object.entries(ui.layers)) {
      el.classList.toggle('is-on', k === name);
      el.inert = k !== name;
    }
  };
  const job = (n: number | 'left') => must(ui.jobs.find((j) => j.dataset.job === String(n)), `job ${n}`);
  const nameOf = (id: TSampleId) => must(ui.names.find((n) => n.dataset.name === id), `the ${id} file name`);

  // the sheet on the desk shows one sample: its title block values, its revision row and its file name
  const showSample = (id: TSampleId) => {
    const t = data.samples[id].titleBlock;
    const [rev, date, change] = t.revisions[0] ?? ['', '', ''];
    const text: Record<string, string> = { title: t.title, sheet: t.sheet, issued: t.issued, code: t.code, rev, revDate: date, change };
    for (const [f, v] of Object.entries(text)) ui.field(f).textContent = v;
    for (const n of ui.names) n.hidden = n.dataset.name !== id;
  };

  const newCard = (r: IRecordRow) => {
    const li = must(ui.card.content.firstElementChild, 'the card template').cloneNode(true) as HTMLElement;
    fillCard(li, r);
    return li;
  };
  const drawRegister = (rows: IRecordRow[]) => ui.register.replaceChildren(...rows.map(newCard));

  const skipStrike = (on: boolean) => {
    for (const t of job(2).querySelectorAll<HTMLElement>('[data-for]')) t.hidden = (t.dataset.for === 'skip') !== on;
  };
  // #endregion

  // #region Motion vocabulary: transform and opacity only, each turning into a short fade when motion is reduced
  const arrive = (tl: TTimeline, targets: TTargets, at: number, calm: boolean, o: { dur?: number; stagger?: number } = {}) =>
    calm
      ? tl.fromTo(targets, { opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' }, at)
      : tl.fromTo(targets, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: o.dur ?? LAND, ease: EASE, stagger: o.stagger ?? 0 }, at);

  const grow = (tl: TTimeline, targets: TTargets, at: number, calm: boolean, o: { dur?: number; stagger?: number } = {}) =>
    calm
      ? tl.fromTo(targets, { scaleX: 1, opacity: 0 }, { opacity: 1, duration: FADE, ease: 'none' }, at)
      : tl.fromTo(targets, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: o.dur ?? MOVE, ease: EASE_MOVE, stagger: o.stagger ?? 0 }, at);

  const rise = (tl: TTimeline, targets: Element[], at: number, calm: boolean) => {
    if (!calm) tl.fromTo(targets, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: STATE, ease: EASE, stagger: STAGGER }, at);
  };

  // a word that changes in place: out in 40% of a state change, swapped, back in
  const swapText = (tl: TTimeline, el: HTMLElement, text: string, at: number, to = 1) => {
    tl.to(el, { opacity: 0, duration: STATE * 0.4, ease: 'none' }, at);
    tl.call(() => void (el.textContent = text), [], at + STATE * 0.4);
    tl.to(el, { opacity: to, duration: STATE * 0.6, ease: EASE }, at + STATE * 0.4);
  };

  const doneJob = (tl: TTimeline, n: number | 'left', at: number, calm: boolean) => {
    const el = job(n);
    grow(tl, must(el.querySelector('.dt-job__wash'), 'a job wash'), at, calm);
    arrive(tl, must(el.querySelector('.dt-job__tick'), 'a job tick'), at, calm, { dur: TICK });
    tl.call(() => void (must(el.querySelector('[data-state]'), 'a job state').textContent = ', done'), [], at);
  };
  // #endregion

  // #region Beats of a drop
  const land = (tl: TTimeline, id: TSampleId, calm: boolean) => {
    const switching = !ui.layers.sheet.classList.contains('is-on');
    showLayer('sheet');
    showSample(id);
    say('name');
    arrive(tl, [nameOf(id), ui.paper], switching ? SWITCH : 0, calm, { dur: MOVE });
  };

  const parse = (tl: TTimeline, id: TSampleId, calm: boolean, at: number) =>
    grow(tl, nameOf(id).querySelectorAll('.dt-name__u'), at, calm, { dur: TICK, stagger: STAGGER });

  // the bar crosses the title block at a constant speed; each highlight grows with it from the moment it is reached
  const scan = (tl: TTimeline, id: TSampleId, calm: boolean, at: number) => {
    tl.call(() => say('scan'), [], at);
    const x0 = ui.reach.x.baseVal.value;
    const span = ui.reach.width.baseVal.value;
    const when = (x: number) => at + (SCAN * (x - x0)) / span;
    if (calm) tl.fromTo(ui.washes, { opacity: 0, scaleX: 1 }, { opacity: 1, duration: FADE, ease: 'none' }, at);
    else {
      tl.set(ui.scan, { opacity: 1, x: 0 }, at);
      tl.to(ui.scan, { x: span, duration: SCAN, ease: 'none' }, at);
      tl.to(ui.scan, { opacity: 0, duration: TICK * 0.65, ease: 'none' }, at + SCAN);
      for (const w of ui.washes)
        tl.fromTo(w, { opacity: 1, scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: (SCAN * w.width.baseVal.value) / span, ease: 'none' }, when(svgX(w)));
    }
    // the cloud marks the change on the plan once the scan reads it in the revision table
    if (data.samples[id].titleBlock.revisions.length)
      tl.fromTo(ui.cloud, { opacity: 0 }, { opacity: 1, duration: calm ? FADE : TICK, ease: 'none' }, calm ? at : when(svgX(ui.field('change'))));
  };

  const match = (tl: TTimeline, id: TSampleId, calm: boolean, at: number) => {
    tl.call(() => say('match'), [], at);
    arrive(tl, nameOf(id).querySelectorAll('.dt-name__tick'), at, calm, { stagger: STAGGER });
  };

  // the new row takes its place under the one it follows; the rows below slide down from where they were (FLIP)
  const makeRoom = (tl: TTimeline, p: TAdd, id: TSampleId, calm: boolean): IPending => {
    const tr = pristine[0].cloneNode(true) as HTMLTableRowElement;
    fillRow(tr, p.row);
    const li = newCard(p.row);
    const phone = onPhone();
    const [moving, still] = phone ? [li, tr] : [tr, li];
    const below = (phone ? [...ui.register.children] : [...ui.tbody.rows]).slice(p.at) as HTMLElement[];
    const before = below.map((el) => el.getBoundingClientRect().top);
    ui.tbody.insertBefore(tr, ui.tbody.rows[p.at] ?? null);
    ui.register.insertBefore(li, ui.register.children[p.at] ?? null);
    const after = below.map((el) => el.getBoundingClientRect().top);
    // the silent view shows the draft row at once, lime washed; the moving one waits for its values to arrive
    still.classList.add('is-new');
    const wash = addMark(isRow(moving) ? cellOf(moving, 'no') : moving, 'dt-row__wash');
    gsap.set([wash, ...slots(moving)], { opacity: 0 });
    if (isRow(moving) && id === 'rev') {
      // a roll box: the old revision shows first, then rolls up as the new one arrives
      const inner = document.createElement('span');
      inner.className = 'dt-roll__in';
      inner.append(...[data.samples.rev.revokes?.rev ?? 'R0', p.row.rev].map((t) => Object.assign(document.createElement('span'), { textContent: t })));
      const box = Object.assign(document.createElement('span'), { className: 'dt-roll' });
      box.append(inner);
      cellOf(moving, 'rev').replaceChildren(box);
    }
    if (!calm)
      below.forEach((el, i) =>
        tl.fromTo(isRow(el) ? [...el.cells] : el, { y: before[i] - after[i] }, { y: 0, duration: MOVE, ease: EASE_MOVE, clearProps: 'transform' }, tl.time()),
      );
    return { id, moving, still, wash };
  };

  // the values leave the title block and land in the new row, translate plus scale, then become the row's own text
  const lift = (tl: TTimeline, p: TAdd, r: IPending, calm: boolean, at: number) => {
    const sample = data.samples[r.id];
    const fromRev = sample.titleBlock.revisions.length ? ui.field('rev') : must(nameOf(r.id).querySelector('[data-p="rev"]'), 'the name revision');
    const pairs: { from: Element; to: HTMLElement; text: string }[] = [
      { from: ui.field('title'), to: slot(r.moving, 'title'), text: sample.titleBlock.title },
      { from: ui.field('sheet'), to: slot(r.moving, 'dwg'), text: sample.titleBlock.sheet },
      { from: ui.field('issued'), to: slot(r.moving, 'issued'), text: sample.titleBlock.issued },
      { from: fromRev, to: slot(r.moving, 'rev'), text: p.row.rev },
      ...(p.row.revDate ? [{ from: ui.field('revDate'), to: slot(r.moving, 'revDate'), text: sample.titleBlock.revisions[0]?.[1] ?? '' }] : []),
    ];
    const rest = [r.wash, ...(isRow(r.moving) ? [slot(r.moving, 'no')] : []), slot(r.moving, 'status')];
    const rolls = isRow(r.moving) && r.id === 'rev';
    if (calm) {
      tl.to([...pairs.map((x) => x.to), ...rest], { opacity: 1, duration: FADE, ease: 'none' }, at);
      return;
    }
    tl.to(rolls ? [...rest, slot(r.moving, 'rev')] : rest, { opacity: 1, duration: STATE, ease: EASE }, at);
    tl.call(() => {
      const box = ui.fly.getBoundingClientRect();
      // every rectangle is read before any clone is placed, so the flight costs one layout, not one per value
      const rects = pairs.map((x) => ({ from: x.from.getBoundingClientRect(), to: textBox(x.to), size: glyphSize(x.from) }));
      const clones = pairs.map((x) => ui.fly.appendChild(Object.assign(document.createElement('span'), { className: 'dt-clone', textContent: x.text })));
      const h = clones[0]?.getBoundingClientRect().height || 13;
      const size = clones[0] ? parseFloat(getComputedStyle(clones[0]).fontSize) : 13;
      clones.forEach((el, i) => {
        const { from, to } = rects[i];
        const k = rects[i].size / size;
        const left = to.left - box.left;
        const top = to.top - box.top + (to.height - h) / 2;
        const landed = pairs[i].to;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        const done = () => {
          gsap.to(el, { opacity: 0, duration: TICK, ease: 'none', onComplete: () => el.remove() });
          if (!(rolls && landed === slot(r.moving, 'rev'))) gsap.to(landed, { opacity: 1, duration: TICK, ease: 'none' });
        };
        // it starts exactly over the drawn value, at the drawing's size, centred on the same line
        const start = { x: from.left - box.left - left, y: from.top + from.height / 2 - box.top - top - (h * k) / 2, scale: k };
        tl.fromTo(el, start, { x: 0, y: 0, scale: 1, duration: LAYOUT, ease: EASE_MOVE, onComplete: done }, tl.time() + i * STAGGER);
      });
    }, [], at);
  };

  const roll = (tl: TTimeline, r: IPending, calm: boolean, at: number) => {
    const inner = r.moving.querySelector('.dt-roll__in');
    if (inner) {
      if (calm) tl.set(inner, { yPercent: -50 }, at);
      else tl.fromTo(inner, { yPercent: 0 }, { yPercent: -50, duration: MOVE, ease: EASE_MOVE }, at);
    }
    // the drawing number becomes a link to its exact PDF
    const dwg = isRow(r.moving) ? r.moving.querySelector('.dt-dwg') : null;
    if (dwg) {
      dwg.classList.add('is-linking');
      grow(tl, dwg.appendChild(Object.assign(document.createElement('span'), { className: 'dt-dwg__u' })), at, calm, { dur: TICK });
    }
  };

  // the replaced row stays: struck through in red, marked Revoked, its text dimmed and still readable
  const revoke = (tl: TTimeline, p: TAdd, calm: boolean, at: number) => {
    const key = keyOf(state.record[p.revoke]);
    const tr = must([...ui.tbody.rows].find((x) => x.dataset.key === key), 'the replaced row');
    const li = must([...ui.register.children].find((x) => (x as HTMLElement).dataset.key === key), 'the replaced card') as HTMLElement;
    const [moving, still] = onPhone() ? [li, tr] : [tr, li];
    const strike = (el: HTMLElement) => addMark(isRow(el) ? cellOf(el, 'no') : el, 'dt-row__strike');
    const quiet = strike(still);
    gsap.set(quiet, { scaleX: 0 });
    grow(tl, strike(moving), at, calm);
    tl.set(quiet, { scaleX: 1 }, at);
    const status = cellOf(tr, 'status');
    swapText(tl, status, data.revoked, at, 0.55);
    tl.to([slot(tr, 'no'), ...[...tr.cells].slice(1).filter((td) => td !== status)], { opacity: 0.55, duration: STATE, ease: EASE }, at);
    tl.call(() => {
      li.classList.add('is-revoked');
      slot(li, 'status').textContent = data.revoked;
    }, [], at);
  };
  // #endregion

  // #region Runs
  // every mark a run left on the desk and the jobs goes, so the next sheet lands on a clean drawing
  const clearDesk = () => {
    gsap.set([...ui.names, ui.paper, ui.look, ui.scan, ui.cloud, ui.stamp, ...ui.washes, ...ui.mailTicks, ...root.querySelectorAll('.dt-name__u, .dt-name__tick, .dt-job__wash, .dt-job__tick')], { clearProps: 'all' });
    for (const s of root.querySelectorAll('.dt-job [data-state]')) s.textContent = '';
    skipStrike(false);
  };

  const drop = () => {
    if (state.phase !== 'idle') return;
    const id = picked();
    const calm = reducedMotion();
    const T = RUN[calm ? 'calm' : 'full'];
    const p = plan(state.record, data.samples[id]);
    state.phase = 'running';
    busy(true);
    clearDesk();
    const tl = gsap.timeline();
    state.tl = tl;
    land(tl, id, calm);
    parse(tl, id, calm, T.parse);

    if (p.kind === 'refuse') {
      arrive(tl, ui.look, T.scan, calm);
      tl.call(() => {
        say('refused');
        state.look.add(id);
        tally();
        idle();
      }, [], T.scan);
      return;
    }

    scan(tl, id, calm, T.scan);
    if (p.kind === 'repeat') {
      tl.call(() => {
        say('repeat');
        idle();
      }, [], T.match);
      return;
    }

    match(tl, id, calm, T.match);
    swapText(tl, ui.label, data.record.draft, T.room);
    tl.call(() => {
      say(id === 'rev' ? 'planRev' : 'planNew');
      state.draft = apply(state.record, p, data.revoked);
      tally();
      const r = makeRoom(tl, p, id, calm);
      state.pending = r;
      lift(tl, p, r, calm, T.lift);
      roll(tl, r, calm, T.roll);
      doneJob(tl, 0, T.roll, calm);
      doneJob(tl, 1, T.link, calm);
      if (p.revoke >= 0) {
        revoke(tl, p, calm, T.revoke);
        doneJob(tl, 2, T.strike, calm);
      } else tl.call(() => skipStrike(true), [], T.revoke);
      tl.call(() => draft(r, calm), [], T.draft);
    }, [], T.room);
  };

  // the desk turns to the approval page; focus follows only if the reader was on the drop button
  const draft = (r: IPending, calm: boolean) => {
    say('draft');
    for (const el of ui.apFor) el.hidden = el.dataset.for !== r.id;
    ui.approve.removeAttribute('aria-disabled');
    showLayer('approval');
    const tl = gsap.timeline();
    state.tl = tl;
    rise(tl, ui.apItems.filter((el) => !el.hidden), SWITCH, calm);
    state.phase = 'draft';
    // the layer stopped being inert this instant, so focus can move straight to its button
    if (document.activeElement === ui.drop) ui.approve.focus();
  };

  const publish = () => {
    const r = state.pending;
    if (state.phase !== 'draft' || !r) return;
    const calm = reducedMotion();
    const T = PUBLISH[calm ? 'calm' : 'full'];
    state.phase = 'publishing';
    // pressed once is enough: the button stays where it is but says it will not act again
    ui.approve.setAttribute('aria-disabled', 'true');
    const tl = gsap.timeline();
    state.tl = tl;
    say('approved');
    arrive(tl, ui.stamp, 0, calm);
    swapText(tl, ui.label, data.record.client, T.publish);
    tl.to(r.wash, { opacity: 0, duration: STATE, ease: 'none' }, T.publish);
    tl.call(() => r.still.classList.remove('is-new'), [], T.publish);
    doneJob(tl, 3, T.publish, calm);
    tl.call(() => {
      say('sent');
      // read before the switch: an inert layer drops its focus, and the reader's place would be lost
      const held = ui.layers.approval.contains(document.activeElement);
      showLayer('sent');
      if (held) ui.drop.focus();
    }, [], T.send);
    rise(tl, ui.mail, T.send + SWITCH, calm);
    arrive(tl, ui.mailTicks, T.ticks, calm, { stagger: STAGGER });
    doneJob(tl, 4, T.done, calm);
    doneJob(tl, 'left', T.done, calm);
    tl.call(() => {
      state.record = state.draft ?? state.record;
      state.draft = undefined;
      state.pending = undefined;
      state.published.add(r.id);
      // the picker moves on to the next sample the transmittal does not hold yet
      const next = [...ids.slice(ids.indexOf(r.id) + 1), ...ids].find((x) => !state.published.has(x));
      const radio = ui.radios.find((x) => x.value === next);
      if (radio) radio.checked = true;
      idle();
    }, [], T.settle);
  };

  const reset = () => {
    state.tl?.kill();
    gsap.killTweensOf(root.querySelectorAll('*'));
    ui.fly.replaceChildren();
    Object.assign(state, { record: data.rows.map((r) => ({ ...r })), draft: undefined, pending: undefined });
    state.published.clear();
    state.look.clear();
    ui.tbody.replaceChildren(...pristine.map((tr) => tr.cloneNode(true)));
    drawRegister(state.record);
    clearDesk();
    gsap.set([ui.label, ...ui.apItems, ...ui.mail], { clearProps: 'all' });
    ui.label.textContent = data.record.client;
    const first = ui.radios.find((x) => x.value === 'rev');
    if (first) first.checked = true;
    showLayer('sheet');
    showSample('rev');
    tally();
    say('reset');
    idle();
    if (!reducedMotion()) gsap.fromTo([ui.desk, ui.record], { opacity: 0 }, { opacity: 1, duration: STATE, ease: 'none', clearProps: 'opacity' });
    ui.drop.focus();
  };
  // #endregion

  // #region Wiring
  ui.drop.addEventListener('click', drop);
  ui.approve.addEventListener('click', publish);
  ui.reset.addEventListener('click', reset);
  // between runs the desk previews the sample the reader picks; during a run the choice waits for the next drop
  for (const radio of ui.radios)
    radio.addEventListener('change', () => {
      if (state.phase !== 'idle' || !ui.layers.sheet.classList.contains('is-on')) return;
      clearDesk();
      showSample(picked());
    });
  drawRegister(state.record);
  ui.reset.removeAttribute('aria-disabled');
  idle();
  say('idle');
  // #endregion
};
