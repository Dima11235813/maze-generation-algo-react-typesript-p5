import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@maze/ui';
import { useState } from 'react';
import { useLibrary, type LibraryItem } from '../../state/library';

export interface LibrarySheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onLoad(item: LibraryItem): void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function LibrarySheet({ open, onOpenChange, onLoad }: LibrarySheetProps) {
  const items = useLibrary((s) => s.items);
  const remove = useLibrary((s) => s.remove);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" aria-describedby="library-desc">
        <SheetHeader>
          <SheetTitle>Library</SheetTitle>
          <SheetDescription id="library-desc">
            Mazes saved in this browser ({items.length}).
          </SheetDescription>
        </SheetHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing saved yet. Generate a maze and press <strong>Save</strong>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 rounded-md border border-border p-2">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    width={64}
                    height={48}
                    className="h-12 w-16 shrink-0 rounded-sm border border-border object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="h-12 w-16 shrink-0 rounded-sm border border-border bg-panel-2" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted">
                    {item.document.width} x {item.document.height}
                    {item.document.provenance ? ` - ${item.document.provenance.algorithm}` : ''}
                    <br />
                    {formatDate(item.createdAt)}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        onLoad(item);
                        onOpenChange(false);
                      }}
                      aria-label={`Load ${item.name}`}
                    >
                      Load
                    </Button>
                    {confirmId === item.id ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => remove(item.id)} aria-label={`Confirm delete ${item.name}`}>
                          Confirm delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(item.id)} aria-label={`Delete ${item.name}`}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
