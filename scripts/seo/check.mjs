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

// /about/ says each fact once and keeps the identity answer where crawlers and AI assistants look first
const mainText = visible(aboutHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '')
const firstSentence = about.identity.split(/(?<=[.!?])\s/)[0]
check(mainText.split(' ').slice(0, 100).join(' ').includes(firstSentence), '/about/ answers who he is in the first 100 words of <main>')
const timesIn = (hay, needle) => hay.split(needle).length - 1
check(timesIn(aboutText, about.identity) === 1, `/about/ shows the identity paragraph once (${timesIn(aboutText, about.identity)})`)
const seen = new Map()
for (const s of aboutText.split(/[.?!]\s/).map((x) => x.trim()).filter((x) => x.length >= 40)) seen.set(s, (seen.get(s) ?? 0) + 1)
const repeated = [...seen].filter(([, n]) => n > 1).map(([s]) => s)
check(repeated.length === 0, '/about/ repeats no sentence of 40 chars or more', repeated.join(' | '))
const longAnswers = faq.map((q) => q.acceptedAnswer.text).filter((a) => a.length > 300 || a.split(/(?<=[.!?])\s+/).length > 3)
check(faq.length > 0 && longAnswers.length === 0, 'every FAQ answer is 3 sentences and 300 chars or less', longAnswers.join(' | '))
const qas = [...aboutHtml.matchAll(/<div class="qa">([\s\S]*?)<\/div>/g)].map((m) => m[1])
const badMore = qas.filter((q) => {
  const id = q.match(/<a class="qa__more" href="#([^"]+)"/)?.[1]
  return !id || !aboutHtml.includes(`id="${id}"`)
})
check(qas.length === faq.length && badMore.length === 0, 'every FAQ item links to a section that exists', badMore.map((q) => textOf(q).slice(0, 60)).join(' | '))

// the about and project pages carry the playground: decoration only, wired to data that exists
const staticPages = [aboutFile, ...htmlFiles.filter((f) => relative(dist, f).startsWith(`projects`))].filter(existsSync)
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const hostIssues = []
const imgIssues = []
const playIssues = []
for (const f of staticPages) {
  const html = read(f)
  const name = relative(dist, f)
  for (const m of html.matchAll(/<[a-z]+\b[^>]*\sdata-play(?:-band)?(?=[\s=>])[^>]*>/g)) {
    if (!m[0].includes('aria-hidden="true"')) hostIssues.push(`${name}: host without aria-hidden`)
    if (!/^<\//.test(html.slice(m.index + m[0].length))) hostIssues.push(`${name}: host is not empty`)
  }
  for (const [tag] of html.matchAll(/<canvas\b[^>]*>/g)) if (!tag.includes('aria-hidden="true"')) hostIssues.push(`${name}: canvas without aria-hidden`)
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) if (!attr(tag, 'width') || !attr(tag, 'height')) imgIssues.push(`${name}: ${attr(tag, 'src')}`)

  const scripts = [...html.matchAll(/<script type="module" src="(\/assets\/play-[^"]+)"><\/script>/g)].map((m) => m[1])
  if (scripts.length !== 1 || !existsSync(join(dist, scripts[0]))) playIssues.push(`${name}: ${scripts.length} play scripts`)
  const blocks = [...html.matchAll(/<script type="application\/json" id="play-data">([\s\S]*?)<\/script>/g)]
  let data
  try {
    data = blocks.length === 1 ? JSON.parse(blocks[0][1]) : undefined
  } catch {
    data = undefined
  }
  if (data?.v !== 1 || !data.sets) {
    playIssues.push(`${name}: ${blocks.length} play-data blocks, or one that does not parse to v 1`)
    continue
  }
  // walk the tags so every chip and wave is checked against the set of the section it sits in
  const stack = [{ tag: '', set: undefined }]
  const markup = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  for (const [tag, close, tagName] of markup.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    const t = tagName.toLowerCase()
    if (close) {
      while (stack.length > 1 && stack.pop().tag !== t);
      continue
    }
    const own = attr(tag, 'data-play-set')
    const set = own ?? stack[stack.length - 1].set
    const bandKey = attr(tag, 'data-play-band')
    for (const key of [own, bandKey]) if (key !== undefined && !data.sets[key]) playIssues.push(`${name}: no set "${key}"`)
    const tileName = attr(tag, 'data-play-tile')
    if (tileName !== undefined && !data.sets[set]?.tiles.some((x) => x.t === decode(tileName))) playIssues.push(`${name}: tile "${tileName}" is not in set "${set}"`)
    const wave = attr(tag, 'data-play-wave')
    if (wave !== undefined && !data.sets[set]?.tiles.some((x) => x.wave === wave)) playIssues.push(`${name}: wave "${wave}" has no tiles in set "${set}"`)
    if (!VOID.has(t) && !tag.endsWith('/>')) stack.push({ tag: t, set })
  }
}
check(staticPages.length > 1 && hostIssues.length === 0, `playground hosts are empty and aria-hidden (${staticPages.length} pages)`, hostIssues.join(', '))
check(imgIssues.length === 0, 'every image on the about and project pages has width and height', imgIssues.join(', '))
check(playIssues.length === 0, 'about and project pages load one play script with matching play data', playIssues.slice(0, 8).join(', '))
check(!home.includes('/assets/play-'), 'home does not load the playground')

const portraits = files.filter((f) => /images[/\\]kshitij-bhatnagar[^/\\]*\.jpg$/.test(f))
const exif = portraits.filter((f) => readFileSync(f).includes('Exif')).map((f) => relative(dist, f))
check(portraits.length > 0 && exif.length === 0, `portraits carry no Exif (${portraits.length} checked)`, exif.join(', '))

console.log(`\n${failed ? `${failed} check(s) failed` : 'all checks passed'}`)
process.exit(failed ? 1 : 0)
