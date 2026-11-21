import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { slugFromFile } from './lib/note-index.mjs';

// Черновики (draft: true) выкидываются сразу после загрузки коллекции. Тогда Astro не видит
// и их картинок: без этого они попадали в dist/_astro, хотя ни одна страница на них не ссылается.
// Сам файл остаётся на месте — в папке и в хранилище Obsidian.
function withoutDrafts(loader: Loader): Loader {
  return {
    ...loader,
    load: async (context) => {
      await loader.load(context);
      for (const [id, entry] of context.store.entries()) {
        if ((entry.data as { draft?: boolean }).draft) context.store.delete(id);
      }
    },
  };
}

// Статьи блога: src/content/posts/*.md -> /blog/<имя-файла>/
const posts = defineCollection({
  loader: withoutDrafts(
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
