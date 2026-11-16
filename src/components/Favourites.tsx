import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { getFavourites, removeFavourite, toggleFavourite } from '../services/favourites';
import { PaperCard } from './PaperCard';
import { AppHeader } from './ui';

const REMOVE_THRESHOLD = 110;

interface Props {
  onOpen: (arxivId: string) => void;
  onSettings: () => void;
}

export function Favourites({ onOpen, onSettings }: Props) {
  const favourites = useLiveQuery(getFavourites, []);

  return (
    <>
      <AppHeader onSettings={onSettings} />
      <div className="scroll-area flex-1">
        <div className="space-y-2 px-4 pt-3 pb-4">
          {favourites?.length === 0 && (
            <p className="px-4 py-16 text-center text-mute">
              No favourites yet. Tap ☆ on a paper to save it.
            </p>
          )}
          {favourites?.map((favourite, i) => (
            <SwipeToRemove key={favourite.arxivId} onRemove={() => void removeFavourite(favourite.arxivId)}>
              <PaperCard
                paper={favourite.paper}
                rank={i + 1}
                favourite
                onOpen={onOpen}
                onToggleFavourite={toggleFavourite}
              />
            </SwipeToRemove>
          ))}
        </div>
      </div>
    </>
  );
}

/** Swipe left to remove. */
function SwipeToRemove({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = (e: TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!start.current) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null; // vertical scroll, not a swipe
        return;
      }
      if (Math.abs(dx) < 10) return;
      setDragging(true);
    }
    setOffset(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    if (dragging && offset <= -REMOVE_THRESHOLD) onRemove();
    start.current = null;
    setDragging(false);
    setOffset(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0 flex items-center justify-end rounded-2xl bg-danger/20 pr-5 text-sm font-semibold text-danger"
        aria-hidden
      >
        Remove
      </div>
      <div
        className="relative touch-pan-y bg-bg"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
