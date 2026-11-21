import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { formatDate, getPosts, readingMinutes, type Post } from '../../lib/posts';
import { renderOgImage } from '../../lib/og';

export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  const { headings } = await render(post);
  const sections = headings.filter((h) => h.depth === 2).map((h) => h.text);
  const minutes = readingMinutes(post.body ?? '');

  const png = await renderOgImage({
    kind: 'article',
    title: post.data.title,
    subtitle: formatDate(post.data.date),
    readTime: `${minutes} min read`,
    date: post.data.date.toISOString().slice(0, 10),
    minutes,
    tags: post.data.tags,
    sections,
    // the image() field carries the file's location on disk (non-enumerable fsPath)
    cover: (post.data.cover as { fsPath?: string } | undefined)?.fsPath,
    coverPosition: post.data.coverPosition,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': import.meta.env.DEV ? 'no-store' : 'public, max-age=31536000, immutable',
    },
  });
};
