import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFS,
  LEGACY_KEYS,
  PREFS_STORAGE_KEY,
  createPrefsStore,
  importLegacyPrefs,
  invertHex,
  parseLegacyColor,
} from './prefs';

describe('legacy preference import', () => {
  beforeEach(() => localStorage.clear());

  it('parses legacy "r:g:b:a" colours and drops alpha', () => {
    expect(parseLegacyColor('113:173:245:1')).toBe('#71adf5');
    expect(parseLegacyColor('65:117:5:')).toBe('#417505');
    expect(parseLegacyColor('255:255:255:100')).toBe('#ffffff');
    expect(parseLegacyColor('nonsense')).toBeNull();
    expect(parseLegacyColor(null)).toBeNull();
    expect(parseLegacyColor('300:-5:12')).toBe('#ff000c');
  });

  it('inverts the legacy wall colour (the old app drew the negative of the picker)', () => {
    expect(invertHex('#ffffff')).toBe('#000000');
    expect(invertHex('#417505')).toBe('#be8afa');
  });

  it('returns null when no legacy keys exist', () => {
    expect(importLegacyPrefs(localStorage)).toBeNull();
  });

  it('imports and clamps legacy values', () => {
    localStorage.setItem(LEGACY_KEYS.backgroundColor, '10:20:30:1');
    localStorage.setItem(LEGACY_KEYS.cellColor, '65:117:5:1');
    localStorage.setItem(LEGACY_KEYS.cellWallColor, '255:255:255:100');
    localStorage.setItem(LEGACY_KEYS.cellSize, '1');
    localStorage.setItem(LEGACY_KEYS.cellWallSize, '3');
    localStorage.setItem(LEGACY_KEYS.frameRate, '40');
    localStorage.setItem(LEGACY_KEYS.cellWallStrokeCapStyle, 'ROUND');

    const imported = importLegacyPrefs(localStorage);
    expect(imported).toEqual({
      backgroundColor: '#0a141e',
      cellColor: '#417505',
      wallColor: '#000000',
      cellSize: 3,
      wallWidth: 3,
      speed: 40,
    });
  });

  it('seeds the new store once and leaves legacy keys in place', () => {
    localStorage.setItem(LEGACY_KEYS.cellColor, '1:2:3:1');
    localStorage.setItem(LEGACY_KEYS.cellSize, '25');

    const store = createPrefsStore(localStorage);
    expect(store.getState().cellColor).toBe('#010203');
    expect(store.getState().cellSize).toBe(25);
    expect(store.getState().wallColor).toBe(DEFAULT_PREFS.wallColor);
    expect(localStorage.getItem(LEGACY_KEYS.cellSize)).toBe('25');
    expect(localStorage.getItem(PREFS_STORAGE_KEY)).not.toBeNull();

    // A later change persists and is not overwritten by the legacy values again.
    store.getState().set('cellSize', 12);
    const again = createPrefsStore(localStorage);
    expect(again.getState().cellSize).toBe(12);
  });

  it('sanitises corrupt persisted values', () => {
    localStorage.setItem(
      PREFS_STORAGE_KEY,
      JSON.stringify({ state: { cellSize: -4, mode: 'weird', cellColor: 'red', speed: 'fast' }, version: 1 }),
    );
    const store = createPrefsStore(localStorage);
    expect(store.getState().cellSize).toBe(3);
    expect(store.getState().mode).toBe('3d');
    expect(store.getState().cellColor).toBe(DEFAULT_PREFS.cellColor);
    expect(store.getState().speed).toBe(DEFAULT_PREFS.speed);
  });
});
