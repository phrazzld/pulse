import React from 'react';
import { render, screen } from '@testing-library/react';
import { Tag } from '../atoms/Tag';

describe('Tag component', () => {
  test('renders correctly with default props', () => {
    render(<Tag>Status</Tag>);
    const tag = screen.getByText('Status');
    expect(tag).toBeInTheDocument();
  });

  test('renders with primary variant by default', () => {
    render(<Tag>Primary Tag</Tag>);
    const tag = screen.getByText('Primary Tag');
    expect(tag).toHaveStyle(`color: var(--neon-green)`);
    expect(tag).toHaveStyle(`border: 1px solid var(--neon-green)`);
  });

  test('renders with secondary variant when specified', () => {
    render(<Tag variant="secondary">Secondary Tag</Tag>);
    const tag = screen.getByText('Secondary Tag');
    expect(tag).toHaveStyle(`color: var(--electric-blue)`);
    expect(tag).toHaveStyle(`border: 1px solid var(--electric-blue)`);
  });

  test('renders with danger variant when specified', () => {
    render(<Tag variant="danger">Danger Tag</Tag>);
    const tag = screen.getByText('Danger Tag');
    expect(tag).toHaveStyle(`color: var(--crimson-red)`);
    expect(tag).toHaveStyle(`border: 1px solid var(--crimson-red)`);
  });

  test('renders with warning variant when specified', () => {
    render(<Tag variant="warning">Warning Tag</Tag>);
    const tag = screen.getByText('Warning Tag');
    expect(tag).toHaveStyle(`color: var(--luminous-yellow)`);
    expect(tag).toHaveStyle(`border: 1px solid var(--luminous-yellow)`);
  });

  test('renders with medium size by default', () => {
    render(<Tag>Medium Tag</Tag>);
    const tag = screen.getByText('Medium Tag');
    expect(tag.classList.toString()).toContain('px-2 py-1 text-sm');
  });

  test('renders with small size when specified', () => {
    render(<Tag size="sm">Small Tag</Tag>);
    const tag = screen.getByText('Small Tag');
    expect(tag.classList.toString()).toContain('px-1.5 py-0.5 text-xs');
  });

  test('renders with count when provided', () => {
    render(<Tag count={42}>With Count</Tag>);
    expect(screen.getByText('With Count')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  test('applies additional className when provided', () => {
    render(<Tag className="extra-class">Custom Class</Tag>);
    const tag = screen.getByText('Custom Class');
    expect(tag.classList.contains('extra-class')).toBe(true);
  });

  test('renders with count container having dark background', () => {
    render(<Tag count={10}>Count Tag</Tag>);
    // Find the span containing the count
    const countContainer = screen.getByText('10');
    expect(countContainer).toHaveStyle(`background-color: rgba(0, 0, 0, 0.3)`);
  });
});