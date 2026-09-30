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
  stack: string[]
  poster?: string
  // meta description for projects whose first summary sentence runs past 160 chars
  description?: string
}

interface IFaq {
  q: string
  a: string
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
// profile.intro and claude-story.json restated in the third person, so AI answers can quote them as written
const INTRO = `He turns ideas into live products: the interface, the 3D, the AI and the infrastructure underneath. He has spent ${YEARS} years in enterprise frontend engineering by day, and runs a studio of shipped side products by night.`
const PRACTICE = `He directs AI the way a staff engineer directs a team: the judgment stays his, the speed comes from the machine. His way of working is built on Anthropic's own agentic engineering practices, which is how he takes an idea to a live, real world product faster than a traditional build. By the numbers: ${listText(STORY.stats.map((s) => `${s.value} ${s.label}`))}.`
const TYPE_LABEL = (t: string) => t.replace(/ & /g, ' and ')
const autoFacts = (id: string) => {
  const a = automationsJson.find((x) => x.id === id)
  return a ? `Runs ${a.cadence}. ${listText(a.stats.map((s) => `${s.value}${s.label.startsWith('%') ? '' : ' '}${s.label}`))}.` : ''
}

const COMPOSED: Record<string, string> = {
  identity: A.identity,
  howHeWorks: `${A.howHeWorks} ${PRACTICE}`,
  projects: [
    `Kshitij Bhatnagar has designed and built ${PROJECTS.length} products and experiments.`,
    `Live products: ${LIVE.map((p) => `${p.name} (${p.tagline})`).join('; ')}.`,
    `In progress and private builds: ${listText(BUILDS.map((p) => p.name))}.`,
    `Automations: ${listText(AUTOS.map((p) => p.name))}.`,
  ].join(' '),
  skills: [
    `Kshitij Bhatnagar works across ${P.skills.length} areas.`,
    ...P.skills.map((s) => `${s.title}: ${listText(s.tools)}.`),
  ].join(' '),
  education: `Kshitij Bhatnagar studied at ${P.education
    .map((e) => `${e.institution}: ${educationLine(e).replace(`, ${e.institution}`, '')}`)
    .join('. Before that he studied at ')}.`,
  contact: `Email Kshitij Bhatnagar at ${P.email}, message him on LinkedIn at ${P.links[0].href}, or visit kshitijbhatnagar.com.`,
}
const FAQ: IFaq[] = A.faq.map((f) => ({ q: f.q, a: 'a' in f && f.a ? f.a : COMPOSED[f.compose ?? ''] }))

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
const CSS = `:root{--bg:#0b0a09;--text:#f2ebe1;--muted:#a89e92;--gold:#f0b44c;--line:rgba(255,240,225,.1);--line-strong:rgba(255,240,225,.22);--sans:'Geist',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;--serif:'Instrument Serif',Georgia,serif;--mono:'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace}
*{box-sizing:border-box}html{color-scheme:dark;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:400 17px/1.65 var(--sans);overflow-wrap:anywhere}
.wrap{max-width:760px;margin:0 auto;padding:0 16px}
a{color:var(--gold);text-underline-offset:3px}a:hover{color:var(--text)}
a:focus-visible{outline:2px solid var(--gold);outline-offset:3px;border-radius:2px}
.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px 24px;padding:20px 0;border-bottom:1px solid var(--line)}
.brand{font:400 24px/1 var(--serif);color:var(--text);text-decoration:none}
.top nav{display:flex;gap:20px;font:500 12px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase}
.top nav a{color:var(--muted);text-decoration:none}.top nav a:hover{color:var(--gold)}
h1{font:400 clamp(48px,12vw,84px)/1 var(--serif);letter-spacing:-.01em;margin:40px 0 16px}
h2{font:400 clamp(28px,6vw,36px)/1.15 var(--serif);margin:56px 0 12px;padding-top:28px;border-top:1px solid var(--line)}
h3{font-size:18px;font-weight:600;line-height:1.35;margin:28px 0 6px}
p{margin:0 0 16px}ul{padding-left:20px;margin:0 0 16px}li{margin:6px 0}
.muted,.meta{color:var(--muted)}.lede{font-size:clamp(18px,4.4vw,21px);line-height:1.55}
.eyebrow{font:500 12px/1.5 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin:0 0 4px}
.id{display:flex;flex-wrap:wrap;align-items:center;gap:16px 24px;margin:8px 0 28px}
.portrait{display:block;width:160px;height:160px;border-radius:50%;object-fit:cover;border:1px solid rgba(240,180,76,.5)}
.tags{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.tags li{margin:0;padding:3px 12px;border:1px solid var(--line-strong);border-radius:999px;font:13px/1.6 var(--mono);color:var(--muted)}
blockquote{margin:0 0 16px;padding-left:16px;border-left:2px solid var(--gold);color:var(--muted)}
.crumbs{list-style:none;padding:0;margin:28px 0 0;display:flex;flex-wrap:wrap;gap:8px;font:13px/1.5 var(--mono);color:var(--muted)}
.crumbs li{margin:0}.crumbs li+li::before{content:"/";margin-right:8px}
.poster{display:block;width:100%;height:auto;border-radius:12px;border:1px solid var(--line);margin:28px 0}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin:32px 0}
.btn{display:inline-block;padding:10px 18px;border:1px solid var(--line-strong);border-radius:999px;text-decoration:none}
.btn--solid{background:var(--gold);border-color:var(--gold);color:var(--bg)}.btn--solid:hover{color:var(--bg);background:var(--text)}
.links{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.links li{margin:0}.links a{display:inline-block;padding:4px 12px;border:1px solid var(--line-strong);border-radius:999px;font-size:14px;text-decoration:none}
.pager{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px;margin-top:56px;padding-top:20px;border-top:1px solid var(--line)}
.more{margin-top:28px}
footer{margin:64px 0 40px;color:var(--muted);font:13px/1.6 var(--mono)}`

interface IPage {
  path: string
  title: string
  description: string
  ogType: 'profile' | 'website' | 'article'
  image: string
  imageAlt: string
  jsonld: object
  body: string
}

const REL_ME = P.links.map((l) => `<link rel="me" href="${esc(l.href)}" />`).join('\n    ')

const page = (o: IPage) => `<!DOCTYPE html>
<html lang="en">
  <head>
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
    <div class="wrap">
      <header class="top">
        <a class="brand" href="/">${esc(P.name)}</a>
        <nav aria-label="Site"><a href="/about/">About</a><a href="/#work">Work</a><a href="/#contact">Contact</a></nav>
      </header>
      <main>
${o.body}
      </main>
    </div>
  </body>
</html>
`

const profileLinks = (withEmail: boolean) =>
  `<ul class="links" aria-label="${esc(P.name)} online">${P.links
    .map((l) => `<li><a href="${esc(l.href)}" rel="me noopener">${esc(l.label)}</a></li>`)
    .join('')}${withEmail ? `<li><a href="mailto:${esc(P.email)}">Email</a></li>` : ''}</ul>`

const linkTo = (u: string, label: string) =>
  `<a href="${esc(u)}"${u.startsWith('/') ? '' : ' rel="noopener"'}>${esc(label)}</a>`

const projectItem = (p: IProjectSeo, withTagline = true) =>
  `<li><a href="${pagePath(p)}">${esc(p.name)}</a>${withTagline ? `: ${esc(p.tagline)}.` : '.'} <span class="meta">${esc(p.live ? 'Live' : p.status)}, ${esc(p.year)}.</span>${p.url ? ` ${linkTo(p.url, `Visit ${hostLabel(p.url)}`)}` : ''}</li>`

const aboutPage = (today: string) => {
  const body = `
<article>
<h1>${esc(P.name)}</h1>
<div class="id">
  <img class="portrait" src="/images/kshitij-bhatnagar.jpg" alt="${esc(P.name)}" width="160" height="160" />
  <div>
    <p class="eyebrow">${esc(A.headline)}</p>
    <p class="muted">${esc(P.location)}</p>
    ${profileLinks(true)}
  </div>
</div>
<p class="lede">${esc(A.identity)}</p>
<p>${esc(INTRO)}</p>
<p>He has built ${PROJECTS.length} products and experiments, ${LIVE.length} of them live. Each one has its own page below with the problem it solves, how it was built and the stack.</p>

<h2 id="builds">What he builds</h2>
<h3>Live products</h3>
<ul>
${LIVE.map((p) => projectItem(p)).join('\n')}
</ul>
<h3>In progress and private builds</h3>
<ul>
${BUILDS.map((p) => projectItem(p)).join('\n')}
</ul>
<h3>Automations</h3>
<ul>
${AUTOS.map((p) => projectItem(p).replace(/<\/li>$/, ` ${esc(autoFacts(p.id))}</li>`)).join('\n')}
</ul>

<h2 id="how">How he works</h2>
<p>${esc(A.howHeWorks)}</p>
<p>${esc(PRACTICE)}</p>

<h2 id="skills">Skills</h2>
${P.skills
  .map(
    (s) => `<h3>${esc(s.title)}</h3>
<blockquote><p>${esc(s.body)}</p></blockquote>
<ul>
${s.proof.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>
<ul class="tags" aria-label="${esc(s.title)} tools">${s.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`,
  )
  .join('\n')}

<h2 id="experience">Experience</h2>
<p>${esc(A.experienceLead)}</p>
${ROLES.map(
  (r) => `<h3>${esc(r.POSITION)}, ${esc(r.DURATION)}</h3>
<p class="meta">${esc(TYPE_LABEL(r.TYPE))}</p>
<ul>
${r.ACHIEVEMENTS.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>`,
).join('\n')}
<h3>Earlier internships</h3>
<ul>
${EARLY.map((e) => `<li>${esc(e.ROLE)}, ${esc(e.COMPANY)}, ${esc(e.DURATION)}: ${esc(e.FOCUS)}.</li>`).join('\n')}
</ul>

<h2 id="education">Education</h2>
<ul>
${P.education.map((e) => `<li>${esc(educationLine(e))}.</li>`).join('\n')}
</ul>

<h2 id="leadership">Leadership</h2>
<ul>
${P.leadership.map((x) => `<li>${esc(x)}</li>`).join('\n')}
</ul>

<h2 id="awards">Awards and certifications</h2>
<ul>
${achievementsJson.map((a) => `<li>${esc(awardLine(a))}</li>`).join('\n')}
</ul>

<h2 id="before-software">Before software</h2>
<ul>
${P.collegeProjects.map((c) => `<li><strong>${esc(c.title)}</strong> (${esc(c.year)}): ${esc(c.body)} Built with ${esc(c.tech)}.</li>`).join('\n')}
</ul>

<h2 id="faq">Questions and answers</h2>
${FAQ.map((f) => `<h3>${esc(f.q)}</h3>\n<p>${esc(f.a)}</p>`).join('\n')}

<h2 id="online">Find him online</h2>
<ul>
${P.links.map((l) => `<li>${esc(l.label)}: <a href="${esc(l.href)}" rel="me noopener">${esc(l.href.replace(/^https:\/\/(www\.)?/, ''))}</a></li>`).join('\n')}
<li>Email: <a href="mailto:${esc(P.email)}">${esc(P.email)}</a></li>
<li>Website: <a href="/">kshitijbhatnagar.com</a></li>
</ul>
</article>
<footer>Updated ${today}</footer>`

  return page({
    path: '/about/',
    title: A.aboutTitle,
    description: A.aboutDescription,
    ogType: 'profile',
    image: OG,
    imageAlt: A.imageAlt,
    body,
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

const projectPage = (p: IProjectSeo, i: number, today: string) => {
  const path = pagePath(p)
  const url = SITE + path
  const prev = PROJECTS[(i - 1 + PROJECTS.length) % PROJECTS.length]
  const next = PROJECTS[(i + 1) % PROJECTS.length]
  const full = `${p.name} by ${P.name} | ${p.tagline}`
  const image = p.poster ? abs(p.poster) : OG
  const list = (xs: string[]) => `<ul>\n${xs.map((x) => `<li>${esc(x)}</li>`).join('\n')}\n</ul>`
  const body = `
<article>
<ol class="crumbs"><li><a href="/">${esc(P.name)}</a></li><li><a href="/about/#builds">Projects</a></li><li aria-current="page">${esc(p.name)}</li></ol>
<h1>${esc(p.name)}</h1>
<p class="lede">${esc(p.tagline)}</p>
<p class="meta">${esc(p.live ? 'Live' : p.status)}, ${esc(p.year)}, ${esc(p.category)}</p>
<p>Built by <a href="/">${esc(P.name)}</a></p>
${profileLinks(false)}
${p.poster ? `<img class="poster" src="${esc(p.poster)}" alt="${esc(`${p.name} by ${P.name}`)}" width="1280" height="800" loading="lazy" decoding="async" />` : ''}
<p>${esc(p.summary)}</p>
<h2>The spark</h2>
<p>${esc(p.spark)}</p>
<h2>What was built</h2>
<p>${esc(p.build)}</p>
<h2>Architecture</h2>
${list(p.architecture)}
<h2>Highlights</h2>
${list(p.highlights)}
<h2>Built with</h2>
<ul class="tags">${p.stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
<div class="cta">
${p.url ? `<a class="btn btn--solid" href="${esc(p.url)}"${p.url.startsWith('/') ? '' : ' rel="noopener"'}>Visit ${esc(p.name)}</a>` : ''}
${p.repo ? `<a class="btn" href="${esc(p.repo)}" rel="noopener">Source on GitHub</a>` : ''}
${p.writeup ? `<a class="btn" href="${esc(p.writeup)}" rel="noopener">How it works</a>` : ''}
<a class="btn" href="/?project=${slugOf(p.name)}">Open the interactive case study</a>
</div>
<nav class="pager" aria-label="More projects">
<a href="${pagePath(prev)}" rel="prev">Previous: ${esc(prev.name)}</a>
<a href="${pagePath(next)}" rel="next">Next: ${esc(next.name)}</a>
</nav>
<p class="more"><a href="/about/">More about ${esc(P.name)}</a></p>
</article>
<footer>Updated ${today}</footer>`

  return page({
    path,
    title: full.length <= 65 ? full : `${p.name} by ${P.name}`,
    description: snippet(p),
    ogType: 'article',
    image,
    imageAlt: `${p.name} by ${P.name}`,
    body,
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
    INTRO,
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
    PRACTICE,
    '',
    '## Skills',
    '',
    ...P.skills.map((s) => `- ${s.title}: ${s.tools.join(', ')}. Proof: ${s.proof.join('; ')}. In his words: "${s.body}"`),
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
    ...FAQ.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Project write ups',
    '',
    ...ORDERED.map(projectFull),
  ].join('\n')
}
// #endregion

// React clears this markup and paints the same DOM, so crawlers and no-JS readers get the real page, not a copy.
const prerender = async (root: string) => {
  const server = await createServer({
    root,
    configFile: false,
    plugins: [react()],
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

        const emit = (fileName: string, source: string) => this.emitFile({ type: 'asset', fileName, source })
        emit('about/index.html', aboutPage(today))
        PROJECTS.forEach((p, i) => emit(`projects/${slugOf(p.name)}/index.html`, projectPage(p, i, today)))
        emit('sitemap.xml', sitemap(today))
        emit('llms.txt', llms(false, today))
        emit('llms-full.txt', llms(true, today))
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteSeo()],
})
