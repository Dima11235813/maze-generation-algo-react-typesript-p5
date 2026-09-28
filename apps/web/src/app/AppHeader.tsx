import { Button, IconButton, cn } from '@maze/ui';
import { Link } from '@tanstack/react-router';
import { Monitor, Moon, Sun } from 'lucide-react';
import { usePrefs, type ThemePref } from '../state/prefs';

const NAV: readonly { to: '/play' | '/watch' | '/race' | '/build' | '/learn' | '/explore'; label: string }[] = [
  { to: '/play', label: 'Play' },
  { to: '/watch', label: 'Watch' },
  { to: '/race', label: 'Race' },
  { to: '/build', label: 'Build' },
  { to: '/learn', label: 'Learn' },
  { to: '/explore', label: 'Explore' },
];

const NEXT_THEME: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };

function ThemeToggle() {
  const theme = usePrefs((s) => s.theme);
  const set = usePrefs((s) => s.set);
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <IconButton
      aria-label={`Theme: ${theme}. Switch to ${NEXT_THEME[theme]}`}
      title={`Theme: ${theme}`}
      onClick={() => set('theme', NEXT_THEME[theme])}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </IconButton>
  );
}

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
      <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span
          aria-hidden="true"
          className="inline-block h-5 w-5 rounded-sm border-2 border-fg"
          style={{ boxShadow: 'inset 3px 3px 0 0 var(--accent)' }}
        />
        Maze Lab
      </Link>
      <nav aria-label="Primary" className="ml-2 hidden items-center gap-0.5 sm:flex">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-fg',
              '[&[data-status=active]]:bg-panel-2 [&[data-status=active]]:text-fg',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link to="/account">Account</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
