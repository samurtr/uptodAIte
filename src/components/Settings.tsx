import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { clearStoredData, getSettings, setApiKey, setPeriod } from '../db';
import { useLiveQuery } from '../hooks/useLiveQuery';
import { exportFavourites, importFavourites } from '../services/favourites';
import { BackIcon, IconButton, PERIOD_OPTIONS, SegmentedControl } from './ui';

export function Settings({ onBack }: { onBack: () => void }) {
  const settings = useLiveQuery(getSettings, []);
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const apiKey = keyDraft ?? settings?.apiKey ?? '';

  const saveKey = async () => {
    await setApiKey(apiKey);
    setKeyDraft(null);
    setNotice(apiKey.trim() ? 'API key saved.' : 'API key removed.');
  };

  const onExport = async () => {
    const url = URL.createObjectURL(
      new Blob([await exportFavourites()], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `uptodaite-favourites-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const count = await importFavourites(await file.text());
      setNotice(`Imported ${count} favourite${count === 1 ? '' : 's'}.`);
    } catch {
      setNotice('Import failed: this file is not a favourites export.');
    }
  };

  const onClear = async () => {
    const ok = confirm(
      'Delete all data stored on this device? This removes the paper lists, labels, summaries, favourites and your API key.',
    );
    if (!ok) return;
    await clearStoredData();
    setKeyDraft(null);
    setNotice('All stored data deleted.');
  };

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-xl flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 pt-[max(env(safe-area-inset-top),0.25rem)] pb-1">
        <IconButton label="Back" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="scroll-area flex-1">
        <div className="space-y-6 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),2rem)]">
          <Group title="Claude API key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Claude API key"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none focus:border-accent"
            />
            <p className="text-sm text-mute">
              Stored only on this device and sent only to Anthropic.
            </p>
            <Button onClick={saveKey} disabled={keyDraft === null || keyDraft === settings?.apiKey}>
              Save key
            </Button>
          </Group>

          <Group title="Default period">
            <SegmentedControl
              label="Default period"
              options={PERIOD_OPTIONS}
              value={settings?.period ?? 'week'}
              onChange={(value) => void setPeriod(value)}
            />
          </Group>

          <Group title="Favourites">
            <Button onClick={onExport}>Export as JSON</Button>
            <Button onClick={() => fileInput.current?.click()}>Import from JSON</Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              onChange={onImport}
              className="hidden"
            />
          </Group>

          <Group title="Stored data">
            <Button onClick={onClear} danger>
              Clear stored data
            </Button>
          </Group>

          <p className="min-h-6 text-center text-sm text-mute" role="status">
            {notice}
          </p>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-wide text-mute uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Button({
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 w-full rounded-xl border px-4 font-semibold active:bg-raised disabled:opacity-40 ${
        danger ? 'border-danger/50 text-danger' : 'border-line text-ink'
      }`}
    >
      {children}
    </button>
  );
}
