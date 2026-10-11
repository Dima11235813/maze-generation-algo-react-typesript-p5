import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AnnouncerContext, type Politeness } from './useAnnouncer';

interface Message {
  text: string;
  seq: number;
}

/**
 * Screen-reader live regions for status messages ("Maze generation complete", ...).
 * Repeated identical messages re-announce because the node is keyed by sequence number.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<Message>({ text: '', seq: 0 });
  const [assertive, setAssertive] = useState<Message>({ text: '', seq: 0 });

  const announce = useCallback((text: string, politeness: Politeness = 'polite') => {
    if (politeness === 'assertive') setAssertive((m) => ({ text, seq: m.seq + 1 }));
    else setPolite((m) => ({ text, seq: m.seq + 1 }));
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        <span key={polite.seq}>{polite.text}</span>
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        <span key={assertive.seq}>{assertive.text}</span>
      </div>
    </AnnouncerContext.Provider>
  );
}
