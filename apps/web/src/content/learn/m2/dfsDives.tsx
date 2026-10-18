/** M2.2 "Depth-first search dives deep": the DFS solver and its stack (WI-06d). */
import { describePosition } from '@maze/core';
import type { DemoState, LessonContent } from '../types';

const paused = (demo: DemoState): boolean => demo.status === 'paused';

function stack(demo: DemoState) {
  const s = demo.structure?.structure;
  return s?.kind === 'stack' ? s.stack : null;
}

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        <strong>Depth-first search</strong> (DFS) solves a maze the way the backtracker builds one.
        It keeps a <strong>stack</strong> of cells it has found but not explored yet, and always
        explores the one on <em>top</em>: the one found most recently. Its unexplored neighbours go
        on top in turn, so DFS follows one corridor as deep as it goes before it looks anywhere
        else.
      </p>
      <p>
        When it reaches a <strong>dead end</strong> there is nothing new to push. The next cell on
        top of the stack is then a branch it passed earlier and has not tried yet, so DFS carries on
        from the most recent junction. That is backtracking again, but without walking back: the
        stack already remembers where the untried branches start.
      </p>
      <p>
        Run the demo and watch the stack. It stays short on a maze with many branches, because every
        expanded cell leaves its other neighbours waiting on the stack. The top cell is always the
        next one expanded.
      </p>
      <p>
        On a perfect maze there is exactly one path between the start and the goal, so the path DFS
        finds is the shortest, however long it wandered first. On a maze with loops that is no
        longer true: lesson M3 shows how breadth-first search fixes it.
      </p>
    </>
  ),
  demo: {
    kind: 'solve',
    generatorId: 'prims',
    seed: 'dives-deep',
    width: 12,
    height: 9,
    solverId: 'dfs',
  },
  complexity: {
    time: 'O(V + E)',
    space: 'O(V)',
    why: 'Every cell is pushed and expanded at most once (V), and every passage is looked at from both ends (E). The stack and the seen marks hold at most one entry per cell.',
  },
  tryIt: [
    {
      id: 'dead-end',
      prompt: 'Use Run until to stop at the next dead end. What is on top of the stack now?',
      hint: 'Under the maze, pick "the next dead end" and press Run.',
      check: (demo) => paused(demo) && demo.lastStep?.t === 'deadend',
      success: (demo) => {
        const s = demo.lastStep;
        const at =
          s?.t === 'deadend' && demo.maze ? describePosition(demo.maze.grid, s.cell) : 'a cell';
        return `DFS hit a dead end at ${at}; ${String(stack(demo)?.cells.length ?? 0)} cells wait on the stack.`;
      },
    },
    {
      id: 'stack-past-five',
      prompt: 'Stop as soon as the stack holds more than 5 cells.',
      hint: 'Pick "the stack holds more than N cells" and set N to 5.',
      check: (demo) => paused(demo) && (stack(demo)?.cells.length ?? 0) > 5,
      success: (demo) =>
        `The stack holds ${String(stack(demo)?.cells.length ?? 0)} cells; the one on top is expanded next.`,
    },
    {
      id: 'reach-goal',
      prompt: 'Run until DFS reaches the goal. How many cells did it expand on the way?',
      hint: 'Pick "it reaches the goal".',
      check: (demo) =>
        paused(demo) &&
        demo.lastStep?.t === 'expand' &&
        demo.maze !== null &&
        demo.lastStep.cell === demo.maze.goal,
      success: (demo) =>
        `DFS reached the goal after expanding ${String(stack(demo)?.pops ?? 0)} cells.`,
    },
  ],
  tryThis: [
    'At a dead end, find the cell on top of the stack in the maze. Which junction does it branch from?',
    'Read the step log on Watch for DFS and BFS on the same maze: which one expands more cells?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'next',
        prompt: 'Which cell does DFS expand next?',
        choices: [
          'The one on top of the stack: the latest found',
          'The one at the bottom of the stack: the earliest found',
          'The one closest to the goal',
          'A random one',
        ],
        answer: 0,
        explain:
          'A stack is last in, first out, so the newest cell is expanded first and DFS dives deep.',
      },
      {
        id: 'dead-end',
        prompt: 'What does DFS do at a dead end?',
        choices: [
          'Starts again from the start',
          'Expands the cell now on top of the stack: a branch it skipped earlier',
          'Walks back one cell and stops',
          'Decides the goal cannot be reached',
        ],
        answer: 1,
        explain:
          'Nothing new is pushed at a dead end, so the top of the stack is the most recent untried branch.',
      },
      {
        id: 'perfect',
        prompt: 'On a perfect maze, is the path DFS finds a shortest one?',
        choices: [
          'Yes: there is only one path between any two cells',
          'No: DFS paths are always longer',
          'Only when the goal is near the start',
          'Only on square mazes',
        ],
        answer: 0,
        explain:
          'A perfect maze is a tree, so the path is unique. On a maze with loops DFS can return a longer path than BFS.',
      },
      {
        id: 'same',
        prompt: 'The backtracker and DFS both keep a stack. What do they share?',
        choices: [
          'Both go as deep as they can before backing up',
          'Both find shortest paths',
          'Both carve walls',
          'Both head straight for the goal',
        ],
        answer: 0,
        explain:
          'Both take the newest cell next, so both follow one corridor to its end before trying a branch.',
      },
    ],
  },
};
