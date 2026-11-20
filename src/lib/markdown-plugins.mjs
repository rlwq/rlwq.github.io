// Sätteri plugins (Astro 7's Markdown engine). Each one is small and does one job:
//   wikilinks       [[name]] / [[name|text]] -> link to the article
//   callouts        > [!note] Title  -> a framed box
//   math            $inline$ and $$display$$ -> KaTeX
//   headingAnchors  ids + a "#" link on every h2–h4
//   codeBlocks      a header over each code block: language or file name, and a copy button
//   sidenotes       footnotes -> notes in the margin
//   figures         an image with an italic line under it -> <figure> + <figcaption>
//   tailwindClasses Tailwind classes on every element (src/styles/markdown-classes.mjs); runs last
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger, { slug as githubSlug } from 'github-slugger';
import katex from 'katex';
import { loadNoteIndex, resolveNote } from './note-index.mjs';

const text = (value) => ({ type: 'text', value });
const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const classes = (node) => {
  const c = node.properties?.className ?? node.properties?.class ?? [];
  return Array.isArray(c) ? c.map(String) : String(c).split(/\s+/);
};

// ---- [[wikilinks]] --------------------------------------------------------

// Links that are clearly not an article name: external, absolute, anchors, relative files.
const NOT_A_NOTE = /^([a-z][a-z0-9+.-]*:|\/|#|\.|\?)/i;

export function wikilinks({ notesDir, base }) {
  return {
    name: 'blog-wikilinks',
    element: {
      filter: ['a'],
      visit(node, ctx) {
        const href = node.properties?.href;
        if (typeof href !== 'string' || NOT_A_NOTE.test(href)) return;

        const [rawName, rawHeading] = href.split('#');
        const name = decodeURIComponent(rawName);
        const heading = rawHeading ? decodeURIComponent(rawHeading) : '';
        const label = ctx.textContent(node);
        const hasAlias = label !== (heading ? `${name}#${heading}` : name);

        const note = resolveNote(loadNoteIndex(notesDir), name);
        if (!note) {
          // Not written yet: keep the words, drop the link.
          ctx.replaceNode(
            node,
            el('span', { className: ['link-missing'], title: 'Not written yet' }, hasAlias ? node.children : [text(name)]),
          );
          return;
        }

        const anchor = heading ? '#' + githubSlug(heading) : '';
        const shown = hasAlias ? node.children : [text(heading ? `${note.title} › ${heading}` : note.title)];
        ctx.replaceNode(node, el('a', { href: `${base}${note.slug}/${anchor}`, className: ['internal-link'] }, shown));
      },
    },
  };
}

// ---- > [!note] callouts ---------------------------------------------------

const KINDS = {
  note: ['note', 'Note'],
  info: ['note', 'Info'],
  example: ['note', 'Example'],
  question: ['note', 'Question'],
  tip: ['tip', 'Tip'],
  important: ['tip', 'Important'],
  success: ['tip', 'Success'],
  warning: ['warning', 'Warning'],
  caution: ['warning', 'Caution'],
  danger: ['danger', 'Danger'],
  error: ['danger', 'Error'],
  bug: ['danger', 'Bug'],
  quote: ['quote', 'Quote'],
};

export function callouts() {
  return {
    name: 'blog-callouts',
    element: {
      filter: ['blockquote'],
      visit(node, ctx) {
        const blocks = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
        const first = blocks[0];
        if (first?.type !== 'element' || first.tagName !== 'p') return;
        const head = first.children[0];
        if (head?.type !== 'text') return;
        const m = head.value.match(/^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)\n?/);
        if (!m) return;

        const [kind, defaultTitle] = KINDS[m[1].toLowerCase()] ?? KINDS.note;
        const rest = head.value.slice(m[0].length);
        const firstBody = [...(rest ? [text(rest)] : []), ...first.children.slice(1)];
        const hasFirstBody = firstBody.some((c) => c.type !== 'text' || c.value.trim());

        ctx.replaceNode(
          node,
          el('aside', { className: ['callout', `callout-${kind}`], role: 'note' }, [
            el('p', { className: ['callout-title'] }, [text(m[2].trim() || defaultTitle)]),
            ...(hasFirstBody ? [el('p', {}, firstBody)] : []),
            ...blocks.slice(1),
          ]),
        );
      },
    },
  };
}

// ---- $math$ ---------------------------------------------------------------

function tex(source, displayMode) {
  return katex.renderToString(source, { displayMode, throwOnError: false, strict: 'ignore' });
}

export function math() {
  return {
    name: 'blog-math',
    element: {
      filter: ['pre', 'code'],
      visit(node, ctx) {
        if (node.tagName === 'pre') {
          const code = node.children?.find((c) => c.type === 'element' && c.tagName === 'code');
          if (!code || !classes(code).includes('math-display')) return;
          ctx.replaceNode(node, el('div', { className: ['math-display'] }, [{ type: 'raw', value: tex(ctx.textContent(code), true) }]));
          return;
        }
        if (classes(node).includes('math-inline')) {
          ctx.replaceNode(node, el('span', { className: ['math-inline'] }, [{ type: 'raw', value: tex(ctx.textContent(node), false) }]));
        }
      },
    },
  };
}

// ---- Heading ids and "#" links -------------------------------------------

export function headingAnchors() {
  // A factory, so every article gets its own slugger (ids restart per page).
  // Astro keeps an id that is already set, so the table of contents uses these.
  return () => {
    const slugger = new GithubSlugger();
    return {
      name: 'blog-heading-anchors',
      element: {
        filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        visit(node, ctx) {
          const existing = node.properties?.id;
          const id = typeof existing === 'string' ? existing : slugger.slug(ctx.textContent(node));
          ctx.setProperty(node, 'id', id);
          if (['h2', 'h3', 'h4'].includes(node.tagName)) {
            ctx.appendChild(node, el('a', { className: ['heading-anchor'], href: `#${id}`, ariaLabel: 'Link to this section' }));
          }
        },
      },
    };
  };
}

// ---- Code block header ----------------------------------------------------

const PLAIN = new Set(['plaintext', 'text', 'txt', 'plain']);

/** Shiki transformer: ```py title="model.py"``` -> data-title="model.py" on the <pre>. */
export const codeTitle = {
  name: 'blog-code-title',
  pre(node) {
    const raw = this.options.meta?.__raw ?? '';
    const m = raw.match(/(?:title|file)=(?:"([^"]+)"|'([^']+)'|(\S+))/);
    if (m) node.properties['data-title'] = m[1] ?? m[2] ?? m[3];
  },
};

export function codeBlocks() {
  return {
    name: 'blog-code-blocks',
    element: {
      filter: ['pre'],
      visit(node, ctx) {
        if (!classes(node).includes('astro-code')) return;
        const lang = String(node.properties?.dataLanguage ?? '');
        const title = node.properties?.dataTitle ?? node.properties?.['data-title'];
        const label = title ? String(title) : PLAIN.has(lang) ? '' : lang;
        ctx.wrapNode(
          node,
          el('div', { className: ['code-block'] }, [
            el('div', { className: ['code-bar'] }, [
              el('span', { className: [title ? 'code-title' : 'code-label'] }, label ? [text(label)] : []),
              el('button', { type: 'button', className: ['code-copy'], dataCopyCode: '' }, [text('Copy')]),
            ]),
          ]),
        );
      },
    },
  };
}

// ---- Footnotes -> sidenotes ----------------------------------------------

export function sidenotes() {
  return {
    name: 'blog-sidenotes',
    after(root, ctx) {
      let section = null;
      const refs = [];
      const find = (node) => {
        if (node.type !== 'element' && node.type !== 'root') return;
        if (node.type === 'element') {
          if (node.tagName === 'section' && node.properties?.dataFootnotes) {
            section = node;
            return;
          }
          if (node.tagName === 'sup') {
            const a = node.children?.find((c) => c.type === 'element' && c.properties?.dataFootnoteRef);
            if (a) {
              refs.push({ sup: node, id: String(a.properties.href).replace(/^#user-content-fn-/, ''), n: ctx.textContent(a) });
              return;
            }
          }
        }
        for (const child of node.children ?? []) find(child);
      };
      find(root);
      if (!section) return;

      // Footnote id -> inline content (paragraphs joined by line breaks, back-arrow removed).
      const bodies = new Map();
      const list = section.children.find((c) => c.type === 'element' && c.tagName === 'ol');
      for (const li of list?.children ?? []) {
        if (li.type !== 'element') continue;
        const id = String(li.properties.id ?? '').replace(/^user-content-fn-/, '');
        const parts = [];
        for (const block of li.children) {
          if (block.type !== 'element') continue;
          const inner = (block.tagName === 'p' ? block.children : [block]).filter(
            (c) => !(c.type === 'element' && c.properties?.dataFootnoteBackref !== undefined),
          );
          while (inner.length && inner.at(-1).type === 'text' && !inner.at(-1).value.trim()) inner.pop();
          const last = inner.at(-1);
          if (last?.type === 'text') inner[inner.length - 1] = text(last.value.trimEnd());
          if (parts.length) parts.push(el('br', {}));
          parts.push(...inner);
        }
        bodies.set(id, parts);
      }

      for (const { sup, id, n } of refs) {
        ctx.replaceNode(sup, [
          el('sup', { className: ['sidenote-ref'] }, [text(n)]),
          el('span', { className: ['sidenote'], role: 'note' }, [
            el('span', { className: ['sidenote-n'] }, [text(n)]),
            text(' '),
            ...(bodies.get(id) ?? []),
          ]),
        ]);
      }
      ctx.removeNode(section);
    },
  };
}

// ---- Inline local SVGs ----------------------------------------------------

/**
 * Inlines local `.svg` images (`![...](./attachments/foo.svg)`) so they stay
 * crisp vector graphics and inherit the site's CSS theme variables.
 */
export function inlineSvg({ notesDir }) {
  return () => {
    let seq = 0;
    return {
      name: 'blog-inline-svg',
      element: {
        filter: ['img'],
        visit(node, ctx) {
          const rawSrc = node.properties?.src;
          if (typeof rawSrc !== 'string' || !/\.svg$/i.test(rawSrc) || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(rawSrc)) return;
          const src = decodeURI(rawSrc);
          const baseDir = ctx.fileURL ? path.dirname(fileURLToPath(ctx.fileURL)) : notesDir;
          const file = path.resolve(baseDir, src);
          if (!fs.existsSync(file)) return;

          let svg = fs.readFileSync(file, 'utf8').replace(/^\s*<\?xml[\s\S]*?\?>\s*/i, '').trim();
          const prefix = `svg-${seq++}-`;
          const ids = new Set();
          svg = svg.replace(/\bid="([^"]+)"/g, (_, id) => {
            ids.add(id);
            return `id="${prefix}${id}"`;
          });
          if (ids.size) {
            svg = svg.replace(/\burl\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${prefix}${id})` : m));
            svg = svg.replace(/\b((?:xlink:)?href)="#([^"]+)"/g, (m, attr, id) => (ids.has(id) ? `${attr}="#${prefix}${id}"` : m));
          }

          ctx.data?.astro?.localImagePaths?.delete(src);
          ctx.replaceNode(node, el('div', { className: ['svg-figure'] }, [{ type: 'raw', value: svg }]));
        },
      },
    };
  };
}

// ---- Images with captions -------------------------------------------------

/** A paragraph holding only an image or inline SVG (and an italic line under it) becomes a figure. */
export function figures() {
  return {
    name: 'blog-figures',
    element: {
      filter: ['p'],
      visit(node, ctx) {
        const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
        const [img, caption, ...rest] = kids;
        const isMedia = img?.type === 'element' && (img.tagName === 'img' || classes(img).includes('svg-figure'));
        if (!isMedia || rest.length) return;
        if (caption && !(caption.type === 'element' && caption.tagName === 'em')) return;
        const figProps = {};
        let media = img;
        if (img.tagName === 'img' && img.properties?.title === 'plate') {
          const { title: _title, ...imgProps } = img.properties;
          media = el('img', imgProps);
          figProps.className = ['figure-plate'];
        }
        ctx.replaceNode(node, el('figure', figProps, [media, ...(caption ? [el('figcaption', {}, caption.children)] : [])]));
      },
    },
  };
}

// ---- Tailwind classes -----------------------------------------------------

/**
 * Puts Tailwind classes from `map` on every element. Rule order for one element:
 * its own classes made by the plugins above ('.callout', ...) if any are in the
 * map, else 'parent tag' ('li p'), else 'tag' ('p').
 */
export function tailwindClasses(map) {
  return {
    name: 'blog-tailwind-classes',
    after(root, ctx) {
      const walk = (node, parentTag) => {
        if (node.type === 'element') {
          const own = node.properties?.className || node.properties?.class ? classes(node) : [];
          const byClass = own.filter((c) => map['.' + c] !== undefined).map((c) => map['.' + c]);
          const rule = byClass.length ? byClass.join(' ') : (map[`${parentTag} ${node.tagName}`] ?? map[node.tagName] ?? '');
          const add = rule.split(/\s+/).filter(Boolean);
          if (add.length) {
            // Shiki writes `class` as a string; writing `className` next to it would be ignored.
            if (typeof node.properties?.class === 'string') ctx.setProperty(node, 'class', [...own, ...add].join(' '));
            else ctx.setProperty(node, 'className', [...own, ...add]);
          }
        }
        const tag = node.type === 'element' ? node.tagName : parentTag;
        for (const child of node.children ?? []) walk(child, tag);
      };
      walk(root, '');
    },
  };
}
