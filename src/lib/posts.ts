import { getCollection, type CollectionEntry } from 'astro:content';
import { slug as githubSlug } from 'github-slugger';

export type Post = CollectionEntry<'posts'>;

export const postUrl = (id: string) => `/blog/${id}/`;
export const tagSlug = (tag: string) => githubSlug(tag);
export const tagUrl = (tag: string) => `/tag/${tagSlug(tag)}/`;

/** All published posts, newest first. */
export async function getPosts() {
  const all = await getCollection('posts', (p) => !p.data.draft);
  return all.sort((a, b) => +b.data.date - +a.data.date);
}

export interface TagInfo {
  slug: string;
  name: string;
  count: number;
}

/** Every tag in use, most used first. ML and ml count as one tag. */
export function allTags(posts: Post[]): TagInfo[] {
  const bySlug = new Map<string, TagInfo>();
  for (const post of posts) {
    for (const name of post.data.tags) {
      const slug = tagSlug(name);
      const info = bySlug.get(slug) ?? { slug, name, count: 0 };
      info.count++;
      bySlug.set(slug, info);
    }
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
}

export const hasTag = (post: Post, slug: string) => post.data.tags.some((t) => tagSlug(t) === slug);

const longDate = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });
export const formatDate = (d: Date) => longDate.format(d);
export const formatShort = (d: Date) => shortDate.format(d);

/** plural(5, 'article') -> '5 articles' */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---- Text helpers --------------------------------------------------------

const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const MDLINK = /\]\(\/blog\/([^/)#\s]+)\/?[^)]*\)/g;

// TeX commands worth keeping as a symbol in plain text; any other \command keeps its name.
const TEX_SYMBOLS: Record<string, string> = {
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', sim: '∼', equiv: '≡',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', iff: '⇔', mapsto: '↦',
  times: '×', cdot: '·', pm: '±', infty: '∞', in: '∈', notin: '∉', subseteq: '⊆', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', ldots: '…', dots: '…', cdots: '⋯',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', varepsilon: 'ε', epsilon: 'ε', lambda: 'λ', mu: 'μ',
  pi: 'π', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', omega: 'ω', Sigma: 'Σ', Delta: 'Δ', Omega: 'Ω',
};

/** Inline TeX -> readable text: \mathrm{BB}(5) = 47{,}176{,}870 -> BB(5) = 47,176,870 */
function texToText(tex: string) {
  return tex
    .replace(/\\(?:mathrm|mathbf|mathit|mathsf|mathtt|mathcal|mathbb|text|textrm|textbf|textit|operatorname)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\{,\}/g, ',')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, (_, name: string) => TEX_SYMBOLS[name] ?? name)
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Markdown -> plain text for previews: links become their words, markup goes away. */
export function toPlain(md: string, titleOf: (name: string) => string = (s) => s) {
  // Inline code and math are swapped for tokens first, so the markup rules below can't
  // eat the * _ < > inside them (e.g. `*<*[>]` in an italic caption), then put back.
  const kept: string[] = [];
  const keep = (s: string) => `\u0000${kept.push(s) - 1}\u0000`;
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/`([^`\n]+)`/g, (_, code: string) => keep(code))
    .replace(/(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\w$])/g, (_, tex: string) => keep(texToText(tex)))
    .replace(/^\s*\[\^[^\]]+\]:.*$/gm, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/!\[\[[^\]]*\]\]|!\[[^\]\n]*\]\([^)]*\)/g, '')
    .replace(WIKILINK, (_, name: string, alias?: string) => alias || titleOf(name))
    .replace(/\[([^\]\n]+)\]\([^)]*\)/g, '$1')
    .replace(/^\|.*\|\s*$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?(\[![^\]]+\][+-]?\s*)?/gm, '')
    .replace(/^\s*([-*+]|\d+\.)\s+(\[[ x]\]\s+)?/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|~~)(?=\S)([^]*?\S)\1/g, '$2')
    .replace(/(?<!\w)__(?=\S)([^]*?\S)__(?!\w)/g, '$1')
    // single * and _ may wrap across lines, but never across a blank line (paragraph break)
    .replace(/\*(?=\S)((?:[^*\n]|\n(?![ \t]*\n))*?\S)\*/g, '$1')
    .replace(/(?<!\w)_(?=\S)((?:[^_\n]|\n(?![ \t]*\n))*?\S)_(?!\w)/g, '$1')
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[+i])
    .replace(/\s+/g, ' ')
    .trim();
}

export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

/** Minutes to read: ~230 words a minute for prose, code read slower. */
export function readingMinutes(md: string) {
  const words = toPlain(md).split(/\s+/).filter(Boolean).length;
  const codeLines = [...md.matchAll(/```[\s\S]*?```/g)].reduce((n, m) => n + m[0].split('\n').length - 2, 0);
  return Math.max(1, Math.round(words / 230 + codeLines / 50));
}

// ---- Links between posts -------------------------------------------------

function lookup(posts: Post[]) {
  const map = new Map<string, Post>();
  for (const p of posts) {
    map.set(p.id.toLowerCase(), p);
    map.set(p.data.title.toLowerCase(), p);
    const file = p.filePath?.split('/').pop()?.replace(/\.mdx?$/, '');
    if (file) map.set(file.toLowerCase(), p);
  }
  return (name: string) => map.get(name.trim().toLowerCase()) ?? map.get(githubSlug(name.trim())) ?? null;
}

export interface Backlink {
  post: Post;
  context: string;
}

export interface Graph {
  /** id -> posts that link here, with the paragraph the link sits in */
  backlinks: Map<string, Backlink[]>;
  titleOf: (name: string) => string;
}

let graphPromise: Promise<Graph> | null = null;

/** Who links to whom, built once per build from the raw Markdown. */
export function getGraph(): Promise<Graph> {
  if (import.meta.env.DEV) graphPromise = null;
  return (graphPromise ??= (async () => {
    const posts = await getPosts();
    const find = lookup(posts);
    const titleOf = (name: string) => find(name)?.data.title ?? name;
    const backlinks = new Map<string, Backlink[]>();

    for (const post of posts) {
      const body = post.body ?? '';
      const targets = new Set<string>();
      for (const m of body.matchAll(WIKILINK)) {
        const t = find(m[1]);
        if (t) targets.add(t.id);
      }
      for (const m of body.matchAll(MDLINK)) {
        const t = posts.find((p) => p.id === decodeURIComponent(m[1]));
        if (t) targets.add(t.id);
      }
      targets.delete(post.id);

      const paragraphs = body.replace(/```[\s\S]*?```/g, '').split(/\n\s*\n/);
      for (const id of targets) {
        const para = paragraphs.find((p) => {
          for (const m of p.matchAll(WIKILINK)) if (find(m[1])?.id === id) return true;
          return p.includes(`](/blog/${id}/`) || p.includes(`](/blog/${id})`);
        });
        const list = backlinks.get(id) ?? [];
        list.push({ post, context: clip(toPlain(para ?? '', titleOf), 220) });
        backlinks.set(id, list);
      }
    }
    return { backlinks, titleOf };
  })());
}
