import { MAX_AGENTS, MIN_AGENTS, generators, solvers, type RaceScoring } from '@maze/core';
import { SimpleSelect, cn } from '@maze/ui';
import { useId } from 'react';
import { RACE_SCORINGS, SCORING_LABELS } from '../../maze/race';

const SCORING_HINTS: Record<RaceScoring, string> = {
  'first-to-goal': 'Fewest ticks to reach the goal wins.',
  'fewest-expanded': 'The racer that looked at the fewest cells wins.',
  composite: 'Balances speed, effort and path quality.',
};

const SIZES = [10, 15, 20, 30, 40] as const;

export interface RacersPickerProps {
  agents: readonly string[];
  onChange: (agents: string[]) => void;
}

/** Checkbox per registry solver; keeps the selection between two and four. */
export function RacersPicker({ agents, onChange }: RacersPickerProps) {
  const base = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">
        Racers ({MIN_AGENTS} to {MAX_AGENTS})
      </legend>
      <p className="pb-1 text-xs text-muted">
        Pick {MIN_AGENTS} to {MAX_AGENTS} solvers. They race in lockstep: one step each per tick.
      </p>
      {solvers.all.map((s) => {
        const id = `${base}-${s.meta.id}`;
        const checked = agents.includes(s.meta.id);
        const disabled =
          (!checked && agents.length >= MAX_AGENTS) || (checked && agents.length <= MIN_AGENTS);
        return (
          <label
            key={s.meta.id}
            htmlFor={id}
            className={cn(
              'flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-panel-2',
              checked && 'bg-panel-2',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              id={id}
              type="checkbox"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                onChange(
                  e.target.checked ? [...agents, s.meta.id] : agents.filter((a) => a !== s.meta.id),
                );
              }}
            />
            <span className="min-w-0 flex-1 truncate">{s.meta.name}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

export interface RaceRulesProps {
  scoring: RaceScoring;
  onScoringChange: (s: RaceScoring) => void;
  generatorId: string;
  onGeneratorChange: (id: string) => void;
  size: number;
  onSizeChange: (size: number) => void;
}

/** Scoring rule and the maze the race runs on. */
export function RaceRules(p: RaceRulesProps) {
  const name = useId();
  const sizes = SIZES.includes(p.size as (typeof SIZES)[number])
    ? SIZES
    : [...SIZES, p.size].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="pb-1 text-xs font-medium text-muted">Scoring</legend>
        {RACE_SCORINGS.map((s) => {
          const id = `${name}-${s}`;
          return (
            <label
              key={s}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-2',
                p.scoring === s && 'bg-panel-2',
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={s}
                checked={p.scoring === s}
                onChange={() => {
                  p.onScoringChange(s);
                }}
                className="mt-1 h-3.5 w-3.5 accent-[var(--accent)]"
              />
              <span className="flex flex-col">
                {SCORING_LABELS[s]}
                <span className="text-xs text-muted">{SCORING_HINTS[s]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <SimpleSelect
        label="Maze generator"
        value={p.generatorId}
        onValueChange={p.onGeneratorChange}
        options={generators.all.map((g) => ({ value: g.meta.id, label: g.meta.name }))}
      />
      <SimpleSelect
        label="Maze size"
        value={String(p.size)}
        onValueChange={(v) => {
          p.onSizeChange(Number(v));
        }}
        options={sizes.map((n) => ({ value: String(n), label: `${n} x ${n} cells` }))}
      />
    </div>
  );
}
