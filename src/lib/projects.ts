import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

export const projectUrl = (id: string) => `/projects/${id}/`;

export function projectCaption(project: Project) {
  if (project.data.caption) return project.data.caption;
  const raw = project.data.url ?? project.data.repo;
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return (u.host + u.pathname).replace(/^www\./, '').replace(/\/$/, '');
  } catch {
    return raw;
  }
}

/** All published projects, ordered by `order` ascending then newest year. */
export async function getProjects() {
  const all = await getCollection('projects', (p) => !p.data.draft);
  return all.sort((a, b) => a.data.order - b.data.order || b.data.year.localeCompare(a.data.year));
}
