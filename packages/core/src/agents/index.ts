export type {
  Agent,
  RaceAgentResult,
  RaceConfig,
  RaceResult,
  RaceScoring,
  RaceTick,
} from './types';
export {
  MIN_AGENTS,
  MAX_AGENTS,
  DEFAULT_MAX_STEPS,
  createAgent,
  validateRaceConfig,
  runRace,
  raceRanking,
  compositeScores,
  type CreateAgentOptions,
  type RunRaceOptions,
  type RankingReference,
} from './race';
