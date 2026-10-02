/** Keyboard shortcuts of the Play page, in the order they appear in the help dialog. */
export interface ShortcutGroup {
  readonly title: string;
  readonly items: ReadonlyArray<{ readonly keys: readonly string[]; readonly label: string }>;
}

export const PLAY_SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: 'Playback',
    items: [
      { keys: ['Space'], label: 'Play or pause' },
      { keys: ['.'], label: 'Advance one step' },
      { keys: ['N'], label: 'New maze with a fresh seed' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: ['T'], label: 'Toggle 2D / 3D' },
      { keys: ['V'], label: 'Cycle camera preset (3D)' },
      { keys: ['F'], label: 'Toggle follow pointer (3D)' },
      { keys: ['O'], label: 'Open options' },
    ],
  },
  {
    title: 'Run maze (first person)',
    items: [
      { keys: ['R'], label: 'Enter or leave Run Maze' },
      { keys: ['W', 'ArrowUp'], label: 'Step forward' },
      { keys: ['S', 'ArrowDown'], label: 'Step backward' },
      { keys: ['A', 'ArrowLeft'], label: 'Turn left' },
      { keys: ['D', 'ArrowRight'], label: 'Turn right' },
      { keys: ['P'], label: 'Peek over the walls (hold)' },
      { keys: ['I'], label: 'Describe where you are' },
      { keys: ['Esc'], label: 'Leave Run Maze' },
    ],
  },
  {
    title: 'Accessibility',
    items: [
      { keys: ['G'], label: 'Focus the screen-reader grid' },
      { keys: ['Arrows'], label: 'Move between cells in the grid' },
      { keys: ['Home', 'End'], label: 'Row start / end; with Ctrl: maze start / goal' },
      { keys: ['PageUp', 'PageDown'], label: 'Move 15 rows' },
      { keys: ['L'], label: 'Toggle the step log' },
      { keys: ['?'], label: 'This help' },
    ],
  },
];
