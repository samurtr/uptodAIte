import type { ReactNode } from 'react';
import type { TopicLabel } from '../types';

// One colour per label.
const TOPIC_COLOURS: Record<TopicLabel, string> = {
  'LLMs & Reasoning': '#7aa2ff',
  'Agents & Tool Use': '#b794ff',
  'Multimodal & Vision': '#4fd1c5',
  'Image & Video Generation': '#ff7eb6',
  'Audio & Speech': '#ffa94d',
  'Robotics & Embodied AI': '#94d82d',
  'Efficiency & Inference': '#4dc4ff',
  'Training & Data': '#f6d860',
  'Alignment & Safety': '#ff6b6b',
  'Benchmarks & Evaluation': '#d0a978',
  'Science & Health': '#3ddc97',
  Other: '#a3acbd',
};

export function TopicChip({ topic }: { topic: TopicLabel }) {
  const colour = TOPIC_COLOURS[topic];
  return (
    <span
      className="inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color: colour, borderColor: `${colour}55`, backgroundColor: `${colour}1f` }}
    >
      {topic}
    </span>
  );
}

export function Upvotes({ count }: { count: number }) {
  return (
    <span className="font-semibold whitespace-nowrap text-accent tabular-nums">▲ {count}</span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-raised p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => option.value !== value && onChange(option.value)}
          className={`min-h-11 flex-1 rounded-lg text-sm font-semibold transition-colors ${
            option.value === value ? 'bg-accent text-bg' : 'text-mute'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const PERIOD_OPTIONS = [
  { value: 'week' as const, label: 'Week' },
  { value: 'month' as const, label: 'Month' },
];

export function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-raised ${className}`}
    >
      {children}
    </button>
  );
}

export function StarButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <IconButton
      label={active ? 'Remove from favourites' : 'Add to favourites'}
      onClick={onToggle}
      className={`text-2xl ${active ? 'text-accent' : 'text-mute'}`}
    >
      {active ? '★' : '☆'}
    </IconButton>
  );
}

const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const BackIcon = () => (
  <svg {...svgProps}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const GearIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const FlameIcon = () => (
  <svg {...svgProps}>
    <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" />
  </svg>
);

export const StarIcon = () => (
  <svg {...svgProps}>
    <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z" />
  </svg>
);

/** App name + settings gear, shared by both tabs. */
export function AppHeader({ onSettings, children }: { onSettings: () => void; children?: ReactNode }) {
  return (
    <header className="shrink-0 border-b border-line bg-bg px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          uptod<span className="text-accent">AI</span>te
        </h1>
        <IconButton label="Settings" onClick={onSettings} className="-mr-2 text-mute">
          <GearIcon />
        </IconButton>
      </div>
      {children}
    </header>
  );
}
