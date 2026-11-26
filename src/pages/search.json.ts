import { clip, getGraph, getPosts, isoDay, postUrl, readingMinutes, toPlain } from '../lib/posts';
import { getProjects, projectUrl } from '../lib/projects';

// Small search index of articles and projects: title, url, tags, date (a project: its year),
// minutes to read, the first part of the text, and p = 1 for a project.
export async function GET() {
  const [posts, projects, { titleOf }] = await Promise.all([getPosts(), getProjects(), getGraph()]);
  const doc = (t: string, u: string, tags: string[], d: string, body: string, p?: 1) => ({
    t,
    u,
    g: tags.join(','),
    d,
    m: readingMinutes(body),
    x: clip(toPlain(body, titleOf), 6000),
    ...(p && { p }),
  });
  const docs = [
    ...posts.map((n) => doc(n.data.title, postUrl(n.id), n.data.tags, isoDay(n.data.date), n.body ?? '')),
    ...projects.map((n) => doc(n.data.title, projectUrl(n.id), n.data.tags, n.data.year, `${n.data.description}\n\n${n.body ?? ''}`, 1)),
  ];
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
