import profileJson from '../../content/profile.json';
import { esc, OG } from '../../html/core';
import { crumbs, page, siteFoot } from '../../html/shell';
import { headTags } from './assets';
import { offer, pager, sources, withChips } from './parts';
import { caseJsonLd, caseTitle, overviewJsonLd, posterUrl } from './seo';
import type { ICase, IEntryAssets, IOverview } from './types';

// Build time only. Wraps a template's story in the site shell; every case page ends the same way: offer, sources, pager.

const P = profileJson;

export const casePage = (c: ICase, story: string, assets: IEntryAssets, today: string, cases: ICase[]) =>
  page({
    path: `/case-studies/${c.slug}/`,
    title: caseTitle(c),
    description: c.description,
    ogType: 'article',
    image: posterUrl(c),
    imageAlt: c.poster.alt || `${c.title} by ${P.name}`,
    jsonld: caseJsonLd(c, today),
    head: headTags(assets),
    main: `case case--${c.slug}`,
    body: `${crumbs([[P.name, '/'], ['Case studies', '/case-studies/'], [c.title]])}
<article class="case__story" style="--accent:${esc(c.accent)}">
${withChips(c, `${story}\n${offer(c)}`)}
${sources(c)}
</article>
${pager(c, cases)}`,
    foot: siteFoot(today),
    tail: '',
  });

export const overviewPage = (o: IOverview, body: string, assets: IEntryAssets, today: string, cases: ICase[]) =>
  page({
    path: '/case-studies/',
    title: o.seoTitle,
    description: o.description,
    ogType: 'website',
    image: OG,
    imageAlt: o.seoTitle,
    jsonld: overviewJsonLd(o, cases, today),
    head: headTags(assets),
    main: 'case overview',
    body: `${crumbs([[P.name, '/'], ['Case studies']])}
${body}`,
    foot: siteFoot(today),
    tail: '',
  });
