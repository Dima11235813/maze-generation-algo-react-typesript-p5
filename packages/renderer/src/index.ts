// Framework- and WebGL-free surface: the port, colour maths and shared geometry helpers.
// Adapters live behind sub-path exports so the three.js chunk stays lazy:
//   import { createCanvas2dRenderer } from '@maze/renderer/canvas2d';
//   import { createThreeRenderer } from '@maze/renderer/three';
export * from './types';
export * from './color';
export * from './layout';
export * from './overlay';
