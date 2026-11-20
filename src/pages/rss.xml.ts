import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../site.config';
import { clip, getPosts, postUrl, toPlain } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: site.title,
    description: site.description,
    site: context.site!,
    items: posts.map((note) => ({
      title: note.data.title,
      link: postUrl(note.id),
      pubDate: note.data.date,
      description: note.data.description ?? clip(toPlain(note.body ?? ''), 280),
      categories: note.data.tags,
    })),
    customData: `<language>${site.lang}</language>`,
  });
}
