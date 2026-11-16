import { useEffect, useState } from 'react';

export type Tab = 'hot' | 'favourites';

export interface Route {
  tab: Tab;
  /** Screen shown on top of the tab. */
  screen: { type: 'paper'; arxivId: string } | { type: 'settings' } | null;
}

// '#/hot', '#/favourites', '#/hot/paper/2611.01234', '#/hot/settings'
function parse(hash: string): Route {
  const [tabPart, screen, id] = hash.replace(/^#\/?/, '').split('/');
  const tab: Tab = tabPart === 'favourites' ? 'favourites' : 'hot';
  if (screen === 'paper' && id) return { tab, screen: { type: 'paper', arxivId: decodeURIComponent(id) } };
  if (screen === 'settings') return { tab, screen: { type: 'settings' } };
  return { tab, screen: null };
}

const currentTab = () => parse(location.hash).tab;

// Screens opened inside the app, so "back" knows whether there is history to go back to.
let opened = 0;

export function switchTab(tab: Tab) {
  location.replace(`#/${tab}`);
}

export function openPaper(arxivId: string) {
  opened++;
  location.hash = `#/${currentTab()}/paper/${encodeURIComponent(arxivId)}`;
}

export function openSettings() {
  opened++;
  location.hash = `#/${currentTab()}/settings`;
}

export function goBack() {
  if (opened > 0) {
    opened--;
    history.back();
  } else {
    location.replace(`#/${currentTab()}`);
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
