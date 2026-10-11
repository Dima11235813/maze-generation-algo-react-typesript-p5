import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Kbd } from '@maze/ui';
import { PLAY_SHORTCUTS } from './shortcuts';

export interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** `?` help: every Play-page shortcut in one place (WCAG 2.1.4 single-key shortcut disclosure). */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="shortcuts-desc" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription id="shortcuts-desc">
            Single-key shortcuts are ignored while you type in a field or use a slider.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLAY_SHORTCUTS.map((group) => (
            <section key={group.title} aria-labelledby={`sc-${group.title}`}>
              <h3
                id={`sc-${group.title}`}
                className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {group.title}
              </h3>
              <dl className="flex flex-col gap-1 text-sm">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <dt>{item.label}</dt>
                    <dd className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
