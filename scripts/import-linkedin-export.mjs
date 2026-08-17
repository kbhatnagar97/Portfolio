#!/usr/bin/env node
// @ts-check
/**
 * import-linkedin-export.mjs
 *
 * Bridges your OWN official LinkedIn data export into the portfolio content.
 * LinkedIn has no public API for your certifications/positions, and scraping
 * violates their User Agreement — so the compliant path is their official
 * export:  LinkedIn → Settings → Data privacy → "Get a copy of your data" →
 * request "Certifications" and "Positions" (you'll receive Certifications.csv
 * and Positions.csv). Unzip it, then point this script at the folder.
 *
 * By default it is a DRY RUN: it only reports what's on LinkedIn but missing
 * from the portfolio. Pass --apply to scaffold new certifications into
 * src/content/achievements.json (images are left empty for you to add).
 *
 * Usage:
 *   node scripts/import-linkedin-export.mjs ~/Downloads/LinkedInDataExport
 *   node scripts/import-linkedin-export.mjs ~/Downloads/LinkedInDataExport --apply
 *   npm run import:linkedin -- ~/Downloads/LinkedInDataExport
 *
 * No external dependencies — Node >= 18.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdout } from 'node:process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACHIEVEMENTS_FILE = join(REPO_ROOT, 'src', 'content', 'achievements.json');
const PROFESSIONAL_FILE = join(REPO_ROOT, 'src', 'content', 'professional.json');

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, escaped quotes, CRLF). */
function parseCSV(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV text into array of objects keyed by (lower-cased) header. */
function toRecords(text) {
  const rows = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    /** @type {Record<string, string>} */
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? '').trim()));
    return obj;
  });
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Locate a CSV in a directory (or accept a direct .csv path). */
function findCsv(inputPath, ...names) {
  if (statSync(inputPath).isFile()) return inputPath.toLowerCase().endsWith('.csv') ? inputPath : null;
  const entries = readdirSync(inputPath);
  for (const name of names) {
    const hit = entries.find((e) => e.toLowerCase() === name.toLowerCase());
    if (hit) return join(inputPath, hit);
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    stdout.write(
      [
        'Import your official LinkedIn data export into the portfolio.',
        '',
        'Usage:',
        '  npm run import:linkedin -- <path-to-unzipped-export> [--apply]',
        '',
        'Get the export: LinkedIn → Settings → Data privacy →',
        '  "Get a copy of your data" → Certifications + Positions.',
        '',
        'Default is a dry run (report only). --apply scaffolds new',
        'certifications into src/content/achievements.json (add images after).',
        '',
      ].join('\n')
    );
    return;
  }

  const apply = args.includes('--apply');
  const inputPath = resolve(process.cwd(), args.find((a) => !a.startsWith('--')) ?? '');
  if (!existsSync(inputPath)) throw new Error(`Path not found: ${inputPath}`);

  /** @type {Array<Record<string, unknown>>} */
  const achievements = JSON.parse(readFileSync(ACHIEVEMENTS_FILE, 'utf8'));
  const professional = JSON.parse(readFileSync(PROFESSIONAL_FILE, 'utf8'));

  const existingCert = new Set(achievements.map((a) => norm(a.TITLE)));
  const existingRole = new Set(
    (professional.ROLES ?? []).map((r) => norm(`${r.POSITION}${r.COMPANY}`))
  );

  let newCertCount = 0;
  let newRoleCount = 0;

  // ---- Certifications ----
  const certCsv = findCsv(inputPath, 'Certifications.csv');
  if (certCsv) {
    const records = toRecords(readFileSync(certCsv, 'utf8'));
    const fresh = records.filter((r) => r.name && !existingCert.has(norm(r.name)));
    stdout.write(`\n📜 Certifications: ${records.length} in export, ${fresh.length} new\n`);
    for (const r of fresh) {
      newCertCount++;
      stdout.write(`   + ${r.name}${r.authority ? `  — ${r.authority}` : ''}\n`);
      if (apply) {
        achievements.push({
          ICON: '📜',
          TITLE: r.name,
          SUBTITLE: r.authority || '',
          DESCRIPTION: r['license number'] ? `${r['license number']} certification` : '',
          IMAGES: [],
        });
      }
    }
  } else {
    stdout.write('\n📜 No Certifications.csv found in export.\n');
  }

  // ---- Positions (report only — roles need curation) ----
  const posCsv = findCsv(inputPath, 'Positions.csv');
  if (posCsv) {
    const records = toRecords(readFileSync(posCsv, 'utf8'));
    const fresh = records.filter(
      (r) => r.title && !existingRole.has(norm(`${r.title}${r['company name'] ?? r.company ?? ''}`))
    );
    stdout.write(`\n💼 Positions: ${records.length} in export, ${fresh.length} not on portfolio\n`);
    for (const r of fresh) {
      newRoleCount++;
      stdout.write(`   • ${r.title} @ ${r['company name'] ?? r.company ?? '?'}\n`);
    }
    if (fresh.length > 0) {
      stdout.write('   (Roles are reported only — add curated entries to professional.json.)\n');
    }
  } else {
    stdout.write('\n💼 No Positions.csv found in export.\n');
  }

  // ---- Write / summary ----
  if (apply && newCertCount > 0) {
    writeFileSync(ACHIEVEMENTS_FILE, JSON.stringify(achievements, null, 2) + '\n', 'utf8');
    stdout.write(
      `\n✓ Scaffolded ${newCertCount} certification(s) into src/content/achievements.json.\n` +
        '  ⚠︎ Their IMAGES arrays are empty — add certificate images, then commit & push.\n'
    );
  } else if (!apply && (newCertCount > 0 || newRoleCount > 0)) {
    stdout.write('\nDry run only. Re-run with --apply to scaffold new certifications.\n');
  } else {
    stdout.write('\n✓ Portfolio is already up to date with the export.\n');
  }
  stdout.write('\n');
}

try {
  main();
} catch (err) {
  stdout.write(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
