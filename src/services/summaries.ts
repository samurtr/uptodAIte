import { db, getSettings, summaryKey } from '../db';
import type { Paper, Summary, SummaryType } from '../types';
import { fetchFullText, fetchPaperMeta } from './hf';

export const LONG_SUMMARIES_PER_DAY = 20;
/** ~60k tokens at roughly 4 characters per token. */
const FULL_TEXT_MAX_CHARS = 240_000;
const ABSTRACT_ONLY_NOTE = '*Based on abstract only.*\n\n';

export class NoApiKeyError extends Error {
  constructor() {
    super('Add your Claude API key in Settings');
  }
}

export class DailyCapError extends Error {
  constructor() {
    super(`Daily limit of ${LONG_SUMMARIES_PER_DAY} long summaries reached. Try again tomorrow.`);
  }
}

/** A stored summary, from the summaries store or from a favourite's saved copy. */
export async function getStoredSummary(
  arxivId: string,
  type: SummaryType,
): Promise<Summary | undefined> {
  const stored = await db.summaries.get(summaryKey(arxivId, type));
  if (stored) return stored;
  const fav = await db.favourites.get(arxivId);
  return fav?.summaries.find((s) => s.type === type);
}

async function longSummariesToday(): Promise<number> {
  const today = new Date().toDateString();
  return db.summaries
    .filter((s) => s.type === 'long' && new Date(s.createdAt).toDateString() === today)
    .count();
}

async function generate(
  paper: Paper,
  type: SummaryType,
  apiKey: string,
  emit: (delta: string) => void,
): Promise<{ text: string; model: string }> {
  // Loaded on demand: keeps the Claude SDK out of the start-up bundle.
  const { LONG_MODEL, SHORT_MODEL, streamLongSummary, streamShortSummary } = await import('./llm');
  let text = '';
  const onText = (delta: string) => {
    text += delta;
    emit(delta);
  };
  const info = [`Title: ${paper.title}`, `Abstract: ${paper.abstract}`];

  if (type === 'short') {
    const meta = await fetchPaperMeta(paper.arxivId);
    if (meta?.aiSummary) info.push(`AI summary: ${meta.aiSummary}`);
    await streamShortSummary(apiKey, info.join('\n\n'), onText);
    return { text, model: SHORT_MODEL };
  }

  const fullText = await fetchFullText(paper.arxivId);
  if (fullText) {
    await streamLongSummary(apiKey, fullText.slice(0, FULL_TEXT_MAX_CHARS), onText);
    return { text, model: LONG_MODEL };
  }
  // Full text missing or CORS-blocked: abstract + HF metadata, with a note.
  const meta = await fetchPaperMeta(paper.arxivId);
  if (paper.authors.length) info.push(`Authors: ${paper.authors.join(', ')}`);
  if (meta?.aiSummary) info.push(`AI summary: ${meta.aiSummary}`);
  if (meta?.aiKeywords) info.push(`Keywords: ${meta.aiKeywords.join(', ')}`);
  const github = meta?.githubUrl ?? paper.githubUrl;
  if (github) info.push(`Code: ${github}`);
  if (meta?.projectUrl) info.push(`Project page: ${meta.projectUrl}`);
  onText(ABSTRACT_ONLY_NOTE);
  await streamLongSummary(apiKey, info.join('\n\n'), onText);
  return { text, model: LONG_MODEL };
}

async function loadOrGenerate(
  arxivId: string,
  type: SummaryType,
  emit: (delta: string) => void,
): Promise<Summary> {
  const stored = await getStoredSummary(arxivId, type);
  if (stored) return stored;

  const { apiKey } = await getSettings();
  if (!apiKey) throw new NoApiKeyError();
  const paper = (await db.papers.get(arxivId)) ?? (await db.favourites.get(arxivId))?.paper;
  if (!paper) throw new Error('Paper not found in storage.');
  if (type === 'long' && (await longSummariesToday()) >= LONG_SUMMARIES_PER_DAY) {
    throw new DailyCapError();
  }

  const { text, model } = await generate(paper, type, apiKey, emit);
  const summary: Summary = {
    arxivId,
    type,
    text,
    model,
    createdAt: new Date().toISOString(),
  };
  await db.transaction('rw', db.summaries, db.favourites, async () => {
    await db.summaries.put(summary, summaryKey(arxivId, type));
    // Copy into the favourite if the paper is saved.
    await db.favourites
      .where('arxivId')
      .equals(arxivId)
      .modify((fav) => {
        fav.summaries = [...fav.summaries.filter((s) => s.type !== type), summary];
      });
  });
  return summary;
}

interface Job {
  promise: Promise<Summary>;
  text: string;
  listeners: Set<(delta: string) => void>;
}

// One generation per summary at a time; later callers join the running stream.
const jobs = new Map<string, Job>();

/**
 * Returns the stored summary, or streams a new one and saves it.
 * short: input = abstract (+ HF AI summary); long: input = `.md` full text, truncated to ~60k tokens.
 * `onText` receives the text as it streams in (not called when the summary was stored).
 */
export function getSummary(
  arxivId: string,
  type: SummaryType,
  onText?: (delta: string) => void,
): Promise<Summary> {
  const key = summaryKey(arxivId, type);
  const job = jobs.get(key);
  if (job) {
    if (onText) {
      if (job.text) onText(job.text);
      job.listeners.add(onText);
    }
    return job.promise;
  }
  const created: Job = { text: '', listeners: new Set(onText ? [onText] : []), promise: null! };
  created.promise = loadOrGenerate(arxivId, type, (delta) => {
    created.text += delta;
    created.listeners.forEach((listener) => listener(delta));
  }).finally(() => jobs.delete(key));
  jobs.set(key, created);
  return created.promise;
}
