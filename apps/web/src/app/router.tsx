import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { LandingPage } from '../routes/LandingPage';
import {
  AccountPage,
  BuildPage,
  ExplorePage,
  LearnPage,
  NotFoundPage,
  RacePage,
  WatchPage,
} from '../routes/StubPage';
import { PlayPage } from '../routes/play/PlayPage';
import { RootLayout } from './RootLayout';

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFoundPage });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LandingPage });
const playRoute = createRoute({ getParentRoute: () => rootRoute, path: '/play', component: PlayPage });
const watchRoute = createRoute({ getParentRoute: () => rootRoute, path: '/watch', component: WatchPage });
const raceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/race', component: RacePage });
const buildRoute = createRoute({ getParentRoute: () => rootRoute, path: '/build', component: BuildPage });
const learnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/learn', component: LearnPage });
const exploreRoute = createRoute({ getParentRoute: () => rootRoute, path: '/explore', component: ExplorePage });
const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: '/account', component: AccountPage });

export const routeTree = rootRoute.addChildren([
  indexRoute,
  playRoute,
  watchRoute,
  raceRoute,
  buildRoute,
  learnRoute,
  exploreRoute,
  accountRoute,
]);

/** Browser history by default; pass a memory history in tests. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
    ...(history ? { history } : {}),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
