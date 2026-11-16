import { Favourites } from './components/Favourites';
import { HotList } from './components/HotList';
import { PaperDetail } from './components/PaperDetail';
import { Settings } from './components/Settings';
import { FlameIcon, StarIcon } from './components/ui';
import { goBack, openPaper, openSettings, switchTab, useRoute, type Tab } from './hooks/useRoute';

const TABS: { tab: Tab; label: string; icon: React.ReactNode }[] = [
  { tab: 'hot', label: 'Hot', icon: <FlameIcon /> },
  { tab: 'favourites', label: 'Favourites', icon: <StarIcon /> },
];

export default function App() {
  const { tab, screen } = useRoute();

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col">
      <div className="flex min-h-0 flex-1 flex-col" inert={screen !== null}>
        {tab === 'hot' ? (
          <HotList onOpen={openPaper} onSettings={openSettings} />
        ) : (
          <Favourites onOpen={openPaper} onSettings={openSettings} />
        )}

        <nav className="flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          {TABS.map((item) => (
            <button
              key={item.tab}
              type="button"
              aria-current={item.tab === tab ? 'page' : undefined}
              onClick={() => switchTab(item.tab)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                item.tab === tab ? 'text-accent' : 'text-mute'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {screen?.type === 'paper' && (
        <PaperDetail key={screen.arxivId} arxivId={screen.arxivId} onBack={goBack} />
      )}
      {screen?.type === 'settings' && <Settings onBack={goBack} />}
    </div>
  );
}
