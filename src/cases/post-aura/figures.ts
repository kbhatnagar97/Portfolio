import { esc } from '../../html/core';
import { chips } from '../build/parts';
import type { ICase } from '../build/types';
import type { IBrief, IPathFigure } from './blocks';
import { slate } from './markup';

// Build time only. This case's two figures that are not pictures: the research findings table and the folder path
// figure, which shows where each tag of one clip comes from.

// #region What the research found, and what it changed
export const findings = (c: ICase, f: IBrief['frame'], date: string) => `<figure class="findings w-wide">
<div class="findings__media">
${slate(date)}
<p class="findings__title">${esc(f.title)}</p>
<table class="findings__table">
<thead><tr><th scope="col">${esc(f.headers[0])}</th><th scope="col">${esc(f.headers[1])}</th></tr></thead>
<tbody>
${f.rows.map((r) => `<tr><td data-label="${esc(f.headers[0])}">${esc(r.found.t)}</td><td data-label="${esc(f.headers[1])}">${esc(r.changed.t)}</td></tr>`).join('\n')}
</tbody>
</table>
</div>
<figcaption><span class="fig__cap">${esc(f.caption.t)}</span> ${chips(c, f.prov)}</figcaption>
</figure>`;
// #endregion

// #region One clip, two sources of tags
// the end state is the HTML; path-motion.ts flies the four path segments into their fields once, when in view
export const pathFigure = (c: ICase, f: IPathFigure) => {
  const fromPath = f.fields.filter((x) => x.from === 'path');
  const segment = (s: string, i: number) => {
    const target = fromPath.findIndex((x) => x.value === s);
    return `<span class="path__seg${i === f.path.length - 1 ? ' path__seg--file' : ''}"${target >= 0 ? ` data-seg="${target}"` : ''}>${esc(s)}</span>`;
  };
  const field = (x: IPathFigure['fields'][number]) =>
    `<div class="path__field path__field--${x.from}"${x.from === 'path' ? ` data-field="${fromPath.indexOf(x)}"` : ''}><dt>${esc(x.label)}</dt><dd><span class="path__value${x.value === 'none picked' ? ' path__value--none' : ''}">${esc(x.value)}</span><span class="path__from">${esc(f.fromLabels[x.from])}</span></dd></div>`;
  return `<figure class="pathfig w-wide" id="${esc(f.id)}">
<div class="pathfig__media">
<div class="pathfig__head"><h3>${esc(f.title)}</h3><span class="badge">${esc(f.badge)}</span></div>
<p class="path">${f.path.map(segment).join('<span class="path__sep" aria-hidden="true">/</span>')}</p>
<div class="path__frames" role="img" aria-label="${esc(f.framesAlt)}">${f.frames.map((x) => `<img src="${esc(x.src)}" width="${x.width}" height="${x.height}" alt="" loading="lazy" decoding="async" />`).join('')}</div>
<dl class="path__fields">${f.fields.map(field).join('')}</dl>
<p class="path__kw-label">${esc(f.keywordsLabel)}</p>
<ul class="path__kw">${f.keywords.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
</div>
<figcaption><span class="fig__cap">${esc(f.caption.t)}</span> ${chips(c, f.prov)} <span class="fig__credit">${esc(f.credit)}</span></figcaption>
</figure>`;
};
// #endregion
