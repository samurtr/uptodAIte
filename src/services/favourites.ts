import { db, summaryKey } from '../db';
import type { Favourite, Paper, Summary } from '../types';

/** Saves the paper (snapshot + existing summaries) or removes it if already saved. */
export async function toggleFavourite(paper: Paper): Promise<void> {
  await db.transaction('rw', db.favourites, db.summaries, async () => {
    if (await db.favourites.get(paper.arxivId)) {
      await db.favourites.delete(paper.arxivId);
      return;
    }
    const stored = await db.summaries.bulkGet([
      summaryKey(paper.arxivId, 'short'),
      summaryKey(paper.arxivId, 'long'),
    ]);
    await db.favourites.put({
      arxivId: paper.arxivId,
      savedAt: new Date().toISOString(),
      paper,
      summaries: stored.filter((s): s is Summary => !!s),
    });
  });
}

export const removeFavourite = (arxivId: string) => db.favourites.delete(arxivId);

/** Favourites sorted by date saved, newest first. */
export async function getFavourites(): Promise<Favourite[]> {
  const favourites = await db.favourites.toArray();
  return favourites.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function exportFavourites(): Promise<string> {
  return JSON.stringify(await getFavourites(), null, 2);
}

function isFavourite(v: unknown): v is Favourite {
  const f = v as Favourite;
  return (
    !!f &&
    typeof f.arxivId === 'string' &&
    typeof f.savedAt === 'string' &&
    !!f.paper &&
    f.paper.arxivId === f.arxivId &&
    typeof f.paper.title === 'string' &&
    Array.isArray(f.paper.authors) &&
    Array.isArray(f.summaries)
  );
}

/** Imports favourites from an export file; returns how many were imported. */
export async function importFavourites(json: string): Promise<number> {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data) || !data.every(isFavourite)) {
    throw new Error('This file is not a favourites export.');
  }
  await db.favourites.bulkPut(data);
  return data.length;
}
