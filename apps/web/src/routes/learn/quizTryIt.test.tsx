import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DemoState, QuizSpec, TryItCheck } from '../../content/learn/types';
import { Quiz } from './Quiz';
import { TryItList } from './TryItList';

const QUIZ: QuizSpec = {
  passMark: 2,
  questions: [
    { id: 'a', prompt: 'One plus one?', choices: ['1', '2', '3'], answer: 1, explain: 'Count.' },
    { id: 'b', prompt: 'Is a queue FIFO?', choices: ['Yes', 'No'], answer: 0, explain: 'It is.' },
  ],
};

describe('Quiz', () => {
  it('is answered, checked and retried with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onChecked = vi.fn();
    render(<Quiz quiz={QUIZ} onChecked={onChecked} />);
    const status = screen.getByRole('status');

    // Checking early asks for every answer and records nothing.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Check answers' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(status).toHaveTextContent('Answer every question first: 0 of 2 answered.');
    expect(onChecked).not.toHaveBeenCalled();

    // From the top: into the first group (arrow keys move and select), then the second.
    screen.getByRole('button', { name: 'Check answers' }).blur();
    await user.tab();
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('radio', { name: '3' })).toBeChecked();
    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(status).toHaveTextContent(
      '1 of 2 correct; 2 are needed to pass. Read the notes under each answer and try again.',
    );
    expect(onChecked).toHaveBeenLastCalledWith(1, 2, false);
    const first = screen.getByRole('group', { name: '1. One plus one?' });
    expect(within(first).getByText(/Not quite\./).parentElement).toHaveTextContent(
      'The answer is "2". Count.',
    );
    expect(screen.getByRole('radio', { name: '3' })).toBeDisabled();

    // Try again unlocks the answers; fix the wrong one and pass.
    expect(screen.getByRole('button', { name: 'Try again' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(status).toBeEmptyDOMElement();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    await user.tab();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(status).toHaveTextContent('2 of 2 correct. Passed: this lesson is complete.');
    expect(onChecked).toHaveBeenLastCalledWith(2, 2, true);
  });

  it('needs every answer right unless a pass mark is given', async () => {
    const user = userEvent.setup();
    render(<Quiz quiz={{ questions: QUIZ.questions }} onChecked={() => undefined} />);
    expect(screen.getByText('Answer all correctly to pass.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '2' }));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Check answers' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 correct; 2 are needed');
  });
});

const demo = (stepCount: number): DemoState => ({
  status: 'paused',
  stepCount,
  lastStep: null,
  maze: null,
  structure: null,
  genStructure: null,
  graph: null,
  pair: null,
});

const CHECKS: TryItCheck[] = [
  {
    id: 'five',
    prompt: 'Reach step 5.',
    hint: 'Step five times.',
    check: (d) => d.stepCount >= 5,
    success: (d) => `You are at step ${String(d.stepCount)}.`,
  },
  {
    id: 'ten',
    prompt: 'Reach step 10.',
    check: (d) => d.stepCount >= 10,
    success: () => 'Ten.',
  },
];

function Harness({ initialDone = [] as string[] }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<readonly string[]>(initialDone);
  return (
    <>
      <button
        onClick={() => {
          setStep((s) => s + 5);
        }}
      >
        Five more
      </button>
      <TryItList
        checks={CHECKS}
        demo={demo(step)}
        done={done}
        onDone={(id) => {
          setDone((d) => [...d, id]);
        }}
      />
    </>
  );
}

describe('TryItList', () => {
  it('ticks each check once when the demo meets it, and says so', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const list = screen.getByRole('list', { name: 'Try it' });
    expect(within(list).getAllByText('To do:')).toHaveLength(2);
    expect(screen.getByText('Hint')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Five more' }));
    expect(screen.getByRole('status')).toHaveTextContent('Try it done. You are at step 5.');
    expect(within(list).getAllByText('Done:')).toHaveLength(1);
    // A done check hides its hint.
    expect(screen.queryByText('Hint')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Five more' }));
    expect(screen.getByRole('status')).toHaveTextContent('Try it done. Ten.');
    expect(within(list).getAllByText('Done:')).toHaveLength(2);
  });

  it('announces checks met at the same moment together', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Five more' }));
    await user.click(screen.getByRole('button', { name: 'Five more' }));
    expect(screen.getByRole('status')).toHaveTextContent('Try it done. Ten.');
    render(<TryItList checks={CHECKS} demo={demo(12)} done={[]} onDone={() => undefined} />);
    expect(screen.getAllByRole('status')[1]).toHaveTextContent(
      'Try it done. You are at step 12. Ten.',
    );
  });

  it('shows remembered checks as done without announcing them again', () => {
    render(<Harness initialDone={['five', 'ten']} />);
    expect(within(screen.getByRole('list', { name: 'Try it' })).getAllByText('Done:')).toHaveLength(
      2,
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
