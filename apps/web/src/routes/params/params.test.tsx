import { generators, solvers, type AlgorithmMeta } from '@maze/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  describeParamValues,
  isDefaultParams,
  nameWithParams,
  paramsFor,
} from '../../maze/algoParams';
import { MazeSession } from '../../maze/session';
import { currentParams } from '../../maze/useAlgoParams';
import { createPrefsStore, usePrefs } from '../../state/prefs';
import { optimalText } from '../../maze/statsText';
import { AlgorithmParams, ParamFields } from './ParamFields';

/** An algorithm nobody wrote UI for: one descriptor of every kind. */
const FAKE: AlgorithmMeta = {
  id: 'fake-algo',
  name: 'Fake Algorithm',
  family: 'generator',
  summary: 'Test only.',
  complexity: { time: 'O(1)', space: 'O(1)' },
  tags: [],
  params: [
    { key: 'bias', label: 'Bias', kind: 'float', min: 0, max: 1, step: 0.05, default: 0.5 },
    {
      key: 'depth',
      label: 'Depth',
      kind: 'int',
      min: 1,
      max: 64,
      default: 4,
      description: 'How deep.',
    },
    { key: 'budget', label: 'Budget', kind: 'int', min: 0, max: 1_000_000, default: 0 },
    { key: 'wrap', label: 'Wrap around', kind: 'bool', default: false },
    {
      key: 'mode',
      label: 'Mode',
      kind: 'enum',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
      default: 'a',
    },
  ],
  docsSlug: 'learn/fake',
  since: '0.0.0',
};

const manual = { schedule: () => () => undefined, now: () => 0 };

describe('ParamFields', () => {
  it('renders a labelled control for every descriptor kind with no algorithm-specific UI', () => {
    render(<ParamFields meta={FAKE} values={{}} onChange={() => undefined} />);
    expect(screen.getByRole('slider', { name: 'Bias' })).toHaveAttribute('aria-valuenow', '0.5');
    expect(screen.getByRole('slider', { name: 'Depth' })).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByText('How deep.')).toBeInTheDocument();
    // A million stops is no slider: a number input instead.
    expect(screen.getByRole('spinbutton', { name: 'Budget' })).toHaveValue(0);
    expect(screen.getByRole('switch', { name: /wrap around/i })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Mode' })).toHaveTextContent('Alpha');
  });

  it('reports edits by key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ParamFields meta={FAKE} values={{ wrap: false }} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: /wrap around/i }));
    expect(onChange).toHaveBeenCalledWith('wrap', true);
    const budget = screen.getByRole('spinbutton', { name: 'Budget' });
    await user.clear(budget);
    await user.type(budget, '250{Enter}');
    expect(onChange).toHaveBeenCalledWith('budget', 250);
  });

  it('renders nothing for an algorithm without parameters', () => {
    const { container } = render(
      <ParamFields meta={{ ...FAKE, params: [] }} values={{}} onChange={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AlgorithmParams (bound to prefs)', () => {
  beforeEach(() => {
    localStorage.clear();
    usePrefs.getState().reset();
  });

  it.each(
    [...generators.all, ...solvers.all].filter((a) => a.meta.params.length > 0).map((a) => a.meta),
  )('$name shows one control per descriptor', (meta) => {
    render(<AlgorithmParams algorithmId={meta.id} />);
    const section = screen.getByRole('region', { name: `${meta.name} parameters` });
    for (const p of meta.params) {
      expect(within(section).getAllByText(p.label).length).toBeGreaterThan(0);
    }
  });

  it('saves edits per algorithm and resets them', async () => {
    const user = userEvent.setup();
    render(<AlgorithmParams algorithmId="random-mouse" />);
    const reset = screen.getByRole('button', { name: /reset random mouse parameters/i });
    expect(reset).toBeDisabled();
    await user.click(screen.getByRole('switch'));
    expect(usePrefs.getState().algoParams['random-mouse']).toEqual({ noBacktrack: false });
    expect(currentParams('random-mouse').noBacktrack).toBe(false);
    await user.click(reset);
    expect(usePrefs.getState().algoParams['random-mouse']).toBeUndefined();
  });

  it('says so when the algorithm has none (showEmpty)', () => {
    render(<AlgorithmParams algorithmId="bfs" showEmpty />);
    expect(screen.getByText(/has no parameters/i)).toBeInTheDocument();
  });
});

describe('algoParams helpers', () => {
  it('clamps stored values against the descriptors', () => {
    const p = paramsFor({ 'fake-algo': { bias: 7, depth: 2.6, mode: 'zzz', extra: 1 } }, FAKE);
    expect(p).toEqual({ bias: 1, depth: 3, budget: 0, wrap: false, mode: 'a' });
    expect(isDefaultParams(FAKE, paramsFor({}, FAKE))).toBe(true);
  });

  it('describes only the changed values', () => {
    const p = paramsFor({ 'fake-algo': { mode: 'b', wrap: true } }, FAKE);
    expect(describeParamValues(FAKE, p)).toBe('Wrap around on, Mode Beta');
    expect(nameWithParams(FAKE, p)).toBe('Fake Algorithm (Wrap around on, Mode Beta)');
    expect(nameWithParams(FAKE, paramsFor({}, FAKE))).toBe('Fake Algorithm');
  });

  it('prefs keep only plain parameter values', () => {
    localStorage.setItem(
      'maze-lab:prefs',
      JSON.stringify({
        state: { algoParams: { astar: { weight: 2, bad: { x: 1 } }, junk: 5 } },
        version: 1,
      }),
    );
    const store = createPrefsStore(localStorage);
    expect(store.getState().algoParams).toEqual({ astar: { weight: 2 } });
  });
});

describe('parameters reach the algorithms', () => {
  it('generate records the parameters in provenance and regenerate reuses them', () => {
    const s = new MazeSession(manual);
    s.generate({
      width: 10,
      height: 8,
      cellSize: 20,
      seed: 'p',
      generatorId: 'growing-tree',
      params: { selection: 'oldest' },
      autoplay: false,
    });
    expect(s.getSnapshot().status).toMatch(/growing tree \(.*oldest/i);
    s.runToEnd();
    const walls = Array.from(s.getSnapshot().state!.walls);
    expect(s.getSnapshot().provenance?.params).toEqual({ selection: 'oldest' });

    s.regenerate();
    s.runToEnd();
    expect(Array.from(s.getSnapshot().state!.walls)).toEqual(walls);

    // The default selection carves a different maze from the same seed.
    s.generate({
      width: 10,
      height: 8,
      cellSize: 20,
      seed: 'p',
      generatorId: 'growing-tree',
      autoplay: false,
    });
    s.runToEnd();
    expect(Array.from(s.getSnapshot().state!.walls)).not.toEqual(walls);
  });

  it('startSolve passes solver parameters (weighted A* is not reported optimal)', () => {
    const s = new MazeSession(manual);
    s.generate({ width: 10, height: 8, cellSize: 20, seed: 'q', autoplay: false });
    s.runToEnd();
    s.startSolve('astar', false, { weight: 3 });
    expect(s.getSnapshot().status).toMatch(/heuristic weight 3/i);
    s.runToEnd();
    expect(s.getSnapshot().solveResult?.stats.optimal).toBe(false);

    s.startSolve('astar', false);
    s.runToEnd();
    expect(s.getSnapshot().solveResult?.stats.optimal).toBe(true);
  });
});

describe('optimal statistic', () => {
  it('measures the path and keeps the guarantee visible', () => {
    expect(optimalText(true, 1)).toBe('yes');
    expect(optimalText(false, 1)).toBe('yes (not guaranteed)');
    expect(optimalText(null, 1)).toBe('yes (not guaranteed)');
    expect(optimalText(null, 1.4)).toBe('no');
    expect(optimalText(true, null)).toBe('yes');
    expect(optimalText(null, null)).toBe('unknown');
  });
});
