import { createRegistry } from '../registry';
import { braid } from './braid';
import type { MazePostprocessor } from './types';

export type { MazePostprocessor } from './types';
export { braid, braidMeta, type BraidParams } from './braid';

/** All post-processors (braid, sparsify, ...). Register new ones here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const postprocessors = createRegistry<MazePostprocessor<any>>([braid]);
