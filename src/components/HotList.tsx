import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { db, getSettings, setPeriod } from '../db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { toggleFavourite } from '../services/favourites';
import { fetchPapers, getStoredList } from '../services/papers';
import { TOPIC_LABELS, type Paper, type Period, type TopicLabel } from '../types';
import { PaperCard, SkeletonCard } from './PaperCard';
import { AppHeader, PERIOD_OPTIONS, SegmentedControl } from './ui';

const PULL_THRESHOLD = 64;

function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

interface Props {
  onOpen: (arxivId: string) => void;
  onSettings: () => void;
}

export function HotList({ onOpen, onSettings }: Props) {
  const settings = useLiveQuery(getSettings, []);
  const period = settings?.period ?? 'week';

  return (
    <>
      <AppHeader onSettings={onSettings}>
        <div className="mt-1">
          <SegmentedControl
            label="Period"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(value) => void setPeriod(value)}
          />
        </div>
      </AppHeader>
      {settings ? (
        // Keyed by period so switching starts from a clean state and reloads.
        <PeriodList key={period} period={period} hasApiKey={!!settings.apiKey} onOpen={onOpen} />
      ) : (
        <div className="flex-1" />
      )}
    </>
  );
}

function PeriodList({
  period,
  hasApiKey,
  onOpen,
}: {
  period: Period;
  hasApiKey: boolean;
  onOpen: (arxivId: string) => void;
}) {
  const stored = useLiveQuery(() => getStoredList(period), [period]);
  const favouriteIds = useLiveQuery(() => db.favourites.toCollection().primaryKeys(), []);
  const [status, setStatus] = useState<'loading' | 'idle' | 'failed'>('loading');
  const [filter, setFilter] = useState<TopicLabel | null>(null);
  const [pull, setPull] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const pullStart = useRef<number | null>(null);
  const now = useNow();

  const refresh = useCallback(
    (force: boolean) => {
      setStatus('loading');
      fetchPapers(period, force).then(
        () => setStatus('idle'),
        () => setStatus('failed'),
      );
    },
    [period],
  );

  // On app open (and once the API key is set, so new papers get their labels).
  useEffect(() => refresh(false), [refresh, hasApiKey]);

  // Coming back to the app counts as opening it: refresh if the list is older than 30 min.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refresh(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Pull-to-refresh
  const onTouchStart = (e: TouchEvent) => {
    pullStart.current = scroller.current!.scrollTop <= 0 ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (pullStart.current === null) return;
    const distance = e.touches[0].clientY - pullStart.current;
    setPull(distance > 0 && scroller.current!.scrollTop <= 0 ? Math.min(distance * 0.5, 96) : 0);
  };
  const onTouchEnd = () => {
    if (pull >= PULL_THRESHOLD) refresh(true);
    pullStart.current = null;
    setPull(0);
  };

  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const current = stored?.current;
  const previous = stored?.previous;

  const topics = useMemo(() => {
    const present = new Set<TopicLabel>();
    for (const p of [...(current ?? []), ...(previous ?? [])]) {
      if (p.topic) present.add(p.topic);
      if (p.secondaryTopic) present.add(p.secondaryTopic);
    }
    return TOPIC_LABELS.filter((label) => present.has(label));
  }, [current, previous]);

  const list = useMemo(() => {
    const cards = (papers: Paper[]) =>
      papers.map((paper, i) =>
        !filter || paper.topic === filter || paper.secondaryTopic === filter ? (
          <PaperCard
            key={paper.arxivId}
            paper={paper}
            rank={i + 1}
            favourite={favourites.has(paper.arxivId)}
            onOpen={onOpen}
            onToggleFavourite={toggleFavourite}
          />
        ) : null,
      );
    return (
      <>
        {cards(current ?? [])}
        {previous && previous.length > 0 && (
          <>
            <div className="flex items-center gap-3 py-2 text-xs font-semibold tracking-wide text-mute uppercase">
              <span className="h-px flex-1 bg-line" />
              {period === 'week' ? 'Last week' : 'Last month'}
              <span className="h-px flex-1 bg-line" />
            </div>
            {cards(previous)}
          </>
        )}
      </>
    );
  }, [current, previous, filter, favourites, onOpen, period]);

  const count = (current?.length ?? 0) + (previous?.length ?? 0);

  let body;
  if (!stored || (count === 0 && status === 'loading')) {
    body = Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />);
  } else if (count === 0 && status === 'failed') {
    body = (
      <div className="px-4 py-16 text-center">
        <p className="text-mute">Couldn't load the papers.</p>
        <RetryButton onClick={() => refresh(true)} />
      </div>
    );
  } else if (count === 0) {
    body = <p className="px-4 py-16 text-center text-mute">No papers yet for this period.</p>;
  } else {
    body = list;
  }

  return (
    <>
      <div className="shrink-0 px-4 pt-2 text-xs text-mute" aria-live="polite">
        {status === 'loading'
          ? count > 0
            ? 'Refreshing…'
            : 'Loading papers…'
          : stored?.fetchedAt
            ? `Last updated ${timeAgo(stored.fetchedAt, now)}`
            : ' '}
      </div>

      {status === 'failed' && count > 0 && (
        <div
          role="alert"
          className="mx-4 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 py-1 pr-1 pl-3 text-sm"
        >
          <span>Couldn't refresh</span>
          <button
            type="button"
            onClick={() => refresh(true)}
            className="min-h-11 rounded-lg px-3 font-semibold text-accent active:bg-raised"
          >
            Try again
          </button>
        </div>
      )}

      {topics.length > 0 && (
        <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-4 pt-1">
          <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
          {topics.map((topic) => (
            <FilterChip
              key={topic}
              label={topic}
              active={filter === topic}
              onClick={() => setFilter(filter === topic ? null : topic)}
            />
          ))}
        </div>
      )}

      <div
        ref={scroller}
        className="scroll-area flex-1"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="flex items-end justify-center overflow-hidden text-xs text-mute"
          style={{ height: pull }}
          aria-hidden
        >
          <span className="pb-2">
            {pull >= PULL_THRESHOLD ? '↑ Release to refresh' : '↓ Pull to refresh'}
          </span>
        </div>
        <div className="space-y-2 px-4 pt-2 pb-4">{body}</div>
      </div>
    </>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-bg active:opacity-80"
    >
      Try again
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex min-h-11 shrink-0 items-center"
    >
      <span
        className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
          active ? 'border-accent bg-accent font-semibold text-bg' : 'border-line text-mute'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
