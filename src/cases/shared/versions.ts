// From 700px the version list becomes a filmstrip of tabs over one viewer; the list stays for phones, no JS and print.

// #region Elements
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => Object.assign(document.createElement(tag), { className });

// matches the tab widths in kit.scss, so a tab picks the capture's smallest width, its thumb when it has one
const TAB_SIZES = '(min-width: 900px) 128px, 96px';

// a fresh element, not a clone: a cloned img starts loading at once, and lazy must be set before its sources
const lazyImg = (from: HTMLImageElement, sizes: string) => {
  const i = make('img', '');
  i.loading = 'lazy';
  i.decoding = 'async';
  i.alt = '';
  i.width = from.width;
  i.height = from.height;
  if (from.srcset) {
    i.sizes = sizes;
    i.srcset = from.srcset;
  }
  i.src = from.getAttribute('src') ?? '';
  return i;
};
// #endregion

export const versions = (root: HTMLElement) => {
  const items = [...root.querySelectorAll<HTMLElement>('.versions__item')];
  if (items.length < 2) return;
  const id = root.id || 'versions';
  // post-aura cuts in 120ms; every other world crossfades over 200ms
  root.style.setProperty('--cut', `${Number(root.dataset.cut ?? 200)}ms`);

  // #region Viewer and strip
  const strip = make('div', 'versions__strip');
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-label', 'Versions');
  const panel = make('div', 'versions__viewer');
  panel.id = `${id}-panel`;
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = 0;
  const shot = make('div', 'versions__shot');
  // phones never show the viewer, so its two images wait until it is near the screen
  const shots = [make('img', ''), make('img', 'is-off')];
  for (const s of shots) s.loading = 'lazy';
  const chip = make('p', 'versions__chip');
  const body = make('div', 'versions__body');
  shot.append(...shots, chip);
  panel.append(shot, body);

  const metaOf = (item: HTMLElement) => item.querySelector('.versions__meta')?.textContent ?? '';
  const tabs = items.map((item, i) => {
    const tab = make('button', 'versions__tab');
    tab.type = 'button';
    tab.id = `${id}-tab-${i + 1}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    const capture = item.querySelector('img');
    // the tab's label names the version, so its thumbnail is decorative
    if (capture) tab.append(lazyImg(capture, TAB_SIZES));
    tab.append(Object.assign(make('span', ''), { textContent: item.dataset.tab ?? metaOf(item) }));
    strip.append(tab);
    return tab;
  });
  // #endregion

  // #region Selecting
  let current = -1;
  let front = 0;
  const select = (i: number, focus: boolean) => {
    if (i === current) return;
    current = i;
    tabs.forEach((t, j) => {
      t.setAttribute('aria-selected', String(i === j));
      t.tabIndex = i === j ? 0 : -1;
    });
    if (focus) tabs[i].focus();
    panel.setAttribute('aria-labelledby', tabs[i].id);
    chip.textContent = metaOf(items[i]);
    body.replaceChildren(...[...items[i].querySelectorAll('.versions__change, .versions__why, .versions__weight')].map((x) => x.cloneNode(true)));
    const source = items[i].querySelector('img');
    if (!source) return;
    // the next capture loads under the current one and fades in only once it can paint; its own sizes pick the width
    const back = shots[1 - front];
    Object.assign(back, { alt: source.alt, width: source.width, height: source.height });
    back.sizes = source.sizes;
    back.srcset = source.srcset;
    back.src = source.getAttribute('src') ?? '';
    void back
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (current !== i) return;
        back.classList.remove('is-off');
        shots[front].classList.add('is-off');
        front = 1 - front;
      });
  };
  // #endregion

  // #region Wiring
  strip.addEventListener('click', (e) => {
    const tab = (e.target as Element).closest('.versions__tab');
    const i = tabs.findIndex((t) => t === tab);
    if (i >= 0) select(i, false);
  });
  // roving tabindex: arrows move and select, Home and End jump to the ends
  strip.addEventListener('keydown', (e) => {
    const last = tabs.length - 1;
    const keys: Record<string, number> = { ArrowRight: Math.min(last, current + 1), ArrowLeft: Math.max(0, current - 1), Home: 0, End: last };
    if (!Object.hasOwn(keys, e.key)) return;
    e.preventDefault();
    select(keys[e.key], true);
  });

  root.append(panel, strip);
  select(0, false);
  // #endregion
};
