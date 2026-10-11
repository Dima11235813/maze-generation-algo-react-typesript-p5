/**
 * Lazily loaded renderer adapters. three.js lives in its own chunk and is only fetched when
 * the 3D view is first shown. Tests inject fakes through `RendererFactoriesContext`.
 */
import type { RendererFactory } from '@maze/renderer';
import { createContext, useContext } from 'react';

export interface RendererFactories {
  create2d(): Promise<RendererFactory>;
  create3d(): Promise<RendererFactory>;
}

const defaultRendererFactories: RendererFactories = {
  create2d: () => import('@maze/renderer/canvas2d').then((m) => m.createCanvas2dRenderer),
  create3d: () => import('@maze/renderer/three').then((m) => m.createThreeRenderer),
};

export const RendererFactoriesContext = createContext<RendererFactories>(defaultRendererFactories);

export function useRendererFactories(): RendererFactories {
  return useContext(RendererFactoriesContext);
}
