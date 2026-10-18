/**
 * The Learn curriculum (proj-mgmt/13 section 7). The index, breadcrumbs, previous/next links
 * and progress all derive from this list; a module without lessons shows as planned. Lesson
 * bodies load on demand through `load`.
 */
import type { Curriculum, LessonInfo, ModuleInfo } from './types';

export const CURRICULUM: Curriculum = [
  {
    id: 'm1',
    number: 1,
    title: 'Grids & graphs',
    objectives: [
      'See cells and passages as the vertices and edges of a graph',
      'Define degree, path, cycle and tree',
      'Recognise a perfect maze as a spanning tree',
    ],
    prerequisites: [],
    lessons: [],
  },
  {
    id: 'm2',
    number: 2,
    title: 'DFS & the recursive backtracker',
    objectives: [
      'Explain stack-based traversal',
      'Predict where backtracking happens',
      'Explain why the result is a tree',
    ],
    prerequisites: ['m1'],
    lessons: [
      {
        id: 'm2-backtracker',
        title: 'The backtracker carves a tree',
        summary:
          'The recursive backtracker walks into unvisited cells and backs up when stuck; its stack is the path back to the start.',
        minutes: 12,
        load: () => import('./m2/backtracker').then((m) => m.lesson),
      },
      {
        id: 'm2-dfs-dives',
        title: 'Depth-first search dives deep',
        summary:
          'Depth-first search always explores the newest cell on its stack, so it follows one corridor to the end before trying a branch.',
        minutes: 10,
        load: () => import('./m2/dfsDives').then((m) => m.lesson),
      },
    ],
  },
  {
    id: 'm3',
    number: 3,
    title: 'BFS & shortest paths',
    objectives: [
      'Explain the queue and its frontier rings',
      'Argue why BFS is optimal on unweighted graphs',
      'Read a distance map',
    ],
    prerequisites: ['m2'],
    lessons: [
      {
        id: 'm3-frontier-ring',
        title: 'The frontier is a ring',
        summary:
          'Breadth-first search explores in rings of equal distance, and its queue only ever holds two neighbouring rings.',
        minutes: 10,
        load: () => import('./m3/frontierRing').then((m) => m.lesson),
      },
    ],
  },
  {
    id: 'm4',
    number: 4,
    title: 'Spanning trees: Prim, Kruskal, disjoint sets',
    objectives: [
      'Contrast frontier growth with global edge selection',
      'Describe union-find with path compression',
    ],
    prerequisites: ['m1', 'm3'],
    lessons: [],
  },
  {
    id: 'm5',
    number: 5,
    title: 'Uniform spanning trees: Aldous-Broder & Wilson',
    objectives: ['Define uniformity', 'Explain loop erasure', 'Discuss expected running time'],
    prerequisites: ['m4'],
    lessons: [],
  },
  {
    id: 'm6',
    number: 6,
    title: 'Dijkstra & weighted mazes',
    objectives: [
      'Explain relaxation and priority queues',
      'Contrast Dijkstra with BFS when weights differ',
    ],
    prerequisites: ['m3'],
    lessons: [],
  },
  {
    id: 'm7',
    number: 7,
    title: 'A* & heuristics',
    objectives: [
      'Define admissible and consistent heuristics',
      'Predict when greedy search fails',
      'Explain tie-breaking',
    ],
    prerequisites: ['m6'],
    lessons: [],
  },
  {
    id: 'm8',
    number: 8,
    title: 'Solving without a map',
    objectives: [
      'Reason with local information only',
      'State when wall following fails',
      "Explain Pledge's counter and Tremaux's marks",
    ],
    prerequisites: ['m2'],
    lessons: [],
  },
  {
    id: 'm9',
    number: 9,
    title: 'Analysing mazes: metrics & bias',
    objectives: [
      'Compute dead-end ratio, river and diameter',
      'Identify a generator by its texture',
    ],
    prerequisites: ['m5'],
    lessons: [],
  },
  {
    id: 'm10',
    number: 10,
    title: 'Randomness, seeds & reproducibility',
    objectives: [
      'Explain pseudo-random generators and seeds',
      'Explain why Math.random breaks replay',
    ],
    prerequisites: ['m2'],
    lessons: [],
  },
  {
    id: 'm11',
    number: 11,
    title: 'Complexity & performance',
    objectives: ['Read big-O from step counts', 'Separate asymptotics from constant factors'],
    prerequisites: ['m3', 'm4'],
    lessons: [],
  },
  {
    id: 'm12',
    number: 12,
    title: 'Capstone: build your own generator',
    objectives: ['Implement a generator against the MazeGenerator interface'],
    prerequisites: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11'],
    lessons: [],
  },
];

export interface LessonLocation {
  readonly module: ModuleInfo;
  readonly lesson: LessonInfo;
  readonly previous: LessonInfo | null;
  readonly next: LessonInfo | null;
}

/** Where a lesson sits in the curriculum, with its neighbours across module boundaries. */
export function locateLesson(
  id: string,
  curriculum: Curriculum = CURRICULUM,
): LessonLocation | null {
  const flat = curriculum.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })));
  const i = flat.findIndex((e) => e.lesson.id === id);
  const here = flat[i];
  if (!here) return null;
  return {
    module: here.module,
    lesson: here.lesson,
    previous: flat[i - 1]?.lesson ?? null,
    next: flat[i + 1]?.lesson ?? null,
  };
}

export function moduleTitle(m: ModuleInfo): string {
  return `M${String(m.number)} ${m.title}`;
}
