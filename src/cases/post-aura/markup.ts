import { esc } from '../../html/core';
import { prose, prov } from '../build/parts';
import type { ICase, IProse } from '../build/types';
import type { IFact, IParagraph, IText } from './blocks';

// Build time only. Small HTML helpers this case's templates share; every content string is escaped here.

// sentences join into one paragraph; its chips print after it, in the order the content lists them
export const paragraph = (p: IParagraph): IProse => ({ text: p.sentences.map((s) => s.t).join(' '), prov: p.prov });

export const para = (c: ICase, p: IParagraph, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${prose(c, paragraph(p))}</p>`;

export const text = (t: IText, cls = '') => `<p${cls ? ` class="${cls}"` : ''}>${esc(t.t)}</p>`;

export const fact = (c: ICase, f: IFact) => `<span class="fact"><span class="fact__t">${esc(f.t)}</span> ${prov(c, f)}</span>`;

// the world's date slate: Geist Mono on the frame's top left corner
export const slate = (s: string) => `<p class="slate">${esc(s)}</p>`;

// a chapter opens on one wide frame carrying its slate; the wrapper lets any frame partial take one
export const framed = (s: string, frame: string) => `<div class="framed w-wide">
${slate(s)}
${frame}
</div>`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "12 Oct 2026, 01:08 IST" becomes a time element a machine can read; a range or a version name stays plain text
export const when = (date: string) => {
  const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})(?:, (\d{2}):(\d{2}) IST)?$/.exec(date);
  const month = m ? MONTHS.indexOf(m[2]) + 1 : 0;
  if (!m || !month) return esc(date);
  const day = `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return `<time datetime="${m[4] ? `${day}T${m[4]}:${m[5]}+05:30` : day}">${esc(date)}</time>`;
};

// the web address without its scheme, as a link's visible text
export const host = (href: string) => href.replace(/^https?:\/\//, '').replace(/\/$/, '');
