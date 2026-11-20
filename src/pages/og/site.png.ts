import type { APIRoute } from 'astro';
import { renderOgImage } from '../../lib/og';
import { site } from '../../site.config';

export const GET: APIRoute = async () => {
  const png = await renderOgImage({
    title: site.title,
    subtitle: site.tagline,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': import.meta.env.DEV ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
};
