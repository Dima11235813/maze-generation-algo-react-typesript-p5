import { NARRATOR_VERBOSITIES, type NarratorVerbosity } from '@maze/player';

/** Narrator verbosity wording shared by the step log panel and the options sheet. */
export const VERBOSITY_LABELS: Record<NarratorVerbosity, string> = {
  off: 'Off',
  low: 'Milestones only',
  medium: 'Milestones and progress',
  high: 'Every step (rate limited)',
};

export const VERBOSITY_OPTIONS = NARRATOR_VERBOSITIES.map((v) => ({
  value: v,
  label: VERBOSITY_LABELS[v],
}));
