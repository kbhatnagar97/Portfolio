import profileJson from '../../content/profile.json';
import { abs, HOME, OG, PERSON_ID, personRef, SITE, WEBSITE_ID } from '../../html/core';
import { TITLE_SUFFIX } from './content';
import { KINDS } from './terms';
import type { ICase, IMetric, IOverview } from './types';

// Build time only. JSON-LD for the case pages, and the case lines the sitemap and both llms files add.

const P = profileJson;
export const OVERVIEW_URL = `${SITE}/case-studies/`;
export const caseUrl = (c: ICase) => `${OVERVIEW_URL}${c.slug}/`;
export const caseTitle = (c: ICase) => `${c.seoTitle}${TITLE_SUFFIX}`;
export const posterUrl = (c: ICase) => (c.poster.src ? abs(c.poster.src) : OG);

// #region JSON-LD
const crumb = (position: number, name: string, item: string) => ({ '@type': 'ListItem', position, name, item });

// a test or review address is not the work's home, so until the status reads Live the graph points at this page
const workUrl = (c: ICase) => (c.links[0] && /^Live\b/.test(c.status) ? abs(c.links[0].href) : caseUrl(c));

// the anonymised case never names its client, so no client field reaches the graph at all
export const caseJsonLd = (c: ICase, today: string) => {
  const url = caseUrl(c);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: c.seoTitle,
        description: c.description,
        url,
        image: posterUrl(c),
        datePublished: c.published,
        dateModified: today,
        author: { '@id': PERSON_ID },
        publisher: { '@id': PERSON_ID },
        about: { '@id': `${url}#work` },
        isPartOf: { '@id': WEBSITE_ID },
        inLanguage: 'en',
        mainEntityOfPage: url,
      },
      {
        '@type': 'CreativeWork',
        '@id': `${url}#work`,
        name: c.title,
        url: workUrl(c),
        creator: { '@id': PERSON_ID },
        dateCreated: c.year,
        keywords: c.stack.join(', '),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [crumb(1, P.name, HOME), crumb(2, 'Case studies', OVERVIEW_URL), crumb(3, c.title, url)],
      },
      personRef(),
    ],
  };
};

export const overviewJsonLd = (o: IOverview, cases: ICase[], today: string) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${OVERVIEW_URL}#page`,
      url: OVERVIEW_URL,
      name: o.seoTitle,
      description: o.description,
      inLanguage: 'en',
      dateModified: today,
      isPartOf: { '@id': WEBSITE_ID },
      author: { '@id': PERSON_ID },
      breadcrumb: { '@id': `${OVERVIEW_URL}#breadcrumb` },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: cases.length,
        itemListElement: cases.map((c, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@id': `${caseUrl(c)}#article`, name: c.title, url: caseUrl(c) } })),
      },
    },
    { '@type': 'BreadcrumbList', '@id': `${OVERVIEW_URL}#breadcrumb`, itemListElement: [crumb(1, P.name, HOME), crumb(2, 'Case studies', OVERVIEW_URL)] },
    personRef(),
  ],
});

// #endregion

// #region Sitemap and llms files
// the overview first, then each case with its poster as the sitemap image
export const caseSitemapUrls = (cases: ICase[]) => [
  { loc: OVERVIEW_URL, image: undefined },
  ...cases.map((c) => ({ loc: caseUrl(c), image: c.poster.src ? { src: abs(c.poster.src), title: c.title } : undefined })),
];

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const bare = (s: string) => s.trim().replace(/[.]$/, '');
// the pages show each figure's kind, so this line may say it too
const figure = (m: IMetric) => `${m.value} ${bare(m.label)} (${KINDS[m.kind].toLowerCase()})`;

// the "## Case studies" section of llms.txt, between Automations and How he works
export const caseLlms = (cases: ICase[]) =>
  cases.length
    ? [
        '## Case studies',
        '',
        `All case studies: ${OVERVIEW_URL}. Each headline figure on a case page names how it was found (measured, reported, modelled or an example) and links to its numbered source on that page.`,
        '',
        ...cases.map((c) => `- [${c.title}](${caseUrl(c)}): ${sentence(c.deck)} ${c.client}, ${c.year}. ${sentence(c.status)} Impact: ${c.impact.map(figure).join('; ')}.`),
        '',
      ]
    : [];

// the "## Case study write ups" section appended to llms-full.txt
export const caseLlmsFull = (cases: ICase[]) =>
  cases.length
    ? [
        '## Case study write ups',
        '',
        ...cases.flatMap((c) => [
          `### ${c.title}`,
          '',
          `${sentence(c.deck)} Page: ${caseUrl(c)}. ${c.client}, ${c.year}. ${sentence(c.status)}`,
          '',
          ...c.summary.flatMap((s) => [s, '']),
          'Impact:',
          ...c.impact.map((m) => `- ${figure(m)}. Source: ${c.sources.find((s) => s.id === m.source)?.text ?? ''}`),
          '',
          `Built with: ${c.stack.join(', ')}.`,
          '',
        ]),
      ]
    : [];
// #endregion
