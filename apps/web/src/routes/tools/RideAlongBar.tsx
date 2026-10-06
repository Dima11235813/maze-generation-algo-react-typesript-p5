import { Button } from '@maze/ui';
import { Eye, X } from 'lucide-react';

export interface RideAlongBarProps {
  statusText: string;
  onStop: () => void;
}

/** One line under the maze while riding along: what the camera is doing and a way out. */
export function RideAlongBar({ statusText, onStop }: RideAlongBarProps) {
  return (
    <div
      className="flex min-h-10 items-center gap-2 border-t border-border bg-panel px-3 py-1 text-sm"
      data-testid="ride-along-bar"
    >
      <Eye className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate" title={statusText}>
        {statusText}
      </span>
      <Button size="sm" variant="secondary" onClick={onStop}>
        <X className="h-4 w-4" aria-hidden="true" /> Stop riding
      </Button>
    </div>
  );
}
