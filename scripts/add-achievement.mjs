#!/usr/bin/env node
// @ts-check
/**
 * add-achievement.mjs
 *
 * Interactive CLI to append a new achievement/certification to the portfolio
 * WITHOUT hand-editing constants.tsx. It copies certificate image(s) into
 * public/images/Linkedin/<category>/ and appends a structured entry to
 * src/content/achievements.json (the file the landing page renders from).
 *
 * Usage:
 *   npm run add:achievement
 *   node scripts/add-achievement.mjs
 *
 * No external dependencies — Node >= 18.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { basename, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(REPO_ROOT, 'src', 'content', 'achievements.json');
const LINKEDIN_DIR = join(REPO_ROOT, 'public', 'images', 'Linkedin');

/** @param {string} s */
const clean = (s) => s.trim();

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    stdout.write(
      [
        'Add a new achievement/certification to the portfolio.',
        '',
        'Prompts for icon, title, subtitle, description and optional image paths.',
        'Images are copied into public/images/Linkedin/<category>/ and the entry',
        'is appended to src/content/achievements.json.',
        '',
        'Run:  npm run add:achievement',
        '',
      ].join('\n')
    );
    return;
  }

  if (!existsSync(DATA_FILE)) {
    throw new Error(`Cannot find ${DATA_FILE}. Run this from the portfolio repo.`);
  }

  /** @type {Array<Record<string, unknown>>} */
  const achievements = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    stdout.write('\n➕  Add a new achievement to your portfolio\n\n');

    const title = clean(await rl.question('Title* (e.g. "AWS Solutions Architect"): '));
    if (!title) {
      stdout.write('\n✗ Title is required. Aborted — nothing was written.\n');
      return;
    }

    const iconInput = clean(await rl.question('Icon emoji [📜]: '));
    const icon = iconInput || '📜';
    const subtitle = clean(await rl.question('Subtitle (e.g. issuer / "Amazon Web Services"): '));
    const description = clean(await rl.question('Short description: '));

    const category =
      clean(await rl.question('Image category folder [Certifications]: ')) || 'Certifications';

    const imagesRaw = clean(
      await rl.question(
        'Certificate image file path(s), comma-separated (optional, Enter to skip): '
      )
    );

    /** @type {string[]} */
    const webPaths = [];
    if (imagesRaw) {
      const destDir = join(LINKEDIN_DIR, category);
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      for (const raw of imagesRaw.split(',')) {
        const src = clean(raw);
        if (!src) continue;
        const srcAbs = resolve(process.cwd(), src.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
        if (!existsSync(srcAbs)) {
          stdout.write(`  ⚠︎ Skipping "${src}" — file not found.\n`);
          continue;
        }
        const file = basename(srcAbs);
        copyFileSync(srcAbs, join(destDir, file));
        const web = `/images/Linkedin/${category}/${file}`;
        webPaths.push(web);
        stdout.write(`  ✓ Copied ${file} → public${web}\n`);
      }
    }

    /** @type {Record<string, unknown>} */
    const entry = { ICON: icon, TITLE: title, SUBTITLE: subtitle, DESCRIPTION: description };
    if (webPaths.length > 0) entry.IMAGES = webPaths;

    achievements.push(entry);
    writeFileSync(DATA_FILE, JSON.stringify(achievements, null, 2) + '\n', 'utf8');

    stdout.write(`\n✓ Added "${title}" to src/content/achievements.json\n`);
    if (webPaths.length === 0) {
      stdout.write('  (No images attached — you can re-run and add them later.)\n');
    }
    stdout.write(
      [
        '',
        'Next steps:',
        '  1) npm run dev         # verify it looks right',
        '  2) git add -A && git commit -m "content: add ' + title + '"',
        '  3) git push            # Vercel auto-deploys',
        '',
      ].join('\n')
    );
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  stdout.write(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
