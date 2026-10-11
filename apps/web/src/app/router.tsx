import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router';
import { LandingPage } from '../routes/LandingPage';
import { AccountPage, LearnPage, NotFoundPage } from '../routes/StubPage';
import type { BuildSearch } from '../routes/build/BuildPage';
import type { CompareSearch } from '../routes/explore/ComparePage';
import type { RaceSearch } from '../routes/race/RacePage';
import type { WatchSearch } from '../routes/watch/WatchPage';
import { RootLayout } from './RootLayout';
import { RouteLoading } from './RouteLoading';

// Feature pages load on demand (WI-05): the landing page and shell stay in the initial bundle,
// each page is its own chunk, preloaded on link hover/focus (`defaultPreload: 'intent'`) and
// precached by the service worker for offline use.
const PlayPage = lazyRouteComponent(() => import('../routes/play/PlayPage'), 'PlayPage');
const WatchPage = lazyRouteComponent(() => import('../routes/watch/WatchPage'), 'WatchPage');
const RacePage = lazyRouteComponent(() => import('../routes/race/RacePage'), 'RacePage');
const BuildPage = lazyRouteComponent(() => import('../routes/build/BuildPage'), 'BuildPage');
const ExplorePage = lazyRouteComponent(
  () => import('../routes/explore/ExplorePage'),
  'ExplorePage',
);
const ComparePage = lazyRouteComponent(
  () => import('../routes/explore/ComparePage'),
  'ComparePage',
);

/** Keeps only non-empty string values for the given keys (search params are untrusted). */
function pickStrings<K extends string>(
  raw: Record<string, unknown>,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim().slice(0, 200);
  }
  return out;
}

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundPage });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});
const playRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/play',
  component: PlayPage,
});
const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/watch',
  component: WatchPage,
  validateSearch: (raw: Record<string, unknown>): WatchSearch => pickStrings(raw, ['seed']),
});
const raceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/race',
  component: RacePage,
  validateSearch: (raw: Record<string, unknown>): RaceSearch =>
    pickStrings(raw, ['seed', 'agents', 'scoring', 'size', 'gen']),
});
const buildRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/build',
  component: BuildPage,
  validateSearch: (raw: Record<string, unknown>): BuildSearch => pickStrings(raw, ['item']),
});
const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/learn',
  component: LearnPage,
});
const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore',
  component: ExplorePage,
});
const compareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explore/compare',
  component: ComparePage,
  validateSearch: (raw: Record<string, unknown>): CompareSearch =>
    pickStrings(raw, ['seed', 'algos']),
});
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  playRoute,
  watchRoute,
  raceRoute,
  buildRoute,
  learnRoute,
  exploreRoute,
  compareRoute,
  accountRoute,
]);

/** Browser history by default; pass a memory history in tests. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPendingComponent: RouteLoading,
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
