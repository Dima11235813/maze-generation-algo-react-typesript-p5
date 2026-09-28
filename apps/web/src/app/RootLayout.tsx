import { TooltipProvider } from '@maze/ui';
import { Outlet } from '@tanstack/react-router';
import { AnnouncerProvider } from './Announcer';
import { AppHeader } from './AppHeader';
import { useApplyDocumentPrefs } from './documentPrefs';

export function RootLayout() {
  useApplyDocumentPrefs();
  return (
    <AnnouncerProvider>
      <TooltipProvider delayDuration={300}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <AppHeader />
        <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
          <Outlet />
        </main>
      </TooltipProvider>
    </AnnouncerProvider>
  );
}
