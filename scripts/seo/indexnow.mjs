// Run by hand after a deploy: node scripts/seo/indexnow.mjs. Tells Bing, Yandex and other IndexNow engines what changed.
import { readdirSync, readFileSync } from 'node:fs'

const HOST = 'kshitijbhatnagar.com'
const publicDir = new URL('../../public/', import.meta.url)
const keyFiles = readdirSync(publicDir).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (keyFiles.length !== 1) {
  console.error(`expected one IndexNow key file in public/, found ${keyFiles.length}`)
  process.exit(1)
}
const key = readFileSync(new URL(keyFiles[0], publicDir), 'utf8').trim()

const res = await fetch(`https://${HOST}/sitemap.xml`)
if (!res.ok) {
  console.error(`sitemap fetch failed: ${res.status}`)
  process.exit(1)
}
const urlList = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

const post = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFiles[0]}`, urlList }),
})
console.log(`IndexNow ${post.status} ${post.statusText} for ${urlList.length} URLs`)
if (post.status >= 300) console.log(await post.text())
