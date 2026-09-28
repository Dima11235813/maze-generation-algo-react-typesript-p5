import { createRegistry } from '../registry';
import { recursiveBacktracker } from './recursiveBacktracker';
import type { MazeGenerator } from './types';

export type { MazeGenerator } from './types';
export {
  recursiveBacktracker,
  recursiveBacktrackerMeta,
  type RecursiveBacktrackerParams,
} from './recursiveBacktracker';

/** All generators. Add a file + an entry here; menus, tests and enums follow automatically. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generators = createRegistry<MazeGenerator<any>>([recursiveBacktracker]);
