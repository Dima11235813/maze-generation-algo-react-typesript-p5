import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../app/router';

describe('landing page', () => {
  it('renders the brand, the six pillars and a link to Play', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { level: 1, name: /maze lab/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start playing/i })).toHaveAttribute('href', '/play');
    // Play, Watch and Explore are live; Race, Build and Learn are still previews.
    expect(screen.getAllByText(/coming soon/i)).toHaveLength(3);
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  });

  it('shows the not-found page for unknown routes', async () => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/nowhere'] }));
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});
