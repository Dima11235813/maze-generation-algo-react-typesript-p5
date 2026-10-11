import { Button } from '@maze/ui';
import { Link } from '@tanstack/react-router';

interface StubPageProps {
  title: string;
  description: string;
  /** Roadmap phase that ships it (see proj-mgmt/14-roadmap.md). */
  phase: string;
}

function StubPage({ title, description, phase }: StubPageProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted">{description}</p>
      <p className="text-sm text-muted">
        Planned for <strong className="text-fg">{phase}</strong> of the roadmap in the project plan
        (<code className="font-mono text-xs">proj-mgmt/14-roadmap.md</code>). The engine behind it
        already exists in <code className="font-mono text-xs">@maze/core</code>; this page is the
        user experience still to be built.
      </p>
      <div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/play">Back to Play</Link>
        </Button>
      </div>
    </div>
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
