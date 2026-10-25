import { esc } from '../../html/core';
import { chips } from '../build/parts';
import type { ICase } from '../build/types';
import type { ICite, IPara } from './blocks';

// Build time only: copy from the content file with the provenance chips its numbers carry.

export const cited = (c: ICase, text: string, cite?: ICite[]) => `${esc(text)}${cite?.length ? ` ${chips(c, cite)}` : ''}`;

export const para = (c: ICase, p: IPara, cls?: string) => `<p${cls ? ` class="${cls}"` : ''}>${cited(c, p.text, p.cite)}</p>`;
