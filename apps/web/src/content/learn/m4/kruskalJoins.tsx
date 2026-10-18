/** M4.2 "Kruskal's joins a forest": disjoint sets and union-find (WI-06e). */
import { describePosition } from '@maze/core';
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function sets(demo: DemoState) {
  const s = demo.genStructure?.structure;
  return s?.kind === 'sets' ? s.sets : null;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        <strong>Kruskal&rsquo;s algorithm</strong> builds the same kind of spanning tree as
        Prim&rsquo;s, but from the other end. Instead of growing one tree, it starts with every cell
        as a tiny tree of its own (a forest of V pieces) and looks at the walls one at a time, in a
        random order. For each wall it asks one question: are the cells on either side already in
        the same piece?
      </p>
      <p>
        If not, it carves the wall: the two pieces become one (a <strong>union</strong>). If they
        are, it <strong>keeps the wall</strong>: they are connected already, so a passage would
        close a loop. Each union removes one piece, so after V - 1 unions one piece is left and the
        maze is done.
      </p>
      <p>
        The question needs a fast answer, and that is what a <strong>disjoint-set</strong>{' '}
        (union-find) structure gives. Every piece has a representative cell; <code>find(c)</code>{' '}
        follows parent links from c up to it, and <code>union</code> points one representative at
        the other. <strong>Path compression</strong> makes every cell passed on the way point
        straight at the representative, so later finds take one or two hops. Watch the counts beside
        the maze: finds grow by two per wall, but the parent links followed stay close behind.
      </p>
      <p>
        In the demo the maze condenses out of fragments all over the grid at once, unlike
        Prim&rsquo;s single growing blob.
      </p>
    </>
  ),
  demo: {
    kind: 'generate',
    generatorId: 'kruskals',
    seed: 'join-forests',
    width: 10,
    height: 7,
  },
  complexity: {
    time: 'O(E α(V))',
    space: 'O(V + E)',
    why: 'Shuffling the walls is O(E). Each wall costs two finds, and with path compression and union by size a find takes amortised α(V) steps, a function that never exceeds 4 for any maze you could draw. The sets need one parent and one size per cell.',
  },
  tryIt: [
    {
      id: 'first-kept',
      prompt: 'Use Run until to stop on the first wall Kruskal keeps. Why does it stay?',
      hint: 'Pick "the next wall kept to avoid a loop" and press Run.',
      check: (demo) => paused(demo) && demo.lastStep?.t === 'reject',
      success: (demo) => {
        const s = demo.lastStep;
        if (s?.t !== 'reject' || !demo.maze) return 'That wall stays.';
        const g = demo.maze.grid;
        return `The wall between ${describePosition(g, s.a)} and ${describePosition(g, s.b)} stays: they are already in one piece.`;
      },
    },
    {
      id: 'ten-pieces',
      prompt: 'Run until 10 or fewer pieces are left.',
      hint: 'Pick "N or fewer pieces are left" and set N to 10.',
      check: (demo) => paused(demo) && (sets(demo)?.sets ?? Infinity) <= 10,
      success: (demo) =>
        `${String(sets(demo)?.sets ?? 0)} pieces left after ${String(sets(demo)?.unions ?? 0)} unions.`,
    },
    {
      id: 'complete',
      prompt: 'Run to the end and count the unions.',
      check: (demo) =>
        (demo.status === 'done' || demo.lastStep?.t === 'done') && sets(demo)?.sets === 1,
      success: (demo) => {
        const s = sets(demo);
        return `One piece: ${String(s?.unions ?? 0)} unions for ${String(s?.cells ?? 0)} cells, and ${String(s?.rejected ?? 0)} walls kept along the way.`;
      },
    },
  ],
  tryThis: [
    'Watch the largest components: do they grow evenly, or does one take over?',
    'Compare finds and parent links followed. What would the links be without path compression?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'keep',
        prompt: 'When does Kruskal keep a wall?',
        choices: [
          'When the cells on either side are already in the same piece',
          'When the wall is on the edge of the grid',
          'When one of the cells is a dead end',
          'When the random order says so',
        ],
        answer: 0,
        explain: 'Carving it would join two cells that are already connected: a loop.',
      },
      {
        id: 'unions',
        prompt: 'How many unions does Kruskal make on a 70-cell grid?',
        choices: ['35', '69', '70', 'One per wall'],
        answer: 1,
        explain: 'It starts with 70 pieces and each union removes one, so 69 leave a single piece.',
      },
      {
        id: 'finds',
        prompt: 'Kruskal looks at 100 walls. How many find operations does it make?',
        choices: ['50', '100', '200', '10,000'],
        answer: 2,
        explain: 'One find for each side of every wall: 2 per wall, 200 in all.',
      },
      {
        id: 'compression',
        prompt: 'What does path compression do?',
        choices: [
          'Points every cell passed during a find straight at the representative',
          'Removes walls that would close a loop',
          'Merges the two smallest pieces first',
          'Sorts the walls by weight',
        ],
        answer: 0,
        explain:
          'Later finds from those cells then take one hop, which keeps union-find nearly constant time.',
      },
    ],
  },
};
