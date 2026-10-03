import { treeMetrics, treeify, type CellId, type MazeState } from '@maze/core';
import { cn } from '@maze/ui';
import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  buildSegments,
  segmentLabel,
  segmentSubtreeCells,
  type TreeSegment,
} from '../../maze/treeView';

export interface TreeOutlineProps {
  /** The finished maze (null while generating). */
  maze: MazeState | null;
  /** Called with the cells of the selected branch (null clears the highlight). */
  onHighlight: (cells: readonly CellId[] | null) => void;
}

interface Row {
  readonly seg: TreeSegment;
  readonly level: number;
  readonly posinset: number;
  readonly setsize: number;
}

/** Visible rows: depth-first over expanded segments (iterative; trunks can be deep). */
function visibleRows(segments: readonly TreeSegment[], expanded: ReadonlySet<number>): Row[] {
  const rows: Row[] = [];
  const root = segments[0];
  if (!root) return rows;
  const stack: Row[] = [{ seg: root, level: 1, posinset: 1, setsize: 1 }];
  while (stack.length > 0) {
    const row = stack.pop() as Row;
    rows.push(row);
    if (!expanded.has(row.seg.id)) continue;
    const kids = row.seg.children;
    for (let i = kids.length - 1; i >= 0; i--) {
      const seg = segments[kids[i] as number];
      if (seg) stack.push({ seg, level: row.level + 1, posinset: i + 1, setsize: kids.length });
    }
  }
  return rows;
}

/**
 * The maze as an outline: its corridors and forks from the start, the solution path first.
 * A WAI-ARIA tree (arrow keys move, Right/Left open and close, Home/End jump); the focused item
 * is highlighted on the canvas.
 */
export function TreeOutline({ maze, onHighlight }: TreeOutlineProps) {
  const tree = useMemo(
    () => (maze ? treeify(maze, { root: maze.start, target: maze.goal }) : null),
    [maze],
  );
  const segments = useMemo(
    () => (tree && maze ? buildSegments(tree, maze.goal) : []),
    [tree, maze],
  );
  const metrics = useMemo(() => (maze ? treeMetrics(maze) : null), [maze]);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [focused, setFocused] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const itemRefs = useRef(new Map<number, HTMLLIElement>());

  // A new maze starts collapsed at the root.
  useEffect(() => {
    setExpanded(new Set([0]));
    setFocused(0);
    setSelected(null);
    onHighlight(null);
  }, [segments, onHighlight]);

  const rows = useMemo(() => visibleRows(segments, expanded), [segments, expanded]);

  const select = useCallback(
    (id: number) => {
      setSelected(id);
      // The root's subtree is the whole maze: highlight only its own corridor.
      onHighlight(id === 0 ? (segments[0]?.cells ?? null) : segmentSubtreeCells(segments, id));
    },
    [segments, onHighlight],
  );

  const focusRow = (id: number) => {
    setFocused(id);
    itemRefs.current.get(id)?.focus();
    select(id);
  };

  const toggle = (id: number, open?: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const want = open ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = rows.findIndex((r) => r.seg.id === focused);
    const row = rows[i];
    if (!row) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        if (rows[i + 1]) focusRow((rows[i + 1] as Row).seg.id);
        break;
      case 'ArrowUp':
        if (rows[i - 1]) focusRow((rows[i - 1] as Row).seg.id);
        break;
      case 'ArrowRight':
        if (row.seg.children.length > 0) {
          if (!expanded.has(row.seg.id)) toggle(row.seg.id, true);
          else focusRow(row.seg.children[0] as number);
        }
        break;
      case 'ArrowLeft':
        if (expanded.has(row.seg.id) && row.seg.children.length > 0) toggle(row.seg.id, false);
        else if (row.seg.parent !== null) focusRow(row.seg.parent);
        break;
      case 'Home':
        if (rows[0]) focusRow(rows[0].seg.id);
        break;
      case 'End':
        if (rows.length > 0) focusRow((rows[rows.length - 1] as Row).seg.id);
        break;
      case 'Enter':
      case ' ':
        toggle(row.seg.id);
        select(row.seg.id);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  if (!maze || !tree || !metrics) {
    return <p className="text-sm text-muted">The outline appears when the maze is finished.</p>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <dl
        className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3"
        aria-label="Tree facts"
      >
        <div>
          <dt className="text-muted">Cells</dt>
          <dd className="tabular-nums">{tree.count}</dd>
        </div>
        <div>
          <dt className="text-muted">Height</dt>
          <dd className="tabular-nums">{metrics.height}</dd>
        </div>
        <div>
          <dt className="text-muted">Dead ends</dt>
          <dd className="tabular-nums">{tree.leaves}</dd>
        </div>
        <div>
          <dt className="text-muted">Trunk</dt>
          <dd className="tabular-nums">{metrics.trunkLength} cells</dd>
        </div>
        <div>
          <dt className="text-muted">Side branches</dt>
          <dd className="tabular-nums">{metrics.trunkBranches}</dd>
        </div>
        <div>
          <dt className="text-muted">Largest branch</dt>
          <dd className="tabular-nums">{metrics.largestBranch} cells</dd>
        </div>
        {metrics.loopEdges > 0 ? (
          <div>
            <dt className="text-muted">Loops</dt>
            <dd className="tabular-nums">{metrics.loopEdges}</dd>
          </div>
        ) : null}
      </dl>
      <ul
        role="tree"
        aria-label="Maze as a tree"
        className="relative max-h-[24rem] overflow-y-auto rounded-md border border-border text-sm"
        onKeyDown={onKeyDown}
      >
        {rows.map(({ seg, level, posinset, setsize }) => {
          const isOpen = expanded.has(seg.id);
          const hasKids = seg.children.length > 0;
          return (
            // Keys are handled once by the role="tree" container (roving tabindex, WAI-ARIA).
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={seg.id}
              ref={(el) => {
                if (el) itemRefs.current.set(seg.id, el);
                else itemRefs.current.delete(seg.id);
              }}
              role="treeitem"
              aria-level={level}
              aria-posinset={posinset}
              aria-setsize={setsize}
              aria-expanded={hasKids ? isOpen : undefined}
              aria-selected={selected === seg.id}
              tabIndex={focused === seg.id ? 0 : -1}
              onFocus={() => {
                setFocused(seg.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setFocused(seg.id);
                if (hasKids) toggle(seg.id);
                select(seg.id);
              }}
              className={cn(
                'flex min-h-9 cursor-pointer items-start gap-1 border-b border-border px-2 py-1.5 outline-none last:border-b-0',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                selected === seg.id ? 'bg-panel-2' : 'hover:bg-panel-2',
              )}
              // Indentation is capped so deep trunks never push the outline off a phone screen.
              style={{ paddingLeft: `${String(0.5 + Math.min(level - 1, 6) * 0.75)}rem` }}
            >
              <ChevronRight
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform',
                  isOpen && 'rotate-90',
                  !hasKids && 'invisible',
                )}
                aria-hidden="true"
              />
              <span className={cn('min-w-0', seg.onTrunk && 'font-medium')}>
                {segmentLabel(seg)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
