# 19 - Tree View ("treeify the maze")

> Status: Implemented (WI-09, merge 3183337) | Last updated: 2026-10-03 | Owner: Dmitri Larionov
> Queue item: WI-09 in [17-work-queue.md](./17-work-queue.md)
> Related: [02-domain-model-and-algorithms.md](./02-domain-model-and-algorithms.md) (step engine,
> trackers), [ADR-004](./adr/ADR-004-rendering-abstraction.md) (renderer port),
> [13-education-and-playground.md](./13-education-and-playground.md) (Learn tie-in)

## 1. Idea

Wikipedia, *Maze generation algorithm*: "if one pulled and stretched out the paths in the maze in
the proper way, the result could be made to resemble a tree." A perfect maze is a spanning tree of
the grid graph: every cell is a node, every open passage an edge, exactly one path between any two
cells. The Tree view makes that literal:

- **Root** = the start cell. **Trunk** = the solution path from start to goal. **Leaves** = dead
  ends. **Forks** = junction cells. **Height** of a node = its distance from the start.
- **Morph:** cells slide from their grid positions to their tree positions ("pulling the paths
  out"), driven by a slider, so the two pictures are visibly the same object.
- **Growth:** during generation the tree grows step by step from the generator's own steps, so
  each algorithm's character shows: the recursive backtracker grows one long winding trunk with
  few branches, Prim's is a bushy shrub of short twigs, Kruskal's is a forest of saplings that
  merge, Wilson's grafts loop-erased branches onto the tree, Origin Shift re-roots the tree on
  every step.

## 2. Visualizations

| View | Layout | Notes |
|------|--------|-------|
| 2D tidy tree | Root at the bottom, depth upwards (Reingold-Tilford / Buchheim, O(n)) | Trunk drawn thicker and straight; reads like a plant |
| 2D radial | Root in the centre, depth = ring radius, subtree size = angular share | Fits large mazes on a phone; BFS frontier = a ring |
| 3D tree | Trunk vertical, branches leave at angles proportional to subtree size, depth = height; three.js instanced cylinders + spheres | The "botanical" view; orbit/tilt/zoom reuse the existing 3D camera controls |
| Grid <-> tree morph | Interpolates every cell between its grid position and its tree position | Slider 0..1 plus an animated "pull" button; reduced motion jumps |

Overlays that already exist map onto the tree: generation visit colours, the stack-depth cube
heights, solver frontier/expanded/dead-end marks and the found path. Watch on the tree is the
teaching payoff: BFS expands the tree ring by ring, DFS dives down one branch and backs out, A*
leans toward the trunk.

**Braided mazes** (loops) are not trees. Show the BFS spanning tree from the start and draw the
extra passages as dashed "loop edges", with a count. That also explains why braiding makes
mazes easier.

## 3. Architecture

- **`@maze/core` `treeify.ts`** (pure, no DOM): `spanningTree(state, root)` returns parent,
  children, depth, subtree size, the trunk (root-to-goal path), the leaves and the non-tree
  (loop) edges. `TreeTracker` folds `GenStep`s into a growing forest (union-find, because
  Kruskal-style generators build many trees at once; `rotate` steps re-root). Property tests: a
  perfect maze gives n-1 tree edges and zero loop edges; every tree edge is an open passage;
  leaves = `deadEnds`; height of the goal = `solutionLength`; the deepest leaf matches `diameter`
  when rooted at a diameter end.
- **Layouts** (pure functions, testable): `tidyLayout`, `radialLayout`, `layout3d` returning
  positions per cell. Tests: no two nodes overlap; parents sit below or inside their children;
  the layout is deterministic for a given maze and root.
- **Renderer:** a third view mode, `ViewMode = '2d' | '3d' | 'tree'` (ADR-004 amendment), with
  `treeLayout: 'tidy' | 'radial' | '3d'` and `morph: number` in `RenderOptions`. 2D layouts draw on
  the canvas2d adapter, the 3D tree on the three adapter (lazy chunk as today). The DOM a11y grid
  stays grid-based; the tree gets a text outline (see section 5).
- **Growth stability:** re-running the layout on every frame makes subtrees jump as they grow.
  Positions tween towards the new layout each frame, and the radial layout keeps a node's angle
  once it is placed (it only re-balances when the run finishes or on rewind).

## 4. Where it appears

- **Play:** a third option beside 2D/3D ("Tree"), with the morph slider in the maze tools widget
  (BUG-01) and a layout picker (tidy / radial / 3D).
- **Watch:** solver overlays on the tree.
- **Explore / Compare:** tree views side by side reveal generator texture; add tree metrics to
  the Compare table (height, mean branching factor, leaf share, longest branch, trunk length /
  height).
- **Race:** optional tree lanes (later).
- **Learn:** a lesson "Mazes are trees" (spanning trees, why a perfect maze has exactly one path,
  what braiding does). Belongs to WI-06's curriculum.

## 5. Accessibility

The tree is announced as a structure, not a picture: a collapsible outline ("Start, 2 branches;
branch 1: 14 cells, ends in a dead end; ...") as an ARIA tree (`role="tree"`) with keyboard
navigation, synced with the canvas highlight. Status messages describe growth in words ("the
tree now has 120 cells, height 34, 18 leaves").

## 6. Slices (each is a mergeable, phone-checked work item)

1. **Core:** `spanningTree`, `TreeTracker`, the three layouts, property tests. No UI.
2. **Static 2D tree in Play:** "Tree" view mode with the tidy and radial layouts of the finished
   maze, the trunk highlighted, the grid<->tree morph slider, and the ARIA outline.
3. **Growth:** live tree during generation, timeline/rewind working (deterministic replay), tween
   stability, the forest view for Kruskal and re-rooting for Origin Shift.
4. **3D tree:** three.js botanical layout, camera controls, generation colours. Protect the
   existing 3D cube view and first-person walkthrough (L-17).
5. **Solvers and metrics:** Watch overlays on the tree, tree metrics in Explore/Compare,
   braided-maze loop edges.

## 7. Decisions (owner, 2026-10-03)

- Root: the growing forest is rooted at each piece's oldest cell (`GenerationTracker.seenOrder`);
  when generation finishes the tree re-roots at the start with an animated ease.
- Placement: a third view mode (2D / 3D / Tree) on Play and Watch, Maze/Tree on Compare.
- Implementation notes: the renderer port gained `RenderOptions.tree` (layout, morph, pullKey,
  highlight) instead of a new `ViewMode`; tidy/radial draw on the canvas adapter and the 3D tree
  on the three.js adapter. The 3D tree uses one silhouette for every maze (widest branch = 45 %
  of the height) so deep backtracker trees and bushy Prim's trees both read as trees.
- Still open: a size cap for the 3D tree on phones (instancing handled the default sizes
  without trouble in testing).

## 8. Original open questions

- Root at the start cell (trunk = solution) or at the generator's first cell (shows the growth
  order truthfully)? Proposal: grow from the generator's root while generating, re-root to the
  start when it finishes (with a "re-root" animation), and offer the choice in options.
- Upper size limit for the 3D tree on phones (instancing should handle ~5k cells; larger mazes
  could switch to the radial 2D view).
- Should the Tree view become its own route (`/tree`) or stay a view mode of Play/Watch?
  Proposal: a view mode, so every existing page gets it.
