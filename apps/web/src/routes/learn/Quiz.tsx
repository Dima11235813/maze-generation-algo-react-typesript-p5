/**
 * A lesson quiz (proj-mgmt/13 section 12): a plain form of radio groups, checked all at once.
 * Each answer then says whether it was right and why; the score is spoken by a live region.
 * Passing completes the lesson (the page records the attempt).
 */
import { Button, cn } from '@maze/ui';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useId, useState, type SyntheticEvent } from 'react';
import type { QuizSpec } from '../../content/learn/types';

export interface QuizProps {
  quiz: QuizSpec;
  onChecked: (correct: number, total: number, passed: boolean) => void;
}

export function Quiz({ quiz, onChecked }: QuizProps) {
  const id = useId();
  const { questions } = quiz;
  const total = questions.length;
  const passMark = Math.min(total, quiz.passMark ?? total);
  const [answers, setAnswers] = useState<Readonly<Record<string, number>>>({});
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  const check = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (checked) {
      // "Try again": keep the answers, unlock them.
      setChecked(false);
      setResult(null);
      return;
    }
    if (answered < total) {
      setResult(`Answer every question first: ${String(answered)} of ${String(total)} answered.`);
      return;
    }
    const correct = questions.filter((q) => answers[q.id] === q.answer).length;
    const passed = correct >= passMark;
    setChecked(true);
    setResult(
      passed
        ? `${String(correct)} of ${String(total)} correct. Passed: this lesson is complete.`
        : `${String(correct)} of ${String(total)} correct; ${String(passMark)} are needed to pass. Read the notes under each answer and try again.`,
    );
    onChecked(correct, total, passed);
  };

  return (
    <form aria-label="Quiz" className="flex flex-col gap-4" onSubmit={check} noValidate>
      {questions.map((q, i) => {
        const right = answers[q.id] === q.answer;
        return (
          <fieldset key={q.id} className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">
              {i + 1}. {q.prompt}
            </legend>
            {q.choices.map((choice, j) => (
              <label
                key={choice}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-panel-2',
                  checked && 'cursor-default hover:bg-transparent',
                )}
              >
                <input
                  type="radio"
                  className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  name={`${id}-${q.id}`}
                  value={j}
                  checked={answers[q.id] === j}
                  disabled={checked}
                  onChange={() => {
                    setAnswers((a) => ({ ...a, [q.id]: j }));
                  }}
                />
                <span>{choice}</span>
              </label>
            ))}
            {checked ? (
              <p
                className={cn(
                  'flex items-start gap-2 rounded-md border px-2 py-1.5 text-sm',
                  right ? 'border-accent/40' : 'border-danger/40',
                )}
              >
                {right ? (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                )}
                <span>
                  <strong>{right ? 'Correct.' : 'Not quite.'}</strong>{' '}
                  {right ? '' : `The answer is "${q.choices[q.answer] ?? ''}". `}
                  {q.explain}
                </span>
              </p>
            ) : null}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" variant={checked ? 'secondary' : 'default'}>
          {checked ? 'Try again' : 'Check answers'}
        </Button>
        <span className="text-xs text-muted">
          {passMark === total
            ? 'Answer all correctly to pass.'
            : `${String(passMark)} of ${String(total)} correct to pass.`}
        </span>
      </div>
      <p role="status" className="text-sm font-medium empty:hidden">
        {result}
      </p>
    </form>
  );
}
