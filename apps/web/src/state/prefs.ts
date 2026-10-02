/**
 * Persisted user preferences (parity items P-07..P-12, P-15, P-16).
 *
 * Stored under `maze-lab:prefs`. On first load, legacy CRA-app localStorage keys are imported
 * once (never deleted) so returning users keep their colours and sizes.
 */
import type { NarratorVerbosity } from '@maze/player';
import type { CameraPreset, ViewMode } from '@maze/renderer';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';
export type MotionPref = 'system' | 'on' | 'off';

export interface Prefs {
  cellSize: number;
  wallWidth: number;
  /** Playback speed in algorithm steps per second (replaces the legacy frame-rate slider). */
  speed: number;
  mode: ViewMode;
  showProjection: boolean;
  mirror: boolean;
  maxProjectionDepth: number | 'auto';
  projectionUnit: number;
  wallHeight: number;
  invert: boolean;
  cellColor: string;
  wallColor: string;
  backgroundColor: string;
  cameraPreset: CameraPreset;
  followPointer: boolean;
  showStartGoal: boolean;
  showGrid: boolean;
  reducedMotion: MotionPref;
  theme: ThemePref;
  generatorId: string;
  solverId: string;
  // Accessibility (D-17)
  /** How much the step narrator says through the live region. */
  narratorVerbosity: NarratorVerbosity;
  /** Mount the screen-reader grid mirror next to the canvas. */
  screenReaderGrid: boolean;
  /** Show the textual step log panel. */
  showStepLog: boolean;
}

export interface PrefsActions {
  set<K extends keyof Prefs>(key: K, value: Prefs[K]): void;
  patch(partial: Partial<Prefs>): void;
  reset(): void;
}

export type PrefsStore = Prefs & PrefsActions;

export const PREFS_STORAGE_KEY = 'maze-lab:prefs';
export const PREFS_VERSION = 1;

export const LIMITS = {
  cellSize: { min: 3, max: 400 },
  wallWidth: { min: 1, max: 200 },
  speed: { min: 1, max: 100_000 },
  maxProjectionDepth: { min: 1, max: 10_000 },
} as const;

export const DEFAULT_PREFS: Prefs = {
  cellSize: 40,
  wallWidth: 1,
  speed: 60,
  mode: '3d',
  showProjection: true,
  mirror: false,
  maxProjectionDepth: 'auto',
  projectionUnit: 1 / 6,
  wallHeight: 0.5,
  invert: false,
  cellColor: '#417505',
  wallColor: '#000000',
  backgroundColor: '#71adf5',
  cameraPreset: 'tilt',
  followPointer: false,
  showStartGoal: true,
  showGrid: false,
  reducedMotion: 'system',
  theme: 'system',
  generatorId: 'recursive-backtracker',
  solverId: 'bfs',
  narratorVerbosity: 'medium',
  screenReaderGrid: true,
  showStepLog: false,
};

const VERBOSITIES: readonly NarratorVerbosity[] = ['off', 'low', 'medium', 'high'];

const PREF_KEYS = Object.keys(DEFAULT_PREFS) as (keyof Prefs)[];

/** Legacy `storageUtils.ts` keys. */
export const LEGACY_KEYS = {
  backgroundColor: 'backgroundColorKey',
  cellColor: 'cellColorKey',
  cellWallColor: 'cellWallColorKey',
  cellSize: 'cellSizeKey',
  cellWallSize: 'cellWallSizeKey',
  cellWallStrokeCapStyle: 'cellWallStrokeCapStyleKey',
  frameRate: 'frameRateKey',
} as const;

function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Legacy colour string "r:g:b[:a]" -> "#rrggbb" (alpha dropped), or null when unparseable. */
export function parseLegacyColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(':').map((p) => p.trim());
  if (parts.length < 3) return null;
  const nums = parts.slice(0, 3).map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [r, g, b] = nums as [number, number, number];
  return toHex(r, g, b);
}

/** Legacy drew the *inverse* of the picked wall colour; store what the user actually saw. */
export function invertHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return toHex(255 - ((n >> 16) & 255), 255 - ((n >> 8) & 255), 255 - (n & 255));
}

function clampInt(raw: string | null, min: number, max: number): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Reads the legacy keys defensively; returns null when none is present. */
export function importLegacyPrefs(storage: Pick<Storage, 'getItem'>): Partial<Prefs> | null {
  const present = Object.values(LEGACY_KEYS).some((k) => storage.getItem(k) !== null);
  if (!present) return null;

  const out: Partial<Prefs> = {};
  const bg = parseLegacyColor(storage.getItem(LEGACY_KEYS.backgroundColor));
  if (bg) out.backgroundColor = bg;
  const cell = parseLegacyColor(storage.getItem(LEGACY_KEYS.cellColor));
  if (cell) out.cellColor = cell;
  const wall = parseLegacyColor(storage.getItem(LEGACY_KEYS.cellWallColor));
  if (wall) out.wallColor = invertHex(wall);
  const cellSize = clampInt(storage.getItem(LEGACY_KEYS.cellSize), LIMITS.cellSize.min, LIMITS.cellSize.max);
  if (cellSize !== null) out.cellSize = cellSize;
  const wallWidth = clampInt(storage.getItem(LEGACY_KEYS.cellWallSize), LIMITS.wallWidth.min, LIMITS.wallWidth.max);
  if (wallWidth !== null) out.wallWidth = wallWidth;
  const frameRate = clampInt(storage.getItem(LEGACY_KEYS.frameRate), LIMITS.speed.min, LIMITS.speed.max);
  if (frameRate !== null) out.speed = frameRate; // legacy ran one step per frame
  return out;
}

/**
 * One-time seed of the new store from legacy keys. Idempotent: does nothing once
 * `maze-lab:prefs` exists. Legacy keys are left untouched.
 */
export function seedPrefsFromLegacy(storage: Storage): boolean {
  try {
    if (storage.getItem(PREFS_STORAGE_KEY) !== null) return false;
    const imported = importLegacyPrefs(storage);
    if (!imported) return false;
    const state: Prefs = { ...DEFAULT_PREFS, ...imported };
    storage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ state, version: PREFS_VERSION }));
    return true;
  } catch {
    return false;
  }
}

function sanitize(input: Partial<Prefs> | undefined): Prefs {
  const p: Prefs = { ...DEFAULT_PREFS, ...(input ?? {}) };
  p.cellSize = Math.min(LIMITS.cellSize.max, Math.max(LIMITS.cellSize.min, Math.round(p.cellSize) || DEFAULT_PREFS.cellSize));
  p.wallWidth = Math.min(LIMITS.wallWidth.max, Math.max(LIMITS.wallWidth.min, Math.round(p.wallWidth) || DEFAULT_PREFS.wallWidth));
  p.speed = Math.min(LIMITS.speed.max, Math.max(LIMITS.speed.min, Math.round(p.speed) || DEFAULT_PREFS.speed));
  if (p.mode !== '2d' && p.mode !== '3d') p.mode = DEFAULT_PREFS.mode;
  if (p.maxProjectionDepth !== 'auto') {
    const n = Number(p.maxProjectionDepth);
    p.maxProjectionDepth = Number.isFinite(n)
      ? Math.min(LIMITS.maxProjectionDepth.max, Math.max(LIMITS.maxProjectionDepth.min, Math.round(n)))
      : 'auto';
  }
  for (const key of ['cellColor', 'wallColor', 'backgroundColor'] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(p[key])) p[key] = DEFAULT_PREFS[key];
  }
  if (!VERBOSITIES.includes(p.narratorVerbosity)) p.narratorVerbosity = DEFAULT_PREFS.narratorVerbosity;
  if (typeof p.screenReaderGrid !== 'boolean') p.screenReaderGrid = DEFAULT_PREFS.screenReaderGrid;
  if (typeof p.showStepLog !== 'boolean') p.showStepLog = DEFAULT_PREFS.showStepLog;
  return p;
}

function pickPrefs(state: PrefsStore): Prefs {
  const out = {} as Prefs;
  for (const k of PREF_KEYS) (out as unknown as Record<string, unknown>)[k] = state[k];
  return out;
}

/** Factory so tests can create isolated stores over a fresh Storage. */
export function createPrefsStore(storage?: Storage) {
  if (storage) seedPrefsFromLegacy(storage);
  return create<PrefsStore>()(
    persist(
      (set) => ({
        ...DEFAULT_PREFS,
        set: (key, value) => set({ [key]: value } as Partial<Prefs>),
        patch: (partial) => set(partial),
        reset: () => set({ ...DEFAULT_PREFS }),
      }),
      {
        name: PREFS_STORAGE_KEY,
        version: PREFS_VERSION,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: pickPrefs,
        merge: (persisted, current) => ({ ...current, ...sanitize(persisted as Partial<Prefs>) }),
        migrate: (persisted) => sanitize(persisted as Partial<Prefs>),
      },
    ),
  );
}

export const usePrefs = createPrefsStore(typeof localStorage !== 'undefined' ? localStorage : undefined);
