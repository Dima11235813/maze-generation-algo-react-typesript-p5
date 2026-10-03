/** Text and layout helpers for the Race page (kept out of component files for fast refresh). */
import type { RaceResult } from '@maze/core';
import { solverName, type LaneStanding } from '../../maze/race';

const tickText = (n: number | null | undefined): string =>
  n === null || n === undefined ? '?' : String(n);

export function laneStatusText(s: LaneStanding): string {
  switch (s.status) {
    case 'goal':
      return `reached the goal at tick ${tickText(s.finishedAtTick)}, path ${tickText(s.pathLength)} moves`;
    case 'no-path':
      return `finished without a path at tick ${tickText(s.finishedAtTick)}`;
    case 'out':
      return `stopped at tick ${tickText(s.finishedAtTick)}`;
    case 'running':
    default:
      return s.steps === 0 ? 'on the start line' : `racing, ${String(s.expanded)} cells expanded`;
  }
}

/** Compact status for narrow lanes (phones, four lanes on a tablet). */
export function laneStatusShort(s: LaneStanding): string {
  switch (s.status) {
    case 'goal':
      return `Goal at tick ${tickText(s.finishedAtTick)} · ${tickText(s.pathLength)} moves`;
    case 'no-path':
      return `No path · tick ${tickText(s.finishedAtTick)}`;
    case 'out':
      return `Stopped · tick ${tickText(s.finishedAtTick)}`;
    case 'running':
    default:
      return s.steps === 0 ? 'Ready' : `${String(s.expanded)} expanded`;
  }
}

/** Height of a lane header, subtracted when choosing how many lanes go in a row. */
const LANE_HEADER_PX = 33;

/**
 * Picks the column count that gives each (square) maze the most room in a `width` x `height`
 * box: two lanes stack on a phone, sit side by side on a tablet, four make a 2 x 2 grid unless
 * the box is very wide.
 */
export function bestColumns(n: number, width: number, height: number): number {
  if (width <= 0 || height <= 0) return Math.min(n, 2);
  let best = 1;
  let bestSide = -1;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const side = Math.min(width / cols, height / rows - LANE_HEADER_PX);
    // Another column must clearly help (10%), so near-ties do not flip the layout when the
    // stage changes height by a few pixels.
    if (side > bestSide * 1.1) {
      best = cols;
      bestSide = side;
    }
  }
  return best;
}

export function describeOutcome(result: RaceResult, id: string): string {
  const r = result.perAgent[id];
  if (!r) return '';
  if (r.disqualified) return `Disqualified (${r.disqualified})`;
  if (!r.reachedGoal) return 'No path found';
  return `Goal at tick ${tickText(r.finishedAtTick)}`;
}

/** Plain-language winner sentence for the live region and the ranking caption. */
export function winnerSentence(result: RaceResult): string {
  const id = result.ranking[0];
  const r = id ? result.perAgent[id] : undefined;
  if (!id || !r || !r.reachedGoal || r.disqualified) return 'Race over: nobody reached the goal.';
  const how =
    result.config.scoring === 'fewest-expanded'
      ? `expanding only ${String(r.expanded)} cells`
      : result.config.scoring === 'composite'
        ? 'with the best composite score'
        : `reaching the goal first at tick ${tickText(r.finishedAtTick)}`;
  return `Winner: ${solverName(id)}, ${how}.`;
}
