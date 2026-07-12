import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from '../LandingPage.jsx';

// The hero graph can't render under jsdom — mock the 2D/3D libs' default exports.
vi.mock('react-force-graph-2d', () => ({
  default: () => null,
}));
vi.mock('react-force-graph-3d', () => ({
  default: () => null,
}));

describe('LandingPage', () => {
  it('renders the hero headline and lead', () => {
    render(<LandingPage />);
    expect(screen.getByText(/See the shape of the research frontier/i)).toBeTruthy();
    expect(screen.getByText(/Launch the graph/i)).toBeTruthy();
  });

  it('links primary CTAs into the app workspace', () => {
    render(<LandingPage />);
    const launch = screen.getAllByText(/Launch (the graph|app|ContextForge)/i);
    launch.forEach((el) => {
      const link = el.closest('a');
      expect(link?.getAttribute('href')).toBe('/app');
    });
  });

  it('shows the brand, nav, and footer', () => {
    render(<LandingPage />);
    expect(screen.getAllByText('ContextForge').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation')).toBeTruthy();
    expect(screen.getByText(/Built for researchers mapping fast-moving fields/i)).toBeTruthy();
  });

  it('lists all eight relationship types', () => {
    render(<LandingPage />);
    [
      'CONTRADICTS',
      'EXTENDS',
      'REPLICATES',
      'REPLICATES_FAILED',
      'CHALLENGES',
      'CITES',
      'IMPLEMENTS',
      'DISAGREES_ON_SCOPE',
    ].forEach((t) => expect(screen.getByText(t)).toBeTruthy());
  });

  it('renders the three demo topics', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Retrieval Augmented Generation/i)).toBeTruthy();
    expect(screen.getByText(/Large Language Models/i)).toBeTruthy();
    expect(screen.getByText(/Diffusion Models/i)).toBeTruthy();
  });
});
