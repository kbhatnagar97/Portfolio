import { esc } from '../../../html/core';
import { badge, chapter, figure, heroFigure, metricTiles, milestones, prov, setup, turn } from '../../build/parts';
import type { ICase } from '../../build/types';
import type { IChapterBlock, IFinding, IMilestoneItem, ITurnBlock, TPart } from '../blocks';
import { prose, rowLabel } from './common';
import { FIGURE_SIZES } from './stage';

// Build time only. The chapters after the stage, set as board rows: a time column, then the story and its static boards.

type TPartOf<K extends TPart['type']> = Extract<TPart, { type: K }>;

// #region Boards and tables
const researchBoard = (c: ICase, p: TPartOf<'board'>) => `<figure class="ft-rows">
<ul>${p.rows.map((m) => `<li><span class="ft-rows__v">${esc(m.value)}</span><span class="ft-rows__l">${esc(m.label)} ${prov(c, m)}</span></li>`).join('')}</ul>
<figcaption>${esc(p.caption)}</figcaption>
</figure>`;

// a table sits in a block wrapper, which stretches with the board row; the row with a note is the winner
const scoresTable = (c: ICase, p: TPartOf<'scores'>) => `<div class="ft-table"><table class="ft-scores">
<caption>${esc(p.caption)} ${prov(c, p)}</caption>
<thead><tr>${p.columns.map((h, i) => `<th scope="col"${i ? ' class="ft-num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${p.rows
  .map(
    (r) =>
      `<tr${r.note ? ' class="is-won"' : ''}><th scope="row">${esc(r.name)}${r.note ? `<span class="ft-note">${esc(r.note)}</span>` : ''}</th>${r.scores
        .map((s) => `<td class="ft-num"><span class="ft-val">${esc(s)}</span></td>`)
        .join('')}</tr>`,
  )
  .join('')}</tbody>
</table></div>`;

const checksTable = (c: ICase, p: TPartOf<'checks'>) => `<div class="ft-table"><table class="ft-checks">
<caption>${esc(p.caption)} ${prov(c, p)}</caption>
<thead><tr><th scope="col">Group</th><th scope="col" class="ft-num">Passed</th><th scope="col">Status</th></tr></thead>
<tbody>${p.rows
  .map((r) => `<tr><th scope="row">${esc(r.group)}</th><td class="ft-num"><span class="ft-val">${r.passed} of ${r.total}</span></td><td><span class="ft-val ft-val--ink">${esc(p.status)}</span></td></tr>`)
  .join('')}</tbody>
</table></div>`;

const findings = (c: ICase, items: IFinding[]) => `<ol class="ft-finds">
${items
  .map(
    (f) => `<li>
<p class="ft-finds__sev">${esc(f.severity)}</p>
<p class="ft-finds__what">${esc(f.what)} ${prov(c, f)}</p>
<dl><div><dt>Cause</dt><dd>${esc(f.cause)}</dd></div><div><dt>Fix</dt><dd>${esc(f.fix)}</dd></div></dl>
</li>`,
  )
  .join('\n')}
</ol>`;

// one line per missing confirmation, the way the gate prints them
const code = (p: TPartOf<'code'>) => `<figure class="ft-code">
<div class="ft-code__box">${badge(p.badge)}<pre><code>${p.text.split('; ').map(esc).join(';\n')}</code></pre></div>
<figcaption>${esc(p.caption)}</figcaption>
</figure>`;

// the board's dates take the when line, each version's name sits over its change
const milestoneList = (c: ICase, items: IMilestoneItem[]) =>
  milestones(
    c,
    items.map((m) => ({ when: m.date, time: m.time, name: m.label, change: m.change, why: { text: m.why, prov: m.prov }, ref: m.ref })),
  );
// #endregion

// #region Parts and chapters
const part = (c: ICase, p: TPart): string => {
  switch (p.type) {
    case 'p':
      return `<p>${prose(c, p.text, p.prov, p.links)}</p>`;
    case 'h3':
      return `<h3>${esc(p.text)}</h3>`;
    case 'hero':
      return heroFigure(c, c.impact[0]);
    case 'board':
      return researchBoard(c, p);
    case 'tiles':
      return metricTiles(c, p.items);
    case 'code':
      return code(p);
    case 'figure':
      return figure({ img: p.img, srcset: p.srcset, sizes: FIGURE_SIZES, caption: p.caption, credit: p.credit });
    case 'milestones':
      return milestoneList(c, p.items);
    case 'scores':
      return scoresTable(c, p);
    case 'findings':
      return findings(c, p.items);
    case 'setup':
      return setup(c, { sum: { text: p.sum.text, prov: [{ kind: p.sum.kind, source: p.sum.source }] }, steps: p.steps, back: { text: p.back, prov: p.prov } });
    case 'checks':
      return checksTable(c, p);
  }
};

export const chapterHtml = (c: ICase, b: IChapterBlock) =>
  chapter(b.id, b.heading, `${rowLabel(b.label)}\n<p class="lede">${esc(b.lede.text)}</p>\n${b.parts.map((p) => part(c, p)).join('\n')}`);

// the kit's turn block, with this chapter's time label under its heading
export const turnHtml = (c: ICase, b: ITurnBlock) => {
  const t = b.turn;
  return turn(
    c,
    { title: b.heading, expected: t.expected, cost: t.cost, costMetric: t.costMetric, line: t.line, built: t.built },
    { id: b.id, ms: t.marker.durationMs, steps: t.marker.steps, head: rowLabel(b.label) },
  );
};
// #endregion
