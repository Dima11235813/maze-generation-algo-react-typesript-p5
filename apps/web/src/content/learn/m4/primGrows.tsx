/** M4.1 "Prim's grows one tree": the frontier around a single growing tree (WI-06e). */
import { cellCount } from '@maze/core';
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function frontier(demo: DemoState) {
  const s = demo.genStructure?.structure;
  return s?.kind === 'frontier' ? s.frontier : null;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        A perfect maze is a spanning tree (module 1), so any algorithm that builds a random spanning
        tree builds a maze. <strong>Prim&rsquo;s algorithm</strong> grows <em>one</em> tree outwards
        from a start cell. At every moment the cells split three ways: cells in the tree, cells
        touching the tree but not in it (the <strong>frontier</strong>), and cells not reached yet.
      </p>
      <p>
        Each round takes one cell out of the frontier at random, joins it to a neighbour that is
        already in the tree by carving the wall between them, and adds its own new neighbours to the
        frontier. A cell joins the tree exactly once and by exactly one passage, so no loop can
        form; when the frontier is empty, every cell is in the tree.
      </p>
      <p>
        Watch the frontier in the demo. Because any frontier cell may be chosen next, the tree grows
        on all sides at once, like a blob, and the maze comes out with many short dead ends and
        fairly direct routes. Compare that with the recursive backtracker of module 2, which always
        extends its newest cell and carves long corridors.
      </p>
      <p>
        The textbook Prim&rsquo;s gives every passage a random weight and always takes the cheapest
        frontier edge; it builds a minimum spanning tree. The version here simply picks a random
        frontier cell, which is quicker and looks much the same.
      </p>
    </>
  ),
  demo: {
    kind: 'generate',
    generatorId: 'prims',
    seed: 'one-tree',
    width: 10,
    height: 7,
  },
  complexity: {
    time: 'O(V)',
    space: 'O(V)',
    why: 'Each cell enters the frontier once and leaves it once, and taking a random frontier cell is O(1) with a swap-remove. The weighted textbook version keeps edges in a binary heap, which costs O(E log E).',
  },
  tryIt: [
    {
      id: 'frontier-past-ten',
      prompt: 'Use Run until to stop when the frontier holds more than 10 cells.',
      hint: 'Pick "the frontier holds more than N cells" and set N to 10.',
      check: (demo) => paused(demo) && (frontier(demo)?.cells.length ?? 0) > 10,
      success: (demo) =>
        `The frontier holds ${String(frontier(demo)?.cells.length ?? 0)} cells around a tree of ${String(frontier(demo)?.inTree ?? 0)}.`,
    },
    {
      id: 'half',
      prompt: 'Pause when the tree holds at least half of the cells.',
      hint: 'Step or play, and watch "In the tree" beside the maze.',
      check: (demo) =>
        paused(demo) &&
        demo.maze !== null &&
        (frontier(demo)?.inTree ?? 0) * 2 >= cellCount(demo.maze.grid),
      success: (demo) =>
        `${String(frontier(demo)?.inTree ?? 0)} cells are in the tree, ${String(frontier(demo)?.cells.length ?? 0)} wait in the frontier.`,
    },
    {
      id: 'complete',
      prompt: 'Run to the end: the frontier is empty and every cell is in the tree.',
      check: (demo) =>
        (demo.status === 'done' || demo.lastStep?.t === 'done') &&
        demo.maze !== null &&
        frontier(demo)?.inTree === cellCount(demo.maze.grid),
      success: (demo) =>
        `All ${String(frontier(demo)?.inTree ?? 0)} cells are in the tree; the frontier was at most ${String(frontier(demo)?.peak ?? 0)} cells.`,
    },
  ],
  tryThis: [
    'Before a round, guess which frontier cell joins next. Why can you not know?',
    'Compare the finished maze with the backtracker lesson: which has longer corridors?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'frontier',
        prompt: "What is Prim's frontier?",
        choices: [
          'The cells next to the tree that are not in it yet',
          'The cells on the path from the start to the current cell',
          'Every cell not in the tree',
          'The dead ends found so far',
        ],
        answer: 0,
        explain: 'Only cells touching the tree can join it next, so those are the ones kept.',
      },
      {
        id: 'no-loop',
        prompt: "Why does Prim's never make a loop?",
        choices: [
          'Each cell joins the tree once, by one passage, from outside the tree',
          'It checks every new passage for loops',
          'It carves only towards the goal',
          'It always takes the oldest frontier cell',
        ],
        answer: 0,
        explain:
          'A loop needs a passage between two cells already in the tree. Prim only ever links a cell that is not in it yet.',
      },
      {
        id: 'shape',
        prompt: 'Why does a Prim maze look like a blob, with many short dead ends?',
        choices: [
          'Any frontier cell can be next, so the tree grows on all sides at once',
          'It always extends the newest cell, deep into the grid',
          'It starts from every cell at the same time',
          'It removes long corridors at the end',
        ],
        answer: 0,
        explain:
          'Random choice over the whole frontier spreads growth evenly; the backtracker extends one corridor at a time.',
      },
      {
        id: 'count',
        prompt: "How many passages does Prim's carve on a 70-cell grid?",
        choices: ['35', '69', '70', 'It depends on the seed'],
        answer: 1,
        explain:
          'Every cell but the start joins once, by one passage: 69, as for every spanning tree.',
      },
    ],
  },
};
