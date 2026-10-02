import { createRegistry } from '../registry';
import { astar } from './astar';
import { bfs } from './bfs';
import { bidirectionalBfs } from './bidirectionalBfs';
import { deadEndFilling } from './deadEndFilling';
import { dfs } from './dfs';
import { dijkstra } from './dijkstra';
import { floodFill } from './floodFill';
import { greedyBestFirst } from './greedyBestFirst';
import { pledge } from './pledge';
import { randomMouse } from './randomMouse';
import { tremaux } from './tremaux';
import type { MazeSolver } from './types';
import { wallFollower } from './wallFollower';

export type { MazeSolver, SolveResult } from './types';
export { reconstructPath } from './types';
export { bfs, bfsMeta } from './bfs';
export { dfs, dfsMeta } from './dfs';
export { dijkstra, dijkstraMeta, type DijkstraParams } from './dijkstra';
export { astar, astarMeta, type AStarParams } from './astar';
export { greedyBestFirst, greedyBestFirstMeta, type GreedyBestFirstParams } from './greedyBestFirst';
export { bidirectionalBfs, bidirectionalBfsMeta } from './bidirectionalBfs';
export { wallFollower, wallFollowerMeta, handOrder, type Hand, type WallFollowerParams } from './wallFollower';
export { tremaux, tremauxMeta, type TremauxParams } from './tremaux';
export { pledge, pledgeMeta, quarterTurns, type PledgeParams } from './pledge';
export { deadEndFilling, deadEndFillingMeta } from './deadEndFilling';
export { floodFill, floodFillMeta } from './floodFill';
export { randomMouse, randomMouseMeta, type RandomMouseParams } from './randomMouse';
export { HEURISTIC_IDS, heuristicFn, loopErase, type HeuristicId } from './shared';

/**
 * All solvers. Order is the order shown in menus: map solvers (search), then elimination and
 * distance-field methods, then agent-perspective walkers, then the random baseline.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const solvers = createRegistry<MazeSolver<any>>([
  bfs,
  dfs,
  dijkstra,
  astar,
  greedyBestFirst,
  bidirectionalBfs,
  deadEndFilling,
  floodFill,
  wallFollower,
  tremaux,
  pledge,
  randomMouse,
]);
