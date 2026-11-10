// Runs after `astro build`: fills the service-worker template with the complete
// precache list (every page + asset) and a version derived from it.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { stat } from 'node:fs/promises';

const DIST = 'dist';
const EXT = new Set(['.html', '.js', '.css', '.woff2', '.png', '.svg', '.webmanifest', '.json']);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'search-index' || e.name === 'qcf' || e.name === 'words') continue; // cached on demand (qcf = 98 MB of page fonts, words = 51 MB of word texts)
      out.push(...await walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

const files = (await walk(DIST)).filter((p) => EXT.has(p.slice(p.lastIndexOf('.'))));
const urls = files
  .map((p) => '/' + relative(DIST, p).split('\\').join('/'))
  .map((u) => (u.endsWith('/index.html') ? u.slice(0, -'index.html'.length) : u))
  .filter((u) => u !== '/sw.js')
  .sort();

const sizes = await Promise.all(files.map(async (p) => (await stat(p)).size));
const version = 'v' + createHash('sha256')
  .update(urls.map((u, i) => `${u}:${sizes[i]}`).join('\n'))
  .digest('hex').slice(0, 12);
const tpl = await readFile('public/sw.js', 'utf8');
const out = tpl
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace("'__PRECACHE__'", JSON.stringify(urls));
await writeFile(join(DIST, 'sw.js'), out);
console.log(`sw: ${urls.length} files precached, ${version}`);
