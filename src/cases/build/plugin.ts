import type { Plugin, Rollup } from 'vite';
import { withSsr } from '../../html/ssr';
import { OVERVIEW } from '../registry';
import { assertCaseIsolation, assertHomeLean, entryAssets } from './assets';
import { casePage, overviewPage } from './pages';
import { LISTED, SELECTED } from './select';
import type { ICase, ICaseCard, TCaseRender, TOverviewRender } from './types';

// Build time only. The Vite side of the case pages: entries, chunking, the home cards and the emitted pages.

const entries: [string, string][] = [...SELECTED.map((c): [string, string] => [`case-${c.slug}`, `src/cases/${c.slug}/main.ts`]), ['case-overview', 'src/cases/overview/main.ts']];
// one entry per emitted case, plus the overview, which every build emits
export const caseInputs: Record<string, string> = Object.fromEntries(entries);

// gsap core and Lenis already load on the home, so sharing them costs it nothing; the closed list keeps SplitText home only.
// Vite's preload helper rides along: the home and every lazy stage import() use it, and alone it would be a chunk the home preloads.
// boot() never wires the calculator and only two pages show one, so it stays out of the kit and those pages load it lazily.
export const caseChunks = (id: string) => {
  if (/node_modules\/(gsap\/(index|gsap-core|CSSPlugin|ScrollTrigger|Observer)\.js$|lenis\/)/.test(id) || id.includes('vite/preload-helper')) return 'motion';
  if (id.includes('/src/cases/shared/') && !id.endsWith('/shared/calculator.ts')) return 'case-kit';
  return undefined;
};

// #region Home cards
// mirrors virtual:automation-cards: only what a card shows ships to the home
const CARDS_ID = 'virtual:case-cards';
const cardOf = (c: ICase): ICaseCard => ({
  slug: c.slug,
  title: c.title,
  kicker: c.kicker,
  industry: c.industry,
  year: c.year,
  accent: c.accent,
  flagship: !!c.flagship,
  line: c.deck,
  status: c.status,
  impact: c.impact.slice(0, c.flagship ? 3 : 1).map(({ value, label, kind, note }) => ({ value, label, kind, note })),
  poster: c.poster,
});

export const caseCards = (): Plugin => ({
  name: 'case-cards',
  resolveId: (id) => (id === CARDS_ID ? `\0${CARDS_ID}` : undefined),
  load: (id) => (id === `\0${CARDS_ID}` ? `export default ${JSON.stringify(LISTED.map(cardOf))}` : undefined),
});
// #endregion

// #region Pages
// called at the end of site-seo's generateBundle, so the pages share its root and Updated date
export const emitCasePages = async (ctx: Rollup.PluginContext, bundle: Rollup.OutputBundle, o: { root: string; today: string }) => {
  assertHomeLean(bundle);
  await withSsr(o.root, [], async (load) => {
    for (const c of SELECTED) {
      const name = `case-${c.slug}`;
      const assets = entryAssets(bundle, name);
      assertCaseIsolation(bundle, name, assets);
      const { default: render } = (await load(`/src/cases/${c.slug}/page.ts`)) as { default: TCaseRender };
      ctx.emitFile({ type: 'asset', fileName: `case-studies/${c.slug}/index.html`, source: casePage(c, render(c), assets, o.today, LISTED) });
    }
    const assets = entryAssets(bundle, 'case-overview');
    assertCaseIsolation(bundle, 'case-overview', assets);
    const { default: render } = (await load('/src/cases/overview/page.ts')) as { default: TOverviewRender };
    ctx.emitFile({ type: 'asset', fileName: 'case-studies/index.html', source: overviewPage(OVERVIEW, render(OVERVIEW, LISTED), assets, o.today, LISTED) });
  });
};
// #endregion
