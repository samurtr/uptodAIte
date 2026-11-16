import type { Period } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's calendar date in Europe/Berlin, as a UTC-midnight Date. */
function berlinToday(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

function isoWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this ISO week
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/**
 * API value of the current period (offset 0) or an earlier one (offset -1 = previous):
 * 'yyyy-Www' for weeks, 'yyyy-mm' for months.
 */
export function periodValue(period: Period, offset = 0, now = new Date()): string {
  const d = berlinToday(now);
  if (period === 'week') {
    d.setUTCDate(d.getUTCDate() + offset * 7);
    return isoWeek(d);
  }
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Key of a stored list: 'week:yyyy-Www' | 'month:yyyy-mm'. */
export const listKey = (period: Period, value: string) => `${period}:${value}`;
