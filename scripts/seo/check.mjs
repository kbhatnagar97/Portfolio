// Usage: node scripts/seo/check.mjs <distDir>. Asserts the crawlable identity and SEO contract on a built site.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const dist = process.argv[2]
if (!dist || !existsSync(join(dist, 'index.html'))) {
  console.error('usage: node scripts/seo/check.mjs <distDir>')
  process.exit(2)
}

const SITE = 'https://kshitijbhatnagar.com'
const profile = JSON.parse(readFileSync(new URL('../../src/content/profile.json', import.meta.url), 'utf8'))
const about = JSON.parse(readFileSync(new URL('../../src/content/about.json', import.meta.url), 'utf8'))

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
const files = walk(dist)
const htmlFiles = files.filter((f) => f.endsWith('.html'))
const read = (f) => readFileSync(f, 'utf8')

const decode = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
const visible = (html) =>
  decode(
    html
      .replace(/<head[\s\S]*?<\/head>/i, ' ')
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
const textOf = (fragment) => decode(fragment.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

let failed = 0
const check = (ok, label, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `\n      ${detail}` : ''}`)
}

const home = read(join(dist, 'index.html'))
const homeText = visible(home)
const aboutFile = join(dist, 'about', 'index.html')
const aboutHtml = existsSync(aboutFile) ? read(aboutFile) : ''
const aboutText = visible(aboutHtml)

check(/<div id="root">\s*<[^/]/.test(home), '#root is prerendered')

const h1 = home.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
check(h1 !== undefined && textOf(h1) === profile.name, `home h1 reads "${profile.name}"`, `got "${h1 && textOf(h1)}"`)

check(homeText.includes(about.headline), 'home shows the headline')
check(homeText.includes(profile.location), `home shows "${profile.location}"`)
for (const l of profile.links) check(home.includes(`href="${l.href}"`), `home links ${l.label}`)
check(home.includes('href="/about/"'), 'home links /about/')
check(!!aboutHtml, 'about/index.html exists')

const missing = new Set()
for (const f of htmlFiles)
  for (const [, p] of read(f).matchAll(/href="(\/projects\/[^"#?]*)"/g))
    if (!existsSync(join(dist, p.endsWith('/') ? `${p}index.html` : p))) missing.add(`${p} (from ${relative(dist, f)})`)
check(missing.size === 0, 'every /projects/ link resolves to a dist file', [...missing].join(', '))

const badJson = []
const faqPages = []
const nodes = (data) => (Array.isArray(data) ? data : data['@graph'] ?? [data])
let faq = []
for (const f of htmlFiles)
  for (const [, body] of read(f).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const found = nodes(JSON.parse(body)).find((n) => n['@type'] === 'FAQPage')
      if (found) {
        faqPages.push(relative(dist, f))
        faq = found.mainEntity
      }
    } catch (e) {
      badJson.push(`${relative(dist, f)}: ${e.message}`)
    }
  }
check(badJson.length === 0, 'every JSON-LD block parses', badJson.join('; '))
check(faqPages.length === 1 && faqPages[0] === join('about', 'index.html'), 'FAQPage appears only on /about/', faqPages.join(', '))

const faqMissing = faq.flatMap((q) => [q.name, q.acceptedAnswer.text]).filter((s) => !aboutText.includes(s))
check(faq.length === about.faq.length && faqMissing.length === 0, 'every FAQ question and answer is visible on /about/', faqMissing.join(' | '))

const longTitles = htmlFiles
  .map((f) => [relative(dist, f), decode(read(f).match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')])
  .filter(([, t]) => !t || t.length > 65)
check(longTitles.length === 0, 'every title is present and 65 chars or less', longTitles.map(([f, t]) => `${f}: ${t.length}`).join(', '))
const desc = decode(home.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '')
check(desc.length > 0 && desc.length <= 160, `home meta description is 160 chars or less (${desc.length})`)

const count = (s) => (s.match(/HashedIn/g) ?? []).length
check(count(homeText) === 1, `home visible text names the employer once (${count(homeText)})`)
check(count(aboutText) === 1, `/about/ visible text names the employer once (${count(aboutText)})`)

const dashed = files.filter((f) => /\.(html|txt)$/.test(f) && /[–—]/.test(read(f))).map((f) => relative(dist, f))
check(dashed.length === 0, 'no en or em dashes in HTML or txt files', dashed.join(', '))

const sitemap = existsSync(join(dist, 'sitemap.xml')) ? read(join(dist, 'sitemap.xml')) : ''
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
// vercel.json rewrites serve these paths from another deployment, so they have no file in dist
const rewrites = new Set(JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')).rewrites?.map((r) => r.source) ?? [])
const deadLocs = locs.filter((u) => {
  const p = u.replace(SITE, '')
  return !rewrites.has(p) && !existsSync(join(dist, p.endsWith('/') ? `${p}index.html` : p))
})
check(locs.length > 0 && deadLocs.length === 0, `every sitemap URL exists in dist (${locs.length})`, deadLocs.join(', '))

const portraits = files.filter((f) => /images[/\\]kshitij-bhatnagar[^/\\]*\.jpg$/.test(f))
const exif = portraits.filter((f) => readFileSync(f).includes('Exif')).map((f) => relative(dist, f))
check(portraits.length > 0 && exif.length === 0, `portraits carry no Exif (${portraits.length} checked)`, exif.join(', '))

console.log(`\n${failed ? `${failed} check(s) failed` : 'all checks passed'}`)
process.exit(failed ? 1 : 0)
