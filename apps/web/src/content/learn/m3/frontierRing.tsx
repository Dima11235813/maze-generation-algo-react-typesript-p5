/** M3.1 "The frontier is a ring": the pilot lesson of Learn mode (WI-06a, checks WI-06c). */
import { frontierCells } from '../../../learn/solveStructure';
import type { DemoState, LessonContent } from '../types';

/** The queue's distances, front first (BFS queues carry them on every entry). */
function queueDistances(demo: DemoState): number[] {
  if (!demo.structure) return [];
  return frontierCells(demo.structure).flatMap((c) => (c.distance === null ? [] : [c.distance]));
}

const paused = (demo: DemoState): boolean => demo.status === 'paused';

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        A maze is a graph: cells are its vertices and open passages its edges. To find the shortest
        way from the start to the goal, <strong>breadth-first search</strong> (BFS) explores every
        cell one step away, then every cell two steps away, and so on. Cells it has found but not
        explored yet form its <strong>frontier</strong>, and BFS keeps them in a{' '}
        <strong>queue</strong>.
      </p>
      <p>
        A queue is first in, first out. When BFS expands a cell it takes the one at the{' '}
        <em>front</em> of the queue, and every unexplored neighbour it finds joins the <em>back</em>
        . A neighbour is one step further from the start than the cell that found it, so the queue
        only ever holds cells from two neighbouring distances, <em>d</em> and <em>d + 1</em>. That
        is why the explored area spreads out evenly, like a ripple: the frontier is a ring.
      </p>
      <p>
        Step through the demo and watch the queue. The head is always the next cell expanded, new
        cells always join at the back, and the number next to each cell is its distance from the
        start.
      </p>
      <p>
        Every cell at distance <em>d</em> is expanded before any cell at distance <em>d + 1</em>. So
        the first time BFS reaches the goal, no shorter route can exist: on a maze where every step
        costs the same, BFS always finds a shortest path.
      </p>
    </>
  ),
  demo: {
    generatorId: 'prims',
    seed: 'frontier-ring',
    width: 12,
    height: 9,
    solverId: 'bfs',
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'Every cell is queued and expanded at most once (V), and every passage is looked at from both of its ends (E). The queue, the visited marks and the parent links each hold at most one entry per cell.',
  },
  tryIt: [
    {
      id: 'queue-past-six',
      prompt: 'Use Run until to stop as soon as the queue holds more than 6 cells.',
      hint: 'Under the maze, pick "the queue holds more than N cells", set N to 6 and press Run.',
      check: (demo) => paused(demo) && queueDistances(demo).length > 6,
      success: (demo) => {
        const d = queueDistances(demo);
        return `The queue holds ${String(d.length)} cells, from distance ${String(d[0] ?? 0)} to ${String(d[d.length - 1] ?? 0)}.`;
      },
    },
    {
      id: 'two-rings',
      prompt:
        'Pause while the queue holds cells at two different distances: the end of one ring and the start of the next.',
      hint: 'Step one cell at a time and watch the numbers in the queue.',
      check: (demo) => paused(demo) && new Set(queueDistances(demo)).size === 2,
      success: (demo) => {
        const d = queueDistances(demo);
        return `The front is at distance ${String(d[0] ?? 0)} and the back at ${String(d[d.length - 1] ?? 0)}.`;
      },
    },
    {
      id: 'reach-goal',
      prompt: 'Stop the demo on the step where BFS takes the goal from the front of the queue.',
      hint: 'Pick "it reaches the goal" in Run until.',
      check: (demo) =>
        paused(demo) &&
        demo.lastStep?.t === 'expand' &&
        demo.maze !== null &&
        demo.lastStep.cell === demo.maze.goal,
      success: (demo) => {
        const g = demo.lastStep?.t === 'expand' ? demo.lastStep.g : undefined;
        return `BFS took the goal at distance ${String(g ?? '?')}, so no route to it is shorter.`;
      },
    },
  ],
  tryThis: [
    'Pause when the queue is longest. Where in the maze are those cells?',
    'Run to the end and count the path: is there any shorter way to the goal?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'order',
        prompt: 'Which cell does BFS expand next?',
        choices: [
          'The one at the front of the queue: the earliest found',
          'The one at the back of the queue: the latest found',
          'The one that looks closest to the goal',
          'Any neighbour of the cell it expanded last',
        ],
        answer: 0,
        explain:
          'A queue is first in, first out, so cells are expanded in the order they were found.',
      },
      {
        id: 'ring',
        prompt: 'At any moment, the cells in the queue are at how many different distances?',
        choices: [
          'Always exactly one',
          'At most two: some distance d and d + 1',
          'Any number, depending on the maze',
          'As many as there are dead ends',
        ],
        answer: 1,
        explain:
          'Cells at distance d are expanded before any at d + 1, and each adds neighbours at d + 1 only, so the queue spans two neighbouring distances at most.',
      },
      {
        id: 'shortest',
        prompt: 'Why is the first path BFS finds to the goal a shortest one?',
        choices: [
          'It turns towards the goal at every fork',
          'It fills dead ends before it searches',
          'It reaches every cell at its smallest distance first, the goal included',
          'It tries every path and keeps the shortest',
        ],
        answer: 2,
        explain:
          'BFS settles cells in order of distance. When the goal is expanded at distance d, every cell closer than d was expanded already and none of them was the goal.',
      },
      {
        id: 'cost',
        prompt: 'A maze has V cells and E passages. How long does BFS take, at most?',
        choices: ['O(V)', 'O(V + E)', 'O(V x E)', 'O(V squared)'],
        answer: 1,
        explain:
          'Each cell is queued and expanded once (V) and each passage is looked at from both ends (E).',
      },
    ],
  },
};
