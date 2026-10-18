/** M5.1 "Aldous-Broder walks at random": a uniform spanning tree from a plain random walk. */
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function walk(demo: DemoState) {
  const s = demo.genStructure?.structure;
  return s?.kind === 'walk' ? s.walk : null;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        Every generator so far has a habit. The backtracker carves long corridors; Prim&rsquo;s
        grows a blob with many short dead ends. A maze generator is <strong>uniform</strong> when it
        has no habit at all: every possible perfect maze of the grid (every spanning tree) is
        equally likely to come out.
      </p>
      <p>
        <strong>Aldous-Broder</strong> gets there with the simplest idea imaginable. Start a walker
        on any cell. At each step, move to a random neighbour, ignoring walls. Whenever the walker
        enters a cell it has <em>never</em> been in, carve the wall it came through. Stop when every
        cell has been entered. Each cell is carved into exactly once, from the cell the walk came
        from, so the result is a tree; and because the walk has no preference, the tree is a
        uniformly random one (the proof is a beautiful piece of probability theory).
      </p>
      <p>
        The price is time. Early on, almost every step finds a new cell. Later, the walker spends
        most of its steps crossing cells it has already been in, waiting to stumble on the last few.
        Watch &ldquo;Longest wait&rdquo; beside the maze grow towards the end: the expected time to
        visit every cell (the cover time) grows faster than the number of cells.
      </p>
    </>
  ),
  demo: {
    kind: 'generate',
    generatorId: 'aldous-broder',
    seed: 'random-walk',
    width: 8,
    height: 6,
  },
  complexity: {
    time: 'O(V log² V) expected',
    space: 'O(V)',
    why: 'The walk ends when it has visited every cell; on a square grid that takes on the order of V log² V steps, far more than the V - 1 carves. Space is one visited mark per cell.',
  },
  tryIt: [
    {
      id: 'half',
      prompt: 'Run until 24 or fewer cells are left outside the tree: half the maze.',
      hint: 'Pick "N or fewer cells are left outside the tree" and set N to 24.',
      check: (demo) =>
        paused(demo) && (walk(demo)?.inTree ?? 0) * 2 >= (walk(demo)?.cells ?? Infinity),
      success: (demo) =>
        `Half the maze took ${String(walk(demo)?.walkSteps ?? 0)} walk steps; ${String((walk(demo)?.cells ?? 0) - (walk(demo)?.inTree ?? 0))} cells are still outside.`,
    },
    {
      id: 'last-few',
      prompt: 'Run on until only 3 cells are left, and compare the walk steps with the first half.',
      hint: 'Same breakpoint, with N set to 3.',
      check: (demo) => {
        const w = walk(demo);
        return paused(demo) && w !== null && w.walkSteps > 0 && w.cells - w.inTree <= 3;
      },
      success: (demo) =>
        `${String(walk(demo)?.walkSteps ?? 0)} walk steps so far; the longest wait for a new cell was ${String(walk(demo)?.longestWait ?? 0)} steps.`,
    },
    {
      id: 'complete',
      prompt: 'Run to the end.',
      check: (demo) =>
        (demo.status === 'done' || demo.lastStep?.t === 'done') &&
        walk(demo)?.inTree === walk(demo)?.cells,
      success: (demo) =>
        `${String(walk(demo)?.walkSteps ?? 0)} walk steps built a tree of ${String(walk(demo)?.cells ?? 0)} cells with ${String((walk(demo)?.cells ?? 1) - 1)} passages.`,
    },
  ],
  tryThis: [
    'Restart and run to the end again at full speed. Which part of the run takes longest?',
    'How many walk steps were wasted crossing cells already in the tree?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'uniform',
        prompt: 'What does it mean that a maze generator is uniform?',
        choices: [
          'Every possible perfect maze of the grid is equally likely',
          'Every cell gets the same number of passages',
          'All corridors have the same length',
          'The maze looks the same from every side',
        ],
        answer: 0,
        explain: 'Uniform is about the choice of tree, not its shape: no tree is preferred.',
      },
      {
        id: 'carve',
        prompt: 'When does Aldous-Broder carve a wall?',
        choices: [
          'When the walk enters a cell for the first time',
          'At every step of the walk',
          'When the walk reaches a dead end',
          'When the walk turns back',
        ],
        answer: 0,
        explain: 'Only first entries carve, so each cell is joined once: a tree.',
      },
      {
        id: 'slow',
        prompt: 'Why does Aldous-Broder slow down near the end?',
        choices: [
          'The walk mostly crosses cells already in the tree before it finds the last few',
          'Its stack grows too large',
          'It checks every wall for loops',
          'It restarts the walk after every carve',
        ],
        answer: 0,
        explain:
          'With few new cells left, a random step is unlikely to hit one, so the waits between carves get long.',
      },
      {
        id: 'loop',
        prompt: 'Can an Aldous-Broder maze contain a loop?',
        choices: [
          'No: it only carves into cells the walk has never entered',
          'Yes, now and then',
          'Only on large grids',
          'Yes, but it removes them at the end',
        ],
        answer: 0,
        explain: 'A loop would need a passage into a cell that is already in the tree.',
      },
    ],
  },
};
