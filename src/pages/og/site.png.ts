import type { APIRoute } from 'astro';
import { renderOgImage } from '../../lib/og';
import { getPosts, isoDay } from '../../lib/posts';
import { site } from '../../site.config';

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const png = await renderOgImage({
    kind: 'site',
    title: site.title,
    subtitle: site.tagline,
    tagline: site.tagline,
    links: ['github.com/rlwq'],
    articles: posts.map((p) => ({ title: p.data.title, date: isoDay(p.data.date) })),
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': import.meta.env.DEV ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
};
