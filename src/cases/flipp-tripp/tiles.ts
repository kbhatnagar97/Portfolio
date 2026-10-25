// Split flap markup shared by page.ts and the stage module, so a board the script rebuilds matches the HTML it replaces.

// glyphs come from the pool (A to Z, 0 to 9 and &) or a space, so & is the only one an attribute needs escaped
export const glyphAttr = (g: string) => (g === '&' ? '&amp;' : g);

// each half draws its glyph from data-g in CSS, so no letter is text in the page
const half = (side: 'top' | 'bottom', g: string) => `<span class="ft-half ft-half--${side}" data-g="${glyphAttr(g)}"></span>`;

export const tileHtml = (top: string, o: { bottom?: string; leaves?: string; cls?: string } = {}) =>
  `<span class="ft-tile${o.cls ? ` ${o.cls}` : ''}">${half('top', top)}${half('bottom', o.bottom ?? top)}${o.leaves ?? ''}</span>`;

export const boardRowsHtml = (rows: string[]) => rows.map((r) => `<span class="ft-board__row">${[...r].map((g) => tileHtml(g)).join('')}</span>`).join('');
