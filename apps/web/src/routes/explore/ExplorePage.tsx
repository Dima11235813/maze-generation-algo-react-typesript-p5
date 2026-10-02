import { generators, postprocessors, solvers, type AlgorithmMeta } from '@maze/core';
import { Button } from '@maze/ui';
import { Link } from '@tanstack/react-router';
import { GitCompareArrows } from 'lucide-react';
import { AlgorithmCard } from './AlgorithmCard';

function CatalogueSection({ id, title, items }: { id: string; title: string; items: readonly AlgorithmMeta[] }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted">({items.length})</span>
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
        {items.map((m) => (
          <li key={m.id}>
            <AlgorithmCard meta={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Explore pillar: the algorithm catalogue, generated entirely from registry metadata, and the
 * entry point to Compare mode. A new registry entry appears here with zero UI changes.
 */
export function ExplorePage() {
  const gens = generators.all.map((g) => g.meta);
  const sols = solvers.all.map((s) => s.meta);
  const posts = postprocessors.all.map((p) => p.meta);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <p className="max-w-2xl text-muted">
          Every algorithm Maze Lab knows, with its complexity, bias and tunable parameters. Pick a few
          generators and compare them side by side on the same seed to see how texture differs.
        </p>
        <div>
          <Button asChild size="md">
            <Link to="/explore/compare" search={{}}>
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" /> Open Compare mode
            </Link>
          </Button>
        </div>
      </header>
      <CatalogueSection id="generators" title="Generators" items={gens} />
      <CatalogueSection id="solvers" title="Solvers" items={sols} />
      {posts.length > 0 ? <CatalogueSection id="postprocessors" title="Post-processors" items={posts} /> : null}
    </div>
  );
}
