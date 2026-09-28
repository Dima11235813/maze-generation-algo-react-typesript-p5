import type { MazeDocument } from '@maze/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIBRARY_STORAGE_KEY, createLibraryStore } from './library';

const doc: MazeDocument = {
  v: 1,
  id: 'sha256:test',
  width: 3,
  height: 3,
  topology: 'orthogonal',
  walls: 'XZNlXAc',
  start: 0,
  goal: 8,
};

describe('library store', () => {
  beforeEach(() => localStorage.clear());

  it('adds, renames and removes items and persists them', () => {
    const store = createLibraryStore(localStorage);
    const item = store.getState().add({ name: '  My maze ', document: doc });
    expect(item.name).toBe('My maze');
    expect(store.getState().items).toHaveLength(1);

    store.getState().rename(item.id, 'Renamed');
    expect(store.getState().items[0]?.name).toBe('Renamed');

    const reloaded = createLibraryStore(localStorage);
    expect(reloaded.getState().items[0]?.name).toBe('Renamed');
    expect(localStorage.getItem(LIBRARY_STORAGE_KEY)).toContain('Renamed');

    reloaded.getState().remove(item.id);
    expect(reloaded.getState().items).toHaveLength(0);
  });

  it('falls back to a default name and keeps newest first', () => {
    const store = createLibraryStore(localStorage);
    store.getState().add({ name: 'first', document: doc });
    const second = store.getState().add({ name: '', document: doc });
    expect(second.name).toBe('Untitled maze');
    expect(store.getState().items[0]?.id).toBe(second.id);
  });
});
