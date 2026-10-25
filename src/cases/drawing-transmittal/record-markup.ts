import { esc } from '../../html/core';
import type { IRecordRow } from './types';

// Build time only. One transmittal table, shared by the stage, its storyboard and figure F3, so every view of the
// sample record draws a row the same way and the stage script can clone any row it finds.

// a tick drawn in CSS, so the many on this page cost a few bytes each
export const tick = (cls = '') => `<span class="dt-tick${cls ? ` ${cls}` : ''}"></span>`;

export const rowKey = (r: { dwg: string; rev: string }) => `${r.dwg} ${r.rev}`;

// a struck or fresh row is drawn by its class in CSS; the stage script adds moving marks only to rows it changes
const row = (r: IRecordRow, fresh?: string) => {
  const cls = `${r.state === 'current' ? '' : ` is-${r.state}`}${rowKey(r) === fresh ? ' is-new' : ''}`;
  return `<tr class="dt-row${cls}" data-key="${esc(rowKey(r))}"><td class="dt-c dt-c--no"><span class="dt-c__v">${esc(r.no)}</span></td><td class="dt-c dt-c--title">${esc(r.title)}</td><td class="dt-c dt-c--dwg"><span class="dt-dwg">${esc(r.dwg)}</span></td><td class="dt-c dt-c--status">${esc(r.status)}</td><td class="dt-c dt-c--issued">${esc(r.issued)}</td><td class="dt-c dt-c--rev">${esc(r.rev)}</td><td class="dt-c dt-c--revdate">${esc(r.revDate)}${r.note ? ` <span class="dt-tag">${esc(r.note)}</span>` : ''}</td></tr>`;
};

// fresh names the row a draft adds, which carries the lime wash
export const recordTable = (o: { caption: string; headers: string[]; rows: IRecordRow[]; cls?: string; fresh?: string }) => `<table class="dt-table${o.cls ? ` ${o.cls}` : ''}">
<caption class="sr-only">${esc(o.caption)}</caption>
<thead><tr>${o.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>
${o.rows.map((r) => row(r, o.fresh)).join('\n')}
</tbody>
</table>`;
