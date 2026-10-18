/** M3.3 "DFS or BFS?": both on one maze with loops, side by side (WI-06d). */
import type { DemoState, LessonContent } from '../types';

const lanes = (demo: DemoState) => demo.pair?.lanes ?? [];
const found = (demo: DemoState) => lanes(demo).filter((l) => l.pathMoves !== null);

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        Depth-first and breadth-first search differ in one line: DFS takes the <em>newest</em> cell
        from its stack, BFS the <em>oldest</em> from its queue. The demo runs both on the same maze,
        one step each per tick, so you can watch what that one line does.
      </p>
      <p>
        This maze has <strong>loops</strong>: some cells can be reached by more than one route. DFS
        dives down the first corridor it meets and keeps going; when it reaches a cell, it remembers
        the route it happened to take. If that route was a detour, its path to the goal is a detour
        too. DFS often reaches the goal early, but there is no promise that its path is short.
      </p>
      <p>
        BFS spreads out in rings, so it reaches every cell by a shortest route first. It usually
        expands more cells before it gets to the goal, but the path it finds is always a shortest
        one when every move costs the same.
      </p>
      <p>
        So the choice depends on the question. Need <em>a</em> way out, fast and with little memory
        on a long corridor? DFS is fine. Need the <em>shortest</em> way? Use BFS (or, when moves
        have different costs, Dijkstra and A*, in later modules).
      </p>
    </>
  ),
  demo: {
    kind: 'pair',
    generatorId: 'prims',
    seed: 'which-first',
    width: 10,
    height: 8,
    braid: 50,
    solverIds: ['bfs', 'dfs'],
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'The same for each: both expand every cell at most once and look at every passage from both ends; they differ only in the order. Worst case either may hold most of the cells: BFS a whole ring in its queue, DFS a long branch of untried neighbours on its stack.',
  },
  tryIt: [
    {
      id: 'first-path',
      prompt: 'Use Run until to stop when the first path is found. Which search got there first?',
      hint: 'Under the mazes, press Run with "the next path is found".',
      // Exactly one: once both have a path, "first" can no longer be read off the state.
      check: (demo) => demo.status === 'paused' && found(demo).length === 1,
      success: (demo) => {
        const first = found(demo)[0];
        return `${first?.name ?? 'A search'} found its path first, ${String(first?.pathMoves ?? 0)} moves long, after ${String(demo.stepCount)} steps.`;
      },
    },
    {
      id: 'both-paths',
      prompt: 'Keep going until both have found a path, and compare their lengths.',
      check: (demo) => lanes(demo).length > 0 && found(demo).length === lanes(demo).length,
      success: (demo) => {
        const parts = lanes(demo).map((l) => `${l.name} ${String(l.pathMoves ?? 0)} moves`);
        return `${parts.join(', ')}; the shortest possible is ${String(demo.pair?.shortest ?? 0)}.`;
      },
    },
  ],
  tryThis: [
    'Which search expanded more cells by the time it found its path? Was that worth it?',
    'Step back to the moment DFS found its path. Where did it take its detour?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'shortest',
        prompt:
          'On a maze with loops where every move costs the same, which search is sure to find a shortest path?',
        choices: ['Breadth-first search', 'Depth-first search', 'Both', 'Neither'],
        answer: 0,
        explain:
          'BFS reaches every cell by a shortest route first, the goal included. DFS keeps whatever route it found first.',
      },
      {
        id: 'detour',
        prompt: 'Why can DFS return a longer path on a maze with loops?',
        choices: [
          'It keeps the first route it finds to each cell, however roundabout',
          'It skips some cells of the maze',
          'It counts its moves wrongly',
          'It stops at the first dead end',
        ],
        answer: 0,
        explain:
          'Each cell remembers where DFS came from when it first reached it, and with loops that can be the long way round.',
      },
      {
        id: 'perfect',
        prompt: 'On a perfect maze, do BFS and DFS return paths of the same length?',
        choices: [
          'Yes: there is only one path between any two cells',
          'No: the BFS path is always shorter',
          'No: the DFS path is always shorter',
          'Only when the goal is in a corner',
        ],
        answer: 0,
        explain:
          'A perfect maze is a tree, so both must return the same path; they differ only in how many cells they expand first.',
      },
      {
        id: 'order',
        prompt: 'What is the one real difference between the two algorithms?',
        choices: [
          'DFS takes the newest cell next (a stack), BFS the oldest (a queue)',
          'DFS ignores walls',
          'BFS knows where the goal is',
          'DFS can only turn left',
        ],
        answer: 0,
        explain: 'Swap the stack for a queue and DFS becomes BFS; everything else is the same.',
      },
    ],
  },
};
