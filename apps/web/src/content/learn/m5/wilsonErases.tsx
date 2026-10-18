/** M5.2 "Wilson's erases loops": loop-erased random walks, and bias measured over seeds. */
import { DeadEndHistogram } from '../../../routes/learn/DeadEndHistogram';
import type { DemoState, LessonContent } from '../types';

/** Two uniform generators between two biased ones, for the histogram. */
const COMPARED = ['recursive-backtracker', 'aldous-broder', 'wilsons', 'prims'] as const;

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function walk(demo: DemoState) {
  const s = demo.genStructure?.structure;
  return s?.kind === 'walk' ? s.walk : null;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        <strong>Wilson&rsquo;s algorithm</strong> builds the same uniform mazes as Aldous-Broder,
        usually much faster. It also starts with a tree of one cell, then repeatedly picks a cell
        outside the tree and walks at random <em>until it touches the tree</em>. Whenever the walk
        crosses its own path, the loop it just made is <strong>erased</strong>: the walk is cut back
        to the cell it returned to. When it reaches the tree, what remains is a path with no loops,
        and it is carved in as a new branch.
      </p>
      <p>
        The first walk is slow: the tree is a single cell and hard to find. But every branch makes
        the tree bigger, so later walks hit it sooner. Loop erasure is what keeps the result fair:
        the branch that is added does not depend on how the walk wandered, only on where it went
        last. Wilson proved this gives every spanning tree the same chance.
      </p>
      <p>
        Uniform shows up in the numbers. The chart counts dead ends in 50 mazes from each generator.
        Aldous-Broder and Wilson&rsquo;s land on top of each other (they make mazes from the same
        distribution); the backtracker makes far fewer dead ends, Prim&rsquo;s more. A texture like
        that is often enough to tell which generator made a maze.
      </p>
      <DeadEndHistogram generatorIds={COMPARED} />
    </>
  ),
  demo: {
    kind: 'generate',
    generatorId: 'wilsons',
    seed: 'erase-loops',
    width: 8,
    height: 6,
  },
  complexity: {
    time: 'O(V log V) expected',
    space: 'O(V)',
    why: "Each walk lasts until it hits the tree, which keeps growing, so walks get shorter as the run goes on; the total is the expected time for random walks to reach the tree, typically much less than Aldous-Broder's cover time. Space is the walk and one mark per cell.",
  },
  tryIt: [
    {
      id: 'first-erase',
      prompt: 'Use Run until to stop when the walk erases its first loop.',
      hint: 'Pick "the next loop is erased" and press Run.',
      check: (demo) =>
        paused(demo) && demo.lastStep?.t === 'walk' && (demo.lastStep.erased?.length ?? 0) > 0,
      success: (demo) => {
        const s = demo.lastStep;
        const n = s?.t === 'walk' ? (s.erased?.length ?? 0) : 0;
        return `The walk crossed its own path, so the ${String(n)} cell${n === 1 ? '' : 's'} after the crossing are erased.`;
      },
    },
    {
      id: 'branch',
      prompt: 'Run until the tree grows: a loop-free walk is carved in as a branch.',
      hint: 'Pick "the tree grows by one cell".',
      check: (demo) => paused(demo) && demo.lastStep?.t === 'carve',
      success: (demo) =>
        `The tree holds ${String(walk(demo)?.inTree ?? 0)} cells after ${String(walk(demo)?.walkSteps ?? 0)} walk steps and ${String(walk(demo)?.erasures ?? 0)} erased loops.`,
    },
    {
      id: 'complete',
      prompt: 'Run to the end and count the loops erased along the way.',
      check: (demo) =>
        (demo.status === 'done' || demo.lastStep?.t === 'done') &&
        walk(demo)?.inTree === walk(demo)?.cells,
      success: (demo) =>
        `Done: ${String(walk(demo)?.walkSteps ?? 0)} walk steps, ${String(walk(demo)?.erasures ?? 0)} loops erased, a tree of ${String(walk(demo)?.cells ?? 0)} cells.`,
    },
  ],
  tryThis: [
    'Watch the first walk: why does it take so long to find the tree?',
    'In the chart, which generator would you guess made a maze where a third of the cells are dead ends?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'erase',
        prompt: "What does Wilson's do when its walk crosses its own path?",
        choices: [
          'Erases the loop, back to the cell it returned to',
          'Carves the loop into the maze',
          'Starts the walk again from the start cell',
          'Stops the walk there',
        ],
        answer: 0,
        explain: 'Only a loop-free path may be carved in, or the maze would get a cycle.',
      },
      {
        id: 'same',
        prompt: "How do Wilson's mazes compare with Aldous-Broder's?",
        choices: [
          'Same distribution: every perfect maze is equally likely from both',
          "Wilson's always makes fewer dead ends",
          "Wilson's mazes always contain one loop",
          'They are identical for the same seed',
        ],
        answer: 0,
        explain:
          'Both are uniform, which is why their dead-end counts in the chart match; the same seed still gives different mazes.',
      },
      {
        id: 'which',
        prompt: 'A maze of 108 cells has 13 dead ends. Which generator most likely made it?',
        choices: ['Recursive backtracker', 'Aldous-Broder', "Wilson's", "Prim's"],
        answer: 0,
        explain:
          "13 of 108 is 12%, right where the backtracker sits; the uniform generators average about 30% and Prim's about 35%.",
      },
      {
        id: 'speed',
        prompt: "Why do Wilson's walks get shorter as the run goes on?",
        choices: [
          'The tree keeps growing, so a walk hits it sooner',
          'The walk moves two cells per step later on',
          'It stops erasing loops after a while',
          'Cells near the tree are carved without walking',
        ],
        answer: 0,
        explain: 'A bigger target is easier to stumble on.',
      },
    ],
  },
};
