import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import projectsJson from './src/content/projects.json'

const SITE = 'https://kshitijbhatnagar.com'

interface IProjectSeo {
  name: string
  tagline: string
  summary: string
  category: string
  live: boolean
  url: string
  stack: string[]
}

const APP_CATEGORY: Record<string, string> = {
  'AI & Agents': 'UtilitiesApplication',
  'Tools & Automation': 'DeveloperApplication',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Crawlers and no-JS readers get the project list from projects.json, so it can never drift from the UI.
const projectsSeo = (): Plugin => ({
  name: 'projects-seo',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      const projects: IProjectSeo[] = projectsJson
      const abs = (u: string) => (u.startsWith('/') ? SITE + u : u)
      const itemList = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Projects by Kshitij Bhatnagar',
        url: SITE,
        numberOfItems: projects.length,
        itemListElement: projects.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'SoftwareApplication',
            name: p.name,
            description: p.summary,
            applicationCategory: APP_CATEGORY[p.category] ?? 'WebApplication',
            operatingSystem: 'Web',
            ...(p.url && { url: abs(p.url) }),
          },
        })),
      }
      const noscript = projects
        .map((p) => {
          const title = p.url ? `<a href="${esc(abs(p.url))}">${esc(p.name)}</a>` : esc(p.name)
          return `          <li><h3>${title}: ${esc(p.tagline)}</h3><p>${esc(p.summary)} Stack: ${esc(p.stack.join(', '))}.</p></li>`
        })
        .join('\n')
      return html
        .replaceAll('{{PROJECT_COUNT}}', String(projects.length))
        .replaceAll('{{LIVE_COUNT}}', String(projects.filter((p) => p.live).length))
        .replace('<!--projects-jsonld-->', `<script type="application/ld+json">${JSON.stringify(itemList).replace(/</g, '\\u003c')}</script>`)
        .replace('<!--projects-noscript-->', noscript)
    },
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), projectsSeo()],
})
