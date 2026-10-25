import profileJson from '../content/profile.json';

// Build time only: shared by vite.config.ts and the case page emitter, never shipped to a browser.

export const SITE = 'https://kshitijbhatnagar.com';
export const HOME = `${SITE}/`;
export const ABOUT = `${SITE}/about/`;
export const PERSON_ID = `${SITE}/#person`;
export const WEBSITE_ID = `${SITE}/#website`;
export const PORTRAIT = `${SITE}/images/kshitij-bhatnagar-portrait.jpg`;
export const OG = `${SITE}/og.jpg`;

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const abs = (u: string) => (u.startsWith('/') ? SITE + u : u);
export const ld = (data: object) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

// the short Person node a page carries when the full one lives on /about/
export const personRef = () => ({
  '@type': 'Person',
  '@id': PERSON_ID,
  name: profileJson.name,
  url: HOME,
  sameAs: profileJson.links.map((l) => l.href),
});
