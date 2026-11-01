/** M7.2 "Tuning the heuristic": plain A* against an A* the learner tunes (WI-06e e.3). */
import type { PairLane } from '../../../learn/pairDemo';
import type { DemoState, LessonContent } from '../types';

const lanes = (demo: DemoState) => demo.pair?.lanes ?? [];
/** The plain A* on the left and the tuned one on the right, once both have finished. */
const finished = (demo: DemoState): readonly [PairLane, PairLane] | null => {
  const [plain, tuned] = lanes(demo);
  return plain?.done && tuned?.done ? [plain, tuned] : null;
};
const weightOf = (lane: PairLane) =>
  typeof lane.params.weight === 'number' ? lane.params.weight : 1;
const heuristicOf = (lane: PairLane) =>
  typeof lane.params.heuristic === 'string' ? lane.params.heuristic : 'manhattan';

export const lesson: LessonContent = {
  Body: () => (
    <>
      <p>
        A* is only as sharp as its heuristic. Both mazes here run A*; the left one keeps the
        defaults, and you tune the right one under the scoreboard. Every change restarts both on the
        same maze.
      </p>
      <p>
        <strong>A looser heuristic.</strong> Euclidean (straight-line) and Chebyshev distances are
        both admissible on this grid, but they guess lower than Manhattan. A lower guess makes more
        cells look worth a try, so A* still finds a shortest path but expands more cells to be sure.
        The best admissible heuristic is the one that guesses highest without ever over-estimating.
      </p>
      <p>
        <strong>A weight above 1.</strong> Weighted A* ranks cells by <em>g + w &times; h</em>. With{' '}
        <em>w</em> above 1 the guess can over-estimate, so A* is no longer admissible: it leans
        towards greedy, expands fewer cells, and may return a longer path. The path is never more
        than <em>w</em> times the shortest, which is why games and robots use it when &ldquo;good
        enough, now&rdquo; beats &ldquo;best, later&rdquo;.
      </p>
      <p>
        <strong>Ties.</strong> Many cells share the same <em>f</em>. Breaking ties towards the lower{' '}
        <em>h</em> (the cell nearer the goal) lets A* run down one shortest route instead of
        widening across all of them.
      </p>
    </>
  ),
  demo: {
    kind: 'pair',
    generatorId: 'recursive-backtracker',
    seed: 'm7-3',
    width: 12,
    height: 9,
    braid: 100,
    solverIds: ['astar', 'astar'],
    tuneLane: 1,
  },
  complexity: {
    time: 'O((V + E) log V)',
    space: 'O(V)',
    why: 'The heuristic and the weight change how many cells A* expands before the goal, not the worst case: on a maze with no useful guess (h = 0) A* is Dijkstra and may expand every cell.',
  },
  tryIt: [
    {
      id: 'looser',
      prompt:
        'Switch the right-hand heuristic to Euclidean or Chebyshev and run both to the end. Same path, more work?',
      hint: 'The Heuristic menu is under the scoreboard, in Side by side.',
      check: (demo) => {
        const pair = finished(demo);
        if (!pair) return false;
        const [plain, tuned] = pair;
        return (
          heuristicOf(tuned) !== 'manhattan' &&
          weightOf(tuned) === 1 &&
          tuned.pathMoves === plain.pathMoves &&
          tuned.expanded > plain.expanded
        );
      },
      success: (demo) => {
        const pair = finished(demo);
        if (!pair) return '';
        const [plain, tuned] = pair;
        return `Both found a ${String(plain.pathMoves)}-move path; ${heuristicOf(tuned)} expanded ${String(tuned.expanded)} cells against Manhattan's ${String(plain.expanded)}.`;
      },
    },
    {
      id: 'fewer',
      prompt: 'Raise the weight until the tuned search expands fewer cells than plain A*.',
      check: (demo) => {
        const pair = finished(demo);
        return pair !== null && weightOf(pair[1]) > 1 && pair[1].expanded < pair[0].expanded;
      },
      success: (demo) => {
        const pair = finished(demo);
        if (!pair) return '';
        const [plain, tuned] = pair;
        return `With weight ${String(weightOf(tuned))} it expanded ${String(tuned.expanded)} cells, against ${String(plain.expanded)} for plain A*.`;
      },
    },
    {
      id: 'longer',
      prompt: 'Find a weight at which the tuned search returns a path longer than the shortest.',
      check: (demo) => {
        const pair = finished(demo);
        const shortest = demo.pair?.shortest;
        return (
          pair !== null &&
          shortest != null &&
          pair[1].pathMoves !== null &&
          pair[1].pathMoves > shortest
        );
      },
      success: (demo) => {
        const tuned = finished(demo)?.[1];
        const moves = tuned?.pathMoves ?? 0;
        const shortest = demo.pair?.shortest ?? 0;
        return `With weight ${String(tuned ? weightOf(tuned) : 1)} the path is ${String(moves)} moves, ${String(moves - shortest)} more than the shortest ${String(shortest)}.`;
      },
    },
  ],
  tryThis: [
    'Set Tie-break to insertion order with the weight at 1. Does the path change? Does the work?',
    'Is there a weight that expands fewer cells and still finds a shortest path?',
  ],
  quiz: {
    passMark: 3,
    questions: [
      {
        id: 'looser',
        prompt:
          'Two admissible heuristics; one always guesses at least as high as the other. Which makes A* expand fewer cells?',
        choices: [
          'The one that guesses higher',
          'The one that guesses lower',
          'Neither: admissible heuristics all expand the same cells',
          'Whichever is faster to compute',
        ],
        answer: 0,
        explain:
          'A higher (but still admissible) guess rules out more cells as not worth trying, while the path stays a shortest one.',
      },
      {
        id: 'weight',
        prompt: 'What does a weight above 1 do to A*?',
        choices: [
          'It usually expands fewer cells but may return a longer path',
          'It always finds a shorter path',
          'It makes A* behave like BFS',
          'Nothing, as long as the heuristic is admissible',
        ],
        answer: 0,
        explain:
          'w times an admissible h can over-estimate, so the guarantee goes; in return A* heads for the goal more directly.',
      },
      {
        id: 'bound',
        prompt: 'Weighted A* with weight 2 returns a path. How long can it be, at most?',
        choices: [
          'Twice the shortest path',
          'As long as the shortest path',
          'Any length at all',
          'The shortest path plus two moves',
        ],
        answer: 0,
        explain:
          'With an admissible h, weighted A* is bounded: its path costs at most w times the optimum.',
      },
      {
        id: 'ties',
        prompt: 'Why break ties between equal f values towards the lower h?',
        choices: [
          'Cells nearer the goal go first, so A* follows one shortest route instead of widening across many',
          'It makes the path shorter',
          'It keeps the heuristic admissible',
          'It is needed for A* to finish',
        ],
        answer: 0,
        explain:
          'All cells on shortest routes share f; preferring lower h pushes on towards the goal. The path length is the same either way.',
      },
    ],
  },
};
