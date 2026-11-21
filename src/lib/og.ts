// Link previews (Open Graph images, 1200×630) in the site's lamp style: an article
// looks like its card on the home page (CRT cover with the title, a dark mini-monitor
// with the contents), the site looks like the home page (About on the left, a monitor
// listing the articles on the right).
//
// Built at build time: satori lays out the text, sharp does the pixels. The cover gets
// the phosphor treatment of covers.ts but with scanlines only, no RGB triads: previews
// are shown at a third of the size, where triads would turn into moiré.

import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp, { type OverlayOptions } from 'sharp';
import { renderOgImagePlain } from './og-plain';

/** 'lamp': the CRT-style previews below. 'plain': the first design (og-plain.ts). */
const OG_STYLE = 'lamp' as 'lamp' | 'plain';

// 256-colour palette PNG: looks the same here, a quarter of the size (WhatsApp skips
// preview images over ~300 KB)
const PNG = { palette: true, colors: 256, quality: 90, effort: 10, dither: 1, compressionLevel: 9 } as const;

const W = 1200;
const H = 630;
const root = process.cwd();
const postsDir = path.join(root, 'src/content/posts');

// dark palette from global.css
const C = {
  bg: '#121212',
  card: '#171716',
  screen: '#1b1b1a',
  fg: '#e7e5e2',
  muted: '#a19e98',
  tocText: '#c7c3bc',
  line: '#3a3936',
  primary: '#f0a04b',
};

export interface OgOptions {
  kind: 'article' | 'site';
  title: string;
  /** plain style: the line under the title (date / tagline) */
  subtitle?: string;
  /** plain style: "7 min read" */
  readTime?: string;
  /** ## headings, for the contents monitor */
  sections?: string[];
  /** Cover image file: an absolute path (the image() field's fsPath) or a path relative to src/content/posts/. */
  cover?: string;
  coverPosition?: 'top' | 'center' | 'bottom';
  /** article: YYYY-MM-DD */
  date?: string;
  minutes?: number;
  tags?: string[];
  /** site: the line under the name */
  tagline?: string;
  /** site: shown with amber pixels under the tagline */
  links?: string[];
  /** site: newest first */
  articles?: { title: string; date: string }[];
}

export function renderOgImage(opts: OgOptions): Promise<Buffer> {
  if (OG_STYLE === 'plain') return renderOgImagePlain(opts);
  return opts.kind === 'site' ? siteCard(opts) : articleCard(opts);
}

/* ---- fonts -------------------------------------------------------------------- */

type Font = { name: string; data: Buffer; weight: 400 | 500; style: 'normal' };
let fonts: Font[] | null = null;
function getFonts(): Font[] {
  const file = (pkg: string, name: string) => fs.readFileSync(path.join(root, 'node_modules/@fontsource', pkg, 'files', name));
  return (fonts ??= [
    { name: 'Source Serif 4', data: file('source-serif-4', 'source-serif-4-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Source Serif 4', data: file('source-serif-4', 'source-serif-4-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'IBM Plex Mono', data: file('ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'IBM Plex Mono', data: file('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'VT323', data: file('vt323', 'vt323-latin-400-normal.woff'), weight: 400, style: 'normal' },
  ]);
}

/* ---- satori helpers ------------------------------------------------------------ */

type Style = Record<string, string | number>;
type Child = OgNode | string | null | false | undefined;
interface OgNode {
  type: 'div';
  props: { style: Style; children: (OgNode | string)[] };
}
const box = (style: Style, ...children: Child[]): OgNode => ({
  type: 'div',
  // border-box like the site's CSS (satori's default is content-box)
  props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: children.filter((c): c is OgNode | string => !!c) },
});

const MONO: Style = { fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em', textTransform: 'uppercase' };

/** the glowing amber indicator pixel used before tags and links on the site */
const pixel = (size = 7) =>
  box({ width: size, height: size, flexShrink: 0, backgroundColor: C.primary, boxShadow: '0 0 6px rgba(240,160,75,0.75)' });

const text = async (node: OgNode) =>
  Buffer.from(await satori(node as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts: getFonts() }));

/* ---- pixel effects ------------------------------------------------------------- */

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const enc = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));

/** The cover as a CRT picture: warm phosphor (as covers.ts), scanlines, a soft bloom. */
async function crtCover(file: string, w: number, h: number, position: 'top' | 'center' | 'bottom'): Promise<Buffer> {
  const gravity = { top: 'north', center: 'centre', bottom: 'south' }[position];
  const src = await sharp(file).resize(w, h, { fit: 'cover', position: gravity }).removeAlpha().raw().toBuffer();
  const n = w * h;

  // linear light; a bright picture (a chart on paper) shows its negative lightness instead
  const rgb = new Float32Array(n * 3);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = lin(src[i * 3 + c] / 255);
    sum += 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
  }
  const invert = sum / n > 0.45;
  const warm = [1.25, 1.149, 1.014];

  const SCAN = 6; // px per scanline period: big enough to survive the preview being scaled down
  const LIT = 4; // lit rows per period, the rest is the dark gap
  const GAP = 0.3; // brightness left in the gap
  const GAIN = 1.15;
  const out = Buffer.alloc(n * 3);
  for (let y = 0; y < h; y++) {
    const row = (y % SCAN < LIT ? 1 : GAP) * GAIN;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const Y = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
      for (let c = 0; c < 3; c++) {
        let v = rgb[i * 3 + c];
        if (invert) v = Math.max(0, 0.8 * (1 - Y) ** 1.5 + 1.4 * (v - Y) - 0.03);
        out[i * 3 + c] = enc(Math.min(1, v * warm[c] * row));
      }
    }
  }

  // bloom: a blurred copy screened on top, so bright parts glow over the gaps
  const raw = { raw: { width: w, height: h, channels: 3 as const } };
  const blur = await sharp(out, raw).blur(3).raw().toBuffer();
  for (let i = 0; i < out.length; i++) out[i] = 255 - Math.round(((255 - out[i]) * (255 - 0.5 * blur[i])) / 255);
  return sharp(out, raw).png().toBuffer();
}

/** Curved glass over a screen: corner vignette, a diagonal sheen and, if asked, scanlines. */
function glass(w: number, h: number, opts: { scanlines?: boolean; scrim?: boolean; radius?: number } = {}) {
  const r = opts.radius ?? 0;
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="v" cx="50%" cy="44%" r="72%">
        <stop offset="62%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
      </radialGradient>
      <linearGradient id="s" x1="0" y1="0" x2="1" y2="0.45">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.07"/>
        <stop offset="26%" stop-color="#fff" stop-opacity="0.02"/>
        <stop offset="46%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="35%" stop-color="#000" stop-opacity="0"/>
        <stop offset="70%" stop-color="#000" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
      </linearGradient>
      <pattern id="l" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect y="3" width="4" height="1" fill="#000" fill-opacity="0.22"/>
      </pattern>
      <clipPath id="c"><rect width="${w}" height="${h}" rx="${r}"/></clipPath>
    </defs>
    <g clip-path="url(#c)">
      ${opts.scrim ? `<rect width="${w}" height="${h}" fill="url(#b)"/>` : ''}
      ${opts.scanlines ? `<rect width="${w}" height="${h}" fill="url(#l)"/>` : ''}
      <rect width="${w}" height="${h}" fill="url(#v)"/>
      <rect width="${w}" height="${h}" fill="url(#s)"/>
    </g>
    <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="#000" stroke-opacity="0.45"/>
  </svg>`);
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

/** A vertical dithered line, 2px wide, solid in the middle and dithering out at both ends (as lamp.ts). */
function ditherLine(len: number, color = C.line) {
  let rects = '';
  for (let y = 0; y < len; y++) {
    const t = len === 1 ? 0.5 : y / (len - 1);
    const a = Math.min(1, Math.min(t, 1 - t) / 0.28) * 0.9;
    for (let x = 0; x < 2; x++) if (a > BAYER4[y & 3][x & 3]) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  }
  return Buffer.from(`<svg width="2" height="${len}" xmlns="http://www.w3.org/2000/svg"><g fill="${color}">${rects}</g></svg>`);
}

/* ---- article ------------------------------------------------------------------- */

async function articleCard(o: OgOptions): Promise<Buffer> {
  const sections = o.sections ?? [];
  const hasToc = sections.length > 0;
  const coverPath = o.cover ? path.resolve(postsDir, o.cover) : null;
  const hasCover = !!coverPath && fs.existsSync(coverPath);
  const coverW = hasToc ? 812 : W;
  const monX = coverW + 2; // after the 2px dithered divider

  const meta = [o.date, o.minutes ? `${o.minutes} min read` : ''].filter(Boolean);
  const titleSize = o.title.length > 44 ? 46 : o.title.length > 28 ? 54 : 62;

  // left: the title block on the cover (or on a plain card with the amber bar)
  const left = box(
    {
      position: 'absolute',
      left: 0,
      top: 0,
      width: coverW,
      height: H,
      padding: '56px 60px',
      flexDirection: 'column',
      justifyContent: hasCover ? 'flex-end' : 'space-between',
    },
    !hasCover && box({ width: 40, height: 3, backgroundColor: C.primary }),
    box(
      { flexDirection: 'column' },
      box(
        { fontFamily: 'Source Serif 4', fontWeight: 500, fontSize: titleSize, lineHeight: 1.15, letterSpacing: '-0.015em', color: '#fafaf9' },
        o.title,
      ),
      meta.length > 0 &&
        box(
          { ...MONO, marginTop: 20, fontSize: 17, color: hasCover ? 'rgba(214,211,206,0.85)' : C.muted },
          meta.join('  ·  '),
        ),
      (o.tags?.length ?? 0) > 0 &&
        box(
          { marginTop: 16, flexWrap: 'wrap', gap: 24 },
          ...(o.tags ?? []).map((t) => box({ ...MONO, alignItems: 'center', gap: 10, fontSize: 17, color: C.primary }, pixel(), t)),
        ),
    ),
  );

  // right: the contents monitor, like the card's mini-monitor on the home page
  const shown = sections.slice(0, 9);
  const right =
    hasToc &&
    box(
      {
        position: 'absolute',
        left: monX,
        top: 0,
        width: W - monX,
        height: H,
        padding: '54px 36px',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 15,
      },
      ...shown.map((s, i) =>
        box(
          { alignItems: 'baseline', gap: 14 },
          box({ fontFamily: 'VT323', fontSize: 27, lineHeight: 1, width: 30, flexShrink: 0, color: 'rgba(240,160,75,0.88)' }, String(i + 1).padStart(2, '0')),
          box({ fontFamily: 'IBM Plex Mono', fontSize: 18, lineHeight: 1.35, letterSpacing: '-0.01em', color: C.tocText }, s),
        ),
      ),
      sections.length > shown.length && box({ fontFamily: 'IBM Plex Mono', fontSize: 18, color: C.muted, paddingLeft: 44 }, '…'),
    );

  const layers: OverlayOptions[] = [];
  if (hasCover && coverPath) {
    layers.push({ input: await crtCover(coverPath, coverW, H, o.coverPosition ?? 'center'), left: 0, top: 0 });
    layers.push({ input: glass(coverW, H, { scrim: true }), left: 0, top: 0 });
  } else {
    layers.push({ input: { create: { width: coverW, height: H, channels: 4, background: C.card } }, left: 0, top: 0 });
    layers.push({ input: glass(coverW, H), left: 0, top: 0 });
  }
  if (hasToc) {
    layers.push({ input: { create: { width: W - monX, height: H, channels: 4, background: C.screen } }, left: monX, top: 0 });
    layers.push({ input: ditherLine(H), left: coverW, top: 0 });
  }
  layers.push({ input: await text(box({ width: W, height: H, position: 'relative' }, left, right)), left: 0, top: 0 });
  // the monitor's scanlines and glass go over its text, as on the site
  if (hasToc) layers.push({ input: glass(W - monX, H, { scanlines: true }), left: monX, top: 0 });

  return sharp({ create: { width: W, height: H, channels: 3, background: C.bg } })
    .composite(layers)
    .png(PNG)
    .toBuffer();
}

/* ---- site ---------------------------------------------------------------------- */

async function siteCard(o: OgOptions): Promise<Buffer> {
  const articles = (o.articles ?? []).slice(0, 5);
  // the monitor grows with the list, centred on the card
  const monH = Math.min(478, Math.max(240, 132 + articles.length * 86));
  const MON = { x: 612, y: Math.round((H - monH) / 2), w: 512, h: monH, r: 8 };

  const about = box(
    { position: 'absolute', left: 76, top: 76, width: 452, height: 478, flexDirection: 'column', justifyContent: 'center' },
    box({ ...MONO, fontSize: 15, color: C.muted }, 'About'),
    box({ marginTop: 20, fontFamily: 'Source Serif 4', fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: '-0.015em', color: C.fg }, o.title),
    o.tagline && box({ marginTop: 18, fontFamily: 'Source Serif 4', fontSize: 23, lineHeight: 1.45, color: C.muted }, o.tagline),
    (o.links?.length ?? 0) > 0 &&
      box(
        { marginTop: 30, flexDirection: 'column', gap: 12 },
        ...(o.links ?? []).map((l) => box({ fontFamily: 'IBM Plex Mono', alignItems: 'center', gap: 12, fontSize: 18, color: C.primary }, pixel(6), l)),
      ),
  );

  const monitor = box(
    { position: 'absolute', left: MON.x, top: MON.y, width: MON.w, height: MON.h, padding: '34px 36px', flexDirection: 'column' },
    // each label in its own box: satori merges sibling strings into one text run
    box(
      { ...MONO, justifyContent: 'space-between', fontSize: 14, color: C.muted },
      box({}, 'Articles'),
      box({}, `${o.articles?.length ?? 0} ${o.articles?.length === 1 ? 'article' : 'articles'}`),
    ),
    box(
      { marginTop: 28, flexDirection: 'column', gap: 22 },
      ...articles.map((a, i) =>
        box(
          { alignItems: 'baseline', gap: 14 },
          box({ fontFamily: 'VT323', fontSize: 27, lineHeight: 1, width: 30, flexShrink: 0, color: 'rgba(240,160,75,0.88)' }, String(i + 1).padStart(2, '0')),
          box(
            { flexDirection: 'column', gap: 6 },
            box({ fontFamily: 'IBM Plex Mono', fontSize: 19, lineHeight: 1.35, letterSpacing: '-0.01em', color: C.fg }, a.title),
            box({ ...MONO, fontSize: 13, color: C.muted }, a.date),
          ),
        ),
      ),
    ),
  );

  const screen = Buffer.from(
    `<svg width="${MON.w}" height="${MON.h}" xmlns="http://www.w3.org/2000/svg"><rect width="${MON.w}" height="${MON.h}" rx="${MON.r}" fill="${C.screen}"/></svg>`,
  );

  return sharp({ create: { width: W, height: H, channels: 3, background: C.bg } })
    .composite([
      { input: ditherLine(H - 120), left: 568, top: 60 },
      { input: screen, left: MON.x, top: MON.y },
      { input: await text(box({ width: W, height: H, position: 'relative' }, about, monitor)), left: 0, top: 0 },
      { input: glass(MON.w, MON.h, { scanlines: true, radius: MON.r }), left: MON.x, top: MON.y },
    ])
    .png(PNG)
    .toBuffer();
}
