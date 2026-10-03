import { createElement, StrictMode, type ComponentType } from 'react'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import projectsJson from './src/content/projects.json'
import profileJson from './src/content/profile.json'
import professionalJson from './src/content/professional.json'
import achievementsJson from './src/content/achievements.json'
import automationsJson from './src/content/automations.json'
import aboutJson from './src/content/about.json'
import claudeStoryJson from './src/content/claude-story.json'
import type { TPlayData, TPlaySet, TTile, TTone } from './src/play/types'

const SITE = 'https://kshitijbhatnagar.com'
const HOME = `${SITE}/`
const ABOUT = `${SITE}/about/`
const PERSON_ID = `${SITE}/#person`
const WEBSITE_ID = `${SITE}/#website`
const PORTRAIT = `${SITE}/images/kshitij-bhatnagar-portrait.jpg`
const OG = `${SITE}/og.jpg`
// the first commit; git history is shallow on Vercel, so it cannot be read at build time
const SITE_CREATED = '2025-08-10'
const CONTENT_FILES = 'src/content index.html'

interface IProjectSeo {
  id: string
  name: string
  tagline: string
  summary: string
  spark: string
  build: string
  architecture: string[]
  highlights: string[]
  category: string
  status: string
  live: boolean
  url: string
  repo: string
  writeup?: string
  year: string
  accent: string
  stack: string[]
  poster?: string
  // meta description for projects whose first summary sentence runs past 160 chars
  description?: string
}

interface IFaq {
  q: string
  a: string
  more: string[]
}

const P = profileJson
const A = aboutJson
const PROJECTS: IProjectSeo[] = projectsJson
const AUTO_IDS = new Set(automationsJson.map((a) => a.id))
const LIVE = PROJECTS.filter((p) => p.live)
const BUILDS = PROJECTS.filter((p) => !p.live && !AUTO_IDS.has(p.id))
const AUTOS = automationsJson.map((a) => PROJECTS.find((p) => p.id === a.id)).filter((p): p is IProjectSeo => !!p)
const ORDERED = [...LIVE, ...BUILDS, ...AUTOS]

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const pagePath = (p: IProjectSeo) => `/projects/${slugOf(p.name)}/`
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const abs = (u: string) => (u.startsWith('/') ? SITE + u : u)
const ld = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
const listText = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const hostLabel = (u: string) => {
  const bare = abs(u).replace(/^https?:\/\/(www\.)?/, '')
  return u.startsWith('/') ? bare : bare.split('/')[0]
}
// whole sentences when they fit, else a word boundary cut, so no description falls back to a thin tagline
const snippet = (p: IProjectSeo, n = 160) => {
  if (p.description) return p.description
  const sentences = p.summary.trim().split(/(?<=[.!?])\s+/)
  let out = ''
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s
    if (next.length > n) break
    out = next
  }
  if (out) return out
  if (!sentences[0]) return `${p.tagline}. Built by ${P.name}.`
  const cut = sentences[0].slice(0, n - 5)
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.!?]+$/, '')}.`
}

// no @types/node in this repo, so the one node builtin loads untyped
const lastModified = async () => {
  try {
    const cp = (await import('node:child_process' as string)) as { execSync: (cmd: string) => { toString(): string } }
    return cp.execSync(`git log -1 --format=%cs -- ${CONTENT_FILES}`).toString().trim() || new Date().toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

// #region Facts composed from src/content, shared by the pages, JSON-LD and llms files
const SKILL_TOOLS = [...new Set(P.skills.flatMap((s) => s.tools))]
const ROLES = professionalJson.ROLES
const EARLY = professionalJson.EARLY_EXPERIENCE
const CERTS = achievementsJson.filter((a) => a.SUBTITLE !== P.company)
const awardLine = (a: (typeof achievementsJson)[number]) =>
  a.SUBTITLE === P.company ? `${a.TITLE}: ${a.DESCRIPTION}.` : `${a.TITLE}, ${a.SUBTITLE}: ${a.DESCRIPTION}.`
const educationLine = (e: (typeof P.education)[number]) =>
  `${e.degree.replace(', ', ' in ')}${'minor' in e && e.minor ? ` with a ${e.minor}` : ''}, ${e.institution}, ${e.duration}${'grade' in e && e.grade ? `, ${e.grade}` : ''}`

const YEARS = (() => {
  const [y, m] = P.careerStart.split('-').map(Number)
  const now = new Date()
  return Math.floor(now.getFullYear() - y + (now.getMonth() + 1 - m) / 12)
})()
const STORY = claudeStoryJson
const TYPE_LABEL = (t: string) => t.replace(/ & /g, ' and ')
// the cadence stat repeats "Runs every N min", and a trailing ", max" breaks the joined list
const autoFacts = (id: string) => {
  const a = automationsJson.find((x) => x.id === id)
  const stats = a?.stats.filter((s) => !s.label.startsWith('minute'))
  return a && stats
    ? `Runs ${a.cadence}. ${listText(stats.map((s) => `${s.value}${s.label.startsWith('%') ? '' : ' '}${s.label.replace(/, max$/, ' at most')}`))}.`
    : ''
}
// the home page shares these voices, so lines that only hold there (its particles, the analogy #how already makes) are cut here
const VOICE_CUTS: [RegExp, string][] = [
  [/, and I direct coding agents the way a lead directs a team/, ''],
  [/ on this page\./, ' on my home page.'],
]
const voice = (s: (typeof P.skills)[number]) => VOICE_CUTS.reduce((t, [re, to]) => t.replace(re, to), s.body)

// the skills answer names its four areas in prose, so a fifth group must be written into about.json first
if (P.skills.length !== 4) throw new Error(`site-seo: the skills FAQ names 4 areas, profile.json has ${P.skills.length}`)
const FAQ_TOKENS: Record<string, string> = {
  projects: String(PROJECTS.length),
  live: String(LIVE.length),
  featured: listText(LIVE.slice(0, 3).map((p) => p.name)),
  email: P.email,
  who: `${P.name} is a ${A.disambiguatingDescription[0].toLowerCase()}${A.disambiguatingDescription.slice(1)}`,
}
const FAQ: IFaq[] = A.faq.map((f) => ({
  q: f.q,
  more: f.more,
  a: f.a.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in FAQ_TOKENS)) throw new Error(`site-seo: unknown FAQ token {${k}}`)
    return FAQ_TOKENS[k]
  }),
}))

const personNode = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: P.name,
  givenName: P.name.split(' ')[0],
  familyName: P.name.split(' ').slice(1).join(' '),
  alternateName: A.alternateName,
  url: HOME,
  image: { '@type': 'ImageObject', '@id': `${SITE}/#portrait`, url: PORTRAIT, contentUrl: PORTRAIT, width: 1170, height: 1170, caption: P.name },
  email: `mailto:${P.email}`,
  jobTitle: P.role,
  description: A.identity,
  disambiguatingDescription: A.disambiguatingDescription,
  homeLocation: {
    '@type': 'Place',
    name: `${A.location.city}, ${A.location.country}`,
    address: { '@type': 'PostalAddress', addressLocality: A.location.city, addressCountry: A.location.countryCode },
  },
  nationality: { '@type': 'Country', name: A.location.country },
  hasOccupation: {
    '@type': 'Occupation',
    name: P.role,
    occupationLocation: { '@type': 'City', name: A.location.city, containedInPlace: { '@type': 'Country', name: A.location.country } },
    skills: SKILL_TOOLS.join(', '),
  },
  knowsAbout: [...new Set([...SKILL_TOOLS, ...A.extraKnowsAbout])],
  worksFor: { '@type': 'Organization', name: P.company },
  alumniOf: A.alumniOf.map((s) => ({
    '@type': s.type,
    name: s.name,
    ...('alternateName' in s && { alternateName: s.alternateName }),
    sameAs: s.sameAs,
  })),
  hasCredential: [
    {
      '@type': 'EducationalOccupationalCredential',
      name: `${P.education[0].degree}, ${P.education[0].minor}`,
      credentialCategory: 'degree',
      recognizedBy: { '@type': 'CollegeOrUniversity', name: P.education[0].institution },
    },
    ...CERTS.map((c) => ({
      '@type': 'EducationalOccupationalCredential',
      name: c.TITLE,
      credentialCategory: 'certificate',
      description: `${c.SUBTITLE}, ${c.DESCRIPTION}`,
    })),
  ],
  award: A.awards,
  sameAs: P.links.map((l) => l.href),
  mainEntityOfPage: { '@id': `${ABOUT}#profile` },
})
// #endregion

// #region Static pages
// shared by the CSS below and the playground, so the rail and its canvas switch at the same width
const MQ = '(min-width: 1024px) and (min-height: 700px)'
// metric matched local faces hold the layout while the web fonts swap in, measured against Geist, Geist Mono and Instrument Serif
const CSS = `@font-face{font-family:'Geist Fallback';src:local('Arial'),local('ArialMT'),local('Helvetica');size-adjust:102.04%;ascent-override:98.98%;descent-override:28.42%;line-gap-override:0%}
@font-face{font-family:'Geist Mono Fallback';src:local('Menlo'),local('Menlo-Regular'),local('Courier New');size-adjust:99.66%;ascent-override:101.35%;descent-override:29.1%;line-gap-override:0%}
@font-face{font-family:'Instrument Serif Fallback';src:local('Times New Roman'),local('TimesNewRomanPSMT'),local('Times');size-adjust:82.23%;ascent-override:120.4%;descent-override:37.7%;line-gap-override:0%}
@font-face{font-family:'Instrument Serif Fallback';font-style:italic;src:local('Times New Roman Italic'),local('TimesNewRomanPS-ItalicMT'),local('Times-Italic');size-adjust:86.76%;ascent-override:114.1%;descent-override:35.73%;line-gap-override:0%}
:root{--bg:#0b0a09;--bg-raise:#141210;--surface:rgba(255,246,235,.035);--surface-2:rgba(255,246,235,.07);--line:rgba(255,240,225,.1);--line-strong:rgba(255,240,225,.22);--text:#f2ebe1;--muted:#a89e92;--faint:#8a8076;--gold:#f0b44c;--gold-soft:rgba(240,180,76,.14);--live:#5ee49a;--live-soft:rgba(94,228,154,.14);--play-holo:#7fe7ff;--play-violet:#a9a4ff;--ease:cubic-bezier(.16,1,.3,1);--gutter:clamp(16px,4vw,56px);--sans:'Geist','Geist Fallback',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;--serif:'Instrument Serif','Instrument Serif Fallback',Georgia,serif;--mono:'Geist Mono','Geist Mono Fallback',ui-monospace,'SF Mono',Menlo,monospace}
*,*::before,*::after{box-sizing:border-box}
html{color-scheme:dark;-webkit-text-size-adjust:100%;background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.7 var(--sans);-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
h1,h2,h3,h4{margin:0;font-weight:400}
p{margin:0 0 16px;max-width:64ch}
ul,ol{margin:0;padding:0;list-style:none}
img{display:block;max-width:100%;height:auto}
a{color:var(--text);text-decoration-line:underline;text-decoration-color:var(--gold);text-decoration-thickness:1px;text-underline-offset:3px;transition:color .2s,border-color .2s,background-color .2s}
a:hover{color:var(--gold)}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:4px}
.serif{font-family:var(--serif);font-style:italic;font-weight:400;color:var(--gold);letter-spacing:-.02em;padding-inline-end:.08em;margin-inline-end:-.08em}
.eyebrow,.num{display:block;margin:0 0 16px;font:500 12px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.label{margin:0 0 8px;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.top{position:sticky;top:0;z-index:10;height:64px;background:rgba(11,10,9,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.top__in{display:flex;align-items:center;justify-content:space-between;gap:8px;height:100%;max-width:1320px;margin:0 auto;padding-inline:var(--gutter)}
.brand{display:inline-block;line-height:40px;font:500 17px/40px var(--sans);letter-spacing:-.03em;color:var(--text);text-decoration:none;white-space:nowrap}
.brand .serif{font-size:1.3em;letter-spacing:-.01em}
.top nav{display:flex}
.top nav a{display:inline-flex;align-items:center;min-height:40px;padding:0 7px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-decoration:none}
.top nav a:hover,.top nav a[aria-current="page"]{color:var(--text)}
.layout{max-width:1320px;margin:0 auto;padding:0 var(--gutter) 64px}
.layout>*{min-width:0}
html{scroll-padding-top:80px}
.sec{margin-top:clamp(40px,5vw,64px);padding-top:clamp(64px,8vw,112px);border-top:1px solid var(--line)}
.sec h2{margin:0 0 clamp(24px,3vw,40px);font:400 clamp(36px,5vw,64px)/1.02 var(--serif);letter-spacing:-.02em}
.group{display:flex;align-items:baseline;gap:12px;margin:56px 0 20px;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.sec h2+.group{margin-top:0}
.group small{font-size:12px;color:var(--faint)}
.opener{padding-top:clamp(40px,6vw,72px)}
.opener__head{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"eye pic" "h1 h1";align-items:end;gap:20px 24px}
.opener__head .eyebrow{grid-area:eye;align-self:center;margin:0}
.opener__head h1{grid-area:h1}
.portrait{grid-area:pic;width:88px;height:88px;border-radius:50%;object-fit:cover;border:1px solid rgba(240,180,76,.5)}
.hero{font:500 clamp(56px,min(14vw,18vh),112px)/.9 var(--sans);letter-spacing:-.05em}
.hero>span{display:block}
.lede{margin:40px 0 0;max-width:60ch;font:400 clamp(19px,1.7vw,22px)/1.55 var(--sans)}
.lede::first-letter{float:left;margin:.06em .08em 0 0;font-family:var(--serif);font-size:4.1em;line-height:.82;color:var(--gold)}
.stats{display:grid;grid-template-columns:1fr 1fr;margin:48px 0 0;border-block:1px solid var(--line)}
.stats li{padding:24px 0 24px 16px}
.stats li:nth-child(odd){padding-left:0}
.stats li:nth-child(even){border-left:1px solid var(--line)}
.stats li:nth-child(n+3){border-top:1px solid var(--line)}
.stat__n{display:block;font:400 clamp(44px,5.5vw,72px)/1 var(--serif);letter-spacing:-.02em}
.stat__l{display:block;margin-top:10px;font:500 11px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.pull{max-width:22ch;margin:56px 0;font:italic 400 clamp(30px,3.4vw,46px)/1.15 var(--serif);letter-spacing:-.01em}
.pull::before{content:"";display:block;width:40px;height:1px;margin-bottom:24px;background:var(--gold)}
.opener .pull{margin-bottom:40px}
.play,.play-band{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--bg-raise);contain:strict}
.play{display:none}
.play-band{height:180px;margin:32px 0}
html:not(.js) .play,html:not(.js) .play-band{display:none}
.play>canvas,.play-band>canvas{display:block;width:100%;height:100%;touch-action:pan-y;opacity:0;transition:opacity .4s var(--ease)}
.play[data-ready]>canvas,.play-band[data-ready]>canvas{opacity:1}
[data-hint]::after{content:attr(data-hint);position:absolute;top:12px;left:14px;font:500 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint);pointer-events:none}
.rail{margin:40px calc(-1 * var(--gutter)) 0}
.toc ol{display:flex;gap:8px;overflow-x:auto;margin:-6px 0;padding:6px var(--gutter);scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 var(--gutter),#000 calc(100% - var(--gutter)),transparent);mask-image:linear-gradient(90deg,transparent,#000 var(--gutter),#000 calc(100% - var(--gutter)),transparent)}
.toc ol::-webkit-scrollbar{display:none}
.toc li{flex:none}
.toc a{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:var(--muted);text-decoration:none}
.toc a:hover{color:var(--text)}
.toc a[aria-current="true"]{color:var(--gold);border-color:var(--gold)}
.toc__n{color:var(--faint)}
.toc__n:empty{display:none}
.cards{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.card{display:flex;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);transition:border-color .3s var(--ease)}
.card:hover{border-color:var(--line-strong)}
.card__media{overflow:hidden;aspect-ratio:16/10;margin:0 0 20px;border-radius:12px;background:var(--bg-raise)}
.card__media img{width:100%;height:100%;object-fit:cover;transition:transform .6s var(--ease)}
.card__meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.card__year{font:500 12.5px/1 var(--mono);color:var(--muted)}
.card__name{font:400 26px/1.1 var(--serif);letter-spacing:-.01em}
.card__name a{display:inline-flex;align-items:center;gap:10px;min-height:40px;text-decoration:none}
.card__name a::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--a,var(--muted))}
.card__tag{margin:4px 0 0;font-size:15px;line-height:1.5;color:var(--muted)}
.card__cat{margin:12px 0 0;font:500 12px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.card__facts{margin:8px 0 0;font:500 12.5px/1.5 var(--mono);color:var(--muted)}
.card__links{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:20px}
.card__links .pill:first-child{flex:none}
.pill{display:inline-flex;align-items:center;gap:6px;min-width:0;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);color:var(--text);text-decoration:none;white-space:nowrap}
.pill:hover{color:var(--gold);border-color:var(--gold)}
.pill span{overflow:hidden;text-overflow:ellipsis}
.pill--out::after{content:"\\2197";content:"\\2197"/"";flex:none}
.pill--solid{background:var(--text);border-color:var(--text);color:var(--bg)}
.pill--solid:hover{background:var(--gold);border-color:var(--gold);color:var(--bg)}
.status{display:inline-flex;align-items:center;gap:8px;height:24px;padding:0 10px;border:1px solid var(--line);border-radius:999px;font:500 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:var(--text)}
.status::before{content:"";width:6px;height:6px;border:1px solid var(--faint);border-radius:50%}
.status--live{background:var(--live-soft);border-color:transparent}
.status--live::before{background:var(--live);border-color:var(--live)}
.status--progress::before{background:var(--gold);border-color:var(--gold)}
.status--open::before{border-color:var(--text)}
@keyframes pulse{50%{opacity:.35}}
.skill{padding:32px 0;border-top:1px solid var(--line)}
.skill:last-child{padding-bottom:0}
.skill__i{display:block;margin-bottom:12px;font:500 12px/1 var(--mono);letter-spacing:.14em;color:var(--gold)}
.skill__t{margin-bottom:20px;font:400 30px/1.1 var(--serif);letter-spacing:-.01em}
.proofs{margin:0 0 8px}
.proofs li,.marks li{position:relative;margin:8px 0;padding-left:22px}
.proofs li::before,.marks li::before{content:"";position:absolute;left:0;top:.62em;width:6px;height:6px;background:var(--gold)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.chips li{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 12px;border:1px solid var(--line-strong);border-radius:999px;font:500 12px/1 var(--mono);white-space:nowrap}
.chips li::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--tone,var(--muted))}
.timeline{position:relative;display:grid;gap:40px;margin-top:32px;padding-left:32px}
.timeline::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:1px;background:var(--line-strong)}
.tl{position:relative}
.tl::before{content:"";position:absolute;left:-32px;top:3px;width:15px;height:15px;border:1px solid var(--gold);border-radius:50%;background:var(--bg)}
.tl--now::before{background:var(--gold);outline:4px solid var(--gold-soft)}
.timeline--early .tl::before{left:-30px;top:5px;width:11px;height:11px;border-color:var(--faint)}
.tl__date{display:block;margin-bottom:6px;font:500 12.5px/1.4 var(--mono);color:var(--muted)}
.tl__role{font:500 20px/1.3 var(--sans);letter-spacing:-.01em}
.tl__type{margin:4px 0 12px;font:500 12px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.tl__list li{position:relative;margin:6px 0;padding-left:20px;color:var(--muted)}
.tl__list li::before{content:"";position:absolute;left:0;top:.85em;width:8px;height:1px;background:var(--line-strong)}
.divider{display:flex;align-items:center;gap:16px;margin:56px 0 0;font:500 12px/1.4 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.divider::after{content:"";flex:1;height:1px;background:var(--line)}
.duo,.before{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.edu,.bcard{padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
.edu h3{margin-bottom:12px;font:400 22px/1.2 var(--serif)}
.edu p{margin:0;color:var(--muted)}
.edu__yrs{display:block;margin-top:16px;font:500 12.5px/1 var(--mono);color:var(--muted)}
.numchip{display:inline-flex;align-items:center;height:28px;margin-top:16px;padding:0 12px;border:1px solid var(--line-strong);border-radius:999px;font:500 12.5px/1 var(--mono)}
.rows{display:grid;grid-template-columns:minmax(0,1fr);column-gap:32px;border-top:1px solid var(--line)}
.rows>li{padding:16px 0;border-bottom:1px solid var(--line)}
.row__a{display:block}
.row__b{display:block;margin-top:2px;font:500 12.5px/1.5 var(--mono);color:var(--muted)}
.award h3{font:400 20px/1.25 var(--serif)}
.award p{margin:4px 0 0;font-size:15px;line-height:1.5;color:var(--muted)}
.award .row__b{margin-top:6px}
.bcard__y{display:block;margin-bottom:16px;font:400 44px/1 var(--serif);color:var(--muted)}
.bcard h3{margin-bottom:8px;font:500 20px/1.3 var(--sans)}
.bcard p{margin:0;font-size:15px;line-height:1.55;color:var(--muted)}
.bcard .chips{margin-top:16px}
.qa{padding:24px 0;border-top:1px solid var(--line)}
.qa h3{margin-bottom:12px;font:400 24px/1.2 var(--serif)}
.qa p{margin:0;font-size:17px;line-height:1.65}
.qa__more{display:inline-flex;align-items:center;gap:8px;min-height:40px;margin-top:4px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gold);text-decoration:none}
.qa__more::after{content:"\\2192";content:"\\2192"/"";transition:transform .3s var(--ease)}
.qa__more:hover{color:var(--text)}
.qa__more:hover::after{transform:translateX(3px)}
.online{display:grid;grid-template-columns:minmax(0,1fr);column-gap:32px;border-top:1px solid var(--line)}
.online a{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:16px;min-height:56px;padding:10px 8px;border-bottom:1px solid var(--line);text-decoration:none}
.online a:hover{background:var(--surface-2);color:var(--text)}
.online a::after{content:"\\2197";content:"\\2197"/"";grid-area:1/2/3/3;color:var(--muted)}
.online__h{grid-column:1;margin-top:4px;overflow-wrap:anywhere;font:500 12.5px/1.4 var(--mono);color:var(--muted)}
.updated{margin:32px 0 0;font:500 12.5px/1.4 var(--mono);color:var(--faint)}
.crumbs{display:flex;flex-wrap:wrap;column-gap:8px;font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--muted)}
.crumbs li{display:flex;align-items:center;min-height:40px;white-space:nowrap}
.crumbs li:not(:last-child)::after{content:"/";margin-left:8px;color:var(--faint)}
.crumbs a{display:inline-flex;align-items:center;min-height:40px;color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--gold)}
.statusrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:24px 0 20px;font:500 12.5px/1 var(--mono);color:var(--muted)}
.title{font:500 clamp(48px,8vw,96px)/.95 var(--sans);letter-spacing:-.045em}
.deck{max-width:30ch;margin:16px 0 0;font:italic 400 clamp(26px,3vw,36px)/1.2 var(--serif)}
.poster{width:100%;aspect-ratio:16/10;object-fit:cover;margin:40px 0 0;border:1px solid var(--line);border-radius:12px;background:var(--bg-raise)}
.cta{display:grid;gap:8px;margin:32px 0 0}
.cta .pill{justify-content:center}
.steps{counter-reset:s}
.steps li{position:relative;padding:16px 0 16px 48px;border-top:1px solid var(--line);counter-increment:s}
.steps li::before{content:counter(s,decimal-leading-zero);position:absolute;left:0;top:20px;font:500 12px/1.4 var(--mono);letter-spacing:.1em;color:var(--gold)}
.pager{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin-top:clamp(64px,8vw,112px)}
.pager a{display:flex;flex-direction:column;gap:8px;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--surface);text-decoration:none}
.pager a:hover{border-color:var(--line-strong);color:var(--text)}
.pager small{font:500 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pager strong{font:400 26px/1.1 var(--serif)}
.foot{margin-top:64px;padding-top:32px;border-top:1px solid var(--line);color:var(--muted)}
.foot p{margin:0}
.foot .updated{margin-top:24px}
.foot>.updated:first-child{margin-top:0}
.links{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
@media (max-width:639px){body{font-size:16px;line-height:1.65}}
@media (min-width:640px){
.layout{max-width:calc(680px + 2 * var(--gutter))}
.opener__head{grid-template-areas:"eye eye" "h1 pic"}
.portrait{width:120px;height:120px}
.stats{grid-template-columns:repeat(4,1fr)}
.stats li:nth-child(n){padding-left:20px;border-top:0;border-left:1px solid var(--line)}
.stats li:first-child{padding-left:0;border-left:0}
.cards,.duo,.before,.rows,.pager{grid-template-columns:repeat(2,minmax(0,1fr))}
.online a{display:flex}
.online a>span:first-child{flex:none}
.online__h{flex:1;margin:0;text-align:right;white-space:nowrap}
.card--lead{grid-column:1/-1}
.skill{display:grid;grid-template-columns:200px minmax(0,1fr);column-gap:32px}
.cta{display:flex;flex-wrap:wrap}
.pager a[rel="next"]{align-items:flex-end;text-align:right}
}
@media (min-width:768px){
.qa{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);column-gap:32px;align-items:start}
.qa h3{grid-row:span 2;margin:0}
.qa p,.qa__more{grid-column:2}
.qa__more{justify-self:start}
}
@media ${MQ}{
.layout{display:grid;grid-template-columns:minmax(0,720px) clamp(300px,28vw,400px);column-gap:clamp(48px,5vw,96px);justify-content:space-between;max-width:1320px}
.layout>*{grid-column:1}
.layout{padding-bottom:24px}
.opener{padding-top:40px}
.layout>.rail{grid-column:2;grid-row:1/span 20;margin:0;padding-top:40px}
.rail__in{position:sticky;top:104px;display:flex;flex-direction:column;gap:24px;height:calc(100vh - 128px);height:calc(100svh - 128px)}
.toc ol{display:block;overflow:visible;margin:0;padding:0;-webkit-mask-image:none;mask-image:none}
.toc a{position:relative;display:flex;gap:0;min-height:26px;padding:0;border:0;border-radius:0}
.toc__n{width:36px}
.toc__n:empty{display:inline}
.toc a::before{content:"";position:absolute;left:-24px;top:50%;width:16px;height:1px;background:var(--gold);transform:scaleX(0);transform-origin:left;transition:transform .3s var(--ease)}
.toc a[aria-current="true"]::before{transform:scaleX(1)}
.play{display:block;flex:1;min-height:240px}
.play-band{display:none}
.pull{margin-left:max(-32px,calc(16px - var(--gutter)))}
.card{padding:24px}
}
@media (orientation:landscape) and (max-height:500px){
html{scroll-padding-top:0}
.top{position:relative}
.play-band{height:132px}
.portrait{width:72px;height:72px}
}
@media (prefers-reduced-motion:no-preference){
html{scroll-behavior:smooth}
.card:hover .card__media img{transform:scale(1.02)}
.status--live::before{animation:pulse 2.4s var(--ease) infinite}
}
@media (prefers-reduced-motion:reduce){.play>canvas,.play-band>canvas{transition:none}}`

interface IPage {
  path: string
  title: string
  description: string
  ogType: 'profile' | 'website' | 'article'
  image: string
  imageAlt: string
  jsonld: object
  body: string
  foot: string
  play: { src: string; data: TPlayData }
}

const REL_ME = P.links.map((l) => `<link rel="me" href="${esc(l.href)}" />`).join('\n    ')
const [FIRST_NAME, ...LAST_NAME] = P.name.split(' ')

const page = (o: IPage) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <script>document.documentElement.classList.add('js')</script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(o.title)}</title>
    <meta name="description" content="${esc(o.description)}" />
    <link rel="canonical" href="${SITE}${o.path}" />
    <meta name="author" content="${esc(P.name)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta name="theme-color" content="#0b0a09" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    ${REL_ME}
    <link rel="alternate" type="text/plain" title="Profile of Kshitij Bhatnagar for AI assistants" href="/llms.txt" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" />
    <meta property="og:type" content="${o.ogType}" />
    <meta property="og:site_name" content="${esc(P.name)}" />
    <meta property="og:url" content="${SITE}${o.path}" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.description)}" />
    <meta property="og:image" content="${esc(o.image)}" />
    <meta property="og:image:alt" content="${esc(o.imageAlt)}" />
    <meta property="og:locale" content="en_IN" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(o.title)}" />
    <meta name="twitter:description" content="${esc(o.description)}" />
    <meta name="twitter:image" content="${esc(o.image)}" />
    <meta name="twitter:image:alt" content="${esc(o.imageAlt)}" />
    <style>${CSS}</style>
    ${ld(o.jsonld)}
  </head>
  <body>
    <header class="top">
      <div class="top__in">
        <a class="brand" href="/">${esc(FIRST_NAME)} <span class="serif">${esc(LAST_NAME.join(' '))}</span></a>
        <nav aria-label="Site"><a href="/about/"${o.path === '/about/' ? ' aria-current="page"' : ''}>About</a><a href="/#work">Work</a><a href="/#contact">Contact</a></nav>
      </div>
    </header>
    <main class="layout">
${o.body}
<footer class="foot">
${o.foot}
</footer>
    </main>
    <script type="application/json" id="play-data">${JSON.stringify(o.play.data).replace(/</g, '\\u003c')}</script>
    <script type="module" src="/${o.play.src}"></script>
  </body>
</html>
`

const rail = (items: [id: string, label: string, n: string][]) => `<aside class="rail">
<div class="rail__in">
<nav class="toc" aria-label="On this page"><ol>
${items.map(([id, label, n]) => `<li><a href="#${id}"><span class="toc__n" aria-hidden="true">${n}</span>${esc(label)}</a></li>`).join('\n')}
</ol></nav>
<div class="play" data-play aria-hidden="true"></div>
</div>
</aside>`

const sec = (id: string, n: string, title: string, inner: string, set?: string) => `<section id="${id}" class="sec"${set ? ` data-play-set="${set}"` : ''}>
${n ? `<span class="num" aria-hidden="true">${n}</span>\n` : ''}<h2>${esc(title)}</h2>
${inner}
</section>`

const band = (set: string) => `<div class="play-band" data-play-band="${set}" aria-hidden="true"></div>`

const TONE_VAR: Record<TTone, string> = {
  text: 'var(--text)',
  muted: 'var(--muted)',
  gold: 'var(--gold)',
  live: 'var(--live)',
  holo: 'var(--play-holo)',
  violet: 'var(--play-violet)',
}
const SKILL_TONE: Record<string, TTone> = { interfaces: 'gold', '3d-data': 'holo', ai: 'violet', shipping: 'live' }
const skillTone = (id: string) => SKILL_TONE[id] ?? 'text'

const chips = (xs: string[], label: string, tone: string) =>
  `<ul class="chips" aria-label="${esc(label)}" style="--tone:${esc(tone)}">${xs.map((t) => `<li data-play-tile="${esc(t)}">${esc(t)}</li>`).join('')}</ul>`

const STATUS_CLASS: Record<string, string> = { 'In progress': 'progress', 'Open source': 'open' }
const statusChip = (p: IProjectSeo) =>
  `<span class="status status--${p.live ? 'live' : (STATUS_CLASS[p.status] ?? 'private')}">${esc(p.live ? 'Live' : p.status)}</span>`

const outLink = (u: string, cls: string, label: string) =>
  `<a class="${cls}" href="${esc(u)}"${u.startsWith('/') ? '' : ' rel="noopener"'}><span>${esc(label)}</span></a>`

// a raw vercel subdomain or a long path reads as noise on a pill and gets cut, so it says what it is instead
const siteLabel = (u: string) => {
  const host = hostLabel(u)
  return host.endsWith('.vercel.app') || host.length > 18 ? 'Live site' : host
}

const card = (p: IProjectSeo) => {
  const rank = LIVE.indexOf(p)
  const facts = AUTO_IDS.has(p.id) ? autoFacts(p.id) : ''
  const site = p.url ? siteLabel(p.url) : ''
  return `<article class="card${rank === 0 ? ' card--lead' : ''}" style="--a:${esc(p.accent)}">
${p.poster && rank >= 0 && rank < 3 ? `<div class="card__media"><img src="${esc(p.poster)}" alt="${esc(`${p.name} by ${P.name}`)}" width="1280" height="800" loading="lazy" decoding="async" /></div>\n` : ''}<div class="card__meta">${statusChip(p)}<span class="card__year">${esc(p.year)}</span></div>
<h4 class="card__name"><a href="${pagePath(p)}">${esc(p.name)}</a></h4>
<p class="card__tag">${esc(p.tagline)}</p>
<p class="card__cat">${esc(TYPE_LABEL(p.category))}</p>
${facts ? `<p class="card__facts">${esc(facts)}</p>\n` : ''}<div class="card__links"><a class="pill" href="${pagePath(p)}" aria-label="${esc(`${p.name} case study`)}">Case study</a>${p.url ? `<a class="pill pill--out" href="${esc(p.url)}"${p.url.startsWith('/') ? '' : ' rel="noopener"'} title="${esc(hostLabel(p.url))}"${site === 'Live site' ? ` aria-label="${esc(`${p.name} live site`)}"` : ''}><span>${esc(site)}</span></a>` : ''}</div>
</article>`
}

const group = (wave: string, title: string, ps: IProjectSeo[]) =>
  `<h3 class="group" data-play-wave="${wave}">${esc(title)} <small>${ps.length}</small></h3>
<div class="cards">
${ps.map(card).join('\n')}
</div>`

// #region Play data: what the side canvas drops in while each section is read
const tile = (t: string, tone: TTone, extra: Partial<TTile> = {}): TTile => ({ t, k: 'chip', tone, ...extra })
const yearOf = (s: string) => s.match(/\d{4}/)?.[0] ?? ''
const orgOf = (s: string) => s.slice(s.lastIndexOf(', ') + 2)

const aboutPlay = (): TPlayData => {
  const liveTiles = LIVE.map((p) => tile(p.name, 'text', { dot: p.accent, live: true }))
  const [vit, school] = P.education
  const awards: TTile[] = [
    ...Array.from({ length: 4 }, (): TTile => ({ t: 'Spot', k: 'medal', tone: 'gold', r: 22 })),
    { t: 'Excellence', k: 'medal', tone: 'gold', r: 30 },
    { t: 'Loyalty', k: 'medal', tone: 'muted', r: 24 },
    tile('Six Sigma', 'live'),
    tile('Deep Learning', 'text'),
  ]
  const schooling = [tile(vit.institution, 'text'), tile(vit.grade ?? '', 'gold'), tile(school.institution, 'text')]
  const sets: Record<string, TPlaySet> = {
    profile: {
      caption: 'Profile',
      tiles: [
        { t: String(YEARS), sub: 'years', k: 'stat', tone: 'gold' },
        { t: String(PROJECTS.length), sub: 'builds', k: 'stat', tone: 'gold' },
        { t: String(LIVE.length), sub: 'live', k: 'stat', tone: 'gold' },
        { t: STORY.stats[0].value, sub: STORY.stats[0].label, k: 'stat', tone: 'gold' },
        tile('Interfaces', 'gold'),
        tile('3D and data', 'holo'),
        tile('AI', 'violet'),
        tile('Infrastructure', 'live'),
      ],
      band: liveTiles,
      bot: true,
    },
    builds: {
      caption: '01 / What he builds',
      tiles: [
        ...LIVE.map((p) => tile(p.name, 'text', { dot: p.accent, live: true, wave: 'live' })),
        ...BUILDS.map((p) => tile(p.name, 'muted', { dot: p.accent, wave: 'wip' })),
        ...AUTOS.map((p) => tile(p.name, 'text', { dot: automationsJson.find((a) => a.id === p.id)?.accent ?? p.accent, wave: 'auto' })),
      ],
    },
    how: { caption: '02 / How he works', tiles: [...A.play.how.map((t) => tile(t, 'text')), tile('his approval', 'gold', { serif: true })] },
    skills: {
      caption: '03 / Skills',
      tiles: P.skills.flatMap((s) => s.tools.map((t) => tile(t, skillTone(s.id), { wave: s.id }))),
      band: P.skills.flatMap((s) => s.tools.slice(0, 4).map((t) => tile(t, skillTone(s.id)))),
    },
    experience: {
      caption: '04 / Experience',
      tiles: [
        ...[...EARLY].reverse().map((e): TTile => ({ t: e.COMPANY, sub: yearOf(e.DURATION), k: 'plank', tone: 'text' })),
        ...[...ROLES].reverse().map((r, i, rs): TTile => ({ t: r.POSITION, sub: yearOf(r.DURATION), k: 'plank', tone: i === rs.length - 1 ? 'gold' : 'text' })),
        ...A.play.experienceMedals.map((t): TTile => ({ t, k: 'medal', tone: 'gold', r: 24 })),
      ],
    },
    record: {
      caption: '05 to 07 / Record',
      tiles: [
        ...schooling.map((x) => ({ ...x, wave: 'education' })),
        ...P.leadership.map((x) => tile(orgOf(x), 'text', { wave: 'leadership' })),
        ...awards.map((x) => ({ ...x, wave: 'awards' })),
      ],
      band: [...awards, ...schooling.slice(0, 2)],
    },
    before: {
      caption: '08 / Before software',
      tiles: [...new Set(P.collegeProjects.flatMap((c) => c.tech.split(', ')))].map((t) => tile(t, 'muted')),
    },
    faq: { caption: '09 / Questions', tiles: FAQ.map((): TTile => ({ t: '?', k: 'medal', tone: 'gold', serif: true, r: 22 })) },
    online: { caption: 'Find him online', tiles: [...P.links.map((l) => tile(l.label, 'text')), tile('Email', 'text'), tile('Website', 'text')] },
  }
  return { v: 1, mq: MQ, sets }
}

const projectPlay = (p: IProjectSeo): TPlayData => {
  const tiles = [tile(p.name, 'gold', { serif: true }), tile(TYPE_LABEL(p.category), 'muted'), ...p.stack.map((t) => tile(t, 'text', { dot: p.accent }))]
  return { v: 1, mq: MQ, sets: { stack: { caption: p.name, tiles, band: tiles, bot: true } } }
}
// #endregion

const aboutPage = (today: string, playSrc: string) => {
  const proofAt: Record<string, string> = A.proofAt
  const online = [
    ...P.links.map((l) => ({ label: l.label, href: l.href, handle: l.href.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, ''), rel: ' rel="me noopener"' })),
    { label: 'Email', href: `mailto:${P.email}`, handle: P.email, rel: '' },
    { label: 'Website', href: '/', handle: 'kshitijbhatnagar.com', rel: '' },
  ]
  const body = `<section id="profile" class="opener" data-play-set="profile">
<div class="opener__head">
<p class="eyebrow">Profile</p>
<h1 class="hero"><span>${esc(FIRST_NAME)}</span> <span class="serif">${esc(LAST_NAME.join(' '))}</span></h1>
<img class="portrait" src="/images/kshitij-bhatnagar.jpg" alt="${esc(P.name)}" width="120" height="120" decoding="async" />
</div>
<p class="lede">${esc(A.identity)}</p>
<ul class="stats">
<li><span class="stat__n">${YEARS}</span><span class="stat__l">years in software</span></li>
<li><span class="stat__n">${PROJECTS.length}</span><span class="stat__l">products and experiments</span></li>
<li><span class="stat__n">${LIVE.length}</span><span class="stat__l">live today</span></li>
<li><span class="stat__n">${esc(STORY.stats[0].value)}</span><span class="stat__l">${esc(STORY.stats[0].label)}</span></li>
</ul>
<p class="pull">${esc(A.byline)}</p>
${band('profile')}
</section>
${rail([
  ['profile', 'Profile', '00'],
  ['builds', 'What he builds', '01'],
  ['how', 'How he works', '02'],
  ['skills', 'Skills', '03'],
  ['experience', 'Experience', '04'],
  ['education', 'Education', '05'],
  ['leadership', 'Leadership', '06'],
  ['awards', 'Awards', '07'],
  ['before-software', 'Before software', '08'],
  ['faq', 'Questions', '09'],
  ['online', 'Find him online', ''],
])}
${sec(
  'builds',
  '01',
  'What he builds',
  [group('live', 'Live products', LIVE), group('wip', 'In progress and private builds', BUILDS), group('auto', 'Automations', AUTOS)].join('\n'),
  'builds',
)}
${sec('how', '02', 'How he works', `<p>${esc(A.howHeWorks)}</p>\n<p class="pull">${esc(A.howQuote)}</p>\n<p>${esc(A.howProcess)}</p>`, 'how')}
${sec(
  'skills',
  '03',
  'Skills',
  `${band('skills')}
${P.skills
  .map(
    (s, i) => `<section class="skill" data-play-wave="${esc(s.id)}">
<div><span class="skill__i">3.${i + 1}</span><h3 class="skill__t">${esc(s.title)}</h3></div>
<div>
<p class="label">In his words</p>
<p>${esc(voice(s))}</p>
${
  proofAt[s.id]
    ? `<p>Its measured results are in his <a href="${esc(proofAt[s.id])}">experience timeline</a>.</p>`
    : `<ul class="proofs">${s.proof.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
}
${chips(s.tools, `${s.title} tools`, TONE_VAR[skillTone(s.id)])}
</div>
</section>`,
  )
  .join('\n')}`,
  'skills',
)}
${sec(
  'experience',
  '04',
  'Experience',
  `<p>${esc(A.experienceLead)}</p>
<ol class="timeline">
${ROLES.map(
  (r, i) =>
    `<li class="tl${i === 0 ? ' tl--now' : ''}"><span class="tl__date">${esc(r.DURATION)}</span><h3 class="tl__role">${esc(r.POSITION)}</h3><p class="tl__type">${esc(TYPE_LABEL(r.TYPE))}</p><ul class="tl__list">${r.ACHIEVEMENTS.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></li>`,
).join('\n')}
</ol>
<h3 class="divider">Earlier internships</h3>
<ol class="timeline timeline--early">
${EARLY.map((e) => `<li class="tl"><span class="tl__date">${esc(e.DURATION)}</span><h4 class="tl__role">${esc(e.ROLE)}, ${esc(e.COMPANY)}</h4><p class="tl__type">${esc(e.FOCUS)}</p></li>`).join('\n')}
</ol>`,
  'experience',
)}
${sec(
  'education',
  '05',
  'Education',
  `<div class="duo" data-play-wave="education">
${P.education
  .map(
    (e) =>
      `<article class="edu"><h3>${esc(e.institution)}</h3><p>${esc(e.degree)}</p>${'minor' in e && e.minor ? `<p>${esc(e.minor)}</p>` : ''}<span class="edu__yrs">${esc(e.duration)}</span>${'grade' in e && e.grade ? `<span class="numchip">${esc(e.grade)}</span>` : ''}</article>`,
  )
  .join('\n')}
</div>`,
  'record',
)}
${sec(
  'leadership',
  '06',
  'Leadership',
  `<ul class="rows" data-play-wave="leadership">
${P.leadership.map((x) => `<li><span class="row__a">${esc(x.slice(0, x.lastIndexOf(', ')))}</span><span class="row__b">${esc(orgOf(x))}</span></li>`).join('\n')}
</ul>`,
  'record',
)}
${sec(
  'awards',
  '07',
  'Awards and certifications',
  `${band('record')}
<ul class="rows" data-play-wave="awards">
${achievementsJson
  .map(
    (a) =>
      `<li class="award"><h3>${esc(a.TITLE)}</h3><p>${esc(a.DESCRIPTION)}</p>${a.SUBTITLE === P.company ? '' : `<span class="row__b">${esc(a.SUBTITLE)}</span>`}</li>`,
  )
  .join('\n')}
</ul>`,
  'record',
)}
${sec(
  'before-software',
  '08',
  'Before software',
  `<div class="before">
${P.collegeProjects
  .map(
    (c) =>
      `<article class="bcard"><span class="bcard__y">${esc(c.year)}</span><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p>${chips(c.tech.split(', '), `${c.title} parts`, TONE_VAR.muted)}</article>`,
  )
  .join('\n')}
</div>`,
  'before',
)}
${sec(
  'faq',
  '09',
  'Questions and answers',
  FAQ.map((f) => `<div class="qa"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p><a class="qa__more" href="${esc(f.more[0])}">${esc(f.more[1])}</a></div>`).join('\n'),
  'faq',
)}
${sec(
  'online',
  '',
  'Find him online',
  `<ul class="online">
${online.map((l) => `<li><a href="${esc(l.href)}"${l.rel}><span>${esc(l.label)}</span><span class="online__h">${esc(l.handle)}</span></a></li>`).join('\n')}
</ul>`,
  'online',
)}`

  return page({
    path: '/about/',
    title: A.aboutTitle,
    description: A.aboutDescription,
    ogType: 'profile',
    image: OG,
    imageAlt: A.imageAlt,
    body,
    foot: `<p class="updated">Updated ${today}</p>`,
    play: { src: playSrc, data: aboutPlay() },
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ProfilePage',
          '@id': `${ABOUT}#profile`,
          url: ABOUT,
          name: A.aboutTitle,
          description: A.aboutDescription,
          inLanguage: 'en',
          dateCreated: SITE_CREATED,
          dateModified: today,
          mainEntity: { '@id': PERSON_ID },
          isPartOf: { '@id': WEBSITE_ID },
          primaryImageOfPage: { '@id': `${SITE}/#portrait` },
        },
        personNode(),
        {
          '@type': 'FAQPage',
          '@id': `${ABOUT}#faq`,
          url: `${ABOUT}#faq`,
          mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
      ],
    },
  })
}

const projectPage = (p: IProjectSeo, i: number, today: string, playSrc: string) => {
  const path = pagePath(p)
  const url = SITE + path
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length]
  const next = PROJECTS[(i + 1) % PROJECTS.length]
  const full = `${p.name} by ${P.name} | ${p.tagline}`
  const image = p.poster ? abs(p.poster) : OG
  const [spark, ...sparkRest] = p.spark.trim().split(/(?<=[.!?])\s+/)
  const body = `<section id="overview" class="opener" data-play-set="stack">
<ol class="crumbs"><li><a href="/">${esc(P.name)}</a></li><li><a href="/about/#builds">Projects</a></li><li aria-current="page">${esc(p.name)}</li></ol>
<div class="statusrow">${statusChip(p)}<span>${esc(p.year)}</span><span>${esc(TYPE_LABEL(p.category))}</span></div>
<h1 class="title">${esc(p.name)}</h1>
<p class="deck">${esc(p.tagline)}</p>
${p.poster ? `<img class="poster" src="${esc(p.poster)}" alt="${esc(`${p.name} by ${P.name}`)}" width="1280" height="800" loading="eager" fetchpriority="high" decoding="async" />\n` : ''}${band('stack')}
<p class="lede">${esc(p.summary)}</p>
<div class="cta">
${p.url ? outLink(p.url, `pill pill--solid${p.url.startsWith('/') ? '' : ' pill--out'}`, `Visit ${p.name}`) : ''}
${p.repo ? outLink(p.repo, 'pill pill--out', 'Source on GitHub') : ''}
${p.writeup ? outLink(p.writeup, 'pill pill--out', 'How it works') : ''}
<a class="pill" href="/?project=${slugOf(p.name)}">Open the interactive case study</a>
</div>
</section>
${rail([
  ['overview', 'Overview', '00'],
  ['spark', 'The spark', '01'],
  ['built', 'What was built', '02'],
  ['architecture', 'Architecture', '03'],
  ['highlights', 'Highlights', '04'],
  ['stack', 'Built with', '05'],
])}
${sec('spark', '01', 'The spark', `<p class="pull">${esc(spark)}</p>${sparkRest.length ? `\n<p>${esc(sparkRest.join(' '))}</p>` : ''}`)}
${sec('built', '02', 'What was built', `<p>${esc(p.build)}</p>`)}
${sec('architecture', '03', 'Architecture', `<ol class="steps">\n${p.architecture.map((x) => `<li>${esc(x)}</li>`).join('\n')}\n</ol>`)}
${sec('highlights', '04', 'Highlights', `<ul class="marks">\n${p.highlights.map((x) => `<li>${esc(x)}</li>`).join('\n')}\n</ul>`)}
${sec('stack', '05', 'Built with', chips(p.stack, `${p.name} stack`, p.accent), 'stack')}
<nav class="pager" aria-label="More projects">
<a href="${pagePath(prev)}" rel="prev"><small>Previous</small><strong>${esc(prev.name)}</strong></a>
<a href="${pagePath(next)}" rel="next"><small>Next</small><strong>${esc(next.name)}</strong></a>
</nav>`
  const foot = `<p>Built by <a href="/about/">${esc(P.name)}</a></p>
<ul class="links" aria-label="${esc(P.name)} online">${P.links.map((l) => `<li><a class="pill" href="${esc(l.href)}" rel="me noopener">${esc(l.label)}</a></li>`).join('')}</ul>
<p class="updated">Updated ${today}</p>`

  return page({
    path,
    title: full.length <= 65 ? full : `${p.name} by ${P.name}`,
    description: snippet(p),
    ogType: 'article',
    image,
    imageAlt: `${p.name} by ${P.name}`,
    body,
    foot,
    play: { src: playSrc, data: projectPlay(p) },
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CreativeWork',
          '@id': `${url}#work`,
          name: p.name,
          headline: p.tagline,
          description: p.summary,
          url: p.url ? abs(p.url) : url,
          image,
          dateCreated: p.year,
          keywords: p.stack.join(', '),
          creator: { '@id': PERSON_ID },
          author: { '@id': PERSON_ID },
        },
        {
          '@type': 'WebPage',
          '@id': url,
          url,
          name: full.length <= 65 ? full : `${p.name} by ${P.name}`,
          description: snippet(p),
          inLanguage: 'en',
          dateModified: today,
          mainEntity: { '@id': `${url}#work` },
          about: { '@id': PERSON_ID },
          isPartOf: { '@id': WEBSITE_ID },
          breadcrumb: { '@id': `${url}#breadcrumb` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: P.name, item: HOME },
            { '@type': 'ListItem', position: 2, name: 'Projects', item: `${ABOUT}#builds` },
            { '@type': 'ListItem', position: 3, name: p.name, item: url },
          ],
        },
        { '@type': 'Person', '@id': PERSON_ID, name: P.name, url: HOME, sameAs: P.links.map((l) => l.href) },
      ],
    },
  })
}
// #endregion

// #region Home head, sitemap and llms files
const homeJsonLd = (today: string) =>
  ld({
    '@context': 'https://schema.org',
    '@graph': [
      personNode(),
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: P.name,
        alternateName: ['Kshitij', 'kshitijbhatnagar.com'],
        url: HOME,
        publisher: { '@id': PERSON_ID },
        inLanguage: 'en',
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE}/#home`,
        url: HOME,
        name: A.title,
        description: A.metaDescription,
        inLanguage: 'en',
        about: { '@id': PERSON_ID },
        isPartOf: { '@id': WEBSITE_ID },
        primaryImageOfPage: { '@id': `${SITE}/#portrait` },
        dateModified: today,
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE}/#projects`,
        name: `Projects by ${P.name}`,
        url: HOME,
        numberOfItems: PROJECTS.length,
        itemListElement: PROJECTS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: SITE + pagePath(p) })),
      },
    ],
  })

const sitemap = (today: string) => {
  const entry = (loc: string, image?: { src: string; title: string }) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${today}</lastmod>\n${
      image
        ? `    <image:image>\n      <image:loc>${esc(image.src)}</image:loc>\n      <image:title>${esc(image.title)}</image:title>\n    </image:image>\n`
        : ''
    }  </url>`
  const me = { src: PORTRAIT, title: P.name }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    entry(HOME, me),
    entry(ABOUT, me),
    ...PROJECTS.map((p) => entry(SITE + pagePath(p), p.poster ? { src: abs(p.poster), title: p.name } : undefined)),
    '</urlset>',
    '',
  ].join('\n')
}

const llms = (full: boolean, today: string) => {
  const projectLine = (p: IProjectSeo) =>
    `- [${p.name}](${SITE}${pagePath(p)}): ${p.tagline}. ${p.live ? 'Live' : p.status}, ${p.year}.${p.url ? ` Link: ${abs(p.url)}` : ''}${p.repo ? ` Source: ${p.repo}` : ''}`
  const projectFull = (p: IProjectSeo) =>
    [
      `### ${p.name}`,
      '',
      `${p.tagline}. ${p.live ? 'Live' : p.status}, ${p.year}, ${p.category}. Page: ${SITE}${pagePath(p)}${p.url ? `. Link: ${abs(p.url)}` : ''}${AUTO_IDS.has(p.id) ? `. ${autoFacts(p.id)}` : ''}`,
      '',
      p.summary,
      '',
      `The spark: ${p.spark}`,
      '',
      `What was built: ${p.build}`,
      '',
      'Architecture:',
      ...p.architecture.map((x) => `- ${x}`),
      '',
      'Highlights:',
      ...p.highlights.map((x) => `- ${x}`),
      '',
      `Built with: ${p.stack.join(', ')}.`,
      '',
    ].join('\n')
  const out = [
    `# ${P.name}`,
    '',
    `> ${A.identity}`,
    '',
    `Last updated: ${today}`,
    '',
    `Also known as: ${A.alternateName.join(', ')}. Headline: ${A.headline}. Website: ${HOME}. About page: ${ABOUT}.`,
    '',
    '## About',
    '',
    A.identity,
    '',
    A.byline,
    '',
    `Location: ${P.location}.`,
    '',
    `## What he builds (${PROJECTS.length} projects, ${LIVE.length} live)`,
    '',
    'Taglines and project write ups are quoted in his own words.',
    '',
    '### Live products',
    '',
    ...LIVE.map(projectLine),
    '',
    '### In progress and private builds',
    '',
    ...BUILDS.map(projectLine),
    '',
    '## Automations',
    '',
    ...AUTOS.map((p) => `${projectLine(p)} ${autoFacts(p.id)}`),
    '',
    '## How he works',
    '',
    A.howHeWorks,
    '',
    A.howQuote,
    '',
    A.howProcess,
    '',
    `By the numbers: ${listText(STORY.stats.map((s) => `${s.value} ${s.label}`))}.`,
    '',
    '## Skills',
    '',
    ...P.skills.map((s) => `- ${s.title}: ${s.tools.join(', ')}. Proof: ${s.proof.join('; ')}. In his words: "${voice(s)}"`),
    '',
    '## Experience',
    '',
    A.experienceLead,
    '',
    ...ROLES.map((r) => `- ${r.POSITION} (${r.DURATION}), ${TYPE_LABEL(r.TYPE)}: ${r.ACHIEVEMENTS.join('; ')}.`),
    ...EARLY.map((e) => `- ${e.ROLE}, ${e.COMPANY} (${e.DURATION}): ${e.FOCUS}.`),
    '',
    '## Education',
    '',
    ...P.education.map((e) => `- ${educationLine(e)}.`),
    '',
    '## Leadership',
    '',
    ...P.leadership.map((x) => `- ${x}`),
    '',
    '## Awards and certifications',
    '',
    ...achievementsJson.map((a) => `- ${awardLine(a)}`),
    '',
    '## Profiles and contact',
    '',
    `- [Website](${HOME})`,
    `- [About](${ABOUT})`,
    ...P.links.map((l) => `- [${l.label}](${l.href})`),
    `- Email: ${P.email}`,
    `- [Portrait](${PORTRAIT})`,
    '',
  ]
  if (!full) return [...out, '## Optional', '', `- [Full profile with every project write up and FAQ](${SITE}/llms-full.txt)`, ''].join('\n')
  return [
    ...out,
    '## Before software',
    '',
    ...P.collegeProjects.map((c) => `- ${c.title} (${c.year}): ${c.body} Built with ${c.tech}.`),
    '',
    '## Questions and answers',
    '',
    ...FAQ.flatMap((f) => [`### ${f.q}`, '', `${f.a} More: ${ABOUT}${f.more[0]}`, '']),
    '## Project write ups',
    '',
    ...ORDERED.map(projectFull),
  ].join('\n')
}
// #endregion

// #region Automation cards
// The section cards ship only what a card shows and its bot crew acts out; node bodies, board positions, edges and the
// full run stay in automations.json, which only the lazy lab chunk imports.
const CARDS_ID = 'virtual:automation-cards'
const cardOf = (a: (typeof automationsJson)[number]) => {
  const crewIds: string[] | undefined = 'crew' in a ? a.crew : undefined
  const kept = crewIds ? a.run.filter((s) => crewIds.includes(s.node)) : a.run
  if (crewIds && kept.length !== crewIds.length) throw new Error(`automation-cards: ${a.id} crew names a step the run does not have`)
  return {
    id: a.id,
    name: a.name,
    tagline: a.tagline,
    cadence: a.cadence,
    accent: a.accent,
    status: 'status' in a ? a.status : undefined,
    note: 'note' in a ? a.note : undefined,
    writeup: 'writeup' in a ? a.writeup : undefined,
    stats: a.stats,
    stages: a.nodes.length,
    lines: a.edges.length,
    crew: {
      id: a.id,
      // a fallback that ends the run has no card version, so the crew never acts out a crash it would then ignore
      nodes: a.nodes.map((n) => {
        const fb = 'fallback' in n ? n.fallback : undefined
        return { id: n.id, kind: n.kind, label: n.label, fallback: fb && !('then' in fb) ? fb : undefined }
      }),
      // the crew has room for one human call, so only its last step keeps its ask
      run: kept.map((s, i) => ({
        node: s.node,
        log: 'card' in s && s.card ? s.card : s.log,
        branches: 'branches' in s ? s.branches : undefined,
        ask: i === kept.length - 1 && 'ask' in s ? s.ask : undefined,
      })),
    },
  }
}
const automationCards = (): Plugin => ({
  name: 'automation-cards',
  resolveId: (id) => (id === CARDS_ID ? `\0${CARDS_ID}` : undefined),
  load: (id) => (id === `\0${CARDS_ID}` ? `export default ${JSON.stringify(automationsJson.map(cardOf))}` : undefined),
})
// #endregion

// React clears this markup and paints the same DOM, so crawlers and no-JS readers get the real page, not a copy.
const prerender = async (root: string) => {
  const server = await createServer({
    root,
    configFile: false,
    plugins: [react(), automationCards()],
    appType: 'custom',
    mode: 'production',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  try {
    const { renderToString } = await import('react-dom/server')
    const { default: App } = (await server.ssrLoadModule('/src/App.tsx')) as { default: ComponentType }
    return renderToString(createElement(StrictMode, null, createElement(App)))
  } finally {
    await server.close()
  }
}

const siteSeo = (): Plugin => {
  let root = ''
  let today = new Date().toISOString().slice(0, 10)
  return {
    name: 'site-seo',
    async configResolved(config) {
      root = config.root
      today = await lastModified()
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html
          .replaceAll('{{TITLE}}', esc(A.title))
          .replaceAll('{{DESCRIPTION}}', esc(A.metaDescription))
          .replaceAll('{{OG_TITLE}}', esc(A.ogTitle))
          .replaceAll('{{IMAGE_ALT}}', esc(A.imageAlt))
          .replaceAll('{{PROJECT_COUNT}}', String(PROJECTS.length))
          .replaceAll('{{LIVE_COUNT}}', String(LIVE.length))
          .replace('<!--rel-me-->', REL_ME)
          .replace('<!--jsonld-->', homeJsonLd(today)),
    },
    generateBundle: {
      // after vite:build-html, which emits index.html in its own generateBundle
      order: 'post',
      async handler(_, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset') throw new Error('site-seo: index.html missing from the bundle')
        const markup = await prerender(root)
        // a failed build keeps the last good deploy live, which beats shipping an empty root
        if (!/<h1[^>]*>[\s\S]*Kshitij[\s\S]*<\/h1>/.test(markup)) throw new Error('site-seo: prerendered home has no h1')
        const html = index.source.toString()
        if (!html.includes('<div id="root"></div>')) throw new Error('site-seo: #root placeholder not found')
        // React emits resource hints (the hero photo preload) ahead of the tree; they work best in the head
        const hints = markup.match(/^(?:<link [^>]*\/>)*/)?.[0] ?? ''
        index.source = html
          .replace('</head>', () => `${hints}</head>`)
          .replace('<div id="root"></div>', () => `<div id="root">${markup.slice(hints.length)}</div>`)

        const play = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry && c.name === 'play')
        if (play?.type !== 'chunk') throw new Error('site-seo: the play entry chunk is missing')
        // a shared chunk would make the about and project pages download the home bundle
        if (play.imports.length > 0 || play.dynamicImports.length > 0)
          throw new Error(`site-seo: the play chunk imports ${[...play.imports, ...play.dynamicImports].join(', ')}`)

        const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
        emit('about/index.html', aboutPage(today, play.fileName))
        PROJECTS.forEach((p, i) => emit(`projects/${slugOf(p.name)}/index.html`, projectPage(p, i, today, play.fileName)))
        emit('sitemap.xml', sitemap(today))
        emit('llms.txt', llms(false, today))
        emit('llms-full.txt', llms(true, today))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), automationCards(), siteSeo()],
  build: { rollupOptions: { input: { index: 'index.html', play: 'src/play/main.ts' } } },
})
