import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const rootDir = process.cwd();
const postsDir = path.join(rootDir, 'src/content/posts');
const fontDir = path.join(rootDir, 'node_modules/@fontsource/source-serif-4/files');

let cachedFonts: Array<{ name: string; data: Buffer; weight: 400 | 500; style: 'normal' }> | null = null;

function getFonts() {
  if (cachedFonts) return cachedFonts;
  cachedFonts = [
    {
      name: 'Source Serif 4',
      data: fs.readFileSync(path.join(fontDir, 'source-serif-4-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Source Serif 4',
      data: fs.readFileSync(path.join(fontDir, 'source-serif-4-latin-500-normal.woff')),
      weight: 500,
      style: 'normal',
    },
  ];
  return cachedFonts;
}

const COVER_GRAVITY = {
  top: 'north',
  center: 'centre',
  bottom: 'south',
} as const;

function makeCoverScrim(hasToc: boolean) {
  const rightGrad = hasToc
    ? `<linearGradient id="right" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#161616" stop-opacity="0"/>
        <stop offset="56%" stop-color="#161616" stop-opacity="0.08"/>
        <stop offset="72%" stop-color="#161616" stop-opacity="0.72"/>
        <stop offset="100%" stop-color="#161616" stop-opacity="0.92"/>
      </linearGradient>`
    : '';
  const rightRect = hasToc ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#right)"/>` : '';
  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#161616" stop-opacity="0.06"/>
          <stop offset="48%" stop-color="#161616" stop-opacity="0.24"/>
          <stop offset="74%" stop-color="#161616" stop-opacity="0.82"/>
          <stop offset="100%" stop-color="#161616" stop-opacity="0.97"/>
        </linearGradient>
        ${rightGrad}
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottom)"/>
      ${rightRect}
    </svg>`,
  );
}

export interface OgOptions {
  title: string;
  subtitle?: string;
  readTime?: string;
  sections?: string[];
  /** Cover image file: an absolute path (the image() field's fsPath) or a path relative to src/content/posts/. */
  cover?: string;
  coverPosition?: 'top' | 'center' | 'bottom';
}

function renderTocColumn(sections: string[], hasCover: boolean) {
  const shown = sections.slice(0, 8);
  return {
    type: 'div',
    props: {
      style: {
        width: 344,
        borderLeft: hasCover ? '1px solid rgba(250, 250, 249, 0.16)' : '1px solid #2e2d2b',
        paddingLeft: 36,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 15,
      },
      children: shown.map((sec, i) => ({
        type: 'div',
        props: {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          },
          children: [
            {
              type: 'span',
              props: {
                style: {
                  color: '#f0a04b',
                  fontSize: 16,
                  fontWeight: 500,
                  width: 24,
                },
                children: String(i + 1).padStart(2, '0'),
              },
            },
            {
              type: 'span',
              props: {
                style: {
                  color: hasCover ? '#e7e5e2' : '#c7c3bc',
                  fontSize: 20,
                  lineHeight: 1.3,
                },
                children: sec,
              },
            },
          ],
        },
      })),
    },
  };
}

export async function renderOgImage(opts: OgOptions): Promise<Buffer> {
  const { title, subtitle, readTime, sections = [], cover, coverPosition = 'center' } = opts;
  const fonts = getFonts();

  const metaLine = [subtitle, readTime].filter(Boolean).join('  ·  ');
  const coverPath = cover ? path.resolve(postsDir, cover) : null;
  const hasCover = !!coverPath && fs.existsSync(coverPath);
  const hasToc = sections.length > 0;

  const titleSize = hasToc
    ? title.length > 44
      ? 44
      : 50
    : title.length > 52
      ? 52
      : title.length > 34
        ? 58
        : 66;

  const overlaySvg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: WIDTH,
          height: HEIGHT,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          padding: hasCover ? '56px 64px' : '68px 76px',
          gap: 48,
          backgroundColor: hasCover ? 'transparent' : '#161616',
          fontFamily: 'Source Serif 4',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: hasCover ? 'flex-end' : 'space-between',
              },
              children: [
                !hasCover
                  ? {
                      type: 'div',
                      props: {
                        style: {
                          width: 52,
                          height: 3,
                          backgroundColor: '#f0a04b',
                        },
                      },
                    }
                  : null,
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            fontSize: titleSize,
                            fontWeight: 500,
                            lineHeight: 1.13,
                            letterSpacing: '-0.015em',
                            color: hasCover ? '#fafaf9' : '#e7e5e2',
                          },
                          children: title,
                        },
                      },
                      metaLine
                        ? {
                            type: 'div',
                            props: {
                              style: {
                                marginTop: 22,
                                fontSize: 21,
                                fontWeight: 400,
                                lineHeight: 1.4,
                                color: hasCover ? '#d6d3ce' : '#a19e98',
                              },
                              children: metaLine,
                            },
                          }
                        : null,
                    ].filter(Boolean),
                  },
                },
              ].filter(Boolean),
            },
          },
          hasToc ? renderTocColumn(sections, hasCover) : null,
        ].filter(Boolean),
      },
    } as any,
    { width: WIDTH, height: HEIGHT, fonts },
  );

  if (hasCover && coverPath) {
    return sharp(coverPath)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: COVER_GRAVITY[coverPosition] })
      .composite([
        { input: makeCoverScrim(hasToc), top: 0, left: 0 },
        { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  return sharp(Buffer.from(overlaySvg)).png({ compressionLevel: 9 }).toBuffer();
}
