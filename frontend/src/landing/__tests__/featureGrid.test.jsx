import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeatureGrid from '../components/FeatureGrid.jsx';

describe('FeatureGrid', () => {
  it('renders all six feature cards', () => {
    render(<FeatureGrid />);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(6);
  });

  it('renders Lucide SVG icons (not unicode glyphs)', () => {
    const { container } = render(<FeatureGrid />);
    const svgs = container.querySelectorAll('.feature-card__icon svg');
    expect(svgs.length).toBe(6);
  });

  it('includes the section heading', () => {
    render(<FeatureGrid />);
    expect(screen.getByText('A literature review that reads itself.')).toBeInTheDocument();
  });

  it('each card has a title and body', () => {
    render(<FeatureGrid />);
    expect(screen.getByText('Typed knowledge graph')).toBeInTheDocument();
    expect(screen.getByText('Evidence-grounded links')).toBeInTheDocument();
    expect(screen.getByText('Research gap detection')).toBeInTheDocument();
    expect(screen.getByText('Ask in plain language')).toBeInTheDocument();
    expect(screen.getByText('Multi-source ingestion')).toBeInTheDocument();
    expect(screen.getByText('Transparent pipeline')).toBeInTheDocument();
  });
});
