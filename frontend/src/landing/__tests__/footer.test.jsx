import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer.jsx';
import * as route from '../useRoute.js';

describe('Footer', () => {
  it('renders three column headings', () => {
    render(<Footer />);
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
  });

  it('Product links are clickable and route to /app', () => {
    const spy = vi.spyOn(route, 'navigate').mockImplementation(() => {});
    render(<Footer />);
    const link = screen.getByText('Graph explorer');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/app');
    spy.mockRestore();
  });

  it('Resources/Company links are disabled spans', () => {
    render(<Footer />);
    const docLink = screen.getByText('Documentation');
    expect(docLink.tagName).toBe('SPAN');
    expect(docLink).toHaveClass('footer-link--disabled');
    const aboutLink = screen.getByText('About');
    expect(aboutLink.tagName).toBe('SPAN');
    expect(aboutLink).toHaveClass('footer-link--disabled');
  });

  it('renders the copyright notice with the current year', () => {
    render(<Footer />);
    const year = String(new Date().getFullYear());
    // The year is part of a larger text node; use a regex to match.
    const el = screen.getByText((content) => content.includes(year) && content.includes('ContextForge'));
    expect(el).toBeInTheDocument();
  });
});
