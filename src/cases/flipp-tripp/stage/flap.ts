import { at } from './clock';

// One tile's flips: the old top leaf folds under its shade, then the new bottom leaf lands. Web Animations only.

export interface IFlapTempo {
  leafMs: number;
  stepMs: number;
  shade: number;
  // the CSS --ease curve, so the landing matches every other arrival on the page
  ease: string;
}

export interface IFlapHooks {
  first?: (now: number) => void;
  done?: (now: number) => void;
}

// the newest flip owns a tile; a step it superseded does nothing (the cleanup race the client's review caught)
const owner = new WeakMap<HTMLElement, number>();
let tokens = 0;

const halves = (tile: HTMLElement) => {
  const [top, bottom] = tile.querySelectorAll<HTMLElement>('.ft-half');
  return { top, bottom };
};

const clear = (tile: HTMLElement) => {
  for (const leaf of tile.querySelectorAll('.ft-leaf')) leaf.remove();
};

const leaf = (kind: 'fold' | 'land', glyph: string) => {
  const el = document.createElement('span');
  el.className = `ft-leaf ft-leaf--${kind}`;
  el.dataset.g = glyph;
  // only while it moves: the leaf is removed the moment its step ends
  el.style.willChange = 'transform';
  const shade = document.createElement('span');
  shade.className = 'ft-shade';
  el.append(shade);
  return { el, shade };
};

// at step start the top half already shows the next glyph; the bottom half keeps the old one until the landing leaf covers it
const step = (tile: HTMLElement, prev: string, next: string, t: IFlapTempo) => {
  clear(tile);
  const { top, bottom } = halves(tile);
  top.dataset.g = next;
  bottom.dataset.g = prev;
  const fold = leaf('fold', prev);
  const land = leaf('land', next);
  tile.append(fold.el, land.el);
  const half: KeyframeAnimationOptions = { duration: t.leafMs, fill: 'both', easing: 'linear' };
  const late: KeyframeAnimationOptions = { ...half, delay: t.leafMs };
  fold.el.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], half);
  fold.shade.animate([{ opacity: 0 }, { opacity: t.shade }], half);
  land.el.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { ...late, easing: t.ease });
  land.shade.animate([{ opacity: t.shade }, { opacity: 0 }], late);
};

// glyphs[0] is what the tile shows now; each later glyph lands one step after the one before it
export const flip = (tile: HTMLElement, glyphs: string[], start: number, t: IFlapTempo, hooks: IFlapHooks = {}) => {
  const token = ++tokens;
  owner.set(tile, token);
  const mine = () => owner.get(tile) === token;
  for (let i = 1; i < glyphs.length; i++)
    at(start + (i - 1) * t.stepMs, (now) => {
      if (!mine()) return;
      step(tile, glyphs[i - 1], glyphs[i], t);
      if (i === 1) hooks.first?.(now);
    });
  at(start + (glyphs.length - 1) * t.stepMs, (now) => {
    if (!mine()) return;
    clear(tile);
    halves(tile).bottom.dataset.g = glyphs[glyphs.length - 1];
    hooks.done?.(now);
  });
};

// reduced motion, a rebuilt board: the glyph changes at once, as on the studio's board
export const place = (tile: HTMLElement, glyph: string) => {
  owner.set(tile, ++tokens);
  clear(tile);
  const { top, bottom } = halves(tile);
  top.dataset.g = glyph;
  bottom.dataset.g = glyph;
};
