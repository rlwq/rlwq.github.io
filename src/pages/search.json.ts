import { clip, getGraph, getPosts, isoDay, postUrl, readingMinutes, toPlain } from '../lib/posts';

// Small search index: title, url, tags, date, minutes to read and the first part of the text.
export async function GET() {
  const posts = await getPosts();
  const { titleOf } = await getGraph();
  const docs = posts.map((n) => ({
    t: n.data.title,
    u: postUrl(n.id),
    g: n.data.tags.join(' '),
    d: isoDay(n.data.date),
    m: readingMinutes(n.body ?? ''),
    x: clip(toPlain(n.body ?? '', titleOf), 6000),
  }));
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
