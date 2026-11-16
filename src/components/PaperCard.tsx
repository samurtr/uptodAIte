import { memo } from 'react';
import type { Paper } from '../types';
import { StarButton, TopicChip, Upvotes } from './ui';

interface Props {
  paper: Paper;
  rank: number;
  favourite: boolean;
  onOpen: (arxivId: string) => void;
  onToggleFavourite: (paper: Paper) => void;
}

export const PaperCard = memo(function PaperCard({
  paper,
  rank,
  favourite,
  onOpen,
  onToggleFavourite,
}: Props) {
  return (
    <article className="paper-card flex items-stretch rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => onOpen(paper.arxivId)}
        className="flex min-h-11 min-w-0 flex-1 gap-3 py-3 pl-3 text-left active:opacity-70"
      >
        <span className="w-8 shrink-0 pt-0.5 text-center text-sm font-bold text-mute tabular-nums">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-3 text-[15px] leading-snug font-semibold">{paper.title}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Upvotes count={paper.upvotes} />
            {paper.topic && <TopicChip topic={paper.topic} />}
          </span>
        </span>
      </button>
      <div className="flex items-start pt-1 pr-1">
        <StarButton active={favourite} onToggle={() => onToggleFavourite(paper)} />
      </div>
    </article>
  );
});

export function SkeletonCard() {
  return (
    <div className="flex animate-pulse gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="h-4 w-8 rounded bg-raised" />
      <div className="flex-1 space-y-2">
        <div className="h-4 rounded bg-raised" />
        <div className="h-4 w-4/5 rounded bg-raised" />
        <div className="h-4 w-2/5 rounded bg-raised" />
      </div>
      <div className="h-6 w-6 rounded-full bg-raised" />
    </div>
  );
}
