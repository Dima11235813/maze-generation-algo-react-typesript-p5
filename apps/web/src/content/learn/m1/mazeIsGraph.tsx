/** M1.1 "A maze is a graph": cells, passages, degree, loops and pieces, by editing (WI-06d). */
import { describePosition } from '@maze/core';
import type { DemoState, LessonContent } from '../types';

function selectedText(demo: DemoState): string {
  const cell = demo.graph?.selected ?? null;
  if (cell === null || !demo.maze) return 'That cell';
  const pos = describePosition(demo.maze.grid, cell);
  return pos.charAt(0).toUpperCase() + pos.slice(1);
}

const degree = (demo: DemoState): number | null => demo.graph?.degree ?? null;

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        Every maze on this site is a <strong>graph</strong>. Each cell is a <strong>vertex</strong>,
        and each open passage between two neighbouring cells is an <strong>edge</strong>. Walls are
        simply edges that are missing. Every algorithm in the later lessons works on this graph, not
        on the picture.
      </p>
      <p>
        The <strong>degree</strong> of a cell is how many passages it has. A cell of degree 1 is a{' '}
        <strong>dead end</strong>, degree 2 is a corridor or a bend, and degree 3 or 4 is a{' '}
        <strong>junction</strong> where you have to choose. A <strong>path</strong> is a walk from
        cell to cell along passages; a <strong>loop</strong> (a cycle) is a path that comes back to
        where it started without reusing a passage.
      </p>
      <p>
        Edit the maze in the demo. Tap near a wall to open or close it, or tap the middle of a cell
        to select it and read its degree. Watch the counts beside the maze: open a wall between two
        cells that were already connected and a loop appears; close a passage and the maze can fall
        apart into separate <strong>pieces</strong> that cannot reach each other.
      </p>
      <p>
        One sum ties them together: loops = passages - cells + pieces. Every passage beyond what is
        needed to hold each piece together closes exactly one more loop.
      </p>
    </>
  ),
  demo: {
    kind: 'graph',
    generatorId: 'prims',
    seed: 'a-maze-is-a-graph',
    width: 6,
    height: 5,
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'Counting the pieces is one search from each cell not yet reached: every cell is visited once and every passage looked at from both ends. The loops then follow from the counts, E - V + pieces, with no search for them at all.',
  },
  tryIt: [
    {
      id: 'junction',
      prompt: 'Select a junction: a cell with three or four passages.',
      hint: 'Tap the middle of a cell (or use the arrow keys on the maze) and read its degree beside the maze.',
      check: (demo) => (degree(demo) ?? 0) >= 3,
      success: (demo) =>
        `${selectedText(demo)} has degree ${String(degree(demo) ?? 0)}: ${String(degree(demo) ?? 0)} passages meet there.`,
    },
    {
      id: 'dead-end',
      prompt: 'Select a dead end: a cell of degree 1.',
      check: (demo) => degree(demo) === 1,
      success: (demo) => `${selectedText(demo)} has degree 1: a dead end.`,
    },
    {
      id: 'loop',
      prompt:
        'Open one wall between two cells that are already connected, and watch a loop appear.',
      hint: 'Any wall inside the maze will do: in a perfect maze every two cells are connected already.',
      check: (demo) => (demo.graph?.stats.loops ?? 0) >= 1,
      success: (demo) =>
        `${String(demo.graph?.stats.loops ?? 1)} loop: some cells now have two different routes between them.`,
    },
    {
      id: 'split',
      prompt: 'Close one passage so that part of the maze is cut off from the start.',
      hint: 'Close the only passage of a dead end, or any passage that is not on a loop.',
      check: (demo) => (demo.graph?.stats.pieces ?? 1) >= 2,
      success: (demo) =>
        `The maze is in ${String(demo.graph?.stats.pieces ?? 2)} pieces: some cells cannot be reached from the start.`,
    },
  ],
  tryThis: [
    'Find the cell with the highest degree. How many junctions does this maze have?',
    'Open three walls. Do the loops count go up by three? When does it not?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'vertex',
        prompt: 'In the graph of a maze, what are the vertices?',
        choices: ['The cells', 'The walls', 'The corners where walls meet', 'The dead ends only'],
        answer: 0,
        explain: 'Each cell is a vertex; the passages between cells are the edges.',
      },
      {
        id: 'edge',
        prompt: 'And what are the edges?',
        choices: [
          'The open passages between neighbouring cells',
          'Every wall',
          'Every pair of cells',
          'The paths from the start to the goal',
        ],
        answer: 0,
        explain: 'An edge joins two neighbouring cells with no wall between them.',
      },
      {
        id: 'degree',
        prompt:
          'A cell has passages to the north and the east, and walls to the south and the west. What is its degree?',
        choices: ['1', '2', '3', '4'],
        answer: 1,
        explain: 'Degree counts passages, not walls: two passages, so degree 2 (a bend).',
      },
      {
        id: 'loops',
        prompt:
          'A maze has 30 cells, 32 passages and is in one piece. How many loops does it have?',
        choices: ['0', '1', '2', '3'],
        answer: 3,
        explain: 'Loops = passages - cells + pieces = 32 - 30 + 1 = 3.',
      },
    ],
  },
};
