/** M7.1 "A* counts the cost so far": A* and greedy best-first side by side (WI-06e e.3). */
import type { DemoState, LessonContent } from '../types';

const lanes = (demo: DemoState) => demo.pair?.lanes ?? [];
const found = (demo: DemoState) => lanes(demo).filter((l) => l.pathMoves !== null);
const byId = (demo: DemoState, id: string) => lanes(demo).find((l) => l.solverId === id);

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        Both searches keep a priority queue and always expand its smallest entry. They differ in the
        key. <strong>Greedy best-first</strong> ranks a cell by <em>h</em>, a guess at the distance
        still to go; here the Manhattan distance, rows plus columns to the goal, ignoring walls.{' '}
        <strong>A*</strong> ranks it by <em>f = g + h</em>: the moves already spent to reach it plus
        the same guess.
      </p>
      <p>
        Greedy only looks forward. A corridor that points at the goal looks perfect even when a wall
        at its end sends the route all the way round, and once greedy has walked a long way in, it
        keeps the long route it took. It often reaches the goal quickly, but its path can be far
        from the shortest.
      </p>
      <p>
        A* also looks back. A cell reached by a long detour has a large <em>g</em>, so it waits
        while cheaper cells go first. As long as <em>h</em> never over-estimates the distance left
        (it is <strong>admissible</strong>), A* returns a shortest path. Manhattan distance is
        admissible on this grid: no route can be shorter than the rows and columns between you and
        the goal.
      </p>
      <p>
        So A* pays for its guarantee by expanding more cells, and greedy saves work by taking a
        gamble. Watch where greedy commits to a corridor that A* abandons.
      </p>
    </>
  ),
  demo: {
    kind: 'pair',
    generatorId: 'prims',
    seed: 'm7-7',
    width: 12,
    height: 9,
    braid: 50,
    solverIds: ['astar', 'greedy-best-first'],
  },
  complexity: {
    time: 'O((V + E) log V)',
    space: 'O(V)',
    why: 'Both expand each cell at most once and push each neighbour into a binary heap, so every push and pop costs log V. The heuristic changes how many cells are expanded before the goal, not the worst case.',
  },
  tryIt: [
    {
      id: 'first-path',
      prompt: 'Use Run until to stop when the first path is found. Which search got there first?',
      hint: 'Under the mazes, press Run with "the next path is found".',
      check: (demo) => demo.status === 'paused' && found(demo).length === 1,
      success: (demo) => {
        const first = found(demo)[0];
        return `${first?.name ?? 'A search'} found its path first, ${String(first?.pathMoves ?? 0)} moves long, after ${String(demo.stepCount)} steps.`;
      },
    },
    {
      id: 'greedy-longer',
      prompt: 'Run both to the end. How much longer is the greedy path than the shortest one?',
      check: (demo) => {
        const g = byId(demo, 'greedy-best-first')?.pathMoves;
        const shortest = demo.pair?.shortest;
        return g != null && shortest != null && g > shortest;
      },
      success: (demo) => {
        const g = byId(demo, 'greedy-best-first')?.pathMoves ?? 0;
        const shortest = demo.pair?.shortest ?? 0;
        return `Greedy's path is ${String(g)} moves, ${String(g - shortest)} more than the shortest ${String(shortest)}.`;
      },
    },
    {
      id: 'astar-optimal',
      prompt: 'Check that A* found a shortest path, and count the cells it expanded to be sure.',
      check: (demo) => {
        const a = byId(demo, 'astar');
        return a?.pathMoves != null && a.pathMoves === demo.pair?.shortest;
      },
      success: (demo) => {
        const a = byId(demo, 'astar');
        const g = byId(demo, 'greedy-best-first');
        return `A* found the shortest path, ${String(a?.pathMoves ?? 0)} moves, after expanding ${String(a?.expanded ?? 0)} cells; greedy had expanded ${String(g?.expanded ?? 0)} when it finished.`;
      },
    },
  ],
  tryThis: [
    'Step back to where greedy enters its detour. What did h say about that corridor?',
    'Find a cell A* expanded that greedy never touched. Why did A* need it?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'key',
        prompt: 'Which value does A* use to choose the next cell to expand?',
        choices: [
          'f = g + h: the cost so far plus the estimate of the cost left',
          'h alone: the estimate of the cost left',
          'g alone: the cost so far',
          'The order the cells were discovered in',
        ],
        answer: 0,
        explain:
          'A* adds the two. Greedy best-first uses h alone; Dijkstra uses g alone; BFS uses discovery order.',
      },
      {
        id: 'admissible',
        prompt: 'What makes a heuristic admissible?',
        choices: [
          'It never over-estimates the real distance to the goal',
          'It is always exact',
          'It never under-estimates the real distance to the goal',
          'It is fast to compute',
        ],
        answer: 0,
        explain:
          'An admissible h is optimistic: it may say the goal is closer than it is, never farther. Then A* cannot skip past the shortest path.',
      },
      {
        id: 'greedy-fails',
        prompt: 'Why can greedy best-first return a longer path than necessary?',
        choices: [
          'It ignores how far it has already come, so it keeps a long route that looked promising',
          'It does not keep a closed set',
          'Its heuristic over-estimates',
          'It expands cells in random order',
        ],
        answer: 0,
        explain:
          'Greedy never looks at g, so a cell reached by a detour is as good to it as one reached directly.',
      },
      {
        id: 'manhattan',
        prompt:
          'On a grid where you move up, down, left or right, why is Manhattan distance admissible?',
        choices: [
          'Every route must cross at least that many rows and columns, walls only add to it',
          'It is the straight-line distance',
          'It counts the walls between the cell and the goal',
          'It is always equal to the real distance',
        ],
        answer: 0,
        explain:
          'Each move changes the row or the column by one, so no route can be shorter than the rows plus columns between you and the goal.',
      },
    ],
  },
};
