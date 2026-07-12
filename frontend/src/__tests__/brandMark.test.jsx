import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BrandMark from '../components/BrandMark.jsx';

describe('BrandMark', () => {
  it('renders an SVG', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<BrandMark className="my-mark" />);
    expect(container.firstChild).toHaveClass('my-mark');
  });

  it('has aria-hidden on the SVG (decorative)', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});
