import { createRegistry } from '../registry';
import type { MazePostprocessor } from './types';

export type { MazePostprocessor } from './types';

/** All post-processors (braid, sparsify, ...). Register new ones here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const postprocessors = createRegistry<MazePostprocessor<any>>([]);
