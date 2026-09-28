import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@maze/ui';
import { useEffect, useState } from 'react';

export interface SaveDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  defaultName: string;
  onSave(name: string): Promise<void>;
}

export function SaveDialog({ open, onOpenChange, defaultName, onSave }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setError(null);
    }
  }, [open, defaultName]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(name);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the maze.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="save-desc">
        <DialogHeader>
          <DialogTitle>Save maze</DialogTitle>
          <DialogDescription id="save-desc">
            Saved to the library in this browser as a portable MazeDocument.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="save-name">Name</Label>
            <input
              id="save-name"
              className="h-9 rounded-md border border-border bg-panel px-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
