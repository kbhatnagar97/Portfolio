# kshitijbhatnagar.com

Personal portfolio of Kshitij Bhatnagar, live at [kshitijbhatnagar.com](https://kshitijbhatnagar.com).

A single page built around one WebGL particle system. Sixteen thousand points morph between shapes as you scroll: an orb in the hero, then a UI wireframe, a globe, a neural network and an infrastructure stack for the four skills, a starfield behind the work, and a ring at the contact section. All content is ordinary HTML, so it stays readable, searchable and accessible without WebGL.

## Stack

React 19, TypeScript and Vite. three.js with React Three Fiber for the scene, GSAP (ScrollTrigger and SplitText) and Lenis for motion, framer-motion for the project modal, SCSS for styling.

## How it fits together

| Path | What it does |
| --- | --- |
| `src/content/projects.json` | Every project, in display order. The single source of truth for the UI, the JSON-LD and the noscript list. |
| `src/content/profile.json` | Hero copy, the four skills, education, leadership and links. |
| `src/content/professional.json`, `achievements.json`, `claude-story.json` | Experience, awards with certificate images, and the How I work section. |
| `src/site/scene/` | The particle scene. `shapes.ts` builds the point clouds, `state.ts` maps scroll position to a morph, `Scene.tsx` renders it. |
| `src/site/sections/` | One component per page section, plus the project modal and certificate lightbox. |
| `vite.config.ts` | Injects the project count, JSON-LD and noscript list into `index.html` at build time. |

Any element with `data-shape="<index>"` becomes a waypoint for the scene. The page centre is mapped onto one continuous morph between neighbouring waypoints, so there is never a jump at a section boundary.

## Adding a project

1. Add an entry to `src/content/projects.json`. Set `featured: true` to show it in the horizontal gallery.
2. Optional media goes in `public/media/`: `<id>.jpg` as the poster (16:10), `<id>.mp4` as a short muted loop, and `<id>-film.mp4` for a longer demo that plays in the project modal. Reference them with the `poster`, `video` and `film` fields.
3. Projects without media get generated cover art in their `accent` colour.

Keep loops under 10 seconds and about 1 MB: `ffmpeg -i in.mov -vf scale=960:-2 -c:v libx264 -crf 26 -preset slow -movflags +faststart -an out.mp4`.

## Case studies

`/case-studies/` and one page per case, written as static HTML at build time, so every page reads the same without JavaScript. A case is one content file and one small folder of its own code; the hero, the turn, setup steps, sources, the offer, the pager and the JSON-LD come from a shared kit.

| Path | What it does |
| --- | --- |
| `src/content/cases/<slug>.json` | One case: copy, impact numbers and their sources, and the case's own blocks. The repo is public, so sources describe evidence in public terms, never local paths or private names. |
| `src/cases/registry.ts` | The cases in display order. Each pager shows a case's two neighbours in this order. |
| `src/cases/build/` | Build time only: content checks (`content.ts`), HTML partials (`parts.ts`), the page shell, JSON-LD, sitemap and llms lines, and the Vite plugin. |
| `src/cases/shared/` | The browser kit every case page loads; `boot()` wires the shared parts by their markup. The calculator, compare and video styles are opt in with `@use` from a case's stylesheet. |
| `src/cases/<slug>/` | `page.ts` renders the story at build time, `main.ts` is the page's script and loads any heavy stage module a screen early, `case.scss` holds the case's own styles. |
| `public/case-studies/<slug>/media/` | The 1280x800 poster (JPG for sharing, a WebP twin for cards) and the page's figures, stripped of metadata. |

The content checks also refuse the names a case must never show. Those names stay out of the repo: the build reads them from `.agent/private-names.json`, which git ignores, as a JSON list of names of one to three words or `privateHash` numbers from `content.ts`. A build without that file, such as Vercel's, skips that one check and says so.

### Adding a case study

1. Add `src/content/cases/<slug>.json` with `"draft": true` and register it in `src/cases/registry.ts`. A production build refuses drafts.
2. Create `src/cases/<slug>/` with `page.ts`, `main.ts` and `case.scss`, built from the partials in `src/cases/build/parts.ts`.
3. Preview only that case: `CASE_PREVIEW=<slug> npx vite build --outDir <a folder outside dist> --emptyOutDir`, then serve the folder.
4. Fix every content error the build names, set `"draft": false`, then run `npm run build` and `node scripts/seo/check.mjs dist`.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type check and production build
npm run lint
```

Pushing to `main` deploys to Vercel. `/gaussian-visualizer` is proxied to its own Vercel project through `vercel.json`.

## License

MIT, see [LICENSE](LICENSE).
