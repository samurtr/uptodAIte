import type { Paper, Period } from '../types';

const HF = 'https://huggingface.co';
const PAGE_SIZE = 100;

// Field names verified against live responses of /api/daily_papers and /api/papers/{id}.
interface HfPaper {
  id: string;
  title?: string;
  summary?: string; // abstract
  upvotes?: number;
  publishedAt?: string;
  authors?: { name?: string }[];
  githubRepo?: string;
  projectPage?: string;
  ai_summary?: string;
  ai_keywords?: string[];
}

interface HfDailyPaper {
  paper: HfPaper;
  thumbnail?: string;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

export function mapPaper(item: HfDailyPaper): Paper {
  const p = item.paper;
  const paper: Paper = {
    arxivId: p.id,
    title: clean(p.title),
    authors: (p.authors ?? []).map((a) => clean(a.name)).filter(Boolean),
    abstract: clean(p.summary),
    upvotes: p.upvotes ?? 0,
    publishedAt: p.publishedAt ?? '',
  };
  if (item.thumbnail) paper.thumbnailUrl = item.thumbnail;
  if (p.githubRepo) paper.githubUrl = p.githubRepo;
  return paper;
}

/** Sort by upvotes descending; ties by publishedAt, newest first. */
export function sortPapers(papers: Paper[]): Paper[] {
  return [...papers].sort(
    (a, b) => b.upvotes - a.upvotes || b.publishedAt.localeCompare(a.publishedAt),
  );
}

/** Fetches all pages of a period (100 each) until a page returns fewer than 100 items. */
export async function fetchDailyPapers(period: Period, value: string): Promise<Paper[]> {
  const byId = new Map<string, Paper>();
  for (let page = 0; ; page++) {
    const url = `${HF}/api/daily_papers?${period}=${value}&limit=${PAGE_SIZE}&p=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hugging Face API responded ${res.status}`);
    const items: unknown = await res.json();
    if (!Array.isArray(items)) throw new Error('Unexpected Hugging Face API response');
    for (const item of items as HfDailyPaper[]) {
      if (item?.paper?.id) byId.set(item.paper.id, mapPaper(item));
    }
    if (items.length < PAGE_SIZE) break;
  }
  return [...byId.values()];
}

export interface PaperMeta {
  aiSummary?: string;
  aiKeywords?: string[];
  githubUrl?: string;
  projectUrl?: string;
}

/** HF metadata for one paper; undefined if it cannot be loaded. */
export async function fetchPaperMeta(arxivId: string): Promise<PaperMeta | undefined> {
  try {
    const res = await fetch(`${HF}/api/papers/${arxivId}`);
    if (!res.ok) return undefined;
    const p = (await res.json()) as HfPaper;
    return {
      aiSummary: p.ai_summary || undefined,
      aiKeywords: p.ai_keywords?.length ? p.ai_keywords : undefined,
      githubUrl: p.githubRepo || undefined,
      projectUrl: p.projectPage || undefined,
    };
  } catch {
    return undefined;
  }
}

/** Markdown full text of a paper; undefined if it is missing or CORS-blocked. */
export async function fetchFullText(arxivId: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${HF}/papers/${arxivId}.md`);
    if (!res.ok || !res.headers.get('content-type')?.includes('markdown')) return undefined;
    const text = (await res.text()).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

export const paperLinks = (arxivId: string) => ({
  hf: `${HF}/papers/${arxivId}`,
  arxiv: `https://arxiv.org/abs/${arxivId}`,
  pdf: `https://arxiv.org/pdf/${arxivId}`,
});
