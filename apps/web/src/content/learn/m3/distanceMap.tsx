/** M3.2 "Reading a distance map": flood fill from the goal, then walk downhill (WI-06d). */
import { cellCount } from '@maze/core';
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

/** The start's distance from the goal, once the flood has reached it. */
function startDistance(demo: DemoState): number | null {
  const d = demo.maze ? demo.structure?.distances?.dist[demo.maze.start] : undefined;
  return d === undefined || d < 0 ? null : d;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        A <strong>distance map</strong> labels every cell with how many moves it takes to get from
        that cell to one chosen cell. <strong>Flood fill</strong> builds one by running
        breadth-first search from the <em>goal</em>: the goal gets 0, its neighbours 1, their new
        neighbours 2, and so on, ring by ring, until the flood has reached every cell it can.
      </p>
      <p>
        Read the map in the demo as a landscape that slopes down towards the goal. From any cell, a
        neighbour through an open passage that is exactly one lower is one move closer. So once the
        map is complete, finding a shortest path needs no more searching: start anywhere and keep
        stepping downhill until you reach 0. Flood fill does just that from the start, and the
        number on the start cell is the length of the shortest path.
      </p>
      <p>
        That is the real gift of the map: one flood answers &ldquo;how far, and which way?&rdquo;
        for <em>every</em> cell at once. Games use the same idea to steer many monsters towards one
        player with a single search. Cells the flood never reaches have no number: they are cut off
        from the goal.
      </p>
    </>
  ),
  demo: {
    kind: 'solve',
    generatorId: 'prims',
    seed: 'downhill',
    width: 12,
    height: 9,
    solverId: 'flood-fill',
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'The flood is a breadth-first search: every cell is queued and expanded once, every passage looked at from both ends. The walk downhill then takes one move per unit of distance. The map holds one number per cell.',
  },
  tryIt: [
    {
      id: 'reach-start',
      prompt: 'Use Run until to stop when the flood reaches the start. What number does it get?',
      hint: 'Under the maze, pick "it reaches the start" and press Run.',
      check: (demo) =>
        paused(demo) &&
        demo.lastStep?.t === 'expand' &&
        demo.maze !== null &&
        demo.lastStep.cell === demo.maze.start,
      success: (demo) => {
        const d = startDistance(demo) ?? 0;
        return `The flood reached the start at distance ${String(d)}: the shortest path has ${String(d)} moves.`;
      },
    },
    {
      id: 'map-complete',
      prompt: 'Let the flood cover the whole maze, so that every cell has a number.',
      hint: 'Run until "the path is found": the flood finishes first.',
      check: (demo) =>
        demo.maze !== null &&
        demo.structure?.distances?.settled === cellCount(demo.maze.grid) &&
        demo.status !== 'playing',
      success: (demo) =>
        `Every one of the ${String(demo.structure?.distances?.settled ?? 0)} cells has a distance; the farthest is ${String(demo.structure?.distances?.max ?? 0)} moves from the goal.`,
    },
    {
      id: 'downhill',
      prompt: 'Run to the end and follow the path: every move goes one number lower.',
      check: (demo) => demo.status === 'done' && startDistance(demo) !== null,
      success: (demo) => {
        const d = startDistance(demo) ?? 0;
        return `The walk took ${String(d)} moves, from ${String(d)} at the start down to 0 at the goal.`;
      },
    },
  ],
  tryThis: [
    'Find the cell with the largest number. Is it a dead end?',
    'Pick any cell and walk downhill in your head. Do you always reach the goal?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'meaning',
        prompt: 'In a distance map built from the goal, what does the number on a cell mean?',
        choices: [
          'The fewest moves from that cell to the goal',
          'How many walls the cell has',
          'The order in which the cell was found',
          'Its straight-line distance to the goal',
        ],
        answer: 0,
        explain:
          'The flood is breadth-first, so each cell is labelled the first time it is reached: by a shortest route.',
      },
      {
        id: 'next',
        prompt: 'You stand on a cell marked 7. Where is the next cell on a shortest path?',
        choices: [
          'Through an open passage, to a neighbour marked 6',
          'To any neighbour marked 8',
          'To the neighbour nearest the goal in a straight line',
          'To any neighbour at all',
        ],
        answer: 0,
        explain:
          'A neighbour one lower is one move closer. Following it 7 times reaches the goal at 0.',
      },
      {
        id: 'cut-off',
        prompt: 'What number does a cell get if it is cut off from the goal?',
        choices: [
          'None: the flood never reaches it',
          '0',
          'The largest number on the map plus one',
          'The same number as the start',
        ],
        answer: 0,
        explain: 'The flood only travels through passages, so a cut-off cell is never labelled.',
      },
      {
        id: 'reuse',
        prompt: 'Why build the map once from the goal instead of searching from each start?',
        choices: [
          'One flood gives a shortest route from every cell at once',
          'It needs less memory than breadth-first search',
          'It is the only way to find dead ends',
          'A flood visits fewer cells than a search',
        ],
        answer: 0,
        explain:
          'Every cell gets its distance from the one flood, so any number of starts can walk downhill with no new search.',
      },
    ],
  },
};
