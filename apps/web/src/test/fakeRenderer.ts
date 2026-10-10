import type {
  CameraState,
  Renderer,
  RendererFactory,
  RendererEvents,
  RendererFactoryOptions,
} from '@maze/renderer';
import type { RendererFactories } from '../maze/rendererFactories';

export interface FakeRenderer extends Renderer {
  calls: string[];
  lastMaze: unknown;
  lastGeneration: unknown;
  lastSolve: unknown;
  lastFirstPerson: unknown;
  lastCamera: CameraState | null;
  lastOptions: RendererFactoryOptions['options'];
  lastTheme: RendererFactoryOptions['theme'];
  renderCount: number;
  /** The events the app registered, so tests can simulate canvas clicks. */
  events: RendererEvents;
}

export function createFakeRenderer(kind: '2d' | '3d', opts: RendererFactoryOptions): FakeRenderer {
  const r: FakeRenderer = {
    kind,
    calls: [],
    lastMaze: null,
    lastGeneration: null,
    lastSolve: null,
    lastFirstPerson: null,
    lastCamera: null,
    lastOptions: opts.options,
    lastTheme: opts.theme,
    renderCount: 0,
    events: opts.events ?? {},
    mount: () => r.calls.push('mount'),
    setMaze: (m) => {
      r.lastMaze = m;
      r.calls.push('setMaze');
    },
    setGeneration: (t) => {
      r.lastGeneration = t;
      r.calls.push('setGeneration');
    },
    setSolve: (t) => {
      r.lastSolve = t;
      r.calls.push('setSolve');
    },
    setTheme: (t) => {
      r.lastTheme = t;
      r.calls.push('setTheme');
    },
    setOptions: (o) => {
      r.lastOptions = o;
      r.calls.push('setOptions');
    },
    setCamera: (c) => {
      r.lastCamera = c;
      r.calls.push('setCamera');
    },
    setFirstPerson: (fp) => {
      r.lastFirstPerson = fp;
      r.calls.push('setFirstPerson');
    },
    setPointer: () => undefined,
    setEvents: (e) => {
      r.events = e;
    },
    resize: () => r.calls.push('resize'),
    requestRender: () => {
      r.renderCount++;
    },
    toDataURL: () => 'data:image/png;base64,',
    destroy: () => r.calls.push('destroy'),
  };
  return r;
}

/** Records every renderer created so tests can inspect them. */
export function createFakeFactories(): RendererFactories & { created: FakeRenderer[] } {
  const created: FakeRenderer[] = [];
  const make =
    (kind: '2d' | '3d'): RendererFactory =>
    (opts) => {
      const r = createFakeRenderer(kind, opts);
      created.push(r);
      return r;
    };
  return {
    created,
    create2d: () => Promise.resolve(make('2d')),
    create3d: () => Promise.resolve(make('3d')),
  };
}
