import { badge } from '../build/parts';
import { esc } from '../../html/core';
import { recordTable } from './record-markup';
import { capRow } from './stage-markup';
import type { IAnatomyFigure, IListFigure, IReachFigure, IRecordFigure, IStageBlock, ITableFigure } from './types';

// Build time only. Figures F1 to F5, each boxed like a drawing sheet: a frame, its badge and title, the drawing,
// and a title block caption row (SHEET, REV, DATE, the kind of picture). Everything in them is real text but F4.

// #region The sheet box every figure shares
interface IBox {
  id: string;
  sheet: string;
  rev: string;
  date: string;
  tag: string;
  badge: IAnatomyFigure['badge'];
  title: string;
  caption: string;
}

const box = (f: IBox, body: string, o: { aside?: boolean; titleId?: boolean } = {}) => `<figure class="dt-fig${o.aside ? ' dt-fig--aside' : ' w-wide'}" id="${esc(f.id)}">
<div class="dt-fig__sheet">
<div class="dt-fig__head">${badge(f.badge)}<p class="dt-fig__t"${o.titleId ? ` id="${esc(f.id)}-t"` : ''}>${esc(f.title)}</p></div>
${body}
${capRow([`SHEET ${f.sheet}`, `REV ${f.rev}`, `DATE ${f.date}`, f.tag])}
</div>
<figcaption>${esc(f.caption)}</figcaption>
</figure>`;

// a table that keeps its meaning when CSS stacks its rows on a phone (Safari drops table roles once display changes)
export const stackTable =(cls: string, headers: string[], rows: string[][], cell: (text: string, col: number) => string) => `<table class="dt-stack ${cls}" role="table">
<thead role="rowgroup"><tr role="row">${headers.map((h) => `<th role="columnheader" scope="col">${esc(h)}</th>`).join('')}</tr></thead>
<tbody role="rowgroup">
${rows.map((r) => `<tr role="row">${r.map((x, i) => `<td role="cell" data-label="${esc(headers[i])}">${cell(x, i)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>`;
// #endregion

// #region F1, F2: the name and the drawing
// the sample name in five parts, each numbered where the title block holds the same fact
export const anatomy = (f: IAnatomyFigure, s: IStageBlock) => {
  const t = s.samples.rev.titleBlock;
  const L = s.sheet.labels;
  const [rev, revDate] = t.revisions[0];
  const fields: [string, string, number][] = [
    [L.sheet, t.sheet, 2],
    [L.code, t.code, 3],
    [L.revTable[0], `${rev} · ${revDate}`, 4],
    [L.title, t.title, 5],
  ];
  const n = (i: number) => `<span class="dt-anat__n" aria-hidden="true">${i}</span>`;
  const segs = f.parts.map((p, i) => `<span class="dt-anat__seg">${esc(p.text)}${n(i + 1)}</span>`);
  // the extension stays on the title's line, so a narrow column never strands ".pdf" alone
  const file = `${segs.slice(0, -1).join(' ')} <span class="dt-anat__end">${segs.at(-1)}.pdf</span>`;
  const body = `<p class="dt-anat__file" aria-hidden="true">${file}</p>
<ol class="dt-anat__parts">
${f.parts.map((p, i) => `<li>${n(i + 1)}<span class="dt-anat__x">${esc(p.text)}</span><span class="dt-anat__k">${esc(p.label)}</span><span class="dt-anat__r">${esc(p.role)}</span></li>`).join('\n')}
</ol>
<dl class="dt-anat__tb">
${fields.map(([k, v, i]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${n(i)}</dd></div>`).join('\n')}
</dl>
<p class="dt-anat__rule">${esc(f.rule)}</p>`;
  return box(f, body, { aside: true });
};

export const refused = (f: ITableFigure) =>
  box(
    f,
    stackTable('dt-refused', f.headers, f.rows, (x, i) => (i === 0 ? `<span class="dt-file">${esc(x)}</span>` : esc(x))),
  );
// #endregion

// #region F3: the record, nothing erased
export const recordFigure = (f: IRecordFigure) => {
  const legend = `<ul class="dt-legend">${f.legend.map((l) => `<li class="dt-legend__i dt-legend__i--${l.mark}">${esc(l.text)}</li>`).join('')}</ul>`;
  const table = `<div class="dt-scroll dt-scroll--record" role="region" tabindex="0" aria-labelledby="${esc(f.id)}-t" data-scroller>${recordTable({ caption: f.title, headers: f.headers, rows: f.rows, cls: 'dt-table--record' })}</div>`;
  return box(f, `${table}\n${legend}`, { titleId: true });
};
// #endregion

// #region F4: what it can touch, an illustration
export const reach = (f: IReachFigure) => {
  const group = (g: IReachFigure['groups'][number]) => {
    if (!g.squares) return `<div class="dt-reach__g dt-reach__g--text"><p class="dt-reach__k">${esc(g.label)}</p><p class="dt-reach__v">${esc(g.text ?? '')}</p></div>`;
    const squares = Array.from({ length: g.squares }, (_, i) => `<span class="dt-reach__sq${i < (g.lit ?? 0) ? ' is-lit' : ''}"></span>`).join('');
    return `<div class="dt-reach__g"><p class="dt-reach__k">${esc(g.label)}</p><div class="dt-reach__grid">${squares}</div><p class="dt-reach__v"><span class="dt-reach__key"></span>${esc(g.litLabel ?? '')}</p>${g.note ? `<p class="dt-reach__note">${esc(g.note)}</p>` : ''}</div>`;
  };
  return box(f, `<div class="dt-reach" role="img" aria-label="${esc(f.alt)}">${f.groups.map(group).join('')}</div>`, { aside: true });
};
// #endregion

// #region F5: the project list
export const projectList = (f: IListFigure) => {
  const cell = (x: string, i: number) => {
    const head = f.headers[i];
    // the Active cell is a tick box in the workbook; the word stays for screen readers and print
    if (head === 'Active') return `<td class="dt-list__active"><span class="dt-box" aria-hidden="true"></span>${esc(x)}</td>`;
    return `<td>${esc(x)}</td>`;
  };
  const table = `<div class="dt-scroll dt-scroll--list" role="region" tabindex="0" aria-label="${esc(f.scrollLabel)}" data-scroller>
<table class="dt-list">
<caption class="sr-only">${esc(f.title)}</caption>
<thead><tr>${f.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
<tbody><tr>${f.row.map(cell).join('')}</tr></tbody>
</table>
</div>`;
  const refusal = `<p class="dt-refusal"><span class="dt-refusal__in">${esc(f.refusal.input)}</span><span class="dt-refusal__msg">${esc(f.refusal.message)}</span></p>`;
  return box(f, `${table}\n${refusal}`);
};
// #endregion
