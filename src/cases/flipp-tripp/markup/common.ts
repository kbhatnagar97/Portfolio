import { esc } from '../../../html/core';
import { chips } from '../../build/parts';
import type { ICase } from '../../build/types';
import type { IInlineLink, IProv } from '../blocks';

// Build time only. Small pieces every part of this page uses: linked prose with its chips, and the board row label.

// escaped text with the first occurrence of each phrase turned into a link
export const linked = (text: string, links: IInlineLink[] = []) =>
  links.reduce((html, l) => {
    const phrase = esc(l.text);
    const at = html.indexOf(phrase);
    if (at < 0) throw new Error(`case-pages: flipp-tripp: the link text "${l.text}" is not in "${text}"`);
    const external = /^https?:/.test(l.href);
    return `${html.slice(0, at)}<a href="${esc(l.href)}"${external ? ' rel="noopener"' : ''}>${phrase}</a>${html.slice(at + phrase.length)}`;
  }, esc(text));

export const prose = (c: ICase, text: string, list?: IProv[], links?: IInlineLink[]) => `${linked(text, links)}${list?.length ? ` ${chips(c, list)}` : ''}`;

// the board row's time column from 1100px, a dateline under the heading below it
export const rowLabel = (text: string) => `<p class="ft-row">${esc(text)}</p>`;
