/** Wording for solver statistics shared by Watch (and later Race/Compare). */

/**
 * Whether this path was a shortest one (measured against the maze), and whether the solver
 * guarantees it: weighted A* or a wall follower can find the shortest path in a perfect maze
 * (there is only one) without promising it.
 */
export function optimalText(guaranteed: boolean | null, ratio: number | null): string {
  if (ratio === null) return guaranteed === null ? 'unknown' : guaranteed ? 'yes' : 'no';
  if (ratio > 1) return 'no';
  return guaranteed === true ? 'yes' : 'yes (not guaranteed)';
}
