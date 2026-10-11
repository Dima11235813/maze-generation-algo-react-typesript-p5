import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@maze/ui';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';

type Pillar = {
  to: '/play' | '/watch' | '/race' | '/build' | '/learn' | '/explore';
  title: string;
  blurb: string;
  live: boolean;
};

const PILLARS: readonly Pillar[] = [
  {
    to: '/play',
    title: 'Play',
    blurb: 'Generate a maze, watch it grow in 2D or 3D, then run it first-person or solve it.',
    live: true,
  },
  {
    to: '/watch',
    title: 'Watch',
    blurb: 'Step through BFS, A* and friends with pseudo-code and data-structure views.',
    live: true,
  },
  {
    to: '/race',
    title: 'Race',
    blurb: 'Two to four solvers, one seed, lockstep. See which wins and why.',
    live: true,
  },
  {
    to: '/build',
    title: 'Build',
    blurb: 'Edit walls, move start and goal, braid dead ends, save and share.',
    live: true,
  },
  {
    to: '/learn',
    title: 'Learn',
    blurb: 'A guided curriculum from grids and graphs to heuristics and complexity.',
    live: true,
  },
  {
    to: '/explore',
    title: 'Explore',
    blurb: 'Compare generators side by side and measure what makes a maze hard.',
    live: true,
  },
];

export function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Maze Lab</h1>
        <p className="max-w-2xl text-muted">
          A playground for maze algorithms. Mazes are grid graphs; generating them is spanning-tree
          construction and solving them is graph search. Watch the recursive backtracker carve its
          way through a 3D grid, then step inside and run it.
        </p>
        <div>
          <Button asChild size="md">
            <Link to="/play">
              Start playing <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="pillars-heading" className="flex flex-col gap-3">
        <h2 id="pillars-heading" className="text-lg font-semibold">
          Six ways in
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {PILLARS.map((p) => (
            <li key={p.to}>
              {/* Upcoming pillars get a dashed outline, not reduced opacity: text keeps 4.5:1. */}
              <Card className={cn('h-full', !p.live && 'border-dashed')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    {p.title}
                    {p.live ? null : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                        coming soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{p.blurb}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant={p.live ? 'default' : 'outline'} size="sm">
                    <Link to={p.to} aria-label={`${p.live ? 'Open' : 'Preview'} ${p.title}`}>
                      {p.live ? 'Open' : 'Preview'}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
