# apps/legacy - frozen 2019-2020 Create React App maze generator

> Status: **read-only reference** (ADR-019 strangler-fig migration). Do not add features here.

This is the original p5.js + React 16 + MobX application, moved verbatim from the repository
root on 2026-09-27 with `git mv` (history preserved; use `git log --follow`). It is excluded
from the pnpm workspace and keeps its own `yarn.lock`.

It exists so that the new `apps/web` can be checked against the feature parity checklist in
[../../proj-mgmt/09-modernization-migration.md](../../proj-mgmt/09-modernization-migration.md)
section 4.

## Running it (best effort)

Requires Node 12-14 and Yarn 1 (node-sass 4 does not build on newer Node):

```bash
yarn install
yarn start   # http://localhost:3000/newMaze
```

## Known issues carried over

See [proj-mgmt/00-current-state-assessment.md](../../proj-mgmt/00-current-state-assessment.md).
The API key in `src/.env` is scheduled for rotation (Phase 0) and must not be reused.
