import Dexie, { type Table } from 'dexie';
import type { Favourite, Paper, Period, Summary, SummaryType } from './types';

export interface PaperList {
  key: string; // 'week:yyyy-Www' | 'month:yyyy-mm'
  arxivIds: string[];
  fetchedAt: string;
}

class AppDB extends Dexie {
  papers!: Table<Paper, string>; // key arxivId, incl. topic
  lists!: Table<PaperList, string>; // key period:yyyy-Www|yyyy-mm
  summaries!: Table<Summary, string>; // key arxivId:type
  favourites!: Table<Favourite, string>; // key arxivId
  settings!: Table<string, string>; // keys 'period', 'apiKey'

  constructor() {
    super('uptodaite');
    this.version(1).stores({
      papers: 'arxivId',
      lists: 'key',
      summaries: '',
      favourites: 'arxivId',
      settings: '',
    });
  }
}

export const db = new AppDB();

export const summaryKey = (arxivId: string, type: SummaryType) => `${arxivId}:${type}`;

export interface Settings {
  period: Period;
  apiKey: string;
}

export async function getSettings(): Promise<Settings> {
  const [period, apiKey] = await db.settings.bulkGet(['period', 'apiKey']);
  return { period: period === 'month' ? 'month' : 'week', apiKey: apiKey ?? '' };
}

export const setPeriod = (period: Period) => db.settings.put(period, 'period');
export const setApiKey = (apiKey: string) => db.settings.put(apiKey.trim(), 'apiKey');

export async function clearStoredData(): Promise<void> {
  await db.transaction('rw', db.tables, () => Promise.all(db.tables.map((t) => t.clear())));
}
