import { clip, getGraph, getPosts, postUrl, toPlain } from '../lib/posts';

// Small search index: title, url, tags and the first part of the text.
export async function GET() {
  const posts = await getPosts();
  const { titleOf } = await getGraph();
  const docs = posts.map((n) => ({
    t: n.data.title,
    u: postUrl(n.id),
    g: n.data.tags.join(' '),
    x: clip(toPlain(n.body ?? '', titleOf), 6000),
  }));
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
