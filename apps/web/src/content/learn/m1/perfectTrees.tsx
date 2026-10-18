/** M1.2 "Perfect mazes are trees": rejoin a cut maze into one spanning tree (WI-06d). */
import type { DemoState, LessonContent } from '../types';

const stats = (demo: DemoState) => demo.graph?.stats ?? null;

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        A <strong>perfect maze</strong> has exactly one path between any two cells: no cell is cut
        off, and you can never walk in a circle. In graph words it is <strong>connected</strong>{' '}
        (one piece) and has <strong>no cycles</strong> (no loops). A graph like that is a{' '}
        <strong>tree</strong>, and because it reaches every cell of the grid it is a{' '}
        <strong>spanning tree</strong> of the grid.
      </p>
      <p>
        Trees have a fixed number of edges. Start with V cells and no passages: V pieces. Every
        passage you open either joins two pieces into one, or closes a loop inside a piece. A tree
        needs every one of them to join, so it takes exactly V - 1 passages to get down to one piece
        with no loop. One more passage and there must be a loop; one fewer and the maze falls in
        two.
      </p>
      <p>
        The demo maze was a perfect maze, but two of its passages were closed, so it is in three
        pieces now: the shaded cells cannot be reached from the start. Open walls to join the pieces
        back into one tree. Choose carefully: open a wall between two cells of the same piece and
        you make a loop instead.
      </p>
      <p>
        Every maze generator in this course that makes perfect mazes is, underneath, an algorithm
        for building a random spanning tree.
      </p>
    </>
  ),
  demo: {
    kind: 'graph',
    generatorId: 'recursive-backtracker',
    seed: 'grow-a-tree',
    width: 7,
    height: 5,
    cut: 2,
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'Deciding whether a maze is a tree takes one search: count the pieces (each cell visited once, each passage looked at from both ends), then check that passages = cells - 1.',
  },
  tryIt: [
    {
      id: 'two-pieces',
      prompt: 'Open a wall that joins two of the three pieces, without making a loop.',
      hint: 'Find a wall with a shaded cell on one side and an unshaded cell on the other.',
      check: (demo) => stats(demo)?.pieces === 2 && stats(demo)?.loops === 0,
      success: (demo) =>
        `Two pieces left and still no loop: ${String(stats(demo)?.passages ?? 0)} passages for ${String(stats(demo)?.cells ?? 0)} cells.`,
    },
    {
      id: 'tree',
      prompt: 'Make the maze one tree again: every cell joined and no loop.',
      check: (demo) => stats(demo)?.tree === true,
      success: (demo) =>
        `A tree: ${String(stats(demo)?.cells ?? 0)} cells joined by ${String(stats(demo)?.passages ?? 0)} passages, one fewer.`,
    },
    {
      id: 'one-more',
      prompt: 'Now open one more wall, anywhere. What did it make?',
      check: (demo) => stats(demo)?.pieces === 1 && stats(demo)?.loops === 1,
      success: (demo) =>
        `One piece with one loop: ${String(stats(demo)?.passages ?? 0)} passages for ${String(stats(demo)?.cells ?? 0)} cells, one more than a tree has.`,
    },
  ],
  tryThis: [
    'Count the passages before you edit: how many more does a tree of 35 cells need?',
    'Make a loop, then break it by closing a different wall on it. Is the result still a tree?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'tree',
        prompt: 'What makes a graph a tree?',
        choices: [
          'It is connected and has no cycles',
          'Every vertex has degree 2 or less',
          'It has as many edges as vertices',
          'It has exactly one dead end',
        ],
        answer: 0,
        explain: 'One piece and no loops. From that, the number of edges follows: V - 1.',
      },
      {
        id: 'count',
        prompt: 'A perfect maze has 35 cells. How many passages does it have?',
        choices: ['17', '34', '35', '70'],
        answer: 1,
        explain: 'A perfect maze is a spanning tree, and a tree with V vertices has V - 1 edges.',
      },
      {
        id: 'open',
        prompt: 'You open one more wall in a perfect maze. What happens?',
        choices: [
          'A loop appears: two cells now have two different routes between them',
          'The maze splits in two',
          'Nothing: a perfect maze allows it',
          'A new dead end appears',
        ],
        answer: 0,
        explain:
          'Both cells were already connected by the one path between them; the new passage is a second route, so a loop.',
      },
      {
        id: 'close',
        prompt: 'You close one passage of a perfect maze. What happens?',
        choices: [
          'The maze falls into two pieces',
          'A loop appears',
          'Nothing changes',
          'Every dead end disappears',
        ],
        answer: 0,
        explain:
          'In a tree every edge is the only link between two parts, so removing any one of them splits the tree in two.',
      },
    ],
  },
};
