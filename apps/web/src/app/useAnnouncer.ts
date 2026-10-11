import { createContext, useContext } from 'react';

export type Politeness = 'polite' | 'assertive';

export interface AnnouncerContextValue {
  announce: (message: string, politeness?: Politeness) => void;
}

/** Provided by `AnnouncerProvider` (Announcer.tsx); a no-op outside it (tests, previews). */
export const AnnouncerContext = createContext<AnnouncerContextValue>({ announce: () => undefined });

/** Speaks a status message through the app's live regions. */
export function useAnnouncer(): AnnouncerContextValue['announce'] {
  return useContext(AnnouncerContext).announce;
}
