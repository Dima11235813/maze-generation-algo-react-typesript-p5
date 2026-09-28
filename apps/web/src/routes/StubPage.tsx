import { Button } from '@maze/ui';
import { Link } from '@tanstack/react-router';

export interface StubPageProps {
  title: string;
  description: string;
  /** Roadmap phase that ships it (see proj-mgmt/14-roadmap.md). */
  phase: string;
}

export function StubPage({ title, description, phase }: StubPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted">{description}</p>
      <p className="text-sm text-muted">
        Planned for <strong className="text-fg">{phase}</strong> of the roadmap in the project
        plan (<code className="font-mono text-xs">proj-mgmt/14-roadmap.md</code>). The engine
        behind it already exists in <code className="font-mono text-xs">@maze/core</code>; this
        page is the user experience still to be built.
      </p>
      <div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/play">Back to Play</Link>
        </Button>
      </div>
    </div>
  );
}

export function WatchPage() {
  return (
    <StubPage
      title="Watch"
      description="Pick a solver and watch it run with play, pause, step and speed controls, frontier and visited overlays, pseudo-code highlighting and a data-structure view."
      phase="Phase 3"
    />
  );
}

export function RacePage() {
  return (
    <StubPage
      title="Race"
      description="Two solvers on the same seeded maze, advancing in lockstep. Compare steps, nodes expanded and path optimality, then share the replay."
      phase="Phase 3"
    />
  );
}

export function BuildPage() {
  return (
    <StubPage
      title="Build"
      description="Toggle walls, move the start and goal, resize, braid dead ends, validate reachability, then save, version and share your maze."
      phase="Phase 4"
    />
  );
}

export function LearnPage() {
  return (
    <StubPage
      title="Learn"
      description="A twelve-module curriculum from grids and graphs through DFS, BFS, spanning trees, Dijkstra and A*, each lesson bound to a live demo you can step through."
      phase="Phase 5"
    />
  );
}

export function ExplorePage() {
  return (
    <StubPage
      title="Explore"
      description="The algorithm catalogue with complexity, bias and texture, side-by-side Compare mode on one seed, and a metrics dashboard for any maze."
      phase="Phase 3"
    />
  );
}

export function AccountPage() {
  return (
    <StubPage
      title="Account"
      description="Everything works as a guest today; your preferences and library live in this browser. Sign-in, cloud sync and sharing arrive with the API."
      phase="Phase 4"
    />
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted">That path does not lead anywhere. Even mazes have exits.</p>
      <div>
        <Button asChild size="sm">
          <Link to="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
