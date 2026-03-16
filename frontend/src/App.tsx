/**
 * App — hash-based client-side router.
 *
 * Routing table
 * -------------
 *   #/             (or empty hash)  → <BoardList />
 *   #/boards/:id                    → <BoardDetail id={id} />
 *
 * Why hash routing instead of history API?
 * PLAN.md §1.2: "No react-router-dom — hash-based routing (#/boards/1)
 * avoids Vite history-mode fallback config."
 *
 * The `parseHash` function is intentionally strict: any hash that does not
 * match `#/boards/<integer>` falls through to the home view so the app
 * never renders a broken state.
 */

import { useState, useEffect } from 'react';
import BoardList from './components/BoardList';
import BoardDetail from './components/BoardDetail';

// ---------------------------------------------------------------------------
// Route discriminated union
// ---------------------------------------------------------------------------

type Route = { view: 'home' } | { view: 'board'; id: number };

function parseHash(hash: string): Route {
  const match = /^#\/boards\/(\d+)/.exec(hash);
  if (match !== null) {
    const id = parseInt(match[1], 10);
    if (!isNaN(id)) {
      return { view: 'board', id };
    }
  }
  return { view: 'home' };
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(window.location.hash),
  );

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route.view === 'board') {
    return <BoardDetail id={route.id} />;
  }
  return <BoardList />;
}
