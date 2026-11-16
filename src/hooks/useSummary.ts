import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DailyCapError,
  NoApiKeyError,
  getStoredSummary,
  getSummary,
} from '../services/summaries';
import type { SummaryType } from '../types';

export interface SummaryState {
  /** idle = not requested yet · blocked = cannot be generated right now (no key, daily cap) */
  status: 'idle' | 'loading' | 'done' | 'error' | 'blocked';
  text: string;
  message?: string;
}

/**
 * Summary of a paper. With `auto` it loads (or generates) right away; otherwise only a
 * stored summary is shown until `start()` is called.
 */
export function useSummary(arxivId: string, type: SummaryType, auto: boolean) {
  const [state, setState] = useState<SummaryState>({ status: 'idle', text: '' });
  const run = useRef(0);

  const start = useCallback(() => {
    const id = ++run.current;
    const current = () => run.current === id;
    setState({ status: 'loading', text: '' });
    getSummary(arxivId, type, (delta) => {
      if (current()) setState((s) => ({ ...s, text: s.text + delta }));
    }).then(
      (summary) => {
        if (current()) setState({ status: 'done', text: summary.text });
      },
      (err: unknown) => {
        if (!current()) return;
        const blocked = err instanceof NoApiKeyError || err instanceof DailyCapError;
        const message = blocked ? (err as Error).message : 'Something went wrong.';
        // Keep whatever has streamed in so far.
        setState((s) => ({ status: blocked ? 'blocked' : 'error', text: s.text, message }));
      },
    );
  }, [arxivId, type]);

  useEffect(() => {
    if (auto) {
      start();
    } else {
      const id = ++run.current;
      void getStoredSummary(arxivId, type).then((stored) => {
        if (stored && run.current === id) setState({ status: 'done', text: stored.text });
      });
    }
    return () => {
      run.current++;
    };
  }, [arxivId, type, auto, start]);

  return { ...state, start };
}
