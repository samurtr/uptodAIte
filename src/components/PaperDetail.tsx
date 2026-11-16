import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { db } from '../db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { useSummary, type SummaryState } from '../hooks/useSummary';
import { toggleFavourite } from '../services/favourites';
import { paperLinks } from '../services/hf';
import type { Paper } from '../types';
import { Markdown } from './Markdown';
import { BackIcon, IconButton, StarButton, TopicChip, Upvotes } from './ui';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortAuthors(authors: string[]): string {
  return authors.length > 3 ? `${authors.slice(0, 3).join(', ')} et al.` : authors.join(', ');
}

export function PaperDetail({ arxivId, onBack }: { arxivId: string; onBack: () => void }) {
  const data = useLiveQuery(async () => {
    const favourite = await db.favourites.get(arxivId);
    // Falls back to the favourite's snapshot once the paper has left the hot list.
    const paper = (await db.papers.get(arxivId)) ?? favourite?.paper ?? null;
    return { paper, isFavourite: !!favourite };
  }, [arxivId]);

  const scroller = useRef<HTMLDivElement>(null);
  const longRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Reading progress through the long summary.
  const updateProgress = useCallback(() => {
    const area = scroller.current;
    const long = longRef.current;
    if (!area || !long || long.offsetHeight === 0) return setProgress(null);
    const top = long.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    const read = (area.scrollTop + area.clientHeight - top) / long.offsetHeight;
    setProgress(Math.max(0, Math.min(1, read)));
  }, []);

  // Swipe right to go back (the very edge is left to the system's own back gesture).
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const { clientX: x, clientY: y } = e.touches[0];
    swipeStart.current = x > 24 ? { x, y } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const { clientX: x, clientY: y } = e.changedTouches[0];
    if (x - start.x > 80 && Math.abs(y - start.y) < 50) onBack();
  };

  const paper = data?.paper;

  return (
    <div
      className="fixed inset-0 z-20 mx-auto flex max-w-xl flex-col bg-bg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex shrink-0 items-center justify-between px-2 pt-[max(env(safe-area-inset-top),0.25rem)] pb-1">
        <IconButton label="Back" onClick={onBack}>
          <BackIcon />
        </IconButton>
        {paper && (
          <StarButton active={data.isFavourite} onToggle={() => void toggleFavourite(paper)} />
        )}
      </div>
      <div
        className="h-0.5 shrink-0 bg-line"
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((progress ?? 0) * 100)}
      >
        <div className="h-full bg-accent" style={{ width: `${(progress ?? 0) * 100}%` }} />
      </div>

      <div ref={scroller} onScroll={updateProgress} className="scroll-area flex-1">
        {paper ? (
          <PaperContent paper={paper} longRef={longRef} onLongChange={updateProgress} />
        ) : (
          data && <p className="px-4 py-16 text-center text-mute">This paper is not stored on this device.</p>
        )}
      </div>
    </div>
  );
}

function PaperContent({
  paper,
  longRef,
  onLongChange,
}: {
  paper: Paper;
  longRef: React.RefObject<HTMLDivElement | null>;
  onLongChange: () => void;
}) {
  const short = useSummary(paper.arxivId, 'short', true);
  const long = useSummary(paper.arxivId, 'long', false);
  const links = paperLinks(paper.arxivId);
  const date = formatDate(paper.publishedAt);

  useEffect(onLongChange, [onLongChange, long.text, long.status]);

  return (
    <div className="px-4 pt-2 pb-[max(env(safe-area-inset-bottom),2rem)]">
      <h1 className="text-xl leading-snug font-bold">{paper.title}</h1>

      {paper.topic && (
        <div className="mt-3 flex flex-wrap gap-2">
          <TopicChip topic={paper.topic} />
          {paper.secondaryTopic && <TopicChip topic={paper.secondaryTopic} />}
        </div>
      )}

      <p className="mt-3 flex items-center gap-x-2 text-sm text-mute">
        <Upvotes count={paper.upvotes} />
        {date && <span>· {date}</span>}
      </p>
      {paper.authors.length > 0 && (
        <p className="mt-1 text-sm text-mute">{shortAuthors(paper.authors)}</p>
      )}

      <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-accent">
        <ExternalLink href={links.hf}>HF page</ExternalLink>
        <span className="text-mute">·</span>
        <ExternalLink href={links.arxiv}>arXiv</ExternalLink>
        <span className="text-mute">·</span>
        <ExternalLink href={links.pdf}>PDF</ExternalLink>
      </p>

      <section className="mt-3 rounded-2xl border border-line bg-surface p-4">
        <SummaryBody state={short} onRetry={short.start} skeletonLines={5} />
      </section>

      {long.status === 'idle' ? (
        <button
          type="button"
          onClick={long.start}
          className="mt-4 min-h-12 w-full rounded-xl bg-accent px-4 text-base font-semibold text-bg active:opacity-80"
        >
          Read more (~5 min)
        </button>
      ) : (
        <section ref={longRef} className="mt-4">
          <SummaryBody state={long} onRetry={long.start} skeletonLines={8} />
        </section>
      )}
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-11 items-center px-2 first:pl-0 active:opacity-70"
    >
      {children}
    </a>
  );
}

function SummaryBody({
  state,
  onRetry,
  skeletonLines,
}: {
  state: SummaryState;
  onRetry: () => void;
  skeletonLines: number;
}) {
  const { status, text, message } = state;
  return (
    <div aria-busy={status === 'loading'}>
      {status === 'loading' && !text && (
        <div className="animate-pulse space-y-2.5 py-1" aria-label="Generating summary">
          {Array.from({ length: skeletonLines }, (_, i) => (
            <div key={i} className={`h-3.5 rounded bg-raised ${i === skeletonLines - 1 ? 'w-3/5' : ''}`} />
          ))}
        </div>
      )}
      {text && <Markdown text={text} streaming={status === 'loading'} />}
      {status === 'blocked' && <p className="text-mute">{message}</p>}
      {status === 'error' && (
        <div className={`flex items-center justify-between gap-3 ${text ? 'mt-3' : ''}`} role="alert">
          <span className="text-sm text-danger">{message}</span>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-xl border border-line px-4 font-semibold text-accent active:bg-raised"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
