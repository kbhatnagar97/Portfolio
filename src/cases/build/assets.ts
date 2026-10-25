import type { Rollup } from 'vite';
import type { IEntryAssets } from './types';

// Build time only. Finds what each case page must load from the finished bundle, and guards what it may load.

type TBundle = Rollup.OutputBundle;
type TChunk = Rollup.OutputChunk;

const chunkAt = (bundle: TBundle, file: string) => {
  const c = bundle[file];
  return c?.type === 'chunk' ? c : undefined;
};

// a case whose stylesheet is still empty would otherwise cost a request for nothing
const hasRules = (bundle: TBundle, file: string) => {
  const a = bundle[file];
  return a?.type !== 'asset' || String(a.source).trim().length > 0;
};

export const entryChunk = (bundle: TBundle, name: string) => {
  const entry = Object.values(bundle).find((c): c is TChunk => c.type === 'chunk' && c.isEntry && c.name === name);
  if (!entry) throw new Error(`case-pages: the ${name} entry chunk is missing`);
  return entry;
};

// depth first over static imports: shared CSS lands before the page's own, and each shared chunk is preloaded once
export const entryAssets = (bundle: TBundle, name: string): IEntryAssets => {
  const entry = entryChunk(bundle, name);
  const css: string[] = [];
  const preload: string[] = [];
  const seen = new Set<string>();
  const visit = (c: TChunk) => {
    for (const f of c.imports) {
      const dep = chunkAt(bundle, f);
      if (seen.has(f) || !dep) continue;
      seen.add(f);
      visit(dep);
      preload.push(f);
    }
    for (const f of c.viteMetadata?.importedCss ?? []) if (!css.includes(f) && hasRules(bundle, f)) css.push(f);
  };
  visit(entry);
  return { js: entry.fileName, css, preload };
};

// no crossorigin on either tag: mismatched credentials modes would make the browser fetch the chunk twice
export const headTags = (a: IEntryAssets) =>
  [
    ...a.css.map((f) => `<link rel="stylesheet" href="/${f}" />`),
    ...a.preload.map((f) => `<link rel="modulepreload" href="/${f}" />`),
    `<script type="module" src="/${a.js}"></script>`,
  ].join('\n    ');

// every chunk a page can ever run, lazy stage modules included
const closure = (bundle: TBundle, start: string) => {
  const seen = new Set<string>();
  const walk = (f: string) => {
    const c = chunkAt(bundle, f);
    if (seen.has(f) || !c) return;
    seen.add(f);
    for (const g of [...c.imports, ...c.dynamicImports]) walk(g);
  };
  walk(start);
  return [...seen];
};

// the home, the playground, the build time code and the React and three.js stacks never reach a case page
const FORBIDDEN = /\/src\/(site|play|html)\/|\/src\/cases\/(build\/|registry\.ts)|\/node_modules\/(react|react-dom|three|framer-motion|@react-three)\//;

export const assertCaseIsolation = (bundle: TBundle, name: string, assets: IEntryAssets) => {
  for (const f of closure(bundle, assets.js)) {
    const leak = chunkAt(bundle, f)?.moduleIds.find((id) => FORBIDDEN.test(id));
    if (leak) throw new Error(`case-pages: ${name} would ship ${leak} (in ${f}); case code may import only src/cases/shared and its own folder`);
  }
};

// the home's first load is its own chunk plus motion; anything more means case code leaked into it
export const assertHomeLean = (bundle: TBundle) => {
  const extra = entryChunk(bundle, 'index').imports.filter((f) => !/^assets\/motion-[\w-]+\.js$/.test(f));
  if (extra.length) throw new Error(`case-pages: the home now loads ${extra.join(', ')} up front; only the motion chunk may join it`);
};
