import { createRegistry } from '../registry';
import { bfs } from './bfs';
import { dfs } from './dfs';
import type { MazeSolver } from './types';

export type { MazeSolver, SolveResult } from './types';
export { reconstructPath } from './types';
export { bfs, bfsMeta } from './bfs';
export { dfs, dfsMeta } from './dfs';

/** All solvers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const solvers = createRegistry<MazeSolver<any>>([bfs, dfs]);
