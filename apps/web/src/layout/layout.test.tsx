import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { Section } from './Section';
import { Workspace } from './Workspace';

describe('Section', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('expands and collapses from its header button and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Section id="t-stats" title="Statistics" summary="BFS">
        <p>Body text</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: /statistics/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Body text')).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Body text')).not.toBeVisible();
    expect(screen.getByText('BFS')).toBeVisible();
    unmount();

    // A fresh mount restores the remembered (collapsed) state over the default.
    render(
      <Section id="t-stats" title="Statistics" defaultOpen>
        <p>Body text</p>
      </Section>,
    );
    expect(screen.getByRole('button', { name: /statistics/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('starts collapsed when defaultOpen is false and nothing is remembered', () => {
    render(
      <Section id="t-log" title="Step log" defaultOpen={false}>
        <p>Log</p>
      </Section>,
    );
    expect(screen.getByRole('button', { name: /step log/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('Workspace', () => {
  it('renders a labelled maze region with optional left and side columns', () => {
    render(
      <Workspace stageLabel="Maze" stage={<p>stage</p>} left={<p>left</p>} side={<p>side</p>} />,
    );
    expect(screen.getByRole('region', { name: 'Maze' })).toHaveTextContent('stage');
    expect(screen.getByText('left')).toBeInTheDocument();
    expect(screen.getByText('side')).toBeInTheDocument();
  });
});
