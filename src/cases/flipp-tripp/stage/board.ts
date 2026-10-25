import { reducedMotion } from '../../shared/motion';
import { onceInView } from '../../shared/view';
import type { IStageData } from '../blocks';
import { boardReadout, centre, fill, normalise, offenders, quoteList, rowsFor, sentenceCase } from '../model';
import { flip, place, type IFlapTempo } from './flap';

// Part 2 of the stage: a board the reader types on, flipping with the studio board's choreography.

interface IWords {
  text: string;
  rows: [string, string];
}

// #region Words in, glyphs out
const random = (pool: string, not: string[]) => {
  const pick = [...pool].filter((g) => !not.includes(g));
  return pick[Math.floor(Math.random() * pick.length)];
};

const wordsFor = (text: string, cols: number): IWords | undefined => {
  const rows = rowsFor(text, cols);
  return rows && { text, rows };
};

// the words, or the message that says why not: empty, then glyphs the board does not carry, then a third row
const check = (raw: string, cols: number, pool: string, errors: IStageData['board']['errors']) => {
  const text = normalise(raw);
  if (!text) return errors.empty;
  const bad = offenders(text, pool);
  if (bad.length) return fill(errors.glyphs, { chars: quoteList(bad) });
  return wordsFor(text, cols) ?? fill(errors.rows, { cols });
};

const glyphsFor = (w: IWords, cols: number) => [...w.rows.map((r) => centre(r, cols)).join('')];
// #endregion

export const typeBoard = (stage: HTMLElement, data: IStageData) => {
  const root = stage.querySelector<HTMLElement>('.ft-type');
  const form = root?.querySelector<HTMLFormElement>('.ft-form');
  const input = form?.querySelector<HTMLInputElement>('input');
  const button = form?.querySelector<HTMLButtonElement>('button');
  const error = form?.querySelector<HTMLElement>('.ft-form__error');
  const status = root?.querySelector<HTMLElement>('.ft-status');
  const readout = root?.querySelector<HTMLElement>('.stage__readout');
  if (!root || !form || !input || !button || !error || !status || !readout) return;
  const { board: b, tempo } = data;
  const t: IFlapTempo = { leafMs: tempo.leafMs, stepMs: tempo.stepMs, shade: tempo.shade, ease: getComputedStyle(document.documentElement).getPropertyValue('--ease').trim() || 'ease-out' };
  const narrow = matchMedia(`(width < ${b.phoneBelow}px)`);
  const cols = () => (narrow.matches ? b.columnsPhone : b.columns);
  const tiles = () => [...root.querySelectorAll<HTMLElement>(`.ft-board[data-cols="${cols()}"] .ft-tile`)];
  const example = () => wordsFor(normalise(b.value), cols());

  const initial = example();
  if (!initial) return;
  let words = initial;
  let shown = glyphsFor(words, cols());
  let busy = false;
  let pending: IWords | undefined;
  // a resize rebuilds the board; flips still running on the old one must not speak for it
  let generation = 0;

  // one message per completed flip, cleared first so the same words twice are still read out
  const announce = (template: string) => {
    const text = fill(template, { text: sentenceCase(words.rows) });
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = text;
    });
  };

  // #region Flipping
  const idle = () => {
    busy = false;
    if (!pending) return;
    const latest = pending;
    pending = undefined;
    flipTo(latest);
  };

  // only changed tiles flip, one random glyph then the target, 35 ms apart by column
  const flipTo = (next: IWords): void => {
    const target = glyphsFor(next, cols());
    const changed = tiles().flatMap((el, i) => (shown[i] === target[i] ? [] : [{ el, i, from: shown[i], to: target[i] }]));
    words = next;
    shown = target;
    if (!changed.length) return announce(b.same);
    if (reducedMotion()) {
      for (const x of changed) place(x.el, x.to);
      return announce(b.announce);
    }
    busy = true;
    const g = generation;
    const t0 = performance.now();
    let first = Infinity;
    let left = changed.length;
    for (const x of changed)
      flip(x.el, [x.from, random(tempo.glyphs, [x.from, x.to]), x.to], t0 + (x.i % cols()) * tempo.columnMs, t, {
        first: (now) => (first = Math.min(first, now)),
        done: (now) => {
          if (--left || g !== generation) return;
          readout.textContent = boardReadout(b.readout, { first: Math.max(0, Math.round(first - t0)), still: Math.round(now - t0) });
          announce(b.announce);
          idle();
        },
      });
  };

  // the first full view settles every tile once: two to four random glyphs before a letter, one before a blank
  const settle = () => {
    if (busy || reducedMotion()) return;
    busy = true;
    const g = generation;
    const t0 = performance.now();
    const c = cols();
    const list = tiles();
    let left = list.length;
    list.forEach((el, i) => {
      const end = shown[i];
      const runs = end === ' ' ? 1 : tempo.settleRandomMin + Math.floor(Math.random() * (tempo.settleRandomMax - tempo.settleRandomMin + 1));
      const glyphs = [end];
      for (let k = 0; k < runs; k++) glyphs.push(random(tempo.glyphs, [glyphs[glyphs.length - 1], end]));
      glyphs.push(end);
      flip(el, glyphs, t0 + (i % c) * tempo.columnMs + Math.floor(i / c) * tempo.rowMs, t, {
        done: () => {
          if (--left || g !== generation) return;
          idle();
        },
      });
    });
  };
  // #endregion

  // #region The form
  const showError = (message?: string) => {
    error.hidden = !message;
    error.textContent = message ?? '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = check(input.value, cols(), tempo.glyphs, b.errors);
    if (typeof r === 'string') return showError(r);
    showError();
    // a submit while the board moves waits, and only the newest words flip
    if (busy) pending = r;
    else flipTo(r);
  });

  // a blur checks only words the reader changed, so tabbing past the field never raises an error
  input.addEventListener('blur', () => {
    if (normalise(input.value) === words.text) return showError();
    const r = check(input.value, cols(), tempo.glyphs, b.errors);
    showError(typeof r === 'string' ? r : undefined);
  });
  // #endregion

  // across 700px the other board shows: the same words if they fit its rows, else the example again
  narrow.addEventListener('change', () => {
    generation++;
    busy = false;
    pending = undefined;
    input.maxLength = b.rows * cols();
    const kept = wordsFor(words.text, cols());
    const next = kept ?? example();
    if (!next) return;
    words = next;
    if (!kept) {
      input.value = b.value;
      showError();
      status.textContent = b.narrowed;
    }
    shown = glyphsFor(words, cols());
    tiles().forEach((el, i) => place(el, shown[i]));
  });

  input.maxLength = b.rows * cols();
  input.disabled = false;
  button.disabled = false;
  const visible = root.querySelector(`.ft-board[data-cols="${cols()}"]`);
  if (visible) onceInView(visible, settle);
};
