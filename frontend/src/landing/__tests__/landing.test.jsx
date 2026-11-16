import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import LandingPage from '../LandingPage.jsx';
import { graphEdges } from '../../api/mock.js';

// The hero canvas can't lay out under jsdom. The shared stub forwards a
// ref with the imperative handle GraphFrame calls (d3Force, zoomToFit).
vi.mock('react-force-graph-2d', () => import('../../test/forceGraphMock.jsx'));

describe('LandingPage', () => {
  it('renders the hero headline and lead', () => {
    const { container } = render(<LandingPage />);
    expect(container.textContent).toMatch(/Read the disagreement, not the summary/i);
    expect(screen.getByText(/A topic becomes a graph of claims/i)).toBeTruthy();
  });

  it('links the primary action into the app workspace', () => {
    render(<LandingPage />);
    const open = screen.getAllByText(/Open a demo graph/i);
    expect(open.length).toBeGreaterThan(0);
    open.forEach((el) => {
      expect(el.closest('a')?.getAttribute('href')).toBe('/app');
    });
  });

  it('shows the brand, nav, and footer meta', () => {
    render(<LandingPage />);
    expect(screen.getAllByText('ContextForge').length).toBeGreaterThan(0);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const year = String(new Date().getFullYear());
    expect(screen.getByText((c) => c.includes(year) && c.includes('MIT'))).toBeTruthy();
  });

  it('starts as a full-width bar and condenses on scroll', () => {
    render(<LandingPage />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.className).not.toContain('top-nav--condensed');

    act(() => {
      window.scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(nav.className).toContain('top-nav--condensed');
  });

  it('renders the hero graph as the fold', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('landing-graph')).toBeTruthy();
  });

  it('prints the sentence behind the sharpest edge at rest', () => {
    render(<LandingPage />);
    const readout = screen.getByTestId('edge-readout');
    expect(readout.textContent).toMatch(/retrieval accuracy drops 18%/);
    expect(readout.textContent).toMatch(/0\.91/);
    expect(readout.textContent).toMatch(/retrieval_accuracy/);
  });

  it('reprints the readout when another edge is hovered', async () => {
    render(<LandingPage />);
    const readout = screen.getByTestId('edge-readout');
    const before = readout.textContent;

    fireEvent.click(screen.getByTestId('fg-linkhover'));

    expect(readout.textContent).not.toBe(before);
    expect(readout.textContent).toContain(graphEdges.edges[1].type);
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
    ].forEach((t) => expect(screen.getAllByText(t).length).toBeGreaterThan(0));
  });

  it('lists the four gap queries', () => {
    render(<LandingPage />);
    [
      'unresolved_contradiction',
      'low_density',
      'stale_claim',
      'bridge_opportunity',
    ].forEach((g) => expect(screen.getByText(g)).toBeTruthy());
  });

  it('renders the three demo topics with the shipped dataset counts', () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent.replace(/\s+/g, ' ');
    expect(text).toMatch(/Retrieval Augmented Generation/);
    expect(text).toMatch(/Large Language Models/);
    expect(text).toMatch(/Diffusion Models/);
    // 3 / 5 / 4 papers, matching data/demo/*.json.
    expect(text).toMatch(/3 papers, 2 relationships, 1 gap/);
    expect(text).toMatch(/5 papers, 6 relationships, 2 gaps/);
    expect(text).toMatch(/4 papers, 5 relationships, 2 gaps/);
  });

  it('links each dataset row to the demo it names', () => {
    render(<LandingPage />);
    ['rag_2024', 'llms_2024', 'diffusion_2024'].forEach((id) => {
      const link = document.querySelector(`a[href="/app?demo=${id}"]`);
      expect(link).toBeTruthy();
    });
  });

  it('renders the pipeline as four stages', () => {
    render(<LandingPage />);
    ['ingestion', 'extraction', 'synthesis', 'gap finding'].forEach((stage) =>
      expect(screen.getByText(stage)).toBeTruthy(),
    );
  });

  it('does not credit a source the ingestion agent never calls', () => {
    render(<LandingPage />);
    expect(screen.queryByText('Allen AI')).toBeNull();
  });
});
