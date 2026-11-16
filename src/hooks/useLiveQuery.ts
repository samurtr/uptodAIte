import { liveQuery } from 'dexie';
import { useEffect, useState, type DependencyList } from 'react';

/** Runs an IndexedDB query and re-runs it whenever the data it read changes. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (result) => setValue(() => result),
      error: (err) => console.error(err),
    });
    return () => subscription.unsubscribe();
  }, deps);
  return value;
}
