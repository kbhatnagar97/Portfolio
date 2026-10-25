import { esc } from '../../html/core';
import { chapter, chips, figure, heroFigure, metricTiles, setup, turn } from '../build/parts';
import type { ICase } from '../build/types';
import type { IAddresses, IChecker, ICounts, IDoors, IPara, IRunning, ISaved, ITurnBlock, TSide } from './blocks';
import { cited, para } from './page-copy';

// Build time only. The chapters after the stage, in page order.

// #region Phrases of eight
interface IPhrase {
  side: TSide;
  text: string;
  aside: string;
  // a modifier for the aside: phone (a capture at most 390px wide) or wide (tiles three across from 900px)
  asideCls?: 'phone' | 'wide';
  after?: string;
}

// from 1100px the text sits on one side of the wide track and its figure on the open side; below, text then figure
const phrase = (id: string, title: string, p: IPhrase) =>
  chapter(
    id,
    title,
    `<div class="phrase__grid">
<div class="phrase__text">
${p.text}
</div>
<div class="phrase__aside${p.asideCls ? ` phrase__aside--${p.asideCls}` : ''}">
${p.aside}
</div>
</div>${p.after ? `\n${p.after}` : ''}`,
    { cls: `phrase phrase--${p.side}` },
  );

const story = (c: ICase, lede: string, paras: IPara[]) => [`<p class="lede">${lede}</p>`, ...paras.map((x) => para(c, x))].join('\n');
// #endregion

// #region Everything saved first
export const saved = (c: ICase, b: ISaved) =>
  phrase('saved', b.h2, {
    side: b.side,
    text: story(c, esc(b.lede), b.paras),
    aside: figure({ img: b.figure.img, srcset: b.figure.img.srcset, sizes: b.figure.img.sizes, caption: b.figure.caption, credit: b.figure.credit, width: 'read' }),
    asideCls: 'phone',
  });
// #endregion

// #region The turn
// what I built takes two paragraphs, each with its chips
export const turnChapter = (c: ICase, t: ITurnBlock, ms: number) =>
  turn(
    c,
    {
      title: t.h2,
      expected: t.expected,
      cost: t.cost,
      line: t.line,
      built: [
        { text: t.built, prov: t.builtCite },
        { text: t.builtMore, prov: t.builtMoreCite },
      ],
    },
    { id: 'turn', ms },
  );
// #endregion

// #region Every old page address
// each option carries its own result line, so the browser only swaps text and sends nothing
const checker = (c: ICase, t: IChecker) => {
  const line = (to: string) => t.result.replace('{section}', t.sections[to]).replace('{anchor}', to);
  const start = t.redirects.find((r) => r.from === t.default);
  if (!start) throw new Error(`case-pages: buskers: the checker's default ${t.default} is not one of its addresses`);
  const options = t.groups
    .map(
      (g) =>
        `<optgroup label="${esc(g)}">${t.redirects
          .filter((r) => r.group === g)
          .map((r) => `<option value="${esc(r.from)}" data-line="${esc(line(r.to))}"${r === start ? ' selected' : ''}>${esc(r.from)}</option>`)
          .join('')}</optgroup>`,
    )
    .join('\n');
  const rows = t.redirects.map((r) => `<tr><td><code>${esc(r.from)}</code></td><td>${esc(t.sections[r.to])} <code>#${esc(r.to)}</code></td></tr>`).join('\n');
  const base = `https://${t.host}`;
  return `<div class="checker" data-checker>
${heroFigure(c, c.impact[0])}
<h3 id="checker-h">${esc(t.h3)}</h3>
<div class="checker__field">
<label for="checker-from">${esc(t.label)}</label>
<select class="checker__select" id="checker-from" disabled>
${options}
</select>
</div>
<p class="checker__result"><output class="checker__out" for="checker-from" aria-live="polite">${esc(line(start.to))}</output> ${chips(c, t.cite)}</p>
<a class="checker__open" href="${esc(`${base}${start.from}`)}" data-base="${esc(base)}">${esc(t.open)}</a>
<p class="checker__note">${esc(t.note)}</p>
<p class="checker__nojs">${esc(t.noJs)}</p>
<details class="checker__all">
<summary>${esc(t.all)}</summary>
<table class="checker__table">
<thead><tr><th scope="col">${esc(t.head[0])}</th><th scope="col">${esc(t.head[1])}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</details>
</div>`;
};

export const addresses = (c: ICase, b: IAddresses) => phrase('addresses', b.h2, { side: b.side, text: story(c, esc(b.lede), b.paras), aside: checker(c, b.toy) });
// #endregion

// #region New ways in
// a real table; under 700px each row reflows into a card, and the roles keep it a table for screen readers
const doorTable = (c: ICase, d: IDoors['doors']) => `<table class="doors w-wide" role="table">
<caption>${esc(d.caption)}</caption>
<thead role="rowgroup"><tr role="row">${d.head.map((h) => `<th role="columnheader" scope="col">${esc(h)}</th>`).join('')}</tr></thead>
<tbody role="rowgroup">
${d.rows
  .map(
    (r) =>
      `<tr role="row"><th role="rowheader" scope="row">${esc(r.door)}</th><td role="cell" data-label="${esc(d.head[1])}">${esc(r.old)}</td><td class="doors__new" role="cell" data-label="${esc(d.head[2])}"><span class="doors__mark">${esc(r.new)}</span>${r.cite?.length ? ` ${chips(c, r.cite)}` : ''}</td></tr>`,
  )
  .join('\n')}
</tbody>
</table>`;

const message = (m: IDoors['message']) => `<figure class="message">
<figcaption class="label">${esc(m.label)}</figcaption>
<pre class="message__text">${m.lines.map(esc).join('\n')}</pre>
<p class="message__note">${esc(m.note)}</p>
</figure>`;

export const doors = (c: ICase, b: IDoors) =>
  phrase('doors', b.h2, { side: b.side, text: story(c, esc(b.lede), b.paras), aside: message(b.message), after: doorTable(c, b.doors) });
// #endregion

// #region Built to keep running
export const running = (c: ICase, b: IRunning) =>
  phrase('running', b.h2, { side: b.side, text: story(c, cited(c, b.lede, b.ledeCite), b.paras), aside: metricTiles(c, b.tiles), asideCls: 'wide' });
// #endregion

// #region The handover, in eight counts
// each count is one setup step, dated; the launch is the one lit row
export const counts = (c: ICase, b: ICounts) =>
  chapter(
    'counts',
    b.h2,
    `<p class="lede">${esc(b.lede)}</p>
${setup(
  c,
  {
    sum: { text: b.sum, prov: b.sumCite },
    steps: b.steps.map((s) => ({ action: { text: s.action, prov: s.cite }, who: s.who, time: s.time, note: s.note, lit: s.launch })),
    back: { text: b.back, prov: b.backCite },
  },
  { wide: true },
)}`,
  );
// #endregion

export const learned = (c: ICase, b: { h2: string } & IPara) => chapter('learned', b.h2, para(c, b));
