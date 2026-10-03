import {
  Button,
  IconButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from '@maze/ui';
import { Link } from '@tanstack/react-router';
import { Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
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

const linkClass = cn(
  'rounded-md px-2.5 py-1.5 text-sm text-muted hover:bg-panel-2 hover:text-fg',
  '[&[data-status=active]]:bg-panel-2 [&[data-status=active]]:text-fg',
);

/** Phone navigation: the primary links in a left sheet (the inline nav is hidden below `sm`). */
function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <IconButton
        className="sm:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </IconButton>
      <SheetContent side="left" aria-describedby="mobile-nav-desc">
        <SheetHeader>
          <SheetTitle>Maze Lab</SheetTitle>
          <SheetDescription id="mobile-nav-desc">Go to a section.</SheetDescription>
        </SheetHeader>
        <nav id="mobile-nav" aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(linkClass, 'min-h-11 text-base')}
            >
              {item.label}
            </Link>
          ))}
          <Link to="/account" onClick={() => setOpen(false)} className={cn(linkClass, 'min-h-11 text-base')}>
            Account
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AppHeader() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-panel px-2 sm:gap-3 sm:px-3">
      <MobileNav />
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
          <Link key={item.to} to={item.to} className={linkClass}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link to="/account">Account</Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
