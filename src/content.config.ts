import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { slugFromFile } from './lib/note-index.mjs';

const postsDir = path.resolve('./src/content/posts');

/** Fingerprint of every SVG under the posts folder (names and contents). */
function svgFingerprint(dir: string) {
  const hash = createHash('sha1');
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith('.svg')) hash.update(p).update(fs.readFileSync(p));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return hash.digest('hex');
}

// Две поправки к загрузке статей.
//
// 1. Черновики (draft: true) выкидываются сразу после загрузки коллекции. Тогда Astro не видит
//    и их картинок: без этого они попадали в dist/_astro, хотя ни одна страница на них не ссылается.
//    Сам файл остаётся на месте — в папке и в хранилище Obsidian.
//
// 2. SVG-схемы вшиваются в статью при отрисовке (inlineSvg), а Astro перерисовывает статью,
//    только когда меняется её собственный текст. Поэтому в хэш статьи подмешивается отпечаток
//    всех SVG из папки статей: поправил схему — статья перерисуется, и в сборке, и в dev сразу.
function prepare(loader: Loader): Loader {
  return {
    ...loader,
    load: async (context) => {
      let svgs = svgFingerprint(postsDir);
      const run = async (watcher: typeof context.watcher) => {
        await loader.load({
          ...context,
          watcher,
          generateDigest: (data) => context.generateDigest(typeof data === 'string' ? `${data}\n<!-- svg ${svgs} -->` : data),
        });
        for (const [id, entry] of context.store.entries()) {
          if ((entry.data as { draft?: boolean }).draft) context.store.delete(id);
        }
      };
      await run(context.watcher);
      // dev: a changed SVG re-syncs the collection (without adding more watchers)
      const onSvg = async (file: string) => {
        if (!file.toLowerCase().endsWith('.svg') || !path.resolve(file).startsWith(postsDir)) return;
        svgs = svgFingerprint(postsDir);
        await run(undefined);
        context.logger.info(`Re-rendered posts after a change to ${path.basename(file)}`);
      };
      for (const ev of ['change', 'add', 'unlink'] as const) context.watcher?.on(ev, onSvg);
    },
  };
}

// Статьи блога: src/content/posts/*.md -> /blog/<имя-файла>/
const posts = defineCollection({
  loader: prepare(
    glob({
      pattern: '**/*.{md,mdx}',
      base: './src/content/posts',
      // Адрес статьи берётся из имени файла, а не из папки:
      // статью можно переложить в другую папку, и ссылка не сломается.
      generateId: ({ entry, data }) => slugFromFile(entry, data),
    }),
  ),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      /** Хэштеги: tags: [ML, Python]. ML и ml — один тег. */
      tags: z.array(z.string()).default([]),
      /** Черновик: не попадёт на сайт. */
      draft: z.boolean().default(false),
      /** Оглавление: по умолчанию появляется, когда в статье 3 и больше разделов. */
      toc: z.boolean().optional(),
      /** Обложка карточки в /blog/ и OG-картинки: путь к картинке относительно файла статьи
       *  (cover: attachments/x.jpg). Astro подключает её сам — только у опубликованных статей. */
      cover: image().optional(),
      /** Позиция кадрирования обложки: top, center (по умолчанию), bottom. */
      coverPosition: z.enum(['top', 'center', 'bottom']).default('center'),
    }),
});

export const collections = { posts };
