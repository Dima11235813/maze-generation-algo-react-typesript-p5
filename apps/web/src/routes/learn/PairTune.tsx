/**
 * The tunable lane of a pair demo (M7): its solver's parameter form (A*: heuristic, weight,
 * tie-break), generated from the core meta like every other parameter form. A change restarts
 * both searches on the same maze, and says so.
 */
import { solvers } from '@maze/core';
import { useId } from 'react';
import { useAnnouncer } from '../../app/useAnnouncer';
import { laneName } from '../../learn/pairDemo';
import type { ParamValues } from '../../maze/algoParams';
import { ParamFields } from '../params/ParamFields';
import { Note } from './StructureParts';

export interface PairTuneProps {
  solverId: string;
  /** Where the lane's maze is drawn, to name it in the heading. */
  side: 'left' | 'right';
  values: ParamValues;
  onChange: (key: string, value: unknown) => void;
}

export function PairTune({ solverId, side, values, onChange }: PairTuneProps) {
  const announce = useAnnouncer();
  const headingId = useId();
  const meta = solvers.get(solverId)?.meta;
  if (!meta || meta.params.length === 0) return null;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 border-t border-border pt-3"
    >
      <h4 id={headingId} className="text-sm font-medium">
        Tune the {side} search
      </h4>
      <ParamFields
        meta={meta}
        values={values}
        onChange={(key, value) => {
          onChange(key, value);
          announce(
            `Restarted both searches; the ${side} one is now ${laneName(solverId, { ...values, [key]: value })}.`,
          );
        }}
      />
      <Note>A change restarts both searches on the same maze.</Note>
    </section>
  );
}
