import type { ValidationIssue } from '@maze/core';
import { Button, NumberField, Slider, cn } from '@maze/ui';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  Image,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';

export interface ValidationListProps {
  issues: readonly ValidationIssue[];
  /** Moves the cursor to the issue's first cell and announces it. */
  onFocusIssue: (issue: ValidationIssue) => void;
}

/** Validation issues as buttons: each moves the keyboard cursor to the cells it is about. */
export function ValidationList({ issues, onFocusIssue }: ValidationListProps) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm" role="status">
        <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />A perfect maze: every
        cell is reachable and there is exactly one way to the goal.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Validation issues">
      {issues.map((issue) => {
        const Icon = issue.severity === 'error' ? XCircle : AlertTriangle;
        const focusable = (issue.cells?.length ?? 0) > 0;
        return (
          <li key={issue.code}>
            <button
              type="button"
              disabled={!focusable}
              onClick={() => {
                onFocusIssue(issue);
              }}
              className={cn(
                'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-sm',
                issue.severity === 'error' ? 'border-danger' : 'border-border',
                focusable ? 'hover:bg-panel-2' : 'cursor-default',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  issue.severity === 'error' ? 'text-danger' : 'text-muted',
                )}
                aria-hidden="true"
              />
              <span>
                <span className="sr-only">
                  {issue.severity === 'error' ? 'Error: ' : 'Warning: '}
                </span>
                {issue.message}
                {focusable ? <span className="text-muted"> Show</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export interface MazeOpsProps {
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
  onBraid: (percent: number) => void;
  onFill: (kind: 'walls' | 'open') => void;
}

/** Size, braiding and fill: whole-maze operations, each one undo step. */
export function MazeOps({ width, height, onResize, onBraid, onFill }: MazeOpsProps) {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [percent, setPercent] = useState(50);
  const sized = w !== width || h !== height;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Width" value={w} min={2} max={60} onValueChange={setW} />
        <NumberField label="Height" value={h} min={2} max={60} onValueChange={setH} />
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={!sized}
        onClick={() => {
          onResize(w, h);
        }}
      >
        Resize to {w} x {h}
      </Button>
      <div className="flex items-center gap-2">
        <Slider
          className="min-w-0 flex-1"
          label="Dead ends to remove"
          value={percent}
          min={10}
          max={100}
          step={10}
          valueText={`${String(percent)}%`}
          onValueChange={setPercent}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            onBraid(percent);
          }}
        >
          Braid
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onFill('walls');
          }}
        >
          Close every wall
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onFill('open');
          }}
        >
          Open every wall
        </Button>
      </div>
    </div>
  );
}

export interface ShareOpsProps {
  onSaveCopy: () => void;
  onExport: (kind: 'png' | 'svg' | 'json') => void;
  onImport: (file: File) => void;
  importError: string | null;
}

/** Save as a copy, export (PNG, SVG, JSON) and import (JSON). */
export function ShareOps({ onSaveCopy, onExport, onImport, importError }: ShareOpsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="secondary" onClick={onSaveCopy}>
        Save as a copy
      </Button>
      <div role="group" aria-label="Export" className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onExport('png');
          }}
        >
          <Image className="h-4 w-4" aria-hidden="true" /> PNG
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onExport('svg');
          }}
        >
          <Download className="h-4 w-4" aria-hidden="true" /> SVG
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onExport('json');
          }}
        >
          <FileJson className="h-4 w-4" aria-hidden="true" /> JSON
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="build-import" className="text-sm font-medium">
          Import a maze (JSON)
        </label>
        <input
          ref={fileRef}
          id="build-import"
          type="file"
          accept="application/json,.json"
          className="text-sm file:mr-2 file:rounded-md file:border file:border-border file:bg-panel-2 file:px-2 file:py-1"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            if (fileRef.current) fileRef.current.value = '';
          }}
        />
        {importError ? (
          <p role="alert" className="text-sm text-danger">
            <Upload className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {importError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
