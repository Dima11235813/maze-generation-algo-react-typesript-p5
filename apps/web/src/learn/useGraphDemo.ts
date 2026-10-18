/** Owns a lesson's graph demo (M1): the starting maze from its spec and the edit model. */
import { useRef, useSyncExternalStore } from 'react';
import type { GraphDemoSpec } from '../content/learn/types';
import { GraphDemoModel, graphDemoMaze } from './graphDemo';

export function useGraphDemo(spec: GraphDemoSpec) {
  const ref = useRef<GraphDemoModel | null>(null);
  // The lesson view is keyed by lesson, so the spec never changes under one model.
  ref.current ??= new GraphDemoModel(graphDemoMaze(spec));
  const model = ref.current;
  const snap = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  return { model, snap };
}
