import { solvers } from '@maze/core';
import { describe, expect, it } from 'vitest';
import {
  RACE_SIZE_DEFAULT,
  RACE_SIZE_MAX,
  RaceRun,
  buildRaceMaze,
  parseAgents,
  parseScoring,
  parseSize,
  runRaceToEnd,
  type RaceSetup,
} from './race';

const setup: RaceSetup = {
  seed: 'race-url',
  generatorId: 'recursive-backtracker',
  agents: ['bfs', 'astar', 'dfs'],
  scoring: 'first-to-goal',
  size: 12,
};

/** Manual scheduler: the player never advances on its own. */
const noSchedule = () => () => undefined;

describe('race URL parsing', () => {
  const known = solvers.ids;

  it('keeps known, unique solver ids, at most four', () => {
    expect(parseAgents('bfs,astar', known)).toEqual(['bfs', 'astar']);
    expect(parseAgents('bfs,bfs,nope,dfs', known)).toEqual(['bfs', 'dfs']);
    expect(parseAgents(known.join(','), known)).toHaveLength(4);
  });

  it('tops up to two agents so a race can always start', () => {
    expect(parseAgents(undefined, known)).toEqual(['bfs', 'astar']);
    expect(parseAgents('astar', known)).toEqual(['astar', 'bfs']);
    expect(parseAgents('bfs', known)).toEqual(['bfs', 'astar']);
  });

  it('falls back to defaults for unknown scoring and out-of-range sizes', () => {
    expect(parseScoring('composite')).toBe('composite');
    expect(parseScoring('fastest')).toBe('first-to-goal');
    expect(parseSize(undefined)).toBe(RACE_SIZE_DEFAULT);
    expect(parseSize('9999')).toBe(RACE_SIZE_MAX);
    expect(parseSize('abc')).toBe(RACE_SIZE_DEFAULT);
  });
});

describe('race determinism', () => {
  it('the same setup always builds the same maze and result', () => {
    expect(buildRaceMaze(setup).document.walls).toBe(buildRaceMaze(setup).document.walls);
    const a = runRaceToEnd(setup);
    const b = runRaceToEnd(setup);
    expect(a.ranking).toEqual(b.ranking);
    expect(a.perAgent).toEqual(b.perAgent);
    expect(a.ticks).toBe(b.ticks);
    expect(a.ranking).toHaveLength(3);
  });

  it('a different seed gives a different maze', () => {
    expect(buildRaceMaze({ ...setup, seed: 'other' }).document.walls).not.toBe(
      buildRaceMaze(setup).document.walls,
    );
  });
});

describe('RaceRun', () => {
  it('folds ticks into one tracker per lane and matches the reference result', () => {
    const run = new RaceRun(setup, { schedule: noSchedule });
    run.player.runToEnd();
    const reference = runRaceToEnd(setup);
    expect(run.result?.ranking).toEqual(reference.ranking);
    expect(run.player.getSnapshot().stepCount).toBe(reference.ticks);

    const standings = run.standings();
    expect(standings.map((s) => s.agentId)).toEqual(['bfs', 'astar', 'dfs']);
    for (const s of standings) {
      const r = reference.perAgent[s.agentId]!;
      expect(s.status).toBe('goal');
      expect(s.expanded).toBe(r.expanded);
      expect(s.pathLength).toBe(r.pathLength);
      expect(s.finishedAtTick).toBe(r.finishedAtTick);
    }
    // BFS and A* find the shortest path.
    expect(standings[0]!.pathLength).toBe(run.solutionLength);
    expect(standings[1]!.pathLength).toBe(run.solutionLength);
    run.dispose();
  });

  it('step back and restart replay exactly', () => {
    const run = new RaceRun(setup, { schedule: noSchedule });
    run.player.step(10);
    const at10 = run.standings();
    run.player.step(5);
    run.player.stepBack(5);
    expect(run.standings()).toEqual(at10);
    run.player.restart();
    expect(run.standings().every((s) => s.steps === 0 && s.status === 'running')).toBe(true);
    run.dispose();
  });

  it('asks every lane canvas to redraw when the race advances', () => {
    const run = new RaceRun(setup, { schedule: noSchedule });
    const calls = [0, 0, 0];
    calls.forEach((_, i) => {
      run.renderSink(i).setRenderRequest(() => {
        calls[i]!++;
      });
    });
    run.player.step();
    expect(calls).toEqual([1, 1, 1]);
    run.dispose();
  });
});
