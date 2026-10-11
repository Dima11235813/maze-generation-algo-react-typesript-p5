/** Shown while a lazily loaded page chunk arrives (after the router's pending delay). */
export function RouteLoading() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
      Loading...
    </div>
  );
}
