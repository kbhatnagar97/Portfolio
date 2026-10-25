import projectsJson from '../../content/projects.json';
import { CASE_FILES, CASES, OVERVIEW } from '../registry';
import { privateNames, validateCase, validateOverview } from './content';

// Build time only. Decides which case pages this build emits, and runs the content checks once, when the config loads.

// no @types/node or DOM types in the config program, so the environment, the console and the file system are reached untyped
const host = globalThis as { process?: { env: Record<string, string | undefined> }; console?: { warn: (m: string) => void } };
const fs = (await import('node:fs' as string)) as { existsSync: (p: string) => boolean; readFileSync: (p: string, encoding: 'utf8') => string };
const warn = (m: string) => host.console?.warn(`case-pages: ${m}`);
const raw = host.process?.env.CASE_PREVIEW;

// comma separated slugs; "overview" alone builds the overview without any case page
export const PREVIEW = raw === undefined ? undefined : raw.split(',').map((s) => s.trim()).filter(Boolean);

const KNOWN = [...Object.keys(CASE_FILES), 'overview'];
if (PREVIEW && !PREVIEW.length) throw new Error('case-pages: CASE_PREVIEW is set but names no case');
const unknown = PREVIEW?.filter((s) => !KNOWN.includes(s)) ?? [];
if (unknown.length) throw new Error(`case-pages: CASE_PREVIEW names ${unknown.join(', ')}; the registered names are ${KNOWN.join(', ')}`);

const picked = (name: string) => !PREVIEW || PREVIEW.includes(name);

// the private names stay off this public repo: they sit in a git ignored file on the laptop, read from the folder the build
// runs in, so a build without that file, such as Vercel's, skips that one check
const PRIVATE_NAMES = '.agent/private-names.json';
const names = fs.existsSync(PRIVATE_NAMES) ? privateNames(JSON.parse(fs.readFileSync(PRIVATE_NAMES, 'utf8'))) : new Set<number>();
if (!names.size) warn(`no names in ${PRIVATE_NAMES}, so content files are not checked for private names`);

const projectIds = new Set(projectsJson.map((p) => p.id));
const caseReports = Object.entries(CASE_FILES).map(([file, data]) => ({ name: file, ...validateCase(data, file, projectIds, names) }));
const reports = [...caseReports, { name: 'overview', ...validateOverview(OVERVIEW, names) }];

// a preview build stops only on the files it renders, so a sibling's half edited file never blocks it
const fatal: string[] = [];
for (const r of reports) {
  if (!picked(r.name)) {
    if (r.errors.length) warn(`${r.name} has ${r.errors.length} error(s) and is left out of the cards, pager and overview`);
    continue;
  }
  for (const w of r.warnings) warn(`${r.name}: ${w}`);
  fatal.push(...r.errors.map((e) => `${r.name}: ${e}`));
}
if (fatal.length) throw new Error(`case-pages: fix these content problems first\n  ${fatal.join('\n  ')}`);

for (const c of CASES.filter((x) => picked(x.slug))) for (const g of c.gaps) warn(`${c.slug}: gap: ${g}`);
if (picked('overview')) for (const g of OVERVIEW.gaps) warn(`overview: gap: ${g}`);

// cases on the cards, the pagers and the overview: every registered case that passes its checks
export const LISTED = CASES.filter((_, i) => !caseReports[i].errors.length);
// cases whose pages this build emits
export const SELECTED = PREVIEW ? LISTED.filter((c) => PREVIEW.includes(c.slug)) : LISTED;

type TResolve = (...parts: string[]) => string;

// called from configResolved of a build only, so the dev server never trips on a draft
export const assertBuildable = async (root: string, outDir: string) => {
  if (PREVIEW) {
    const { resolve } = (await import('node:path' as string)) as { resolve: TResolve };
    // a partial build must never become a deploy
    if (resolve(root, outDir) === resolve(root, 'dist'))
      throw new Error('case-pages: a CASE_PREVIEW build must not write into dist; pass --outDir <your preview folder> --emptyOutDir');
    return;
  }
  const drafts = [...CASES.filter((c) => c.draft).map((c) => c.slug), ...(OVERVIEW.draft ? ['overview'] : [])];
  // a failed build keeps the last good deploy live, which beats shipping a half written case
  if (drafts.length)
    throw new Error(`case-pages: still draft: ${drafts.join(', ')}. Finish them, or remove unfinished cases from src/cases/registry.ts on purpose`);
};
