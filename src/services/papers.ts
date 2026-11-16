import { db, getSettings, type PaperList } from '../db';
import type { Paper, Period } from '../types';
import { fetchDailyPapers, sortPapers } from './hf';
import { listKey, periodValue } from './period';

const REFETCH_AFTER_MS = 30 * 60 * 1000;
/** Below this many papers the previous period is shown as well. */
export const MIN_PAPERS = 10;

const isFresh = (list: PaperList) => Date.now() - Date.parse(list.fetchedAt) < REFETCH_AFTER_MS;

async function papersOf(list: PaperList): Promise<Paper[]> {
  const papers = await db.papers.bulkGet(list.arxivIds);
  return sortPapers(papers.filter((p): p is Paper => !!p));
}

/** Returns the stored list of one period, refetching it from HF if stale, missing or forced. */
async function loadList(period: Period, value: string, force: boolean): Promise<Paper[]> {
  const key = listKey(period, value);
  const stored = await db.lists.get(key);
  if (stored && !force && isFresh(stored)) return papersOf(stored);

  const fetched = await fetchDailyPapers(period, value);
  const ids = fetched.map((p) => p.arxivId);
  await db.transaction('rw', db.papers, db.lists, async () => {
    // Reuse stored labels.
    const known = await db.papers.bulkGet(ids);
    const papers = fetched.map((p, i) => ({
      ...p,
      ...(known[i]?.topic ? { topic: known[i]!.topic } : {}),
      ...(known[i]?.secondaryTopic ? { secondaryTopic: known[i]!.secondaryTopic } : {}),
    }));
    await db.papers.bulkPut(papers);
    await db.lists.put({ key, arxivIds: ids, fetchedAt: new Date().toISOString() });
  });
  return papersOf({ key, arxivIds: ids, fetchedAt: '' });
}

/** Labels all not-yet-labelled papers in one batch call. Needs the API key; failures are not fatal. */
async function labelNewPapers(papers: Paper[]): Promise<void> {
  const unlabelled = papers.filter((p) => !p.topic);
  if (unlabelled.length === 0) return;
  const { apiKey } = await getSettings();
  if (!apiKey) return;
  try {
    const { classifyPapers } = await import('./llm'); // loaded on demand: keeps the Claude SDK out of the start-up bundle
    const labels = await classifyPapers(apiKey, unlabelled);
    await db.transaction('rw', db.papers, db.favourites, async () => {
      for (const [arxivId, label] of labels) {
        await db.papers.update(arxivId, label);
        await db.favourites
          .where('arxivId')
          .equals(arxivId)
          .modify((fav) => {
            Object.assign(fav.paper, label);
          });
      }
    });
  } catch (err) {
    console.warn('Labelling failed; will retry on the next fetch', err);
  }
}

const running = new Map<Period, Promise<Paper[]>>();

/**
 * Fetches all pages from HF, maps to Paper[], reuses stored labels, labels new papers in
 * one batch call and stores the list with `fetchedAt` (refetched after 30 min, or when forced).
 * If the current period has fewer than 10 papers, the previous period is loaded as well.
 */
export function fetchPapers(period: Period, force = false): Promise<Paper[]> {
  let job = running.get(period);
  if (!job) {
    job = (async () => {
      const value = periodValue(period);
      const current = await loadList(period, value, force);
      const previous =
        current.length < MIN_PAPERS ? await loadList(period, periodValue(period, -1), force) : [];
      await labelNewPapers([...current, ...previous]);
      const list = await db.lists.get(listKey(period, value));
      return list ? papersOf(list) : current;
    })().finally(() => running.delete(period));
    running.set(period, job);
  }
  return job;
}

export interface StoredList {
  current: Paper[];
  /** Previous period, shown below a divider when the current one is short. */
  previous: Paper[] | null;
  fetchedAt: string | null;
  /** True when no list of the current period is stored and an older one is shown instead. */
  outdated: boolean;
}

/** What is in storage for a period — shown instantly on open and when offline. */
export async function getStoredList(period: Period): Promise<StoredList> {
  const list = await db.lists.get(listKey(period, periodValue(period)));
  if (list) {
    const current = await papersOf(list);
    let previous: Paper[] | null = null;
    if (current.length < MIN_PAPERS) {
      const prevList = await db.lists.get(listKey(period, periodValue(period, -1)));
      if (prevList) previous = await papersOf(prevList);
    }
    return { current, previous, fetchedAt: list.fetchedAt, outdated: false };
  }
  // No list for the current period yet: fall back to the last stored one.
  const older = await db.lists.where('key').startsWith(`${period}:`).toArray();
  const last = older.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
  if (!last) return { current: [], previous: null, fetchedAt: null, outdated: false };
  return { current: await papersOf(last), previous: null, fetchedAt: last.fetchedAt, outdated: true };
}
