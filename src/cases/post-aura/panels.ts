import { esc } from '../../html/core';
import { badge } from '../build/parts';
import type { TBadge } from '../build/types';
import type { IPanels, TPanelId } from './blocks';

// Build time only. The viewer's recreated screens. They sit inside the aria hidden edit:
// every fact on them is also in a lane card as text with its chip.

// #region Parts
const list = (items: string[], cls: string) => `<ul class="${cls}">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

const stats = (items: string[]) => `<p class="panel__stats">${items.map((x) => `<span>${esc(x)}</span>`).join('')}</p>`;

const bar = (title: string, o: { tag?: string; badge?: TBadge }) =>
  `<div class="panel__bar"><p class="panel__title">${esc(title)}</p>${o.tag ? `<p class="panel__tag">${esc(o.tag)}</p>` : ''}${o.badge ? badge(o.badge) : ''}</div>`;
// #endregion

// #region One renderer per panel
type TBody = { [K in TPanelId]: (p: IPanels[K], versions: string[]) => string };

const BODY: TBody = {
  brief: (p) => {
    const flagged = new Set(p.flags.map((f) => f.at));
    return `<div class="brief">
<ol class="brief__page">${p.sections.map((s) => `<li${flagged.has(s) ? ' class="is-flagged"' : ''}><span>${esc(s)}</span></li>`).join('')}</ol>
<div class="brief__notes"><p class="brief__lead">${esc(p.lines[0])}</p>
<ul class="brief__flags"><li>${esc(p.lines[1])}</li>${p.flags.map((f) => `<li><span class="brief__at">${esc(f.at)}</span>${esc(f.t)}</li>`).join('')}</ul></div>
</div>`;
  },
  search: (p, versions) => `<table class="matrix"><thead><tr><th></th>${versions.map((v) => `<th>${esc(v)}</th>`).join('')}</tr></thead>
<tbody>${p.rows.map((r) => `<tr><th>${esc(r)}</th>${'<td></td>'.repeat(versions.length)}</tr>`).join('')}</tbody></table>
${list(p.files, 'panel__chips')}`,
  r1: (p) => `${stats(p.stats)}${list(p.list, 'panel__list')}<p class="panel__label">${esc(p.peopleLabel)}</p>${list(p.people, 'panel__chips')}`,
  r2: (p) => `${stats(p.stats)}${list(p.list, 'panel__list')}<div class="arc">${'<span></span>'.repeat(13)}</div><p class="panel__note">${esc(p.arc)}</p>`,
  r3: (p) =>
    `${stats(p.stats)}<p class="panel__label">${esc(p.peopleLabel)}</p>${list(p.people, 'panel__chips')}<p class="panel__verdict"><span>${esc(p.verdictLabel)}</span>${esc(p.verdict)}</p>`,
  t1: (p) => `<ol class="flow">${p.steps.map((s) => `<li><span class="flow__k">${esc(s.k)}</span><span class="flow__v">${esc(s.v)}</span></li>`).join('')}</ol>`,
  t3: (p) => `<ol class="flow flow--loop">${p.flow.map((s) => `<li><span class="flow__k">${esc(s)}</span></li>`).join('')}</ol><p class="panel__note">${esc(p.note)}</p>`,
  t4: (p) =>
    `<div class="sheet"></div>${list(p.rules, 'panel__list panel__list--rules')}<p class="panel__note">${p.counts.map(esc).join(' · ')}</p>`,
  t6: (p) => `<p class="panel__when">${esc(p.when)}</p>
<ul class="report">${p.tiles.map((t) => `<li><span class="report__k">${esc(t.k)}</span><span class="report__v">${esc(t.v)}</span>${t.note ? `<span class="report__note">${esc(t.note)}</span>` : ''}</li>`).join('')}</ul>
${list(p.lines, 'panel__list')}`,
};
// #endregion

// one recreated screen; the title bar names it the way an editor's viewer names a source
export const panel = <K extends TPanelId>(id: K, panels: IPanels, versions: string[]) => {
  const body = BODY[id](panels[id], versions);
  const p: IPanels[TPanelId] = panels[id];
  const o = { tag: 'tag' in p ? p.tag : undefined, badge: 'badge' in p ? p.badge : undefined };
  return `<div class="panel panel--${id}">${bar(p.title, o)}<div class="panel__body">${body}</div></div>`;
};
