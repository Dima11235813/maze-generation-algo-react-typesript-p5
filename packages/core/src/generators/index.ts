import { createRegistry } from '../registry';
import { aldousBroder } from './aldousBroder';
import { binaryTree } from './binaryTree';
import { ellers } from './ellers';
import { growingTree } from './growingTree';
import { huntAndKill } from './huntAndKill';
import { kruskals } from './kruskals';
import { originShift } from './originShift';
import { prims } from './prims';
import { recursiveBacktracker } from './recursiveBacktracker';
import { recursiveDivision } from './recursiveDivision';
import { sidewinder } from './sidewinder';
import type { MazeGenerator } from './types';
import { wilsons } from './wilsons';

export type { MazeGenerator } from './types';
export {
  recursiveBacktracker,
  recursiveBacktrackerMeta,
  type RecursiveBacktrackerParams,
} from './recursiveBacktracker';
export { prims, primsMeta, type PrimsParams } from './prims';
export { kruskals, kruskalsMeta } from './kruskals';
export { aldousBroder, aldousBroderMeta } from './aldousBroder';
export { wilsons, wilsonsMeta } from './wilsons';
export { huntAndKill, huntAndKillMeta } from './huntAndKill';
export {
  growingTree,
  growingTreeMeta,
  type GrowingTreeParams,
  type GrowingTreeSelection,
} from './growingTree';
export { ellers, ellersMeta, type EllersParams } from './ellers';
export { sidewinder, sidewinderMeta, type SidewinderParams } from './sidewinder';
export {
  binaryTree,
  binaryTreeMeta,
  type BinaryTreeBias,
  type BinaryTreeParams,
} from './binaryTree';
export {
  recursiveDivision,
  recursiveDivisionMeta,
  type RecursiveDivisionParams,
} from './recursiveDivision';
export { originShift, originShiftMeta, type OriginShiftParams } from './originShift';
export { DisjointSet } from './disjointSet';
export { BinaryHeap, type HeapEntry } from './binaryHeap';

/** All generators. Add a file + an entry here; menus, tests and enums follow automatically. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generators = createRegistry<MazeGenerator<any>>([
  recursiveBacktracker,
  growingTree,
  prims,
  kruskals,
  aldousBroder,
  wilsons,
  huntAndKill,
  ellers,
  sidewinder,
  binaryTree,
  recursiveDivision,
  originShift,
]);
