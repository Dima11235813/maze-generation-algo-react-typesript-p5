/** M3.1 "The frontier is a ring": the pilot lesson of Learn mode (WI-06a). */
import type { LessonContent } from '../types';

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
  tryThis: [
    'Pause when the queue is longest. Where in the maze are those cells?',
    'Step until the distance at the head of the queue changes. What happened to the ring?',
    'Run to the end and count the path: is there any shorter way to the goal?',
  ],
};
