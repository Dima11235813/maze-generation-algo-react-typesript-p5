/**
 * "Run until ..." row below the maze (never on it): pick a breakpoint, give N when it needs one,
 * run at the current speed, and read where it stopped. Used by lesson demos and Watch.
 */
import { Button, NumberField, SimpleSelect } from '@maze/ui';
import { Square, StepForward } from 'lucide-react';
import type { BreakpointRun } from '../../learn/useBreakpointRun';

export function BreakpointBar({ run }: { run: BreakpointRun }) {
  const { choices, choice, count, needsCount, running, message } = run;
  if (choices.length === 0 || choice === null) return null;
  const label = choices.find((c) => c.id === choice)?.label ?? '';
  const target = label.replace('N', String(count));
  return (
    <div
      role="group"
      aria-label="Breakpoint"
      className="flex flex-wrap items-end gap-2 border-t border-border bg-panel px-3 py-2"
    >
      <SimpleSelect
        label="Run until"
        className="min-w-0 flex-1"
        value={choice}
        options={choices.map((c) => ({ value: c.id, label: c.label }))}
        onValueChange={run.setChoice}
        disabled={running}
      />
      {needsCount ? (
        <NumberField
          label="N"
          className="w-24"
          value={count}
          min={1}
          max={999}
          onValueChange={run.setCount}
          disabled={running}
        />
      ) : null}
      {running ? (
        <Button
          size="md"
          variant="secondary"
          onClick={run.stop}
          aria-label={`Stop running until ${target}`}
        >
          <Square className="h-4 w-4" aria-hidden="true" /> Stop
        </Button>
      ) : (
        <Button
          size="md"
          onClick={run.run}
          disabled={!run.canRun}
          aria-label={`Run until ${target}`}
        >
          <StepForward className="h-4 w-4" aria-hidden="true" /> Run
        </Button>
      )}
      {message ? (
        <p className="w-full text-xs text-muted" data-testid="breakpoint-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
