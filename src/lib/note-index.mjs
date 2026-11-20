// Shared helpers for finding notes by name. Used by the Astro config,
// the Markdown plugin, and the pages, so every part resolves links the same way.
import fs from 'node:fs';
import path from 'node:path';
import { slug as githubSlug } from 'github-slugger';

/** URL slug for a note file: its file name, not its folder. */
export function slugFromFile(file, data = {}) {
  if (data.slug) return String(data.slug);
  return githubSlug(path.basename(file, path.extname(file)));
}

/** Read `title:` from a Markdown file's frontmatter without a YAML parser. */
function readTitle(source) {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const line = fm[1].match(/^title:\s*(.+)$/m);
  if (!line) return null;
  return line[1].trim().replace(/^(['"])(.*)\1$/, '$2');
}

function readSlugField(source) {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const line = fm && fm[1].match(/^slug:\s*(.+)$/m);
  return line ? line[1].trim().replace(/^(['"])(.*)\1$/, '$2') : undefined;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return walk(full);
    return /\.mdx?$/.test(d.name) ? [full] : [];
  });
}

let cache = { at: 0, dir: '', map: new Map() };

/**
 * Map from every name a note can be linked by (file name, slug, title,
 * lowercased) to `{ slug, title }`. Rebuilt at most once a second so new
 * notes show up while the dev server runs.
 */
export function loadNoteIndex(dir) {
  const now = Date.now();
  if (cache.dir === dir && now - cache.at < 1000) return cache.map;
  const map = new Map();
  for (const file of walk(dir)) {
    const source = fs.readFileSync(file, 'utf8');
    const slug = slugFromFile(file, { slug: readSlugField(source) });
    const title = readTitle(source) ?? path.basename(file, path.extname(file));
    const note = { slug, title };
    const base = path.basename(file, path.extname(file));
    for (const key of [base, slug, title]) map.set(key.toLowerCase(), note);
  }
  cache = { at: now, dir, map };
  return map;
}

/** Find a note by the text inside `[[...]]`. */
export function resolveNote(map, name) {
  const key = name.trim().toLowerCase();
  return map.get(key) ?? map.get(githubSlug(key)) ?? null;
}
