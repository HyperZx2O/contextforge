import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer.jsx';

// The footer's closing statement was cut on request. What remains is a
// single meta band: brand, real destinations, licence.

describe('Footer', () => {
  it('renders the meta band', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('.foot__meta')).toBeInTheDocument();
    expect(container.querySelector('.foot__brand')).toBeInTheDocument();
  });

  it('does not render the removed closing statement', () => {
    render(<Footer />);
    expect(screen.queryByText(/Most of what a field believes/i)).toBeNull();
  });

  it('ships only real in-page destinations', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      const href = a.getAttribute('href');
      expect(href).toBeTruthy();
      // No placeholder destinations survive the redesign.
      expect(href).toMatch(/^(#|\/app)/);
    });
  });

  it('renders the copyright notice with the current year', () => {
    render(<Footer />);
    const year = String(new Date().getFullYear());
    const el = screen.getByText((content) =>
      content.includes(year) && content.includes('ContextForge'),
    );
    expect(el).toBeInTheDocument();
  });
});