/** M2.1 "The backtracker carves a tree": the recursive backtracker step by step (WI-06d). */
import { describePosition, openNeighbors, passageCount, cellCount } from '@maze/core';
import { genStackCells } from '../../../learn/genStructure';
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function stackSize(demo: DemoState): number {
  return demo.genStructure ? genStackCells(demo.genStructure).length : 0;
}

function where(demo: DemoState, cell: number): string {
  return demo.maze ? describePosition(demo.maze.grid, cell) : 'that cell';
}

/** The walk just backed out of a cell with one passage: a leaf, so a dead end for good. */
function stuck(demo: DemoState): boolean {
  const s = demo.lastStep;
  return (
    paused(demo) &&
    s?.t === 'backtrack' &&
    demo.maze !== null &&
    openNeighbors(demo.maze, s.from).length === 1
  );
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        The <strong>recursive backtracker</strong> builds a maze by walking. It starts with every
        wall standing, then repeatedly knocks down the wall into a random neighbour it has not
        visited yet and steps through. The walk wanders deep into the grid, carving one long
        corridor.
      </p>
      <p>
        Sooner or later it reaches a cell whose neighbours are all visited: it is{' '}
        <strong>stuck</strong>. It then <strong>backtracks</strong>: it steps back the way it came,
        one cell at a time, until it finds a cell with an unvisited neighbour, and carves on from
        there. To know the way back it keeps a <strong>stack</strong> of the cells on its path from
        the start. Carving pushes the new cell on top; backtracking pops the top off.
      </p>
      <p>
        Watch the stack in the demo. It grows while the walk carves and shrinks when it backs up,
        and its top is always the current cell. When the stack is empty again, every cell has been
        visited and the maze is finished.
      </p>
      <p>
        Why is the result a perfect maze, with exactly one path between any two cells? The walk only
        ever carves into a cell it has <em>never</em> visited, so it never joins two cells that are
        already connected: no loops. And it does not stop until every cell is visited: nothing is
        cut off. A connected graph with no loops is a <strong>tree</strong>, and a tree with V cells
        has exactly V - 1 passages.
      </p>
    </>
  ),
  demo: {
    kind: 'generate',
    generatorId: 'recursive-backtracker',
    seed: 'carve-a-tree',
    width: 10,
    height: 7,
  },
  complexity: {
    time: 'O(V)',
    space: 'O(V)',
    why: 'Each cell is carved into once and backed out of once, and each looks at its four neighbours. The stack can hold every cell at once: on one long corridor the path from the start runs through the whole maze.',
  },
  tryIt: [
    {
      id: 'first-backtrack',
      prompt: 'Use Run until to stop on the next backtrack, then look at the top of the stack.',
      hint: 'Under the maze, pick "the next backtrack" and press Run.',
      check: (demo) => paused(demo) && demo.lastStep?.t === 'backtrack',
      success: (demo) => {
        const s = demo.lastStep;
        const from = s?.t === 'backtrack' ? where(demo, s.from) : 'a cell';
        return `It backed up from ${from}; the stack holds ${String(stackSize(demo))} cells, the current one on top.`;
      },
    },
    {
      id: 'stuck',
      prompt: 'Stop on a step where the walk is stuck in a new dead end.',
      hint: 'Pick "the walk is stuck in a new dead end". Backing out of a junction does not count.',
      check: stuck,
      success: (demo) => {
        const s = demo.lastStep;
        const at = s?.t === 'backtrack' ? where(demo, s.from) : 'that cell';
        return `Stuck at ${at}: every neighbour was visited, so that cell stays a dead end.`;
      },
    },
    {
      id: 'deep-stack',
      prompt:
        'Stop when the stack holds more than 20 cells: a path of 20 passages back to the start.',
      hint: 'Pick "the stack holds more than N cells" and set N to 20.',
      check: (demo) => paused(demo) && stackSize(demo) > 20,
      success: (demo) =>
        `The stack holds ${String(stackSize(demo))} cells: the way back to the start is ${String(stackSize(demo) - 1)} passages long.`,
    },
    {
      id: 'complete',
      prompt: 'Run the generator to the end and count: the maze has one passage fewer than cells.',
      check: (demo) =>
        (demo.status === 'done' || demo.lastStep?.t === 'done') &&
        demo.maze !== null &&
        stackSize(demo) === 0,
      success: (demo) => {
        const m = demo.maze;
        if (!m) return 'The maze is complete.';
        return `The maze is complete: ${String(cellCount(m.grid))} cells joined by ${String(passageCount(m))} passages, one fewer, as in every tree.`;
      },
    },
  ],
  tryThis: [
    'Before you press Step, guess the next cell the walk carves into. Which cells could it be?',
    'Find the longest corridor in the finished maze. Where was the stack deepest?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'stuck',
        prompt: 'The current cell has no unvisited neighbour. What does the backtracker do?',
        choices: [
          'Carves into a visited neighbour',
          'Pops the stack and steps back to the cell it came from',
          'Jumps to a random unvisited cell',
          'Stops: the maze is finished',
        ],
        answer: 1,
        explain:
          'It backs up along the path it came by, one cell at a time, until a cell has an unvisited neighbour again.',
      },
      {
        id: 'stack',
        prompt: 'What is on the stack at any moment?',
        choices: [
          'Every cell visited so far',
          'The path from the start to the current cell',
          'The dead ends found so far',
          'The walls still to carve',
        ],
        answer: 1,
        explain:
          'Carving pushes the new cell and backtracking pops it, so the stack is exactly the way back to the start.',
      },
      {
        id: 'tree',
        prompt: 'Why does the backtracker never make a loop?',
        choices: [
          'It carves only into unvisited cells, so it never joins two cells already connected',
          'It looks for loops at the end and seals them',
          'It carves the neighbours in a fixed order',
          'A grid cannot have loops',
        ],
        answer: 0,
        explain:
          'A loop needs a passage between two cells that are already connected. Every carve joins a brand-new cell to the tree instead.',
      },
      {
        id: 'count',
        prompt: 'A backtracker maze has 70 cells. How many passages does it have?',
        choices: ['35', '69', '70', '140'],
        answer: 1,
        explain:
          'Each carve joins one new cell, and every cell but the start is joined exactly once: V - 1 passages, like every tree.',
      },
    ],
  },
};
