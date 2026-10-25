import { badge, dataBlock, readout, storyboard } from '../build/parts';
import type { ICase } from '../build/types';
import { esc } from '../../html/core';
import { apply, counts, fill, plan } from './record';
import { recordTable, rowKey, tick } from './record-markup';
import { sheetSvg } from './sheet';
import type { IRecordRow, IStageBlock, IStageData, TSampleId } from './types';

// Build time only. The stage's live frame (controls, desk, record, jobs) and its storyboard, from the content block.
// The frame holds the demo's states as markup, so the stage script swaps, moves and copies elements instead of writing HTML.

// #region Pieces shared by the frame and the storyboard
const WARN = '<svg class="dt-warn" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M6 1.5 11 10.5H1z"/><path d="M6 5v2.5M6 9v.01"/></svg>';

// a file name split the way the rule reads it: serial, drawing number, project code, revision, title
const PARTS = ['serial', 'dwg', 'code', 'rev', 'title'] as const;
const CHECKED = new Set(['dwg', 'code', 'rev']);

const nameLine = (file: string, o: { id?: TSampleId; shown?: boolean; cls?: string } = {}) => {
  const attrs = `class="dt-name${o.cls ? ` ${o.cls}` : ''}"${o.id ? ` data-name="${o.id}"` : ''} aria-hidden="true"${o.shown === false ? ' hidden' : ''}`;
  if (file.includes('_')) {
    const marked = esc(file).replace(/_/g, '<span class="dt-name__us">_<span class="dt-name__u"></span></span>');
    return `<p ${attrs}>${marked}</p>`;
  }
  const words = file.replace(/\.pdf$/, '').split(' ');
  const values = [...words.slice(0, 4), words.slice(4).join(' ')];
  const parts = PARTS.map(
    (p, i) => `<span class="dt-name__part" data-p="${p}">${esc(values[i])}<span class="dt-name__u"></span>${CHECKED.has(p) ? tick('dt-name__tick') : ''}</span>`,
  );
  return `<p ${attrs}>${parts.join(' ')}.pdf</p>`;
};

// the storyboard's last frame is the misnamed file, and its label is the flag the desk raises
const look = (s: IStageBlock) => `<span class="dt-look">${WARN}${esc(s.storyboard[3].label)}</span>`;

const approvalCard = (s: IStageBlock, o: { live: boolean }) => {
  const a = s.approval;
  const button = o.live
    ? `<button type="button" class="pill pill--solid dt-ap__go">${esc(s.buttons.approve)}</button>`
    : `<span class="pill pill--solid dt-ap__go">${esc(s.buttons.approve)}</span>`;
  return `<div class="dt-ap">
<p class="dt-ap__h">${esc(a.heading)}</p>
<p class="dt-ap__from">${esc(a.from)}</p>
<p class="dt-ap__row" data-for="rev">${esc(a.rowRev)}</p>${o.live ? `\n<p class="dt-ap__row" data-for="new" hidden>${esc(a.rowNew)}</p>` : ''}
<p class="dt-ap__revoke" data-for="rev">${esc(a.revokeNote)}</p>
${button}
<p class="dt-ap__safe">${esc(a.safe)}</p>
<p class="dt-ap__reject">${esc(a.reject)}</p>
<span class="dt-ap__stamp" aria-hidden="true">${tick()}${esc(a.stamp)}</span>
</div>`;
};

const mailCard = (s: IStageBlock) => `<div class="dt-mail">
<p class="dt-mail__h">${esc(s.sent.heading)}</p>
<p class="dt-mail__note">${esc(s.sent.note)}</p>
<ul class="dt-mail__to">${s.sent.to.map((x) => `<li>${tick('dt-mail__tick')}${esc(x)}</li>`).join('')}</ul>
</div>`;

// five jobs the engine does, then the one review left to the lead; each carries a state word for screen readers,
// which the live demo writes as it goes and the storyboard, showing the end state, starts with
const jobs = (s: IStageBlock, id: string, o: { done?: boolean } = {}) => {
  const j = s.jobs;
  const mark = `<span class="dt-job__wash"></span>${tick('dt-job__tick')}`;
  const state = `<span class="sr-only" data-state>${o.done ? ', done' : ''}</span>`;
  // the third job reads differently for a first issue, which has no old revision to strike
  const text = (t: string, n: number) =>
    n === 2
      ? `<span class="dt-job__t" data-for="strike">${esc(t)}</span><span class="dt-job__t dt-job__t--skip" data-for="skip" hidden>${esc(j.skipNew)}</span>`
      : `<span class="dt-job__t">${esc(t)}</span>`;
  return `<div class="dt-jobs">
<p class="dt-jobs__h" id="${id}">${esc(j.title)}</p>
<ol class="dt-jobs__list" aria-labelledby="${id}">
${j.items.map((t, n) => `<li class="dt-job" data-job="${n}">${mark}${text(t, n)}${state}</li>`).join('\n')}
<li class="dt-job dt-job--left" data-job="left">${mark}<span class="dt-job__k">${esc(j.leftTitle)}<span class="sr-only">: </span></span><span class="dt-job__t">${esc(j.left)}</span>${state}</li>
</ol>
</div>`;
};

// a sheet's title block caption row: SHEET S1 · STEP 1 · SAMPLE DATA
export const capRow = (fields: string[]) => `<p class="dt-cap">${fields.map((f) => `<span>${esc(f)}</span>`).join('')}</p>`;
// #endregion

// #region The live frame
const picker = (s: IStageBlock) => `<fieldset class="dt-pick">
<legend class="dt-pick__legend">${esc(s.picker.legend)}</legend>
<div class="dt-pick__opts">
${s.picker.options
  .map(
    (o) =>
      `<input class="dt-pick__radio" type="radio" name="dt-sample" id="dt-${o.id}" value="${o.id}"${o.checked ? ' checked' : ''} /><label class="dt-pick__opt" for="dt-${o.id}"><span class="dt-pick__l">${esc(o.label)}</span><span class="dt-pick__f">${esc(o.file)}</span><span class="dt-pick__h">${esc(o.hint)}</span></label>`,
  )
  .join('\n')}
</div>
</fieldset>`;

const desk = (s: IStageBlock) => `<div class="dt-desk">
<div class="dt-layer is-on" data-layer="sheet" data-rm-fade>
<p class="dt-label">${esc(s.panels.folder)}</p>
<div class="dt-names">
${s.picker.options.map((o) => nameLine(o.file, { id: o.id, shown: !!o.checked })).join('\n')}
</div>
<div class="dt-paper">${sheetSvg(s, s.samples.rev.titleBlock, 'live')}${look(s)}</div>
</div>
<div class="dt-layer" data-layer="approval" data-rm-fade inert>
<p class="dt-label">${esc(s.panels.approval)}</p>
${approvalCard(s, { live: true })}
</div>
<div class="dt-layer" data-layer="sent" data-rm-fade inert>
<p class="dt-label">${esc(s.panels.sent)}</p>
${mailCard(s)}
</div>
</div>`;

// the phone register is a visual copy of the table, so the stage script fills it from this one card
const card = `<template class="dt-card-tpl"><li class="dt-card"><p class="dt-card__a"><span data-c="dwg"></span> · <span data-c="rev"></span> · <span data-c="status"></span></p><p class="dt-card__b"><span data-c="title"></span> · first issued <span data-c="issued"></span><span class="dt-card__rd"> · rev <span data-c="revDate"></span></span></p></li></template>`;

const record = (s: IStageBlock, rows: IRecordRow[]) => `<div class="dt-record">
<div class="dt-record__head"><p class="dt-label" data-record-label>${esc(s.panels.client)}</p>${readout(fill(s.readout, counts(rows, 0)))}</div>
<ol class="dt-register" aria-hidden="true"></ol>${card}
<div class="dt-scroll dt-scroll--live" data-scroller data-label="${esc(s.transmittal.scrollLabel)}">${recordTable({ caption: s.transmittal.caption, headers: s.transmittal.headers, rows, cls: 'dt-table--live' })}</div>
</div>`;

export const stageFrame = (s: IStageBlock, rows: IRecordRow[]) => `<div class="dt" data-dt>
<div class="dt-top">${s.badges.map(badge).join('')}</div>
<div class="dt-controls">
${picker(s)}
<div class="dt-acts">
<button type="button" class="pill pill--solid dt-drop" aria-disabled="true">${esc(s.buttons.drop)}</button>
<button type="button" class="pill dt-reset" aria-disabled="true">${esc(s.buttons.reset)}</button>
<p class="stage__status dt-status" role="status">${esc(s.status.loading)}</p>
</div>
</div>
<div class="dt-panels">
${desk(s)}
${record(s, rows)}
${jobs(s, 'dt-jobs-h')}
</div>
<div class="dt-fly" aria-hidden="true"></div>
</div>`;
// #endregion

// #region The storyboard: the end state, for readers without JavaScript and for print; the kit's stage prints the caption
export const stageStoryboard = (s: IStageBlock, rows: IRecordRow[], revoked: string) => {
  const p = plan(rows, s.samples.rev);
  const draft = apply(rows, p, revoked);
  const fresh = p.kind === 'add' ? rowKey(p.row) : undefined;
  const [read, planned, sent, refused] = s.storyboard;
  const cap = (n: number, step: string) => capRow([`SHEET S${n}`, step, 'SAMPLE DATA']);
  const frame = (f: { title: string; text: string }, visual: string, caption: string) =>
    `<p class="dt-sb__t">${esc(f.title)}</p>${visual}<p class="dt-sb__text">${esc(f.text)}</p>${caption}`;
  const files = Object.fromEntries(s.picker.options.map((o) => [o.id, o.file]));
  return storyboard([
    {
      label: read.label,
      html: frame(read, `<div class="dt-sb__sheet">${nameLine(files.rev, { cls: 'is-read' })}${sheetSvg(s, s.samples.rev.titleBlock, 'story')}</div>`, cap(1, 'STEP 1')),
    },
    {
      label: planned.label,
      html: frame(
        planned,
        `<div class="dt-scroll" role="region" tabindex="0" aria-label="${esc(s.transmittal.scrollLabel)}">${recordTable({ caption: s.transmittal.caption, headers: s.transmittal.headers, rows: draft, cls: 'dt-table--story', fresh })}</div>`,
        cap(2, 'STEP 2'),
      ),
    },
    {
      label: sent.label,
      html: frame(sent, `<div class="dt-sb__done">${approvalCard(s, { live: false })}${mailCard(s)}${jobs(s, 'dt-sb-jobs-h', { done: true })}</div>`, cap(3, 'STEP 3')),
    },
    {
      label: refused.label,
      html: frame(refused, `<div class="dt-sb__bad">${nameLine(files.bad, { cls: 'is-refused' })}${look(s)}</div>`, capRow(['SHEET S4', 'NEEDS A LOOK', 'SAMPLE DATA'])),
    },
  ]);
};
// #endregion

// what the stage script reads; everything else it needs is already in the frame's markup
export const stageData = (c: ICase, s: IStageBlock, rows: IRecordRow[], revoked: string) => {
  const data: IStageData = { rows, samples: s.samples, status: s.status, readout: s.readout, record: { draft: s.panels.draft, client: s.panels.client }, revoked };
  return dataBlock(data, `${c.slug}-stage`);
};
